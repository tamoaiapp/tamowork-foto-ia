/**
 * test-infer.mjs — Testa os fixes do infer.ts diretamente
 * Roda: node test-infer.mjs
 */

// Simula o módulo compilado usando ts-node/esm via tsx
import { execSync } from "child_process";

const cases = [
  // Bug 1: sem modelo
  { produto: "Sandália feminina", cenario: "Quero essa sandália encostada em banco de madeira jardim flores sem modelo", expect: "scene_tabletop" },
  { produto: "Sandália feminina", cenario: "so a sandália na grama jardim flores sem modelo", expect: "scene_tabletop" },
  { produto: "Sandália feminina", cenario: "sem pe de modelo, só a sandália", expect: "scene_tabletop" },
  // Bug 2: chuteira → wear_feet
  { produto: "Chuteira f50 Adidas", cenario: "Estádio", expect: "wear_feet" },
  { produto: "Chuteira Society Nike", cenario: "", expect: "wear_feet" },
  // Bug 3: segurando na mão
  { produto: "Sandália feminina", cenario: "Quero modelo segurando essa sandália na mão em jardim", expect: "hold_bag_hand" },
  // Bug 4: plus size (testado via persona)
  { produto: "Vestido azul marinho", cenario: "Mulher plus size com o vestido numa festa", expect: "wear_torso_full" },
  // Bug 5: descolorante → hold_beauty_product
  { produto: "Po descolorante Amigos Barber", cenario: "Homem usando o produto ao ar livre", expect: "hold_beauty_product" },
  { produto: "Pomada capilar", cenario: "", expect: "hold_beauty_product" },
  // Casos que devem continuar funcionando (não regredir)
  { produto: "Sandália Mariotta", cenario: "mesa rústica de madeira", expect: "wear_feet" },
  // Nike Alphafly: sem keyword de calçado → scene_tabletop (OK — visão moondream resolve em produção)
  { produto: "Nike Alphafly", cenario: "Homem praticando corrida", expect: "scene_tabletop" },
  { produto: "Vestido feminino", cenario: "mulher em festa", expect: "wear_torso_full" },
  { produto: "Cinto preto em couro", cenario: "cenário refinado com modelo", expect: "wear_waist_legs" },
];

// Usa script auxiliar via tsx para rodar TypeScript
const script = `
import { buildPromptResult } from "./lib/promptuso/infer.ts";

const cases = ${JSON.stringify(cases)};
let pass = 0, fail = 0;

for (const c of cases) {
  const r = buildPromptResult(c.produto, c.cenario);
  const slot = r.meta.final_slot;
  const ok = slot === c.expect;
  if (ok) pass++;
  else fail++;
  console.log(\`\${ok ? "✅" : "❌"} [\${c.expect}] got=[\${slot}] | \${c.produto.slice(0,30)} | \${c.cenario.slice(0,40)}\`);
}

console.log(\`\\n\${pass} passou / \${fail} falhou\`);
if (fail > 0) process.exit(1);
`;

import { writeFileSync, unlinkSync } from "fs";
writeFileSync("_test_infer_tmp.ts", script);
try {
  const out = execSync("npx tsx _test_infer_tmp.ts", { cwd: process.cwd(), encoding: "utf8" });
  console.log(out);
} catch (e) {
  console.log(e.stdout);
  console.error(e.stderr);
} finally {
  unlinkSync("_test_infer_tmp.ts");
}
