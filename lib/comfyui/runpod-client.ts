// RunPod Serverless API client
// Documentação: https://docs.runpod.io/serverless/references/endpoint-operations

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? "";
const BASE_URL = "https://api.runpod.ai/v2";

// Default = endpoint comfyui-serverless validado (worker-comfyui 5.8.5 + Qwen-2511 + LoRA).
export const RUNPOD_FOTO_ENDPOINT = process.env.RUNPOD_FOTO_ENDPOINT_ID ?? "6igeofbzrfl3vv";
export const RUNPOD_VIDEO_ENDPOINT = process.env.RUNPOD_VIDEO_ENDPOINT_ID ?? "ejvkjws79zch5f";

export interface RunpodJobResult {
  status: "done" | "pending" | "failed";
  outputs: string[]; // base64 encoded (images ou vídeos)
}

// Submete um job ao RunPod Serverless — retorna o runpodJobId.
// Assinatura ORIGINAL (1 imagem) — mantida pra não quebrar o video-jobs que já a usa.
export async function submitRunpodJob(
  endpointId: string,
  workflow: Record<string, unknown>,
  imageUrl: string,
  imageName = "product.jpg"
): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
  const base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

  const res = await fetch(`${BASE_URL}/${endpointId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input: { workflow, images: [{ name: imageName, image: base64 }] } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RunPod submit ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

// Consulta o status de um job RunPod Serverless
export async function checkRunpodJob(
  endpointId: string,
  runpodJobId: string
): Promise<RunpodJobResult> {
  const res = await fetch(`${BASE_URL}/${endpointId}/status/${runpodJobId}`, {
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
  });

  if (!res.ok) return { status: "pending", outputs: [] };

  const data = (await res.json()) as {
    status: string;
    output?: {
      // worker-comfyui (atual): images[].data (base64)
      images?: { data?: string; type?: string }[];
      // handler custom antigo: message[] + status
      message?: string | string[];
      status?: string;
    } | null;
    error?: string;
  };

  // Status possíveis: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, CANCELLED, TIMED_OUT
  if (data.status === "COMPLETED") {
    const o = data.output ?? {};
    // formato worker-comfyui
    const fromImages = (o.images ?? []).map((im) => im.data).filter((d): d is string => !!d);
    if (fromImages.length > 0) return { status: "done", outputs: fromImages };
    // formato antigo (message)
    const msg = o.message;
    const fromMessage = Array.isArray(msg) ? msg : msg ? [msg] : [];
    if (fromMessage.length > 0) return { status: "done", outputs: fromMessage };
    return { status: "failed", outputs: [] }; // COMPLETED sem imagem = trata como falha
  }

  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(data.status)) {
    return { status: "failed", outputs: [] };
  }

  return { status: "pending", outputs: [] };
}
