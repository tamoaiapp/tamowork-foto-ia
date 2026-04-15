/**
 * Simulação completa de geração de foto
 * Usa conta de teste já existente, faz login real, submete job, aguarda resultado.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";
const BASE_URL = "https://tamowork.com";

// Imagem de produto pública para teste (tênis simples com fundo branco)
const TEST_IMAGE_URL =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80";

const PROMPT =
  "produto em mesa de madeira rústica, luz natural suave, fundo desfocado neutro, fotografia de produto profissional";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=".repeat(50));
  console.log("🎬 SIMULAÇÃO DE GERAÇÃO DE FOTO — TamoWork Foto IA");
  console.log("=".repeat(50));

  // 1. Login
  console.log("\n[1/4] Fazendo login...");
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "test-stress-d4@tamowork.test",
    password: "StressD4@2026",
  });

  if (authError || !authData.session) {
    console.error("❌ Login falhou:", authError?.message);
    process.exit(1);
  }
  const token = authData.session.access_token;
  console.log("✓ Login OK — user:", authData.user.email);

  // 2. Submeter job
  console.log("\n[2/4] Submetendo job de geração de foto...");
  console.log("  Prompt:", PROMPT);
  console.log("  Imagem input:", TEST_IMAGE_URL);

  const jobStart = Date.now();
  const createRes = await fetch(`${BASE_URL}/api/image-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt: PROMPT,
      input_image_url: TEST_IMAGE_URL,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    console.error("❌ Erro ao criar job:", createRes.status, err);
    process.exit(1);
  }

  const { jobId, status: initialStatus } = await createRes.json();
  console.log(`✓ Job criado: ${jobId} (status: ${initialStatus})`);

  // 3. Polling até concluir
  console.log("\n[3/4] Aguardando geração (polling a cada 5s)...");
  let lastStatus = initialStatus;
  let elapsed = 0;
  let outputUrl = null;

  while (elapsed < 300) {
    await sleep(5000);
    elapsed += 5;

    const pollRes = await fetch(`${BASE_URL}/api/image-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollRes.ok) {
      console.log(`  [${elapsed}s] Erro no polling: ${pollRes.status}`);
      continue;
    }

    const { status, output_image_url, error } = await pollRes.json();

    if (status !== lastStatus) {
      console.log(`  [${elapsed}s] Status: ${lastStatus} → ${status}`);
      lastStatus = status;
    } else {
      process.stdout.write(`  [${elapsed}s] ${status}...\r`);
    }

    if (status === "done") {
      outputUrl = output_image_url;
      break;
    }

    if (status === "failed") {
      console.error(`\n❌ Job falhou: ${error}`);
      process.exit(1);
    }
  }

  const totalTime = Date.now() - jobStart;

  if (!outputUrl) {
    console.error(`\n❌ Timeout após ${elapsed}s — job ainda não concluído`);
    process.exit(1);
  }

  // 4. Resultado
  console.log("\n\n[4/4] Resultado:");
  console.log("=".repeat(50));
  console.log("✅ FOTO GERADA COM SUCESSO!");
  console.log(`   Job ID  : ${jobId}`);
  console.log(`   Tempo   : ${Math.round(totalTime / 1000)}s`);
  console.log(`   URL     : ${outputUrl}`);
  console.log("=".repeat(50));
}

main().catch((e) => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});
