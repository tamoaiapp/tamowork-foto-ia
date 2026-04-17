// Fluxo direto ao ComfyUI:
// 1. criarPrompt  → /api/prompt (Vercel — sem dependência do Cloud Run)
// 2. uploadImage  → ComfyUI /upload/image
// 3. submitWorkflow → ComfyUI /prompt  → prompt_id
// 4. getComfyHistory → ComfyUI /history/{prompt_id} → outputUrl

import templateJson from "./prompt_template.json";
import { type PhotoFormat, PHOTO_DIMS, DEFAULT_FORMAT } from "@/lib/formats";

/** Injeta nó ImageScale (168) antes do FluxKontextImageScale (160) para forçar as dimensões do formato */
function applyFormatToFotoWorkflow(workflow: Record<string, unknown>, format: PhotoFormat) {
  const { w, h } = PHOTO_DIMS[format];
  // Adiciona nó de resize antes do FluxKontextImageScale
  (workflow as Record<string, unknown>)["168"] = {
    class_type: "ImageScale",
    inputs: {
      image: ["11", 0],
      width: w,
      height: h,
      upscale_method: "lanczos",
      crop: "center",
    },
    _meta: { title: `Format: ${format} ${w}x${h}` },
  };
  // FluxKontextImageScale passa a ler do resize em vez do LoadImage direto
  (workflow["160"] as { inputs: { image: unknown } }).inputs.image = ["168", 0];
}

// Sempre usa o /api/prompt interno (Vercel) — Cloud Run removido
const PROMPTUSO_URL = `${process.env.APP_URL ?? "http://localhost:3003"}/api/prompt`;
export const COMFY_BASES = (process.env.COMFY_BASES ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export interface PromptResult {
  positive: string;
  negative: string;
  produto?: string;
  cenario?: string;
  meta?: Record<string, unknown>;
}

// criar prompt — promptuso: produto_frase + cenario + vision_desc → positive + negative
export async function criarPrompt(
  produto_frase: string,
  cenario: string,
  vision_desc?: string,
  user_feedback?: string,
): Promise<PromptResult> {
  const res = await fetch(PROMPTUSO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ produto_frase, cenario, vision_desc, user_feedback }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`criarPrompt error: ${res.status}`);
  return res.json();
}

// Sempre usa o pod 1 (index 0) — fila de 1 job por vez garante que não sobrecarrega
export function pickComfyBase(): { base: string; index: number } {
  return { base: COMFY_BASES[0], index: 0 };
}

// Deleta o output gerado do workspace do ComfyUI (arquivo pesado que enche o disco)
// Deve ser chamado APÓS a imagem já ter sido salva no Supabase
export async function deleteComfyOutput(jobId: string, comfyBase: string): Promise<void> {
  try {
    const filename = `job_${jobId}_00001_.png`;
    await fetch(`${comfyBase}/upload/image`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, subfolder: "", type: "output" }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    // best-effort
  }
}

