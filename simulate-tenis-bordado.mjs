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

// Upload
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const fileBytes = readFileSync("C:/Users/Notebook/Downloads/tenis-bordado-a-mao-tenis-bordado-a-mao.jpg");
const fname = `tenis-bordado-${Date.now()}.jpg`;
await supabaseAdmin.storage.from("image-jobs").upload(`uploads/${fname}`, fileBytes, { contentType: "image/jpeg", upsert: true });
const { data: { publicUrl } } = supabaseAdmin.storage.from("image-jobs").getPublicUrl(`uploads/${fname}`);
console.log("URL:", publicUrl);

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
        console.log(`\n✅ ${Math.round((Date.now()-start)/1000)}s\n${j.output_image_url}\n`);
        return;
      }
      if (j.status === "failed") { console.log(`\n❌ ${j.error}\n`); return; }
    } catch { process.stdout.write("!"); }
  }
}

// Sem texto — visão lê a imagem e detecta o produto automaticamente
await runJob("tênis bordado", "simulação de uso");
await runJob("[produto_exposto] tênis bordado artesanal", "produto exposto");
