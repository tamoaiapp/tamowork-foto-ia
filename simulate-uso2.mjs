import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";
const BASE_URL = "https://tamowork.com";

// Tênis Nike Free RN vermelho — lido visualmente:
// modelo de corrida, palmilha flyknit, solado liso, logo Nike branco em destaque
const NIKE_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80";

// Prompt construído a partir da leitura visual do produto:
// - produto identificado: tênis de corrida Nike Free RN, vermelho/carmesim, solado fino
// - simulação de uso: ambiente de corrida real, pista ao ar livre, contexto esportivo lifestyle
const PROMPT_USO =
  "tênis de corrida Nike Free RN vermelho, solado fino flyknit | cenário: pista de corrida ao ar livre em parque urbano, asfalto cinza com linhas brancas, grama verde desfocada ao fundo, luz solar dourada de tarde, bokeh natural, fotografia esportiva lifestyle, ângulo lateral levemente baixo mostrando o solado e a parte lateral do tênis";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(3000);
    }
  }
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const { data, error } = await supabase.auth.signInWithPassword({
  email: "test-stress-d4@tamowork.test",
  password: "StressD4@2026",
});
if (error) { console.error("login falhou:", error.message); process.exit(1); }
const token = data.session.access_token;

// Criar job
const createRes = await fetchWithRetry(`${BASE_URL}/api/image-jobs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ prompt: PROMPT_USO, input_image_url: NIKE_IMAGE }),
});
const { jobId } = await createRes.json();
const start = Date.now();
process.stdout.write(`job ${jobId.slice(0,8)}... `);

// Polling com retry
for (let i = 0; i < 80; i++) {
  await sleep(5000);
  try {
    const r = await fetchWithRetry(`${BASE_URL}/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    process.stdout.write(".");
    if (j.status === "done") {
      const secs = Math.round((Date.now() - start) / 1000);
      console.log(`\n✅ ${secs}s\n${j.output_image_url}`);
      process.exit(0);
    }
    if (j.status === "failed") {
      console.log(`\n❌ ${j.error}`);
      process.exit(1);
    }
  } catch { process.stdout.write("!"); }
}
console.log("\n⏰ timeout");
