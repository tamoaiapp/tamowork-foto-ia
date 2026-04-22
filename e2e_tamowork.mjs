import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://tamowork.com';
const REPORT_DIR = 'C:/Users/Notebook/tamowork-foto-ia/e2e-report';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

fs.mkdirSync(REPORT_DIR, { recursive: true });

const issues = [];
const shots = [];
let shotIdx = 0;

async function shot(page, label) {
  shotIdx++;
  const name = `${String(shotIdx).padStart(3,'0')}_${label.replace(/[^a-z0-9]/gi,'_')}.png`;
  const fpath = path.join(REPORT_DIR, name);
  await page.screenshot({ path: fpath, fullPage: true });
  shots.push({ name, label });
  console.log(`📸 ${name}`);
  return fpath;
}

function issue(severity, where, description) {
  issues.push({ severity, where, description });
  const icon = severity === 'CRÍTICO' ? '❌' : severity === 'MÉDIO' ? '⚠️' : 'ℹ️';
  console.log(`${icon} [${severity}] ${where}: ${description}`);
}

async function waitReady(page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
}

const TEST_EMAIL = `teste_e2e_${Date.now()}@yopmail.com`;
const TEST_PASS = 'Teste@2026!';
console.log(`\n🧪 Email de teste: ${TEST_EMAIL}\n`);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// ─── CONTEXTO MOBILE (390x844 = iPhone 14 Pro) ───────────────────────────────
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  locale: 'pt-BR',
});
const page = await ctx.newPage();

// ─── 1. HOME ─────────────────────────────────────────────────────────────────
console.log('\n=== 1. HOME ===');
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  await shot(page, '01_home');
  const title = await page.title();
  console.log('  Title:', title);
  const url = page.url();
  console.log('  URL:', url);
  if (url.includes('/login')) issue('MÉDIO', 'Home', 'Redirecionou para /login sem estar logado — esperado ou bug?');
} catch(e) {
  issue('CRÍTICO', 'Home', `Não carregou: ${e.message}`);
}

// ─── 2. LOGIN ─────────────────────────────────────────────────────────────────
console.log('\n=== 2. LOGIN COM CONTA EXISTENTE ===');
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  await shot(page, '02_login_page');

  // Tenta encontrar "e-mail e senha" primeiro (evita Google OAuth)
  const emailPasswordBtn = page.locator('text=/e-mail e senha|email e senha|usar e-mail/i').first();
  if (await emailPasswordBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailPasswordBtn.click();
    await page.waitForTimeout(1000);
  }

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill('teste10@teste.com');
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill('teste123');
  await shot(page, '03_login_filled');

  const loginBtn = page.locator('button[type="submit"], button:has-text(/entrar/i)').filter({ hasNot: page.locator(':has-text("Google")') }).first();
  await loginBtn.click();
  await page.waitForTimeout(4000);
  await shot(page, '04_after_login');

  const urlAfter = page.url();
  console.log('  URL após login:', urlAfter);
  if (urlAfter.includes('/login')) {
    issue('CRÍTICO', 'Login', 'Permaneceu em /login — login falhou');
  } else {
    console.log('  ✅ Login OK');
  }
} catch(e) {
  issue('CRÍTICO', 'Login', `Erro: ${e.message}`);
}

// ─── 3. ONBOARDING A ─────────────────────────────────────────────────────────
console.log('\n=== 3. ONBOARDING VARIANTE A ===');
try {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.includes('onboarding')).forEach(k => localStorage.removeItem(k));
  });
  await page.goto(`${BASE}/onboarding?v=A`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot(page, '05_onboarding_A_step1');
  const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => '');
  console.log('  Headline A:', h1);

  const cta = page.locator('button').filter({ hasText: /começar|criar|preparar/i }).first();
  if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cta.click();
    await page.waitForTimeout(1500);
    await shot(page, '06_onboarding_A_step2');
    const prodInput = page.locator('input').filter({ hasAttribute: 'placeholder' }).first();
    if (await prodInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  ✅ Step 2 OK');
    } else {
      issue('MÉDIO', 'Onboarding A', 'Step 2 sem campo de input');
    }
  } else {
    issue('CRÍTICO', 'Onboarding A', 'Botão CTA não encontrado');
  }
} catch(e) {
  issue('CRÍTICO', 'Onboarding A', `Erro: ${e.message}`);
}

// ─── 4. ONBOARDING B ─────────────────────────────────────────────────────────
console.log('\n=== 4. ONBOARDING VARIANTE B ===');
try {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.includes('onboarding')).forEach(k => localStorage.removeItem(k));
  });
  await page.goto(`${BASE}/onboarding?v=B`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot(page, '07_onboarding_B_step1');
  const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => '');
  console.log('  Headline B:', h1);
  if (h1.toLowerCase().includes('vend')) console.log('  ✅ Variante B OK');
  else issue('MÉDIO', 'Onboarding B', `Headline inesperada: "${h1}"`);
} catch(e) {
  issue('CRÍTICO', 'Onboarding B', `Erro: ${e.message}`);
}

