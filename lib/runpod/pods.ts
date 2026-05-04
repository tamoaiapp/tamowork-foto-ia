// RunPod Pod management — stop idle pods, resume on demand

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? "";
const GRAPHQL = "https://api.runpod.io/graphql";

// Pod IDs (em ordem de prioridade para foto)
export const FOTO_POD_IDS = (process.env.FOTO_POD_IDS ?? "bplqvtp059e2dc,64u9u09pqlya53").split(",").map(s => s.trim()).filter(Boolean);
export const VIDEO_POD_ID = process.env.VIDEO_POD_ID ?? "h0by4qrq3g2p7s";

async function gql(query: string) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  return res.json() as Promise<{ data?: Record<string, unknown>; errors?: { message: string }[] }>;
}

export async function getPodStatus(podId: string): Promise<"RUNNING" | "EXITED" | "UNKNOWN"> {
  const r = await gql(`{ pod(input: { podId: "${podId}" }) { desiredStatus runtime { uptimeInSeconds } } }`);
  const pod = (r.data?.pod as { desiredStatus?: string; runtime?: unknown } | null);
  if (!pod) return "UNKNOWN";
  if (pod.desiredStatus === "RUNNING" && pod.runtime) return "RUNNING";
  return "EXITED";
}

export async function stopPod(podId: string): Promise<void> {
  await gql(`mutation { podStop(input: { podId: "${podId}" }) { id desiredStatus } }`);
}

export async function resumePod(podId: string): Promise<void> {
  await gql(`mutation { podResume(input: { podId: "${podId}", gpuCount: 1 }) { id desiredStatus } }`);
}

// Aguarda pod estar RUNNING e ComfyUI respondendo
export async function waitForPodReady(comfyBase: string, timeoutMs = 180_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${comfyBase}/system_stats`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) return true;
    } catch {
      // ainda não pronto
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

// Para um pod específico (para fins do cron)
export async function stopIdleFotoPod(podId: string): Promise<void> {
  await stopPod(podId);
}

export async function stopIdleVideoPod(): Promise<void> {
  await stopPod(VIDEO_POD_ID);
}

// Liga o primeiro pod de foto que estiver EXITED e aguarda estar pronto
// Checa se o pod está pronto (rápido, sem wait).
// Se não estiver, dispara o resume e retorna false imediatamente.
// O caller agenda retry via QStash para daqui ~4 minutos.
// Verifica se ComfyUI está saudável (retorna JSON com system_stats)
async function isComfyHealthy(comfyBase: string): Promise<boolean> {
  try {
    const r = await fetch(`${comfyBase}/system_stats`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return false;
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return false;
    const json = await r.json() as Record<string, unknown>;
    return !!json.system;
  } catch {
    return false;
  }
}

// Tenta destravar ComfyUI sem reiniciar o pod (interrupt + clear queue)
// Retorna true se conseguiu destravar, false se precisar de restart completo
async function tryUnfreezeComfy(comfyBase: string): Promise<boolean> {
  try {
    // 1. Interrompe job atual travado
    await fetch(`${comfyBase}/interrupt`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});

    // 2. Limpa a fila interna do ComfyUI
    await fetch(`${comfyBase}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});

    // 3. Aguarda 3s e verifica se voltou
    await new Promise(r => setTimeout(r, 3000));
    return await isComfyHealthy(comfyBase);
  } catch {
    return false;
  }
}

// Grace period: só faz restart se pod está rodando há mais de 15 min sem ComfyUI responder
// Evita matar o pod enquanto o Qwen ainda está carregando (~10-12 min)
const RESTART_GRACE_MS = 15 * 60 * 1000;

async function getPodUptimeMs(podId: string): Promise<number> {
  try {
    const r = await gql(`{ pod(input: { podId: "${podId}" }) { runtime { uptimeInSeconds } } }`);
    const uptime = (r.data?.pod as { runtime?: { uptimeInSeconds?: number } } | null)?.runtime?.uptimeInSeconds ?? 0;
    return uptime * 1000;
  } catch {
    return 0;
  }
}

export async function ensureFotoPodRunning(comfyBase: string): Promise<boolean> {
  const healthy = await isComfyHealthy(comfyBase);
  if (healthy) return true;

  // Tenta destravar sem restart (só funciona se ComfyUI já subiu mas travou)
  const unfrozen = await tryUnfreezeComfy(comfyBase);
  if (unfrozen) return true;

  const match = comfyBase.match(/https?:\/\/([a-z0-9]+)-\d+\.proxy\.runpod\.net/);
  const podId = match ? match[1] : null;

  if (podId) {
    const status = await getPodStatus(podId);
    if (status === "RUNNING") {
      // Só reinicia se passou do grace period — senão o Qwen ainda está carregando
      const uptimeMs = await getPodUptimeMs(podId);
      if (uptimeMs < RESTART_GRACE_MS) {
        // Pod novo, ainda carregando — aguarda
        return false;
      }
      // Pod rodando há muito tempo mas ComfyUI morto → stop + resume
      await stopPod(podId).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      await resumePod(podId).catch(() => {});
    } else {
      await resumePod(podId).catch(() => {});
    }
  } else {
    for (const id of FOTO_POD_IDS) {
      await resumePod(id).catch(() => {});
    }
  }

  return false;
}

export async function ensureVideoPodRunning(comfyBase: string): Promise<boolean> {
  const healthy = await isComfyHealthy(comfyBase);
  if (healthy) return true;

  const unfrozen = await tryUnfreezeComfy(comfyBase);
  if (unfrozen) return true;

  const status = await getPodStatus(VIDEO_POD_ID);
  if (status === "RUNNING") {
    const uptimeMs = await getPodUptimeMs(VIDEO_POD_ID);
    if (uptimeMs < RESTART_GRACE_MS) return false;
    await stopPod(VIDEO_POD_ID).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  }
  await resumePod(VIDEO_POD_ID).catch(() => {});

  return false;
}
