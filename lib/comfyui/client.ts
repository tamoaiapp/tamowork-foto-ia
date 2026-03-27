// Fluxo completo:
// criar prompt: promptuso (POST /)           → { positive, negative }
// 1 chamada:    clouda    (POST /enqueue)    → { job_id }
// 2 chamada:    cloudb    (POST /tick)       → dispara execução
// 3 chamada:    clouda    (GET /job/{id})    → { outputUrl } — se vazio, volta p/ 2 chamada em 45s

const PROMPTUSO_URL = process.env.COMFYUI_RUN_URL!;
const CLOUDA_URL    = process.env.CRIARPROMPT_URL!;
const CLOUDB_URL    = process.env.COMFYUI_CHECK_URL!;

export interface PromptResult {
  positive: string;
  negative: string;
  produto?: string;
  cenario?: string;
  meta?: Record<string, unknown>;
}

export interface RunResult {
  job_id: string;
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

// 1 chamada — clouda /enqueue: image_url + prompts → job_id
export async function startGeneration(
  image_url: string,
  prompt_pos: string,
  prompt_neg: string
): Promise<RunResult> {
  const res = await fetch(`${CLOUDA_URL}/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url,
      prompt_pos,
      prompt_neg,
      meta: { origin: "node" },
    }),
  });
  if (!res.ok) throw new Error(`startGeneration error: ${res.status}`);
  return res.json();
}

// 2 chamada — cloudb /tick: dispara execução
export async function tickWorker(): Promise<void> {
  await fetch(`${CLOUDB_URL}/tick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Key": "12345678234",
    },
    body: "{}",
  });
}

// 3 chamada — clouda /job/{id}: consulta outputUrl
export async function getJobResult(job_id: string): Promise<Response> {
  return fetch(`${CLOUDA_URL}/job/${job_id}`);
}
