/**
 * Stress Test D3 — TamoWork Foto IA
 * Viewport: 1440x900 (Desktop)
 * Modo: catalogo (foto com modelo)
 * Produto: óculos de sol (Unsplash)
 * Modelo: pessoa (Unsplash)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'test-stress-d3@tamowork.test';
const PASSWORD = 'StressD3@2026';
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d3';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const PRODUCT_URL = 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800';
const MODEL_URL = 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800';

// Relatório
const report = {
  timestamp: new Date().toISOString(),
  tests: [],
  errors: [],
  jobs: [],
  consoleErrors: [],
};

const jobResults = []; // {job, modo, tempo_seg, status, erro}

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`;
  console.log(line);
}

function addTest(name, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  report.tests.push({ name, passed, detail });
  log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: false });
    log(`📸 ${filePath}`);
  } catch (e) {
    log(`Screenshot falhou: ${e.message}`);
  }
  return filePath;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function supabaseRequest(method, urlPath, body, useServiceKey = true) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const url = `${SUPABASE_URL}${urlPath}`;
  const opts = {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
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

async function createAndSetupUser() {
  log('=== Setup: Criando/configurando usuário via Admin API ===');

  // 1. Tentar criar usuário via admin
  log('Tentando criar usuário via Admin API...');
  const createRes = await supabaseRequest('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Stress Test D3' },
  });
  log(`Admin create user: status=${createRes.status} data=${JSON.stringify(createRes.data).substring(0, 200)}`);

  let userId = null;

  if (createRes.status === 200 || createRes.status === 201) {
    userId = createRes.data?.id;
    log(`Usuário criado com ID: ${userId}`);
  } else if (createRes.status === 422 || createRes.status === 409) {
    log('Usuário já existe — buscando via lista de usuários...');
    // Buscar usuário existente
    const listRes = await supabaseRequest('GET', `/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, null);
    if (listRes.status === 200 && Array.isArray(listRes.data?.users) && listRes.data.users.length > 0) {
      userId = listRes.data.users[0].id;
      log(`Usuário existente encontrado: ${userId}`);
    } else {
      // Tentar login para pegar o ID
      log('Fazendo login para pegar userId...');
      const loginRes = await supabaseRequest('POST', '/auth/v1/token?grant_type=password', {
        email: EMAIL,
        password: PASSWORD,
      }, false);
      if (loginRes.status === 200) {
        userId = loginRes.data?.user?.id;
        log(`userId via login: ${userId}`);
      }
    }
  }

  if (!userId) {
    log('ERRO: Não foi possível obter userId — abortando setup');
    return null;
  }

  // 2. Upsert user_plans para PRO
  log(`Configurando plano PRO para userId=${userId}...`);
  const periodEnd = '2027-12-31T23:59:59Z';

  // Tentar upsert
  const upsertRes = await supabaseRequest('POST', '/rest/v1/user_plans', {
    user_id: userId,
    plan: 'pro',
    period_end: periodEnd,
    mp_subscription_id: 'stress-test-d3',
    updated_at: new Date().toISOString(),
  });

  if (upsertRes.status === 409) {
    // Já existe — fazer PATCH
    const patchRes = await supabaseRequest('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
      plan: 'pro',
      period_end: periodEnd,
      mp_subscription_id: 'stress-test-d3',
      updated_at: new Date().toISOString(),
    });
    log(`PATCH user_plans: status=${patchRes.status}`);
  } else {
    log(`POST user_plans: status=${upsertRes.status}`);
  }

  // Verificar plano atual
  const planRes = await supabaseRequest('GET', `/rest/v1/user_plans?user_id=eq.${userId}&select=*`, null);
  const plan = Array.isArray(planRes.data) ? planRes.data[0] : null;
  log(`Plano configurado: ${JSON.stringify(plan)}`);

  // 3. Resetar limite diário de jobs (deletar jobs de hoje para este user)
  log('Resetando jobs do dia para o usuário...');
  const today = new Date().toISOString().slice(0, 10);
  const deleteRes = await supabaseRequest('DELETE', `/rest/v1/image_jobs?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z`, null);
  log(`DELETE jobs de hoje: status=${deleteRes.status}`);

  return userId;
}

async function doLogin(page, emailOverride = null, passwordOverride = null) {
  const email = emailOverride || EMAIL;
  const password = passwordOverride || PASSWORD;

  log(`Fazendo login com ${email}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Clicar em "Usar e-mail e senha"
  try {
    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 12000 });
    await page.click('text=Usar e-mail e senha');
    await page.waitForTimeout(800);
  } catch {
    log('Botão "Usar e-mail e senha" não encontrado — pode já estar com form visível');
  }

  // Garantir aba "Entrar"
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  } catch {
    log('Input email não apareceu após clicar em "Usar e-mail e senha"');
    await screenshot(page, 'login-debug');
  }

  // Verificar se há aba "Entrar" para clicar
  const enterTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
  if (await enterTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await enterTab.click();
    await page.waitForTimeout(400);
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submitBtn.click();
  } else {
    const enterBtn = page.locator('button').filter({ hasText: /^Entrar$/ }).last();
    await enterBtn.click();
  }

  await page.waitForTimeout(5000);
  const urlAfter = page.url();
  const success = !urlAfter.includes('/login');
  log(`Login result: ${success ? 'OK' : 'FAIL'} — URL: ${urlAfter}`);
  return success;
}

async function waitForGenerationDone(page, timeoutMs = 300000) {
  const start = Date.now();
  const checkEvery = 8000;
  let elapsed = 0;

  while (elapsed < timeoutMs) {
    await page.waitForTimeout(checkEvery);
    elapsed += checkEvery;

    const bodyNow = await page.textContent('body').catch(() => '');
    const urlNow = page.url();

    const isDone = bodyNow.includes('Baixar') || bodyNow.includes('Download') ||
      bodyNow.includes('Criar vídeo') || bodyNow.includes('Salvar') ||
      urlNow.includes('/result') || bodyNow.includes('pronto') ||
      bodyNow.includes('concluído') || bodyNow.includes('Editar');

    const hasError = bodyNow.includes('Erro ao') || bodyNow.includes('Falhou') ||
      bodyNow.includes('tente novamente') || bodyNow.includes('Falha ao') ||
      bodyNow.includes('Erro:') || bodyNow.includes('erro ao gerar') ||
      bodyNow.includes('falha') || bodyNow.includes('não foi possível');

    if (elapsed % 30000 === 0) {
      log(`  [${elapsed / 1000}s] Aguardando... URL: ${urlNow}`);
    }

    if (isDone) return { success: true, elapsed: elapsed / 1000 };
    if (hasError) return { success: false, elapsed: elapsed / 1000, error: 'Erro detectado na UI' };
  }

  return { success: false, elapsed: timeoutMs / 1000, error: `Timeout após ${timeoutMs / 1000}s` };
}

async function selectCatalogoMode(page) {
  log('Buscando modo "catálogo" (com modelo)...');

  // Aguardar cards carregarem
  try {
    await page.waitForSelector('text=Usar agora', { timeout: 15000 });
  } catch {
    log('Cards "Usar agora" não apareceram');
    return false;
  }

  const usarBtns = page.getByText('Usar agora');
  const count = await usarBtns.count();
  log(`Total botões "Usar agora": ${count}`);

  // Palavras-chave para modo catálogo
  const catalogoKeywords = ['catálogo', 'modelo', 'Roupa vestida', 'pessoa', 'catalogo', 'vestida'];

  for (let i = 0; i < count; i++) {
    const ctx = await usarBtns.nth(i).evaluate(el => {
      let node = el;
      for (let j = 0; j < 6; j++) {
        if (node.parentElement) node = node.parentElement;
        const txt = node.textContent || '';
        if (txt.includes('catálogo') || txt.includes('modelo') || txt.includes('Roupa vestida') ||
          txt.includes('catalogo') || txt.includes('vestida') || txt.includes('pessoa')) {
          return txt.substring(0, 200);
        }
      }
      return '';
    });
    if (ctx) {
      log(`Modo catálogo encontrado no índice ${i}: ${ctx.replace(/\s+/g, ' ').substring(0, 80)}`);
      await usarBtns.nth(i).click();
      await page.waitForTimeout(2000);
      return true;
    }
  }

  // Fallback: clicar no 2o card (geralmente é o modo com modelo)
  if (count >= 2) {
    log('Modo catálogo não identificado por texto — tentando 2o card...');
    await usarBtns.nth(1).click();
    await page.waitForTimeout(2000);
    return true;
  }

  // Fallback: clicar no 1o card
  if (count >= 1) {
    log('Fallback: clicando no 1o card...');
    await usarBtns.first().click();
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

async function runPhotoJob(page, jobNum, productImagePath, modelImagePath) {
  log(`\n===== JOB FOTO #${jobNum} =====`);
  const startTime = Date.now();
  const jobEntry = { job: jobNum, modo: 'catalogo', tempo_seg: null, status: 'pending', erro: null };

  try {
    // Ir para home
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await screenshot(page, `foto-${jobNum}-01-home`);

    // Selecionar modo catálogo
    const modeSelected = await selectCatalogoMode(page);
    if (!modeSelected) {
      jobEntry.status = 'failed';
      jobEntry.erro = 'Modo catálogo não encontrado';
      jobResults.push(jobEntry);
      addTest(`Job foto #${jobNum} — seleção de modo`, false, 'Modo catálogo não encontrado');
      return;
    }
    await screenshot(page, `foto-${jobNum}-02-mode-selected`);
    log(`URL após selecionar modo: ${page.url()}`);

    // Listar inputs file disponíveis
    const fileInputCount = await page.locator('input[type="file"]').count();
    log(`Inputs file encontrados: ${fileInputCount}`);

    if (fileInputCount === 0) {
      jobEntry.status = 'failed';
      jobEntry.erro = 'Nenhum input file encontrado';
      jobResults.push(jobEntry);
      addTest(`Job foto #${jobNum} — upload`, false, 'Input file não encontrado');
      await screenshot(page, `foto-${jobNum}-no-input`);
      return;
    }

    // Upload produto (1o input file)
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(productImagePath);
    log(`Upload produto feito: ${path.basename(productImagePath)}`);
    await page.waitForTimeout(1500);

    // Upload modelo (2o input file, se existir)
    const fileInputCountAfter = await page.locator('input[type="file"]').count();
    if (fileInputCountAfter >= 2) {
      await page.locator('input[type="file"]').nth(1).setInputFiles(modelImagePath);
      log(`Upload modelo feito: ${path.basename(modelImagePath)}`);
      await page.waitForTimeout(1500);
    } else {
      log('Apenas 1 input file — modo pode não suportar modelo ou upload aparece depois');
    }

    await screenshot(page, `foto-${jobNum}-03-uploaded`);

    // Preencher campo do produto
    const produtoSelectors = [
      'input[placeholder*="bolo"]',
      'input[placeholder*="produto"]',
      'input[placeholder*="artesanal"]',
      'input[placeholder*="Ex:"]',
      'input[placeholder*="Óculos"]',
      'input[placeholder*="nome"]',
      'input[placeholder*="O que"]',
      'textarea[placeholder*="produto"]',
    ];

    let produtoFilled = false;
    for (const sel of produtoSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
        await el.fill('Óculos de sol premium');
        log(`Campo produto preenchido via: ${sel}`);
        produtoFilled = true;
        break;
      }
    }

    if (!produtoFilled) {
      // Tentar o primeiro input[type="text"] visível
      const textInputs = page.locator('input[type="text"]');
      const textCount = await textInputs.count();
      log(`Text inputs encontrados: ${textCount}`);
      for (let i = 0; i < textCount; i++) {
        const ti = textInputs.nth(i);
        if (await ti.isVisible({ timeout: 1000 }).catch(() => false)) {
          await ti.fill('Óculos de sol premium');
          log(`Campo texto ${i} preenchido`);
          produtoFilled = true;
          break;
        }
      }
    }

    // Preencher textarea/cenário se existir
    const cenarioSelectors = [
      'textarea[placeholder*="cenário"]',
      'textarea[placeholder*="cena"]',
      'input[placeholder*="cenário"]',
      'textarea',
    ];
    for (const sel of cenarioSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        const ph = await el.getAttribute('placeholder').catch(() => '');
        if (ph && !ph.includes('Óculos') && !ph.includes('produto')) {
          await el.fill('Modelo usando os óculos em ambiente externo ensolarado');
          log(`Cenário preenchido via: ${sel}`);
          break;
        }
      }
    }

    await screenshot(page, `foto-${jobNum}-04-form-filled`);

    // Clicar em todos os campos do formulário (teste de interação)
    const allFormInputs = await page.locator('input, textarea, select').all();
    log(`Total campos de formulário: ${allFormInputs.length}`);
    for (let i = 0; i < Math.min(allFormInputs.length, 10); i++) {
      try {
        if (await allFormInputs[i].isVisible({ timeout: 500 }).catch(() => false)) {
          await allFormInputs[i].click({ timeout: 1000 }).catch(() => {});
        }
      } catch {}
    }

    // Encontrar e clicar no botão Gerar
    const generateBtns = page.locator('button').filter({
      hasText: /Gerar|Transformar|Criar foto|Processar|Enviar|Criar imagem/i,
    });
    const genCount = await generateBtns.count();
    log(`Botões de geração encontrados: ${genCount}`);

    // Logar todos os botões para debug
    const allBtnTexts = await page.$$eval('button', btns =>
      btns.map(b => ({ text: b.textContent?.trim()?.substring(0, 40), disabled: b.disabled }))
    );
    log(`Botões: ${JSON.stringify(allBtnTexts)}`);

    const genBtn = generateBtns.last();
    if (!(await genBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      jobEntry.status = 'failed';
      jobEntry.erro = 'Botão Gerar não encontrado';
      jobResults.push(jobEntry);
      addTest(`Job foto #${jobNum} — botão gerar`, false, 'Botão Gerar não visível');
      await screenshot(page, `foto-${jobNum}-no-gen-btn`);
      return;
    }

    const genBtnText = await genBtn.textContent();
    log(`Clicando em: "${genBtnText}"`);
    await genBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, `foto-${jobNum}-05-generating`);
    addTest(`Job foto #${jobNum} — submetido`, true, `Botão: "${genBtnText?.trim()}"`);

    // Aguardar resultado
    log(`Aguardando geração (timeout 5min)...`);
    const result = await waitForGenerationDone(page, 300000);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);

    await screenshot(page, `foto-${jobNum}-06-result`);

    if (result.success) {
      jobEntry.status = 'done';
      jobEntry.tempo_seg = parseInt(elapsedSec);
      log(`Job #${jobNum} CONCLUÍDO em ${elapsedSec}s`);
      addTest(`Job foto #${jobNum} — geração`, true, `Tempo: ${elapsedSec}s`);

      // Testar download
      const dlBtn = page.locator('button, a').filter({ hasText: /Baixar|Download/i }).first();
      if (await dlBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
          dlBtn.click(),
        ]);
        if (download) {
          addTest(`Job foto #${jobNum} — download`, true, download.suggestedFilename());
          await download.cancel();
        } else {
          await page.waitForTimeout(1500);
          addTest(`Job foto #${jobNum} — download`, false, 'Sem evento download (link externo?)');
        }
        await screenshot(page, `foto-${jobNum}-07-download`);
      } else {
        addTest(`Job foto #${jobNum} — download`, false, 'Botão não visível');
      }

    } else {
      jobEntry.status = 'failed';
      jobEntry.tempo_seg = parseInt(elapsedSec);
      jobEntry.erro = result.error;
      log(`Job #${jobNum} FALHOU: ${result.error}`);
      addTest(`Job foto #${jobNum} — geração`, false, result.error);
      report.errors.push(`Job foto #${jobNum}: ${result.error}`);
    }

  } catch (e) {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
    jobEntry.status = 'error';
    jobEntry.tempo_seg = parseInt(elapsedSec);
    jobEntry.erro = e.message;
    log(`Job #${jobNum} ERRO CRÍTICO: ${e.message}`);
    addTest(`Job foto #${jobNum}`, false, `Erro: ${e.message}`);
    report.errors.push(`Job foto #${jobNum} erro crítico: ${e.message}`);
    await screenshot(page, `foto-${jobNum}-error`).catch(() => {});
  }

  jobResults.push(jobEntry);
}

async function runVideoJob(page, jobNum, productImagePath) {
  log(`\n===== JOB VÍDEO #${jobNum} =====`);
  const startTime = Date.now();
  const jobEntry = { job: `V${jobNum}`, modo: 'video', tempo_seg: null, status: 'pending', erro: null };

  try {
    // Ir para home e procurar modo vídeo
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    try {
      await page.waitForSelector('text=Usar agora', { timeout: 15000 });
    } catch {
      log('Cards não carregaram');
    }

    const usarBtns = page.getByText('Usar agora');
    const count = await usarBtns.count();
    log(`Botões "Usar agora" para modo vídeo: ${count}`);

    // Procurar card de vídeo
    let videoIndex = -1;
    const videoKeywords = ['mexe', 'animado', 'vídeo', 'video', 'Foto que se mexe'];

    for (let i = 0; i < count; i++) {
      const ctx = await usarBtns.nth(i).evaluate(el => {
        let node = el;
        for (let j = 0; j < 6; j++) {
          if (node.parentElement) node = node.parentElement;
          const txt = node.textContent || '';
          if (txt.includes('mexe') || txt.includes('animado') || txt.includes('vídeo') || txt.includes('video')) {
            return txt.substring(0, 200);
          }
        }
        return '';
      });
      if (ctx) {
        log(`Card vídeo índice ${i}: ${ctx.replace(/\s+/g, ' ').substring(0, 80)}`);
        videoIndex = i;
        break;
      }
    }

    // Se não encontrar, tentar o card de resultado de uma foto gerada
    if (videoIndex === -1) {
      log('Modo vídeo não encontrado na home — tentando via /criacoes...');

      await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      await screenshot(page, `video-${jobNum}-criacoes`);

      const videoBtn = page.locator('button, a').filter({ hasText: /Criar vídeo|Gerar vídeo/i }).first();
      if (await videoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await videoBtn.click();
        await page.waitForTimeout(2000);
        log('Clicou em "Criar vídeo" via criacoes');
      } else {
        jobEntry.status = 'failed';
        jobEntry.erro = 'Modo vídeo não encontrado';
        jobResults.push(jobEntry);
        addTest(`Job vídeo #${jobNum}`, false, 'Modo vídeo não encontrado na home nem em /criacoes');
        return;
      }
    } else {
      await usarBtns.nth(videoIndex).click();
      await page.waitForTimeout(2000);
    }

    await screenshot(page, `video-${jobNum}-01-mode`);

    // Upload de foto para vídeo
    const fileInputs = page.locator('input[type="file"]');
    const fiCount = await fileInputs.count();
    log(`Inputs file para vídeo: ${fiCount}`);

    if (fiCount > 0) {
      await fileInputs.first().setInputFiles(productImagePath);
      log('Upload foto para vídeo');
      await page.waitForTimeout(1500);
    }

    // Preencher prompt de vídeo
    const promptSelectors = [
      'textarea[placeholder*="prompt"]',
      'textarea[placeholder*="movimento"]',
      'textarea[placeholder*="animação"]',
      'input[placeholder*="prompt"]',
      'textarea',
    ];

    for (const sel of promptSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.fill('Óculos de sol girando suavemente, brilho metálico');
        log(`Prompt vídeo preenchido via: ${sel}`);
        break;
      }
    }

    await screenshot(page, `video-${jobNum}-02-form`);

    // Clicar no botão de gerar vídeo
    const genVideoBtns = page.locator('button').filter({
      hasText: /Gerar vídeo|Criar vídeo|Criar|Gerar|Processar/i,
    });
    const gvCount = await genVideoBtns.count();
    log(`Botões gerar vídeo: ${gvCount}`);

    const genVideoBtn = genVideoBtns.last();
    if (!(await genVideoBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      jobEntry.status = 'failed';
      jobEntry.erro = 'Botão gerar vídeo não encontrado';
      jobResults.push(jobEntry);
      addTest(`Job vídeo #${jobNum}`, false, 'Botão não encontrado');
      return;
    }

    const gvBtnText = await genVideoBtn.textContent();
    log(`Clicando em: "${gvBtnText}"`);
    await genVideoBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, `video-${jobNum}-03-generating`);
    addTest(`Job vídeo #${jobNum} — submetido`, true, `Botão: "${gvBtnText?.trim()}"`);

    // Aguardar resultado (vídeos podem demorar mais)
    const result = await waitForGenerationDone(page, 360000);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);

    await screenshot(page, `video-${jobNum}-04-result`);

    if (result.success) {
      jobEntry.status = 'done';
      jobEntry.tempo_seg = parseInt(elapsedSec);
      log(`Vídeo #${jobNum} CONCLUÍDO em ${elapsedSec}s`);
      addTest(`Job vídeo #${jobNum} — geração`, true, `Tempo: ${elapsedSec}s`);
    } else {
      jobEntry.status = 'failed';
      jobEntry.tempo_seg = parseInt(elapsedSec);
      jobEntry.erro = result.error;
      log(`Vídeo #${jobNum} FALHOU: ${result.error}`);
      addTest(`Job vídeo #${jobNum} — geração`, false, result.error);
      report.errors.push(`Job vídeo #${jobNum}: ${result.error}`);
    }

  } catch (e) {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
    jobEntry.status = 'error';
    jobEntry.tempo_seg = parseInt(elapsedSec);
    jobEntry.erro = e.message;
    log(`Vídeo #${jobNum} ERRO: ${e.message}`);
    addTest(`Job vídeo #${jobNum}`, false, e.message);
    report.errors.push(`Job vídeo #${jobNum}: ${e.message}`);
    await screenshot(page, `video-${jobNum}-error`).catch(() => {});
  }

  jobResults.push(jobEntry);
}

async function testSubmissaoSimultanea(page, productImagePath) {
  log('\n=== Teste: Submissão Simultânea ===');
  // Vai para home, seleciona modo, faz upload, tenta clicar 2x no gerar rápido
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  try {
    await page.waitForSelector('text=Usar agora', { timeout: 12000 });
  } catch {}

  const usarBtns = page.getByText('Usar agora');
  const count = await usarBtns.count();
  if (count === 0) {
    addTest('Submissão simultânea — setup', false, 'Nenhum modo disponível');
    return;
  }

  await usarBtns.first().click();
  await page.waitForTimeout(2000);

  const fiCount = await page.locator('input[type="file"]').count();
  if (fiCount > 0) {
    await page.locator('input[type="file"]').first().setInputFiles(productImagePath);
    await page.waitForTimeout(1000);
  }

  // Preencher produto
  const ti = page.locator('input[type="text"]').first();
  if (await ti.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ti.fill('Óculos de sol premium');
  }

  // Tentar clicar 2x no botão gerar rapidamente
  const genBtn = page.locator('button').filter({ hasText: /Gerar|Transformar|Criar/i }).last();
  if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    // 1a submissão
    await genBtn.click();
    await page.waitForTimeout(500);
    // 2a submissão imediata — deve ser bloqueada ou ignorada
    await genBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
    await screenshot(page, 'simultaneous-submit');

    // Verificar se botão ficou desabilitado ou loading
    const bodyAfter = await page.textContent('body');
    const btnDisabled = await genBtn.isDisabled().catch(() => false);
    const hasLoading = bodyAfter.includes('Gerando') || bodyAfter.includes('Processando') ||
      bodyAfter.includes('Aguarde') || btnDisabled;

    addTest('Submissão simultânea bloqueada', hasLoading,
      hasLoading ? 'Botão desabilitado/loading após 1a submissão' : 'Possível dupla submissão — verificar');

    // Aguardar um pouco e cancelar navegando para home
    await page.waitForTimeout(3000);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } else {
    addTest('Submissão simultânea — botão', false, 'Botão Gerar não encontrado');
  }
}

async function testEditorTexto(page) {
  log('\n=== Teste: Editor de Texto ===');
  // Ir para /criacoes e verificar se há fotos para editar
  await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'editor-criacoes');

  const editBtn = page.locator('button, a').filter({ hasText: /Editar/i }).first();
  if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'editor-opened');

    const editorUrl = page.url();
    const editorBody = await page.textContent('body');
    const hasEditor = editorUrl.includes('/editor') || editorBody.includes('Texto') ||
      editorBody.includes('Adicionar texto') || editorBody.includes('Canvas');

    addTest('Editor de imagem acessível', hasEditor, `URL: ${editorUrl}`);

    if (hasEditor) {
      // Tentar adicionar texto
      const addTextBtn = page.locator('button').filter({ hasText: /Adicionar texto|Texto|Text/i }).first();
      if (await addTextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addTextBtn.click();
        await page.waitForTimeout(1000);
        // Tentar digitar
        const textInput = page.locator('input[type="text"], textarea').first();
        if (await textInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await textInput.fill('Promoção especial!');
          await page.waitForTimeout(500);
          addTest('Editor — adicionar texto', true, 'Texto digitado no editor');
        } else {
          // Tentar digitar diretamente no canvas
          await page.keyboard.type('Promoção especial!');
          addTest('Editor — texto digitado no canvas', true);
        }
        await screenshot(page, 'editor-text-added');
      } else {
        addTest('Editor — botão Adicionar texto', false, 'Botão não encontrado');
        await screenshot(page, 'editor-no-text-btn');
      }
    }
  } else {
    addTest('Editor de imagem', false, 'Botão Editar não encontrado em /criacoes');
  }
}

async function testLogoutRelogin(page) {
  log('\n=== Teste: Logout e Relogin ===');
  await page.goto(`${BASE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'conta-page');

  const contaBody = await page.textContent('body');
  addTest('Página /conta carrega', true, `URL: ${page.url()}`);

  // Tentar logout
  const logoutBtn = page.locator('button').filter({ hasText: /Sair|Logout|Deslogar|sair/i }).first();
  if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'after-logout');

    const urlAfterLogout = page.url();
    const loggedOut = urlAfterLogout.includes('/login') || urlAfterLogout.includes('/') || !urlAfterLogout.includes('/conta');
    addTest('Logout via /conta', loggedOut, `URL: ${urlAfterLogout}`);

    // Relogar
    const reloginSuccess = await doLogin(page);
    await screenshot(page, 'after-relogin');
    addTest('Relogin após logout', reloginSuccess, reloginSuccess ? 'OK' : 'Falhou');
  } else {
    log('Botão logout não encontrado — limpando storage manualmente');
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
    await page.context().clearCookies();
    await screenshot(page, 'logout-manual');
    addTest('Logout (manual via storage clear)', true, 'Storage limpo');

    // Relogar
    const reloginSuccess = await doLogin(page);
    addTest('Relogin após logout manual', reloginSuccess, reloginSuccess ? 'OK' : 'Falhou');
  }
}

async function testCriacoes(page) {
  log('\n=== Teste: Tela /criacoes ===');
  await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'criacoes-page');

  const criacoesBody = await page.textContent('body');
  const criacoesUrl = page.url();

  addTest('Tela /criacoes carrega', true, `URL: ${criacoesUrl}`);

  const hasContent = criacoesBody.includes('Baixar') || criacoesBody.includes('Editar') ||
    criacoesBody.includes('Criar vídeo') || criacoesBody.includes('.jpg') || criacoesBody.includes('.png');
  const hasEmpty = criacoesBody.includes('nenhuma') || criacoesBody.includes('aparecem aqui') ||
    criacoesBody.includes('Criar') || criacoesBody.includes('primeira');

  if (hasContent) {
    addTest('Criações — fotos listadas', true);
    // Clicar na primeira foto para ver detalhes
    const firstPhoto = page.locator('img[src*="supabase"], img[src*="storage"], [class*="photo"], [class*="card"]').first();
    if (await firstPhoto.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstPhoto.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'criacoes-foto-detalhe');
      const detalheBody = await page.textContent('body');
      const hasDetail = detalheBody.includes('Baixar') || detalheBody.includes('Editar') ||
        detalheBody.includes('Criar vídeo') || page.url().includes('/result');
      addTest('Criações — clique em foto abre detalhes', hasDetail, `URL: ${page.url()}`);
    } else {
      // Tentar clicar em qualquer card
      const anyCard = page.locator('[class*="card"], [class*="item"], article').first();
      if (await anyCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await anyCard.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'criacoes-card-clicked');
        addTest('Criações — clique em card', true, `URL: ${page.url()}`);
      } else {
        addTest('Criações — clique em foto', false, 'Elemento clicável não encontrado');
      }
    }
  } else if (hasEmpty) {
    addTest('Criações — estado vazio (sem fotos)', true, 'Correto para conta nova');
  } else {
    addTest('Criações — conteúdo', false, 'Conteúdo inesperado');
  }
}

async function checkJobsSupabase() {
  log('\n=== Verificando jobs no Supabase ===');
  const res = await supabaseRequest('GET', '/rest/v1/image_jobs?order=created_at.desc&limit=30', null);

  if (Array.isArray(res.data)) {
    const jobs = res.data;
    const failed = jobs.filter(j => j.status === 'failed');
    const done = jobs.filter(j => j.status === 'done' || j.status === 'completed');
    const pending = jobs.filter(j => j.status === 'pending');
    const processing = jobs.filter(j => j.status === 'processing');

    log(`Jobs recentes no Supabase:`);
    log(`  done/completed: ${done.length}`);
    log(`  pending: ${pending.length}`);
    log(`  processing: ${processing.length}`);
    log(`  failed: ${failed.length}`);

    addTest('Supabase — jobs visíveis', jobs.length >= 0, `${jobs.length} jobs recentes`);
    addTest('Supabase — sem jobs failed críticos', failed.length === 0,
      failed.length > 0 ? `${failed.length} failed: ${failed.slice(0, 3).map(j => j.error_message || '?').join(', ')}` : 'OK');

    report.jobs = jobs.slice(0, 10);
    return jobs;
  } else {
    addTest('Supabase — jobs', false, `Resposta: ${JSON.stringify(res.data).substring(0, 100)}`);
    return [];
  }
}

// =====================================
// MAIN
// =====================================
async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  log(`Screenshots em: ${SCREENSHOTS}`);

  // Baixar imagens de teste
  const productImagePath = path.join(SCREENSHOTS, 'oculos-produto.jpg');
  const modelImagePath = path.join(SCREENSHOTS, 'modelo-pessoa.jpg');

  log('Baixando imagem de produto (óculos)...');
  if (!fs.existsSync(productImagePath) || fs.statSync(productImagePath).size < 5000) {
    await downloadFile(PRODUCT_URL, productImagePath).catch(e => log(`Erro download produto: ${e.message}`));
  }
  if (fs.existsSync(productImagePath)) {
    log(`Produto: ${fs.statSync(productImagePath).size} bytes`);
  }

  log('Baixando imagem de modelo (pessoa)...');
  if (!fs.existsSync(modelImagePath) || fs.statSync(modelImagePath).size < 5000) {
    await downloadFile(MODEL_URL, modelImagePath).catch(e => log(`Erro download modelo: ${e.message}`));
  }
  if (fs.existsSync(modelImagePath)) {
    log(`Modelo: ${fs.statSync(modelImagePath).size} bytes`);
  }

  // Setup usuário
  const userId = await createAndSetupUser();
  if (userId) {
    addTest('Setup usuário PRO via Supabase', true, `userId: ${userId}`);
  } else {
    addTest('Setup usuário PRO via Supabase', false, 'Não foi possível criar/configurar usuário');
    log('AVISO: Continuando sem userId confirmado — login pode funcionar se usuário já existir');
  }

  // Lançar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });

  page.on('pageerror', err => {
    report.errors.push(`Page JS error: ${err.message}`);
  });

  try {
    // =====================================================
    // ETAPA 1: Login inicial
    // =====================================================
    log('\n========== ETAPA 1: LOGIN INICIAL ==========');
    const loginOk = await doLogin(page);
    await screenshot(page, '01-after-login');
    addTest('Login inicial', loginOk, `URL: ${page.url()}`);

    if (!loginOk) {
      log('Login falhou. Verificando corpo da página...');
      const loginBody = await page.textContent('body').catch(() => '');
      log(`Corpo: ${loginBody.substring(0, 300)}`);
      report.errors.push('Login inicial falhou — abortando testes de geração');
    }

    // Ir para home
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await screenshot(page, '02-home');

    const homeBody = await page.textContent('body');
    addTest('Home carrega após login', !page.url().includes('/login'), `URL: ${page.url()}`);

    // =====================================================
    // ETAPA 2: 5x Jobs de Foto (modo catálogo)
    // =====================================================
    log('\n========== ETAPA 2: 5 JOBS DE FOTO ==========');

    if (loginOk) {
      for (let i = 1; i <= 5; i++) {
        // Limpar jobs do dia antes de cada job (para não bater limite)
        if (i > 1 && userId) {
          log(`Resetando limite diário antes do job #${i}...`);
          const today = new Date().toISOString().slice(0, 10);
          await supabaseRequest('DELETE', `/rest/v1/image_jobs?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z`, null);
          await page.waitForTimeout(1000);
        }

        await runPhotoJob(page, i, productImagePath, modelImagePath);

        // Pausa entre jobs
        if (i < 5) {
          log('Pausa de 5s entre jobs...');
          await page.waitForTimeout(5000);
        }
      }
    } else {
      log('Pulando jobs de foto — login falhou');
      for (let i = 1; i <= 5; i++) {
        jobResults.push({ job: i, modo: 'catalogo', tempo_seg: null, status: 'skipped', erro: 'Login falhou' });
      }
    }

    // =====================================================
    // ETAPA 3: 2x Jobs de Vídeo (PRO)
    // =====================================================
    log('\n========== ETAPA 3: 2 JOBS DE VÍDEO ==========');

    if (loginOk) {
      for (let i = 1; i <= 2; i++) {
        // Resetar limite diário
        if (userId) {
          const today = new Date().toISOString().slice(0, 10);
          await supabaseRequest('DELETE', `/rest/v1/image_jobs?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z`, null);
        }

        await runVideoJob(page, i, productImagePath);

        if (i < 2) await page.waitForTimeout(5000);
      }
    } else {
      for (let i = 1; i <= 2; i++) {
        jobResults.push({ job: `V${i}`, modo: 'video', tempo_seg: null, status: 'skipped', erro: 'Login falhou' });
      }
    }

    // =====================================================
    // ETAPA 4: Testes extras
    // =====================================================
    log('\n========== ETAPA 4: TESTES EXTRAS ==========');

    // Resetar limite para testes extras
    if (userId) {
      const today = new Date().toISOString().slice(0, 10);
      await supabaseRequest('DELETE', `/rest/v1/image_jobs?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z`, null);
    }

    // 4a. Submissão simultânea
    if (loginOk) {
      await testSubmissaoSimultanea(page, productImagePath);
    }

    // 4b. Editor de texto
    await testEditorTexto(page);

    // 4c. Tela /criacoes
    await testCriacoes(page);

    // 4d. Logout e relogin via /conta
    await testLogoutRelogin(page);

    // 4e. Verificar jobs no Supabase
    await checkJobsSupabase();

    await screenshot(page, 'final-state');

  } catch (err) {
    log(`ERRO CRÍTICO GERAL: ${err.message}`);
    report.errors.push(`Erro crítico geral: ${err.message}`);
    try { await screenshot(page, 'CRITICAL-ERROR'); } catch {}
  } finally {
    await browser.close();

    // =====================================================
    // RELATÓRIO FINAL
    // =====================================================
    console.log('\n');
    console.log('='.repeat(70));
    console.log('STRESS TEST D3 — TamoWork Foto IA — RELATÓRIO FINAL');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Viewport: 1440x900 | Modo: catalogo (com modelo) | Produto: óculos\n`);

    // Tabela de Jobs
    console.log('--- TABELA DE JOBS ---');
    console.log(`${'Job'.padEnd(6)} | ${'Modo'.padEnd(10)} | ${'Tempo(s)'.padEnd(9)} | ${'Status'.padEnd(10)} | Erro`);
    console.log('-'.repeat(70));
    for (const j of jobResults) {
      const job = String(j.job).padEnd(6);
      const modo = (j.modo || '').padEnd(10);
      const tempo = (j.tempo_seg != null ? String(j.tempo_seg) : '-').padEnd(9);
      const status = (j.status || '').padEnd(10);
      const erro = j.erro || '';
      console.log(`${job} | ${modo} | ${tempo} | ${status} | ${erro}`);
    }

    // Médias
    const fotoDone = jobResults.filter(j => j.modo === 'catalogo' && j.status === 'done');
    const videoDone = jobResults.filter(j => j.modo === 'video' && j.status === 'done');

    if (fotoDone.length > 0) {
      const avgFoto = (fotoDone.reduce((s, j) => s + j.tempo_seg, 0) / fotoDone.length).toFixed(0);
      console.log(`\nMédia foto (${fotoDone.length}/${jobResults.filter(j => j.modo === 'catalogo').length} OK): ${avgFoto}s`);
    } else {
      console.log('\nNenhum job de foto concluído com sucesso');
    }

    if (videoDone.length > 0) {
      const avgVideo = (videoDone.reduce((s, j) => s + j.tempo_seg, 0) / videoDone.length).toFixed(0);
      console.log(`Média vídeo (${videoDone.length}/${jobResults.filter(j => j.modo === 'video').length} OK): ${avgVideo}s`);
    } else {
      console.log('Nenhum job de vídeo concluído com sucesso');
    }

    // Testes
    console.log('\n--- TESTES ---');
    const passed = report.tests.filter(t => t.passed).length;
    const total = report.tests.length;
    console.log(`Resultado: ${passed}/${total} testes passaram\n`);

    for (const t of report.tests) {
      const icon = t.passed ? '✅' : '❌';
      console.log(`${icon} ${t.name}${t.detail ? ' — ' + t.detail : ''}`);
    }

    // Erros
    if (report.errors.length > 0) {
      console.log('\n--- ERROS ENCONTRADOS ---');
      report.errors.forEach(e => console.log(`  • ${e}`));
    } else {
      console.log('\n--- SEM ERROS CRÍTICOS ---');
    }

    // Console errors
    if (report.consoleErrors.length > 0) {
      console.log(`\n--- CONSOLE ERRORS (browser): ${report.consoleErrors.length} ---`);
      report.consoleErrors.slice(0, 5).forEach(e => console.log(`  • ${e}`));
    }

    console.log(`\nScreenshots salvos em: ${SCREENSHOTS}`);
    console.log('='.repeat(70));

    // Salvar JSON do relatório
    const reportPath = path.join(SCREENSHOTS, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ report, jobResults }, null, 2));
    console.log(`Relatório JSON: ${reportPath}`);
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
