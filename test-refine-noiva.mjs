import fs from "fs";
import { helloHttp } from "../Downloads/promptuso_dir/index.js";

const COMFY_BASE  = "https://mct7zo9ymeysy7-3000.proxy.runpod.net";
const PRODUCT_IMAGE_URL = "https://images.pexels.com/photos/5304840/pexels-photo-5304840.jpeg?auto=compress&cs=tinysrgb&w=800";

const PRODUTO      = "white flower bouquet";
const CENARIO      = "blonde bride in an old stone church with warm candlelight";
const USER_FEEDBACK = "queria noiva morena";
const JOB_ID       = `test_refine_noiva_${Date.now()}`;

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mergeNegative(neg) {
  const BASE = "skin lines, skin scratches, rough skin texture, blurry, low quality, pixelated, noise, watermark, text";
  return neg ? `${neg}, ${BASE}` : BASE;
}

// Chama o motor com feedback (simula /api/refine-prompt)
function callRefine(produto, cenario, feedback) {
  return new Promise((resolve) => {
    const body = { produto, cenario, user_feedback: feedback };
    const req = {
      method: "POST", url: "/refine-prompt", headers: {}, body,
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

// ── 1. Refine prompt com feedback ────────────────────────────────────────────
log(`1/4 — Refinando prompt com feedback: "${USER_FEEDBACK}"`);
const refined = await callRefine(PRODUTO, CENARIO, USER_FEEDBACK);

log(`   MODE: ${refined.meta?.mode} | AGENT: ${refined.meta?.agent}`);
log(`   Issue types detectados: ${JSON.stringify(refined.feedback_analysis?.issue_types)}`);
log(`   Applied fixes: ${refined.feedback_analysis?.applied_fixes}`);
log(`   POSITIVE (últimos 200 chars): ...${refined.positive?.slice(-200)}`);
log(`   NEGATIVE (últimos 100 chars): ...${refined.negative?.slice(-100)}`);

// ── 2. Upload da mesma imagem produto ─────────────────────────────────────────
log("2/4 — Upload imagem...");
const imgRes = await fetch(PRODUCT_IMAGE_URL, { signal: AbortSignal.timeout(30_000) });
const buffer = await imgRes.arrayBuffer();
const filename = `product_${JOB_ID.replace(/[^a-z0-9]/gi,"").slice(0,16)}.jpg`;
const boundary = `----FormBoundary${Date.now()}`;
const multipart = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
  Buffer.from(buffer),
  Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--${boundary}--\r\n`),
]);

const uploadRes = await fetch(`${COMFY_BASE}/upload/image`, {
  method: "POST",
  headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  body: multipart,
  signal: AbortSignal.timeout(60_000),
});
if (!uploadRes.ok) throw new Error(`Upload error: ${uploadRes.status}`);
const imageName = (await uploadRes.json()).name;
log(`   ${imageName}`);

// ── 3. Submete workflow com prompt refinado ───────────────────────────────────
log("3/4 — Submetendo workflow com prompt refinado...");
const templatePath = new URL("./lib/comfyui/prompt_template.json", import.meta.url);
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

template["11"].inputs.image = imageName;
template["1"].inputs.prompt  = `${refined.positive}\n#job:${JOB_ID}\n`;
template["39"].inputs.prompt = mergeNegative(refined.negative);
template["166"].inputs.filename_prefix = `job_${JOB_ID}`;
template["167"].inputs.seed = Math.floor(Math.random() * 999_999_999);
template["168"] = {
  class_type: "ImageScale",
  inputs: { image: ["11", 0], width: 1080, height: 1920, upscale_method: "lanczos", crop: "center" },
  _meta: { title: "Format: story" },
};
template["160"].inputs.image = ["168", 0];

const submitRes = await fetch(`${COMFY_BASE}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: template }),
  signal: AbortSignal.timeout(30_000),
});
if (!submitRes.ok) throw new Error(`Submit error: ${submitRes.status}`);
const { prompt_id } = await submitRes.json();
log(`   prompt_id: ${prompt_id}`);

// ── 4. Polling ────────────────────────────────────────────────────────────────
log("4/4 — Aguardando...");
let outputUrl = null, waited = 0;
while (waited < 180) {
  await sleep(5000); waited += 5;
  const h = await fetch(`${COMFY_BASE}/history/${prompt_id}`, { signal: AbortSignal.timeout(10_000) });
  if (!h.ok) continue;
  const entry = (await h.json())[prompt_id];
  if (!entry) { log(`   ${waited}s...`); continue; }
  const imgs = entry.outputs?.["166"]?.images;
  if (imgs?.length) {
    const img = imgs[0];
    outputUrl = `${COMFY_BASE}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
    log(`✅ Pronto em ${waited}s!`); break;
  }
  if (entry.status?.status_str === "error") throw new Error("Job falhou");
  log(`   ${waited}s...`);
}

if (!outputUrl) throw new Error("Timeout");

const outBuf = Buffer.from(await (await fetch(outputUrl, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
fs.writeFileSync("./test-refine-noiva-result.png", outBuf);
log(`   URL: ${outputUrl}`);
