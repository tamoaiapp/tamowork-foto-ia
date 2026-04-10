/**
 * Agente de Teste Overnight — TamoWork Foto IA
 * Conta: free-b3 | Foco: Bug de restore de estado
 * Viewport: 412x915 Android (Pixel 7)
 *
 * Cenários:
 *   A — Foto pronta → "Criar nova foto" → /criacoes → volta → resultado NÃO deve aparecer
 *   B — Foto pronta → "Editar" → /editor → clica voltar → resultado NÃO deve aparecer
 *   C — Foto pronta → fecha aba → reabre URL → resultado DEVE aparecer (24h)
 *   D — Foto pronta → "Baixar" → volta ao início → resultado ainda aparece? (ok se sim)
 *   E — Após geração → navega para / com ?ts=xxx na URL → resultado aparece?
 *
 * Uso: node test-free-b3.mjs
 */

import { chromium } from 'playwright';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_URL        = 'https://tamowork.com';
const TEST_EMAIL     = 'free-b3@tamowork.test';
const TEST_PASS      = 'FreeB3@2026';
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/free-b3';
const REPORT_PATH    = path.join(SCREENSHOTS_DIR, 'report.json');

const SUPABASE_URL   = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_SVC   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const PRODUCT_IMAGE_URL = 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600';

// Android Pixel 7
const ANDROID_DEVICE = {
  viewport:          { width: 412, height: 915 },
  userAgent:         'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  isMobile:          true,
  hasTouch:          true,
  deviceScaleFactor: 2.625,
};

// ─── Utils ────────────────────────────────────────────────────────────────────
let stepNum = 0;
const scenarioResults = {};
const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }

async function screenshot(page, name) {
  stepNum++;
  const fname = `${String(stepNum).padStart(3, '0')}-${name}.png`;
  const fpath = path.join(SCREENSHOTS_DIR, fname);
  try {
    await page.screenshot({ path: fpath, fullPage: false });
    log(`Screenshot: ${fname}`);
  } catch (e) {
    log(`Screenshot falhou (${fname}): ${e.message}`);
  }
  return fpath;
}

