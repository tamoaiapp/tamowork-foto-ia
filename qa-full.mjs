/**
 * QA Full — TamoWork Foto IA
 * Testa desktop (EN) + smartphone (SP/mobile) — FREE e PRO — PT/EN/ES
 *
 * Contas FREE:  test-qa-free-a1..a5 + test-stress-d4
 * Contas PRO:   test-stress-d1, d5, m3, m4, m5
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://tamowork.com";
const SS_DIR = path.join(__dirname, "test-screenshots", "qa-full");
fs.mkdirSync(SS_DIR, { recursive: true });

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY";

// ── Contas de teste ────────────────────────────────────────────────────────────
const FREE_ACCOUNTS = [
  { email: "test-qa-free-a1@tamowork.test", password: "QaFreeA1@2026" },
  { email: "test-qa-free-a2@tamowork.test", password: "QaFreeA2@2026" },
  { email: "test-qa-free-a3@tamowork.test", password: "QaFreeA3@2026" },
  { email: "test-qa-free-a4@tamowork.test", password: "QaFreeA4@2026" },
  { email: "test-qa-free-a5@tamowork.test", password: "QaFreeA5@2026" },
  { email: "test-stress-d4@tamowork.test",  password: "StressD4@2026"  },
];

const PRO_ACCOUNTS = [
  { email: "test-stress-d1@tamowork.test", password: "StressD1@2026" },
  { email: "test-stress-d5@tamowork.test", password: "StressD5@2026" },
  { email: "test-stress-m3@tamowork.test", password: "StressM3@2026" },
  { email: "test-stress-m4@tamowork.test", password: "StressM4@2026" },
  { email: "test-stress-m5@tamowork.test", password: "StressM5@2026" },
];

// ── Viewports ─────────────────────────────────────────────────────────────────
const DESKTOP = { width: 1440, height: 900, label: "desktop" };
const MOBILE  = { width: 390, height: 844, isMobile: true, label: "smartphone" };

// ── Resultados ────────────────────────────────────────────────────────────────
const results = [];
let pass = 0, fail = 0;

function log(label, check, ok, detail = "") {
  const icon = ok ? "✅" : "❌";
  const line = `  ${icon} ${check}${detail ? " — " + detail : ""}`;
  console.log(line);
  results.push({ label, check, ok, detail });
  if (ok) pass++; else fail++;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Login via e-mail/senha Supabase (não usa UI, mais rápido e confiável) ─────
async function getAuthToken(email, password) {
  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Login falhou: ${error?.message}`);
  return data.session.access_token;
}

// ── Injetar token no localStorage (evita fluxo UI de login) ──────────────────
async function injectAuth(page, email, password) {
  const token = await getAuthToken(email, password);
  await page.addInitScript((tok) => {
    const key = "sb-ddpyvdtgxemyxltgtxsh-auth-token";
    const payload = {
      access_token: tok,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "qa-refresh",
      user: { id: "qa-user", email: "qa@test" },
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, token);
  return token;
}

// ── Testar uma sessão (viewport + conta + plano) ──────────────────────────────
async function runSession(account, viewport, plan, lang, idx) {
  const label = `[${idx}] ${viewport.label.toUpperCase()} | ${plan.toUpperCase()} | ${lang.toUpperCase()} | ${account.email.split("@")[0]}`;
  console.log(`\n${"═".repeat(60)}`);
  console.log(label);
  console.log("═".repeat(60));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile ?? false,
    locale: lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US",
    userAgent: viewport.isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const jsErrors = [];
  const networkFails = [];

  const page = await context.newPage();
  page.on("pageerror", (err) => jsErrors.push(err.message));
  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes("supabase") && !url.includes("push") && !url.includes("ab/") && !url.includes("bubble") && !url.includes("upsell-track")) {
      networkFails.push(`${status} ${url.replace(BASE_URL, "")}`);
    }
  });

  try {
    // 1. Inject auth antes de navegar
    await injectAuth(page, account.email, account.password);

    // 2. Navegar para a home
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);

    // 3. Definir idioma
    const langMap = { pt: "pt-BR", en: "en", es: "es" };
    await page.evaluate((l) => { try { localStorage.setItem("lang", l); } catch {} }, langMap[lang]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(1500);

    // Reinjeta auth depois do reload (localStorage limpa em alguns casos)
    const token = await getAuthToken(account.email, account.password);
    await page.evaluate((tok) => {
      const key = "sb-ddpyvdtgxemyxltgtxsh-auth-token";
      const payload = { access_token: tok, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "qa", user: { id: "qa", email: "qa@test" } };
      localStorage.setItem(key, JSON.stringify(payload));
    }, token);
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(2500);

    const ssBase = `${idx.toString().padStart(2, "0")}-${viewport.label}-${plan}-${lang}`;

    // ── TESTE 1: Overflow horizontal ─────────────────────────────────────────
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    log(label, "Sem overflow horizontal na home", !overflow, overflow ? `scrollWidth=${document.documentElement?.scrollWidth}` : "");

    // Screenshot home
    await page.screenshot({ path: path.join(SS_DIR, `${ssBase}-01-home.png`), fullPage: false });

    // ── TESTE 2: Textos de primeira pessoa (PT) ───────────────────────────────
    if (lang === "pt") {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasManda = bodyText.includes("Manda") || bodyText.includes("manda");
      const hasIA3pessoa = bodyText.includes("A IA") && !bodyText.includes("Eu leio");
      log(label, "Linguagem de 1ª pessoa presente (PT)", hasManda, hasManda ? "" : "texto sem 'Manda'");
      log(label, "Sem 'A IA' em 3ª pessoa (PT)", !hasIA3pessoa, hasIA3pessoa ? "encontrado 'A IA'" : "");
    }

    // ── TESTE 3: Scroll suave ────────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    log(label, "Scroll sem erros JS", jsErrors.length === 0, jsErrors.join("; ").slice(0, 100));

    // ── TESTE 4: Navegação — /planos ─────────────────────────────────────────
    await page.goto(`${BASE_URL}/planos`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(1500);
    const plansTitle = await page.evaluate(() => document.title);
    const plansBody = await page.evaluate(() => document.body.innerText);
    const hasPrice = plansBody.match(/R\$|USD|\$\d|\d+\/m/i);
    log(label, "/planos carregou", !!plansTitle && !plansBody.includes("404"), "");
    log(label, "/planos mostra preço", !!hasPrice, hasPrice ? hasPrice[0] : "sem preço");
    await page.screenshot({ path: path.join(SS_DIR, `${ssBase}-02-planos.png`) });

    // ── TESTE 5: Navegação — /criacoes ──────────────────────────────────────
    await page.goto(`${BASE_URL}/criacoes`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(1500);
    const criacoesBody = await page.evaluate(() => document.body.innerText);
    log(label, "/criacoes carregou", !criacoesBody.includes("404") && !criacoesBody.includes("Error"), "");
    await page.screenshot({ path: path.join(SS_DIR, `${ssBase}-03-criacoes.png`) });

    // ── TESTE 6: Navegação — /conta ─────────────────────────────────────────
    await page.goto(`${BASE_URL}/conta`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(1500);
    const contaBody = await page.evaluate(() => document.body.innerText);
    const hasPlanInfo = contaBody.match(/Pro|Gratuito|Free|plan/i);
    log(label, "/conta carregou com plano", !!hasPlanInfo, hasPlanInfo ? hasPlanInfo[0] : "sem info de plano");
    await page.screenshot({ path: path.join(SS_DIR, `${ssBase}-04-conta.png`) });

    // ── TESTE 7: Home — botões clicáveis ────────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(2000);
    const btns = await page.$$("button, a[href]");
    log(label, `Botões encontrados (${btns.length})`, btns.length > 0, "");

    // ── TESTE 8: Modo seletor carrega ────────────────────────────────────────
    const modeSelector = await page.$("[class*='mode'], [data-mode], button[style*='border-radius']");
    log(label, "ModeSelector visível", !!modeSelector, "");

    // ── TESTE 9: PRO — sem onboarding ───────────────────────────────────────
    if (plan === "pro") {
      await sleep(1000);
      const hasOnboard = await page.evaluate(() => !!document.querySelector("[class*='onboard'], [data-testid*='onboard']") || document.body.innerText.includes("Quero testar") || document.body.innerText.includes("Try for free") || document.body.innerText.includes("Quiero probar"));
      log(label, "PRO não vê onboarding", !hasOnboard, hasOnboard ? "onboarding visível para PRO" : "");
    }

    // ── TESTE 10: FREE — limite diário visível após uso ──────────────────────
    if (plan === "free") {
      const hasUpgrade = await page.evaluate(() => document.body.innerText.includes("PRO") || document.body.innerText.includes("Pro") || document.body.innerText.includes("upgrade") || document.body.innerText.includes("Assinar") || document.body.innerText.includes("Subscribe"));
      log(label, "FREE vê CTA de upgrade", !!hasUpgrade, hasUpgrade ? "CTA encontrado" : "sem CTA de upgrade");
    }

    // ── TESTE 11: Sem erros de rede graves ───────────────────────────────────
    const criticalFails = networkFails.filter(f => f.startsWith("5"));
    log(label, "Sem erros 5xx de rede", criticalFails.length === 0, criticalFails.join(", ").slice(0, 150));

    // ── TESTE 12: /editor carrega ────────────────────────────────────────────
    await page.goto(`${BASE_URL}/editor`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(1500);
    const editorBody = await page.evaluate(() => document.body.innerText);
    log(label, "/editor carregou", !editorBody.includes("404"), "");
    await page.screenshot({ path: path.join(SS_DIR, `${ssBase}-05-editor.png`) });

    // ── TESTE 13: Overflow em todas as páginas ───────────────────────────────
    const pages = [BASE_URL, `${BASE_URL}/planos`, `${BASE_URL}/criacoes`];
    for (const url of pages) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await sleep(800);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      log(label, `Sem overflow em ${url.replace(BASE_URL, "") || "/"}`, !ov, ov ? "overflow detectado" : "");
    }

    // ── TESTE 14: Console errors finais ──────────────────────────────────────
    log(label, "Sem erros JS críticos", jsErrors.filter(e => !e.includes("ResizeObserver") && !e.includes("Non-Error")).length === 0, jsErrors.filter(e => !e.includes("ResizeObserver")).join(" | ").slice(0, 200));

  } catch (err) {
    log(label, "Sessão completou sem crash", false, err.message?.slice(0, 200));
  } finally {
    await browser.close();
  }
}

// ── Main — rodar todas as sessões em paralelo ─────────────────────────────────
async function main() {
  console.log("\n🚀 QA Full — TamoWork Foto IA");
  console.log(`📅 ${new Date().toLocaleString("pt-BR")}`);
  console.log(`📍 ${BASE_URL}\n`);

  // Sessões: 10 desktop (EN) + 10 smartphone (SP) — FREE e PRO
  // Cada grupo de 5 roda em paralelo para não sobrecarregar

  const sessions = [
    // Desktop FREE (5 contas × PT/EN/ES alternado)
    { account: FREE_ACCOUNTS[0], viewport: DESKTOP, plan: "free", lang: "pt", idx: 1 },
    { account: FREE_ACCOUNTS[1], viewport: DESKTOP, plan: "free", lang: "en", idx: 2 },
    { account: FREE_ACCOUNTS[2], viewport: DESKTOP, plan: "free", lang: "es", idx: 3 },
    { account: FREE_ACCOUNTS[3], viewport: DESKTOP, plan: "free", lang: "pt", idx: 4 },
    { account: FREE_ACCOUNTS[4], viewport: DESKTOP, plan: "free", lang: "en", idx: 5 },

    // Desktop PRO (5 contas)
    { account: PRO_ACCOUNTS[0], viewport: DESKTOP, plan: "pro", lang: "pt", idx: 6 },
    { account: PRO_ACCOUNTS[1], viewport: DESKTOP, plan: "pro", lang: "en", idx: 7 },
    { account: PRO_ACCOUNTS[2], viewport: DESKTOP, plan: "pro", lang: "es", idx: 8 },
    { account: PRO_ACCOUNTS[3], viewport: DESKTOP, plan: "pro", lang: "pt", idx: 9 },
    { account: PRO_ACCOUNTS[4], viewport: DESKTOP, plan: "pro", lang: "en", idx: 10 },

    // Smartphone FREE (5 contas)
    { account: FREE_ACCOUNTS[5], viewport: MOBILE, plan: "free", lang: "pt", idx: 11 },
    { account: FREE_ACCOUNTS[0], viewport: MOBILE, plan: "free", lang: "en", idx: 12 },
    { account: FREE_ACCOUNTS[1], viewport: MOBILE, plan: "free", lang: "es", idx: 13 },
    { account: FREE_ACCOUNTS[2], viewport: MOBILE, plan: "free", lang: "pt", idx: 14 },
    { account: FREE_ACCOUNTS[3], viewport: MOBILE, plan: "free", lang: "en", idx: 15 },

    // Smartphone PRO (5 contas)
    { account: PRO_ACCOUNTS[0], viewport: MOBILE, plan: "pro", lang: "pt", idx: 16 },
    { account: PRO_ACCOUNTS[1], viewport: MOBILE, plan: "pro", lang: "en", idx: 17 },
    { account: PRO_ACCOUNTS[2], viewport: MOBILE, plan: "pro", lang: "es", idx: 18 },
    { account: PRO_ACCOUNTS[3], viewport: MOBILE, plan: "pro", lang: "pt", idx: 19 },
    { account: PRO_ACCOUNTS[4], viewport: MOBILE, plan: "pro", lang: "en", idx: 20 },
  ];

  // Roda em grupos de 4 paralelos para não travar a máquina
  const CHUNK = 4;
  for (let i = 0; i < sessions.length; i += CHUNK) {
    const chunk = sessions.slice(i, i + CHUNK);
    await Promise.all(chunk.map(s => runSession(s.account, s.viewport, s.plan, s.lang, s.idx)));
  }

  // ── Relatório final ───────────────────────────────────────────────────────
  const total = pass + fail;
  const score = total > 0 ? Math.round((pass / total) * 100) : 0;

  console.log("\n" + "═".repeat(60));
  console.log("📊 RELATÓRIO FINAL");
  console.log("═".repeat(60));
  console.log(`✅ PASS: ${pass}/${total} (${score}%)`);
  console.log(`❌ FAIL: ${fail}/${total}`);

  if (fail > 0) {
    console.log("\n🔴 Falhas:");
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  • [${r.label.split("|")[0].trim()}] ${r.check}: ${r.detail}`);
    });
  }

  // Salvar relatório JSON
  const reportPath = path.join(SS_DIR, `report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), score, pass, fail, total, results }, null, 2));
  console.log(`\n📁 Screenshots: ${SS_DIR}`);
  console.log(`📄 Relatório: ${reportPath}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