// ─── 5. ONBOARDING C ─────────────────────────────────────────────────────────
console.log('\n=== 5. ONBOARDING VARIANTE C ===');
try {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.includes('onboarding')).forEach(k => localStorage.removeItem(k));
  });
  await page.goto(`${BASE}/onboarding?v=C`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot(page, '08_onboarding_C_step1');
  const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => '');
  console.log('  Headline C:', h1);

  const cta = page.locator('button').filter({ hasText: /preparar|começar|criar/i }).first();
  if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cta.click();
    await page.waitForTimeout(1500);
    await shot(page, '09_onboarding_C_step2');
    // Preenche produto e avança
    const prodInput = page.locator('input').filter({ hasAttribute: 'placeholder' }).first();
    await prodInput.fill('Tênis Nike').catch(() => {});
    const nextBtn = page.locator('button').filter({ hasText: /próximo/i }).first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, '10_onboarding_C_step3');
      const h2 = await page.locator('h2').first().textContent({ timeout: 3000 }).catch(() => '');
      console.log('  Step 3:', h2);
      if (h2.toLowerCase().includes('usar')) console.log('  ✅ Variante C step 3 OK');
      else issue('MÉDIO', 'Onboarding C', `Step 3 inesperado: "${h2}"`);
    }
  }
} catch(e) {
  issue('CRÍTICO', 'Onboarding C', `Erro: ${e.message}`);
}

// ─── 6. APP /tamo ─────────────────────────────────────────────────────────────
console.log('\n=== 6. APP PRINCIPAL /tamo ===');
try {
  await page.evaluate(() => { localStorage.setItem('onboarding_completed', '1'); });
  await page.goto(`${BASE}/tamo`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await shot(page, '11_tamo_main');
  const url = page.url();
  console.log('  URL:', url);
  if (url.includes('/login')) issue('CRÍTICO', '/tamo', 'Redirecionou para login');
  else if (url.includes('/onboarding')) issue('MÉDIO', '/tamo', 'Redirecionou para onboarding');
  else console.log('  ✅ /tamo OK');
} catch(e) {
  issue('CRÍTICO', '/tamo', `Erro: ${e.message}`);
}

// ─── 7. MODE SELECTOR ────────────────────────────────────────────────────────
console.log('\n=== 7. MODE SELECTOR ===');
try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2500);
  await shot(page, '12_mode_selector');
  const url = page.url();
  console.log('  URL:', url);
  const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
  const hasFoto = bodyText.toLowerCase().includes('foto');
  const hasVideo = bodyText.toLowerCase().includes('vídeo') || bodyText.toLowerCase().includes('video');
  const hasNarrado = bodyText.toLowerCase().includes('narrado') || bodyText.toLowerCase().includes('narration');
  console.log(`  Foto: ${hasFoto} | Vídeo: ${hasVideo} | Narrado: ${hasNarrado}`);
  if (!hasFoto) issue('CRÍTICO', 'ModeSelector', 'Opção FOTO não encontrada');
  if (!hasVideo) issue('MÉDIO', 'ModeSelector', 'Opção VÍDEO não encontrada');
} catch(e) {
  issue('CRÍTICO', 'ModeSelector', `Erro: ${e.message}`);
}

