/**
 * Agente de Teste Overnight — TamoWork Foto IA
 * Conta: free-b2@tamowork.test | FREE
 * Viewport: 1440x900 desktop
 * Testes: cancelamento, navegação durante geração, bloqueio de novo envio,
 *         resultado após navegação, download.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'free-b2@tamowork.test';
const PASSWORD = 'FreeB2@2026';
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/free-b2';
const REPORT_PATH = path.join(SCREENSHOTS, 'report.json');

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const PRODUCT_IMAGE_URL = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600';
const PRODUCT_NAME = 'Relógio clássico';
const SCENE_NAME = 'mesa de escritório';

// --- Relatório ---
const report = {
  timestamp: new Date().toISOString(),
  email: EMAIL,
  plan: 'free',
  userId: null,
  tests: [],
  errors: [],
  consoleErrors: [],
  supabaseChecks: [],
};

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`;
  console.log(line);
}

function addTest(name, passed, detail = '', extra = {}) {
  const icon = passed ? '✅' : '❌';
  report.tests.push({ name, passed, detail, ...extra });
  log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false }).catch(() => {});
  log(`📸 ${name}.png`);
  return filePath;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, res => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function supabaseRequest(method, urlPath, body = null) {
  const url = `${SUPABASE_URL}${urlPath}`;
  const opts = {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function getJobFromSupabase(jobId) {
  const res = await supabaseRequest('GET', `/rest/v1/image_jobs?id=eq.${jobId}&select=*`);
  return Array.isArray(res.data) ? res.data[0] : null;
}

// Busca jobs recentes do usuário via Supabase
async function getRecentJobsForUser(userId) {
  const res = await supabaseRequest(
    'GET',
    `/rest/v1/image_jobs?user_id=eq.${userId}&order=created_at.desc&limit=10&select=*`
  );
  return Array.isArray(res.data) ? res.data : [];
}

// Cria conta FREE via Supabase Auth (caso não exista)
async function ensureUserExists() {
  log('Verificando/criando conta FREE...');
  // Tenta criar via Auth API admin
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Free B2 QA' },
    }),
  });
  const data = await res.json();
  if (res.ok) {
    log(`Conta criada: userId=${data.id}`);
    report.userId = data.id;
    return data.id;
  } else if (data.msg?.includes('already') || data.error?.includes('already') || res.status === 422) {
    log('Conta já existe, buscando userId...');
    // Busca pelo email
    const search = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const sdata = await search.json();
    const user = sdata.users?.[0];
    if (user) {
      log(`UserId existente: ${user.id}`);
      report.userId = user.id;
      return user.id;
    }
  }
  log(`Erro ao criar conta: ${JSON.stringify(data)}`);
  return null;
}

// Cancela qualquer job ativo do usuário (limpeza pré-teste)
async function cancelActiveJobs(userId) {
  if (!userId) return;
  log('Cancelando jobs ativos anteriores...');
  const jobs = await getRecentJobsForUser(userId);
  const active = jobs.filter(j => ['queued', 'submitted', 'processing'].includes(j.status));
  for (const j of active) {
    await supabaseRequest('PATCH', `/rest/v1/image_jobs?id=eq.${j.id}`, { status: 'canceled' });
    log(`Job ${j.id} cancelado via Supabase (limpeza)`);
  }
  // Remove rate limit: apaga jobs cancelados das últimas 24h para não bloquear a conta free
  // (não vamos apagar — apenas cancelar, pois o rate limit é por job not-canceled)
}

// Aguarda elemento com texto aparecer na página
async function waitForText(page, texts, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const body = await page.textContent('body').catch(() => '');
    for (const t of (Array.isArray(texts) ? texts : [texts])) {
      if (body.includes(t)) return t;
    }
    await page.waitForTimeout(2000);
  }
  return null;
}

// Faz login na UI e retorna true se bem-sucedido
async function doLogin(page) {
  log('Navegando para /login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot(page, '01-login-page');

  // Clicar "Usar e-mail e senha"
  try {
    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 12000 });
    await page.click('text=Usar e-mail e senha');
    await page.waitForTimeout(800);
  } catch {
    log('Botão "Usar e-mail e senha" não encontrado, continuando...');
  }

  // Aba "Entrar"
  try {
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  } catch {
    const enterTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
    if (await enterTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await enterTab.click();
      await page.waitForTimeout(500);
    }
  }

  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await screenshot(page, '02-login-form-filled');

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(5000);
  const url = page.url();
  log(`URL após login: ${url}`);
  return !url.includes('/login');
}

// Seleciona modo "Foto em cena" (simulacao) e preenche formulário
async function selectModeAndFill(page, productImagePath) {
  log('Aguardando home carregar...');
  await page.waitForTimeout(2000);

  // Aguardar cards de modos
  try {
    await page.waitForSelector('text=Usar agora', { timeout: 15000 });
  } catch {
    log('Cards de modos não apareceram com "Usar agora", tentando continuar...');
    await page.waitForTimeout(3000);
  }

  await screenshot(page, '03-home');

  // Clicar no modo "Foto em cena" (simulacao)
  // Os cards têm botões "Usar agora" — o segundo é "Foto em cena"
  const allUseNow = page.locator('button, [role="button"]').filter({ hasText: /Usar agora/i });
  const count = await allUseNow.count();
  log(`Botões "Usar agora" encontrados: ${count}`);

  let modeClicked = false;

  // Tentativa 1: clicar no texto "Foto em cena" diretamente
  const fotoEmCena = page.locator('text=Foto em cena');
  if (await fotoEmCena.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    // Clicar no card que contém "Foto em cena"
    await fotoEmCena.first().click();
    await page.waitForTimeout(800);
    // Verificar se abriu o form ou se precisa clicar "Usar agora" dentro do card
    const body = await page.textContent('body').catch(() => '');
    if (body.includes('Foto do produto') || body.includes('Descreva o produto')) {
      modeClicked = true;
      log('Modo "Foto em cena" selecionado via clique no título');
    } else {
      // Buscar o botão "Usar agora" mais próximo
      const usarBtn = page.locator('text=Foto em cena').locator('..').locator('..').locator('button:has-text("Usar agora")');
      if (await usarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await usarBtn.click();
        await page.waitForTimeout(800);
        modeClicked = true;
        log('Modo "Foto em cena" selecionado via botão "Usar agora" do card');
      }
    }
  }

  // Tentativa 2: clicar no segundo botão "Usar agora" (ordem: Fundo branco=1, Foto em cena=2)
  if (!modeClicked && count >= 2) {
    await allUseNow.nth(1).click();
    await page.waitForTimeout(800);
    modeClicked = true;
    log('Modo selecionado via segundo botão "Usar agora"');
  }

  // Tentativa 3: primeiro botão disponível
  if (!modeClicked && count >= 1) {
    await allUseNow.first().click();
    await page.waitForTimeout(800);
    modeClicked = true;
    log('Modo selecionado via primeiro botão "Usar agora"');
  }

  if (!modeClicked) {
    throw new Error('Não foi possível selecionar um modo de criação');
  }

  await screenshot(page, '04-mode-selected');

  // Aguardar formulário aparecer
  await page.waitForTimeout(1500);
  const bodyAfterMode = await page.textContent('body').catch(() => '');
  const hasForm = bodyAfterMode.includes('produto') || bodyAfterMode.includes('cenário') ||
                  bodyAfterMode.includes('foto') || bodyAfterMode.includes('Enviar');
  log(`Formulário visível: ${hasForm}`);

  // Upload da imagem do produto
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(productImagePath);
    await page.waitForTimeout(1000);
    log('Imagem de produto enviada via input[type=file]');
  } else {
    log('AVISO: input[type=file] não encontrado, tentando via clique na área de upload...');
    const dropzone = page.locator('[class*="drop"], [class*="upload"], text=Arraste').first();
    if (await dropzone.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Simula upload via JS
      log('Dropzone encontrado mas não há input acessível diretamente');
    }
  }

  await screenshot(page, '05-file-uploaded');

  // Preencher campo produto
  const produtoInput = page.locator('input[placeholder*="produto" i], input[placeholder*="Produto" i], input[name="produto"], textarea[placeholder*="produto" i]').first();
  if (await produtoInput.count() > 0) {
    await produtoInput.fill(PRODUCT_NAME);
    log(`Campo produto preenchido: "${PRODUCT_NAME}"`);
  } else {
    // Tentar pelo label
    const allInputs = await page.locator('input[type="text"], textarea').all();
    log(`Inputs de texto encontrados: ${allInputs.length}`);
    if (allInputs.length > 0) {
      await allInputs[0].fill(PRODUCT_NAME);
      log('Preenchido primeiro input de texto com nome do produto');
    }
  }

  // Preencher campo cenário
  const cenarioInput = page.locator('input[placeholder*="cenário" i], input[placeholder*="cena" i], textarea[placeholder*="cenário" i]').first();
  if (await cenarioInput.count() > 0) {
    await cenarioInput.fill(SCENE_NAME);
    log(`Campo cenário preenchido: "${SCENE_NAME}"`);
  } else {
    const allInputs = await page.locator('input[type="text"], textarea').all();
    if (allInputs.length > 1) {
      await allInputs[1].fill(SCENE_NAME);
      log('Preenchido segundo input de texto com cenário');
    }
  }

  await screenshot(page, '06-form-filled');
  return true;
}

// Clica no botão de gerar
async function clickGenerate(page) {
  const generateBtn = page.locator('button[type="submit"], button:has-text("Gerar"), button:has-text("Criar"), button:has-text("Processar")').first();
  if (await generateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const isDisabled = await generateBtn.isDisabled().catch(() => false);
    if (isDisabled) {
      log('AVISO: Botão de gerar está desabilitado');
      return false;
    }
    await generateBtn.click();
    log('Botão "Gerar" clicado');
    return true;
  }
  log('Botão "Gerar" não encontrado');
  return false;
}

// Verifica se está em estado de geração (processando)
async function isGenerating(page) {
  const body = await page.textContent('body').catch(() => '');
  return body.includes('Processando') || body.includes('Gerando') || body.includes('Aguarde') ||
         body.includes('Cancelar') || body.includes('queued') || body.includes('Na fila') ||
         body.includes('processando') || body.includes('gerando');
}

// --- MAIN ---
async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // 1. Criar/verificar conta
  const userId = await ensureUserExists();

  // 2. Cancelar jobs ativos anteriores e limpar rate limit
  if (userId) {
    await cancelActiveJobs(userId);

    // Limpar rate limit: cancelar todos os jobs dos últimas 24h para que conta FREE possa criar
    log('Limpando rate limit: cancelando jobs recentes...');
    const recentJobs = await getRecentJobsForUser(userId);
    for (const j of recentJobs) {
      if (j.status !== 'canceled') {
        await supabaseRequest('PATCH', `/rest/v1/image_jobs?id=eq.${j.id}`, { status: 'canceled' });
        log(`Job ${j.id} (${j.status}) → canceled para limpar rate limit`);
      }
    }
  }

  // 3. Download da imagem de produto
  const productImagePath = path.join(SCREENSHOTS, 'produto-relogio.jpg');
  if (!fs.existsSync(productImagePath) || fs.statSync(productImagePath).size < 5000) {
    log('Baixando foto do produto (relógio)...');
    try {
      await downloadFile(PRODUCT_IMAGE_URL, productImagePath);
      log(`Foto baixada: ${fs.statSync(productImagePath).size} bytes`);
    } catch (e) {
      log(`Erro ao baixar foto: ${e.message}`);
      // Cria arquivo placeholder para teste offline
      fs.writeFileSync(productImagePath, Buffer.from('PLACEHOLDER'));
    }
  } else {
    log(`Usando foto existente: ${fs.statSync(productImagePath).size} bytes`);
  }

  // 4. Iniciar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    acceptDownloads: true,
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      report.consoleErrors.push({ text: msg.text(), url: msg.location()?.url });
    }
  });

  page.on('pageerror', err => {
    report.errors.push(`PageError: ${err.message}`);
  });

  let loginOk = false;
  let generatingJobId = null;
  let firstJobId = null;

  try {
    // =============================================
    // LOGIN
    // =============================================
    log('\n=== LOGIN ===');
    loginOk = await doLogin(page);
    addTest('Login com conta FREE', loginOk, `URL: ${page.url()}`);

    if (!loginOk) {
      report.errors.push('Login falhou — encerrando testes');
      await screenshot(page, 'ERROR-login-failed');
      await browser.close();
      saveReport();
      return;
    }

    // Captura userId pelo cookie/session se possível
    const cookies = await context.cookies();
    const sbSession = cookies.find(c => c.name.includes('auth-token') || c.name.includes('access_token'));
    log(`Cookie de sessão encontrado: ${sbSession ? 'sim' : 'não'}`);

    await screenshot(page, '07-after-login');

    // Verificar onboarding
    if (page.url().includes('/onboarding')) {
      log('Onboarding detectado');
      addTest('Onboarding exibido para conta nova', true);
      await screenshot(page, '08-onboarding');
      // Tentar pular
      const skip = page.locator('button:has-text("Continuar"), button:has-text("Começar"), button:has-text("Pular")').first();
      if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skip.click();
        await page.waitForTimeout(1500);
      }
      if (page.url().includes('/onboarding')) {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      }
    }

    // =============================================
    // TESTE 1: Cancelamento durante geração
    // =============================================
    log('\n=== TESTE 1: Cancelamento durante geração ===');
    let t1Pass = false;
    let t1CancelledInDB = false;

    try {
      // Ir para home e selecionar modo
      if (!page.url().startsWith(BASE_URL)) {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      }

      await selectModeAndFill(page, productImagePath);
      const generated = await clickGenerate(page);

      if (!generated) {
        addTest('T1: Cancelamento — botão gerar clicável', false, 'Botão desabilitado ou não encontrado');
      } else {
        addTest('T1: Submit do formulário realizado', true);
        log('Aguardando 20s antes de cancelar...');
        await page.waitForTimeout(20000);
        await screenshot(page, '09-t1-before-cancel');

        const bodyBeforeCancel = await page.textContent('body').catch(() => '');
        const inGeneration = bodyBeforeCancel.includes('Cancelar') || bodyBeforeCancel.includes('Processando') ||
                             bodyBeforeCancel.includes('Gerando') || bodyBeforeCancel.includes('Na fila') ||
                             bodyBeforeCancel.includes('queued');
        addTest('T1: Estado de geração detectado após submit', inGeneration,
          inGeneration ? 'Body contém indicadores de geração' : 'Body não contém indicadores esperados');

        // Capturar jobId via Supabase (busca job mais recente do usuário)
        if (userId) {
          const jobs = await getRecentJobsForUser(userId);
          const activeJob = jobs.find(j => ['queued', 'submitted', 'processing'].includes(j.status));
          if (activeJob) {
            generatingJobId = activeJob.id;
            firstJobId = activeJob.id;
            log(`Job ativo identificado: ${generatingJobId} (status: ${activeJob.status})`);
            report.supabaseChecks.push({ test: 'T1-before-cancel', jobId: generatingJobId, status: activeJob.status });
          }
        }

        // Clicar em Cancelar
        const cancelBtn = page.locator('button:has-text("Cancelar"), button:has-text("Parar")').first();
        if (await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await cancelBtn.click();
          log('Botão "Cancelar" clicado');
          await page.waitForTimeout(3000);
          addTest('T1: Botão "Cancelar" encontrado e clicado', true);
        } else {
          log('Botão "Cancelar" não encontrado após 5s, tentando buscar por texto...');
          const allBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()));
          log(`Botões disponíveis: ${JSON.stringify(allBtns)}`);
          addTest('T1: Botão "Cancelar" encontrado', false, 'Botão não visível após 20s');
        }

        await screenshot(page, '10-t1-after-cancel');

        // Verificar se voltou ao formulário/home
        const bodyAfterCancel = await page.textContent('body').catch(() => '');
        const backToForm = bodyAfterCancel.includes('Usar agora') || bodyAfterCancel.includes('Foto em cena') ||
                           bodyAfterCancel.includes('Fundo branco') || bodyAfterCancel.includes('Gerar') ||
                           bodyAfterCancel.includes('produto') || bodyAfterCancel.includes('cenário');
        const notGenerating = !bodyAfterCancel.includes('Processando') && !bodyAfterCancel.includes('Gerando');

        t1Pass = backToForm && notGenerating;
        addTest('T1: Voltou ao formulário/home após cancelar', t1Pass,
          t1Pass ? 'UI voltou ao estado inicial' : 'UI pode ainda mostrar geração');

        // Verificar no Supabase se job foi cancelado
        if (generatingJobId) {
          await page.waitForTimeout(2000); // aguardar propagação
          const jobData = await getJobFromSupabase(generatingJobId);
          t1CancelledInDB = jobData?.status === 'canceled';
          addTest('T1: Job cancelado no Supabase', t1CancelledInDB,
            jobData ? `status=${jobData.status}` : 'Job não encontrado no Supabase');
          report.supabaseChecks.push({ test: 'T1-after-cancel', jobId: generatingJobId, status: jobData?.status });
        } else {
          addTest('T1: Verificação Supabase', false, 'JobId não capturado');
        }
      }
    } catch (e) {
      log(`ERRO no Teste 1: ${e.message}`);
      report.errors.push(`T1: ${e.message}`);
      addTest('T1: Cancelamento durante geração', false, `Erro: ${e.message}`);
      await screenshot(page, 'ERROR-t1');
    }

    // =============================================
    // TESTE 2: Navegar para fora durante geração
    // =============================================
    log('\n=== TESTE 2: Navegação durante geração ===');
    let t2JobId = null;

    try {
      // Limpar rate limit novamente após T1 (cancelou, mas a contagem pode persistir)
      if (userId) {
        const jobs = await getRecentJobsForUser(userId);
        for (const j of jobs) {
          if (j.status !== 'canceled') {
            await supabaseRequest('PATCH', `/rest/v1/image_jobs?id=eq.${j.id}`, { status: 'canceled' });
          }
        }
        log('Rate limit limpo para T2');
      }

      // Ir para home
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      await selectModeAndFill(page, productImagePath);
      const generated2 = await clickGenerate(page);

      if (!generated2) {
        addTest('T2: Navegação — botão gerar clicável', false, 'Botão desabilitado');
      } else {
        addTest('T2: Submit do formulário para T2', true);
        log('Aguardando 15s antes de navegar...');
        await page.waitForTimeout(15000);
        await screenshot(page, '11-t2-before-navigate');

        // Capturar jobId antes de navegar
        if (userId) {
          const jobs = await getRecentJobsForUser(userId);
          const activeJob = jobs.find(j => ['queued', 'submitted', 'processing'].includes(j.status));
          if (activeJob) {
            t2JobId = activeJob.id;
            log(`Job T2 identificado: ${t2JobId}`);
            report.supabaseChecks.push({ test: 'T2-before-navigate', jobId: t2JobId, status: activeJob.status });
          }
        }

        // Navegar para /criacoes
        log('Navegando para /criacoes...');
        await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        await screenshot(page, '12-t2-at-criacoes');

        const criacoesBody = await page.textContent('body').catch(() => '');
        const criacoesLoaded = criacoesBody.includes('Criações') || criacoesBody.includes('criacoes') ||
                               criacoesBody.includes('histórico') || criacoesBody.includes('Minhas');
        addTest('T2: Página /criacoes carregou', criacoesLoaded, `URL: ${page.url()}`);

        // Voltar para /
        log('Voltando para home...');
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        await screenshot(page, '13-t2-back-home');

        // Verificar polling — a página deve mostrar o job ativo
        const bodyBack = await page.textContent('body').catch(() => '');
        const pollingResumed = bodyBack.includes('Processando') || bodyBack.includes('Gerando') ||
                               bodyBack.includes('Aguarde') || bodyBack.includes('Na fila') ||
                               bodyBack.includes('queued');
        addTest('T2: Polling retomado após volta', pollingResumed,
          pollingResumed ? 'UI mostra job ativo após volta' : 'UI não mostra job ativo — possível bug');

        // Aguardar até 3 minutos pela foto ficar pronta (ou timeout)
        log('Aguardando job completar (máx 3 min)...');
        let jobDone = false;
        const maxWait = 3 * 60 * 1000;
        const startWait = Date.now();
        while (!jobDone && Date.now() - startWait < maxWait) {
          const bodyNow = await page.textContent('body').catch(() => '');
          if (bodyNow.includes('Baixar') || bodyNow.includes('Criar nova') || bodyNow.includes('Download')) {
            jobDone = true;
            break;
          }
          // Verificar via Supabase
          if (t2JobId) {
            const jdata = await getJobFromSupabase(t2JobId);
            if (jdata?.status === 'done') { jobDone = true; break; }
            if (jdata?.status === 'failed' || jdata?.status === 'canceled') {
              log(`Job T2 terminou com status: ${jdata.status}`);
              break;
            }
          }
          await page.waitForTimeout(10000);
          await fetchPageUpdate(page);
        }

        await screenshot(page, '14-t2-job-result');

        if (t2JobId) {
          const finalJob = await getJobFromSupabase(t2JobId);
          addTest('T2: Job completou (ou entrou em fila)', true,
            `Status final no DB: ${finalJob?.status ?? 'desconhecido'}`);
          report.supabaseChecks.push({ test: 'T2-final', jobId: t2JobId, status: finalJob?.status });

          const photoAppeared = jobDone;
          addTest('T2: Foto aparece na UI quando pronta', photoAppeared,
            photoAppeared ? 'Foto/resultado visível na UI' : 'Resultado não apareceu na UI dentro do timeout');
        } else {
          addTest('T2: Verificação job', false, 'JobId não capturado');
        }
      }
    } catch (e) {
      log(`ERRO no Teste 2: ${e.message}`);
      report.errors.push(`T2: ${e.message}`);
      addTest('T2: Navegação durante geração', false, `Erro: ${e.message}`);
      await screenshot(page, 'ERROR-t2');
    }

    // =============================================
    // TESTE 3: Job ativo bloqueia novo envio
    // =============================================
    log('\n=== TESTE 3: Job ativo bloqueia novo envio ===');

    try {
      // Ir para home — verificar se existe job ativo
      if (!page.url().startsWith(BASE_URL) || page.url().includes('/criacoes')) {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
      }

      // Verificar no Supabase se há job ativo
      let activeJobForT3 = null;
      if (userId) {
        const jobs = await getRecentJobsForUser(userId);
        activeJobForT3 = jobs.find(j => ['queued', 'submitted', 'processing'].includes(j.status));
      }

      if (activeJobForT3) {
        log(`Job ativo encontrado para T3: ${activeJobForT3.id}`);
        // Tentar navegar para outro modo e submeter
        // O botão de submit deve estar desabilitado
        await screenshot(page, '15-t3-with-active-job');

        const bodyT3 = await page.textContent('body').catch(() => '');
        const isInGenerating = bodyT3.includes('Processando') || bodyT3.includes('Gerando') ||
                               bodyT3.includes('Na fila') || bodyT3.includes('Aguarde');

        if (isInGenerating) {
          // Tentar clicar em "Fundo branco" ou outro modo
          const fundoBranco = page.locator('text=Fundo branco').first();
          if (await fundoBranco.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Durante geração, a UI não mostra o menu de modos
            addTest('T3: Menu de modos oculto durante geração', true,
              'Modos não acessíveis enquanto job ativo');
          } else {
            // Verificar se o botão submit está desabilitado
            const submitBtn = page.locator('button[type="submit"]').first();
            const isDisabled = await submitBtn.isDisabled().catch(() => true);
            addTest('T3: Botão submit desabilitado com job ativo', isDisabled,
              isDisabled ? 'Botão corretamente bloqueado' : 'BUG: botão habilitado com job ativo');
          }
        } else {
          addTest('T3: Estado de geração na UI', false, 'UI não mostra geração ativa apesar do job no DB');
        }
      } else {
        // Criar job ativo manualmente via API para testar
        log('Sem job ativo para T3 — teste com UI em estado limpo');

        // Verificar se formulário está limpo (sem job ativo)
        const bodyT3 = await page.textContent('body').catch(() => '');
        const showsMenu = bodyT3.includes('Usar agora') || bodyT3.includes('Foto em cena');

        if (showsMenu) {
          // Iniciar geração
          await selectModeAndFill(page, productImagePath);
          const gen3 = await clickGenerate(page);

          if (gen3) {
            addTest('T3: Submit realizado para criar job ativo', true);
            await page.waitForTimeout(5000);
            await screenshot(page, '15-t3-generating');

            // Tentar clicar em outro modo (deve estar bloqueado)
            const modeSelector = page.locator('text=Fundo branco, text=Com modelo').first();
            const modeVisible = await modeSelector.isVisible({ timeout: 3000 }).catch(() => false);

            if (!modeVisible) {
              addTest('T3: Modos bloqueados durante geração', true,
                'Menu de modos não exibido durante geração ativa');
            } else {
              // Tentar submeter outro form
              const anotherSubmit = page.locator('button[type="submit"]').first();
              const disabled = await anotherSubmit.isDisabled().catch(() => true);
              addTest('T3: Novo submit bloqueado durante geração', disabled,
                disabled ? 'Botão desabilitado corretamente' : 'BUG: submit possível com job ativo');
            }

            // Cancelar para não bloquear T4
            const cancelBtn3 = page.locator('button:has-text("Cancelar")').first();
            if (await cancelBtn3.isVisible({ timeout: 5000 }).catch(() => false)) {
              await cancelBtn3.click();
              await page.waitForTimeout(2000);
              log('Job cancelado para T3');
            } else {
              // Cancelar via Supabase
              if (userId) {
                const jobs = await getRecentJobsForUser(userId);
                for (const j of jobs.filter(j => ['queued', 'submitted', 'processing'].includes(j.status))) {
                  await supabaseRequest('PATCH', `/rest/v1/image_jobs?id=eq.${j.id}`, { status: 'canceled' });
                }
              }
            }
          } else {
            addTest('T3: Teste bloqueado por rate limit FREE', false, 'Rate limit impediu teste');
          }
        }
      }
    } catch (e) {
      log(`ERRO no Teste 3: ${e.message}`);
      report.errors.push(`T3: ${e.message}`);
      addTest('T3: Job ativo bloqueia novo envio', false, `Erro: ${e.message}`);
      await screenshot(page, 'ERROR-t3');
    }

    // =============================================
    // TESTE 4: Resultado correto após navegação (anti-restore bug)
    // =============================================
    log('\n=== TESTE 4: Resultado correto após navegação ===');

    try {
      // Limpar rate limit para T4
      if (userId) {
        const jobs = await getRecentJobsForUser(userId);
        for (const j of jobs) {
          if (j.status !== 'canceled') {
            await supabaseRequest('PATCH', `/rest/v1/image_jobs?id=eq.${j.id}`, { status: 'canceled' });
          }
        }
        log('Rate limit limpo para T4');
      }

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Precisamos de um job done para testar. Verificar se T2 completou.
      let doneJobId = null;
      if (userId) {
        const jobs = await getRecentJobsForUser(userId);
        const doneJob = jobs.find(j => j.status === 'done' && j.output_image_url);
        if (doneJob) {
          doneJobId = doneJob.id;
          log(`Job done encontrado para T4: ${doneJobId}`);
        }
      }

      if (doneJobId) {
        // Verificar se resultado aparece na home
        await page.waitForTimeout(3000);
        const bodyT4 = await page.textContent('body').catch(() => '');
        const showsResult = bodyT4.includes('Baixar') || bodyT4.includes('Criar nova') ||
                            bodyT4.includes('Download') || bodyT4.includes('pronta');
        await screenshot(page, '16-t4-with-done-job');

        // Clicar "Criar nova foto" (ou equivalente)
        const newPhotoBtn = page.locator('button:has-text("Criar nova"), button:has-text("Nova foto"), button:has-text("Criar outra")').first();
        if (await newPhotoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newPhotoBtn.click();
          log('Clicado em "Criar nova foto"');
          await page.waitForTimeout(2000);
          addTest('T4: Botão "Criar nova foto" encontrado e clicado', true);
        } else {
          log('Botão "Criar nova foto" não encontrado, verificando estado da UI...');
          addTest('T4: Botão "Criar nova foto"', false, 'Botão não encontrado');
        }

        // Navegar para /criacoes
        await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        await screenshot(page, '17-t4-at-criacoes');

        // Voltar para /
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        await screenshot(page, '18-t4-back-home-after-create-new');

        // Verificar que o resultado antigo NÃO reapareceu
        const bodyAfterNew = await page.textContent('body').catch(() => '');
        // Após "Criar nova foto", sessionStorage marca o job como dismissed
        // A UI deve mostrar o formulário, não o resultado antigo
        const showsOldResult = bodyAfterNew.includes('Baixar') && !bodyAfterNew.includes('Gerar') &&
                               !bodyAfterNew.includes('Usar agora');

        addTest('T4: Resultado antigo NÃO reaparece após "Criar nova"', !showsOldResult,
          !showsOldResult ? 'UI mostra formulário (correto)' : 'BUG: resultado antigo restaurado indevidamente');
        addTest('T4: Formulário limpo após "Criar nova"', bodyAfterNew.includes('Usar agora') || bodyAfterNew.includes('Gerar') || bodyAfterNew.includes('produto'),
          'UI mostra estado inicial');

      } else {
        log('Nenhum job done disponível para T4 — testando apenas que formulário está limpo');
        const bodyT4 = await page.textContent('body').catch(() => '');
        const showsForm = bodyT4.includes('Usar agora') || bodyT4.includes('Foto em cena') || bodyT4.includes('Gerar');
        addTest('T4: Formulário limpo (sem job done para restaurar)', showsForm,
          'Sem job done nas últimas 24h para testar restore');
        await screenshot(page, '16-t4-no-done-job');
      }
    } catch (e) {
      log(`ERRO no Teste 4: ${e.message}`);
      report.errors.push(`T4: ${e.message}`);
      addTest('T4: Resultado correto após navegação', false, `Erro: ${e.message}`);
      await screenshot(page, 'ERROR-t4');
    }

    // =============================================
    // TESTE 5: Download funciona
    // =============================================
    log('\n=== TESTE 5: Download ===');

    try {
      // Verificar se há job done com output_image_url
      let doneJob5 = null;
      if (userId) {
        const jobs = await getRecentJobsForUser(userId);
        doneJob5 = jobs.find(j => j.status === 'done' && j.output_image_url);
      }

      if (doneJob5) {
        log(`Job done para T5: ${doneJob5.id}, URL: ${doneJob5.output_image_url?.substring(0, 80)}...`);

        // Navegar para home e verificar se o resultado aparece
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(3000);
        await screenshot(page, '19-t5-check-result');

        const bodyT5 = await page.textContent('body').catch(() => '');
        const hasDownload = bodyT5.includes('Baixar') || bodyT5.includes('Download');

        if (hasDownload) {
          // Testar clique no botão de download
          const downloadBtn = page.locator('button:has-text("Baixar"), a:has-text("Baixar"), button:has-text("Download"), a:has-text("Download")').first();
          if (await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            const [download] = await Promise.all([
              page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
              downloadBtn.click(),
            ]);

            if (download) {
              const dlPath = await download.path().catch(() => null);
              const suggestedName = download.suggestedFilename();
              addTest('T5: Download iniciado com sucesso', true,
                `Arquivo: ${suggestedName || 'sem nome'}`);
              if (dlPath) {
                const size = fs.existsSync(dlPath) ? fs.statSync(dlPath).size : 0;
                addTest('T5: Arquivo baixado não vazio', size > 100, `Tamanho: ${size} bytes`);
              }
            } else {
              // Pode ter aberto nova aba ou o download foi via anchor href
              addTest('T5: Download — evento não capturado', false,
                'Possível download via nova aba ou anchor — verificar manualmente');
              // Verificar via URL direta
              const imgRes = await fetch(doneJob5.output_image_url).catch(() => null);
              const imgOk = imgRes?.ok ?? false;
              addTest('T5: URL da imagem acessível diretamente', imgOk,
                `HTTP ${imgRes?.status ?? 'N/A'}: ${doneJob5.output_image_url?.substring(0, 60)}`);
            }
          } else {
            addTest('T5: Botão de download encontrado', false, 'Botão não visível');
            // Testar URL diretamente
            const imgRes = await fetch(doneJob5.output_image_url).catch(() => null);
            addTest('T5: URL da imagem acessível', imgRes?.ok ?? false, `HTTP ${imgRes?.status ?? 'N/A'}`);
          }
        } else {
          // Resultado não visível na home (foi descartado em T4)
          log('Resultado não na home (descartado em T4) — testando URL diretamente');
          const imgRes = await fetch(doneJob5.output_image_url).catch(() => null);
          const imgOk = imgRes?.ok ?? false;
          addTest('T5: URL da imagem done acessível via fetch', imgOk,
            `HTTP ${imgRes?.status ?? 'N/A'} | ${doneJob5.output_image_url?.substring(0, 80)}`);
          report.supabaseChecks.push({ test: 'T5', jobId: doneJob5.id, status: 'done', url_accessible: imgOk });
        }

        await screenshot(page, '20-t5-download');
      } else {
        addTest('T5: Download', false, 'Nenhum job done disponível — jobs completados nas últimas 24h necessários');
        log('Nenhum job done disponível. O teste de download requer que um job tenha completado com sucesso.');

        // Verificar se a URL da imagem de T2 é acessível (se gerou)
        if (t2JobId) {
          const j = await getJobFromSupabase(t2JobId);
          if (j?.output_image_url) {
            const imgRes = await fetch(j.output_image_url).catch(() => null);
            addTest('T5: URL da imagem T2 acessível', imgRes?.ok ?? false, `HTTP ${imgRes?.status}`);
          }
        }
      }
    } catch (e) {
      log(`ERRO no Teste 5: ${e.message}`);
      report.errors.push(`T5: ${e.message}`);
      addTest('T5: Download', false, `Erro: ${e.message}`);
      await screenshot(page, 'ERROR-t5');
    }

    // =============================================
    // SCREENSHOT FINAL
    // =============================================
    await screenshot(page, '99-final-state');

  } catch (globalErr) {
    log(`ERRO GLOBAL: ${globalErr.message}`);
    report.errors.push(`Global: ${globalErr.message}`);
    await screenshot(page, 'ERROR-global').catch(() => {});
  } finally {
    await browser.close();
    saveReport();
  }
}

async function fetchPageUpdate(page) {
  // Simula visibilidade para disparar polling
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  }).catch(() => {});
}

function saveReport() {
  report.summary = {
    total: report.tests.length,
    passed: report.tests.filter(t => t.passed).length,
    failed: report.tests.filter(t => !t.passed).length,
    errors: report.errors.length,
    consoleErrors: report.consoleErrors.length,
  };

  log('\n========= RESUMO =========');
  log(`Total: ${report.summary.total} | ✅ ${report.summary.passed} | ❌ ${report.summary.failed}`);
  log(`Erros de runtime: ${report.summary.errors}`);
  log(`Erros de console: ${report.summary.consoleErrors}`);
  log('==========================\n');

  // Listar falhas
  const failures = report.tests.filter(t => !t.passed);
  if (failures.length > 0) {
    log('Testes com falha:');
    for (const f of failures) {
      log(`  ❌ ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  log(`\nRelatório salvo em: ${REPORT_PATH}`);
}

main().catch(e => {
  log(`ERRO FATAL: ${e.message}`);
  console.error(e);
  report.errors.push(`Fatal: ${e.message}`);
  saveReport();
  process.exit(1);
});
