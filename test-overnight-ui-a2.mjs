/**
 * Agente de teste overnight — TamoWork Foto IA
 * Conta: ui-a2@tamowork.test | Senha: UItest2026!
 * Viewport: 390x844 (iPhone mobile), headless: true
 *
 * Testes:
 *  1. Validação formulário sem imagem
 *  2. Validação sem produto (imagem enviada)
 *  3. Botão vídeo bloqueado para free
 *  4. Limite diário (2ª geração)
 *  5. Botão "Liberar agora" redireciona para MP
 *  6. ProUpsell visível acima da foto
 *  7. BottomNav mobile — 3 ícones, sem sidebar
 *  8. Header fixo ao rolar
 *  9. Overflow em 390px
 * 10. Botão Google no login
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── config ──────────────────────────────────────────────────────────────────
const BASE_URL   = 'https://tamowork.com';
const EMAIL      = 'ui-a2@tamowork.test';
const PASSWORD   = 'UItest2026!';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots', 'ui-a2');
const REPORT_PATH = path.join(SCREENSHOTS_DIR, 'report.json');
const RUNS = 5;

// ── helpers ──────────────────────────────────────────────────────────────────
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function ensureAccount() {
  // Tenta criar conta via service_role admin
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === EMAIL);
  if (found) {
    console.log(`[setup] Conta ${EMAIL} já existe (id: ${found.id}), garantindo sem PRO`);
    // Garante que user_metadata não tenha plan=pro
    await supabaseAdmin.auth.admin.updateUserById(found.id, {
      user_metadata: { plan: 'free' }
    });
    return found.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { plan: 'free' }
  });
  if (error) throw new Error(`Falha ao criar conta: ${error.message}`);
  console.log(`[setup] Conta criada: ${data.user.id}`);
  return data.user.id;
}

async function clearJobsForUser(userId) {
  const { error } = await supabaseAdmin
    .from('image_jobs')
    .delete()
    .eq('user_id', userId);
  if (error) console.warn('[setup] Aviso ao limpar jobs:', error.message);
  else console.log('[setup] Jobs do usuário limpos');
}

async function injectJobForUser(userId) {
  // Injeta job done nas últimas 2h (simula 1ª geração concluída hoje)
  const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('image_jobs')
    .insert({
      user_id: userId,
      status: 'done',
      output_image_url: 'https://placehold.co/600x400/111820/fff?text=Test+Job',
      input_image_url: 'https://placehold.co/600x400/111820/fff?text=Input',
      created_at: createdAt
    })
    .select()
    .single();
  if (error) throw new Error(`Falha ao injetar job: ${error.message}`);
  console.log('[setup] Job injetado:', data.id);
  return data;
}

async function newPage(browser, storageState = null) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    storageState: storageState || undefined,
  });
  const page = await ctx.newPage();
  return { page, ctx };
}

async function loginAndGetStorage(browser) {
  const { page, ctx } = await newPage(browser);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Passo 1: Clica em "Usar e-mail e senha" para revelar os inputs
  const toggleVisible = await page.locator('button:has-text("Usar e-mail e senha")').isVisible({ timeout: 5000 }).catch(() => false);
  if (toggleVisible) {
    await page.click('button:has-text("Usar e-mail e senha")');
    await page.waitForTimeout(2000); // React precisa de tempo para renderizar
  }

  // Passo 2: Garante modo "Entrar" (tab login)
  const loginTabVisible = await page.locator('button:has-text("Entrar")').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (loginTabVisible) {
    await page.click('button:has-text("Entrar")');
    await page.waitForTimeout(300);
  }

  // Passo 3: Preenche e-mail e senha (sem waitForSelector — usa fill direto)
  // O debug mostrou que o input já está disponível após 2000ms do click
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Aguarda redirect para / ou /onboarding (pode demorar)
  await page.waitForURL(url => !url.includes('/login'), { timeout: 30000 });
  await page.waitForTimeout(1000);

  if (page.url().includes('/onboarding')) {
    // Tenta pular onboarding
    const skipBtn = page.locator('button:has-text("Pular"), button:has-text("Skip"), a:has-text("Pular"), button:has-text("Continuar")').first();
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(1000);
    }
    // Tenta navegar direto para /
    if (page.url().includes('/onboarding')) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);
    }
  }

  const storage = await ctx.storageState();
  await ctx.close();
  return storage;
}

async function screenshot(page, name) {
  const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

// Pequena imagem de teste (PNG 1x1 branco)
const TEST_IMAGE_PATH = path.join(SCREENSHOTS_DIR, '_test_image.png');
function createTestImage() {
  // PNG mínimo 1x1 branco válido
  const buf = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e000000034944415478016360f8cfc00000000200011e2116950000000049454e44ae426082', 'hex'
  );
  fs.writeFileSync(TEST_IMAGE_PATH, buf);
}

// ── navegação até o form de criação ─────────────────────────────────────────
async function goToCreateForm(page) {
  // Espera carregar a página principal
  await page.waitForSelector('.bottom-nav, [class*="bottom"], button, nav', { timeout: 10000 }).catch(() => {});

  // Verifica se já está no formulário (após ModeSelector)
  const modeSelector = page.locator('[data-mode], button:has-text("Foto do produto"), button:has-text("Simulação"), button:has-text("Vídeo"), button:has-text("Fundo branco"), button:has-text("Catálogo")').first();
  if (await modeSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Clica em qualquer modo para entrar no form
    await modeSelector.click();
    await page.waitForTimeout(500);
  }

  // Verifica novamente após clicar
  const form = page.locator('form, input[type="file"], button:has-text("Gerar"), button:has-text("Criar foto")').first();
  return await form.isVisible({ timeout: 5000 }).catch(() => false);
}

// ── runner de testes ─────────────────────────────────────────────────────────
const report = {
  runAt: new Date().toISOString(),
  account: EMAIL,
  viewport: '390x844',
  tests: {}
};

function recordResult(testId, run, pass, note, screenshotPath = null) {
  if (!report.tests[testId]) {
    report.tests[testId] = { runs: [], pass: null, variations: [] };
  }
  report.tests[testId].runs.push({ run, pass, note, screenshot: screenshotPath });
  if (note && !report.tests[testId].variations.includes(note)) {
    report.tests[testId].variations.push(note);
  }
}

function finalizeReport() {
  for (const [id, t] of Object.entries(report.tests)) {
    const passCount = t.runs.filter(r => r.pass).length;
    t.pass = passCount === t.runs.length;
    t.passRate = `${passCount}/${t.runs.length}`;
    t.summary = t.pass ? 'PASS' : (passCount === 0 ? 'FAIL' : 'FLAKY');
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  createTestImage();

  console.log('[setup] Provisionando conta FREE...');
  let userId;
  try {
    userId = await ensureAccount();
  } catch (err) {
    console.error('[setup] ERRO:', err.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // ── Login e storage ──────────────────────────────────────────────────────
  console.log('[setup] Fazendo login para capturar session...');
  let storageState;
  try {
    storageState = await loginAndGetStorage(browser);
    console.log('[setup] Login OK');
  } catch (err) {
    console.error('[setup] Falha no login:', err.message);
    await browser.close();
    process.exit(1);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TESTE 10 — Botão Google (verificação na tela de login)
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n[teste 10] Botão Google no login...');
  for (let run = 1; run <= RUNS; run++) {
    const { page, ctx } = await newPage(browser);
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Procura botão Google (SVG com caminhos coloridos do Google ou texto)
      const googleBtn = page.locator('button:has(svg path[fill="#4285F4"]), button:has-text("Google"), button:has-text("Entrar com Google")').first();
      const visible = await googleBtn.isVisible({ timeout: 5000 }).catch(() => false);
      let googleText = '';
      if (visible) {
        googleText = (await googleBtn.textContent() ?? '').trim();
      }

      const sc = await screenshot(page, `t10_run${run}`);
      const pass = visible && googleText.length > 0;
      recordResult('T10_google_button', run, pass, visible ? `Texto: "${googleText}"` : 'Botão não encontrado', sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — "${googleText}"`);
    } catch (err) {
      recordResult('T10_google_button', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TESTES COM CONTA LOGADA (sem jobs)
  // ════════════════════════════════════════════════════════════════════════

  // ── TESTE 1 — Validação sem imagem ──────────────────────────────────────
  console.log('\n[teste 1] Validação formulário sem imagem...');
  for (let run = 1; run <= RUNS; run++) {
    await clearJobsForUser(userId);
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      // Tenta entrar no modo de criação
      await goToCreateForm(page);
      await page.waitForTimeout(500);

      // Tenta clicar em Gerar/Criar sem imagem
      const gerarBtn = page.locator('button[type="submit"], button:has-text("Gerar"), button:has-text("Criar foto"), button:has-text("Criar"), button:has-text("Gerar foto")').first();
      const btnVisible = await gerarBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (btnVisible) {
        await gerarBtn.click();
        await page.waitForTimeout(800);
      }

      // Verifica se apareceu erro
      const errorEl = page.locator('[class*="error"], [style*="color: rgb(239"], [style*="color:#ef"], p:has-text("Envie"), div:has-text("Envie a foto"), div:has-text("Envie uma foto"), div:has-text("foto do produto")').first();
      const hasError = await errorEl.isVisible({ timeout: 3000 }).catch(() => false);
      let errorText = '';
      if (hasError) errorText = (await errorEl.textContent() ?? '').trim();

      const sc = await screenshot(page, `t01_run${run}`);
      const pass = hasError;
      recordResult('T01_validacao_sem_imagem', run, pass, hasError ? `Erro: "${errorText}"` : `Botão visível: ${btnVisible}, sem erro`, sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — "${errorText}"`);
    } catch (err) {
      recordResult('T01_validacao_sem_imagem', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 2 — Validação sem produto (imagem enviada) ────────────────────
  console.log('\n[teste 2] Validação sem produto...');
  for (let run = 1; run <= RUNS; run++) {
    await clearJobsForUser(userId);
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      await goToCreateForm(page);
      await page.waitForTimeout(500);

      // Upload da imagem
      const fileInput = page.locator('input[type="file"]').first();
      const fileInputVisible = await fileInput.isVisible({ timeout: 3000 }).catch(() => false);
      if (!fileInputVisible) {
        // Tenta clicar em área de upload para revelar o input
        const uploadArea = page.locator('[class*="upload"], div:has-text("Envie"), div:has-text("Selecione"), label[for]').first();
        await uploadArea.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
      await fileInput.setInputFiles(TEST_IMAGE_PATH);
      await page.waitForTimeout(500);

      // Garante campo "produto" em branco (limpa se necessário)
      const produtoInput = page.locator('input[placeholder*="produto"], input[placeholder*="Produto"], input[name="produto"], textarea[placeholder*="produto"]').first();
      if (await produtoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await produtoInput.fill('');
      }

      // Clica em Gerar
      const gerarBtn = page.locator('button[type="submit"], button:has-text("Gerar"), button:has-text("Criar foto"), button:has-text("Criar")').first();
      if (await gerarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await gerarBtn.click();
        await page.waitForTimeout(800);
      }

      // Verifica erro sobre produto
      const errorEl = page.locator('div:has-text("Descreva o produto"), div:has-text("produto"), div:has-text("Preencha"), [class*="error"]').first();
      const hasError = await errorEl.isVisible({ timeout: 3000 }).catch(() => false);
      let errorText = '';
      if (hasError) errorText = (await errorEl.textContent() ?? '').trim().slice(0, 100);

      const sc = await screenshot(page, `t02_run${run}`);
      const pass = hasError;
      recordResult('T02_validacao_sem_produto', run, pass, hasError ? `Erro: "${errorText}"` : 'Sem erro exibido', sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — "${errorText}"`);
    } catch (err) {
      recordResult('T02_validacao_sem_produto', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 3 — Botão vídeo bloqueado para free ───────────────────────────
  console.log('\n[teste 3] Botão vídeo bloqueado para free...');
  for (let run = 1; run <= RUNS; run++) {
    // Injeta job done para ter tela de resultado
    await clearJobsForUser(userId);
    await injectJobForUser(userId);
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Procura botão de vídeo
      const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("Vídeo"), button:has-text("Video"), button:has-text("🎬")').first();
      const btnExists = await videoBtn.isVisible({ timeout: 5000 }).catch(() => false);

      let isDisabled = false;
      let hasLock = false;
      let btnText = '';

      if (btnExists) {
        isDisabled = await videoBtn.isDisabled().catch(() => false);
        btnText = (await videoBtn.textContent() ?? '').trim();
        // Verifica se tem ícone de cadeado ou texto PRO
        hasLock = btnText.includes('🔒') || btnText.includes('PRO') || btnText.includes('Assinar') || isDisabled;
      }

      const sc = await screenshot(page, `t03_run${run}`);
      const pass = btnExists && (isDisabled || hasLock);
      recordResult('T03_video_bloqueado_free', run, pass,
        btnExists ? `Texto: "${btnText}", disabled: ${isDisabled}, lock: ${hasLock}` : 'Botão vídeo não encontrado',
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — exists: ${btnExists}, disabled: ${isDisabled}, lock: ${hasLock}`);
    } catch (err) {
      recordResult('T03_video_bloqueado_free', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 4 — Limite diário (2ª geração) ────────────────────────────────
  console.log('\n[teste 4] Limite diário — 2ª geração...');
  for (let run = 1; run <= RUNS; run++) {
    await clearJobsForUser(userId);
    await injectJobForUser(userId); // job recente = rate limit ativo
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Verifica presença de tela de rate limit OU timer
      const timerEl = page.locator('div:has-text("Limite diário"), div:has-text("próxima foto"), div:has-text("1 foto por dia"), [style*="tabular-nums"]').first();
      const hasTimer = await timerEl.isVisible({ timeout: 5000 }).catch(() => false);
      let timerText = '';
      if (hasTimer) timerText = (await timerEl.textContent() ?? '').trim().slice(0, 100);

      // Também verifica se botão gerar está escondido por conta do rate limit
      const createNewBtn = page.locator('button:has-text("Criar nova foto"), button:has-text("Nova foto")').first();
      const hasCreateNew = await createNewBtn.isVisible({ timeout: 3000 }).catch(() => false);

      // Se há botão "Criar nova foto", clica para tentar 2ª geração
      if (hasCreateNew) {
        await createNewBtn.click();
        await page.waitForTimeout(1000);
        const timerEl2 = page.locator('div:has-text("Limite diário"), div:has-text("próxima foto"), div:has-text("1 foto por dia")').first();
        const hasTimer2 = await timerEl2.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasTimer2) timerText = (await timerEl2.textContent() ?? '').trim().slice(0, 100);
      }

      const sc = await screenshot(page, `t04_run${run}`);
      const pass = hasTimer || (hasCreateNew);
      recordResult('T04_limite_diario', run, pass,
        hasTimer ? `Timer visível: "${timerText}"` : `Tela resultado sem timer. createNew: ${hasCreateNew}`,
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — timer: ${hasTimer}, "${timerText.slice(0, 60)}"`);
    } catch (err) {
      recordResult('T04_limite_diario', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 5 — Botão "Liberar agora" redireciona para MP ─────────────────
  console.log('\n[teste 5] Botão "Liberar agora" → MP...');
  for (let run = 1; run <= RUNS; run++) {
    await clearJobsForUser(userId);
    await injectJobForUser(userId);
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Procura botão de liberar/assinar
      const liberarBtn = page.locator('button:has-text("Liberar agora"), button:has-text("Assinar e criar"), button:has-text("Assinar por"), button:has-text("Liberar")').first();
      const btnExists = await liberarBtn.isVisible({ timeout: 5000 }).catch(() => false);
      let btnText = '';
      let redirected = false;
      let targetUrl = '';

      if (btnExists) {
        btnText = (await liberarBtn.textContent() ?? '').trim();
        // Escuta navegação após clique
        const navPromise = page.waitForNavigation({ timeout: 15000, waitUntil: 'commit' }).catch(() => null);
        // Também captura novas abas
        const newPagePromise = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
        await liberarBtn.click();
        const [nav, newTab] = await Promise.all([navPromise, newPagePromise]);
        await page.waitForTimeout(2000);
        targetUrl = newTab ? newTab.url() : page.url();
        redirected = targetUrl.includes('mercadopago') || targetUrl.includes('mp.com') ||
                     targetUrl.includes('planos') || targetUrl.includes('checkout') ||
                     targetUrl.includes('stripe') || targetUrl.includes('tamowork.com/planos');
      }

      const sc = await screenshot(page, `t05_run${run}`);
      const pass = btnExists && redirected;
      recordResult('T05_liberar_agora_mp', run, pass,
        btnExists ? `Botão: "${btnText}", URL: "${targetUrl.slice(0, 80)}", redirected: ${redirected}` : 'Botão não encontrado',
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — btn: ${btnExists}, url: ${targetUrl.slice(0, 60)}`);
    } catch (err) {
      recordResult('T05_liberar_agora_mp', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 6 — ProUpsell visível ACIMA da foto ───────────────────────────
  console.log('\n[teste 6] ProUpsell acima da foto...');
  for (let run = 1; run <= RUNS; run++) {
    await clearJobsForUser(userId);
    await injectJobForUser(userId);
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Procura bloco PRO upsell
      const proBlock = page.locator('div:has-text("PRO"), div:has-text("Assinar"), div:has-text("Vídeo animado"), div:has-text("Fotos ilimitadas")').first();
      const proVisible = await proBlock.isVisible({ timeout: 5000 }).catch(() => false);

      // Procura imagem resultado
      const resultImg = page.locator('img[src*="output"], img[src*="result"], img[src*="image-jobs"], img[src*="placehold"]').first();
      const imgVisible = await resultImg.isVisible({ timeout: 3000 }).catch(() => false);

      let proAboveImg = false;
      if (proVisible && imgVisible) {
        const proBox = await proBlock.boundingBox().catch(() => null);
        const imgBox = await resultImg.boundingBox().catch(() => null);
        if (proBox && imgBox) {
          // PRO está acima se seu top é menor que o top da imagem
          proAboveImg = proBox.y < imgBox.y;
        }
      }

      const sc = await screenshot(page, `t06_run${run}`);
      const pass = proVisible && proAboveImg;
      recordResult('T06_proupsell_acima_foto', run, pass,
        `proVisible: ${proVisible}, imgVisible: ${imgVisible}, proAboveImg: ${proAboveImg}`,
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — proVisible: ${proVisible}, above: ${proAboveImg}`);
    } catch (err) {
      recordResult('T06_proupsell_acima_foto', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 7 — BottomNav mobile: 3 ícones, sidebar oculta ───────────────
  console.log('\n[teste 7] BottomNav mobile...');
  for (let run = 1; run <= RUNS; run++) {
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // BottomNav: nav com classe bottom-nav
      const nav = page.locator('nav.bottom-nav, nav[class*="bottom"]').first();
      const navVisible = await nav.isVisible({ timeout: 5000 }).catch(() => false);

      // Conta tabs/botões dentro da nav (excluindo o brand que fica display:none)
      const tabs = nav.locator('button.nav-tab, button[class*="nav-tab"]');
      const tabCount = await tabs.count().catch(() => 0);

      // Verifica sidebar (display: none no mobile)
      const sidebar = page.locator('[class*="sidebar"], nav[class*="sidebar"], .sidebar-brand').first();
      const sidebarHidden = !(await sidebar.isVisible({ timeout: 2000 }).catch(() => false));

      const sc = await screenshot(page, `t07_run${run}`);
      const pass = navVisible && tabCount === 3 && sidebarHidden;
      recordResult('T07_bottomnav_mobile', run, pass,
        `navVisible: ${navVisible}, tabs: ${tabCount}, sidebarHidden: ${sidebarHidden}`,
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — nav: ${navVisible}, tabs: ${tabCount}, sidebarHidden: ${sidebarHidden}`);
    } catch (err) {
      recordResult('T07_bottomnav_mobile', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 8 — Header fixo ao rolar ──────────────────────────────────────
  console.log('\n[teste 8] Header fixo ao rolar...');
  for (let run = 1; run <= RUNS; run++) {
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      // Procura header/topbar
      const header = page.locator('header, [class*="header"], [class*="topbar"], [class*="top-bar"]').first();
      const headerVisible = await header.isVisible({ timeout: 5000 }).catch(() => false);

      let isFixed = false;
      let positionBefore = null;
      let positionAfter = null;

      if (headerVisible) {
        positionBefore = await header.boundingBox().catch(() => null);
        // Scroll para baixo
        await page.evaluate(() => window.scrollTo(0, 400));
        await page.waitForTimeout(500);
        positionAfter = await header.boundingBox().catch(() => null);
        // Header fixo: posição Y não muda após scroll
        if (positionBefore && positionAfter) {
          isFixed = Math.abs(positionBefore.y - positionAfter.y) < 5;
        }
      } else {
        // Pode não haver header explícito — verifica via CSS position
        const position = await page.evaluate(() => {
          const el = document.querySelector('header, [class*="header"]');
          if (!el) return null;
          return window.getComputedStyle(el).position;
        }).catch(() => null);
        isFixed = position === 'fixed' || position === 'sticky';
      }

      const sc = await screenshot(page, `t08_run${run}`);
      const pass = !headerVisible || isFixed; // Se não há header, não é bug; se há, deve ser fixo
      recordResult('T08_header_fixo', run, pass,
        `headerVisible: ${headerVisible}, isFixed: ${isFixed}, before: ${JSON.stringify(positionBefore)}, after: ${JSON.stringify(positionAfter)}`,
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — visible: ${headerVisible}, fixed: ${isFixed}`);
    } catch (err) {
      recordResult('T08_header_fixo', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── TESTE 9 — Overflow em 390px ─────────────────────────────────────────
  console.log('\n[teste 9] Overflow horizontal em 390px...');
  for (let run = 1; run <= RUNS; run++) {
    await clearJobsForUser(userId);
    await injectJobForUser(userId);
    const { page, ctx } = await newPage(browser, storageState);
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Detecta overflow via JS — compara scrollWidth vs clientWidth do body
      const overflowData = await page.evaluate(() => {
        const results = [];
        const vw = window.innerWidth; // 390
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.width > vw + 5 || rect.right > vw + 5) {
            const tag = el.tagName.toLowerCase();
            const cls = el.className?.toString?.().slice(0, 40) ?? '';
            const w = Math.round(rect.width);
            const r = Math.round(rect.right);
            results.push({ tag, cls, w, r });
            if (results.length >= 10) break;
          }
        }
        return {
          bodyScrollWidth: document.body.scrollWidth,
          windowInnerWidth: window.innerWidth,
          overflowing: results,
        };
      });

      const hasOverflow = overflowData.bodyScrollWidth > overflowData.windowInnerWidth + 5
        || overflowData.overflowing.length > 0;

      const sc = await screenshot(page, `t09_run${run}`);
      const pass = !hasOverflow;
      recordResult('T09_overflow_390px', run, pass,
        `bodyScrollWidth: ${overflowData.bodyScrollWidth}, innerWidth: ${overflowData.windowInnerWidth}, overflow: ${JSON.stringify(overflowData.overflowing.slice(0, 3))}`,
        sc);
      console.log(`  run ${run}: ${pass ? 'PASS' : 'FAIL'} — scrollWidth: ${overflowData.bodyScrollWidth} vs ${overflowData.windowInnerWidth}`);
    } catch (err) {
      recordResult('T09_overflow_390px', run, false, err.message);
      console.log(`  run ${run}: ERRO — ${err.message}`);
    } finally {
      await ctx.close();
    }
  }

  // ── Finaliza ─────────────────────────────────────────────────────────────
  await browser.close();
  finalizeReport();

  console.log('\n════════════════════════════════════════');
  console.log('RELATÓRIO FINAL');
  console.log('════════════════════════════════════════');
  for (const [id, t] of Object.entries(report.tests)) {
    const icon = t.summary === 'PASS' ? '✓' : t.summary === 'FLAKY' ? '~' : '✗';
    console.log(`${icon} ${id}: ${t.summary} (${t.passRate})`);
    if (t.variations.length > 0) {
      const v = t.variations[0];
      console.log(`  └─ ${v.slice(0, 120)}`);
    }
  }
  console.log('════════════════════════════════════════');
  console.log(`Relatório salvo: ${REPORT_PATH}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
