/**
 * Faz overlay de logo + texto em uma imagem resultado
 * node scripts/overlay-test.mjs <url_resultado> <path_logo> <output_path>
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";

const [,, resultUrl, logoPath, outputPath = "c:/Users/Notebook/Downloads/resultado_final.png"] = process.argv;

if (!resultUrl || !logoPath) {
  console.error("Uso: node scripts/overlay-test.mjs <url_resultado> <path_logo> <output_path>");
  process.exit(1);
}

console.log("⬇️  Baixando resultado...");
const res = await fetch(resultUrl);
if (!res.ok) throw new Error(`Erro ao baixar resultado: ${res.status}`);
const resultBuffer = Buffer.from(await res.arrayBuffer());

console.log("📐 Obtendo dimensões...");
const { width, height } = await sharp(resultBuffer).metadata();
console.log(`  ${width}x${height}`);

// Remove fundo da logo com sharp (só redimensiona — fundo já deve ser transparente ou será preservado)
console.log("🖼️  Processando logo...");
const logoRaw = readFileSync(logoPath);
const logoSize = Math.round(Math.min(width, height) * 0.18); // 18% do menor lado
const logoBuffer = await sharp(logoRaw)
  .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const margin = Math.round(logoSize * 0.15);
const logoX = width - logoSize - margin;
const logoY = height - logoSize - margin;

// Texto como SVG
const fontSize = Math.round(width * 0.055);
const lineH = Math.round(fontSize * 1.4);
const textW = Math.round(width * 0.7);
const textH = lineH * 2 + 20;
const textX = margin;
const textY = margin;

const textSvg = `<svg width="${textW}" height="${textH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="1" dy="1" stdDeviation="3" flood-color="rgba(0,0,0,0.8)"/>
    </filter>
  </defs>
  <text x="4" y="${fontSize}" font-family="Arial, sans-serif" font-size="${fontSize}"
        font-weight="bold" fill="#FFD700" filter="url(#shadow)">Promoção hoje!</text>
  <text x="4" y="${fontSize + lineH}" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 1.2)}"
        font-weight="bold" fill="#ffffff" filter="url(#shadow)">Óculos R$12</text>
</svg>`;

const textBuffer = Buffer.from(textSvg);

console.log("🎨 Montando imagem final...");
const final = await sharp(resultBuffer)
  .composite([
    { input: textBuffer, top: textY, left: textX },
    { input: logoBuffer, top: logoY, left: logoX },
  ])
  .png()
  .toBuffer();

writeFileSync(outputPath, final);
console.log(`\n✅ Salvo em: ${outputPath}`);
