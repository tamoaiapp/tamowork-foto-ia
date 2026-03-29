// Fluxo direto ao ComfyUI (sem clouda/cloudb/Firestore):
// 1. criarPrompt  → promptuso (mantido no GCP)
// 2. uploadImage  → ComfyUI /upload/image
// 3. submitWorkflow → ComfyUI /prompt  → prompt_id
// 4. getComfyHistory → ComfyUI /history/{prompt_id} → outputUrl

import templateJson from "./prompt_template.json";

const PROMPTUSO_URL =
  process.env.COMFYUI_RUN_URL ||
  `${process.env.APP_URL ?? "http://localhost:3003"}/api/prompt`;
export const COMFY_BASES = (process.env.COMFY_BASES ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export interface PromptResult {
  positive: string;
  negative: string;
  produto?: string;
  cenario?: string;
  meta?: Record<string, unknown>;
}

// criar prompt — promptuso: produto_frase + cenario → positive + negative
export async function criarPrompt(
  produto_frase: string,
  cenario: string
): Promise<PromptResult> {
  const res = await fetch(PROMPTUSO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ produto_frase, cenario }),
  });
  if (!res.ok) throw new Error(`criarPrompt error: ${res.status}`);
  return res.json();
}

// Escolhe instância do ComfyUI — prioriza pod 2 no horário comercial (8h-20h BRT)
export function pickComfyBase(): { base: string; index: number } {
  if (COMFY_BASES.length <= 1) return { base: COMFY_BASES[0], index: 0 };

  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24;
  const isBusinessHours = hourBRT >= 8 && hourBRT < 20;

  // Durante horário comercial: pod 2 (index 1) tem prioridade
  // Fora do horário: apenas pod 1 (index 0)
  const index = isBusinessHours ? 1 : 0;
  return { base: COMFY_BASES[index], index };
}

// Faz download da imagem e envia para o ComfyUI
export async function uploadImageToComfy(imageUrl: string, comfyBase: string, jobId?: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
  const buffer = await imgRes.arrayBuffer();

  // Nome único por job para evitar cache do ComfyUI entre jobs diferentes
  const filename = jobId ? `product_${jobId.replace(/-/g, "").slice(0, 12)}.jpg` : `product_${Date.now()}.jpg`;

  const form = new FormData();
  const blob = new Blob([buffer], { type: "image/jpeg" });
  form.append("image", blob, filename);
  form.append("overwrite", "true");

  const res = await fetch(`${comfyBase}/upload/image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload ComfyUI error: ${res.status}`);

  const data = await res.json();
  return data.name as string;
}

// Monta o workflow preenchido (sem submeter) — usado pelo RunPod Serverless
export function buildFotoWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  promptNeg: string
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(templateJson)) as Record<string, unknown>;
  (workflow["11"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["1"] as { inputs: { prompt: string } }).inputs.prompt = `${promptPos}\n#job:${jobId}\n`;
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt = promptNeg;
  (workflow["166"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["167"] as { inputs: { seed: number } }).inputs.seed = Math.floor(Math.random() * 999_999_999);
  return workflow;
}

// Preenche o template e submete o workflow ao ComfyUI
export async function submitWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  promptNeg: string,
  comfyBase: string
): Promise<string> {
  // Deep clone do template
  const workflow = JSON.parse(JSON.stringify(templateJson)) as Record<string, unknown>;

  // Preencher os campos dinâmicos
  (workflow["11"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["1"] as { inputs: { prompt: string } }).inputs.prompt = `${promptPos}\n#job:${jobId}\n`;
  (workflow["39"] as { inputs: { prompt: string } }).inputs.prompt = promptNeg;
  (workflow["166"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["167"] as { inputs: { seed: number } }).inputs.seed = Math.floor(Math.random() * 999_999_999);

  const res = await fetch(`${comfyBase}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`submitWorkflow error: ${res.status}`);

  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

// Consulta o histórico do ComfyUI para verificar se o job está pronto
export async function getComfyHistory(
  promptId: string,
  comfyBase: string
): Promise<{ outputUrl: string | null; status: "done" | "failed" | "pending" }> {
  const res = await fetch(`${comfyBase}/history/${promptId}`);
  if (!res.ok) return { outputUrl: null, status: "pending" };

  const history = await res.json() as Record<string, unknown>;
  const entry = history[promptId] as {
    outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>;
    status?: { status_str?: string };
  } | undefined;

  if (!entry) return { outputUrl: null, status: "pending" };

  // Imagem pronta — node 166 é o SaveImage
  const saveOutput = entry.outputs?.["166"];
  if (saveOutput?.images?.length) {
    const img = saveOutput.images[0];
    const outputUrl = `${comfyBase}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
    return { outputUrl, status: "done" };
  }

  // Falha
  if (entry.status?.status_str === "error") {
    return { outputUrl: null, status: "failed" };
  }

  return { outputUrl: null, status: "pending" };
}
