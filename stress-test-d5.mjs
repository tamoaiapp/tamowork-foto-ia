/**
 * stress-test-d5.mjs — TamoWork Foto IA — Stress Test D5
 * Viewport: 1440x900 | Modo: custom ("Do meu jeito") | headless: true
 * Imagem: tênis esportivo Unsplash
 *
 * Testes:
 * - 5x geração de foto (modo custom)
 * - 2x geração de vídeo (a partir de foto pronta)
 * - UI extras: prompt longo, submit sem campos, cancelar, navegar durante geração,
 *   logout/login em sessão ativa, editor completo (crop, texto, brilho)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'test-stress-d5@tamowork.test';
const PASSWORD = 'StressD5@2026';
const USER_ID = 'ff49cf08-0b72-4a5b-8774-800f8d9b5051';
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d5';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

// ---- Relatório ----
const report = {
  timestamp: new Date().toISOString(),
  account: EMAIL,
  plan: 'PRO',
  viewport: '1440x900',
  jobs: [],       // { job#, modo, tempo_seg, status, erro }
  uitests: [],    // { teste, passed, detalhe }
  errors: [],
  consoleErrors: [],
};

let screenshotCounter = 0;
function ts() { return new Date().toTimeString().slice(0, 8); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }
function addJob(num, modo, tempo_seg, status, erro = '') {
  report.jobs.push({ 'job#': num, modo, tempo_seg, status, erro });
  const icon = status === 'done' ? '✅' : status === 'canceled' ? '⚡' : '❌';
  log(`${icon} Job #${num} | ${modo} | ${tempo_seg}s | ${status}${erro ? ' | ' + erro : ''}`);
}
function addUI(teste, passed, detalhe = '') {
  report.uitests.push({ teste, passed, detalhe });
  log(`${passed ? '✅' : '❌'} [UI] ${teste}${detalhe ? ' — ' + detalhe : ''}`);
}

async function screenshot(page, label) {
  screenshotCounter++;
  const name = `${String(screenshotCounter).padStart(3, '0')}-${label}.png`;
  const filePath = path.join(SCREENSHOTS, name);
  await page.screenshot({ path: filePath, fullPage: false }).catch(() => {});
  log(`  📸 ${name}`);
  return filePath;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function supabaseRequest(method, urlPath, body) {
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

// Garantir plano PRO antes de cada ciclo de geração
async function ensurePro() {
  const patchResp = await supabaseRequest('PATCH', `/rest/v1/user_plans?user_id=eq.${USER_ID}`, {
    plan: 'pro', period_end: '2027-12-31', updated_at: new Date().toISOString(),
  });
  if (patchResp.status >= 200 && patchResp.status < 300) {
    log(`  PRO garantido via PATCH (${patchResp.status})`);
    return true;
  }
  // Se 0 rows, fazer POST
  const postResp = await supabaseRequest('POST', '/rest/v1/user_plans', {
    user_id: USER_ID, plan: 'pro', period_end: '2027-12-31', mp_subscription_id: 'stress-d5',
  });
  log(`  PRO garantido via POST (${postResp.status})`);
  return postResp.status >= 200 && postResp.status < 300;
}

// Login — retorna true se logou com sucesso
async function doLogin(page) {
  log('  Navegando para /login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Clicar em "Usar e-mail e senha"
  const emailToggle = page.locator('text=Usar e-mail e senha');
  if (await emailToggle.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailToggle.click();
    await page.waitForTimeout(800);
  }

  // Garantir aba "Entrar"
  const tabEntrar = page.locator('button').filter({ hasText: /^Entrar$/ });
  if (await tabEntrar.count() > 0) {
    await tabEntrar.first().click();
    await page.waitForTimeout(400);
  }

  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);

  const submitBtn = page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /^Entrar$/ }).last());
  await submitBtn.click();
  await page.waitForTimeout(4000);

  const url = page.url();
  const logged = !url.includes('/login');
  log(`  URL pós-login: ${url} | Logado: ${logged}`);

  // Onboarding
  if (url.includes('/onboarding')) {
    const continueBtn = page.locator('button').filter({ hasText: /Continuar|Começar|Próximo/i }).first();
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  return logged;
}

// Selecionar modo "Do meu jeito" (personalizado) — idx 5 nos 6 cards
async function selectCustomMode(page) {
  log('  Selecionando modo "Do meu jeito"...');
  await page.waitForSelector('text=Usar agora', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const usarAgoraButtons = page.locator('button').filter({ hasText: 'Usar agora' });
  const count = await usarAgoraButtons.count();
  log(`  Botões "Usar agora" encontrados: ${count}`);

  // Verificar APENAS o pai imediato do botão (não subir muitos níveis)
  for (let i = 0; i < count; i++) {
    const btn = usarAgoraButtons.nth(i);
    const parentText = await btn.evaluate(el => {
      // Pai imediato contém a descrição do card
      const p1 = (el.parentElement?.textContent || '').replace(/\s+/g, ' ').trim();
      const p2 = (el.parentElement?.parentElement?.textContent || '').replace(/\s+/g, ' ').trim();
      return { p1: p1.substring(0, 100), p2: p2.substring(0, 120) };
    });

    const isCustom = parentText.p1.includes('jeito') || parentText.p2.includes('Do meu jeito') ||
                     parentText.p1.includes('Descreva') || parentText.p2.includes('Descreva') ||
                     parentText.p1.includes('livremente') || parentText.p2.includes('livremente');

    if (isCustom) {
      log(`  Card "Do meu jeito" encontrado (idx ${i}): "${parentText.p1.substring(0, 60)}"`);
      await btn.click();
      await page.waitForTimeout(2000);
      // Verificar que 2 inputs de texto aparecem (produto + cenário)
      const textInputCount = await page.locator('input[type="text"]').count();
      log(`  Inputs texto após selecionar modo: ${textInputCount}`);
      return true;
    }
  }

  // Fallback: clicar no último (personalizado é sempre o último dos 6 cards)
  if (count > 0) {
    log(`  Fallback: último botão (idx ${count - 1})`);
    await usarAgoraButtons.nth(count - 1).click();
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

// Upload de foto + preencher produto + cenário + submeter
// Retorna { submitted, startTime }
async function doPhotoJob(page, imgPath, produto, cenario, jobNum) {
  log(`  Job #${jobNum}: upload foto...`);
  const fileInput = page.locator('input[type="file"]').first();
  const fileInputCount = await page.locator('input[type="file"]').count();
  log(`  Inputs file: ${fileInputCount}`);

  if (fileInputCount === 0) {
    // Tentar clicar em área de upload
    const uploadArea = page.locator('[class*="upload"], label').first();
    if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uploadArea.click();
      await page.waitForTimeout(500);
    }
  }

  await fileInput.setInputFiles(imgPath);
  await page.waitForTimeout(2000);
  await screenshot(page, `job${jobNum}-uploaded`);

  // Campo "O que é o produto?"
  const produtoInput = page.locator('input[placeholder*="bolo"], input[placeholder*="artesanal"], input[placeholder*="Ex:"]').first();
  if (await produtoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await produtoInput.fill(produto);
    log(`  Campo produto preenchido`);
  } else {
    const textInputs = page.locator('input[type="text"]');
    const ti = await textInputs.count();
    if (ti > 0) {
      await textInputs.first().fill(produto);
      log(`  Campo produto (fallback 1° input): preenchido`);
    }
  }

  // Campo cenário / "Descreva o resultado"
  // Para modo personalizado há 2 inputs: [0]=produto [1]=cenário
  const cenarioInput = page.locator('input[placeholder*="Descreva livremente"], input[placeholder*="cenário"], input[placeholder*="mesa rústica"]').first();
  if (await cenarioInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cenarioInput.fill(cenario);
    log(`  Campo cenário preenchido (via placeholder)`);
  } else {
    // Tentar o segundo input de texto (índice 1)
    const textInputs2 = page.locator('input[type="text"]');
    const ti2 = await textInputs2.count();
    log(`  Total inputs texto: ${ti2}`);
    if (ti2 > 1) {
      await textInputs2.nth(1).fill(cenario);
      const actualCenario = await textInputs2.nth(1).inputValue();
      log(`  Campo cenário (2° input) preenchido: "${actualCenario.substring(0, 40)}"`);
    } else if (ti2 === 1) {
      log(`  AVISO: Apenas 1 input — modo pode não ser personalizado`);
    }
  }

  await screenshot(page, `job${jobNum}-filled`);

  const allBtns = await page.$$eval('button', bs => bs.map(b => b.textContent?.trim()).filter(Boolean));
  log(`  Botões: ${JSON.stringify(allBtns)}`);

  const genBtn = page.locator('button').filter({ hasText: /Gerar|Transformar|IA/i }).last();
  const genVisible = await genBtn.isVisible({ timeout: 3000 }).catch(() => false);

  if (!genVisible) {
    log(`  ERRO: Botão gerar não encontrado`);
    await screenshot(page, `job${jobNum}-no-gerar`);
    return { submitted: false, startTime: 0 };
  }

  const startTime = Date.now();
  await genBtn.click();
  await page.waitForTimeout(2000);
  await screenshot(page, `job${jobNum}-generating`);
  log(`  Gerando...`);

  return { submitted: true, startTime };
}

// Aguardar resultado (max 5 min)
// isDone: precisa de sinal ESPECÍFICO do resultado — não confundir com cards da home
async function waitForResult(page, startTime, jobNum, maxMs = 300000) {
  const checkEvery = 10000;
  let elapsed = 0;

  while (elapsed < maxMs) {
    await page.waitForTimeout(checkEvery);
    elapsed += checkEvery;

    // Usar locators específicos em vez de textContent global (evita falsos positivos)
    // O resultado tem: botão "Baixar foto" (⬇ Baixar foto) E botão "Gerar outra foto"
    // A tela "Gerando" tem: "Transformando sua foto..." + barra de progresso
    const downloadBtn = page.locator('button, a').filter({ hasText: /⬇ Baixar|Baixar foto|Download foto/i }).first();
    const newBtn = page.locator('button').filter({ hasText: /Gerar outra foto|Gerar novamente|🔄/i }).first();
    const editBtn = page.locator('button').filter({ hasText: /Editar foto|✏|result_edit/i }).first();
    const errorEl = page.locator('[style*="color: rgb(239"]').first(); // cor de erro vermelha

    const dlVisible = await downloadBtn.isVisible({ timeout: 500 }).catch(() => false);
    const newVisible = await newBtn.isVisible({ timeout: 500 }).catch(() => false);
    const editVisible = await editBtn.isVisible({ timeout: 500 }).catch(() => false);
    const errVisible = await errorEl.isVisible({ timeout: 500 }).catch(() => false);

    const isDone = dlVisible || (newVisible && editVisible);
    const isFailed = errVisible;

    const body = await page.textContent('body').catch(() => '');
    const isGenErrorMsg = body.includes('Erro ao processar') || body.includes('Falha ao gerar') ||
                          body.includes('tente novamente') || body.includes('Timeout na geração');

    const url = page.url();
    log(`  [${(elapsed/1000).toFixed(0)}s] dl=${dlVisible} new=${newVisible} edit=${editVisible} err=${isFailed||isGenErrorMsg} url=${url.slice(-30)}`);

    if (isDone) {
      const tempo = ((Date.now() - startTime) / 1000).toFixed(0);
      await screenshot(page, `job${jobNum}-done`);
      // Capturar URL da imagem resultante
      const resultImg = page.locator('img[alt="Foto gerada"]').first();
      if (await resultImg.isVisible({ timeout: 1000 }).catch(() => false)) {
        const src = await resultImg.getAttribute('src').catch(() => null);
        log(`  Imagem resultado: ${src?.substring(0, 60) || 'N/A'}...`);
        page._lastResultImgUrl = src;
      }
      return { status: 'done', tempo };
    }
    if (isFailed || isGenErrorMsg) {
      const tempo = ((Date.now() - startTime) / 1000).toFixed(0);
      await screenshot(page, `job${jobNum}-failed`);
      const errMsg = await errorEl.textContent().catch(() => '');
      return { status: 'failed', tempo, erro: (errMsg || isGenErrorMsg).toString().substring(0, 200) };
    }
    if (elapsed % 60000 === 0) {
      await screenshot(page, `job${jobNum}-waiting-${elapsed/1000}s`);
    }
  }

  const tempo = ((Date.now() - startTime) / 1000).toFixed(0);
  await screenshot(page, `job${jobNum}-timeout`);
  return { status: 'timeout', tempo, erro: `Timeout após ${maxMs/1000}s` };
}

// Fazer logout
async function doLogout(page) {
  log('  Fazendo logout...');
  await page.goto(`${BASE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'logout-conta-page');

  const logoutBtn = page.locator('button').filter({ hasText: /Sair|Logout|Desconectar/i }).first();
  if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
    log(`  Botão logout clicado`);
    return true;
  }
  // Tentar via localStorage
  await page.evaluate(() => {
    Object.keys(localStorage).forEach(k => {
      if (k.includes('supabase') || k.includes('auth') || k.includes('tw_')) {
        localStorage.removeItem(k);
      }
    });
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  log(`  Logout via localStorage limpo`);
  return page.url().includes('/login');
}

// ===========================
// MAIN
// ===========================
async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  log(`=== Stress Test D5 | ${new Date().toISOString()} ===`);
  log(`Screenshots: ${SCREENSHOTS}`);

  // Baixar foto de produto
  const imgPath = path.join(SCREENSHOTS, 'tenis-produto.jpg');
  if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size < 1000) {
    log('Baixando foto de produto...');
    try {
      await downloadFile(
        'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800',
        imgPath
      );
      log(`  Foto baixada: ${fs.statSync(imgPath).size} bytes`);
    } catch (e) {
      log(`  Erro ao baixar foto: ${e.message}`);
      // Tentar URL alternativa
      try {
        await downloadFile('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', imgPath);
        log(`  Foto alternativa baixada: ${fs.statSync(imgPath).size} bytes`);
      } catch (e2) {
        log(`  Erro alternativo: ${e2.message}`);
      }
    }
  } else {
    log(`  Foto existente: ${fs.statSync(imgPath).size} bytes`);
  }

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
  page.on('pageerror', err => report.errors.push(`PageError: ${err.message}`));

  let lastDoneImageUrl = null; // URL da última imagem gerada (para vídeo)

  try {
    // ================================================================
    // BLOCO 1: Login inicial
    // ================================================================
    log('\n=== BLOCO 1: Login inicial ===');
    await ensurePro();
    const loginOk = await doLogin(page);
    await screenshot(page, '01-after-login');
    addUI('Login inicial (PRO)', loginOk, loginOk ? `URL: ${page.url()}` : 'Falhou');

    if (!loginOk) {
      report.errors.push('Login inicial falhou — abortando');
      await browser.close();
      return finalize();
    }

    // ================================================================
    // BLOCO 2: 5x Geração de foto (modo custom)
    // ================================================================
    log('\n=== BLOCO 2: 5x Geração de foto (modo custom) ===');

    const cenarios = [
      'fotografia profissional em estúdio com fundo gradiente azul e iluminação cinematográfica',
      'produto em cenário outdoor com natureza ao fundo, luz natural suave e sombras suaves',
      'fundo minimalista branco com sombra dramática lateral e produto centralizado',
      'ambiente urbano moderno com piso de mármore e reflexo do produto no chão polido',
      'estúdio high-key com luzes brancas difusas, fundo infinito branco e sombra discreta',
    ];

    for (let i = 1; i <= 5; i++) {
      log(`\n--- Foto Job #${i} ---`);
      await ensurePro(); // reconfirmar PRO antes de cada job

      // Navegar para home e selecionar modo
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);

      // Forçar refresh do plano (limpar cache)
      await page.evaluate(() => {
        localStorage.removeItem('tw_plan');
        sessionStorage.clear();
      });
      await page.waitForTimeout(500);

      const modeSelected = await selectCustomMode(page);
      if (!modeSelected) {
        addJob(i, 'custom', 0, 'skip', 'Modo custom não encontrado');
        await screenshot(page, `job${i}-no-mode`);
        continue;
      }

      await screenshot(page, `job${i}-mode-selected`);
      log(`  URL após modo: ${page.url()}`);

      const { submitted, startTime } = await doPhotoJob(
        page, imgPath,
        'Tênis de corrida',
        cenarios[i - 1],
        i
      );

      if (!submitted) {
        addJob(i, 'custom', 0, 'skip', 'Submit falhou');
        continue;
      }

      const result = await waitForResult(page, startTime, i);
      addJob(i, 'custom', result.tempo, result.status, result.erro || '');

      if (result.status === 'done') {
        // Capturar URL da imagem gerada (para uso no teste de vídeo)
        const imgEl = await page.locator('img[alt="Foto gerada"]').first();
        if (await imgEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          lastDoneImageUrl = await imgEl.getAttribute('src').catch(() => null);
          log(`  Imagem resultado URL: ${lastDoneImageUrl?.substring(0, 60)}...`);
        }
      }

      // Pequena pausa entre jobs
      await page.waitForTimeout(3000);
    }

    // ================================================================
    // BLOCO 3: 2x Geração de vídeo (PRO)
    // ================================================================
    log('\n=== BLOCO 3: 2x Geração de vídeo ===');

    for (let v = 1; v <= 2; v++) {
      log(`\n--- Vídeo Job #${v} ---`);
      await ensurePro();

      // Navegar para home, fazer mais uma foto para ter o botão de vídeo
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => { localStorage.removeItem('tw_plan'); });

      const modeSelected = await selectCustomMode(page);
      if (!modeSelected) {
        addJob(`V${v}`, 'video', 0, 'skip', 'Modo não encontrado para vídeo');
        continue;
      }

      const videoCenarios = [
        'câmera girando suavemente ao redor do produto com iluminação cinematográfica',
        'produto deslizando na tela com efeito de zoom suave e luz pulsante',
      ];

      const { submitted, startTime: photoStart } = await doPhotoJob(
        page, imgPath,
        'Tênis de corrida',
        `estúdio minimalista para vídeo ${v}`,
        `V${v}-photo`
      );

      if (!submitted) {
        addJob(`V${v}`, 'video', 0, 'skip', 'Foto base falhou');
        continue;
      }

      const photoResult = await waitForResult(page, photoStart, `V${v}-photo`, 300000);
      if (photoResult.status !== 'done') {
        addJob(`V${v}`, 'video', 0, 'skip', `Foto base: ${photoResult.status}`);
        continue;
      }

      await screenshot(page, `video${v}-photo-done`);

      // Clicar em "Criar vídeo"
      await ensurePro();
      await page.waitForTimeout(1000);

      const videoBtn = page.locator('button').filter({ hasText: /Criar vídeo|Gerar vídeo/i }).first();
      const videoBtnVisible = await videoBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (!videoBtnVisible) {
        log(`  Botão "Criar vídeo" não encontrado`);
        const allBtns = await page.$$eval('button', bs => bs.map(b => b.textContent?.trim()).filter(Boolean));
        log(`  Botões disponíveis: ${JSON.stringify(allBtns)}`);
        await screenshot(page, `video${v}-no-btn`);
        addJob(`V${v}`, 'video', 0, 'skip', 'Botão Criar vídeo não encontrado');
        continue;
      }

      await videoBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, `video${v}-dialog-open`);

      // Verificar se abriu dialog de vídeo ou bloqueio
      const bodyAfterVideo = await page.textContent('body').catch(() => '');
      const isPro = !bodyAfterVideo.includes('Assinar') && !bodyAfterVideo.includes('planos') &&
                    !bodyAfterVideo.includes('upgrade');

      if (!isPro) {
        addJob(`V${v}`, 'video', 0, 'blocked', 'PRO wall apareceu — PRO não reconhecido');
        await screenshot(page, `video${v}-pro-wall`);
        continue;
      }

      // Preencher prompt de vídeo
      const videoPromptInput = page.locator('input[placeholder*="câmera"], input[placeholder*="girando"], input[placeholder*="rotacionando"], textarea[placeholder*="câmera"]').first();
      if (await videoPromptInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await videoPromptInput.fill(videoCenarios[v - 1]);
        log(`  Prompt de vídeo preenchido`);
      } else {
        // Tentar qualquer input disponível no dialog
        const dialogInputs = page.locator('input[type="text"], textarea');
        const diCount = await dialogInputs.count();
        log(`  Inputs no dialog de vídeo: ${diCount}`);
        if (diCount > 0) {
          await dialogInputs.last().fill(videoCenarios[v - 1]);
        }
      }

      await screenshot(page, `video${v}-prompt-filled`);

      // Botão de gerar vídeo
      const genVideoBtn = page.locator('button').filter({ hasText: /Gerar vídeo|Criar|Processar|Confirmar/i }).last();
      if (await genVideoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        const videoStartTime = Date.now();
        await genVideoBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, `video${v}-generating`);

        // Aguardar resultado de vídeo (max 8 min)
        const videoResult = await waitForResultVideo(page, videoStartTime, v, 480000);
        addJob(`V${v}`, 'video', videoResult.tempo, videoResult.status, videoResult.erro || '');
      } else {
        addJob(`V${v}`, 'video', 0, 'skip', 'Botão gerar vídeo não encontrado');
        await screenshot(page, `video${v}-no-gen-btn`);
      }

      await page.waitForTimeout(3000);
    }

    // ================================================================
    // BLOCO 4: Testes UI extras
    // ================================================================
    log('\n=== BLOCO 4: Testes UI extras ===');

    // --- UI Test 1: Prompt longo (300 chars) ---
    log('\n[UI-1] Prompt longo (300 chars)');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await selectCustomMode(page);

    const longPrompt = 'fotografia profissional em estúdio com fundo gradiente azul e iluminação cinematográfica lateral. ' +
      'O produto deve estar centralizado com sombra suave no chão, reflexo discreto e profundidade de campo. ' +
      'Câmera em ângulo de 3/4 com perspectiva levemente elevada para mostrar detalhes do design do tênis.';
    log(`  Comprimento do prompt: ${longPrompt.length} chars`);

    // Primeiro fazer upload de foto para o campo cenário ficar visível
    const fileInputUI1 = page.locator('input[type="file"]').first();
    if (await fileInputUI1.count() > 0) {
      await fileInputUI1.setInputFiles(imgPath);
      await page.waitForTimeout(1500);
    }

    // Preencher produto também
    const produtoInputUI1 = page.locator('input[placeholder*="bolo"], input[placeholder*="artesanal"], input[placeholder*="Ex:"]').first();
    if (await produtoInputUI1.isVisible({ timeout: 2000 }).catch(() => false)) {
      await produtoInputUI1.fill('Tênis de corrida');
    }

    const cenarioInputLong = page.locator('input[placeholder*="Descreva livremente"], input[placeholder*="cenário"], input[placeholder*="mesa rústica"]').first();
    if (await cenarioInputLong.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cenarioInputLong.fill(longPrompt);
      const actualValue = await cenarioInputLong.inputValue();
      const accepted = actualValue.length >= 150; // aceita pelo menos 150 chars
      await screenshot(page, 'ui1-long-prompt');
      addUI('Campo prompt aceita texto longo (300 chars)', accepted, `Chars aceitos: ${actualValue.length}`);
    } else {
      // Tentar o 2° input de texto
      const ti = page.locator('input[type="text"]');
      const tiCount = await ti.count();
      if (tiCount >= 2) {
        await ti.nth(1).fill(longPrompt);
        const actualValue = await ti.nth(1).inputValue();
        const accepted = actualValue.length >= 150;
        await screenshot(page, 'ui1-long-prompt');
        addUI('Campo prompt aceita texto longo (300 chars)', accepted, `Chars aceitos: ${actualValue.length} (2° input)`);
      } else {
        await screenshot(page, 'ui1-long-prompt-notfound');
        addUI('Campo prompt aceita texto longo (300 chars)', false, `Campo não encontrado (inputs text: ${tiCount})`);
      }
    }

    // --- UI Test 2: Submit sem campos obrigatórios ---
    log('\n[UI-2] Submit sem campos obrigatórios');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await selectCustomMode(page);

    // Sem foto, sem produto, sem cenário — tentar submeter
    // O botão "✨ Gerar foto com IA" deve estar desabilitado ou mostrar validação
    // Lógica do app: disabled se !cenario.trim() (para modo custom)
    // O botão fica habilitado apenas se cenario não vazio

    // Verificar estado do botão sem nenhum campo preenchido
    const genBtnUI2 = page.locator('button').filter({ hasText: /Gerar foto|✨ Gerar/i }).first();
    if (await genBtnUI2.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isDisabled = await genBtnUI2.isDisabled();
      const opacity = await genBtnUI2.evaluate(el => el.style.opacity || window.getComputedStyle(el).opacity);
      log(`  Botão submit: disabled=${isDisabled}, opacity=${opacity}`);
      if (isDisabled || opacity === '0.5') {
        addUI('Submit desabilitado sem cenário', true, `disabled=${isDisabled} opacity=${opacity}`);
        await screenshot(page, 'ui2-btn-disabled');
      } else {
        // Tentar clicar para ver validação
        await genBtnUI2.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'ui2-submit-attempt');
        const body = await page.textContent('body').catch(() => '');
        const hasErr = body.includes('Envie a foto') || body.includes('Descreva') ||
                       body.includes('obrigatório') || body.includes('required') ||
                       body.includes('campo') || body.includes('formError');
        addUI('Erro de validação ao submeter sem campos', hasErr, hasErr ? 'Erro exibido' : 'Sem validação — possível bug');
      }
    } else {
      // Se botão não está visível (antes do upload), é esperado
      addUI('Botão submit oculto sem foto', true, 'Botão não visível antes de upload — correto');
      await screenshot(page, 'ui2-no-btn-expected');
    }

    // Teste: só com foto sem produto (preenche foto mas não produto)
    log('\n[UI-2b] Upload foto mas sem produto/cenário');
    const fileInputUI2b = page.locator('input[type="file"]').first();
    if (await fileInputUI2b.count() > 0) {
      await fileInputUI2b.setInputFiles(imgPath);
      await page.waitForTimeout(1500);
      const genBtnUI2b = page.locator('button').filter({ hasText: /Gerar|IA/i }).last();
      const disabledUI2b = await genBtnUI2b.isDisabled().catch(() => true);
      await screenshot(page, 'ui2b-foto-sem-produto');
      addUI('Submit desabilitado: foto sem produto/cenário', disabledUI2b, disabledUI2b ? 'Botão desabilitado' : 'Botão habilitado (possível bug)');
    }

    // --- UI Test 3: Cancelar durante geração ---
    log('\n[UI-3] Cancelar durante geração');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await ensurePro();
    await selectCustomMode(page);

    const { submitted: submitCancel, startTime: cancelStart } = await doPhotoJob(
      page, imgPath, 'Tênis de corrida', 'fundo branco simples para cancelar', 'cancel'
    );

    if (submitCancel) {
      // O botão Cancelar aparece após 30s de geração
      // Jobs PRO no RunPod tipicamente completam em 60-120s para modo custom
      // Aguardar até 90s pelo botão Cancelar
      log('  Aguardando botão Cancelar (até 90s, verifica a cada 3s)...');
      let cancelBtnFound = false;
      let jobCompletedEarly = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        await page.waitForTimeout(3000);

        // Verificar se job já completou (usando locator específico)
        const dlBtnCancel = await page.locator('button').filter({ hasText: /⬇ Baixar|Baixar foto/i }).first().isVisible({ timeout: 300 }).catch(() => false);
        if (dlBtnCancel) {
          jobCompletedEarly = true;
          log(`  Job completou antes de 30s (${(attempt + 1) * 3}s) — botão Cancelar não aparece neste caso`);
          addUI('Cancelar durante geração', true, `Job concluiu em ~${(attempt + 1) * 3}s — botão Cancelar não necessário`);
          break;
        }

        const cancelBtn = page.locator('button').filter({ hasText: /^Cancelar$/ }).first();
        if (await cancelBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          cancelBtnFound = true;
          log(`  Botão Cancelar encontrado em ${(attempt + 1) * 3}s`);
          await screenshot(page, 'ui3-cancel-visible');
          await cancelBtn.click();
          await page.waitForTimeout(4000);
          await screenshot(page, 'ui3-after-cancel');

          // Após cancelar: deve voltar ao form (modo "sem_trabalho")
          const uploadAreaVisible = await page.locator('input[type="file"]').first().count() > 0;
          const genBtnVisible = await page.locator('button').filter({ hasText: /✨ Gerar|Gerar foto/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
          const wasReset = uploadAreaVisible || genBtnVisible;
          addUI('Cancelar durante geração reseta UI', wasReset, wasReset ? 'Form de upload disponível novamente' : 'UI não resetada');
          break;
        }

        if (attempt % 5 === 0) log(`  [${(attempt + 1) * 3}s] Aguardando Cancelar...`);
      }
      if (!cancelBtnFound && !jobCompletedEarly) {
        addUI('Botão Cancelar aparece durante geração', false, 'Não encontrado em 90s');
      }
    } else {
      addUI('Cancelar durante geração', false, 'Job não foi submetido');
    }

    // --- UI Test 4: Navegar para /criacoes durante geração e voltar ---
    log('\n[UI-4] Navegar para /criacoes durante geração e voltar');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await ensurePro();
    await selectCustomMode(page);

    const { submitted: submitNav, startTime: navStart } = await doPhotoJob(
      page, imgPath, 'Tênis de corrida', 'cenário de navegação para teste de polling', 'nav'
    );

    if (submitNav) {
      // Aguardar geração iniciar (10s)
      await page.waitForTimeout(10000);
      await screenshot(page, 'ui4-generating-before-nav');

      // Navegar para /criacoes
      log('  Navegando para /criacoes...');
      await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      await screenshot(page, 'ui4-criacoes');

      const bodycriacoes = await page.textContent('body').catch(() => '');
      const hasCriacoes = bodycriacoes.includes('Criações') || bodycriacoes.includes('histórico') ||
                          bodycriacoes.includes('jobs') || bodycriacoes.includes('Tênis');
      addUI('/criacoes carrega durante geração ativa', hasCriacoes, `URL: ${page.url()}`);

      // Voltar para home
      log('  Voltando para home...');
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      await screenshot(page, 'ui4-back-home');

      const bodyHome = await page.textContent('body').catch(() => '');
      // Verificar estado real: gerando (animação) OU resultado (botão Baixar foto específico)
      const isGenerating = bodyHome.includes('Transformando sua foto') || bodyHome.includes('Enviando...');
      const isResultReady = await page.locator('button').filter({ hasText: /⬇ Baixar|Baixar foto/i }).first().isVisible({ timeout: 1000 }).catch(() => false);
      const pollingContinues = isGenerating || isResultReady;
      addUI('Polling continua após navegar e voltar', pollingContinues,
        pollingContinues ? 'Estado mantido' : 'Estado perdido após navegação');

      // Aguardar conclusão (mas não bloqueando muito)
      if (isGenerating) {
        const navResult = await waitForResult(page, navStart, 'nav', 240000);
        log(`  Resultado pós-navegação: ${navResult.status} em ${navResult.tempo}s`);
        addUI('Job conclui após retornar da navegação', navResult.status === 'done',
          `${navResult.status} em ${navResult.tempo}s`);
      }
    } else {
      addUI('Navegar durante geração', false, 'Job não submetido');
    }

    // --- UI Test 5: Logout/login no meio de sessão ativa ---
    log('\n[UI-5] Logout e relogin');
    const logoutOk = await doLogout(page);
    await screenshot(page, 'ui5-after-logout');

    const currentUrlAfterLogout = page.url();
    const isLoggedOut = currentUrlAfterLogout.includes('/login') || !currentUrlAfterLogout.includes('/conta');
    addUI('Logout funciona', isLoggedOut, `URL: ${currentUrlAfterLogout}`);

    // Relogar
    await ensurePro();
    const reloginOk = await doLogin(page);
    await screenshot(page, 'ui5-after-relogin');
    addUI('Re-login após logout', reloginOk, `URL: ${page.url()}`);

    // Verificar que sessão está funcional
    if (reloginOk) {
      const homeBody = await page.textContent('body').catch(() => '');
      const hasContent = homeBody.includes('Usar agora') || homeBody.includes('meu jeito') ||
                         homeBody.includes('Fundo branco') || homeBody.includes('PRO');
      addUI('Sessão funcional após relogin', hasContent, hasContent ? 'Conteúdo carregado' : 'Sem conteúdo esperado');
    }

    // --- UI Test 6: Editor completo (crop, texto, brilho) ---
    log('\n[UI-6] Editor completo');

    // Navegar para /editor (precisa de imagem no sessionStorage)
    // Fazer um job rápido primeiro para ter imagem disponível
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await ensurePro();

    // Se temos lastDoneImageUrl, usar direto pelo sessionStorage
    let editorReady = false;
    if (lastDoneImageUrl) {
      log(`  Usando imagem do job anterior: ${lastDoneImageUrl.substring(0, 60)}...`);
      await page.evaluate((url) => {
        sessionStorage.setItem('editor_image', url);
      }, lastDoneImageUrl);
      await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      editorReady = true;
    } else {
      // Fazer um job simples para ter imagem
      log('  Gerando imagem para editor...');
      await selectCustomMode(page);
      const { submitted: submitEd, startTime: edStart } = await doPhotoJob(
        page, imgPath, 'Tênis de corrida', 'fundo branco simples para editor', 'editor'
      );
      if (submitEd) {
        const edResult = await waitForResult(page, edStart, 'editor', 240000);
        if (edResult.status === 'done') {
          // Clicar em Editar
          const editBtn = page.locator('button').filter({ hasText: /Editar/i }).first();
          if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await editBtn.click();
            await page.waitForTimeout(2000);
            editorReady = page.url().includes('/editor');
          }
        }
      }
    }

    if (!editorReady && !page.url().includes('/editor')) {
      await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
    }

    await screenshot(page, 'ui6-editor-open');
    const editorUrl = page.url();
    addUI('Editor abre em /editor', editorUrl.includes('/editor'), `URL: ${editorUrl}`);

    const editorBody = await page.textContent('body').catch(() => '');
    const hasEditorTools = editorBody.includes('Crop') || editorBody.includes('Texto') ||
                           editorBody.includes('Ajustes') || editorBody.includes('Recortar') ||
                           editorBody.includes('crop') || editorBody.includes('Brilho');
    addUI('Ferramentas do editor visíveis', hasEditorTools, hasEditorTools ? 'Ferramentas encontradas' : 'Ferramentas não encontradas');

    if (hasEditorTools || editorUrl.includes('/editor')) {
      // Testar Crop
      log('  Testando Crop...');
      const cropBtn = page.locator('button').filter({ hasText: /Crop|Recortar/i }).first();
      if (await cropBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cropBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'ui6-crop-active');
        const cropBody = await page.textContent('body').catch(() => '');
        const hasCropOptions = cropBody.includes('1:1') || cropBody.includes('4:5') ||
                               cropBody.includes('16:9') || cropBody.includes('livre');
        addUI('Crop: opções de proporção visíveis', hasCropOptions, hasCropOptions ? 'Proporções encontradas' : 'Sem opções de proporção');

        // Clicar em 1:1
        const ratio11 = page.locator('button').filter({ hasText: '1:1' }).first();
        if (await ratio11.isVisible({ timeout: 2000 }).catch(() => false)) {
          await ratio11.click();
          await page.waitForTimeout(1000);
          addUI('Crop: selecionar 1:1', true, 'Proporção 1:1 selecionada');
        } else {
          addUI('Crop: selecionar 1:1', false, 'Botão 1:1 não encontrado');
        }
      } else {
        addUI('Crop: botão encontrado', false, 'Botão Crop/Recortar não encontrado');
      }

      // Testar Texto
      log('  Testando Adicionar Texto...');
      const textoBtn = page.locator('button').filter({ hasText: /Texto|Adicionar texto/i }).first();
      if (await textoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await textoBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'ui6-texto-active');

        // Verificar se aparece input de texto ou canvas interativo
        const textoBody = await page.textContent('body').catch(() => '');
        const hasTextTool = textoBody.includes('texto') || textoBody.includes('fonte') ||
                            textoBody.includes('Tamanho') || textoBody.includes('Cor') ||
                            textoBody.includes('Negrito');
        addUI('Texto: ferramenta ativa', hasTextTool, hasTextTool ? 'Opções de texto visíveis' : 'Interface de texto não detectada');

        // Tentar digitar texto no canvas ou input
        const textInput = page.locator('input[placeholder*="texto"], input[placeholder*="Digite"]').first();
        if (await textInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await textInput.fill('TamoWork Stress D5');
          addUI('Texto: input preenchido', true, 'Texto digitado');
        } else {
          // Clicar no canvas para adicionar texto
          const canvas = page.locator('canvas').first();
          if (await canvas.isVisible({ timeout: 2000 }).catch(() => false)) {
            await canvas.click({ position: { x: 200, y: 200 } });
            await page.waitForTimeout(500);
            addUI('Texto: clique no canvas', true, 'Canvas clicado');
          } else {
            addUI('Texto: input para texto', false, 'Sem input/canvas disponível');
          }
        }
      } else {
        addUI('Texto: botão encontrado', false, 'Botão Texto não encontrado');
      }

      // Testar Ajustes (Brilho)
      log('  Testando Ajustes/Brilho...');
      const ajustesBtn = page.locator('button').filter({ hasText: /Ajustes|Brilho|Filtros/i }).first();
      if (await ajustesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ajustesBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 'ui6-ajustes-active');

        const ajustesBody = await page.textContent('body').catch(() => '');
        const hasBrightness = ajustesBody.includes('Brilho') || ajustesBody.includes('Contraste') ||
                              ajustesBody.includes('Saturação') || ajustesBody.includes('brightness') ||
                              ajustesBody.includes('Filtro');
        addUI('Ajustes: controles de brilho/contraste visíveis', hasBrightness, hasBrightness ? 'Controles encontrados' : 'Controles não detectados');

        // Tentar usar slider de brilho
        const brightnessSlider = page.locator('input[type="range"]').first();
        if (await brightnessSlider.isVisible({ timeout: 2000 }).catch(() => false)) {
          await brightnessSlider.fill('150');
          await page.waitForTimeout(500);
          await screenshot(page, 'ui6-brightness-changed');
          addUI('Brilho: slider ajustado', true, 'Slider preenchido com 150');
        } else {
          addUI('Brilho: slider range encontrado', false, 'Sem input type=range');
        }
      } else {
        addUI('Ajustes: botão encontrado', false, 'Botão Ajustes/Brilho não encontrado');
      }

      await screenshot(page, 'ui6-editor-final');
    }

  } catch (err) {
    log(`\nERRO FATAL: ${err.message}`);
    report.errors.push(`Fatal: ${err.message}`);
    await screenshot(page, 'fatal-error').catch(() => {});
  } finally {
    await browser.close();
    finalize();
  }
}

// Aguardar resultado de vídeo
async function waitForResultVideo(page, startTime, jobNum, maxMs = 480000) {
  const checkEvery = 10000;
  let elapsed = 0;
  while (elapsed < maxMs) {
    await page.waitForTimeout(checkEvery);
    elapsed += checkEvery;
    const body = await page.textContent('body').catch(() => '');

    const isDone = body.includes('Baixar vídeo') || body.includes('Download vídeo') ||
                   body.includes('vídeo gerado') || body.includes('pronto') ||
                   body.includes('mp4') || body.includes('Compartilhar');
    const isFailed = body.includes('Erro ao gerar vídeo') || body.includes('falhou') ||
                     body.includes('Falha ao');

    log(`  [V${jobNum}] [${(elapsed/1000).toFixed(0)}s] done=${isDone} failed=${isFailed}`);

    if (isDone) {
      const tempo = ((Date.now() - startTime) / 1000).toFixed(0);
      await page.screenshot({ path: path.join(SCREENSHOTS, `video${jobNum}-done.png`) }).catch(() => {});
      return { status: 'done', tempo };
    }
    if (isFailed) {
      const tempo = ((Date.now() - startTime) / 1000).toFixed(0);
      await page.screenshot({ path: path.join(SCREENSHOTS, `video${jobNum}-failed.png`) }).catch(() => {});
      return { status: 'failed', tempo, erro: 'Erro durante geração de vídeo' };
    }
    if (elapsed % 60000 === 0) {
      await page.screenshot({ path: path.join(SCREENSHOTS, `video${jobNum}-waiting-${elapsed/1000}s.png`) }).catch(() => {});
    }
  }
  const tempo = ((Date.now() - startTime) / 1000).toFixed(0);
  return { status: 'timeout', tempo, erro: `Timeout ${maxMs/1000}s` };
}

function finalize() {
  log('\n\n=== RELATÓRIO FINAL ===\n');

  // Tabela de jobs
  console.log('JOBS:');
  console.log('job# | modo   | tempo_seg | status  | erro');
  console.log('-----|--------|-----------|---------|-----');
  for (const j of report.jobs) {
    const erro = j.erro ? j.erro.substring(0, 50) : '';
    console.log(`${String(j['job#']).padEnd(4)} | ${j.modo.padEnd(6)} | ${String(j.tempo_seg).padEnd(9)} | ${j.status.padEnd(7)} | ${erro}`);
  }

  // Médias
  const doneJobs = report.jobs.filter(j => j.status === 'done' && j.modo === 'custom');
  if (doneJobs.length > 0) {
    const avg = (doneJobs.reduce((s, j) => s + Number(j.tempo_seg), 0) / doneJobs.length).toFixed(0);
    const min = Math.min(...doneJobs.map(j => Number(j.tempo_seg)));
    const max = Math.max(...doneJobs.map(j => Number(j.tempo_seg)));
    console.log(`\nFotos custom: ${doneJobs.length}/${report.jobs.filter(j=>j.modo==='custom').length} OK | avg=${avg}s | min=${min}s | max=${max}s`);
  }

  const doneVideos = report.jobs.filter(j => j.status === 'done' && j.modo === 'video');
  if (doneVideos.length > 0) {
    const avgV = (doneVideos.reduce((s, j) => s + Number(j.tempo_seg), 0) / doneVideos.length).toFixed(0);
    console.log(`Vídeos: ${doneVideos.length}/${report.jobs.filter(j=>j.modo==='video').length} OK | avg=${avgV}s`);
  }

  // Testes UI
  console.log('\nTESTES UI:');
  for (const t of report.uitests) {
    console.log(`${t.passed ? 'OK' : 'FAIL'} | ${t.teste}${t.detalhe ? ' — ' + t.detalhe : ''}`);
  }
  const uiPass = report.uitests.filter(t => t.passed).length;
  const uiTotal = report.uitests.length;
  console.log(`\nUI: ${uiPass}/${uiTotal} passed`);

  // Erros
  if (report.errors.length > 0) {
    console.log('\nERROS:');
    report.errors.forEach(e => console.log(`  - ${e}`));
  }
  if (report.consoleErrors.length > 0) {
    console.log(`\nConsole errors: ${report.consoleErrors.length}`);
    report.consoleErrors.slice(0, 10).forEach(e => console.log(`  - ${e.substring(0, 120)}`));
  }

  console.log(`\nScreenshots em: ${SCREENSHOTS}`);

  // Salvar relatório JSON
  const reportPath = path.join(SCREENSHOTS, 'relatorio-d5.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Relatório JSON: ${reportPath}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  finalize();
  process.exit(1);
});
