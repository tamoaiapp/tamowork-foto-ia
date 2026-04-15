import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI";
const BASE_URL = "https://tamowork.com";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchWithRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (i === retries - 1) throw e; await sleep(3000); }
  }
}

// Upload da fantasia
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const fileBytes = readFileSync("C:/Users/Notebook/Downloads/1001293121-3c81d76c2b6ddf6ae117688392655731-1024-1024.webp");
const { data: up } = await supabaseAdmin.storage.from("image-jobs")
  .upload(`uploads/fantasia-test-${Date.now()}.webp`, fileBytes, { contentType: "image/webp", upsert: true });
const { data: { publicUrl } } = supabaseAdmin.storage.from("image-jobs").getPublicUrl(up.path);

// Login
const supabase = createClient(SUPABASE_URL, ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({
  email: "test-stress-d4@tamowork.test", password: "StressD4@2026",
});
const token = auth.session.access_token;

async function runJob(prompt, label) {
  const res = await fetchWithRetry(`${BASE_URL}/api/image-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt, input_image_url: publicUrl }),
  });
  const { jobId, error } = await res.json();
  if (!jobId) { console.error(`[${label}] Erro:`, error); return; }
  const start = Date.now();
  process.stdout.write(`[${label}] ${jobId.slice(0,8)}... `);
  for (let i = 0; i < 80; i++) {
    await sleep(5000);
    try {
      const r = await fetchWithRetry(`${BASE_URL}/api/image-jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      process.stdout.write(".");
      if (j.status === "done") {
        console.log(`\n✅ ${Math.round((Date.now()-start)/1000)}s → ${j.output_image_url}`);
        return;
      }
      if (j.status === "failed") { console.log(`\n❌ ${j.error}`); return; }
    } catch { process.stdout.write("!"); }
  }
}

// Modo padrão — prompt direto pedindo criança usando a fantasia, sem referência de pessoa
// O Qwen gera a pessoa do zero a partir da foto do produto
await runJob(
  "fantasia infantil de policial | cenário: criança usando a fantasia, fundo branco de estúdio, foto de produto de moda infantil",
  "simulação de uso (sem referência)"
);
