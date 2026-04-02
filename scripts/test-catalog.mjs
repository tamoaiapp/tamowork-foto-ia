/**
 * Script de teste do workflow de catálogo de modelos
 *
 * Uso:
 *   node scripts/test-catalog.mjs <url_produto> <url_modelo>
 *
 * Exemplo:
 *   node scripts/test-catalog.mjs "https://..." "https://..."
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const COMFY_BASE = "https://mct7zo9ymeysy7-3000.proxy.runpod.net";
const __dir = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(readFileSync(join(__dir, "../lib/comfyui/catalog_template.json"), "utf8"));

const PROMPT_POS = `The human model in <image2> is wearing the product shown in <image1>.
Keep the model's face, body, skin tone, and appearance exactly as in <image2>.
The product must be clearly visible and naturally worn/used.
Professional fashion photography, clean background, sharp focus, high quality.`;

const PROMPT_NEG = `deformed, bad anatomy, blurry, low quality, different person, changed face, artifacts`;

async function uploadImage(imageUrl, filename) {
  console.log(`⬆️  Uploading ${filename}...`);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem: ${imgRes.status} - ${imageUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const boundary = `----FormBoundary${Date.now()}`;
  const multipart = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
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

async function submitWorkflow(productName, modelName) {
  const jobId = `catalog_test_${Date.now()}`;
  const workflow = JSON.parse(JSON.stringify(template));

  workflow["11"].inputs.image = productName;
  workflow["200"].inputs.image = modelName;
  workflow["1"].inputs.prompt = PROMPT_POS;
  workflow["39"].inputs.prompt = PROMPT_NEG;
  workflow["166"].inputs.filename_prefix = jobId;
  workflow["167"].inputs.seed = Math.floor(Math.random() * 999_999_999);

  console.log(`\n🚀 Submetendo workflow (job: ${jobId})...`);
  const res = await fetch(`${COMFY_BASE}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submitWorkflow error: ${res.status}\n${text}`);
  }

  const data = await res.json();
  console.log(`  ✓ prompt_id: ${data.prompt_id}`);
  return { promptId: data.prompt_id, jobId };
}

async function pollResult(promptId, jobId) {
  console.log(`\n⏳ Aguardando resultado (polling a cada 5s)...`);
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
      console.log(`\n✅ PRONTO! (tentativa ${i + 1})`);
      console.log(`🖼️  Resultado: ${url}`);
      return url;
    }

    if (entry.status?.status_str === "error") {
      console.log(`\n❌ ERRO no ComfyUI:`, JSON.stringify(entry.status, null, 2));
      return null;
    }

    process.stdout.write(`  [${i + 1}/60] ainda processando...\r`);
  }
  console.log("\n⏱️  Timeout — job ainda na fila");
  return null;
}

// MAIN
const [,, productUrl, modelUrl] = process.argv;

if (!productUrl || !modelUrl) {
  console.error("Uso: node scripts/test-catalog.mjs <url_produto> <url_modelo>");
  console.error("\nExemplo com imagens de teste:");
  console.error(`  node scripts/test-catalog.mjs \\`);
  console.error(`    "https://images.pexels.com/photos/2220316/pexels-photo-2220316.jpeg" \\`);
  console.error(`    "https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg"`);
  process.exit(1);
}

console.log("🧪 Teste de Catálogo de Modelos — TamoWork");
console.log(`📦 Produto: ${productUrl}`);
console.log(`👤 Modelo:  ${modelUrl}`);
console.log(`🔗 ComfyUI: ${COMFY_BASE}\n`);

try {
  const productName = await uploadImage(productUrl, `test_product_${Date.now()}.jpg`);
  const modelName = await uploadImage(modelUrl, `test_model_${Date.now()}.jpg`);
  const { promptId, jobId } = await submitWorkflow(productName, modelName);
  await pollResult(promptId, jobId);
} catch (err) {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
}