// Limpa arquivos temporários do ComfyUI após job concluído
// Evita que o disco de 200GB encha com imagens acumuladas
export async function cleanupComfyJob(jobId: string, comfyBase: string): Promise<void> {
  try {
    // Deleta do histórico do ComfyUI (libera memória do processo)
    await fetch(`${comfyBase}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: [jobId] }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});

    // Deleta arquivos de input do job (product_* e model_*)
    const filesToDelete = [
      `prod_${jobId.replace(/-/g, "").slice(0, 12)}`,
      `model_${jobId.replace(/-/g, "").slice(0, 12)}`,
      `job_${jobId}`,
    ];
    for (const name of filesToDelete) {
      await fetch(`${comfyBase}/upload/image`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: name + ".jpg" }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {});
    }
  } catch {
    // Limpeza é best-effort — não deve falhar o job
  }
}

// Faz download da imagem e envia para o ComfyUI
export async function uploadImageToComfy(imageUrl: string, comfyBase: string, jobId?: string): Promise<string> {
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
  const buffer = await imgRes.arrayBuffer();

  // Nome único por job para evitar cache do ComfyUI entre jobs diferentes
  const filename = jobId ? `product_${jobId.replace(/-/g, "").slice(0, 12)}.jpg` : `product_${Date.now()}.jpg`;

  // Construir multipart manualmente para garantir compatibilidade com Node.js 18
  const boundary = `----FormBoundary${Date.now()}`;
  const imageBuffer = Buffer.from(buffer);
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${comfyBase}/upload/image`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: multipart,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Upload ComfyUI error: ${res.status}`);

  const data = await res.json();
  return data.name as string;
}

// Negativo base aplicado em todos os jobs para evitar artefatos visuais comuns
const BASE_NEGATIVE = [
  "skin lines, skin scratches, skin cracks, skin artifacts",
  "rough skin texture, exaggerated skin texture, overdetailed skin",
  "skin veins, stretch marks, skin marks, skin wrinkles overdetailed",
  "blurry, low quality, pixelated, jpeg artifacts, noise",
  "watermark, text, logo, signature",
].join(", ");

function mergeNegative(promptNeg: string): string {
  return promptNeg ? `${promptNeg}, ${BASE_NEGATIVE}` : BASE_NEGATIVE;
}

// Monta o workflow preenchido (sem submeter) — usado pelo RunPod Serverless
export function buildFotoWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  promptNeg: string,
  format: PhotoFormat = DEFAULT_FORMAT,
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(templateJson)) as Record<string, unknown>;
  (workflow["11"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["1"] as { inputs: { prompt: string } }).inputs.prompt = `${promptPos}\n#job:${jobId}\n`;
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt = mergeNegative(promptNeg);
  (workflow["166"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["167"] as { inputs: { seed: number } }).inputs.seed = Math.floor(Math.random() * 999_999_999);
  applyFormatToFotoWorkflow(workflow, format);
  return workflow;
}

// Preenche o template e submete o workflow ao ComfyUI
export async function submitWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  promptNeg: string,
  comfyBase: string,
  format: PhotoFormat = DEFAULT_FORMAT,
): Promise<string> {
  // Deep clone do template
  const workflow = JSON.parse(JSON.stringify(templateJson)) as Record<string, unknown>;

  // Preencher os campos dinâmicos
  (workflow["11"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["1"] as { inputs: { prompt: string } }).inputs.prompt = `${promptPos}\n#job:${jobId}\n`;
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt = mergeNegative(promptNeg);
  (workflow["166"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["167"] as { inputs: { seed: number } }).inputs.seed = Math.floor(Math.random() * 999_999_999);
  applyFormatToFotoWorkflow(workflow, format);

  const res = await fetch(`${comfyBase}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`submitWorkflow error: ${res.status}`);

  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

// Submete o workflow de catálogo (2 imagens: produto + modelo)
import catalogTemplateJson from "./catalog_template.json";

export async function submitCatalogWorkflow(
  jobId: string,
  productImageName: string,
  modelImageName: string,
  promptPos: string,
  promptNeg: string,
  comfyBase: string
): Promise<string> {
  const workflow = JSON.parse(JSON.stringify(catalogTemplateJson)) as Record<string, unknown>;
  (workflow["11"] as { inputs: { image: string } }).inputs.image = productImageName;
  (workflow["200"] as { inputs: { image: string } }).inputs.image = modelImageName;
  (workflow["1"] as { inputs: { prompt: string } }).inputs.prompt = `${promptPos}\n#job:${jobId}\n`;
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt = mergeNegative(promptNeg);
  (workflow["166"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["167"] as { inputs: { seed: number } }).inputs.seed = Math.floor(Math.random() * 999_999_999);

  const res = await fetch(`${comfyBase}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`submitCatalogWorkflow error: ${res.status}`);
  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

// Consulta o histórico do ComfyUI para verificar se o job está pronto
export async function getComfyHistory(
  promptId: string,
  comfyBase: string
): Promise<{ outputUrl: string | null; status: "done" | "failed" | "pending"; isOOM?: boolean }> {
  const res = await fetch(`${comfyBase}/history/${promptId}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return { outputUrl: null, status: "pending" };

  const history = await res.json() as Record<string, unknown>;
  const entry = history[promptId] as {
    outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
    status?: {
      status_str?: string;
      messages?: unknown[][];
    };
  } | undefined;

  if (!entry) return { outputUrl: null, status: "pending" };

  // Imagem pronta — node 166 é o SaveImage
  const saveOutput = entry.outputs?.["166"];
  if (saveOutput?.images?.length) {
    const img = saveOutput.images[0];
    const outputUrl = `${comfyBase}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
    return { outputUrl, status: "done" };
  }

  // Falha — detecta OOM para liberar VRAM antes do retry
  if (entry.status?.status_str === "error") {
    const msgs = entry.status.messages ?? [];
    const isOOM = msgs.some(m => {
      const errMsg = (m as { exception_message?: string; exception_type?: string })?.exception_message ?? "";
      const errType = (m as { exception_type?: string })?.exception_type ?? "";
      return (
        errType.includes("OutOfMemoryError") ||
        errMsg.toLowerCase().includes("out of memory") ||
        errMsg.toLowerCase().includes("allocation on device")
      );
    });
    return { outputUrl: null, status: "failed", isOOM };
  }

  return { outputUrl: null, status: "pending" };
}

// Libera modelos da VRAM do ComfyUI — chama após OOM para limpar antes do retry
export async function freeComfyMemory(comfyBase: string): Promise<void> {
  try {
    await fetch(`${comfyBase}/free`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`[comfy] VRAM liberada via /free em ${comfyBase}`);
  } catch (e) {
    console.warn(`[comfy] /free falhou (não crítico):`, e);
  }
}
