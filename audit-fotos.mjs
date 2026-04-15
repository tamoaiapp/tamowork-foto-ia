/**
 * audit-fotos.mjs — Auditoria de qualidade das fotos geradas
 * Busca últimos jobs done, baixa imagens e mostra prompts lado a lado
 *
 * Uso: node audit-fotos.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const OUT_DIR = "./audit-output";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);

async function downloadImage(url, dest) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    writeFileSync(dest, Buffer.from(buf));
    return true;
  } catch {
    return false;
  }
}

function truncate(s, n = 120) {
  if (!s) return "(vazio)";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

async function main() {
  console.log("🔍 Buscando últimos 20 jobs concluídos...\n");

  const { data: jobs, error } = await sb
    .from("image_jobs")
    .select("id, created_at, user_id, prompt, input_image_url, output_image_url, format, status, is_bonus_retry")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Erro ao buscar jobs:", error.message);
    process.exit(1);
  }

  console.log(`✅ ${jobs.length} jobs encontrados\n`);
  console.log("═".repeat(80));

  const report = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const idx = i + 1;
    const date = new Date(job.created_at).toLocaleString("pt-BR");

    console.log(`\n📸 JOB ${idx}/${jobs.length} — ${job.id.slice(0, 8)}...`);
    console.log(`   Data: ${date}`);
    console.log(`   Formato: ${job.format ?? "story"}`);
    console.log(`   Bonus retry: ${job.is_bonus_retry ? "SIM" : "não"}`);
    console.log(`   Prompt bruto: ${truncate(job.prompt)}`);

    // Baixa imagem de input
    const inputFile = join(OUT_DIR, `job${idx}_input.jpg`);
    const inputOk = await downloadImage(job.input_image_url, inputFile);
    console.log(`   Input: ${inputOk ? `✅ salvo → ${inputFile}` : "❌ falhou"}`);

    // Baixa imagem de output
    const outputFile = join(OUT_DIR, `job${idx}_output.jpg`);
    const outputOk = job.output_image_url
      ? await downloadImage(job.output_image_url, outputFile)
      : false;
    console.log(`   Output: ${outputOk ? `✅ salvo → ${outputFile}` : job.output_image_url ? "❌ falhou" : "⚠️ sem URL"}`);

    console.log("─".repeat(80));

    report.push({
      idx,
      id: job.id,
      date,
      format: job.format,
      prompt: job.prompt,
      input_url: job.input_image_url,
      output_url: job.output_image_url,
      input_file: inputOk ? inputFile : null,
      output_file: outputOk ? outputFile : null,
      is_bonus_retry: job.is_bonus_retry,
    });
  }

  // Gera HTML para visualização lado a lado
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Auditoria de Fotos — TamoWork</title>
<style>
  body { font-family: system-ui; background: #07080b; color: #eef2f9; margin: 0; padding: 20px; }
  h1 { color: #a855f7; }
  .job { background: #111820; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; margin-bottom: 24px; }
  .job-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .job-num { background: #6366f1; border-radius: 8px; padding: 4px 10px; font-weight: 800; font-size: 13px; }
  .job-date { color: #8394b0; font-size: 13px; }
  .job-format { background: rgba(168,85,247,0.2); border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; padding: 2px 8px; font-size: 12px; color: #c084fc; }
  .images { display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; }
  .img-wrap { flex: 1; }
  .img-label { font-size: 11px; color: #8394b0; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
  img { width: 100%; max-width: 300px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); display: block; }
  .img-missing { width: 200px; height: 200px; background: #1a1f2e; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #4e5c72; font-size: 12px; }
  .prompt { background: #0c1018; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #b0bec9; font-family: monospace; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
  .prompt-label { font-size: 11px; color: #8394b0; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
  .badge-bonus { background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4); border-radius: 6px; padding: 2px 8px; font-size: 11px; color: #f59e0b; }
  .arrow { font-size: 28px; color: #4e5c72; display: flex; align-items: center; padding-top: 50px; }
</style>
</head>
<body>
<h1>🔍 Auditoria de Fotos — TamoWork</h1>
<p style="color:#8394b0">Gerado em ${new Date().toLocaleString("pt-BR")} · ${report.length} jobs analisados</p>
${report.map(j => `
<div class="job">
  <div class="job-header">
    <span class="job-num">#${j.idx}</span>
    <span class="job-date">${j.date}</span>
    <span class="job-format">${j.format ?? "story"}</span>
    ${j.is_bonus_retry ? '<span class="badge-bonus">⭐ bonus retry</span>' : ""}
  </div>

  <div class="images">
    <div class="img-wrap">
      <div class="img-label">📸 Antes (produto original)</div>
      ${j.input_url ? `<img src="${j.input_url}" alt="input" onerror="this.style.display='none'">` : '<div class="img-missing">sem imagem</div>'}
    </div>
    <div class="arrow">→</div>
    <div class="img-wrap">
      <div class="img-label">✨ Depois (foto gerada)</div>
      ${j.output_url ? `<img src="${j.output_url}" alt="output" onerror="this.style.display='none'">` : '<div class="img-missing">sem imagem</div>'}
    </div>
  </div>

  <div class="prompt-label">📝 Prompt enviado pelo usuário</div>
  <div class="prompt">${j.prompt ? j.prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "(vazio)"}</div>
</div>
`).join("")}
</body>
</html>`;

  const htmlFile = join(OUT_DIR, "audit-report.html");
  writeFileSync(htmlFile, html);

  console.log(`\n✅ Relatório HTML gerado: ${htmlFile}`);
  console.log(`   Abra no navegador para ver imagens lado a lado.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
