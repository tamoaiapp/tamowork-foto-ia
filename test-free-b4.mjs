/**
 * Agente de Teste Overnight — TamoWork Foto IA
 * Conta FREE — free-b4@tamowork.test
 *
 * Testes:
 *  1. Cria conta FREE via Supabase Admin API
 *  2. Checkout via /planos → verifica preços R$228 e R$49, clica anual, registra URL MP
 *  3. Checkout via "Liberar agora" no resultado de arte_promocao
 *  4. Geração de arte_promocao (produto: Perfume feminino, upload Unsplash)
 *  5. Sidebar desktop: "Assinar Pro" visível, badge PRO ausente
 *
 * Screenshots: c:\Users\Notebook\tamowork-foto-ia\test-screenshots\free-b4\
 * Relatório:   c:\Users\Notebook\tamowork-foto-ia\test-screenshots\free-b4\report.json
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'free-b4@tamowork.test';
const PASSWORD = 'FreeB4@2026';
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/free-b4';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const PRODUCT_IMAGE_URL = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600';
const MAX_GENERATION_WAIT_MS = 8 * 60 * 1000; // 8 minutos

// --- Relatório ---
const report = {
  timestamp: new Date().toISOString(),
  account: EMAIL,
  tests: [],
  errors: [],
  checkout: {},
  generation: {},
  sidebar: {},
};

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`;
  console.log(line);
}

function addTest(name, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  report.tests.push({ name, passed, detail, time: new Date().toISOString() });
  log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

function saveReport() {
  const reportPath = path.join(SCREENSHOTS, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  log(`📄 Relatório salvo: ${reportPath}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  log(`📸 Screenshot: ${name}.png`);
  return filePath;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function supabaseAdmin(method, urlPath, body) {
  const url = `${SUPABASE_URL}${urlPath}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const response = await fetch(url, opts);
  const text = await response.text();
  try { return { status: response.status, data: JSON.parse(text) }; }
  catch { return { status: response.status, data: text }; }
}

// Cria conta FREE via Supabase Admin API
async function ensureFreeBAccount() {
  log('=== Verificando / Criando conta FREE via Supabase Admin API ===');

  // Tentar buscar usuário existente por email
  const listRes = await supabaseAdmin('GET', `/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}&page=1&per_page=5`);
  log(`Admin list users status: ${listRes.status}`);

  let userId = null;

  if (listRes.status === 200) {
    const users = listRes.data?.users ?? listRes.data;
    const existing = Array.isArray(users) ? users.find(u => u.email === EMAIL) : null;
    if (existing) {
      userId = existing.id;
      log(`Conta já existe: ${userId}`);
      addTest('Conta FREE já existe', true, `userId=${userId}`);
      return userId;
    }
  }

  // Criar nova conta
  log(`Criando conta FREE: ${EMAIL}`);
  const createRes = await supabaseAdmin('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { plan: 'free' },
  });

  log(`Admin create user status: ${createRes.status}`);

  if (createRes.status === 201 || createRes.status === 200) {
    userId = createRes.data?.id;
    log(`Conta criada: ${userId}`);
    addTest('Conta FREE criada', true, `userId=${userId}`);
    return userId;
  } else if (createRes.status === 422 && JSON.stringify(createRes.data).includes('already')) {
    log('Conta já existe (422 duplicate) — tentando login direto');
    addTest('Conta FREE já existe (422)', true, EMAIL);
    return null; // Sem userId, mas conta existe
  } else {
    log(`Erro ao criar conta: ${JSON.stringify(createRes.data)}`);
    addTest('Conta FREE criada', false, `status=${createRes.status} ${JSON.stringify(createRes.data)}`);
    report.errors.push(`Erro ao criar conta: ${JSON.stringify(createRes.data)}`);
    return null;
  }
}

// Faz login via UI
async function loginViaUI(page) {
  log('=== Login via UI ===');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot(page, '01-login-page');

  // Clicar em "Usar e-mail e senha"
  const emailToggle = page.locator('text=Usar e-mail e senha');
  if (await emailToggle.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailToggle.click();
    await page.waitForTimeout(800);
  }

  // Clicar na aba "Entrar" se disponível
  const tabEntrar = page.locator('button').filter({ hasText: /^Entrar$/ });
  if (await tabEntrar.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await tabEntrar.first().click();
    await page.waitForTimeout(500);
  }

  // Preencher formulário
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await screenshot(page, '02-login-form');

  // Submit
  const submitBtn = page.locator('button[type="submit"]').or(
    page.locator('button').filter({ hasText: /^Entrar$/ }).last()
  );
  await submitBtn.click();
  await page.waitForTimeout(5000);
  await screenshot(page, '03-after-login');

  const urlAfterLogin = page.url();
  log(`URL após login: ${urlAfterLogin}`);

  const loginSuccess = !urlAfterLogin.includes('/login');
  addTest('Login FREE via UI', loginSuccess, `URL: ${urlAfterLogin}`);

  if (!loginSuccess) {
    // Tentar ver mensagem de erro
    const bodyText = await page.textContent('body').catch(() => '');
    const errorSnippet = bodyText.substring(0, 300);
    log(`Body após login falho: ${errorSnippet}`);
    report.errors.push(`Login falhou. Body: ${errorSnippet}`);
    return false;
  }

  // Lidar com onboarding se necessário
  if (urlAfterLogin.includes('/onboarding')) {
    log('Onboarding detectado — pulando...');
    await screenshot(page, '03b-onboarding');
    const continueBtn = page.getByText('Continuar').or(page.getByText('Começar')).or(page.getByText('Próximo'));
    if (await continueBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.first().click();
      await page.waitForTimeout(1500);
    }
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  return true;
}

// =============================================
// TESTE 1: Sidebar desktop
// =============================================
async function testSidebar(page) {
  log('\n=== TESTE: Sidebar Desktop ===');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await screenshot(page, '10-home-sidebar');

  const bodyText = await page.textContent('body').catch(() => '');

  // "Assinar Pro" deve aparecer para FREE
  const hasAssinarPro = bodyText.includes('Assinar Pro') || bodyText.includes('Assinar pro');
  addTest('Sidebar: "Assinar Pro" visível para FREE', hasAssinarPro, hasAssinarPro ? 'Botão encontrado' : 'Botão não encontrado');

  // Badge PRO não deve aparecer
  const hasProBadge = bodyText.includes('Plano Pro ativo') || bodyText.includes('PRO ativo');
  addTest('Sidebar: Badge PRO ausente (conta FREE)', !hasProBadge, hasProBadge ? 'ERRO: badge PRO encontrado' : 'Badge PRO não presente');

  // Verificar sidebar existe (desktop 1440px)
  const sidebar = page.locator('aside.desktop-sidebar');
  const sidebarVisible = await sidebar.isVisible({ timeout: 3000 }).catch(() => false);
  addTest('Sidebar desktop visível (1440px)', sidebarVisible, sidebarVisible ? 'Sidebar encontrada' : 'Sidebar não renderizada');

  report.sidebar = {
    hasAssinarPro,
    hasProBadge,
    sidebarVisible,
  };
}

// =============================================
// TESTE 2: Checkout via /planos
// =============================================
async function testCheckoutViaPlanos(page) {
  log('\n=== TESTE: Checkout via /planos ===');

  await page.goto(`${BASE_URL}/planos`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await screenshot(page, '20-planos-page');

  const bodyText = await page.textContent('body').catch(() => '');

  // Verificar preços visíveis
  const hasAnual228 = bodyText.includes('228') || bodyText.includes('R$228');
  const hasMensal49 = bodyText.includes('49') || bodyText.includes('R$49');
  addTest('/planos: Preço anual R$228 visível', hasAnual228, hasAnual228 ? 'Encontrado' : 'NÃO encontrado');
  addTest('/planos: Preço mensal R$49 visível', hasMensal49, hasMensal49 ? 'Encontrado' : 'NÃO encontrado');

  // Verificar texto do botão anual
  const btnAnual = page.locator('button').filter({ hasText: /228|anual|Quero assinar/i }).first();
  const btnAnualVisible = await btnAnual.isVisible({ timeout: 5000 }).catch(() => false);
  addTest('/planos: Botão anual visível', btnAnualVisible);

  if (!btnAnualVisible) {
    // Listar botões disponíveis para debug
    const btns = await page.$$eval('button', bs => bs.map(b => b.textContent?.trim()).filter(Boolean));
    log(`Botões em /planos: ${JSON.stringify(btns)}`);
    report.checkout.planosButtons = btns;
    addTest('/planos: Checkout anual clicado', false, 'Botão não encontrado');
    report.checkout.planos = { error: 'Botão anual não encontrado' };
    return;
  }

  // Interceptar navegação — clicar no botão anual e registrar URL de destino
  let checkoutUrl = null;
  let navigationBlocked = false;

  // Ouvir requests de checkout
  const requestHandler = async (request) => {
    if (request.url().includes('mercadopago') || request.url().includes('init_point') || request.url().includes('stripe')) {
      log(`Request para checkout: ${request.url()}`);
      checkoutUrl = request.url();
    }
  };
  page.on('request', requestHandler);

  // Interceptar navegação para MP para não sair da página
  await page.route('**mercadopago**', async (route) => {
    checkoutUrl = route.request().url();
    log(`Navegação interceptada para: ${checkoutUrl}`);
    navigationBlocked = true;
    await route.abort();
  });

  await page.route('**/init_point**', async (route) => {
    checkoutUrl = route.request().url();
    await route.abort();
  });

  // Também ouvir mudanças de URL via waitForURL com timeout curto
  const navigationPromise = page.waitForURL(url => {
    const u = url.toString();
    return u.includes('mercadopago') || u.includes('stripe') || u.includes('init_point');
  }, { timeout: 20000 }).then(async () => {
    checkoutUrl = page.url();
    log(`Navegou para checkout: ${checkoutUrl}`);
  }).catch(() => {
    log('Timeout aguardando navegação para checkout (pode ter sido interceptada)');
  });

  log('Clicando no botão anual...');
  await screenshot(page, '21-planos-before-click');
  await btnAnual.click();

  await Promise.race([
    navigationPromise,
    page.waitForTimeout(15000),
  ]);

  // Se não capturou via route/URL, pegar URL atual
  if (!checkoutUrl) {
    const currentUrl = page.url();
    if (currentUrl.includes('mercadopago') || currentUrl.includes('stripe')) {
      checkoutUrl = currentUrl;
    }
  }

  await screenshot(page, '22-planos-after-click');

  log(`URL de checkout capturada: ${checkoutUrl || 'N/A'}`);

  const goesToMP = checkoutUrl && (checkoutUrl.includes('mercadopago') || checkoutUrl.includes('mpago'));
  const goesDirectly = goesToMP && !checkoutUrl.includes('/planos');
  const noInternalPage = !checkoutUrl?.includes(BASE_URL + '/planos') && !checkoutUrl?.includes(BASE_URL + '/checkout');

  addTest('/planos: Checkout anual → MercadoPago', goesToMP, `URL: ${checkoutUrl || 'N/A'}`);
  addTest('/planos: Vai direto ao MP (sem página interna)', goesDirectly && noInternalPage, `URL: ${checkoutUrl || 'N/A'}`);

  report.checkout.planos = {
    checkoutUrl: checkoutUrl || null,
    goesToMP,
    goesDirectly,
    priceAnual228: hasAnual228,
    priceMensal49: hasMensal49,
  };

  page.off('request', requestHandler);

  // Voltar para home após teste
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
}