// HTTP request helper (sem dependências externas)
function httpReq(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'https:' ? 443 : 80),
      path:     u.pathname + u.search,
      method,
      headers:  {
        'Content-Type':  'application/json',
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function supabase(method, path2, body) {
  return httpReq(method, SUPABASE_URL + path2, body, {
    apikey:         SUPABASE_SVC,
    Authorization:  `Bearer ${SUPABASE_SVC}`,
    Prefer:         'return=representation',
  });
}

// ─── Supabase: cria conta FREE ─────────────────────────────────────────────────
async function ensureFreeBAccount() {
  log('Verificando/criando conta FREE free-b3...');

  // Tenta criar via Auth Admin
  const res = await supabase('POST', '/auth/v1/admin/users', {
    email:           TEST_EMAIL,
    password:        TEST_PASS,
    email_confirm:   true,
    user_metadata:   { plan: 'free' },
  });

  if (res.status === 200 || res.status === 201) {
    log(`Conta criada: ${res.body.id}`);
    return res.body.id;
  }
  if (res.status === 422 && String(res.body?.msg ?? res.body?.message ?? '').includes('already')) {
    log('Conta já existe — obtendo ID...');
    // Listar usuários e filtrar
    const list = await supabase('GET', `/auth/v1/admin/users?page=1&per_page=500`, null);
    const users = list.body?.users ?? [];
    const found = users.find(u => u.email === TEST_EMAIL);
    if (found) {
      log(`Conta encontrada: ${found.id}`);
      return found.id;
    }
  }

  log(`AVISO — criação de conta retornou ${res.status}: ${JSON.stringify(res.body)}`);
  return null;
}

// ─── Limpa jobs anteriores do usuário (para fresh state) ──────────────────────
async function cleanUserJobs(userId) {
  if (!userId) return;
  log(`Limpando jobs antigos de ${userId}...`);
  await supabase('DELETE', `/rest/v1/image_jobs?user_id=eq.${userId}`, null);
  log('Jobs limpos.');
}

// ─── Baixa imagem de produto para upload ──────────────────────────────────────
async function downloadProductImage() {
  const imgPath = path.join(SCREENSHOTS_DIR, 'test-oculos.jpg');
  if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 5000) {
    log(`Usando imagem existente: ${imgPath}`);
    return imgPath;
  }
  log(`Baixando imagem do produto: ${PRODUCT_IMAGE_URL}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath);
    const get = (url, redirectCount = 0) => {
      if (redirectCount > 5) { reject(new Error('Muitos redirects')); return; }
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location, redirectCount + 1);
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); log(`Imagem salva: ${imgPath}`); resolve(imgPath); });
      }).on('error', (e) => { fs.unlink(imgPath, () => {}); reject(e); });
    };
    get(PRODUCT_IMAGE_URL);
  });
}

// ─── Login no navegador ────────────────────────────────────────────────────────
async function doLogin(page) {
  log('Navegando para /login...');
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'login-inicial');

  // Expande formulário e-mail/senha se necessário
  const emailToggle = page.locator('button:has-text("e-mail"), button:has-text("email"), button:has-text("Email")').first();
  if (await emailToggle.count() > 0 && await emailToggle.isVisible()) {
    await emailToggle.click();
    await page.waitForTimeout(500);
  }

  // Modo "Entrar" (não "Criar conta")
  const entrarBtn = page.locator('button:has-text("Entrar"), button:has-text("Sign in")').first();
  if (await entrarBtn.count() > 0 && await entrarBtn.isVisible()) {
    // já no modo login
  } else {
    // Procura link/botão para alternar para login
    const toggleLogin = page.locator('button:has-text("Já tenho conta"), a:has-text("Já tenho conta"), span:has-text("Já tenho conta")').first();
    if (await toggleLogin.count() > 0) {
      await toggleLogin.click();
      await page.waitForTimeout(400);
    }
  }

  // Preenche e-mail
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]').first();
  if (await emailInput.count() === 0) {
    log('ERRO: campo de e-mail não encontrado');
    return false;
  }
  await emailInput.fill(TEST_EMAIL);

  // Preenche senha
  const passInput = page.locator('input[type="password"]').first();
  if (await passInput.count() === 0) {
    log('ERRO: campo de senha não encontrado');
    return false;
  }
  await passInput.fill(TEST_PASS);

  await screenshot(page, 'login-preenchido');

  // Submete
  const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
  } else {
    await passInput.press('Enter');
  }

  log('Aguardando redirecionamento pós-login...');
  await page.waitForTimeout(5000);

  // Pula onboarding se aparecer
  await skipOnboarding(page);

  const currentUrl = page.url();
  const loggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/onboarding');
  log(`URL pós-login: ${currentUrl} | logado: ${loggedIn}`);

  await screenshot(page, 'login-resultado');
  return loggedIn;
}

// ─── Pula onboarding ───────────────────────────────────────────────────────────
async function skipOnboarding(page) {
  if (!page.url().includes('/onboarding')) return;
  log('Em onboarding — pulando...');

  for (let i = 0; i < 8; i++) {
    const skipBtns = [
      'button:has-text("Testar grátis")', 'button:has-text("Try for free")',
      'button:has-text("Pular")',          'button:has-text("Skip")',
      'button:has-text("Probar gratis")',
    ];
    let clicked = false;
    for (const sel of skipBtns) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    await page.waitForTimeout(1500);
    if (!page.url().includes('/onboarding')) return;

    if (!clicked) {
      await page.evaluate(() => localStorage.setItem('tw_onboarding_done', '1'));
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      return;
    }
  }
  // Fallback
  await page.evaluate(() => localStorage.setItem('tw_onboarding_done', '1'));
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
}

// ─── Verifica se resultado está visível ───────────────────────────────────────
async function checkResultVisible(page, context = '') {
  // Aguarda render (~3s)
  await page.waitForTimeout(3000);

  // Indicadores de "resultado visível"
  const downloadBtn  = page.locator('button:has-text("Baixar"), button:has-text("Download")').first();
  const resultImg    = page.locator('.result-wrap img, img[alt="Foto gerada"]').first();
  const resultTitle  = page.locator('text=Sua foto foi gerada, text=ficou pronta, text=ready').first();

  const hasDownload  = await downloadBtn.count() > 0 && await downloadBtn.isVisible().catch(() => false);
  const hasResultImg = await resultImg.count() > 0;
  const hasTitle     = await resultTitle.count() > 0;

  const visible = hasDownload || hasResultImg || hasTitle;
  log(`[checkResultVisible] ${context} → download:${hasDownload} img:${hasResultImg} title:${hasTitle} => ${visible}`);
  return visible;
}

// ─── Navega para home e aguarda carregamento ───────────────────────────────────
async function goHome(page, extra = '') {
  const url = APP_URL + (extra ? extra : '');
  log(`Navegando para: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Aguarda hidratação React
  await page.waitForTimeout(4000);
}

// ─── Gera a foto (fluxo catálogo) ─────────────────────────────────────────────
async function generatePhoto(page, imgPath) {
  log('\n=== GERANDO FOTO (modo catálogo) ===');
  const startTs = Date.now();

  await goHome(page);
  await screenshot(page, 'home-antes-gerar');

  // Seleciona modo "Catálogo com modelo"
  log('Selecionando modo Catálogo...');
  const catalogoBtn = page.locator('text=Catálogo, text=Catalogo, button:has-text("Catálogo"), button:has-text("modelo")').first();
  if (await catalogoBtn.count() > 0 && await catalogoBtn.isVisible()) {
    await catalogoBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'modo-catalogo-selecionado');
  } else {
    // Tenta via ModeSelector: clica na opção de catálogo
    const modes = page.locator('[data-mode="catalogo"], .mode-card').all();
    const modesList = await modes;
    if (modesList.length > 0) {
      await modesList[2].click(); // Geralmente é o 3º modo
      await page.waitForTimeout(1500);
    } else {
      log('AVISO: Botão de modo catálogo não encontrado — tentando "simulacao"');
      // Fallback: procura qualquer card de modo
      const anyMode = page.locator('button, div[role="button"]').filter({ hasText: /simulação|simulacao|catálogo/i }).first();
      if (await anyMode.count() > 0) {
        await anyMode.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  await screenshot(page, 'formulario-catalogo');

  // Escolhe modelo do catálogo (primeiro disponível — Mulher 1)
  log('Selecionando modelo do catálogo (Mulher 1)...');
  const modelCard = page.locator('img[src*="mulher1"]').first();
  if (await modelCard.count() > 0) {
    await modelCard.click();
    await page.waitForTimeout(800);
    log('Modelo Mulher 1 selecionado.');
  } else {
    // Fallback: clica no primeiro card de modelo disponível
    const firstModel = page.locator('.catalog-model, [class*="catalog"]').first();
    if (await firstModel.count() > 0) {
      await firstModel.click();
      await page.waitForTimeout(800);
    }
  }

  // Upload da imagem do produto
  log(`Upload da imagem: ${imgPath}`);
  const fileInput = page.locator('input[type="file"]').nth(1); // 2º input (produto)
  const hasSecondInput = await fileInput.count() > 0;
  if (hasSecondInput) {
    await fileInput.setInputFiles(imgPath);
    await page.waitForTimeout(1000);
    log('Upload via 2º file input (produto no catálogo).');
  } else {
    const anyFileInput = page.locator('input[type="file"]').first();
    if (await anyFileInput.count() > 0) {
      await anyFileInput.setInputFiles(imgPath);
      await page.waitForTimeout(1000);
    } else {
      log('ERRO: input de arquivo não encontrado');
    }
  }

  await screenshot(page, 'produto-uploaded');

  // Preenche nome do produto
  const produtoInput = page.locator('input[placeholder*="produto"], input[placeholder*="bolo"]').first();
  if (await produtoInput.count() > 0) {
    await produtoInput.fill('Óculos de sol');
    log('Nome do produto preenchido.');
  }

  // Preenche cenário
  const cenarioInput = page.locator('input[placeholder*="cenário"], input[placeholder*="cenario"], input[placeholder*="ambiente"]').first();
  if (await cenarioInput.count() > 0) {
    await cenarioInput.fill('ambiente urbano moderno, luz natural');
    log('Cenário preenchido.');
  }

  await screenshot(page, 'formulario-preenchido');

  // Submete
  log('Submetendo formulário...');
  const submitBtn = page.locator('button:has-text("Gerar foto"), button:has-text("✨")').first();
  if (await submitBtn.count() > 0 && !(await submitBtn.isDisabled())) {
    await submitBtn.click();
  } else {
    // Fallback: submit via form
    await page.keyboard.press('Enter');
  }

  log('Aguardando início da geração...');
  await page.waitForTimeout(5000);
  await screenshot(page, 'gerando-inicio');

  // Aguarda conclusão (máx 8 minutos = 480s, poll a cada 10s)
  const MAX_WAIT_MS = 8 * 60 * 1000;
  const POLL_MS     = 10_000;
  let elapsed       = 0;
  let jobDone       = false;

  log(`Aguardando conclusão (máx ${MAX_WAIT_MS / 60000}min)...`);

  while (elapsed < MAX_WAIT_MS) {
    await page.waitForTimeout(POLL_MS);
    elapsed += POLL_MS;

    const elapsedMin = Math.floor(elapsed / 60000);
    const elapsedSec = Math.floor((elapsed % 60000) / 1000);
    log(`Aguardando... ${elapsedMin}m${elapsedSec}s`);

    // Verifica se apareceu o botão de download (resultado pronto)
    const doneIndicators = [
      page.locator('button:has-text("Baixar"), button:has-text("Download")').first(),
      page.locator('img[alt="Foto gerada"]').first(),
      page.locator('.result-wrap').first(),
      page.locator('text=Sua foto ficou pronta, text=Foto gerada').first(),
    ];

    for (const indicator of doneIndicators) {
      if (await indicator.count() > 0 && await indicator.isVisible().catch(() => false)) {
        jobDone = true;
        break;
      }
    }

    if (jobDone) {
      const totalMs  = Date.now() - startTs;
      const totalMin = Math.floor(totalMs / 60000);
      const totalSec = Math.floor((totalMs % 60000) / 1000);
      log(`FOTO PRONTA em ${totalMin}m${totalSec}s`);
      await screenshot(page, 'foto-pronta');
      return { ok: true, elapsedMs: totalMs, elapsedLabel: `${totalMin}m${totalSec}s` };
    }

    // Verifica erro
    const errorEl = page.locator('text=Algo deu errado, text=Tenta novamente, text=falhou').first();
    if (await errorEl.count() > 0 && await errorEl.isVisible().catch(() => false)) {
      log('ERRO detectado na geração');
      await screenshot(page, 'erro-geracao');
      return { ok: false, elapsedMs: Date.now() - startTs, elapsedLabel: 'erro', error: 'Erro detectado na página' };
    }
  }

  // Timeout
  log('TIMEOUT: foto não ficou pronta em 8 minutos');
  await screenshot(page, 'timeout-geracao');
  return { ok: false, elapsedMs: Date.now() - startTs, elapsedLabel: '8m+ (timeout)', error: 'Timeout 8 minutos' };
}

// ─── CENÁRIO A ─────────────────────────────────────────────────────────────────
// Foto pronta → "Criar nova foto" → /criacoes → volta → resultado NÃO deve aparecer
async function scenarioA(browser) {
  log('\n' + '═'.repeat(60));
  log('CENÁRIO A: "Criar nova foto" → /criacoes → volta → sem resultado antigo');
  log('═'.repeat(60));
  const result = { name: 'A', description: 'resetJob → criacoes → back → sem resultado', steps: [] };

  const context = await browser.newContext({
    ...ANDROID_DEVICE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();

  try {
    // Login
    const loggedIn = await doLogin(page);
    result.steps.push({ step: 'login', ok: loggedIn });
    if (!loggedIn) { result.status = 'FALHOU'; result.reason = 'Login falhou'; return result; }

    // Aguarda carregamento da home (deve restaurar resultado)
    await goHome(page);
    await screenshot(page, 'A-home-pos-login');

    // Verifica se resultado aparece (job anterior se existir)
    const resultBeforeAny = await checkResultVisible(page, 'A-antes');
    result.steps.push({ step: 'resultado-antes', visible: resultBeforeAny });

    if (!resultBeforeAny) {
      result.steps.push({ step: 'nota', msg: 'Nenhum resultado anterior visível — cenário A testará após geração da foto' });
    }

    // Navega para resultado (deve estar visível se job done existir)
    // Para garantir o estado "terminado", verifica se resultado está no DOM
    const hasResult = await checkResultVisible(page, 'A-verificacao');

    if (hasResult) {
      // Clica em "Criar nova foto" (resetJob)
      log('A: Clicando em "Criar nova foto"...');
      const newBtn = page.locator('button:has-text("Nova foto"), button:has-text("Criar nova"), button:has-text("Gerar nova")').first();
      if (await newBtn.count() > 0) {
        await newBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'A-apos-nova-foto');
      }

      // Vai para /criacoes
      log('A: Navegando para /criacoes...');
      await page.goto(`${APP_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      await screenshot(page, 'A-criacoes');

      // Volta (history back ou navega para /)
      log('A: Voltando para home...');
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(async () => {
        await goHome(page);
      });
      await page.waitForTimeout(4000);
      await screenshot(page, 'A-home-de-volta');

      const resultAfter = await checkResultVisible(page, 'A-depois');
      result.steps.push({ step: 'resultado-apos-volta', visible: resultAfter });

      // Esperado: NÃO deve aparecer (foi descartado com resetJob)
      const passed = !resultAfter;
      result.status = passed ? 'PASSOU' : 'FALHOU';
      result.reason = passed
        ? 'Resultado não restaurado após "criar nova foto" + navegar + voltar (correto)'
        : 'BUG: Resultado reapareceu após "criar nova foto" + navegar + voltar';
    } else {
      result.status = 'INCONCLUSIVO';
      result.reason = 'Nenhum resultado disponível para testar restore. Execute após gerar foto.';
    }

  } catch (e) {
    log(`ERRO no cenário A: ${e.message}`);
    await screenshot(page, 'A-erro').catch(() => {});
    result.status = 'ERRO';
    result.reason = e.message;
  } finally {
    await context.close();
  }

  log(`Cenário A: ${result.status} — ${result.reason}`);
  return result;
}

// ─── CENÁRIO B ─────────────────────────────────────────────────────────────────
// Foto pronta → "Editar" → /editor → clica voltar → resultado NÃO deve aparecer
async function scenarioB(browser) {
  log('\n' + '═'.repeat(60));
  log('CENÁRIO B: "Editar" → /editor → volta → sem resultado antigo');
  log('═'.repeat(60));
  const result = { name: 'B', description: 'Editar → /editor → back → sem resultado', steps: [] };

  const context = await browser.newContext({
    ...ANDROID_DEVICE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();

  try {
    const loggedIn = await doLogin(page);
    result.steps.push({ step: 'login', ok: loggedIn });
    if (!loggedIn) { result.status = 'FALHOU'; result.reason = 'Login falhou'; return result; }

    await goHome(page);
    await screenshot(page, 'B-home');

    const hasResult = await checkResultVisible(page, 'B-antes');
    result.steps.push({ step: 'resultado-visivel', visible: hasResult });

    if (hasResult) {
      log('B: Clicando em "Editar"...');
      // O botão Editar adiciona job.id aos dismissed_jobs e vai para /editor
      const editBtn = page.locator('button:has-text("Editar"), button:has-text("Edit")').first();
      if (await editBtn.count() > 0) {
        await editBtn.click();
        log('B: Aguardando navegação para /editor...');
        await page.waitForTimeout(3000);
        await screenshot(page, 'B-editor');

        // Volta
        log('B: Voltando via goBack...');
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(async () => {
          await goHome(page);
        });
        await page.waitForTimeout(4000);
        await screenshot(page, 'B-home-de-volta');

        const resultAfter = await checkResultVisible(page, 'B-depois');
        result.steps.push({ step: 'resultado-apos-volta', visible: resultAfter });

        // Código em page.tsx: ao clicar "Editar" adiciona job.id em dismissed_jobs
        // Portanto NÃO deve restaurar
        const passed = !resultAfter;
        result.status = passed ? 'PASSOU' : 'FALHOU';
        result.reason = passed
          ? 'Resultado não restaurado após Editar + voltar (dismissed_jobs funcionou)'
          : 'BUG: Resultado reapareceu mesmo após job adicionado ao dismissed_jobs via Editar';
      } else {
        result.status = 'INCONCLUSIVO';
        result.reason = 'Botão Editar não encontrado';
      }
    } else {
      result.status = 'INCONCLUSIVO';
      result.reason = 'Nenhum resultado disponível para testar';
    }

  } catch (e) {
    log(`ERRO no cenário B: ${e.message}`);
    await screenshot(page, 'B-erro').catch(() => {});
    result.status = 'ERRO';
    result.reason = e.message;
  } finally {
    await context.close();
  }

  log(`Cenário B: ${result.status} — ${result.reason}`);
  return result;
}

// ─── CENÁRIO C ─────────────────────────────────────────────────────────────────
// Foto pronta → fecha aba → reabre URL → resultado DEVE aparecer (24h)
async function scenarioC(browser) {
  log('\n' + '═'.repeat(60));
  log('CENÁRIO C: fecha contexto → novo contexto → home → resultado DEVE aparecer');
  log('═'.repeat(60));
  const result = { name: 'C', description: 'Fecha aba → reabre URL → resultado persiste (24h)', steps: [] };

  // Contexto 1: login e verifica se há resultado
  let ctx1 = await browser.newContext({
    ...ANDROID_DEVICE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  let page1 = await ctx1.newPage();

  try {
    const loggedIn = await doLogin(page1);
    result.steps.push({ step: 'login', ok: loggedIn });
    if (!loggedIn) { result.status = 'FALHOU'; result.reason = 'Login falhou'; return result; }

    await goHome(page1);
    const hasResultBefore = await checkResultVisible(page1, 'C-antes');
    result.steps.push({ step: 'resultado-no-contexto1', visible: hasResultBefore });
    await screenshot(page1, 'C-contexto1');

    // "Fecha aba" = fecha contexto (limpa sessionStorage mas mantém cookies)
    // Para simular corretamente, capturamos os cookies de auth antes de fechar
    const cookies    = await ctx1.cookies();
    const localStorage = await page1.evaluate(() => {
      const data = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        data[k] = window.localStorage.getItem(k);
      }
      return data;
    });

    log('C: Fechando contexto 1 (simula fechar aba)...');
    await ctx1.close();

    // Contexto 2: novo contexto (sessionStorage limpa = dismissed_jobs limpos)
    // Mas cookies de auth são restaurados
    const ctx2 = await browser.newContext({
      ...ANDROID_DEVICE,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    await ctx2.addCookies(cookies.filter(c =>
      c.domain.includes('supabase') || c.domain.includes('tamowork') ||
      c.name.includes('sb-') || c.name.includes('auth')
    ));

    const page2 = await ctx2.newPage();

    // Restaura localStorage (tokens Supabase ficam em localStorage)
    await page2.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.evaluate((ls) => {
      for (const [k, v] of Object.entries(ls)) {
        try { window.localStorage.setItem(k, v); } catch {}
      }
    }, localStorage);

    // Recarrega para aplicar auth
    await page2.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(4000);

    // sessionStorage vazio no novo contexto = dismissed_jobs = []
    // Logo, job done das últimas 24h DEVE ser restaurado
    await screenshot(page2, 'C-contexto2');

    const hasResultAfter = await checkResultVisible(page2, 'C-novo-contexto');
    result.steps.push({ step: 'resultado-no-contexto2', visible: hasResultAfter });

    // Esperado: resultado DEVE aparecer (job dentro das 24h, dismissed_jobs limpos)
    if (!hasResultBefore) {
      result.status = 'INCONCLUSIVO';
      result.reason = 'Não havia resultado no contexto 1 para testar restore no contexto 2';
    } else {
      const passed = hasResultAfter;
      result.status = passed ? 'PASSOU' : 'FALHOU';
      result.reason = passed
        ? 'Resultado restaurado corretamente ao reabrir em nova sessão (dismissed_jobs não persistem)'
        : 'BUG: Resultado NÃO restaurado ao reabrir em nova sessão — deveria aparecer (job <24h)';
    }

    await ctx2.close();

  } catch (e) {
    log(`ERRO no cenário C: ${e.message}`);
    await screenshot(page1, 'C-erro').catch(() => {});
    result.status = 'ERRO';
    result.reason = e.message;
    await ctx1.close().catch(() => {});
  }

  log(`Cenário C: ${result.status} — ${result.reason}`);
  return result;
}

// ─── CENÁRIO D ─────────────────────────────────────────────────────────────────
// Foto pronta → "Baixar" → volta ao início → resultado ainda aparece?
async function scenarioD(browser) {
  log('\n' + '═'.repeat(60));
  log('CENÁRIO D: "Baixar" → sem navegar → resultado ainda aparece? (ok se sim)');
  log('═'.repeat(60));
  const result = { name: 'D', description: '"Baixar" → resultado ainda na tela?', steps: [] };

  const context = await browser.newContext({
    ...ANDROID_DEVICE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    const loggedIn = await doLogin(page);
    result.steps.push({ step: 'login', ok: loggedIn });
    if (!loggedIn) { result.status = 'FALHOU'; result.reason = 'Login falhou'; return result; }

    await goHome(page);
    const hasResult = await checkResultVisible(page, 'D-antes');
    result.steps.push({ step: 'resultado-antes', visible: hasResult });
    await screenshot(page, 'D-home');

    if (hasResult) {
      log('D: Clicando em "Baixar"...');
      const downloadBtn = page.locator('button:has-text("Baixar"), button:has-text("Download")').first();
      if (await downloadBtn.count() > 0) {
        // Inicia download (pode abrir diálogo ou baixar silenciosamente)
        const [download] = await Promise.allSettled([
          page.waitForEvent('download', { timeout: 10000 }),
          downloadBtn.click(),
        ]);
        await page.waitForTimeout(3000);
        await screenshot(page, 'D-apos-download');

        // Verifica se resultado ainda aparece IMEDIATAMENTE após download
        const resultStillVisible = await checkResultVisible(page, 'D-imediato');
        result.steps.push({ step: 'resultado-apos-download', visible: resultStillVisible });

        // Navega para / (nova navegação, dentro da MESMA sessão)
        await goHome(page);
        await screenshot(page, 'D-home-nova-nav');
        const resultAfterNav = await checkResultVisible(page, 'D-nova-nav');
        result.steps.push({ step: 'resultado-apos-nova-nav', visible: resultAfterNav });

        // Comportamento esperado: resultado ainda aparece (download não descarta)
        // Se não aparecer é bug sutil, se aparecer é correto
        result.status = resultAfterNav ? 'PASSOU' : 'INESPERADO';
        result.reason = resultAfterNav
          ? 'Resultado persiste após download + nova navegação (correto — download não descarta job)'
          : 'INESPERADO: Resultado sumiu após download. Verificar se download chama resetJob inadvertidamente.';
      } else {
        result.status = 'INCONCLUSIVO';
        result.reason = 'Botão Baixar não encontrado';
      }
    } else {
      result.status = 'INCONCLUSIVO';
      result.reason = 'Nenhum resultado disponível para testar';
    }

  } catch (e) {
    log(`ERRO no cenário D: ${e.message}`);
    await screenshot(page, 'D-erro').catch(() => {});
    result.status = 'ERRO';
    result.reason = e.message;
  } finally {
    await context.close();
  }

  log(`Cenário D: ${result.status} — ${result.reason}`);
  return result;
}

// ─── CENÁRIO E ─────────────────────────────────────────────────────────────────
// Após geração → navega para /?ts=xxx → resultado aparece?
async function scenarioE(browser) {
  log('\n' + '═'.repeat(60));
  log('CENÁRIO E: navega para /?ts=TIMESTAMP → resultado aparece?');
  log('═'.repeat(60));
  const result = { name: 'E', description: 'Navega para /?ts=xxx → resultado aparece?', steps: [] };

  const context = await browser.newContext({
    ...ANDROID_DEVICE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();

  try {
    const loggedIn = await doLogin(page);
    result.steps.push({ step: 'login', ok: loggedIn });
    if (!loggedIn) { result.status = 'FALHOU'; result.reason = 'Login falhou'; return result; }

    // Vai para home normal primeiro
    await goHome(page);
    const hasResult = await checkResultVisible(page, 'E-home-normal');
    result.steps.push({ step: 'resultado-home-normal', visible: hasResult });
    await screenshot(page, 'E-home-normal');

    // Navega para /?ts=<timestamp>
    const ts = Date.now();
    log(`E: Navegando para /?ts=${ts}...`);
    await page.goto(`${APP_URL}/?ts=${ts}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    await screenshot(page, 'E-home-com-ts');

    const hasResultWithTs = await checkResultVisible(page, 'E-com-ts');
    result.steps.push({ step: 'resultado-com-ts', visible: hasResultWithTs });

    // Comportamento esperado: resultado deve aparecer (param na URL não afeta restore)
    if (!hasResult) {
      result.status = 'INCONCLUSIVO';
      result.reason = 'Nenhum resultado na navegação normal para comparar';
    } else {
      // Se havia resultado na home normal, deve aparecer também com ?ts
      const passed = hasResultWithTs;
      result.status = passed ? 'PASSOU' : 'FALHOU';
      result.reason = passed
        ? 'Resultado aparece com parâmetro ?ts= na URL (correto — parâmetros não afetam restore)'
        : 'BUG: Resultado NÃO aparece quando URL tem parâmetro ?ts= — verificar se Next.js re-monta o componente';
    }

  } catch (e) {
    log(`ERRO no cenário E: ${e.message}`);
    await screenshot(page, 'E-erro').catch(() => {});
    result.status = 'ERRO';
    result.reason = e.message;
  } finally {
    await context.close();
  }

  log(`Cenário E: ${result.status} — ${result.reason}`);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirp(SCREENSHOTS_DIR);
  stepNum = 0;

  const startTotal = Date.now();
  log('═'.repeat(60));
  log('  Agente de Teste Overnight — TamoWork Foto IA');
  log('  Conta: free-b3 | Foco: Restore de estado');
  log(`  Viewport: 412x915 (Android Pixel 7) | headless`);
  log(`  Início: ${new Date().toISOString()}`);
  log('═'.repeat(60));

  // Preparação
  const userId = await ensureFreeBAccount();
  log(`User ID: ${userId ?? 'desconhecido'}`);

  // Limpa jobs para estado fresco
  await cleanUserJobs(userId);

  // Baixa imagem de teste
  let imgPath;
  try {
    imgPath = await downloadProductImage();
  } catch (e) {
    log(`AVISO: Falha ao baixar imagem: ${e.message}`);
    imgPath = null;
  }

  // Inicia browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-blink-features=AutomationControlled'],
  });

  // ── FASE 1: Gera foto (contexto dedicado) ──────────────────────────────────
  log('\n=== FASE 1: GERAÇÃO DA FOTO ===');
  let photoResult = { ok: false, elapsedMs: 0, elapsedLabel: 'não executado', error: 'imgPath null' };
  let photoJobId  = null;

  if (imgPath) {
    const genCtx  = await browser.newContext({
      ...ANDROID_DEVICE,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    const genPage = await genCtx.newPage();

    try {
      const loggedIn = await doLogin(genPage);
      if (loggedIn) {
        photoResult = await generatePhoto(genPage, imgPath);

        // Captura job ID do DOM ou Supabase para referência
        if (photoResult.ok && userId) {
          const jobs = await supabase('GET', `/rest/v1/image_jobs?user_id=eq.${userId}&status=eq.done&order=created_at.desc&limit=1`, null);
          if (Array.isArray(jobs.body) && jobs.body.length > 0) {
            photoJobId = jobs.body[0].id;
            log(`Job ID gerado: ${photoJobId}`);
          }
        }
      } else {
        photoResult.error = 'Login falhou na fase de geração';
      }
    } catch (e) {
      photoResult.error = e.message;
      log(`ERRO na geração: ${e.message}`);
      await screenshot(genPage, 'geracao-erro').catch(() => {});
    } finally {
      await genCtx.close();
    }
  }

  log(`Resultado da geração: ${photoResult.ok ? 'SUCESSO' : 'FALHOU'} — ${photoResult.elapsedLabel}`);

  // ── FASE 2: Cenários A–E ───────────────────────────────────────────────────
  log('\n=== FASE 2: CENÁRIOS DE RESTORE ===');

  const scenarioResultsArr = [];

  // Se geração falhou, os cenários serão INCONCLUSIVOS mas ainda tentamos
  // (pode haver job antigo se não foi limpo)
  const resA = await scenarioA(browser);
  scenarioResultsArr.push(resA);

  const resB = await scenarioB(browser);
  scenarioResultsArr.push(resB);

  const resC = await scenarioC(browser);
  scenarioResultsArr.push(resC);

  const resD = await scenarioD(browser);
  scenarioResultsArr.push(resD);

  const resE = await scenarioE(browser);
  scenarioResultsArr.push(resE);

  await browser.close();

  // ── RELATÓRIO FINAL ────────────────────────────────────────────────────────
  const totalMs  = Date.now() - startTotal;
  const totalMin = Math.floor(totalMs / 60000);
  const totalSec = Math.floor((totalMs % 60000) / 1000);

  const report = {
    metadata: {
      testSuite:    'free-b3 — Bug de Restore de Estado',
      app:          APP_URL,
      account:      TEST_EMAIL,
      plan:         'free',
      userId:       userId ?? 'desconhecido',
      device:       'Android Pixel 7 (412x915, hasTouch, isMobile)',
      userAgent:    ANDROID_DEVICE.userAgent,
      headless:     true,
      startedAt:    new Date(startTotal).toISOString(),
      finishedAt:   new Date().toISOString(),
      totalDuration: `${totalMin}m${totalSec}s`,
    },
    generation: {
      status:        photoResult.ok ? 'SUCESSO' : 'FALHOU',
      elapsedMs:     photoResult.elapsedMs,
      elapsedLabel:  photoResult.elapsedLabel,
      jobId:         photoJobId,
      productName:   'Óculos de sol',
      mode:          'catalogo',
      imageUrl:      PRODUCT_IMAGE_URL,
      error:         photoResult.error ?? null,
    },
    scenarios: scenarioResultsArr.map(s => ({
      cenario:     s.name,
      descricao:   s.description,
      status:      s.status,
      motivo:      s.reason,
      etapas:      s.steps,
    })),
    summary: {
      total:       scenarioResultsArr.length,
      passou:      scenarioResultsArr.filter(s => s.status === 'PASSOU').length,
      falhou:      scenarioResultsArr.filter(s => s.status === 'FALHOU').length,
      inconclusivo: scenarioResultsArr.filter(s => s.status === 'INCONCLUSIVO').length,
      erro:        scenarioResultsArr.filter(s => s.status === 'ERRO').length,
      inesperado:  scenarioResultsArr.filter(s => s.status === 'INESPERADO').length,
    },
    screenshotsDir: SCREENSHOTS_DIR,
  };

  // Salva relatório
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');

  // Exibe sumário no console
  log('\n' + '═'.repeat(60));
  log('  RELATÓRIO FINAL');
  log('═'.repeat(60));
  log(`Geração: ${report.generation.status} em ${report.generation.elapsedLabel}`);
  log(`Job ID: ${photoJobId ?? 'N/A'}`);
  log('');
  log('Cenários:');
  for (const s of scenarioResultsArr) {
    const icon = s.status === 'PASSOU' ? '✅' : s.status === 'FALHOU' ? '❌' : s.status === 'INESPERADO' ? '⚠️' : s.status === 'ERRO' ? '💥' : '❓';
    log(`  ${icon} Cenário ${s.name}: ${s.status} — ${s.reason}`);
  }
  log('');
  log(`Sumário: ${report.summary.passou} passou | ${report.summary.falhou} falhou | ${report.summary.inconclusivo} inconclusivo | ${report.summary.inesperado} inesperado | ${report.summary.erro} erro`);
  log(`Duração total: ${totalMin}m${totalSec}s`);
  log(`Relatório JSON: ${REPORT_PATH}`);
  log(`Screenshots: ${SCREENSHOTS_DIR}`);
  log('═'.repeat(60));

  return report;
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
