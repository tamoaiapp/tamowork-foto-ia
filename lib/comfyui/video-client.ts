import videoTemplate from "./video-template.json";

export const VIDEO_COMFY_BASES = (process.env.VIDEO_COMFY_BASES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function pickVideoComfyBase(): { base: string; index: number } {
  const index = Math.floor(Math.random() * VIDEO_COMFY_BASES.length);
  return { base: VIDEO_COMFY_BASES[index], index };
}

// Upload da imagem para o ComfyUI de vídeo
export async function uploadImageToVideoComfy(imageUrl: string, comfyBase: string, jobId?: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
  const buffer = await imgRes.arrayBuffer();

  const filename = jobId ? `product_${jobId.replace(/-/g, "").slice(0, 12)}.jpg` : `product_${Date.now()}.jpg`;

  const form = new FormData();
  form.append("image", new Blob([buffer], { type: "image/jpeg" }), filename);
  form.append("overwrite", "true");

  const res = await fetch(`${comfyBase}/upload/image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload ComfyUI vídeo error: ${res.status}`);

  const data = await res.json() as { name: string };
  return data.name;
}

// Monta o workflow de vídeo (sem submeter) — usado pelo RunPod Serverless
export function buildVideoWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  durationSec = 6,
  fps = 16,
  promptNeg?: string
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(videoTemplate)) as Record<string, unknown>;
  const seed = Math.floor(Math.random() * 999_999_999);
  const frames = Math.max(1, Math.floor(durationSec * fps));
  (workflow["52"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["6"] as { inputs: { text: string } }).inputs.text = promptPos || "a smooth slow camera move";
  if (promptNeg) (workflow["7"] as { inputs: { text: string } }).inputs.text = promptNeg;
  (workflow["50"] as { inputs: { length: number } }).inputs.length = frames;
  (workflow["63"] as { inputs: { frame_rate: number; filename_prefix: string } }).inputs.frame_rate = fps;
  (workflow["63"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["57"] as { inputs: { noise_seed: number } }).inputs.noise_seed = seed;
  (workflow["58"] as { inputs: { noise_seed: number } }).inputs.noise_seed = seed + 1;
  return workflow;
}

// Submete o workflow Wan I2V ao ComfyUI
export async function submitVideoWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  comfyBase: string,
  durationSec = 6,
  fps = 16,
  promptNeg?: string
): Promise<string> {
  const workflow = JSON.parse(JSON.stringify(videoTemplate)) as Record<string, unknown>;
  const seed = Math.floor(Math.random() * 999_999_999);
  const frames = Math.max(1, Math.floor(durationSec * fps));

  (workflow["52"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["6"] as { inputs: { text: string } }).inputs.text = promptPos || "a smooth slow camera move";
  if (promptNeg) (workflow["7"] as { inputs: { text: string } }).inputs.text = promptNeg;
  (workflow["50"] as { inputs: { length: number } }).inputs.length = frames;
  (workflow["63"] as { inputs: { frame_rate: number; filename_prefix: string } }).inputs.frame_rate = fps;
  (workflow["63"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["57"] as { inputs: { noise_seed: number } }).inputs.noise_seed = seed;
  (workflow["58"] as { inputs: { noise_seed: number } }).inputs.noise_seed = seed + 1;

  const res = await fetch(`${comfyBase}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`submitVideoWorkflow error: ${res.status}`);

  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

// Checa histórico do ComfyUI e retorna URL do MP4 se pronto
export async function getVideoHistory(
  promptId: string,
  comfyBase: string
): Promise<{ outputUrl: string | null; status: "done" | "failed" | "pending" }> {
  const res = await fetch(`${comfyBase}/history/${promptId}`);
  if (!res.ok) return { outputUrl: null, status: "pending" };

  const history = await res.json() as Record<string, unknown>;
  const entry = history[promptId] as {
    outputs?: Record<string, {
      gifs?: { filename: string; subfolder: string; type: string }[];
      videos?: { filename: string; subfolder: string; type: string }[];
    }>;
    status?: { status_str?: string };
  } | undefined;

  if (!entry) return { outputUrl: null, status: "pending" };

  // Node 63 é o VHS_VideoCombine — retorna MP4 em "gifs"
  const node63 = entry.outputs?.["63"];
  const candidates = [...(node63?.gifs ?? []), ...(node63?.videos ?? [])];
  const mp4 = candidates.find((f) => f.filename?.toLowerCase().endsWith(".mp4"));

  if (mp4) {
    const outputUrl = `${comfyBase}/view?filename=${encodeURIComponent(mp4.filename)}&subfolder=${encodeURIComponent(mp4.subfolder)}&type=${mp4.type}`;
    return { outputUrl, status: "done" };
  }

  if (entry.status?.status_str === "error") {
    return { outputUrl: null, status: "failed" };
  }

  return { outputUrl: null, status: "pending" };
}
