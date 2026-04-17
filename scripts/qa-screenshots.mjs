/**
 * qa-screenshots.mjs
 *
 * Tira screenshots de todas as páginas do TamoWork em mobile e desktop,
 * como usuário FREE e PRO.
 *
 * Uso:
 *   node scripts/qa-screenshots.mjs
 *
 * Requer: npx playwright install chromium
 * Saída: screenshots/ (pasta criada automaticamente)
 */

import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

// ─── Configuração ───────────────────────────────────────────────────────────
const BASE_URL = "https://tamowork.com";

// Credenciais de teste — preencha com contas reais
const FREE_USER  = { email: process.env.QA_FREE_EMAIL  || "", password: process.env.QA_FREE_PASS  || "" };
const PRO_USER   = { email: process.env.QA_PRO_EMAIL   || "", password: process.env.QA_PRO_PASS   || "" };

const VIEWPORTS = {
  mobile:  { width: 390,  height: 844,  deviceScaleFactor: 2 }, // iPhone 14
  desktop: { width: 1440, height: 900,  deviceScaleFactor: 1 },
};

// Páginas públicas (sem login)
const PUBLIC_PAGES = [
  { path: "/",          name: "home-sem-login" },
  { path: "/planos",    name: "planos" },
  { path: "/explorar",  name: "explorar" },
  { path: "/privacidade", name: "privacidade" },
];

// Páginas autenticadas (free e pro)
const AUTH_PAGES = [
  { path: "/",          name: "home" },
  { path: "/criacoes",  name: "criacoes" },
  { path: "/onboarding", name: "onboarding" },
  { path: "/tamo",      name: "tamo" },
  { path: "/editor",    name: "editor" },
  { path: "/bonus",     name: "bonus" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
async function screenshot(page, folder, name) {
  await mkdir(folder, { recursive: true });
  const path = `${folder}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`  ✓ ${path}`);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput  = page.locator('input[type="password"]').first();

  await emailInput.fill(email);
  await passInput.fill(password);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  console.log(`  ✓ Login feito: ${email}`);
}

async function captureWithStates(page, folder, vp) {
  // Captura scroll top (acima do fold)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await screenshot(page, folder, "01-topo");

  // Scroll até metade
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(400);
  await screenshot(page, folder, "02-meio");

  // Scroll até o final
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await screenshot(page, folder, "03-final");

  // Screenshot full page
  await screenshot(page, folder, "00-full");
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function run() {
  console.log("🚀 Iniciando QA de screenshots...\n");

  const browser = await chromium.launch({ headless: true });

  // 1. Páginas públicas
  console.log("📸 Páginas públicas...");
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx  = await browser.newContext({ viewport: vp, locale: "pt-BR" });
    const page = await ctx.newPage();

    for (const { path, name } of PUBLIC_PAGES) {
      console.log(`\n  [${vpName}] ${path}`);
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const folder = `screenshots/public/${name}/${vpName}`;
      await captureWithStates(page, folder, vpName);
    }
    await ctx.close();
  }

  // 2. Usuário FREE
  if (FREE_USER.email) {
    console.log("\n📸 Usuário FREE...");
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const ctx  = await browser.newContext({ viewport: vp, locale: "pt-BR" });
      const page = await ctx.newPage();
      await login(page, FREE_USER.email, FREE_USER.password);

      for (const { path, name } of AUTH_PAGES) {
        console.log(`\n  [free/${vpName}] ${path}`);
        try {
          await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(1500);
          const folder = `screenshots/free/${name}/${vpName}`;
          await captureWithStates(page, folder, vpName);
        } catch (e) {
          console.log(`  ⚠️ Erro em ${path}: ${e.message}`);
        }
      }
      await ctx.close();
    }
  } else {
    console.log("\n⚠️  QA_FREE_EMAIL não definido — pulando usuário FREE");
  }

  // 3. Usuário PRO
  if (PRO_USER.email) {
    console.log("\n📸 Usuário PRO...");
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const ctx  = await browser.newContext({ viewport: vp, locale: "pt-BR" });
      const page = await ctx.newPage();
      await login(page, PRO_USER.email, PRO_USER.password);

      for (const { path, name } of AUTH_PAGES) {
        console.log(`\n  [pro/${vpName}] ${path}`);
        try {
          await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(1500);
          const folder = `screenshots/pro/${name}/${vpName}`;
          await captureWithStates(page, folder, vpName);
        } catch (e) {
          console.log(`  ⚠️ Erro em ${path}: ${e.message}`);
        }
      }
      await ctx.close();
    }
  } else {
    console.log("\n⚠️  QA_PRO_EMAIL não definido — pulando usuário PRO");
  }

  await browser.close();

  console.log("\n✅ Screenshots salvas em ./screenshots/");
  console.log("   Estrutura:");
  console.log("   screenshots/");
  console.log("   ├── public/   (sem login)");
  console.log("   ├── free/     (usuário free)");
  console.log("   └── pro/      (usuário pro)");
  console.log("\n   Cada pasta tem: mobile/ e desktop/ com 00-full.png, 01-topo.png, 02-meio.png, 03-final.png");
}

run().catch(console.error);
