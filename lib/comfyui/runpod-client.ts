// RunPod Serverless API client
// Documentação: https://docs.runpod.io/serverless/references/endpoint-operations

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY ?? "";
const BASE_URL = "https://api.runpod.ai/v2";

// Endpoint serverless de foto: comfyui-serverless (RTX 5090 + A40). Trocou o endpoint
// antigo eeqi251ru6qxf9 (abandonado). Sobrescreva via RUNPOD_FOTO_ENDPOINT_ID no Vercel.
export const RUNPOD_FOTO_ENDPOINT = process.env.RUNPOD_FOTO_ENDPOINT_ID ?? "6igeofbzrfl3vv";
export const RUNPOD_VIDEO_ENDPOINT = process.env.RUNPOD_VIDEO_ENDPOINT_ID ?? "ejvkjws79zch5f";

export interface RunpodJobResult {
  status: "done" | "pending" | "failed";
  outputs: string[]; // base64 encoded (images ou vídeos)
}

async function fetchAsBase64(url: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Falha ao baixar imagem: ${r.status}`);
  return Buffer.from(await r.arrayBuffer()).toString("base64");
}

// Submete um job ao RunPod Serverless — retorna o runpodJobId.
// Aceita imagem principal + imagens extras (ex: catalogo usa produto + modelo).
export async function submitRunpodJob(
  endpointId: string,
  workflow: Record<string, unknown>,
  imageUrl: string,
  imageName = "product.jpg",
  extraImages?: Array<{ url: string; name: string }>
): Promise<string> {
  const images = [{ name: imageName, image: await fetchAsBase64(imageUrl) }];
  if (extraImages) {
    for (const extra of extraImages) {
      images.push({ name: extra.name, image: await fetchAsBase64(extra.url) });
    }
  }

  const res = await fetch(`${BASE_URL}/${endpointId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input: { workflow, images } }),
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
    output?: { message?: string | string[]; status?: string } | null;
    error?: string;
  };

  // Status possíveis: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, CANCELLED, TIMED_OUT
  if (data.status === "COMPLETED" && data.output?.status === "success") {
    const msg = data.output.message;
    const outputs = Array.isArray(msg) ? msg : msg ? [msg] : [];
    return { status: "done", outputs };
  }

  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(data.status)) {
    return { status: "failed", outputs: [] };
  }

  return { status: "pending", outputs: [] };
}
