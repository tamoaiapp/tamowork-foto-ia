import fs from "fs";
import path from "path";
import { helloHttp } from "../Downloads/promptuso_dir/index.js";

const COMFY_BASE  = "https://mct7zo9ymeysy7-3000.proxy.runpod.net";
const LOCAL_IMAGE = "C:/Users/Notebook/Downloads/1001293121-3c81d76c2b6ddf6ae117688392655731-1024-1024.webp";
const PRODUTO     = "fantasia infantil de policial com chapeu e mascara";
const CENARIO     = "";
const JOB_ID      = `test_fantasia_${Date.now()}`;

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mergeNegative(neg) {
  const BASE = "skin lines, skin scratches, rough skin texture, blurry, low quality, pixelated, jpeg artifacts, noise, watermark, text, logo, signature";
  return neg ? `${neg}, ${BASE}` : BASE;
}

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

log("1/4 — Prompt...");
const promptData = await callMotor(PRODUTO, CENARIO);
log(`   MODE: ${promptData.meta?.mode} | AGENT: ${promptData.meta?.agent} | SCENE: ${promptData.meta?.scene_source}`);

log("2/4 — Upload...");
const imageBuffer = fs.readFileSync(LOCAL_IMAGE);
const filename = `product_${JOB_ID.replace(/[^a-z0-9]/gi,"").slice(0,16)}.webp`;
const boundary = `----FormBoundary${Date.now()}`;
const multipart = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/webp\r\n\r\n`),
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
const imageName = (await uploadRes.json()).name;
log(`   ${imageName}`);

log("3/4 — Workflow...");
const templatePath = new URL("./lib/comfyui/prompt_template.json", import.meta.url);
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

template["11"].inputs.image = imageName;
template["1"].inputs.prompt  = `${promptData.positive}\n#job:${JOB_ID}\n`;
template["39"].inputs.prompt = mergeNegative(promptData.negative);
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
fs.writeFileSync("./test-fantasia-result.png", outBuf);
log(`   ${outputUrl}`);
