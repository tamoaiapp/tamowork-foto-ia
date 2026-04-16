/**
 * test-job-buque.mjs
 * Simula o fluxo completo do app:
 *   1. Gera prompt via /api/prompt (multiagent V2)
 *   2. Faz upload da imagem produto no ComfyUI
 *   3. Submete o workflow ao ComfyUI
 *   4. Faz polling até a foto ficar pronta
 *   5. Salva a imagem em disco
 */

import fs from "fs";
import path from "path";

const COMFY_BASE = "https://mct7zo9ymeysy7-3000.proxy.runpod.net";
// Usa motor local (Cloud Run JS) em vez de chamada HTTP
import { helloHttp } from "../Downloads/promptuso_dir/index.js";

function callMotor(produto, cenario) {
  return new Promise((resolve) => {
    const body = { produto, cenario };
    const req = {
      method: "POST", url: "/prompt", headers: {}, body,
      [Symbol.asyncIterator]() {
        const buf = [Buffer.from(JSON.stringify(body))]; let i = 0;
        return { next: async () => i < buf.length ? { value: buf[i++], done: false } : { done: true } };
      },
    };
    const res = {};
    res.status = () => res; res.set = () => res;
    res.send = (b) => resolve(JSON.parse(b));
    helloHttp(req, res);
  });
}

const PRODUCT_IMAGE_URL =
  "https://images.pexels.com/photos/5304840/pexels-photo-5304840.jpeg?auto=compress&cs=tinysrgb&w=800";

const PRODUTO   = "white flower bouquet";
const CENARIO   = "blonde bride in an old stone church with warm candlelight";
const JOB_ID    = `test_buque_${Date.now()}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mergeNegative(neg) {
  const BASE = [
    "skin lines, skin scratches, skin cracks, skin artifacts",
    "rough skin texture, exaggerated skin texture, overdetailed skin",
    "skin veins, stretch marks, skin marks, skin wrinkles overdetailed",
    "blurry, low quality, pixelated, jpeg artifacts, noise",
    "watermark, text, logo, signature",
  ].join(", ");
  return neg ? `${neg}, ${BASE}` : BASE;
}

// ── 1. Gera prompt ────────────────────────────────────────────────────────────

log("1/4 — Gerando prompt via multiagent V2 (motor local)...");
const promptData = await callMotor(PRODUTO, CENARIO);

const positivePrompt = promptData.positive;
const negativePrompt = mergeNegative(promptData.negative);

log(`   MODE: ${promptData.meta?.mode} | AGENT: ${promptData.meta?.agent} | SOURCE: ${promptData.source}`);
log(`   POSITIVE: ${positivePrompt.slice(0, 120)}...`);

// ── 2. Upload da imagem produto ───────────────────────────────────────────────

log("2/4 — Baixando e enviando imagem ao ComfyUI...");
const imgRes = await fetch(PRODUCT_IMAGE_URL, { signal: AbortSignal.timeout(30_000) });
if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status}`);
const buffer = await imgRes.arrayBuffer();

const filename = `product_${JOB_ID.replace(/-/g,"").slice(0,12)}.jpg`;
const boundary = `----FormBoundary${Date.now()}`;
const imageBuffer = Buffer.from(buffer);
const multipart = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
  imageBuffer,
  Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--${boundary}--\r\n`),
]);

const uploadRes = await fetch(`${COMFY_BASE}/upload/image`, {
  method: "POST",
  headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  body: multipart,
  signal: AbortSignal.timeout(60_000),
});
if (!uploadRes.ok) throw new Error(`Upload error: ${uploadRes.status}`);
const uploadData = await uploadRes.json();
const imageName = uploadData.name;
log(`   Imagem enviada: ${imageName}`);

// ── 3. Monta e submete workflow ───────────────────────────────────────────────

log("3/4 — Submetendo workflow ao ComfyUI...");
const templatePath = new URL("./lib/comfyui/prompt_template.json", import.meta.url);
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

// Preenche campos dinâmicos
template["11"].inputs.image = imageName;
template["1"].inputs.prompt  = `${positivePrompt}\n#job:${JOB_ID}\n`;
template["39"].inputs.prompt = negativePrompt;
template["166"].inputs.filename_prefix = `job_${JOB_ID}`;
template["167"].inputs.seed = Math.floor(Math.random() * 999_999_999);

// Força formato story (1080x1920) via nó 168
template["168"] = {
  class_type: "ImageScale",
  inputs: { image: ["11", 0], width: 1080, height: 1920, upscale_method: "lanczos", crop: "center" },
  _meta: { title: "Format: story 1080x1920" },
};
template["160"].inputs.image = ["168", 0];

const submitRes = await fetch(`${COMFY_BASE}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: template }),
  signal: AbortSignal.timeout(30_000),
});
if (!submitRes.ok) throw new Error(`Submit error: ${submitRes.status} ${await submitRes.text()}`);
const { prompt_id } = await submitRes.json();
log(`   Workflow submetido! prompt_id: ${prompt_id}`);

// ── 4. Polling até ficar pronto ───────────────────────────────────────────────

log("4/4 — Aguardando geração...");
let outputUrl = null;
const MAX_WAIT = 180; // 3 minutos
let waited = 0;

while (waited < MAX_WAIT) {
  await sleep(5000);
  waited += 5;

  const histRes = await fetch(`${COMFY_BASE}/history/${prompt_id}`, { signal: AbortSignal.timeout(10_000) });
  if (!histRes.ok) { log(`   Histórico indisponível (${histRes.status}), aguardando...`); continue; }

  const hist = await histRes.json();
  const entry = hist[prompt_id];
  if (!entry) { log(`   Aguardando... (${waited}s)`); continue; }

  const saveOut = entry.outputs?.["166"];
  if (saveOut?.images?.length) {
    const img = saveOut.images[0];
    outputUrl = `${COMFY_BASE}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
    log(`   ✅ Pronto em ${waited}s!`);
    break;
  }

  if (entry.status?.status_str === "error") {
    throw new Error("Job falhou no ComfyUI (status: error)");
  }

  log(`   Processando... (${waited}s)`);
}

if (!outputUrl) throw new Error(`Timeout: job não ficou pronto em ${MAX_WAIT}s`);

// ── 5. Salva a imagem ─────────────────────────────────────────────────────────

const outRes = await fetch(outputUrl, { signal: AbortSignal.timeout(60_000) });
if (!outRes.ok) throw new Error(`Download saída error: ${outRes.status}`);
const outBuf = Buffer.from(await outRes.arrayBuffer());
const outPath = `./test-buque-result.png`;
fs.writeFileSync(outPath, outBuf);

log(`✅ Foto salva em: ${path.resolve(outPath)}`);
log(`   URL: ${outputUrl}`);
