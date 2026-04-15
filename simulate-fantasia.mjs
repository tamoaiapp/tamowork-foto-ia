import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI";
const BASE_URL = "https://tamowork.com";

// Pessoa de referência: criança em posição neutra (para fantasias infantis)
const MODEL_IMAGE = "https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?w=800&q=80";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchWithRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (i === retries - 1) throw e; await sleep(3000); }
  }
}

// 1. Fazer upload da imagem local para o Supabase Storage
console.log("Fazendo upload da fantasia...");
const fileBytes = readFileSync("C:/Users/Notebook/Downloads/1001293121-3c81d76c2b6ddf6ae117688392655731-1024-1024.webp");
const fileName = `sim-fantasia-${Date.now()}.webp`;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
  .from("image-jobs")
  .upload(`uploads/${fileName}`, fileBytes, { contentType: "image/webp", upsert: true });

if (uploadError) { console.error("Upload falhou:", uploadError.message); process.exit(1); }

const { data: { publicUrl } } = supabaseAdmin.storage.from("image-jobs").getPublicUrl(`uploads/${fileName}`);
console.log("URL pública:", publicUrl);

// 2. Login com conta de teste
const supabase = createClient(SUPABASE_URL, ANON_KEY);
const { data: authData } = await supabase.auth.signInWithPassword({
  email: "test-stress-d4@tamowork.test",
  password: "StressD4@2026",
});
const token = authData.session.access_token;

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
        console.log(`\n[${label}] ✅ ${Math.round((Date.now()-start)/1000)}s\n${j.output_image_url}`);
        return;
      }
      if (j.status === "failed") { console.log(`\n[${label}] ❌ ${j.error}`); return; }
    } catch { process.stdout.write("!"); }
  }
  console.log(`\n[${label}] ⏰ timeout`);
}

// Simulação de uso: modo catálogo (coloca a fantasia numa pessoa real)
await runJob(`model_img:${MODEL_IMAGE} | fantasia de policial infantil`, "simulação de uso");

// Produto exposto
await runJob(`[produto_exposto] fantasia de policial infantil com acessórios`, "produto exposto");
