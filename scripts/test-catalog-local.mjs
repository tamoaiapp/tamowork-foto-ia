/**
 * Teste catálogo com arquivos locais
 * node scripts/test-catalog-local.mjs <path_produto> <path_modelo>
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";

const COMFY_BASE = "https://mct7zo9ymeysy7-3000.proxy.runpod.net";
const __dir = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(readFileSync(join(__dir, "../lib/comfyui/catalog_template.json"), "utf8"));

const PROMPT_POS = `The human model in <image2> is wearing the sunglasses shown in <image1> on their face.
Keep the model's face, body, skin tone, hair, and appearance exactly as in <image2>.
The sunglasses must be placed naturally on the model's face, fitting correctly.
Professional fashion photography, sharp focus, high quality.`;

const PROMPT_NEG = `deformed, bad anatomy, blurry, low quality, different person, changed face, missing glasses, floating glasses`;

function mimeType(filepath) {
  const ext = extname(filepath).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

async function uploadLocalFile(filepath, filename) {
  console.log(`⬆️  Uploading ${filename} (${filepath})...`);
  if (!existsSync(filepath)) throw new Error(`Arquivo não encontrado: ${filepath}`);
  const buffer = readFileSync(filepath);
  const mime = mimeType(filepath);

  const boundary = `----FormBoundary${Date.now()}`;
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${COMFY_BASE}/upload/image`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: multipart,
  });

  if (!res.ok) throw new Error(`Upload error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`  ✓ Uploaded as: ${data.name}`);
  return data.name;
}

async function submitWorkflow(productName, modelName, promptPos) {
  const jobId = `catalog_test_${Date.now()}`;
  const workflow = JSON.parse(JSON.stringify(template));

  workflow["11"].inputs.image = productName;
  workflow["200"].inputs.image = modelName;
  workflow["1"].inputs.prompt = promptPos;
  workflow["39"].inputs.prompt = PROMPT_NEG;
  workflow["166"].inputs.filename_prefix = jobId;
  workflow["167"].inputs.seed = Math.floor(Math.random() * 999_999_999);

  console.log(`\n🚀 Submetendo workflow (job: ${jobId})...`);
  const res = await fetch(`${COMFY_BASE}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!res.ok) throw new Error(`submitWorkflow error: ${res.status}\n${await res.text()}`);
  const data = await res.json();
  console.log(`  ✓ prompt_id: ${data.prompt_id}`);
  return { promptId: data.prompt_id, jobId };
}

async function pollResult(promptId) {
  console.log(`\n⏳ Aguardando resultado...`);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(`${COMFY_BASE}/history/${promptId}`);
    if (!res.ok) continue;
    const history = await res.json();
    const entry = history[promptId];
    if (!entry) continue;
    const saveOutput = entry.outputs?.["166"];
    if (saveOutput?.images?.length) {
      const img = saveOutput.images[0];
      const url = `${COMFY_BASE}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
      console.log(`\n✅ PRONTO! (${i + 1} tentativas)`);
      console.log(`🖼️  ${url}`);
      return url;
    }
    if (entry.status?.status_str === "error") {
      console.log(`\n❌ ERRO:`, JSON.stringify(entry.status));
      return null;
    }
    process.stdout.write(`  [${i + 1}/60] processando...\r`);
  }
  console.log("\n⏱️  Timeout");
  return null;
}

const [,, productPath, modelPath] = process.argv;
if (!productPath || !modelPath) {
  console.error("Uso: node scripts/test-catalog-local.mjs <path_produto> <path_modelo>");
  process.exit(1);
}

console.log("🧪 Teste Catálogo — arquivos locais");
console.log(`📦 Produto: ${productPath}`);
console.log(`👤 Modelo:  ${modelPath}\n`);

const productName = await uploadLocalFile(productPath, `product_${Date.now()}.jpg`);
const modelName = await uploadLocalFile(modelPath, `model_${Date.now()}.webp`);
const { promptId } = await submitWorkflow(productName, modelName, PROMPT_POS);
const resultUrl = await pollResult(promptId);

// Agora remove o fundo do resultado
if (resultUrl) {
  console.log("\n🔄 Rodando segundo teste sem fundo da foto de produto...");
  const PROMPT_NO_BG = `The human model in <image2> is wearing the sunglasses shown in <image1> on their face.
Keep the model's face, body, skin tone, hair exactly as in <image2>.
The sunglasses must be placed naturally on the model's face.
Pure white background, studio lighting, professional product photo.`;
  const { promptId: promptId2 } = await submitWorkflow(productName, modelName, PROMPT_NO_BG);
  await pollResult(promptId2);
}
