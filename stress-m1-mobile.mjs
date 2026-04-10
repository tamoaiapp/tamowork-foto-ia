/**
 * Stress Test Mobile M1 — TamoWork Foto IA
 * iPhone 14: 390x844, hasTouch:true, isMobile:true
 * 5 jobs de foto (fundo_branco) + 2 jobs de vídeo
 * Verifica layout mobile: BottomNav, sem sidebar, scroll, header fixo
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_URL = 'https://tamowork.com';
const EMAIL = 'test-stress-m1@tamowork.test';
const PASSWORD = 'StressM1@2026';
const SCREENSHOTS = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m1';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const PRODUCT_IMAGE_URL = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800';

// iPhone 14
const IPHONE14 = {
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  locale: 'pt-BR',
};

// ─── Estado global ─────────────────────────────────────────────────────────────
const report = {
  timestamp: new Date().toISOString(),
  jobs: [],          // { job, tipo, tempo_seg, status, erro }
  checks: [],        // { check, passed, detail }
  errors: [],
  consoleErrors: [],
};

let stepNum = 0;

function log(msg) {
  console.log(`[${new Date().toTimeString().slice(0,8)}] ${msg}`);
}

function addCheck(check, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  report.checks.push({ check, passed, detail });
  log(`${icon} CHECK: ${check}${detail ? ' — ' + detail : ''}`);
}

function addJob(job, tipo, tempo_seg, status, erro = '') {
  report.jobs.push({ job, tipo, tempo_seg, status, erro });
  const icon = status === 'ok' ? '✅' : '❌';
  log(`${icon} JOB #${job} [${tipo}] ${tempo_seg}s — ${status}${erro ? ': ' + erro : ''}`);
}

async function screenshot(page, name) {
  stepNum++;
  const file = path.join(SCREENSHOTS, `${String(stepNum).padStart(2, '0')}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    log(`📸 ${file}`);
  } catch(e) {
    log(`Erro screenshot ${name}: ${e.message}`);
  }
  return file;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────
async function supabaseAdmin(method, urlPath, body) {
  const url = `${SUPABASE_URL}${urlPath}`;
  const opts = {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const response = await fetch(url, opts);
  const text = await response.text();
  try { return { status: response.status, data: JSON.parse(text) }; }
  catch { return { status: response.status, data: text }; }
}

async function setupPro() {
  log('=== Setup PRO via Supabase ===');

  // 1. Criar usuário
  log(`Criando usuário ${EMAIL}...`);
  const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const createData = await createResp.json().catch(() => ({}));

  let userId;
  if (createResp.status === 200 || createResp.status === 201) {
    userId = createData.id;
    log(`✓ Usuário criado: ${userId}`);
  } else if (createResp.status === 422 || createData?.msg?.includes('already') || createData?.message?.includes('already')) {
    log('Usuário já existe — obtendo ID via login...');
    const loginResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const loginData = await loginResp.json().catch(() => ({}));
    if (loginResp.status === 200) {
      userId = loginData.user?.id;
      log(`✓ ID via login: ${userId}`);
    } else {
      // Tentar list users
      log('Tentando listar usuários para encontrar ID...');
      const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const listData = await listResp.json().catch(() => ({ users: [] }));
      const found = listData.users?.find(u => u.email === EMAIL);
      if (found) {
        userId = found.id;
        log(`✓ ID encontrado na lista: ${userId}`);
        // Atualizar senha
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
        });
        log('✓ Senha atualizada');
      } else {
        log('ERRO: Não foi possível encontrar/criar usuário');
        return null;
      }
    }
  } else {
    log(`ERRO ao criar usuário: ${createResp.status} — ${JSON.stringify(createData)}`);
    return null;
  }

  if (!userId) { log('ERRO: userId null'); return null; }

  // 2. Upsert user_plans
  log(`Promovendo ${userId} para PRO...`);
  const periodEnd = new Date('2027-12-31T23:59:59Z').toISOString();

  // Tentar UPSERT via onConflict
  const upsertResp = await supabaseAdmin('POST', '/rest/v1/user_plans?on_conflict=user_id', {
    user_id: userId,
    plan: 'pro',
    period_end: periodEnd,
    mp_subscription_id: 'stress-test-m1',
    updated_at: new Date().toISOString(),
  });

  if (upsertResp.status >= 200 && upsertResp.status < 300) {
    log(`✓ user_plans upsert ok`);
  } else {
    // Fallback: PATCH
    const patchResp = await supabaseAdmin('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
      plan: 'pro',
      period_end: periodEnd,
      updated_at: new Date().toISOString(),
    });
    if (patchResp.status >= 200 && patchResp.status < 300) {
      log(`✓ user_plans PATCH ok`);
    } else {
      log(`AVISO: upsert status=${upsertResp.status}, patch status=${patchResp.status}`);
    }
  }

  return userId;
}

// ─── Login helper ──────────────────────────────────────────────────────────────
async function doLogin(page) {
  log('Navegando para /login...');
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'login-page');

  // Clicar "Usar e-mail e senha"
  try {
    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 10000 });
    await page.tap('text=Usar e-mail e senha');
    await page.waitForTimeout(800);
    log('✓ Clicou "Usar e-mail e senha"');
  } catch {
    log('Botão "Usar e-mail e senha" não encontrado — tentando direto');
  }

  // Aguardar campos
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  } catch {
    log('ERRO: campos de email não apareceram');
    await screenshot(page, 'login-no-fields');
    return false;
  }

  // Clicar na aba "Entrar" se existir
  const entrarTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
  if (await entrarTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await entrarTab.tap();
    await page.waitForTimeout(300);
  }

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await screenshot(page, 'login-form-filled');

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitBtn.tap();
  } else {
    await page.locator('button').filter({ hasText: /^Entrar$/ }).last().tap();
  }

  await page.waitForTimeout(5000);
  await screenshot(page, 'login-after-submit');

  const url = page.url();
  log(`URL após login: ${url}`);

  // Onboarding
  if (url.includes('/onboarding')) {
    log('Onboarding detectado — pulando...');
    await screenshot(page, 'onboarding');
    const skip = page.locator('button').filter({ hasText: /Continuar|Começar|Próximo|Pular/i }).first();
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skip.tap();
      await page.waitForTimeout(1000);
    }
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  const finalUrl = page.url();
  return !finalUrl.includes('/login');
}

// ─── Verificações mobile ──────────────────────────────────────────────────────
async function checkMobileLayout(page, label = '') {
  log(`\n--- Checks mobile layout${label ? ' (' + label + ')' : ''} ---`);

  const bodyText = await page.textContent('body').catch(() => '');

  // 1. BottomNav visível
  const bottomNavSel = [
    '[class*="bottom-nav"]',
    '[class*="bottomNav"]',
    '[class*="BottomNav"]',
    'nav[class*="mobile"]',
    '[data-testid*="bottom"]',
  ];
  let bottomNavFound = false;
  for (const sel of bottomNavSel) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      bottomNavFound = true;
      break;
    }
  }

  // Verificar por conteúdo: "Criar", "Editor", "Criações"
  const hasCriar = bodyText.includes('Criar');
  const hasEditor = bodyText.includes('Editor');
  const hasCriacoes = bodyText.includes('Criações') || bodyText.includes('Cria');
  const bottomNavByContent = hasCriar && hasEditor && hasCriacoes;

  addCheck(`BottomNav visível${label ? ' [' + label + ']' : ''}`, bottomNavFound || bottomNavByContent,
    bottomNavFound ? 'por seletor CSS' : bottomNavByContent ? `Criar=${hasCriar}, Editor=${hasEditor}, Criações=${hasCriacoes}` : 'NÃO encontrado');

  // 2. Sidebar NÃO visível (desktop sidebar)
  const sidebarSel = [
    '[class*="sidebar"]:not([class*="mobile"])',
    '[class*="Sidebar"]:not([class*="mobile"])',
    'aside',
    '[data-testid*="sidebar"]',
  ];
  let sidebarVisible = false;
  for (const sel of sidebarSel) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      const width = await el.evaluate(e => e.getBoundingClientRect().width).catch(() => 0);
      if (width > 50) { // sidebar real tem largura significativa
        sidebarVisible = true;
        log(`  Sidebar encontrada: ${sel} (width=${width}px)`);
        break;
      }
    }
  }
  addCheck(`Sidebar desktop OCULTA${label ? ' [' + label + ']' : ''}`, !sidebarVisible,
    sidebarVisible ? 'PROBLEMA: sidebar visível no mobile' : 'ok — sidebar não visível');

  // 3. Botão PRO não deve aparecer para usuário PRO
  const hasProBtn = bodyText.includes('Liberar agora') || bodyText.includes('R$228') || bodyText.includes('Assinar agora');
  addCheck(`Botão PRO OCULTO (usuário já é PRO)${label ? ' [' + label + ']' : ''}`, !hasProBtn,
    hasProBtn ? 'PROBLEMA: botão de upgrade visível para usuário PRO' : 'ok — sem botão de upgrade');

  return { bottomNavFound: bottomNavFound || bottomNavByContent, sidebarVisible, hasProBtn };
}

async function checkScrollAndHeader(page) {
  log('\n--- Check scroll e header fixo ---');

  // Scroll para baixo
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);

  // Header fixo: deve estar visível após scroll
  const headerSel = ['header', '[class*="header"]', 'nav:first-of-type', '[class*="Header"]'];
  let headerFixed = false;
  for (const sel of headerSel) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      const pos = await el.evaluate(e => getComputedStyle(e).position).catch(() => '');
      if (pos === 'fixed' || pos === 'sticky') {
        headerFixed = true;
        log(`  Header fixo: ${sel} (position: ${pos})`);
        break;
      }
    }
  }
  addCheck('Header fixo no scroll', headerFixed, headerFixed ? 'ok' : 'header não é fixed/sticky');

  // Scroll de volta
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

// ─── Job de foto ───────────────────────────────────────────────────────────────
async function runFotoJob(page, jobNum, productImagePath) {
  log(`\n========== JOB FOTO #${jobNum} ==========`);
  const startTime = Date.now();

  try {
    // Ir para home
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await screenshot(page, `job${jobNum}-home`);

    // Aguardar cards de modo
    log('Aguardando cards de modos...');
    try {
      await page.waitForSelector('text=Usar agora', { timeout: 20000 });
    } catch {
      await page.waitForTimeout(3000);
    }

    const bodyText = await page.textContent('body').catch(() => '');
    const hasFundoBranco = bodyText.includes('Fundo branco');
    log(`Fundo branco visível: ${hasFundoBranco}`);

    // Clicar "Usar agora" do card Fundo branco
    let modeClicked = false;

    // Tentar por texto do card
    const usarBtns = page.locator('button').filter({ hasText: /Usar agora/i });
    const usarCount = await usarBtns.count();
    log(`Botões "Usar agora": ${usarCount}`);

    if (usarCount > 0) {
      // Tentar encontrar o do Fundo branco
      let targetIdx = 0;
      for (let i = 0; i < usarCount; i++) {
        const ctx = await usarBtns.nth(i).evaluate(el => {
          let n = el;
          for (let j = 0; j < 6; j++) {
            if (n.parentElement) n = n.parentElement;
            if (n.textContent?.includes('Fundo branco')) return 'fundo_branco';
          }
          return '';
        }).catch(() => '');
        if (ctx === 'fundo_branco') { targetIdx = i; break; }
      }
      log(`Clicando "Usar agora" idx=${targetIdx}`);
      await usarBtns.nth(targetIdx).tap();
      modeClicked = true;
      await page.waitForTimeout(2000);
    } else {
      // Tentar clicar no card diretamente
      const fundoBrancoBtn = page.locator('text=Fundo branco').first();
      if (await fundoBrancoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fundoBrancoBtn.tap();
        modeClicked = true;
        await page.waitForTimeout(2000);
      }
    }

    log(`URL após modo: ${page.url()}`);
    await screenshot(page, `job${jobNum}-mode-selected`);

    if (!modeClicked) {
      addJob(jobNum, 'foto', Math.round((Date.now() - startTime) / 1000), 'erro', 'Modo não encontrado');
      return false;
    }

    // Upload de foto
    log('Aguardando input de arquivo...');
    let fileInput = page.locator('input[type="file"]').first();
    let fileInputCount = await page.locator('input[type="file"]').count();

    if (fileInputCount === 0) {
      // Tentar clicar em trigger de upload
      const triggers = [
        page.locator('label[for]').first(),
        page.locator('[class*="upload"]').first(),
        page.locator('[class*="drop"]').first(),
      ];
      for (const t of triggers) {
        if (await t.isVisible({ timeout: 1000 }).catch(() => false)) {
          await t.tap();
          await page.waitForTimeout(500);
          fileInputCount = await page.locator('input[type="file"]').count();
          if (fileInputCount > 0) break;
        }
      }
    }

    if (fileInputCount > 0) {
      await fileInput.setInputFiles(productImagePath);
      await page.waitForTimeout(2000);
      log('✓ Arquivo enviado');
    } else {
      await screenshot(page, `job${jobNum}-no-upload`);
      addJob(jobNum, 'foto', Math.round((Date.now() - startTime) / 1000), 'erro', 'Input file não encontrado');
      return false;
    }

    // Campo de produto
    const prodInputSel = [
      'input[placeholder*="bolo"]',
      'input[placeholder*="produto"]',
      'input[placeholder*="artesanal"]',
      'input[placeholder*="Ex:"]',
      'input[placeholder*="Tênis"]',
      'input[type="text"]',
    ];
    for (const sel of prodInputSel) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.fill('Tênis Nike vermelho esportivo');
        log(`Campo produto preenchido: ${sel}`);
        break;
      }
    }

    await screenshot(page, `job${jobNum}-upload-done`);

    // Botão de gerar
    log('Procurando botão de gerar...');
    const genBtn = page.locator('button').filter({ hasText: /Gerar|Transformar|Criar foto|Processar|Enviar/i }).last();

    if (!await genBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await screenshot(page, `job${jobNum}-no-gen-btn`);
      addJob(jobNum, 'foto', Math.round((Date.now() - startTime) / 1000), 'erro', 'Botão gerar não encontrado');
      return false;
    }

    const genText = await genBtn.textContent().catch(() => '');
    log(`Botão gerar: "${genText}"`);
    await genBtn.tap();
    log('Aguardando geração...');
    await screenshot(page, `job${jobNum}-generating`);

    // Aguardar resultado (até 5 min)
    const waitStart = Date.now();
    let resultFound = false;
    let resultText = '';

    while (Date.now() - waitStart < 300000) {
      await page.waitForTimeout(5000);
      const body = await page.textContent('body').catch(() => '');

      if (body.includes('Download') || body.includes('Baixar') || body.includes('Salvar') ||
          body.includes('Criar vídeo') || body.includes('resultado')) {
        resultFound = true;
        resultText = 'Resultado/download encontrado';
        break;
      }
      if (body.includes('Erro') || body.includes('falhou') || body.includes('failed') || body.includes('tente novamente')) {
        resultText = 'Erro na geração detectado';
        break;
      }
      if (body.includes('aguarde') || body.includes('processando') || body.includes('Gerando') || body.includes('%')) {
        log(`  Processando... (${Math.round((Date.now() - waitStart)/1000)}s)`);
      }

      // Screenshot periódico a cada 30s
      if ((Date.now() - waitStart) % 30000 < 5000) {
        await screenshot(page, `job${jobNum}-waiting-${Math.round((Date.now() - waitStart)/1000)}s`);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await screenshot(page, `job${jobNum}-result`);

    if (resultFound) {
      addJob(jobNum, 'foto', elapsed, 'ok', '');
      return true;
    } else {
      addJob(jobNum, 'foto', elapsed, resultText.includes('Erro') ? 'erro' : 'timeout', resultText || 'timeout 5min');
      return false;
    }

  } catch (e) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log(`EXCEÇÃO job ${jobNum}: ${e.message}`);
    await screenshot(page, `job${jobNum}-exception`).catch(() => {});
    addJob(jobNum, 'foto', elapsed, 'erro', e.message.substring(0, 100));
    return false;
  }
}

// ─── Job de vídeo ─────────────────────────────────────────────────────────────
async function runVideoJob(page, jobNum) {
  log(`\n========== JOB VÍDEO #${jobNum} ==========`);
  const startTime = Date.now();

  try {
    // Ir para /editor ou criações para encontrar foto pronta
    await page.goto(`${APP_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await screenshot(page, `video${jobNum}-editor`);

    let urlAfter = page.url();
    log(`URL editor: ${urlAfter}`);

    // Tentar navegar via BottomNav para "Criações"
    const criacoesBtn = page.locator('button, a').filter({ hasText: /Cria[çc]|Galeria|Resultado/i }).first();
    if (await criacoesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await criacoesBtn.tap();
      await page.waitForTimeout(2000);
      await screenshot(page, `video${jobNum}-criacoes`);
    }

    // Procurar botão "Criar vídeo"
    const videoBtn = page.locator('button, a').filter({ hasText: /Criar vídeo|Gerar vídeo|Vídeo/i }).first();
    if (!await videoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Tentar home
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      const videoBtnHome = page.locator('button, a').filter({ hasText: /Criar vídeo|Gerar vídeo/i }).first();
      if (!await videoBtnHome.isVisible({ timeout: 5000 }).catch(() => false)) {
        addJob(jobNum, 'video', Math.round((Date.now() - startTime)/1000), 'skip', 'Botão criar vídeo não encontrado — pode não haver foto pronta');
        return false;
      }
      await videoBtnHome.tap();
    } else {
      await videoBtn.tap();
    }

    await page.waitForTimeout(2000);
    await screenshot(page, `video${jobNum}-video-mode`);

    // Prompt de vídeo
    const promptSel = 'textarea, input[placeholder*="prompt"], input[placeholder*="descri"], input[type="text"]';
    const promptEl = page.locator(promptSel).first();
    if (await promptEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await promptEl.fill('Câmera orbitando o produto lentamente, luz natural suave');
      log('Prompt de vídeo preenchido');
    }

    // Botão gerar vídeo
    const genVideoBtn = page.locator('button').filter({ hasText: /Gerar|Criar|Processar/i }).last();
    if (!await genVideoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      addJob(jobNum, 'video', Math.round((Date.now() - startTime)/1000), 'skip', 'Botão gerar vídeo não encontrado');
      return false;
    }

    await genVideoBtn.tap();
    log('Aguardando vídeo...');
    await screenshot(page, `video${jobNum}-generating`);

    // Aguardar resultado (até 8 min — vídeo demora mais)
    const waitStart = Date.now();
    let resultFound = false;
    let resultText = '';

    while (Date.now() - waitStart < 480000) {
      await page.waitForTimeout(8000);
      const body = await page.textContent('body').catch(() => '');

      if (body.includes('Download') || body.includes('Baixar') || body.includes('mp4') ||
          body.includes('Assistir') || body.includes('video') || body.includes('vídeo pronto')) {
        resultFound = true;
        resultText = 'Vídeo pronto';
        break;
      }
      if (body.includes('Erro') || body.includes('falhou') || body.includes('failed')) {
        resultText = 'Erro na geração de vídeo';
        break;
      }
      log(`  Vídeo processando... (${Math.round((Date.now() - waitStart)/1000)}s)`);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await screenshot(page, `video${jobNum}-result`);

    if (resultFound) {
      addJob(jobNum, 'video', elapsed, 'ok', '');
      return true;
    } else {
      addJob(jobNum, 'video', elapsed, resultText.includes('Erro') ? 'erro' : 'timeout', resultText || 'timeout 8min');
      return false;
    }

  } catch (e) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log(`EXCEÇÃO vídeo ${jobNum}: ${e.message}`);
    await screenshot(page, `video${jobNum}-exception`).catch(() => {});
    addJob(jobNum, 'video', elapsed, 'erro', e.message.substring(0, 100));
    return false;
  }
}

// ─── Verifica BottomNav navigation ────────────────────────────────────────────
async function checkBottomNavNavigation(page) {
  log('\n--- Check navegação BottomNav ---');

  // Tentar clicar nos itens do BottomNav e verificar URL/conteúdo
  const navItems = [
    { label: /Criar/i, expected: '/' },
    { label: /Editor/i, expected: '/editor' },
    { label: /Cria[çc]/i, expected: '/criacoes' },
  ];

  for (const item of navItems) {
    const btn = page.locator('button, a').filter({ hasText: item.label }).last();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.tap();
      await page.waitForTimeout(1500);
      const url = page.url();
      const ok = url.includes(item.expected) || url === APP_URL || url === APP_URL + '/';
      addCheck(`BottomNav "${item.label.source}" navega`, true, `URL: ${url}`);
    } else {
      addCheck(`BottomNav "${item.label.source}" encontrado`, false, 'item não visível');
    }
  }
}

// ─── Check logout/login ───────────────────────────────────────────────────────
async function checkLogoutLogin(page) {
  log('\n--- Check logout e re-login ---');

  // Ir para /conta
  await page.goto(`${APP_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await screenshot(page, 'conta-page');

  const bodyText = await page.textContent('body').catch(() => '');
  const hasLogout = bodyText.includes('Sair') || bodyText.includes('Logout') || bodyText.includes('Desconectar');
  addCheck('Página /conta tem botão logout', hasLogout, hasLogout ? 'ok' : 'botão não encontrado');

  if (hasLogout) {
    const logoutBtn = page.locator('button, a').filter({ hasText: /Sair|Logout|Desconectar/i }).first();
    await logoutBtn.tap();
    await page.waitForTimeout(3000);
    await screenshot(page, 'after-logout');

    const urlAfterLogout = page.url();
    const loggedOut = urlAfterLogout.includes('/login') || urlAfterLogout === APP_URL || urlAfterLogout === APP_URL + '/';
    addCheck('Logout redireciona corretamente', loggedOut, `URL: ${urlAfterLogout}`);

    // Re-login
    const loginOk = await doLogin(page);
    addCheck('Re-login após logout', loginOk, loginOk ? 'ok' : 'falhou');
  }
}

// ─── Relatório final ───────────────────────────────────────────────────────────
function printReport() {
  console.log('\n');
  console.log('════════════════════════════════════════════════════════════');
  console.log('       STRESS TEST MOBILE M1 — RELATÓRIO FINAL');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`\n📱 JOBS DE FOTO (fundo_branco):`);
  console.log('┌──────┬──────────┬──────────────┬─────────┬─────────────────────┐');
  console.log('│ job# │ tipo     │ tempo_seg    │ status  │ erro                │');
  console.log('├──────┼──────────┼──────────────┼─────────┼─────────────────────┤');

  const fotoJobs = report.jobs.filter(j => j.tipo === 'foto');
  const videoJobs = report.jobs.filter(j => j.tipo === 'video');

  for (const j of report.jobs) {
    const job = String(j.job).padEnd(4);
    const tipo = j.tipo.padEnd(8);
    const tempo = String(j.tempo_seg + 's').padEnd(12);
    const status = j.status.padEnd(7);
    const erro = (j.erro || '-').substring(0, 19).padEnd(19);
    const icon = j.status === 'ok' ? '✅' : j.status === 'skip' ? '⏭️' : '❌';
    console.log(`│ ${icon}${job}│ ${tipo}│ ${tempo}│ ${status}│ ${erro}│`);
  }
  console.log('└──────┴──────────┴──────────────┴─────────┴─────────────────────┘');

  if (fotoJobs.length > 0) {
    const okFoto = fotoJobs.filter(j => j.status === 'ok');
    const avgFoto = okFoto.length > 0 ? Math.round(okFoto.reduce((s, j) => s + j.tempo_seg, 0) / okFoto.length) : 0;
    console.log(`\n📊 Média foto: ${avgFoto}s | Sucesso: ${okFoto.length}/${fotoJobs.length}`);
  }
  if (videoJobs.length > 0) {
    const okVideo = videoJobs.filter(j => j.status === 'ok');
    const avgVideo = okVideo.length > 0 ? Math.round(okVideo.reduce((s, j) => s + j.tempo_seg, 0) / okVideo.length) : 0;
    console.log(`📊 Média vídeo: ${avgVideo}s | Sucesso: ${okVideo.length}/${videoJobs.length}`);
  }

  console.log(`\n📱 CHECKS MOBILE ESPECÍFICOS:`);
  for (const c of report.checks) {
    const icon = c.passed ? '✅' : '❌';
    console.log(`  ${icon} ${c.check}${c.detail ? ' — ' + c.detail : ''}`);
  }

  if (report.consoleErrors.length > 0) {
    console.log(`\n⚠️ ERROS DE CONSOLE (${report.consoleErrors.length}):`);
    report.consoleErrors.slice(0, 10).forEach(e => console.log(`  • ${e.substring(0, 120)}`));
  }

  if (report.errors.length > 0) {
    console.log(`\n🔴 ERROS CRÍTICOS:`);
    report.errors.forEach(e => console.log(`  • ${e}`));
  }

  const totalChecks = report.checks.length;
  const passedChecks = report.checks.filter(c => c.passed).length;
  const totalJobs = report.jobs.filter(j => j.status !== 'skip').length;
  const okJobs = report.jobs.filter(j => j.status === 'ok').length;
  console.log(`\n📈 RESUMO: ${passedChecks}/${totalChecks} checks ok | ${okJobs}/${totalJobs} jobs ok`);
  console.log(`📂 Screenshots: ${SCREENSHOTS}`);
  console.log('════════════════════════════════════════════════════════════\n');

  // Salvar JSON
  const reportPath = path.join(SCREENSHOTS, '_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Relatório JSON: ${reportPath}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  log(`Screenshots em: ${SCREENSHOTS}`);

  // Baixar imagem de teste
  const productImagePath = path.join(SCREENSHOTS, 'produto-tenis.jpg');
  if (!fs.existsSync(productImagePath) || fs.statSync(productImagePath).size < 10000) {
    log(`Baixando imagem de produto: ${PRODUCT_IMAGE_URL}`);
    try {
      await downloadFile(PRODUCT_IMAGE_URL, productImagePath);
      log(`✓ Imagem baixada: ${fs.statSync(productImagePath).size} bytes`);
    } catch(e) {
      log(`ERRO ao baixar imagem: ${e.message}`);
      // Usar placeholder local se existir
      const fallback = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d1/produto-tenis.jpg';
      if (fs.existsSync(fallback)) {
        fs.copyFileSync(fallback, productImagePath);
        log(`Usando imagem de fallback: ${fallback}`);
      } else {
        log('AVISO: Sem imagem de produto — uploads podem falhar');
      }
    }
  } else {
    log(`Usando imagem existente: ${fs.statSync(productImagePath).size} bytes`);
  }

  // Setup PRO via Supabase
  const userId = await setupPro();
  if (!userId) {
    log('ERRO CRÍTICO: Não foi possível provisionar conta PRO');
    report.errors.push('Setup PRO falhou');
  } else {
    log(`✓ Setup PRO ok — userId: ${userId}`);
  }

  // Browser mobile
  log('\nIniciando browser mobile (iPhone 14)...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    ...IPHONE14,
  });

  const page = await context.newPage();

  // Capturar erros de console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('analytics')) {
        report.consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    report.errors.push(`JS Error: ${err.message}`);
  });

  try {
    // ── LOGIN INICIAL ──
    log('\n=== LOGIN INICIAL ===');
    const loginOk = await doLogin(page);
    addCheck('Login inicial mobile', loginOk, loginOk ? 'ok' : 'falhou');

    if (!loginOk) {
      log('ERRO: Login falhou — abortando testes');
      report.errors.push('Login inicial falhou');
      await screenshot(page, 'login-failed');
      await browser.close();
      printReport();
      return;
    }
    log('✓ Login ok');

    // ── CHECKS MOBILE INICIAIS ──
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await screenshot(page, 'home-mobile-initial');
    await checkMobileLayout(page, 'home inicial');
    await checkScrollAndHeader(page);

    // ── 5 JOBS DE FOTO ──
    log('\n=== 5 JOBS DE FOTO (fundo_branco) ===');
    for (let i = 1; i <= 5; i++) {
      await runFotoJob(page, i, productImagePath);
      // Checks mobile após cada job
      if (i === 1) {
        await checkMobileLayout(page, `após job foto #${i}`);
      }
      // Pausa entre jobs
      if (i < 5) {
        log('Pausa 3s entre jobs...');
        await page.waitForTimeout(3000);
      }
    }

    // ── CHECKS BOTTOMNAV NAVIGATION ──
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await checkBottomNavNavigation(page);
    await screenshot(page, 'bottomnav-check');

    // ── 2 JOBS DE VÍDEO ──
    log('\n=== 2 JOBS DE VÍDEO ===');
    for (let i = 1; i <= 2; i++) {
      await runVideoJob(page, i);
      if (i < 2) await page.waitForTimeout(3000);
    }

    // ── CHECK LOGOUT/LOGIN ──
    await checkLogoutLogin(page);

    // ── CHECK MOBILE FINAL ──
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await checkMobileLayout(page, 'final');
    await screenshot(page, 'final-home');

  } catch(e) {
    log(`ERRO CRÍTICO: ${e.message}`);
    report.errors.push(`Erro crítico: ${e.message}`);
    await screenshot(page, 'critical-error').catch(() => {});
  } finally {
    await browser.close();
    printReport();
  }
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