// ─── 8. CRIAÇÕES ─────────────────────────────────────────────────────────────
console.log('\n=== 8. CRIAÇÕES ===');
try {
  await page.goto(`${BASE}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2500);
  await shot(page, '13_criacoes');
  const url = page.url();
  if (url.includes('/login')) issue('MÉDIO', '/criacoes', 'Redirecionou para login');
  else console.log('  ✅ /criacoes OK, URL:', url);
} catch(e) {
  issue('MÉDIO', '/criacoes', `Erro: ${e.message}`);
}

// ─── 9. EDITOR ───────────────────────────────────────────────────────────────
console.log('\n=== 9. EDITOR ===');
try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2500);
  await shot(page, '14_editor');
  const url = page.url();
  const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
  if (url.includes('/login')) issue('MÉDIO', '/editor', 'Redirecionou para login');
  else if (!bodyText || bodyText.trim().length < 20) issue('MÉDIO', '/editor', 'Página parece vazia');
  else console.log('  ✅ /editor OK');
} catch(e) {
  issue('MÉDIO', '/editor', `Erro: ${e.message}`);
}

// ─── 10. PLANOS ──────────────────────────────────────────────────────────────
console.log('\n=== 10. PLANOS ===');
try {
  await page.goto(`${BASE}/planos`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2500);
  await shot(page, '15_planos');
  const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
  const hasPro = bodyText.toLowerCase().includes('pro');
  const hasPreco = /R\$|\$|\d+\/mês|\d+\/ano/.test(bodyText);
  console.log(`  PRO: ${hasPro} | Preço: ${hasPreco}`);
  if (!hasPro) issue('CRÍTICO', '/planos', 'Conteúdo PRO não encontrado');
  if (!hasPreco) issue('MÉDIO', '/planos', 'Preços não visíveis');

  // Verifica botão de pagamento
  const payBtns = await page.locator('button').all();
  let foundPayBtn = false;
  for (const btn of payBtns) {
    const txt = (await btn.textContent().catch(() => '')).toLowerCase();
    if (/assinar|contratar|upgrade|pagar|começar|pro/i.test(txt)) {
      foundPayBtn = true;
      console.log(`  ✅ Botão pagamento: "${txt.trim().slice(0,40)}"`);
      break;
    }
  }
  if (!foundPayBtn) issue('CRÍTICO', '/planos', 'Nenhum botão de pagamento encontrado');

  await shot(page, '16_planos_scroll');
} catch(e) {
  issue('MÉDIO', '/planos', `Erro: ${e.message}`);
}

// ─── 11. ROTAS PROTEGIDAS SEM AUTH ───────────────────────────────────────────
console.log('\n=== 11. ROTAS PROTEGIDAS SEM AUTH ===');
const anonCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
const anonPage = await anonCtx.newPage();

const protectedRoutes = ['/tamo', '/criacoes', '/editor', '/planos'];
for (const route of protectedRoutes) {
  try {
    await anonPage.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await anonPage.waitForTimeout(2000);
    const url = anonPage.url();
    const isProtected = url.includes('/login') || url.includes('/onboarding') || url.includes('/signup');
    if (!isProtected) {
      await anonPage.screenshot({ path: path.join(REPORT_DIR, `CRITICAL_unprotected_${route.replace('/','')}.png`), fullPage: true });
      issue('CRÍTICO', `${route} (anon)`, `Rota acessível sem auth! Redirecionou para: ${url}`);
    } else {
      console.log(`  ✅ ${route} → protegida (${url.split('/').pop() || '/'})`);
    }
  } catch(e) {
    console.log(`  ⚠️ ${route}: timeout/erro`);
  }
}
await anonCtx.close();

// ─── 12. DESKTOP RESPONSIVIDADE ──────────────────────────────────────────────
console.log('\n=== 12. DESKTOP (1440px) ===');
const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
const deskPage = await deskCtx.newPage();

for (const [route, label] of [['/', 'home_desktop'], ['/planos', 'planos_desktop'], ['/login', 'login_desktop']]) {
  try {
    await deskPage.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await deskPage.waitForTimeout(2000);
    const idx = ++shotIdx;
    const name = `${String(idx).padStart(3,'0')}_${label}.png`;
    await deskPage.screenshot({ path: path.join(REPORT_DIR, name), fullPage: true });
    shots.push({ name, label });
    console.log(`  📸 ${name}`);
  } catch(e) {
    console.log(`  ⚠️ Desktop ${route}: ${e.message}`);
  }
}
await deskCtx.close();

// ─── 13. TESTE API (sem auth — deve retornar 401) ────────────────────────────
console.log('\n=== 13. API ENDPOINTS SEM AUTH ===');
const apiEndpoints = [
  '/api/image-jobs',
  '/api/video-jobs',
  '/api/narrated-video',
];
for (const ep of apiEndpoints) {
  try {
    const resp = await fetch(`${BASE}${ep}`);
    if (resp.status === 401) {
      console.log(`  ✅ ${ep} → 401 (correto)`);
    } else if (resp.status === 200) {
      issue('CRÍTICO', `API ${ep}`, `Retornou 200 sem autenticação!`);
    } else {
      console.log(`  ℹ️ ${ep} → ${resp.status}`);
    }
  } catch(e) {
    console.log(`  ⚠️ ${ep}: ${e.message}`);
  }
}

// ─── RELATÓRIO FINAL ─────────────────────────────────────────────────────────
const report = {
  timestamp: TIMESTAMP,
  testEmail: TEST_EMAIL,
  totalScreenshots: shots.length,
  totalIssues: issues.length,
  critical: issues.filter(i => i.severity === 'CRÍTICO').length,
  medium: issues.filter(i => i.severity === 'MÉDIO').length,
  issues,
  screenshots: shots,
};

fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));

console.log('\n' + '='.repeat(60));
console.log('📊 RELATÓRIO E2E FINAL');
console.log('='.repeat(60));
console.log(`📸 Screenshots: ${shots.length}`);
console.log(`🐛 Problemas: ${issues.length} (${report.critical} críticos, ${report.medium} médios)`);
if (issues.length > 0) {
  console.log('\nProblemas encontrados:');
  issues.forEach(i => {
    const icon = i.severity === 'CRÍTICO' ? '❌' : '⚠️';
    console.log(`  ${icon} [${i.severity}] ${i.where}: ${i.description}`);
  });
}
console.log(`\n📁 Relatório: ${REPORT_DIR}/report.json`);

await browser.close();
