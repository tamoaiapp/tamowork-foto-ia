import videoTemplate from "./video-template.json";
import { type PhotoFormat, VIDEO_DIMS, DEFAULT_FORMAT } from "@/lib/formats";

/** Troca ImageScaleBy (relativo) por ImageScale (absoluto) com as dimensões do formato */
function applyFormatToVideoWorkflow(workflow: Record<string, unknown>, format: PhotoFormat) {
  const { w, h } = VIDEO_DIMS[format];
  (workflow["100"] as { class_type: string; inputs: Record<string, unknown> }).class_type = "ImageScale";
  const node100 = workflow["100"] as { inputs: Record<string, unknown> };
  delete node100.inputs.scale_by;
  delete node100.inputs.upscale_method;
  node100.inputs = {
    image: ["52", 0],
    width: w,
    height: h,
    upscale_method: "lanczos",
    crop: "center",
  };
}

export const VIDEO_COMFY_BASES = (process.env.VIDEO_COMFY_BASES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Resolução máxima para geração de vídeo (lado maior)
// 512px → ~3-5 min no A40. 1024px → 30+ min.
const MAX_VIDEO_PX = 512;

// Lê dimensões de imagem JPEG/PNG sem baixar o arquivo completo
async function getImageDimensions(url: string): Promise<{ w: number; h: number } | null> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-2048" } });
    const buf = Buffer.from(await res.arrayBuffer());
    // JPEG: procura marcador SOF (FF C0, FF C1, FF C2)
    for (let i = 0; i < buf.length - 8; i++) {
      if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC1 || buf[i+1] === 0xC2)) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
    }
    // PNG: dimensões nos bytes 16-24
    if (buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
  } catch { /* ignora */ }
  return null;
}

// Calcula scale_by para que o lado maior fique dentro de MAX_VIDEO_PX
export async function calcVideoScaleFactor(imageUrl: string): Promise<number> {
  const dims = await getImageDimensions(imageUrl);
  if (!dims) return 0.5; // fallback conservador
  const longest = Math.max(dims.w, dims.h);
  // Garante que o lado maior não passe de MAX_VIDEO_PX após o scale
  return Math.min(0.5, MAX_VIDEO_PX / longest);
}

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

/**
 * Gera prompt de câmera para vídeo baseado no tipo de produto.
 * Wan2.2 responde bem a instruções de movimento em inglês.
 * Se o usuário forneceu prompt suficiente (≥15 chars), usa o dele.
 */
export function buildVideoPrompt(userPrompt: string): string {
  const p = (userPrompt ?? "").trim();
  if (p.length >= 15) return p;

  const t = p.toLowerCase();
  const has = (words: string[]) => words.some(w => t.includes(w));

  // Joias de close-up
  if (has(["brinco", "earring", "argola", "piercing"]))
    return "Cinematic slow zoom in on the earring, shallow depth of field, jewelry catching soft light, elegant close-up reveal.";
  if (has(["colar", "necklace", "corrente", "gargantilha", "choker"]))
    return "Smooth close-up pan along the necklace, catching natural light on the metal, elegant jewelry reveal.";
  if (has(["anel", "ring", "alianca"]))
    return "Slow rotating close-up of the ring on finger, gemstone catching light, luxury jewelry photography motion.";
  if (has(["pulseira", "bracelet", "relogio", "watch", "smartwatch"]))
    return "Slow wrist rotation showcasing the piece, light catching the details, elegant jewelry commercial motion.";

  // Óculos
  if (has(["oculos", "glasses", "sunglasses", "eyewear"]))
    return "Smooth slow camera push in toward the face, eyewear catching light, fashion editorial motion.";

  // Calçado
  if (has(["tenis", "sapato", "sandalia", "bota", "chuteira", "shoe", "sneaker", "boot", "sandal"]))
    return "Low angle cinematic reveal panning up from the shoes, footwear is the hero, commercial product motion.";

  // Bolsa / mochila
  if (has(["bolsa", "mochila", "bag", "backpack", "pochete", "crossbody"]))
    return "Slow 180-degree orbit around the bag, showcasing all sides, soft studio lighting in motion.";

  // Chapéu / boné
  if (has(["chapeu", "bone", "hat", "cap", "beanie", "gorro"]))
    return "Smooth slow push in toward the hat, model slow head tilt, accessory highlight in motion.";

  // Roupas — full body reveal
  if (has(["vestido", "dress", "camisa", "shirt", "calca", "pants", "jaqueta", "jacket",
           "blusa", "top", "conjunto", "set", "roupa", "clothing", "moletom", "hoodie"]))
    return "Smooth vertical pan from shoes to face revealing the complete outfit, fashion editorial reveal.";

  // Beleza / cosméticos
  if (has(["perfume", "fragrance", "creme", "cream", "batom", "lipstick", "maquiagem", "makeup", "serum"]))
    return "Elegant slow orbit around the beauty product, soft diffused studio lighting in motion, luxury feel.";

  // Alimentos
  if (has(["bolo", "torta", "doce", "brigadeiro", "pizza", "hamburguer", "food", "snack"]))
    return "Cinematic top-down slow rotation, food styling motion, appetizing warm lighting reveal.";

  // Padrão genérico melhorado
  return "Smooth cinematic slow zoom in on the product, highlighting every detail. Professional commercial video quality, natural lighting.";
}

// Monta o workflow de vídeo (sem submeter) — usado pelo RunPod Serverless e pelo ComfyUI direto
export function buildVideoWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  durationSec = 6,
  fps = 16,
  promptNeg?: string,
  scaleFactor = 0.5,
  format: PhotoFormat = DEFAULT_FORMAT,
): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(videoTemplate)) as Record<string, unknown>;
  const seed = Math.floor(Math.random() * 999_999_999);
  const frames = Math.max(1, Math.floor(durationSec * fps));
  (workflow["52"] as { inputs: { image: string } }).inputs.image = imageName;
  (workflow["6"] as { inputs: { text: string } }).inputs.text = buildVideoPrompt(promptPos);
  if (promptNeg) (workflow["7"] as { inputs: { text: string } }).inputs.text = promptNeg;
  (workflow["50"] as { inputs: { length: number } }).inputs.length = frames;
  (workflow["63"] as { inputs: { frame_rate: number; filename_prefix: string } }).inputs.frame_rate = fps;
  (workflow["63"] as { inputs: { filename_prefix: string } }).inputs.filename_prefix = `job_${jobId}`;
  (workflow["57"] as { inputs: { noise_seed: number } }).inputs.noise_seed = seed;
  (workflow["58"] as { inputs: { noise_seed: number } }).inputs.noise_seed = seed + 1;
  (workflow["100"] as { inputs: { scale_by: number } }).inputs.scale_by = scaleFactor;
  applyFormatToVideoWorkflow(workflow, format);
  return workflow;
}

// Submete o workflow Wan I2V ao ComfyUI — usa buildVideoWorkflow internamente
export async function submitVideoWorkflow(
  jobId: string,
  imageName: string,
  promptPos: string,
  comfyBase: string,
  durationSec = 6,
  fps = 16,
  promptNeg?: string,
  _imageUrl?: string,
  format: PhotoFormat = DEFAULT_FORMAT,
): Promise<string> {
  const workflow = buildVideoWorkflow(jobId, imageName, promptPos, durationSec, fps, promptNeg, 0.5, format);

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