// =============================================
// TESTE 3: Geração de arte_promocao + checkout "Liberar agora"
// =============================================
async function testGeracaoArtePromo(page) {
  log('\n=== TESTE: Geração arte_promocao + Checkout "Liberar agora" ===');

  // Baixar imagem do produto
  const productImagePath = path.join(SCREENSHOTS, 'product-perfume.jpg');
  if (!fs.existsSync(productImagePath)) {
    log('Baixando imagem do produto (Unsplash)...');
    try {
      await downloadFile(PRODUCT_IMAGE_URL, productImagePath);
      log(`Imagem baixada: ${productImagePath}`);
    } catch (err) {
      log(`Erro ao baixar imagem: ${err.message}`);
      report.errors.push(`Erro download imagem: ${err.message}`);
      addTest('Download imagem produto', false, err.message);
      return;
    }
  } else {
    log(`Imagem já existe: ${productImagePath}`);
  }
  addTest('Download imagem produto (Perfume feminino)', true, productImagePath);

  // Navegar para home
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await screenshot(page, '30-home-before-promo');

  // Aguardar cards de modos
  log('Aguardando modos de geração...');
  try {
    await page.waitForSelector('text=Usar agora', { timeout: 20000 });
    log('Modos carregados');
  } catch {
    log('Timeout aguardando modos — continuando...');
    const bodyText = await page.textContent('body').catch(() => '');
    log(`Body (200 chars): ${bodyText.substring(0, 200)}`);
  }

  await screenshot(page, '30b-home-modes-loaded');

  // Clicar no modo "Post de promoção" ou "promo"
  log('Procurando modo "Post de promoção"...');
  const promoModeBtn = page.locator('text=Post de promoção').or(
    page.locator('text=Promoção').or(page.locator('[data-mode="promo"]'))
  ).first();

  let promoModeFound = await promoModeBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (!promoModeFound) {
    // Listar todos os textos de botões/cards para debug
    const allText = await page.textContent('body').catch(() => '');
    log(`Texto da página (500 chars): ${allText.substring(0, 500)}`);

    // Tentar "Usar agora" — pode ser que os cards existam mas com texto diferente
    const usarAgoraButtons = page.locator('button:has-text("Usar agora")');
    const count = await usarAgoraButtons.count();
    log(`Botões "Usar agora" encontrados: ${count}`);

    if (count > 0) {
      // O modo promo pode ser o último ou um específico — tentar por posição
      // Listar todos os nomes de modos na página
      const modeNames = await page.$$eval('[class*="mode"], [data-mode]', els => els.map(e => e.textContent?.trim()));
      log(`Modos encontrados: ${JSON.stringify(modeNames)}`);
    }

    addTest('Modo "Post de promoção" encontrado', false, 'Modo promo não localizado na UI');
    report.generation = { error: 'Modo promo não encontrado' };
    return;
  }

  addTest('Modo "Post de promoção" encontrado', true);

  // Clicar em "Usar agora" no card de promoção
  // O card de promoção tem "Post de promoção" e um botão "Usar agora"
  const promoCard = page.locator('text=Post de promoção').locator('xpath=ancestor::div[contains(@style,"card") or contains(@class,"card") or contains(@style,"border")]').first();
  const promoUsarBtn = promoCard.locator('text=Usar agora').first();

  if (await promoUsarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await promoUsarBtn.click();
  } else {
    // Tentar clicar direto no texto do modo
    await promoModeBtn.click();
  }

  await page.waitForTimeout(2000);
  await screenshot(page, '31-promo-mode-selected');

  // Verificar se PromoCreator foi exibido (tem "Criar promoção" ou similar)
  const bodyAfterClick = await page.textContent('body').catch(() => '');
  const promoCreatorVisible = bodyAfterClick.includes('Criar promoção') || bodyAfterClick.includes('Baixar promoção');

  // Se PromoCreator simples foi exibido (sem geração IA), isso não é o modo arte_promocao
  // O modo correto gera via IA (submete job) — verificar se há upload de produto + campo produto
  log(`PromoCreator visível: ${promoCreatorVisible}`);

  // Verificar se há campo "Nome do produto" ou "Produto" para geração IA
  const hasProdutoField = await page.locator('input[placeholder*="produto"], input[placeholder*="Produto"], text=Produto').first().isVisible({ timeout: 3000 }).catch(() => false);

  // Se for o PromoCreator simples (arte de promo local), não há geração IA
  if (promoCreatorVisible && !hasProdutoField) {
    log('PromoCreator simples (sem IA) exibido. Verificando se há modo de geração separado...');
    await screenshot(page, '31b-promo-creator-simple');

    // O botão "voltar" para tentar outro caminho
    const backBtn = page.locator('button:has-text("← Voltar"), button:has-text("Voltar")').first();
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Agora tentar pelo fluxo de geração IA — mode "simulacao" ou qualquer modo que gere via IA
  // O fluxo normal: selecionar modo → upload imagem → preencher produto → gerar
  // Vamos tentar selecionar o primeiro modo IA disponível (ex: "Fundo branco")
  log('Buscando qualquer modo de geração IA para testar arte_promocao...');

  // Tentar selecionar "Fundo branco" como alternativa se promo não gerar via IA
  // Mas primeiro, verificar se há campo "Nome do produto" na tela atual
  const produtoFieldVisible = await page.locator('input[placeholder*="produto"], input[placeholder*="produto"], label:has-text("Produto")').first().isVisible({ timeout: 3000 }).catch(() => false);

  if (!produtoFieldVisible) {
    // Tentar outro modo que claramente usa IA
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Clicar no primeiro modo disponível ("Usar agora")
    const firstUsarAgora = page.locator('button:has-text("Usar agora")').first();
    if (await firstUsarAgora.isVisible({ timeout: 8000 }).catch(() => false)) {
      await firstUsarAgora.click();
      await page.waitForTimeout(2000);
    }
    await screenshot(page, '32-mode-fallback-selected');
  }

  // Preencher "Nome do produto"
  const produtoInput = page.locator('input').filter({ hasPlaceholder: /produto|perfume|tênis/i }).first();
  const produtoInputAlt = page.locator('input[placeholder*="produto"]').or(page.locator('input[placeholder*="Produto"]')).first();

  let inputFound = await produtoInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (!inputFound) {
    inputFound = await produtoInputAlt.isVisible({ timeout: 3000 }).catch(() => false);
  }

  if (inputFound) {
    const inputToFill = inputFound ? produtoInput : produtoInputAlt;
    await inputToFill.fill('Perfume feminino');
    log('Nome do produto preenchido: Perfume feminino');
  } else {
    log('Campo de produto não encontrado na tela atual');
    await screenshot(page, '32b-no-produto-field');
  }

  // Upload da imagem do produto
  log('Fazendo upload da imagem...');
  const fileInput = page.locator('input[type="file"]').first();
  const fileInputVisible = await fileInput.isVisible({ timeout: 3000 }).catch(() => false);

  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(productImagePath);
    log('Arquivo enviado via setInputFiles');
    await page.waitForTimeout(2000);
    await screenshot(page, '33-after-upload');
    addTest('Upload da imagem do produto', true, path.basename(productImagePath));
  } else {
    log('Input de arquivo não encontrado');
    addTest('Upload da imagem do produto', false, 'input[type=file] não encontrado');
  }

  await screenshot(page, '34-before-submit');

  // Verificar botão Gerar
  const generateBtn = page.locator('button').filter({ hasText: /Gerar|Criar foto|Transformar|Gerar foto/i }).first();
  const generateBtnVisible = await generateBtn.isVisible({ timeout: 5000 }).catch(() => false);
  addTest('Botão de geração visível', generateBtnVisible);

  if (!generateBtnVisible) {
    const btns = await page.$$eval('button', bs => bs.map(b => b.textContent?.trim()).filter(Boolean));
    log(`Botões disponíveis: ${JSON.stringify(btns)}`);
    addTest('Submissão de job arte_promocao', false, 'Botão de gerar não encontrado');
    report.generation = { error: 'Botão de gerar não encontrado', buttons: btns };
    return;
  }

  // Clicar em Gerar e registrar tempo de início
  const startTime = Date.now();
  log('Clicando em Gerar...');
  await generateBtn.click();
  await page.waitForTimeout(3000);
  await screenshot(page, '35-after-generate-click');

  // Aguardar geração (até 8 minutos)
  log(`Aguardando geração (até ${MAX_GENERATION_WAIT_MS / 60000} minutos)...`);

  let generationDone = false;
  let resultImageFound = false;
  let liberarAgoraFound = false;
  let checkoutUrlFromResult = null;
  const pollInterval = 15000; // verificar a cada 15 segundos
  const maxPolls = Math.floor(MAX_GENERATION_WAIT_MS / pollInterval);

  for (let i = 0; i < maxPolls; i++) {
    await page.waitForTimeout(pollInterval);

    const currentBody = await page.textContent('body').catch(() => '');
    const currentUrl = page.url();

    // Verificar se há resultado (imagem gerada)
    const hasOutputImg = await page.locator('img[src*="supabase"], img[src*="storage"], img[src*="output"]').count() > 0;
    const hasDoneIndicator = currentBody.includes('Liberar agora') || currentBody.includes('Baixar') ||
                              currentBody.includes('Salvar') || currentBody.includes('Compartilhar');
    const hasProcessing = currentBody.includes('Gerando') || currentBody.includes('Processando') ||
                           currentBody.includes('Na fila') || currentBody.includes('queued') ||
                           currentBody.includes('processing') || currentBody.includes('Aguarde');
    const hasFailed = currentBody.includes('falhou') || currentBody.includes('Erro') || currentBody.includes('failed');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log(`[${elapsed}s] Processing: ${hasProcessing} | Done indicator: ${hasDoneIndicator} | OutputImg: ${hasOutputImg} | Failed: ${hasFailed}`);

    if (hasFailed && !hasProcessing) {
      log('Geração falhou!');
      await screenshot(page, `36-generation-failed-${i}`);
      addTest('Geração arte_promocao', false, 'Job falhou');
      report.generation = { elapsed: elapsed * 1000, failed: true };
      break;
    }

    if (hasDoneIndicator || hasOutputImg) {
      const elapsedMs = Date.now() - startTime;
      log(`Geração concluída em ${Math.round(elapsedMs / 1000)}s!`);
      await screenshot(page, '37-generation-done');
      addTest('Geração arte_promocao concluída', true, `${Math.round(elapsedMs / 1000)}s`);

      generationDone = true;
      resultImageFound = hasOutputImg;
      report.generation = {
        elapsed: elapsedMs,
        elapsedFormatted: `${Math.round(elapsedMs / 1000)}s`,
        resultImageFound,
        hasDoneIndicator,
      };

      // Verificar se "Liberar agora · R$228/ano" aparece (FREE = resultado bloqueado)
      liberarAgoraFound = currentBody.includes('Liberar agora') || currentBody.includes('R$228/ano');
      addTest('Resultado: "Liberar agora" visível para FREE', liberarAgoraFound, liberarAgoraFound ? 'Botão de desbloqueio encontrado' : 'Botão não encontrado');

      break;
    }

    // Screenshot periódico a cada 2 minutos
    if (i > 0 && i % 8 === 0) {
      await screenshot(page, `36-generating-${i}`);
    }
  }

  if (!generationDone) {
    const elapsedMs = Date.now() - startTime;
    log(`Timeout de geração após ${Math.round(elapsedMs / 1000)}s`);
    await screenshot(page, '36-generation-timeout');
    addTest('Geração arte_promocao concluída', false, `Timeout após ${Math.round(elapsedMs / 1000)}s`);
    report.generation = { elapsed: elapsedMs, timeout: true };
    return;
  }

  // =============================================
  // TESTE: Checkout via "Liberar agora" no resultado
  // =============================================
  if (liberarAgoraFound) {
    log('\n=== TESTE: Checkout via "Liberar agora" no resultado ===');

    const liberarBtn = page.locator('button').filter({ hasText: /Liberar agora/i }).first();
    const liberarBtnVisible = await liberarBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!liberarBtnVisible) {
      addTest('Checkout resultado: Botão "Liberar agora" clicável', false, 'Botão não encontrado');
      report.checkout.resultado = { error: 'Botão não encontrado' };
      return;
    }

    addTest('Checkout resultado: Botão "Liberar agora" clicável', true);

    // Interceptar navegação para MP
    let resultCheckoutUrl = null;

    await page.route('**mercadopago**', async (route) => {
      resultCheckoutUrl = route.request().url();
      log(`Checkout resultado → MP: ${resultCheckoutUrl}`);
      await route.abort();
    });

    const navPromise = page.waitForURL(url => {
      const u = url.toString();
      return u.includes('mercadopago') || u.includes('stripe');
    }, { timeout: 20000 }).then(() => {
      resultCheckoutUrl = page.url();
    }).catch(() => {});

    await screenshot(page, '40-before-liberar');
    await liberarBtn.click();

    await Promise.race([navPromise, page.waitForTimeout(15000)]);

    if (!resultCheckoutUrl) {
      const currentUrl = page.url();
      if (currentUrl.includes('mercadopago') || currentUrl.includes('stripe')) {
        resultCheckoutUrl = currentUrl;
      } else if (currentUrl.includes('/planos')) {
        // Pode ter redirecionado para /planos como fallback
        resultCheckoutUrl = currentUrl;
        log('Redirecionado para /planos (fallback)');
      }
    }

    await screenshot(page, '41-after-liberar-click');
    log(`URL checkout do resultado: ${resultCheckoutUrl || 'N/A'}`);

    const resultGoesToMP = resultCheckoutUrl && resultCheckoutUrl.includes('mercadopago');
    const resultGoesDirectly = resultGoesToMP && !resultCheckoutUrl.includes('/planos');
    const resultNoInternalRedirect = !resultCheckoutUrl?.includes(BASE_URL);

    addTest('Resultado: Checkout → MercadoPago', resultGoesToMP, `URL: ${resultCheckoutUrl || 'N/A'}`);
    addTest('Resultado: Vai direto ao MP (sem /planos)', resultGoesDirectly, `URL: ${resultCheckoutUrl || 'N/A'}`);

    report.checkout.resultado = {
      checkoutUrl: resultCheckoutUrl || null,
      goesToMP: resultGoesToMP,
      goesDirectly: resultGoesDirectly,
    };
  } else {
    log('Botão "Liberar agora" não encontrado no resultado — pulando teste de checkout do resultado');
    addTest('Resultado: Botão "Liberar agora" presente', false, 'Não encontrado após geração');
    report.checkout.resultado = { skipped: true, reason: '"Liberar agora" não encontrado' };
  }
}

