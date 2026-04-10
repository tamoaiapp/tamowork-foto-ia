/**
 * Stress Test D2 — TamoWork Foto IA
 * Conta: test-stress-d2@tamowork.test
 * Viewport: 1440x900 | headless: true
 * Data: 2026-04-08
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'test-stress-d2@tamowork.test';
const PASSWORD = 'StressD2@2026';
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d2';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const PHOTO_IMAGE_URL = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800';
const PRODUCT_NAME = 'Relógio dourado premium';
const SCENARIO = 'mesa de escritório moderna';
const PHOTO_ITERATIONS = 5;
const VIDEO_ITERATIONS = 2;

// --- Estado global ---
const report = {
  timestamp: new Date().toISOString(),
  jobs: [],        // { job#, mode, tempo_seg, status, erro }
  uiChecks: [],    // { name, passed, detail }
  errors: [],
  consoleErrors: [],
  supabaseJobs: [],
};

let jobCounter = 0;
let testUserId = null;

// --- Utilitários ---
function log(msg) {
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`[${ts}] ${msg}`);
}

function uiCheck(name, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  report.uiChecks.push({ name, passed, detail });
  log(`${icon} UI: ${name}${detail ? ' — ' + detail : ''}`);
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
    const follow = (u, depth = 0) => {
      if (depth > 5) return reject(new Error('Too many redirects'));
      const proto = u.startsWith('https') ? https : http;
      proto.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, depth + 1);
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function supabaseReq(method, urlPath, body, useServiceKey = true) {
  const key = useServiceKey ? SERVICE_KEY : ANON_KEY;
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
  const res = await fetch(`${SUPABASE_URL}${urlPath}`, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

// --- Setup: Criar usuário + PRO ---
async function setupUser() {
  log('=== SETUP: Provisionar conta PRO ===');

  // 1. Criar usuário via Admin API
  log(`Criando usuário ${EMAIL}...`);
  const createRes = await supabaseReq('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  log(`Create user: status=${createRes.status} data=${JSON.stringify(createRes.data).slice(0, 200)}`);

  if (createRes.status === 200 || createRes.status === 201) {
    testUserId = createRes.data.id;
    log(`Usuário criado: ${testUserId}`);
  } else if (createRes.status === 422 || createRes.status === 400) {
    // Usuário já existe — buscar via listagem
    log('Usuário já existe, buscando ID...');
    const listRes = await supabaseReq('GET', '/auth/v1/admin/users?per_page=1000', null);
    if (listRes.status === 200 && Array.isArray(listRes.data.users)) {
      const found = listRes.data.users.find(u => u.email === EMAIL);
      if (found) {
        testUserId = found.id;
        log(`Usuário encontrado: ${testUserId}`);
      }
    }
    if (!testUserId) {
      // Tenta login para obter o ID via token
      log('Tentando obter ID via login...');
      const loginRes = await supabaseReq('POST', '/auth/v1/token?grant_type=password', {
        email: EMAIL,
        password: PASSWORD,
      }, false);
      if (loginRes.status === 200 && loginRes.data.user) {
        testUserId = loginRes.data.user.id;
        log(`ID obtido via login: ${testUserId}`);
      }
    }
  }

  if (!testUserId) {
    log('ERRO CRÍTICO: Não foi possível obter o user_id. Abortando.');
    process.exit(1);
  }

  // 2. Promover para PRO (upsert)
  log(`Promovendo user_id=${testUserId} para PRO...`);
  const periodEnd = '2027-12-31T23:59:59Z';

  // Verificar se já existe
  const existsRes = await supabaseReq('GET', `/rest/v1/user_plans?user_id=eq.${testUserId}&select=*`, null);
  let proOk = false;

  if (existsRes.status === 200 && Array.isArray(existsRes.data) && existsRes.data.length > 0) {
    // PATCH
    const patch = await supabaseReq('PATCH', `/rest/v1/user_plans?user_id=eq.${testUserId}`, {
      plan: 'pro',
      period_end: periodEnd,
      updated_at: new Date().toISOString(),
    });
    proOk = patch.status >= 200 && patch.status < 300;
    log(`PATCH user_plans: status=${patch.status}`);
  } else {
    // POST
    const post = await supabaseReq('POST', '/rest/v1/user_plans', {
      user_id: testUserId,
      plan: 'pro',
      period_end: periodEnd,
      mp_subscription_id: 'stress-test-d2',
      updated_at: new Date().toISOString(),
    });
    proOk = post.status >= 200 && post.status < 300;
    log(`POST user_plans: status=${post.status} data=${JSON.stringify(post.data).slice(0, 200)}`);
  }

  uiCheck('Provisionar conta PRO', proOk, `user_id=${testUserId}`);
  return proOk;
}

// --- Login no app web ---
async function doLogin(page, screenshotPrefix = '') {
  log('=== LOGIN WEB ===');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-01-login-page`);

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Clicar "Usar e-mail e senha"
  const emailBtn = page.getByText('Usar e-mail e senha');
  if (await emailBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailBtn.click();
    await page.waitForTimeout(800);
  }

  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Garantir aba "Entrar"
  const enterTab = page.locator('button').filter({ hasText: /^Entrar$/ });
  if (await enterTab.count() > 0) {
    await enterTab.first().click();
    await page.waitForTimeout(400);
  }

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);

  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-02-login-filled`);

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // Aguardar redirect
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const urlAfter = page.url();
  const success = !urlAfter.includes('/login');
  log(`Login: ${success ? 'OK' : 'FALHOU'} — URL: ${urlAfter}`);
  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-03-after-login`);

  // Pular onboarding
  if (urlAfter.includes('/onboarding')) {
    log('Pulando onboarding...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  return success;
}

// --- Navegar ao criador de fotos ---
async function navigateToCreator(page) {
  log('Navegando para o criador (home)...');
  // Sempre navegar para home para garantir estado limpo
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Pular onboarding se aparecer
  if (page.url().includes('/onboarding')) {
    log('Pulando onboarding...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
  }

  // Clicar na aba "Criar" se existir
  const createTab = page.locator('button, a').filter({ hasText: /^Criar$/ }).first();
  if (await createTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createTab.click();
    await page.waitForTimeout(1000);
  }
}

// --- Selecionar modo "Foto em cena" ---
// Na UI real o card tem label "FOTO EM CENA" e subtítulo "Produto em ambiente real"
// O botão dentro do card é "Usar agora"
async function selectMode(page, screenshotPrefix = '') {
  log('Selecionando modo "Foto em cena / Produto em ambiente real"...');

  // Aguardar página carregar completamente
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Verificar se já estamos na tela do criador (com input de arquivo) — não na seleção de modos
  const fileInputExists = await page.locator('input[type="file"]').count() > 0;
  if (fileInputExists) {
    log('  Já estamos dentro de um modo (file input visível) — sem necessidade de selecionar');
    return true;
  }

  // Verificar se estamos na tela de seleção de modos ("O que você quer criar?")
  const body = await page.textContent('body').catch(() => '');
  log(`  Body snippet: ${body.slice(0, 200).replace(/\s+/g, ' ')}`);

  if (!body.includes('O que você quer criar') && !body.includes('escolha um modo')) {
    log('  Não estamos na tela de seleção de modo');
    if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-mode-wrong-page`);
  }

  // Estratégia 1: clicar no card "Produto em ambiente real" ou "Foto em cena"
  // O card tem um label "FOTO EM CENA" (pequeno) e subtítulo "Produto em ambiente real"
  // O botão dentro é "Usar agora"
  const cardTexts = [
    'Produto em ambiente real',
    'Foto em ambiente real',
    'FOTO EM CENA',
    'Foto em cena',
    'Você escolhe a cena',  // alternativa — "foto_em_cena" real
    'Escolha a cena',
  ];

  for (const text of cardTexts) {
    // Tentar via botão "Usar agora" próximo ao card
    const card = page.locator(`text="${text}"`).first();
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Clicar no botão "Usar agora" mais próximo do card
      const parent = card.locator('xpath=ancestor::div[contains(@class,"card") or contains(@class,"mode") or contains(@class,"item")][1]').first();
      const usarBtn = parent.locator('button:has-text("Usar agora")').first();
      if (await usarBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await usarBtn.click();
        await page.waitForTimeout(1200);
        log(`Modo selecionado via card "${text}" + botão "Usar agora"`);
        if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-mode-selected`);
        return true;
      }
      // Tentar clicar direto no card/texto
      await card.click();
      await page.waitForTimeout(1200);
      log(`Modo selecionado via clique em "${text}"`);
      if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-mode-selected`);
      // Verificar se entrou num sub-modo
      const nowHasFile = await page.locator('input[type="file"]').count() > 0;
      if (nowHasFile) return true;
    }
  }

  // Estratégia 2: localizar todos os botões "Usar agora" e clicar no segundo (Foto em cena costuma ser o 2º)
  const usarBtns = await page.locator('button:has-text("Usar agora")').all();
  log(`  Botões "Usar agora" encontrados: ${usarBtns.length}`);
  if (usarBtns.length >= 2) {
    // Índice 1 = segundo card (Produto em ambiente real / Foto em cena)
    await usarBtns[1].click();
    await page.waitForTimeout(1200);
    log('Modo selecionado via 2º botão "Usar agora"');
    if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-mode-selected`);
    return true;
  } else if (usarBtns.length === 1) {
    await usarBtns[0].click();
    await page.waitForTimeout(1200);
    log('Modo selecionado via 1º botão "Usar agora"');
    if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-mode-selected`);
    return true;
  }

  // Screenshot para debug
  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-mode-not-found`);
  log('Modo não encontrado — continuando sem selecionar');
  return false;
}

// --- Upload de imagem ---
async function uploadImage(page, imagePath, screenshotPrefix = '') {
  log(`Fazendo upload: ${imagePath}`);

  // Procurar input de arquivo
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(2000);
    log('Upload via input[type="file"]');
    if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-after-upload`);
    return true;
  }

  // Tentar via dropzone click
  const dropzone = page.locator('[class*="dropzone"], [class*="upload"], [class*="drop"]').first();
  if (await dropzone.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Criar file input temporário
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      dropzone.click(),
    ]);
    await fileChooser.setFiles(imagePath);
    await page.waitForTimeout(2000);
    log('Upload via dropzone');
    if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-after-upload`);
    return true;
  }

  log('AVISO: Nenhum input de arquivo encontrado');
  return false;
}

// --- Preencher campos de texto ---
async function fillFields(page, screenshotPrefix = '') {
  log(`Preenchendo: produto="${PRODUCT_NAME}", cenário="${SCENARIO}"`);

  // Campos reais observados na UI:
  // Campo 1: placeholder "Ex: bolo de chocolate artesanal com morango" → produto
  // Campo 2: placeholder "Ex: mesa rústica, estúdio com luz suave" → cenário

  const inputs = await page.locator('input[type="text"], input:not([type="hidden"]):not([type="email"]):not([type="password"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea').all();
  log(`Inputs visíveis: ${inputs.length}`);

  let productFilled = false;
  let scenarioFilled = false;

  for (let i = 0; i < inputs.length; i++) {
    const visible = await inputs[i].isVisible().catch(() => false);
    if (!visible) continue;
    const placeholder = await inputs[i].getAttribute('placeholder').catch(() => '');
    log(`  Input[${i}] placeholder="${placeholder}"`);

    const ph = placeholder.toLowerCase();
    if (!productFilled && (ph.includes('produto') || ph.includes('bolo') || ph.includes('o que') || i === 0)) {
      await inputs[i].triple_click().catch(() => {});
      await inputs[i].fill(PRODUCT_NAME);
      productFilled = true;
      log(`  → preenchido como produto`);
    } else if (!scenarioFilled && (ph.includes('cenário') || ph.includes('cena') || ph.includes('mesa') || ph.includes('ambiente') || i === 1)) {
      await inputs[i].triple_click().catch(() => {});
      await inputs[i].fill(SCENARIO);
      scenarioFilled = true;
      log(`  → preenchido como cenário`);
    }
  }

  // Fallback: preencher por posição se ainda não preencheu
  const visibleInputs = [];
  for (const inp of inputs) {
    if (await inp.isVisible().catch(() => false)) visibleInputs.push(inp);
  }
  if (!productFilled && visibleInputs.length > 0) {
    await visibleInputs[0].fill(PRODUCT_NAME);
    productFilled = true;
    log('  → produto preenchido (fallback posição 0)');
  }
  if (!scenarioFilled && visibleInputs.length > 1) {
    await visibleInputs[1].fill(SCENARIO);
    scenarioFilled = true;
    log('  → cenário preenchido (fallback posição 1)');
  }

  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-fields-filled`);
  log(`Campos: produto=${productFilled}, cenário=${scenarioFilled}`);
  return productFilled;
}

// --- Clicar em Gerar ---
async function clickGenerate(page) {
  // Texto real do botão na UI: "✨ Gerar foto com IA"
  const selectors = [
    'button:has-text("Gerar foto com IA")',
    'button:has-text("Gerar foto")',
    'button:has-text("Gerar")',
    'button:has-text("Criar foto")',
    'button:has-text("Generate")',
    'button[type="submit"]',
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const disabled = await btn.isDisabled().catch(() => false);
      if (!disabled) {
        await btn.click();
        log(`Botão gerar clicado: ${sel}`);
        return true;
      }
      log(`Botão "${sel}" encontrado mas desabilitado`);
    }
  }
  // Log do HTML dos botões visíveis para debug
  const allBtns = await page.locator('button').all();
  const btnTexts = [];
  for (const b of allBtns) {
    const visible = await b.isVisible().catch(() => false);
    if (visible) btnTexts.push(await b.textContent().catch(() => ''));
  }
  log(`AVISO: Botão de gerar não encontrado. Botões visíveis: ${btnTexts.map(t => `"${t.trim()}"`).join(', ')}`);
  return false;
}

// --- Aguardar conclusão do job ---
async function waitForJobComplete(page, timeoutMs = 300000) {
  const start = Date.now();
  log('Aguardando job completar...');

  // Indicadores de CONCLUSÃO — baseados na UI real observada:
  // A tela de processamento mostra "Transformando sua foto..." + botão "Processando..."
  // Quando termina: mostra a imagem gerada + botões de ação (Baixar, Editar, etc.)
  const doneBtnSelectors = [
    // Botões de ação pós-geração
    'button:has-text("Baixar foto")',
    'button:has-text("Baixar imagem")',
    'button:has-text("Baixar")',
    'a:has-text("Baixar foto")',
    'a:has-text("Baixar")',
    'a[download]',
    // Botão de criar vídeo (aparece após foto pronta)
    'button:has-text("Criar vídeo")',
    'button:has-text("Criar Vídeo")',
    // Link para nova foto
    'button:has-text("Nova foto")',
    'a:has-text("Nova foto")',
    // Resultado com imagem — img com src do supabase (output)
  ];

  // Indicadores de ERRO específicos da UI
  const failBtnSelectors = [
    'button:has-text("Tentar novamente")',
    'button:has-text("Tentar de novo")',
  ];
  const failTextExact = [
    'Falha ao gerar',
    'Erro ao gerar',
    'Não foi possível',
    'Tente novamente',
    'falhou',
  ];

  // Indicadores de AINDA PROCESSANDO
  const processingTexts = [
    'Transformando sua foto',
    'Processando...',
    'Aguarde',
    'Gerando',
    'Enviando',
  ];

  // Aguardar pelo menos 10s antes de verificar (deixar o submit processar)
  await page.waitForTimeout(10000);

  while (Date.now() - start < timeoutMs) {
    const body = await page.textContent('body').catch(() => '');

    // Verificar botões de done
    for (const sel of doneBtnSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        const elapsed = (Date.now() - start) / 1000;
        log(`Job concluído em ${elapsed.toFixed(1)}s — selector: "${sel}"`);
        return { status: 'done', elapsed };
      }
    }

    // Verificar imagem de resultado (img com URL do supabase storage/output)
    const resultImg = page.locator('img[src*="image-jobs"], img[src*="output"], img[src*="storage"]').first();
    if (await resultImg.isVisible({ timeout: 500 }).catch(() => false)) {
      const src = await resultImg.getAttribute('src').catch(() => '');
      if (src && (src.includes('image-jobs') || src.includes('output'))) {
        const elapsed = (Date.now() - start) / 1000;
        log(`Job concluído em ${elapsed.toFixed(1)}s — imagem resultado detectada: ${src.slice(0,80)}`);
        return { status: 'done', elapsed };
      }
    }

    // Verificar erro
    for (const sel of failBtnSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        const elapsed = (Date.now() - start) / 1000;
        log(`Job falhou em ${elapsed.toFixed(1)}s — "${sel}"`);
        return { status: 'failed', elapsed };
      }
    }
    for (const t of failTextExact) {
      if (body.includes(t)) {
        const elapsed = (Date.now() - start) / 1000;
        log(`Job falhou em ${elapsed.toFixed(1)}s — texto: "${t}"`);
        return { status: 'failed', elapsed };
      }
    }

    const inProgress = processingTexts.some(t => body.includes(t));
    log(`  ... ${inProgress ? 'processando' : 'aguardando'} (${((Date.now() - start) / 1000).toFixed(0)}s)`);

    await page.waitForTimeout(8000);
  }

  const elapsed = (Date.now() - start) / 1000;
  log(`Job timeout após ${elapsed.toFixed(1)}s`);
  return { status: 'timeout', elapsed };
}

// --- Testar botão Baixar ---
async function testDownload(page, screenshotPrefix = '') {
  log('Testando botão Baixar...');
  // Vários seletores possíveis para o botão de download
  const selectors = [
    'a[download]',
    'button:has-text("Baixar foto")',
    'button:has-text("Baixar imagem")',
    'button:has-text("Baixar")',
    'a:has-text("Baixar foto")',
    'a:has-text("Baixar imagem")',
    'a:has-text("Baixar")',
    'button:has-text("Download")',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      uiCheck('Botão Baixar visível', true, sel);
      if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-download-btn`);
      return true;
    }
  }
  // Screenshot para debug se não encontrado
  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-download-not-found`);
  uiCheck('Botão Baixar visível', false, 'Não encontrado — ver screenshot');
  return false;
}

// --- Testar botão Editar ---
async function testEdit(page, screenshotPrefix = '') {
  log('Testando botão Editar...');
  const selectors = [
    'button:has-text("Editar")',
    'a:has-text("Editar")',
    'button:has-text("Abrir editor")',
    'a:has-text("Abrir editor")',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      uiCheck('Botão Editar visível', true, sel);
      if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-edit-btn`);
      return true;
    }
  }
  uiCheck('Botão Editar visível', false, 'Não encontrado');
  return false;
}

// --- Testar criação de vídeo ---
async function testCreateVideo(page, iteration, screenshotPrefix = '') {
  log(`=== CRIAR VÍDEO #${iteration} ===`);
  const start = Date.now();
  jobCounter++;
  const jobNum = jobCounter;
  const jobEntry = { job: jobNum, mode: 'video', tempo_seg: null, status: 'pendente', erro: '' };
  report.jobs.push(jobEntry);

  // Clicar no botão "Criar vídeo"
  const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("Criar Vídeo"), button:has-text("Gerar vídeo")').first();
  const videoVisible = await videoBtn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!videoVisible) {
    jobEntry.status = 'skipped';
    jobEntry.erro = 'Botão "Criar vídeo" não encontrado';
    log('Botão "Criar vídeo" não encontrado — pulando');
    return;
  }

  await videoBtn.click();
  await page.waitForTimeout(1500);
  await screenshot(page, `${screenshotPrefix}-video-${iteration}-modal`);

  // Preencher prompt de vídeo
  const promptSelectors = [
    'textarea[placeholder*="prompt"]',
    'textarea[placeholder*="vídeo"]',
    'textarea[placeholder*="animação"]',
    'input[placeholder*="prompt"]',
    'textarea',
  ];

  let promptFilled = false;
  for (const sel of promptSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.fill('Relógio girando suavemente sobre mesa de escritório, luz natural, movimento elegante');
      promptFilled = true;
      log(`Prompt de vídeo preenchido: ${sel}`);
      break;
    }
  }

  await screenshot(page, `${screenshotPrefix}-video-${iteration}-prompt`);

  // Clicar em gerar vídeo
  const genVideoBtn = page.locator('button:has-text("Gerar vídeo"), button:has-text("Gerar"), button:has-text("Criar")').first();
  if (await genVideoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await genVideoBtn.click();
    log('Botão gerar vídeo clicado');
    await page.waitForTimeout(3000);
  } else {
    jobEntry.status = 'skipped';
    jobEntry.erro = 'Botão gerar vídeo não encontrado';
    log('Botão gerar vídeo não encontrado');
    return;
  }

  // Aguardar resultado
  const result = await waitForJobComplete(page, 600000); // 10min timeout para vídeo
  const elapsed = (Date.now() - start) / 1000;
  jobEntry.tempo_seg = elapsed.toFixed(1);
  jobEntry.status = result.status;
  await screenshot(page, `${screenshotPrefix}-video-${iteration}-result`);
  log(`Vídeo #${iteration}: ${result.status} em ${elapsed.toFixed(1)}s`);
}

// --- Verificar bloqueio de envio duplo ---
async function checkDuplicateBlock(page, screenshotPrefix = '') {
  log('Verificando bloqueio de envio duplo...');
  const body = await page.textContent('body').catch(() => '');
  const genBtn = page.locator('button:has-text("Gerar foto"), button:has-text("Gerar")').first();
  const isDisabled = await genBtn.isDisabled().catch(() => true);
  const hasBlockMsg = body.includes('Gerando') || body.includes('Aguarde') || body.includes('processando');
  const blocked = isDisabled || hasBlockMsg;
  uiCheck('Job ativo bloqueia novo envio', blocked, isDisabled ? 'botão desabilitado' : hasBlockMsg ? 'mensagem de espera' : 'não verificável');
  if (screenshotPrefix) await screenshot(page, `${screenshotPrefix}-duplicate-block`);
}

// --- Verificar página de Criações ---
async function checkCreationsPage(page, screenshotPrefix = '') {
  log('Verificando página /criacoes...');
  await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  await screenshot(page, `${screenshotPrefix}-criacoes-page`);

  const url = page.url();
  const body = await page.textContent('body').catch(() => '');

  // Verificar se há jobs listados
  const hasJobs = body.includes('Baixar') || body.includes('jpg') || body.includes('png')
    || body.includes('Relógio') || body.includes('done') || body.includes('processando')
    || body.includes('Concluído') || body.includes('job') || body.includes('foto');

  uiCheck('/criacoes carrega', !url.includes('/login'), `URL: ${url}`);
  uiCheck('/criacoes lista jobs', hasJobs, `tem conteúdo de jobs: ${hasJobs}`);
}

// --- Verificar navegação entre abas ---
async function checkTabNavigation(page, screenshotPrefix = '') {
  log('Verificando navegação entre abas...');

  const tabs = ['Criar', 'Editor', 'Criações'];
  for (const tab of tabs) {
    const tabEl = page.getByText(tab).first();
    if (await tabEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tabEl.click();
      await page.waitForTimeout(1500);
      await screenshot(page, `${screenshotPrefix}-tab-${tab.toLowerCase()}`);
      uiCheck(`Aba "${tab}" clicável`, true);
    } else {
      uiCheck(`Aba "${tab}" clicável`, false, 'Não encontrada');
    }
  }
}

// --- Testar logout e re-login ---
async function checkLogoutLogin(page, screenshotPrefix = '') {
  log('Testando logout...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Procurar botão logout (menu, avatar, etc.)
  const logoutSelectors = [
    'button:has-text("Sair")',
    'a:has-text("Sair")',
    'button:has-text("Logout")',
    'a:has-text("Logout")',
    '[aria-label="logout"]',
    '[data-testid="logout"]',
  ];

  let logoutOk = false;
  for (const sel of logoutSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(3000);
      logoutOk = true;
      log(`Logout clicado: ${sel}`);
      break;
    }
  }

  if (!logoutOk) {
    // Tentar via menu/avatar
    const avatar = page.locator('[class*="avatar"], [class*="user"], [class*="profile"]').first();
    if (await avatar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatar.click();
      await page.waitForTimeout(1000);
      await screenshot(page, `${screenshotPrefix}-avatar-menu`);
      for (const sel of logoutSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click();
          await page.waitForTimeout(3000);
          logoutOk = true;
          break;
        }
      }
    }
  }

  if (!logoutOk) {
    // Navegar diretamente para /login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    logoutOk = page.url().includes('/login');
    log('Logout forçado via navegação para /login');
  }

  await screenshot(page, `${screenshotPrefix}-after-logout`);
  uiCheck('Logout funciona', logoutOk, `URL: ${page.url()}`);

  // Re-login
  const loginOk = await doLogin(page, `${screenshotPrefix}-relogin`);
  uiCheck('Re-login após logout', loginOk, `URL: ${page.url()}`);
}

// --- Consultar jobs no Supabase ---
async function fetchSupabaseJobs() {
  log('=== Consultando jobs no Supabase ===');
  const res = await supabaseReq('GET', '/rest/v1/image_jobs?order=created_at.desc&limit=30', null);
  if (res.status === 200 && Array.isArray(res.data)) {
    report.supabaseJobs = res.data;
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const done = res.data.filter(j => j.status === 'done').length;
    const failed = res.data.filter(j => j.status === 'failed').length;
    const staleQueued = res.data.filter(j =>
      (j.status === 'pending' || j.status === 'queued') && j.created_at < tenMinAgo
    ).length;

    log(`Supabase jobs (últimos 30): done=${done}, failed=${failed}, queued_stale=${staleQueued}`);
    return { done, failed, staleQueued };
  }
  log(`Erro ao consultar jobs: status=${res.status}`);
  return null;
}

// --- Executar 1 ciclo de foto ---
async function runPhotoIteration(page, iteration, screenshotPrefix = '') {
  log(`\n=== FOTO ITERAÇÃO #${iteration} ===`);
  const start = Date.now();
  jobCounter++;
  const jobNum = jobCounter;
  const jobEntry = { job: jobNum, mode: 'foto_em_cena', tempo_seg: null, status: 'pendente', erro: '' };
  report.jobs.push(jobEntry);

  try {
    // Navegar ao criador
    await navigateToCreator(page);
    await page.waitForTimeout(1500);
    await screenshot(page, `${screenshotPrefix}-${iteration}-01-creator`);

    // Selecionar modo
    const modeOk = await selectMode(page, `${screenshotPrefix}-${iteration}`);
    if (!modeOk) jobEntry.erro += '[modo não encontrado] ';

    await page.waitForTimeout(1000);

    // Upload imagem
    const imagePath = path.join(SCREENSHOTS, 'relogio-teste.jpg');
    const uploadOk = await uploadImage(page, imagePath, `${screenshotPrefix}-${iteration}`);
    if (!uploadOk) jobEntry.erro += '[upload falhou] ';

    await page.waitForTimeout(1500);

    // Preencher campos
    const fieldsOk = await fillFields(page, `${screenshotPrefix}-${iteration}`);
    if (!fieldsOk) jobEntry.erro += '[campos não preenchidos] ';

    await page.waitForTimeout(500);
    await screenshot(page, `${screenshotPrefix}-${iteration}-02-before-generate`);

    // Verificar bloqueio duplo ANTES de gerar (só na primeira iteração)
    if (iteration === 1) {
      // Não há job ativo ainda, mas verificamos o estado do botão
      log('Verificação pré-geração de estado do botão...');
    }

    // Gerar
    const genOk = await clickGenerate(page);
    if (!genOk) {
      jobEntry.status = 'skipped';
      jobEntry.erro += '[botão gerar não encontrado]';
      await screenshot(page, `${screenshotPrefix}-${iteration}-generate-failed`);
      return jobEntry;
    }

    await page.waitForTimeout(2000);
    await screenshot(page, `${screenshotPrefix}-${iteration}-03-generating`);

    // Verificar bloqueio de duplicata (durante processamento)
    if (iteration === 1) {
      await checkDuplicateBlock(page, `${screenshotPrefix}-dup-check`);
    }

    // Aguardar resultado
    const result = await waitForJobComplete(page, 300000);
    const elapsed = (Date.now() - start) / 1000;
    jobEntry.tempo_seg = elapsed.toFixed(1);
    jobEntry.status = result.status;

    await screenshot(page, `${screenshotPrefix}-${iteration}-04-result`);
    log(`Foto #${iteration}: ${result.status} em ${elapsed.toFixed(1)}s`);

    // Testar botões de resultado
    if (result.status === 'done') {
      await testDownload(page, `${screenshotPrefix}-${iteration}`);
      await testEdit(page, `${screenshotPrefix}-${iteration}`);

      // Verificar botão "Criar vídeo"
      const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("Criar Vídeo")').first();
      const hasVideoBtn = await videoBtn.isVisible({ timeout: 3000 }).catch(() => false);
      uiCheck(`Botão "Criar vídeo" visível (foto #${iteration})`, hasVideoBtn);
    }

    return jobEntry;
  } catch (e) {
    const elapsed = (Date.now() - start) / 1000;
    jobEntry.tempo_seg = elapsed.toFixed(1);
    jobEntry.status = 'error';
    jobEntry.erro += e.message;
    report.errors.push(`Foto #${iteration}: ${e.message}`);
    log(`ERRO na iteração #${iteration}: ${e.message}`);
    await screenshot(page, `${screenshotPrefix}-${iteration}-error`).catch(() => {});
    return jobEntry;
  }
}

// --- Gerar relatório final ---
function printReport(supabaseStats) {
  console.log('\n' + '='.repeat(70));
  console.log('RELATÓRIO STRESS TEST D2 — TamoWork Foto IA');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`User: ${EMAIL} (${testUserId})`);
  console.log(`Screenshots: ${SCREENSHOTS}`);
  console.log('');

  // Tabela de jobs
  console.log('TABELA DE JOBS:');
  console.log('-'.repeat(65));
  console.log('Job# | Modo              | Tempo(s) | Status    | Erro');
  console.log('-'.repeat(65));
  for (const j of report.jobs) {
    const job = String(j.job).padEnd(4);
    const mode = j.mode.padEnd(17);
    const tempo = (j.tempo_seg ?? '--').toString().padEnd(8);
    const status = j.status.padEnd(9);
    const erro = j.erro || '-';
    console.log(`${job} | ${mode} | ${tempo} | ${status} | ${erro}`);
  }
  console.log('-'.repeat(65));

  // Métricas
  const fotoJobs = report.jobs.filter(j => j.mode === 'foto_em_cena' && j.tempo_seg && j.status === 'done');
  const videoJobs = report.jobs.filter(j => j.mode === 'video' && j.tempo_seg && j.status === 'done');

  const avgFoto = fotoJobs.length > 0
    ? (fotoJobs.reduce((s, j) => s + parseFloat(j.tempo_seg), 0) / fotoJobs.length).toFixed(1)
    : 'N/A';
  const avgVideo = videoJobs.length > 0
    ? (videoJobs.reduce((s, j) => s + parseFloat(j.tempo_seg), 0) / videoJobs.length).toFixed(1)
    : 'N/A';

  const totalErrors = report.jobs.filter(j => j.status === 'error' || j.status === 'failed' || j.status === 'timeout').length;
  const skipped = report.jobs.filter(j => j.status === 'skipped').length;

  console.log('\nMÉTRICAS:');
  console.log(`  Média tempo foto:     ${avgFoto}s (${fotoJobs.length} jobs concluídos)`);
  console.log(`  Média tempo vídeo:    ${avgVideo}s (${videoJobs.length} jobs concluídos)`);
  console.log(`  Total erros/timeout:  ${totalErrors}`);
  console.log(`  Jobs pulados:         ${skipped}`);

  // UI Checks
  console.log('\nUI CHECKS:');
  for (const c of report.uiChecks) {
    const icon = c.passed ? '✅' : '❌';
    console.log(`  ${icon} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  }

  // Supabase
  if (supabaseStats) {
    console.log('\nSUPABASE (últimos 30 jobs):');
    console.log(`  done:        ${supabaseStats.done}`);
    console.log(`  failed:      ${supabaseStats.failed}`);
    console.log(`  queued >10m: ${supabaseStats.staleQueued}`);
  }

  // Erros
  if (report.errors.length > 0) {
    console.log('\nERROS:');
    for (const e of report.errors) {
      console.log(`  ❌ ${e}`);
    }
  }

  if (report.consoleErrors.length > 0) {
    console.log(`\nConsole errors no browser: ${report.consoleErrors.length}`);
    report.consoleErrors.slice(0, 5).forEach(e => console.log(`  ${e}`));
  }

  console.log('\n' + '='.repeat(70));

  // Salvar JSON
  const reportPath = path.join(SCREENSHOTS, 'stress-report-d2.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Relatório JSON: ${reportPath}`);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // 1. Setup: provisionar conta PRO
  const setupOk = await setupUser();
  if (!setupOk) {
    log('AVISO: Setup PRO pode ter falhado, continuando mesmo assim...');
  }

  // 2. Baixar imagem de teste
  const imagePath = path.join(SCREENSHOTS, 'relogio-teste.jpg');
  if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size < 5000) {
    log('Baixando foto do relógio...');
    try {
      await downloadFile(PHOTO_IMAGE_URL, imagePath);
      log(`Foto baixada: ${fs.statSync(imagePath).size} bytes`);
    } catch (e) {
      log(`Erro ao baixar foto: ${e.message}`);
      // Criar imagem de fallback (pixel branco JPEG mínimo)
      report.errors.push(`Download da imagem falhou: ${e.message}`);
    }
  } else {
    log(`Usando foto existente: ${fs.statSync(imagePath).size} bytes`);
  }

  // 3. Iniciar browser
  log('Iniciando browser Chromium (headless, 1440x900)...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });

  let supabaseStats = null;

  try {
    // 4. Login inicial
    const loginOk = await doLogin(page, 'initial');
    uiCheck('Login inicial', loginOk, `URL: ${page.url()}`);

    if (!loginOk) {
      log('Login falhou. Verificando estado da página...');
      const body = await page.textContent('body').catch(() => '');
      log(`Conteúdo: ${body.slice(0, 500)}`);
      await screenshot(page, 'login-failed-debug');
    }

    // 5. Navegar entre abas
    log('\n=== UI CHECK: Navegação entre abas ===');
    await checkTabNavigation(page, 'nav');

    // 6. FOTOS — 5 iterações
    log('\n=== INICIANDO 5 ITERAÇÕES DE FOTO ===');
    for (let i = 1; i <= PHOTO_ITERATIONS; i++) {
      await runPhotoIteration(page, i, 'foto');
      // Pequena pausa entre iterações para não sobrecarregar
      if (i < PHOTO_ITERATIONS) {
        log(`Aguardando 3s antes da próxima iteração...`);
        await page.waitForTimeout(3000);
        // Voltar para home antes da próxima iteração
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // 7. VÍDEOS — 2 iterações
    log('\n=== INICIANDO 2 ITERAÇÕES DE VÍDEO ===');
    // Gerar uma foto primeiro para ter base para o vídeo
    await navigateToCreator(page);
    await page.waitForTimeout(1500);
    await selectMode(page);
    const imagePath2 = path.join(SCREENSHOTS, 'relogio-teste.jpg');
    await uploadImage(page, imagePath2);
    await page.waitForTimeout(1000);
    await fillFields(page);
    await clickGenerate(page);
    log('Aguardando foto para base do vídeo...');
    const baseResult = await waitForJobComplete(page, 300000);
    log(`Foto base: ${baseResult.status}`);

    if (baseResult.status === 'done') {
      for (let i = 1; i <= VIDEO_ITERATIONS; i++) {
        await testCreateVideo(page, i, 'video');
        if (i < VIDEO_ITERATIONS) {
          await page.waitForTimeout(3000);
        }
      }
    } else {
      log('Foto base não completou — vídeos serão tentados mesmo assim');
      for (let i = 1; i <= VIDEO_ITERATIONS; i++) {
        await testCreateVideo(page, i, 'video');
        if (i < VIDEO_ITERATIONS) await page.waitForTimeout(3000);
      }
    }

    // 8. Verificar página /criacoes
    log('\n=== UI CHECK: Página /criacoes ===');
    await checkCreationsPage(page, 'criacoes');

    // 9. Logout + re-login
    log('\n=== UI CHECK: Logout + Re-login ===');
    await checkLogoutLogin(page, 'logout');

    // 10. Consultar Supabase
    supabaseStats = await fetchSupabaseJobs();

    // 11. Screenshot final
    await screenshot(page, 'final-state');

  } catch (e) {
    log(`ERRO GLOBAL: ${e.message}`);
    report.errors.push(`Global: ${e.message}`);
    await screenshot(page, 'global-error').catch(() => {});
  } finally {
    await browser.close();
  }

  // 12. Relatório
  printReport(supabaseStats);
}

main().catch(e => {
  console.error('FALHA FATAL:', e);
  process.exit(1);
});
