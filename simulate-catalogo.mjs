import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";
const BASE_URL = "https://tamowork.com";

// Produto: tênis Nike vermelho
const NIKE_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80";

// Pessoa de referência: mulher em roupa esportiva (posição neutra, boa para calçados)
const MODEL_IMAGE = "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchWithRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) }); }
    catch (e) { if (i === retries - 1) throw e; await sleep(3000); }
  }
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const { data } = await supabase.auth.signInWithPassword({
  email: "test-stress-d4@tamowork.test",
  password: "StressD4@2026",
});
const token = data.session.access_token;

// Modo catálogo: model_img:URL_PESSOA | texto do produto
// O backend coloca o tênis nos pés da pessoa de referência
const prompt = `model_img:${MODEL_IMAGE} | tênis`;

const createRes = await fetchWithRetry(`${BASE_URL}/api/image-jobs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ prompt, input_image_url: NIKE_IMAGE }),
});
const { jobId, error: createErr } = await createRes.json();
if (!jobId) { console.error("Erro ao criar job:", createErr); process.exit(1); }

const start = Date.now();
process.stdout.write(`job ${jobId.slice(0,8)}... `);

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
    if (j.status === "failed") { console.log(`\n❌ ${j.error}`); process.exit(1); }
  } catch { process.stdout.write("!"); }
}
console.log("\n⏰ timeout");