// =============================================
// MAIN
// =============================================
async function main() {
  log('================================================');
  log('TamoWork Foto IA — Agente de Teste overnight (free-b4)');
  log(`Início: ${new Date().toISOString()}`);
  log('================================================');

  // Garantir diretório de screenshots
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // 1. Criar conta FREE via Admin API
  const userId = await ensureFreeBAccount();
  report.userId = userId;

  // 2. Iniciar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Simular device desktop sem touch
    hasTouch: false,
    isMobile: false,
  });

  // Capturar erros de console
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), text: err.message });
  });

  try {
    // 3. Login
    const loginOk = await loginViaUI(page);
    if (!loginOk) {
      log('Login falhou — abortando testes que precisam de autenticação');
      report.errors.push('Login falhou — testes parcialmente executados');
    }

    // 4. Sidebar desktop (não precisa estar logado para renderizar, mas verifica estado FREE)
    await testSidebar(page);

    // 5. Checkout via /planos
    if (loginOk) {
      await testCheckoutViaPlanos(page);
    } else {
      addTest('Checkout via /planos', false, 'Pulado — login falhou');
    }

    // 6. Geração arte_promocao + checkout "Liberar agora"
    if (loginOk) {
      await testGeracaoArtePromo(page);
    } else {
      addTest('Geração arte_promocao', false, 'Pulado — login falhou');
    }

  } catch (err) {
    log(`ERRO FATAL: ${err.message}`);
    report.errors.push(`Fatal: ${err.message}\n${err.stack}`);
    await screenshot(page, 'error-fatal').catch(() => {});
  } finally {
    report.consoleErrors = consoleErrors;
    report.endTimestamp = new Date().toISOString();

    // Resumo
    const passed = report.tests.filter(t => t.passed).length;
    const failed = report.tests.filter(t => !t.passed).length;
    report.summary = { passed, failed, total: report.tests.length };

    log('\n================================================');
    log(`RESULTADO FINAL: ${passed}/${report.tests.length} testes passaram`);
    log(`Erros: ${report.errors.length}`);
    log(`Erros de console: ${consoleErrors.length}`);
    report.tests.forEach(t => {
      log(`  ${t.passed ? '✅' : '❌'} ${t.name}${t.detail ? ' — ' + t.detail : ''}`);
    });
    log('================================================');

    saveReport();

    await browser.close();
    log('Browser fechado. Teste finalizado.');
  }
}

main().catch(err => {
  console.error('Erro não capturado:', err);
  process.exit(1);
});
