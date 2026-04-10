/**
 * Agente overnight — TamoWork PRO — pro-c2
 * iPhone 14 (390x844), headless:true, PRO, fundo branco
 * 3 iterações: foto → poll → download → vídeo
 *
 * Uso: node agent-pro-c2.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_URL       = 'https://tamowork.com';
const EMAIL         = 'pro-c2@tamowork.test';
const PASSWORD      = 'ProC2@2026';
const SUPABASE_URL  = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const PRODUCT_IMG   = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
const SCREENSHOTS   = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/pro-c2';
const REPORT_PATH   = path.join(SCREENSHOTS, 'report.json');

// iPhone 14
const DEVICE = {
  viewport:          { width: 390, height: 844 },
  userAgent:         'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1',
  isMobile:          true,
  hasTouch:          true,
  deviceScaleFactor: 3,
  locale:            'pt-BR',
};

// Timeouts
const FOTO_TIMEOUT_MS  = 8  * 60 * 1000;   // 8 min
const VIDEO_TIMEOUT_MS = 12 * 60 * 1000;   // 12 min
const POLL_INTERVAL_MS = 10 * 1000;        // 10 s

// ─── Estado do relatório ──────────────────────────────────────────────────────
const report = {
  timestamp:    new Date().toISOString(),
  email:        EMAIL,
  iteracoes:    [],       // { iter, foto: {...}, video: {...} }
  checks_mobile_pro: [],  // { check, passed, detail }
  errors:       [],
};

let stepNum  = 0;
let iterData = null;

// ─── Utilitários ──────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`);
}

function addCheck(check, passed, detail = '') {
  const icon = passed ? '✓' : '✗';
  report.checks_mobile_pro.push({ check, passed, detail });
  log(`${icon} CHECK: ${check}${detail ? ' — ' + detail : ''}`);
}

function saveReport() {
  try {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  } catch (e) {
    log(`Erro ao salvar report: ${e.message}`);
  }
}

async function screenshot(page, name) {
  stepNum++;
  const file = path.join(SCREENSHOTS, `${String(stepNum).padStart(3, '0')}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    log(`[screenshot] ${file}`);
  } catch (e) {
    log(`Erro screenshot ${name}: ${e.message}`);
  }
  return file;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function supaReq(method, urlPath, body = null, extra = {}) {
  const url = `${SUPABASE_URL}${urlPath}`;
  const headers = {
    apikey:          SERVICE_KEY,
    Authorization:   `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    Prefer:          'return=representation',
    ...extra,
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// Poll /api/image-jobs/{id} via fetch (API pública usa token de sessão)
async function pollJobApi(page, jobId, timeoutMs, type = 'foto') {
  const start = Date.now();
  log(`Polling job ${jobId} (${type}, timeout=${timeoutMs / 1000}s)...`);

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const elapsed = Math.round((Date.now() - start) / 1000);

    try {
      // Fazer fetch dentro do contexto da página (usa cookies de sessão)
      const result = await page.evaluate(async (jid) => {
        try {
          const r = await fetch(`/api/image-jobs/${jid}`, { credentials: 'include' });
          if (!r.ok) return { error: `HTTP ${r.status}` };
          const j = await r.json();
          return j;
        } catch (e) {
          return { error: e.message };
        }
      }, jobId);

      if (result?.error) {
        log(`  Poll erro: ${result.error} (${elapsed}s)`);
        // Fallback: checar via Supabase direto
        const sb = await supaReq('GET', `/rest/v1/image_jobs?id=eq.${jobId}&select=status,result_url,video_url`);
        if (sb.status === 200 && Array.isArray(sb.data) && sb.data.length > 0) {
          const job = sb.data[0];
          log(`  Supabase status: ${job.status} (${elapsed}s)`);
          if (job.status === 'completed' || job.status === 'done') return { ok: true, data: job, elapsed };
          if (job.status === 'failed' || job.status === 'error') return { ok: false, status: job.status, elapsed };
        }
        continue;
      }

      const status = result?.status || result?.job?.status || result?.data?.status;
      log(`  status=${status} (${elapsed}s)`);

      if (status === 'completed' || status === 'done' || status === 'success') {
        return { ok: true, data: result, elapsed };
      }
      if (status === 'failed' || status === 'error') {
        return { ok: false, status, elapsed };
      }
    } catch (e) {
      log(`  Poll exceção: ${e.message} (${elapsed}s)`);
    }
  }

  return { ok: false, status: 'timeout', elapsed: Math.round(timeoutMs / 1000) };
}

// ─── Setup PRO ────────────────────────────────────────────────────────────────
async function setupPro() {
  log('=== Setup PRO conta pro-c2 ===');

  // 1. Criar usuário
  const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method:  'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const createData = await createResp.json().catch(() => ({}));

  let userId;
  if (createResp.status === 200 || createResp.status === 201) {
    userId = createData.id;
    log(`Usuário criado: ${userId}`);
  } else {
    // Já existe — buscar via login
    log(`Usuário já existe (status=${createResp.status}) — buscando ID...`);
    const loginResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const loginData = await loginResp.json().catch(() => ({}));
    if (loginResp.status === 200) {
      userId = loginData.user?.id;
      log(`ID via login: ${userId}`);
    } else {
      // Listar via admin
      const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const listData = await listResp.json().catch(() => ({ users: [] }));
      const found = (listData.users || []).find(u => u.email === EMAIL);
      if (found) {
        userId = found.id;
        log(`ID via listagem: ${userId}`);
        // Resetar senha
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method:  'PUT',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ password: PASSWORD, email_confirm: true }),
        });
        log('Senha resetada');
      }
    }
  }

  if (!userId) {
    log('ERRO: não foi possível obter userId');
    return null;
  }

  // 2. Upsert user_plans PRO
  log(`Configurando plano PRO para ${userId}...`);
  const upsertResp = await supaReq(
    'POST',
    '/rest/v1/user_plans?on_conflict=user_id',
    {
      user_id:            userId,
      plan:               'pro',
      period_end:         '2027-12-31T23:59:59Z',
      mp_subscription_id: 'agent-pro-c2-test',
      updated_at:         new Date().toISOString(),
    }
  );
  if (upsertResp.status >= 200 && upsertResp.status < 300) {
    log('Plano PRO configurado (upsert)');
  } else {
    // Fallback PATCH
    const patchResp = await supaReq('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
      plan:       'pro',
      period_end: '2027-12-31T23:59:59Z',
      updated_at: new Date().toISOString(),
    });
    log(`Plano PRO patch status=${patchResp.status}`);
  }

  // 3. Verificar
  const verifyResp = await supaReq('GET', `/rest/v1/user_plans?user_id=eq.${userId}&select=plan,period_end`);
  if (verifyResp.status === 200 && Array.isArray(verifyResp.data) && verifyResp.data.length > 0) {
    log(`Verificado: ${JSON.stringify(verifyResp.data[0])}`);
  } else {
    log(`Verificação falhou: status=${verifyResp.status}`);
  }

  log(`=== Setup PRO ok. userId=${userId} ===`);
  return userId;
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function doLogin(page) {
  log('Navegando para /login...');
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, 'login-page');

  // Botão "Usar e-mail e senha" se existir
  try {
    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 8000 });
    await page.tap('text=Usar e-mail e senha');
    await page.waitForTimeout(800);
  } catch {
    log('Botão "Usar e-mail e senha" não encontrado — prosseguindo');
  }

  // Aguardar campo email
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  } catch {
    await screenshot(page, 'login-no-fields');
    return false;
  }

  // Aba "Entrar" se existir
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

  return !page.url().includes('/login');
}

// ─── Checks mobile PRO ────────────────────────────────────────────────────────
async function checkMobilePro(page, label = '') {
  const suffix = label ? ` [${label}]` : '';
  const bodyText = await page.textContent('body').catch(() => '');

  // Badge PRO no header
  const hasBadgePro = bodyText.includes('PRO') || bodyText.includes('Pro');
  // Tentar encontrar elemento visual de badge
  const badgeEl = page.locator('[class*="pro"], [class*="badge"], [class*="Plan"]').filter({ hasText: /PRO|Pro/ }).first();
  const badgeVisible = await badgeEl.isVisible({ timeout: 2000 }).catch(() => false);
  addCheck(`Badge PRO visível no header${suffix}`, hasBadgePro || badgeVisible,
    badgeVisible ? 'elemento CSS visível' : hasBadgePro ? 'texto "PRO" no body' : 'não encontrado');

  // Botão "Assinar Pro" AUSENTE
  const hasAssinar = bodyText.includes('Assinar Pro') || bodyText.includes('Assinar Agora') || bodyText.includes('Assinar agora');
  addCheck(`Botão "Assinar Pro" AUSENTE${suffix}`, !hasAssinar,
    hasAssinar ? 'PROBLEMA: botão de assinatura visível para usuário PRO' : 'ok');

  // Botão "Liberar agora" AUSENTE
  const hasLiberarAgora = bodyText.includes('Liberar agora');
  addCheck(`Botão "Liberar agora" AUSENTE${suffix}`, !hasLiberarAgora,
    hasLiberarAgora ? 'PROBLEMA: botão de upgrade visível' : 'ok');

  // BottomNav mobile correto
  const bottomNavSels = [
    '[class*="bottom-nav"]', '[class*="bottomNav"]', '[class*="BottomNav"]',
    'nav[class*="mobile"]', '[data-testid*="bottom"]',
  ];
  let bottomNavFound = false;
  for (const sel of bottomNavSels) {
    if (await page.locator(sel).first().isVisible({ timeout: 500 }).catch(() => false)) {
      bottomNavFound = true;
      break;
    }
  }
  const hasCriar    = bodyText.includes('Criar');
  const hasEditor   = bodyText.includes('Editor');
  const hasCriacoes = bodyText.includes('Criações') || bodyText.includes('Cria');
  addCheck(`BottomNav mobile visível${suffix}`, bottomNavFound || (hasCriar && hasEditor && hasCriacoes),
    bottomNavFound ? 'por seletor CSS'
      : (hasCriar && hasEditor && hasCriacoes) ? 'por conteúdo de texto'
      : 'não encontrado');

  return { hasBadgePro: hasBadgePro || badgeVisible, hasAssinar, hasLiberarAgora, bottomNavFound };
}

// ─── Iteração principal ───────────────────────────────────────────────────────
async function runIteracao(page, iter, productImagePath) {
  log(`\n${'='.repeat(60)}`);
  log(`ITERAÇÃO ${iter}`);
  log(`${'='.repeat(60)}`);

  iterData = { iter, foto: null, video: null };

  // ── 1. Login ──────────────────────────────────────────────────────────────
  const loginOk = await doLogin(page);
  addCheck(`Iter ${iter}: Login`, loginOk, loginOk ? `URL: ${page.url()}` : 'falhou');
  if (!loginOk) {
    await screenshot(page, `iter${iter}-login-failed`);
    iterData.foto = { status: 'erro', erro: 'Login falhou', tempo_seg: 0 };
    report.iteracoes.push(iterData);
    saveReport();
    return false;
  }

  await screenshot(page, `iter${iter}-home-logged`);
  await checkMobilePro(page, `iter${iter} home`);

  // ── 2. Fundo branco → upload → produto → Gerar ────────────────────────────
  const fotoStart = Date.now();
  log(`\n--- Iter ${iter}: Selecionando modo Fundo branco ---`);

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Aguardar cards de modo aparecerem
  try {
    await page.waitForSelector('text=Usar agora', { timeout: 20000 });
  } catch {
    log('Cards "Usar agora" não encontrados — tentando continuar');
  }

  await screenshot(page, `iter${iter}-mode-cards`);

  // Clicar no card Fundo branco
  let modeClicked = false;
  const usarBtns = page.locator('button').filter({ hasText: /Usar agora/i });
  const usarCount = await usarBtns.count();
  log(`Botões "Usar agora" encontrados: ${usarCount}`);

  if (usarCount > 0) {
    let targetIdx = 0;
    for (let i = 0; i < usarCount; i++) {
      const ctx = await usarBtns.nth(i).evaluate(el => {
        let n = el;
        for (let j = 0; j < 8; j++) {
          if (n.parentElement) n = n.parentElement;
          if (n.textContent?.includes('Fundo branco')) return 'fundo_branco';
        }
        return '';
      }).catch(() => '');
      if (ctx === 'fundo_branco') { targetIdx = i; break; }
    }
    log(`Clicando "Usar agora" index=${targetIdx} (Fundo branco)`);
    await usarBtns.nth(targetIdx).tap();
    modeClicked = true;
    await page.waitForTimeout(2000);
  } else {
    // Fallback: clicar diretamente no texto
    const fundoEl = page.locator('text=Fundo branco').first();
    if (await fundoEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fundoEl.tap();
      modeClicked = true;
      await page.waitForTimeout(2000);
    }
  }

  log(`Modo clicado: ${modeClicked} | URL: ${page.url()}`);
  await screenshot(page, `iter${iter}-mode-fundo-branco`);

  if (!modeClicked) {
    const elapsed = Math.round((Date.now() - fotoStart) / 1000);
    iterData.foto = { status: 'erro', erro: 'Modo Fundo branco não encontrado', tempo_seg: elapsed };
    report.iteracoes.push(iterData);
    saveReport();
    return false;
  }

  // Upload de arquivo
  log('Aguardando input de arquivo...');
  await page.waitForTimeout(1000);
  let fileInputCount = await page.locator('input[type="file"]').count();

  if (fileInputCount === 0) {
    // Tentar triggers
    for (const sel of ['label[for]', '[class*="upload"]', '[class*="drop"]', '[class*="Upload"]']) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
        await el.tap();
        await page.waitForTimeout(500);
        fileInputCount = await page.locator('input[type="file"]').count();
        if (fileInputCount > 0) break;
      }
    }
  }

  if (fileInputCount > 0) {
    await page.locator('input[type="file"]').first().setInputFiles(productImagePath);
    await page.waitForTimeout(2500);
    log('Arquivo enviado');
  } else {
    const elapsed = Math.round((Date.now() - fotoStart) / 1000);
    await screenshot(page, `iter${iter}-no-upload`);
    iterData.foto = { status: 'erro', erro: 'Input file não encontrado', tempo_seg: elapsed };
    report.iteracoes.push(iterData);
    saveReport();
    return false;
  }

  // Campo de produto
  const prodSelectors = [
    'input[placeholder*="bolo"]', 'input[placeholder*="produto"]',
    'input[placeholder*="artesanal"]', 'input[placeholder*="Ex:"]',
    'input[placeholder*="Tênis"]', 'input[placeholder*="Nike"]',
    'input[type="text"]',
  ];
  for (const sel of prodSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
      await el.fill('Tênis Nike vermelho');
      log(`Campo produto preenchido (${sel})`);
      break;
    }
  }

  await screenshot(page, `iter${iter}-upload-done`);

  // Botão Gerar
  const genBtn = page.locator('button').filter({ hasText: /Gerar|Transformar|Criar foto|Processar|Enviar/i }).last();
  if (!await genBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    const elapsed = Math.round((Date.now() - fotoStart) / 1000);
    await screenshot(page, `iter${iter}-no-gen-btn`);
    iterData.foto = { status: 'erro', erro: 'Botão Gerar não encontrado', tempo_seg: elapsed };
    report.iteracoes.push(iterData);
    saveReport();
    return false;
  }

  log(`Botão Gerar: "${await genBtn.textContent().catch(() => '')}"`);
  await genBtn.tap();
  log('Clicou Gerar — aguardando resposta...');
  await page.waitForTimeout(3000);
  await screenshot(page, `iter${iter}-generating`);

  // ── 3. Extrair job ID e fazer poll ────────────────────────────────────────
  log('Tentando extrair job ID...');
  let jobId = null;

  // Estratégia 1: interceptar requests em background — checar URL atual
  const currentUrl = page.url();
  log(`URL após gerar: ${currentUrl}`);

  // Estratégia 2: buscar no Supabase o job mais recente do usuário
  // (precisamos do userId)
  const loginForId = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginForIdData = await loginForId.json().catch(() => ({}));
  const userId = loginForIdData.user?.id;
  log(`userId para busca: ${userId}`);

  if (userId) {
    // Aguardar até 20s o job aparecer no Supabase
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      const jobsResp = await supaReq('GET', `/rest/v1/image_jobs?user_id=eq.${userId}&order=created_at.desc&limit=1&select=id,status,created_at`);
      if (jobsResp.status === 200 && Array.isArray(jobsResp.data) && jobsResp.data.length > 0) {
        jobId = jobsResp.data[0].id;
        log(`Job ID encontrado no Supabase: ${jobId} (status: ${jobsResp.data[0].status})`);
        break;
      }
      log(`  Aguardando job aparecer no Supabase... (tentativa ${attempt + 1}/4)`);
    }
  }

  // Estratégia 3: extrair do DOM/URL
  if (!jobId) {
    const bodyHtml = await page.content().catch(() => '');
    const uuidMatch = bodyHtml.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      jobId = uuidMatch[0];
      log(`Job ID extraído do HTML: ${jobId}`);
    }
  }

  // ── 4. Poll e aguardar resultado ──────────────────────────────────────────
  let fotoOk = false;
  let fotoPollResult = null;
  let downloadPath = null;

  if (jobId) {
    log(`Iniciando poll do job ${jobId}...`);
    fotoPollResult = await pollJobApi(page, jobId, FOTO_TIMEOUT_MS, 'foto');
    const fotoElapsed = Math.round((Date.now() - fotoStart) / 1000);

    log(`Poll foto resultado: ok=${fotoPollResult.ok}, elapsed=${fotoElapsed}s`);
    await screenshot(page, `iter${iter}-result`);

    if (fotoPollResult.ok) {
      fotoOk = true;
      iterData.foto = { status: 'ok', tempo_seg: fotoElapsed, job_id: jobId };

      // Tentar download
      const bodyText = await page.textContent('body').catch(() => '');
      const hasDownload = bodyText.includes('Download') || bodyText.includes('Baixar') || bodyText.includes('Salvar');
      addCheck(`Iter ${iter}: Download disponível`, hasDownload, hasDownload ? 'botão encontrado no body' : 'botão não detectado');

      // Procurar URL de imagem resultado
      const resultUrl = fotoPollResult.data?.result_url || fotoPollResult.data?.job?.result_url
        || fotoPollResult.data?.data?.result_url;
      if (resultUrl) {
        const destFile = path.join(SCREENSHOTS, `iter${iter}-resultado-download.jpg`);
        try {
          await downloadFile(resultUrl, destFile);
          log(`Download salvo: ${destFile}`);
          iterData.foto.download_path = destFile;
          addCheck(`Iter ${iter}: Download realizado`, true, destFile);
        } catch (e) {
          log(`Erro download: ${e.message}`);
          addCheck(`Iter ${iter}: Download realizado`, false, e.message);
        }
      } else {
        // Tentar clicar botão download na página
        const dlBtn = page.locator('a, button').filter({ hasText: /Download|Baixar|Salvar/i }).first();
        if (await dlBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          log('Clicando botão download...');
          await dlBtn.tap();
          await page.waitForTimeout(2000);
          addCheck(`Iter ${iter}: Botão download clicado`, true, 'ok');
        }
      }
    } else {
      iterData.foto = { status: fotoPollResult.status, erro: `Poll status: ${fotoPollResult.status}`, tempo_seg: Math.round((Date.now() - fotoStart) / 1000), job_id: jobId };
      addCheck(`Iter ${iter}: Foto gerada`, false, `status=${fotoPollResult.status}`);
    }
  } else {
    // Sem jobId — verificar pelo conteúdo da página
    log('Job ID não encontrado — verificando resultado na página...');
    const waitStart = Date.now();
    let resultFound = false;

    while (Date.now() - waitStart < FOTO_TIMEOUT_MS) {
      await page.waitForTimeout(10000);
      const body = await page.textContent('body').catch(() => '');
      const elapsed = Math.round((Date.now() - waitStart) / 1000);

      if (body.includes('Download') || body.includes('Baixar') || body.includes('Salvar') || body.includes('Criar vídeo')) {
        resultFound = true;
        log(`Resultado detectado na página (${elapsed}s)`);
        break;
      }
      if (body.includes('Erro') || body.includes('falhou') || body.includes('failed')) {
        log(`Erro detectado na página (${elapsed}s)`);
        break;
      }
      log(`  Aguardando resultado na página... (${elapsed}s)`);

      if (elapsed % 30 < 12) await screenshot(page, `iter${iter}-wait-${elapsed}s`);
    }

    const fotoElapsed = Math.round((Date.now() - fotoStart) / 1000);
    await screenshot(page, `iter${iter}-result-page`);
    fotoOk = resultFound;
    iterData.foto = { status: resultFound ? 'ok' : 'timeout', tempo_seg: fotoElapsed };
    addCheck(`Iter ${iter}: Foto detectada na página`, resultFound, resultFound ? 'ok' : `timeout ${fotoElapsed}s`);
  }

  addCheck(`Iter ${iter}: Foto gerada`, fotoOk, fotoOk ? `${iterData.foto.tempo_seg}s` : (iterData.foto.erro || 'falhou'));

  // ── 5. Botão vídeo DISPONÍVEL (PRO) e criar vídeo ─────────────────────────
  log(`\n--- Iter ${iter}: Verificando botão de vídeo (PRO) ---`);
  const bodyAfterFoto = await page.textContent('body').catch(() => '');
  const hasCriarVideo = bodyAfterFoto.includes('Criar vídeo') || bodyAfterFoto.includes('Gerar vídeo');
  addCheck(`Iter ${iter}: Botão "Criar vídeo" DISPONÍVEL (PRO)`, hasCriarVideo,
    hasCriarVideo ? 'ok — botão presente' : 'botão não encontrado (pode estar em outra tela)');

  // Criar vídeo se foto ok
  const videoStart = Date.now();
  if (fotoOk) {
    log(`\n--- Iter ${iter}: Criando vídeo ---`);

    let videoBtn = page.locator('button, a').filter({ hasText: /Criar vídeo|Gerar vídeo/i }).first();
    if (!await videoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Tentar navegar para criações
      const criacoesBtn = page.locator('button, a').filter({ hasText: /Cria[çc]|Galeria/i }).first();
      if (await criacoesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await criacoesBtn.tap();
        await page.waitForTimeout(2000);
      }
      videoBtn = page.locator('button, a').filter({ hasText: /Criar vídeo|Gerar vídeo/i }).first();
    }

    if (await videoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await videoBtn.tap();
      await page.waitForTimeout(2000);
      await screenshot(page, `iter${iter}-video-mode`);

      // Prompt de vídeo
      const promptEl = page.locator('textarea, input[placeholder*="prompt"], input[placeholder*="descri"]').first();
      if (await promptEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await promptEl.fill('produto flutuando levemente');
        log('Prompt de vídeo preenchido: "produto flutuando levemente"');
      }

      // Gerar vídeo
      const genVideoBtn = page.locator('button').filter({ hasText: /Gerar|Criar|Processar/i }).last();
      if (await genVideoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await genVideoBtn.tap();
        log('Aguardando vídeo...');
        await screenshot(page, `iter${iter}-video-generating`);

        // Poll vídeo por job ID
        let videoJobId = jobId; // mesmo job, pode ter video_url adicionada
        let videoResult = null;

        // Buscar novo job de vídeo no Supabase
        if (userId) {
          await new Promise(r => setTimeout(r, 8000));
          const vjResp = await supaReq('GET', `/rest/v1/image_jobs?user_id=eq.${userId}&order=created_at.desc&limit=1&select=id,status,created_at,video_url`);
          if (vjResp.status === 200 && Array.isArray(vjResp.data) && vjResp.data.length > 0) {
            const latestJob = vjResp.data[0];
            // Se tem video_url ou é um job diferente, usar esse
            if (latestJob.video_url || latestJob.id !== jobId) {
              videoJobId = latestJob.id;
              log(`Job vídeo: ${videoJobId}`);
            }
          }
        }

        // Poll com page-based verificação
        const videoWaitStart = Date.now();
        let videoFound = false;

        while (Date.now() - videoWaitStart < VIDEO_TIMEOUT_MS) {
          await new Promise(r => setTimeout(r, 10000));
          const elapsed = Math.round((Date.now() - videoWaitStart) / 1000);

          const body = await page.textContent('body').catch(() => '');
          if (body.includes('mp4') || body.includes('Assistir') || body.includes('vídeo pronto') ||
              body.includes('Download') && body.includes('vídeo')) {
            videoFound = true;
            log(`Vídeo pronto (${elapsed}s)`);
            break;
          }
          if (body.includes('Erro') || body.includes('falhou') || body.includes('failed')) {
            log(`Erro no vídeo (${elapsed}s)`);
            break;
          }

          // Check Supabase
          if (videoJobId && userId) {
            const sbResp = await supaReq('GET', `/rest/v1/image_jobs?id=eq.${videoJobId}&select=status,video_url`);
            if (sbResp.status === 200 && Array.isArray(sbResp.data) && sbResp.data.length > 0) {
              const j = sbResp.data[0];
              log(`  Supabase video status=${j.status} video_url=${j.video_url ? 'sim' : 'não'} (${elapsed}s)`);
              if (j.video_url || j.status === 'completed') {
                videoFound = true;
                break;
              }
              if (j.status === 'failed' || j.status === 'error') break;
            }
          }

          log(`  Vídeo processando... (${elapsed}s)`);
          if (elapsed % 60 < 12) await screenshot(page, `iter${iter}-video-wait-${elapsed}s`);
        }

        const videoElapsed = Math.round((Date.now() - videoStart) / 1000);
        await screenshot(page, `iter${iter}-video-result`);
        iterData.video = { status: videoFound ? 'ok' : 'timeout', tempo_seg: videoElapsed, job_id: videoJobId };
        addCheck(`Iter ${iter}: Vídeo gerado`, videoFound, videoFound ? `${videoElapsed}s` : `timeout ${videoElapsed}s`);
      } else {
        iterData.video = { status: 'skip', erro: 'Botão gerar vídeo não encontrado', tempo_seg: 0 };
        addCheck(`Iter ${iter}: Botão gerar vídeo`, false, 'não encontrado');
      }
    } else {
      iterData.video = { status: 'skip', erro: 'Botão Criar vídeo não disponível', tempo_seg: 0 };
      addCheck(`Iter ${iter}: Botão Criar vídeo acessível`, false, 'não disponível');
    }
  } else {
    iterData.video = { status: 'skip', erro: 'Foto não gerada — vídeo pulado', tempo_seg: 0 };
    log('Vídeo pulado (foto não gerada)');
  }

  report.iteracoes.push(iterData);
  saveReport();

  log(`\n--- Iter ${iter} concluída ---`);
  log(`  Foto: ${iterData.foto?.status} (${iterData.foto?.tempo_seg}s)`);
  log(`  Vídeo: ${iterData.video?.status} (${iterData.video?.tempo_seg}s)`);
  return fotoOk;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('=== Agente overnight PRO-C2 iniciando ===');
  log(`Screenshots: ${SCREENSHOTS}`);
  log(`Report: ${REPORT_PATH}`);

  // Garantir diretório de screenshots
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // Setup PRO via Supabase
  const userId = await setupPro();
  report.setup = { userId, email: EMAIL, plan: 'pro', period_end: '2027-12-31' };
  addCheck('Setup PRO via Supabase', !!userId, userId || 'userId nulo');
  saveReport();

  // Download da imagem do produto
  const productImagePath = path.join(SCREENSHOTS, 'product.jpg');
  log(`Baixando imagem do produto: ${PRODUCT_IMG}`);
  try {
    await downloadFile(PRODUCT_IMG, productImagePath);
    log(`Imagem salva: ${productImagePath}`);
  } catch (e) {
    log(`Erro download imagem produto: ${e.message} — usando placeholder`);
    // Criar imagem placeholder simples (1x1 JPEG)
    const placeholder = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
      'base64'
    );
    fs.writeFileSync(productImagePath, placeholder);
  }

  // Lançar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport:          DEVICE.viewport,
    userAgent:         DEVICE.userAgent,
    isMobile:          DEVICE.isMobile,
    hasTouch:          DEVICE.hasTouch,
    deviceScaleFactor: DEVICE.deviceScaleFactor,
    locale:            DEVICE.locale,
  });

  // Capturar erros de console
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('net::ERR')) {
        report.errors.push({ type: 'console_error', text: text.substring(0, 200) });
      }
    }
  });
  page.on('pageerror', err => {
    report.errors.push({ type: 'page_error', text: err.message.substring(0, 200) });
  });

  try {
    // 3 iterações
    for (let iter = 1; iter <= 3; iter++) {
      try {
        await runIteracao(page, iter, productImagePath);
      } catch (e) {
        log(`EXCEÇÃO na iteração ${iter}: ${e.message}`);
        report.errors.push({ iter, error: e.message });
        if (iterData && !report.iteracoes.find(i => i.iter === iter)) {
          iterData.foto = iterData.foto || { status: 'erro', erro: e.message, tempo_seg: 0 };
          iterData.video = iterData.video || { status: 'skip', tempo_seg: 0 };
          report.iteracoes.push(iterData);
        }
        await screenshot(page, `iter${iter}-exception`).catch(() => {});
        saveReport();
      }

      // Pausa entre iterações (exceto na última)
      if (iter < 3) {
        log(`\nAguardando 10s entre iterações...`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    // Checks finais de mobile PRO
    log('\n=== Checks finais mobile PRO ===');
    try {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await screenshot(page, 'final-home');
      await checkMobilePro(page, 'final');
    } catch (e) {
      log(`Erro checks finais: ${e.message}`);
    }

  } finally {
    await browser.close();
  }

  // ── Relatório final ───────────────────────────────────────────────────────
  report.completed_at = new Date().toISOString();

  const totalFotos  = report.iteracoes.filter(i => i.foto?.status === 'ok').length;
  const totalVideos = report.iteracoes.filter(i => i.video?.status === 'ok').length;
  const checksOk    = report.checks_mobile_pro.filter(c => c.passed).length;
  const checksTotal = report.checks_mobile_pro.length;

  report.summary = {
    iteracoes_total:  3,
    fotos_ok:         totalFotos,
    videos_ok:        totalVideos,
    checks_ok:        checksOk,
    checks_total:     checksTotal,
    checks_pct:       checksTotal > 0 ? Math.round((checksOk / checksTotal) * 100) : 0,
    errors:           report.errors.length,
  };

  saveReport();

  // Exibir resumo
  log('\n' + '='.repeat(60));
  log('RESUMO FINAL');
  log('='.repeat(60));
  log(`Fotos ok:   ${totalFotos}/3`);
  log(`Vídeos ok:  ${totalVideos}/3`);
  log(`Checks:     ${checksOk}/${checksTotal} (${report.summary.checks_pct}%)`);
  log(`Erros:      ${report.errors.length}`);
  log('');
  log('Iterações:');
  for (const it of report.iteracoes) {
    log(`  Iter ${it.iter}: foto=${it.foto?.status}(${it.foto?.tempo_seg}s) | video=${it.video?.status}(${it.video?.tempo_seg}s)`);
  }
  log('');
  log('Checks mobile PRO:');
  for (const c of report.checks_mobile_pro) {
    log(`  ${c.passed ? '✓' : '✗'} ${c.check}`);
  }
  log(`\nReport: ${REPORT_PATH}`);
  log('='.repeat(60));
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
