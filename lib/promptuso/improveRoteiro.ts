/**
 * improveRoteiro.ts
 *
 * Melhora o roteiro de narração de vídeo escrito pelo usuário via LLM local (Ollama no A40).
 * Usa qwen2.5:7b — rápido, bom em texto em português.
 *
 * Fallback: se Ollama offline ou qualquer erro → retorna roteiro original sem lançar exceção.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "";
const PROMPT_MODEL = process.env.OLLAMA_PROMPT_MODEL ?? "qwen2.5:7b";
const TIMEOUT_MS = 20_000; // curto — só melhorar texto

const SYSTEM_PROMPT = `You are a professional Brazilian copywriter specializing in short Instagram Reels narration scripts. Improve the user's script to be more persuasive, conversational, and suitable for video narration. Keep it short (3-4 sentences max), use natural spoken Portuguese, maintain the product's key selling points, and add energy. Return ONLY the improved script text, no explanations, no quotes.`;

/**
 * Melhora o roteiro de narração de vídeo usando Ollama.
 * Nunca lança exceção — sempre retorna string (melhorada ou original).
 */
export async function improveRoteiro(roteiro: string): Promise<string> {
  if (!OLLAMA_BASE) return roteiro;

  const url = `${OLLAMA_BASE}/api/chat`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PROMPT_MODEL,
        stream: false,
        options: { temperature: 0.7, num_predict: 200 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: roteiro },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[improveRoteiro] Ollama retornou ${res.status}`);
      return roteiro;
    }

    const data = await res.json();
    const improved: string = (data?.message?.content ?? "").trim();

    if (!improved) {
      console.warn("[improveRoteiro] Resposta vazia do Ollama");
      return roteiro;
    }

    return improved;
  } catch (e) {
    console.warn("[improveRoteiro] Erro:", (e as Error).message);
    return roteiro;
  }
}
