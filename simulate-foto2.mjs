import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";
const BASE_URL = "https://tamowork.com";

const NIKE_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runJob(token, prompt, label) {
  const createRes = await fetch(`${BASE_URL}/api/image-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt, input_image_url: NIKE_IMAGE }),
  });
  const { jobId } = await createRes.json();
  const start = Date.now();
  process.stdout.write(`[${label}] criado ${jobId.slice(0,8)}... `);

  for (let i = 0; i < 80; i++) {
    await sleep(5000);
    const r = await fetch(`${BASE_URL}/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    process.stdout.write(".");
    if (j.status === "done") {
      const secs = Math.round((Date.now() - start) / 1000);
      console.log(`\n[${label}] ✅ ${secs}s → ${j.output_image_url}`);
      return j.output_image_url;
    }
    if (j.status === "failed") {
      console.log(`\n[${label}] ❌ falhou: ${j.error}`);
      return null;
    }
  }
  console.log(`\n[${label}] ⏰ timeout`);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const { data } = await supabase.auth.signInWithPassword({
  email: "test-stress-d4@tamowork.test",
  password: "StressD4@2026",
});
const token = data.session.access_token;

// Simulação 1: modo padrão (mesinha + lifestyle)
await runJob(token,
  "tênis esportivo | cenário: mesa de madeira com fundo branco clean, sombra suave, estúdio minimalista",
  "default"
);

// Simulação 2: produto exposto
await runJob(token,
  "[produto_exposto] tênis Nike vermelho esportivo",
  "produto_exposto"
);
