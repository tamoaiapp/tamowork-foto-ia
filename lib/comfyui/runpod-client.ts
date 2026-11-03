// RunPod Serverless API client
// Documentação: https://docs.runpod.io/serverless/references/endpoint-operations

const RUNPOD_API_KEY = (process.env.RUNPOD_API_KEY ?? "").trim();
const BASE_URL = "https://api.runpod.ai/v2";

// Endpoint serverless de foto: comfyui-serverless (RTX 5090 + A40). Trocou o endpoint
// antigo eeqi251ru6qxf9 (abandonado). Sobrescreva via RUNPOD_FOTO_ENDPOINT_ID no Vercel.
// A configuração antiga da Vercel ainda pode conter o endpoint removido.
const configuredPhotoEndpoint = (process.env.RUNPOD_FOTO_ENDPOINT_ID ?? "").trim();
export const RUNPOD_FOTO_ENDPOINT = !configuredPhotoEndpoint || configuredPhotoEndpoint === "eeqi251ru6qxf9"
  ? "6igeofbzrfl3vv"
  : configuredPhotoEndpoint;
export const RUNPOD_VIDEO_ENDPOINT = process.env.RUNPOD_VIDEO_ENDPOINT_ID ?? "ejvkjws79zch5f";

export interface RunpodJobResult {
  status: "done" | "pending" | "failed";
  outputs: string[]; // base64 encoded (images ou vídeos)
  error?: string;
  providerStatus?: string;
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
  if (!RUNPOD_API_KEY) throw new Error("Serviço de geração sem chave de acesso configurada.");
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
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RunPod submit ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { id: string };
  if (!data.id) throw new Error("RunPod não retornou o identificador da geração.");
  return data.id;
}

// Consulta o status de um job RunPod Serverless
export async function checkRunpodJob(
  endpointId: string,
  runpodJobId: string
): Promise<RunpodJobResult> {
  if (!RUNPOD_API_KEY) return { status: "failed", outputs: [], error: "Serviço de geração sem chave de acesso configurada." };
  const res = await fetch(`${BASE_URL}/${endpointId}/status/${runpodJobId}`, {
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // Só falhas transitórias permanecem pendentes. 401/403/404/409 precisam
    // liberar o usuário, em vez de simular processamento indefinidamente.
    if (res.status === 429 || res.status >= 500) return { status: "pending", outputs: [] };
    return { status: "failed", outputs: [], error: `Não foi possível consultar a geração no RunPod (HTTP ${res.status}). Tente novamente.` };
  }

  const data = (await res.json()) as {
    status: string;
    output?: {
      message?: string | string[];
      status?: string;
      images?: Array<{ data?: string; image?: string }>;
    } | null;
    error?: string;
  };

  // Status possíveis: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, CANCELLED, TIMED_OUT
  if (data.status === "COMPLETED" && data.output) {
    // Formato comfyui-serverless: output.images[].data (base64)
    if (Array.isArray(data.output.images) && data.output.images.length > 0) {
      const outputs = data.output.images
        .map((im) => im.data ?? im.image)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      if (outputs.length > 0) return { status: "done", outputs, providerStatus: data.status };
    }
    // Formato antigo (tamowork-foto): output.status=success + message
    if (data.output.status === "success") {
      const msg = data.output.message;
      const outputs = Array.isArray(msg) ? msg : msg ? [msg] : [];
      if (outputs.length > 0) return { status: "done", outputs, providerStatus: data.status };
    }
  }

  if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(data.status)) {
    return { status: "failed", outputs: [], error: "O serviço de geração não conseguiu concluir a foto. Tente novamente.", providerStatus: data.status };
  }

  if (data.status === "COMPLETED") {
    return { status: "failed", outputs: [], error: "O serviço concluiu o pedido sem devolver uma imagem. Tente novamente.", providerStatus: data.status };
  }
  if (!["IN_QUEUE", "IN_PROGRESS"].includes(data.status)) {
    return { status: "failed", outputs: [], error: "O serviço devolveu um estado de geração inválido. Tente novamente.", providerStatus: data.status };
  }
  return { status: "pending", outputs: [], providerStatus: data.status };
}
