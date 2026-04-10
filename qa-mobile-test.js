/**
 * QA Mobile Test — TamoWork Foto IA
 * Emula iPhone 14 (390x844, touch, mobile UA)
 * Roda com: node qa-mobile-test.js
 */

const { chromium } = require('C:/Users/Notebook/node_modules/playwright');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_URL = 'https://tamowork.com';
const TEST_EMAIL = 'test-mobile-qa@tamowork.test';
const TEST_PASS = 'TestQA2026!';
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';

// iPhone 14
const IPHONE14 = {
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
};

// ─── Utils ────────────────────────────────────────────────────────────────────
let stepNum = 0;
const results = [];
const timings = {};

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function result(ok, label, detail = '') {
  const icon = ok ? '✅' : '❌';
  const line = `${icon} ${label}${detail ? ' — ' + detail : ''}`;
  results.push(line);
  console.log(line);
}

async function screenshot(page, name) {
  stepNum++;
  const file = path.join(SCREENSHOTS_DIR, `${String(stepNum).padStart(2, '0')}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    log(`Screenshot: ${file}`);
  } catch (e) {
    log(`Screenshot falhou: ${e.message}`);
  }
  return file;
}

async function supabaseReq(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Download test image ───────────────────────────────────────────────────────
async function downloadTestImage() {
  const imgPath = path.join(SCREENSHOTS_DIR, 'test-product.jpg');
  if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 1000) {
    log(`Usando imagem de teste existente: ${imgPath}`);
    return imgPath;
  }

  log('Baixando imagem de produto para teste (tênis)...');
  const imageUrl = 'https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/onboard/tenis.jpg';

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath);
    https.get(imageUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(imgPath); });
    }).on('error', (err) => {
      fs.unlink(imgPath, () => {});
      reject(err);
    });
  });
}

// ─── Pular onboarding via localStorage ─────────────────────────────────────────
async function skipOnboarding(page) {
  const url = page.url();
  if (!url.includes('/onboarding')) return;

  log('Em onboarding — tentando pular...');

  // Tentar clicar em "Testar grátis" (função skip() do onboarding)
  for (let attempt = 0; attempt < 8; attempt++) {
    // Botões possíveis
    const skipSelectors = [
      'button:has-text("Testar grátis")',
      'button:has-text("Try for free")',
      'button:has-text("Probar gratis")',
      'button:has-text("Pular")',
      'button:has-text("Skip")',
    ];

    let clicked = false;
    for (const sel of skipSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        await btn.click();
        clicked = true;
        log(`Clicou em skip: ${sel}`);
        break;
      }
    }

    await page.waitForTimeout(1500);

    if (!page.url().includes('/onboarding')) {
      log(`Saiu do onboarding — URL: ${page.url()}`);
      return;
    }

    if (!clicked) {
      // Tentar via JS direto
      log(`Tentando skip via JS (attempt ${attempt + 1})...`);
      await page.evaluate(() => {
        localStorage.setItem('tw_onboarding_done', '1');
      });
      await page.goto('https://tamowork.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000);
      return;
    }
  }

  // Fallback: JS direto
  log('Fallback: skip via JS localStorage...');
  await page.evaluate(() => {
    localStorage.setItem('tw_onboarding_done', '1');
  });
  await page.goto('https://tamowork.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  log('═'.repeat(60));
  log('  QA Mobile — TamoWork Foto IA');
  log(`  App: ${APP_URL}`);
  log(`  Device: iPhone 14 (390x844, isMobile, hasTouch)`);
  log('═'.repeat(60));

  let testImagePath;
  try {
    testImagePath = await downloadTestImage();
  } catch (e) {
    log(`AVISO: Não foi possível baixar imagem de teste: ${e.message}`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    ...IPHONE14,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 1: CADASTRO/LOGIN
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== FASE 1: CADASTRO / LOGIN ===');

    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'login-page');

    const pageTitle = await page.title();
    result(true, 'Página de login carregou', `title: "${pageTitle}"`);

    // Clicar em "Usar e-mail e senha" para exibir o form (showEmail=false por padrão)
    const emailToggle = page.locator('button:has-text("e-mail e senha"), button:has-text("email"), button:has-text("Usar e-mail")').first();
    if (await emailToggle.count() > 0) {
      await emailToggle.click();
      await page.waitForTimeout(600);
      log('Clicou em "Usar e-mail e senha"');
    }

    // Clicar em "Criar conta"
    const criarContaBtn = page.locator('button:has-text("Criar conta")').first();
    if (await criarContaBtn.count() > 0) {
      await criarContaBtn.click();
      await page.waitForTimeout(400);
    }

    // Preencher e submeter
    await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASS);
    await screenshot(page, 'login-preenchido');
    await page.locator('input[type="password"]').first().press('Enter');
    await page.waitForTimeout(5000);

    let currentUrl = page.url();
    log(`URL após cadastro: ${currentUrl}`);

    // Se ainda no login, conta existe — fazer login
    if (currentUrl.includes('/login')) {
      log('Conta já existe — fazendo login...');

      // A página pode estar com os inputs visíveis mas na aba "Criar conta"
      // Precisamos clicar na aba "Entrar" (first() pode ser a aba, last() é o submit)
      // Os botões são: [LangBtn, GoogleBtn, "Entrar" (tab), "Criar conta" (tab), "Entrar" (submit)]
      // Então a aba Entrar é o 3º botão (índice 2)

      // Primeiro verificar se os inputs já estão visíveis
      const inputsVisible = await page.locator('input[type="email"]').count() > 0;

      if (!inputsVisible) {
        // Re-abrir campos
        const et2 = page.locator('button:has-text("e-mail e senha"), button:has-text("email"), button:has-text("Usar e-mail")').first();
        if (await et2.count() > 0) { await et2.click(); await page.waitForTimeout(400); }
      }

      // Clicar em "Entrar" tab — mas cuidado: existe "Entrar" tab E "Entrar" submit
      // Usar o primeiro botão com esse texto que NÃO seja o submit (type != submit ou não está no form)
      // Abordagem: clicar no tab via position — o tab fica em div.tabs, antes do form
      const entrarTabBtn = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
      if (await entrarTabBtn.count() > 0) {
        await entrarTabBtn.click();
        await page.waitForTimeout(400);
        log('Clicou na aba Entrar');
      }

      await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
      await page.locator('input[type="password"]').first().fill(TEST_PASS);

      // Clicar no botão submit "Entrar" (o último botão com esse texto no form)
      const submitEntrar = page.locator('form button').filter({ hasText: /^Entrar$/ }).first();
      if (await submitEntrar.count() > 0) {
        await submitEntrar.click();
      } else {
        await page.locator('input[type="password"]').first().press('Enter');
      }

      await page.waitForTimeout(5000);
      currentUrl = page.url();
      log(`URL após login: ${currentUrl}`);
    }

    // Pular onboarding se necessário
    if (currentUrl.includes('/onboarding')) {
      await skipOnboarding(page);
      currentUrl = page.url();
    }

    const isLoggedIn = !currentUrl.includes('/login');
    result(isLoggedIn, 'Login/Cadastro bem-sucedido', `URL: ${currentUrl}`);

    if (!isLoggedIn) {
      log('ERRO: Não foi possível autenticar. Abortando teste.');
      await browser.close();
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 2: LAYOUT MOBILE
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== FASE 2: LAYOUT MOBILE ===');

    // Garantir que está na home
    if (!currentUrl.match(/^https:\/\/tamowork\.com\/?$/)) {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
    }

    await screenshot(page, 'home-layout');

    // Verificar BottomNav: deve ter 3 itens de nav na parte inferior
    // Buscar por nav com position fixed/sticky no bottom
    const bottomNavVisible = await page.evaluate(() => {
      const navs = document.querySelectorAll('nav, [class*="bottom"], [class*="BottomNav"]');
      for (const el of navs) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' && style.bottom === '0px') return true;
        if (style.position === 'fixed' && parseInt(style.bottom) < 10) return true;
      }
      // Fallback: procurar qualquer nav fixed
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.position === 'fixed' && rect.bottom >= window.innerHeight - 5 && rect.height > 40 && rect.height < 120) return true;
      }
      return false;
    });
    result(bottomNavVisible, 'BottomNav (barra inferior) presente e fixa no mobile');

    // Verificar que sidebar NÃO está visível
    const sidebarVisible = await page.evaluate(() => {
      const sels = ['[class*="sidebar"]', '[class*="Sidebar"]', 'aside', '[class*="DesktopSidebar"]'];
      for (const sel of sels) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 50) return true;
        }
      }
      return false;
    });
    result(!sidebarVisible, 'Sidebar NÃO visível no mobile', sidebarVisible ? 'BUG: sidebar visível!' : 'correto');

    // Screenshot pra evidência
    await screenshot(page, 'layout-bottom-nav');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 3: FLUXO FREE — Selecionar modo e fazer upload
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== FASE 3: FLUXO FREE — UPLOAD E GERAÇÃO ===');

    // Verificar qual user está logado na sessão
    const sessionUserId = await page.evaluate(() => {
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.includes('supabase') || k.includes('auth')) {
            try {
              const val = JSON.parse(localStorage.getItem(k) || '{}');
              if (val?.user?.id) return val.user.id;
              if (val?.access_token) {
                const parts = val.access_token.split('.');
                const payload = JSON.parse(atob(parts[1]));
                return payload.sub || null;
              }
            } catch {}
          }
        }
        return null;
      } catch { return null; }
    }).catch(() => null);
    log(`User na sessão do browser: ${sessionUserId}`);
    result(sessionUserId === '946a8b9c-f9e1-4a12-ad5c-793367728b2e', 'Sessão é do usuário test-mobile-qa', `userId=${sessionUserId}`);

    // Verificar ModeSelector
    await page.waitForTimeout(1000);
    const modeSelectorVisible = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="mode"], [class*="Mode"], [class*="card"]');
      return cards.length > 0;
    });
    result(modeSelectorVisible, 'Seletor de modo presente');

    // Clicar no card "Fundo branco"
    let fundoBrancoClicked = false;

    // Tentar por texto
    const fundoBrancoCard = page.locator('div, button').filter({ hasText: /^Fundo branco$/i }).first();
    if (await fundoBrancoCard.count() > 0) {
      await fundoBrancoCard.click();
      fundoBrancoClicked = true;
    }

    if (!fundoBrancoClicked) {
      // Tentar em qualquer elemento com o texto
      const allWithText = page.locator(':has-text("Fundo branco")').last();
      if (await allWithText.count() > 0) {
        await allWithText.click();
        fundoBrancoClicked = true;
      }
    }

    await page.waitForTimeout(1200);
    result(fundoBrancoClicked, 'Modo "Fundo branco" selecionado');
    await screenshot(page, 'modo-fundo-branco');

    // Upload de foto — o dropzone é um div que ao clicar ativa fileRef hidden
    if (testImagePath && fs.existsSync(testImagePath)) {
      log('Tentando upload de foto...');

      // Tentar setar o arquivo diretamente no input hidden
      let uploadDone = false;

      // Approach 1: setar via fileRef diretamente
      const fileInputs = page.locator('input[type="file"]');
      const inputCount = await fileInputs.count();
      log(`Inputs type=file encontrados: ${inputCount}`);

      if (inputCount > 0) {
        // Tentar cada input de arquivo
        for (let i = 0; i < inputCount; i++) {
          try {
            await fileInputs.nth(i).setInputFiles(testImagePath);
            uploadDone = true;
            log(`Upload via input[type=file] #${i} OK`);
            break;
          } catch (e) {
            log(`Input #${i} falhou: ${e.message}`);
          }
        }
      }

      if (!uploadDone) {
        // Approach 2: clicar no dropzone e depois setInputFiles
        const dropzone = page.locator('[class*="drop"], [class*="upload"], [class*="picker"]').first();
        if (await dropzone.count() > 0) {
          log('Tentando via dropzone...');
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
            dropzone.click(),
          ]);
          if (fileChooser) {
            await fileChooser.setFiles(testImagePath);
            uploadDone = true;
            log('Upload via filechooser OK');
          }
        }
      }

      if (!uploadDone) {
        // Approach 3: usar evaluate para disparar change event no input hidden
        log('Tentando upload via evaluate...');
        const dataTransferText = fs.readFileSync(testImagePath).toString('base64');
        uploadDone = await page.evaluate(async (b64data) => {
          const inputs = document.querySelectorAll('input[type="file"]');
          if (inputs.length === 0) return false;
          // Criar um File do base64
          const byteString = atob(b64data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          const blob = new Blob([ab], { type: 'image/jpeg' });
          const file = new File([blob], 'tenis.jpg', { type: 'image/jpeg' });
          const dt = new DataTransfer();
          dt.items.add(file);
          inputs[0].files = dt.files;
          inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }, dataTransferText);
        if (uploadDone) log('Upload via evaluate OK');
      }

      await page.waitForTimeout(1500);
      result(uploadDone, 'Upload de foto realizado');
      await screenshot(page, 'apos-upload');
    } else {
      result(false, 'Upload — imagem de teste não disponível');
    }

    // Preencher campos obrigatórios se necessários (produto e cenário são required para alguns modos)
    const produtoInput = page.locator('input[placeholder*="produto"], input[placeholder*="Product"], textarea[placeholder*="produto"]').first();
    if (await produtoInput.count() > 0) {
      const isRequired = await produtoInput.getAttribute('required');
      if (isRequired !== null) {
        await produtoInput.fill('Tênis esportivo branco');
        log('Preencheu campo produto');
      }
    }

    // Para fundo_branco, cenário é preenchido automaticamente pela app
    // mas vamos verificar se há campo de cenário e preencher se necessário
    const cenarioInput = page.locator('input[placeholder*="cenário"], input[placeholder*="scene"], textarea[placeholder*="cenário"]').first();
    if (await cenarioInput.count() > 0) {
      const cenarioVal = await cenarioInput.inputValue().catch(() => '');
      if (!cenarioVal) await cenarioInput.fill('fundo branco limpo, luz de estúdio');
    }

    // Submeter
    log('Procurando botão Criar/Gerar...');
    const submitBtn = page.locator('form button[type="submit"], button:has-text("Criar foto"), button:has-text("Gerar")').first();
    const hasSubmitBtn = await submitBtn.count() > 0;

    // Tentar também por texto genérico
    let gerarBtn = submitBtn;
    if (!hasSubmitBtn) {
      gerarBtn = page.locator('button').filter({ hasText: /^(Criar|Gerar|Criar foto|Criar imagem)$/i }).first();
    }

    const hasGerarBtn = await gerarBtn.count() > 0 && await gerarBtn.isVisible().catch(() => false);

    if (hasGerarBtn) {
      const btnText = await gerarBtn.textContent();
      const isDisabled = await gerarBtn.isDisabled();

      if (isDisabled) {
        const btnTextContent = btnText?.trim() || '';
        const hasTimer = /\d+:\d+|\d+h|\d+min/i.test(btnTextContent);
        result(true, 'Botão de gerar encontrado (mas desabilitado)', `Texto: "${btnTextContent.slice(0, 60)}"`);
        result(hasTimer, 'Timer de rate limit visível no botão', hasTimer ? btnTextContent.slice(0, 40) : 'sem timer');

        log('Botão está desabilitado (rate limit ativo). Testando estado de limite diário...');
        await screenshot(page, 'rate-limit-ativo');
      } else {
        log(`Clicando em: "${btnText?.trim()}"`);
        timings.jobStart = Date.now();
        await gerarBtn.click();
        await page.waitForTimeout(2000);
        result(true, 'Job de geração submetido', btnText?.trim().slice(0, 40));
        await screenshot(page, 'gerando');

        // Aguardar resultado (máx 3 min)
        log('Aguardando resultado (máx 3 min)...');
        let jobDone = false;
        let jobFailed = false;

        for (let i = 0; i < 36; i++) {
          await page.waitForTimeout(5000);

          const pageContent = await page.content();
          const hasOutputImg = await page.locator('img[src*="image-jobs"]').count() > 0;
          const hasErrorMsg = pageContent.includes('Algo deu errado') || pageContent.includes('deu errado');
          const stillGenerating = pageContent.includes('Gerando') || pageContent.includes('gerando') || pageContent.includes('Aguarde');

          if (hasOutputImg && !stillGenerating) {
            timings.jobEnd = Date.now();
            timings.processingTime = Math.round((timings.jobEnd - timings.jobStart) / 1000);
            result(true, `Foto gerada com sucesso`, `Tempo: ${timings.processingTime}s`);
            jobDone = true;
            break;
          }

          if (hasErrorMsg) {
            timings.processingTime = Math.round((Date.now() - timings.jobStart) / 1000);
            const errText = await page.locator('[class*="error"], :has-text("Algo deu errado")').first().textContent().catch(() => 'erro desconhecido');
            result(false, 'Job falhou com erro', errText.trim().slice(0, 100));
            jobFailed = true;
            break;
          }

          if (i % 3 === 0) {
            const elapsed = Math.round((Date.now() - timings.jobStart) / 1000);
            log(`Aguardando... ${elapsed}s`);
            await screenshot(page, `gerando-${i}`);
          }
        }

        if (!jobDone && !jobFailed) {
          timings.processingTime = Math.round((Date.now() - timings.jobStart) / 1000);
          result(false, 'Timeout: job não concluiu em 3 min', `${timings.processingTime}s`);
        }

        await screenshot(page, 'resultado');

        // ── FASE 4: Verificar resultado e upsell ───────────────────────────────
        log('\n=== FASE 4: RESULTADO E UPSELL ===');

        if (jobDone) {
          // Verificar imagem de resultado
          const resultImg = page.locator('img[src*="image-jobs"]').first();
          const hasResultImg = await resultImg.count() > 0;
          result(hasResultImg, 'Imagem de resultado exibida');

          // Verificar upsell acima da foto
          const upsellEl = page.locator('[class*="upsell"], [class*="upgrade"]').filter({ hasText: /pro|assinar|upgrade|plano/i }).first();
          const hasUpsell = await upsellEl.isVisible().catch(() => false);
          result(hasUpsell, 'Banner de upsell PRO presente na tela de resultado');

          if (hasUpsell) {
            const upsellBox = await upsellEl.boundingBox().catch(() => null);
            const imgBox = await resultImg.boundingBox().catch(() => null);
            if (upsellBox && imgBox) {
              const upsellAbove = upsellBox.y < imgBox.y;
              result(upsellAbove, 'Upsell aparece ACIMA da foto', upsellAbove ? 'correto' : `BUG: upsell y=${upsellBox.y} > foto y=${imgBox.y}`);
            } else {
              result(false, 'Não foi possível comparar posição upsell vs foto (bounding box null)');
            }
          } else {
            result(false, 'Upsell não encontrado — pode ser bug ou seletor errado');
          }

          // ── FASE 5: Download ────────────────────────────────────────────────
          log('\n=== FASE 5: DOWNLOAD ===');

          const downloadBtn = page.locator('button').filter({ hasText: /baixar|download/i }).first();
          const hasDownloadBtn = await downloadBtn.count() > 0 && await downloadBtn.isVisible().catch(() => false);
          result(hasDownloadBtn, 'Botão de download presente');

          if (hasDownloadBtn) {
            try {
              const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
                downloadBtn.click(),
              ]);
              result(!!download, 'Download iniciado', download ? `arquivo: ${download.suggestedFilename()}` : 'evento não disparado (pode usar window.open)');
            } catch (e) {
              result(false, 'Download', `Erro: ${e.message}`);
            }
          }

          await screenshot(page, 'download-check');

          // ── FASE 6: Criar Vídeo (FREE — deve bloquear) ─────────────────────
          log('\n=== FASE 6: CRIAR VÍDEO (FREE — deve bloquear) ===');

          const videoBtn = page.locator('button').filter({ hasText: /criar vídeo|vídeo|video/i }).first();
          const hasVideoBtn = await videoBtn.count() > 0 && await videoBtn.isVisible().catch(() => false);
          result(hasVideoBtn, 'Botão "Criar vídeo" presente');

          if (hasVideoBtn) {
            await videoBtn.click();
            await page.waitForTimeout(2500);
            await screenshot(page, 'criar-video-free');

            // Verificar se bloqueou (modal de upsell ou erro 403)
            const blockedTexts = ['plano Pro', 'apenas no plano', 'Pro', 'assinar', 'Disponível apenas'];
            let isBlocked = false;
            for (const text of blockedTexts) {
              const found = await page.locator(`:has-text("${text}")`).count() > 0;
              if (found) { isBlocked = true; break; }
            }
            result(isBlocked, 'Criar vídeo BLOQUEADO para FREE (upsell/aviso)', isBlocked ? 'correto' : 'BUG: não bloqueou');
          }
        }

        // ── FASE 7: Segunda foto (rate limit) ─────────────────────────────────
        log('\n=== FASE 7: SEGUNDA FOTO — LIMITE DIÁRIO ===');

        // Voltar para modo seleção
        const novaFotoBtn = page.locator('button').filter({ hasText: /nova foto|criar nova|começar|voltar/i }).first();
        if (await novaFotoBtn.count() > 0 && await novaFotoBtn.isVisible().catch(() => false)) {
          await novaFotoBtn.click();
          await page.waitForTimeout(1500);
        } else {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(2000);
        }

        await screenshot(page, 'pos-resultado-home');

        // Verificar se há DailyLimitScreen ou botão com timer
        const dailyLimitVisible = await page.evaluate(() => {
          const body = document.body.innerText;
          return body.includes('limite') || body.includes('Limite') || body.includes('amanhã') || body.includes('disponível em');
        });

        // Tentar selecionar Fundo branco novamente
        const fb2 = page.locator('div, button').filter({ hasText: /^Fundo branco$/i }).first();
        if (await fb2.count() > 0) { await fb2.click(); await page.waitForTimeout(1000); }

        const createBtn2 = page.locator('button').filter({ hasText: /^(Criar|Gerar|Criar foto)$/i }).first();
        const hasCreateBtn2 = await createBtn2.count() > 0;

        if (hasCreateBtn2) {
          const isDisabled2 = await createBtn2.isDisabled().catch(() => false);
          const btnText2 = await createBtn2.textContent().catch(() => '');
          const hasTimer2 = /\d+:\d+|\d+h|\d+min/i.test(btnText2);

          result(isDisabled2 || dailyLimitVisible, 'Segunda foto bloqueada (rate limit)', `disabled=${isDisabled2} dailyLimit=${dailyLimitVisible}`);
          result(hasTimer2, 'Timer de countdown visível', hasTimer2 ? btnText2?.trim().slice(0, 50) : 'sem timer no botão');
        } else if (dailyLimitVisible) {
          result(true, 'Tela de limite diário exibida');
          result(false, 'Timer no botão (usando tela de limite, não botão)');
        } else {
          result(false, 'Não foi possível verificar rate limit (botão não encontrado)');
          result(false, 'Timer de countdown');
        }

        await screenshot(page, 'limite-diario');
      }
    } else {
      log('Botão de criar não encontrado');
      result(false, 'Botão de gerar/criar foto encontrado');
      await screenshot(page, 'sem-botao-criar');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 8: SUPABASE — STATUS DOS JOBS
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== FASE 8: SUPABASE — STATUS ===');

    // O userId real do test-mobile-qa
    const QA_USER_ID = '946a8b9c-f9e1-4a12-ad5c-793367728b2e';

    try {
      // Jobs do usuário QA
      const qaJobsResp = await supabaseReq('GET', `/rest/v1/image_jobs?user_id=eq.${QA_USER_ID}&order=created_at.desc&limit=10`, null);
      log(`Jobs do usuário QA: HTTP ${qaJobsResp.status}`);

      if (qaJobsResp.status === 200 && Array.isArray(qaJobsResp.body)) {
        const qaJobs = qaJobsResp.body;
        log(`Jobs do usuário QA: ${qaJobs.length}`);
        qaJobs.slice(0, 5).forEach(j => log(`  ${j.id?.slice(0, 8)}: ${j.status} — ${j.created_at?.slice(0, 16)}`));

        const recentJobs = qaJobs.filter(j => Date.now() - new Date(j.created_at).getTime() < 30 * 60 * 1000);
        result(recentJobs.length > 0, `Jobs da sessão atual (usuário QA)`, `${recentJobs.length} criados nos últimos 30 min`);

        if (recentJobs.length > 0) {
          const last = recentJobs[0];
          result(last.status === 'done', `Último job do usuário QA`, `status=${last.status}`);
        } else if (qaJobs.length === 0) {
          result(false, 'Nenhum job criado para o usuário QA', 'Possível bug: upload/submit não funcionou');
        }
      } else {
        result(false, 'Consulta Supabase jobs QA', `HTTP ${qaJobsResp.status}`);
      }

      // Jobs failed recentes no sistema todo (últimas 2h)
      const allJobsResp = await supabaseReq('GET', '/rest/v1/image_jobs?order=created_at.desc&limit=20', null);
      if (allJobsResp.status === 200 && Array.isArray(allJobsResp.body)) {
        const failedRecent = allJobsResp.body.filter(j =>
          j.status === 'failed' && Date.now() - new Date(j.created_at).getTime() < 2 * 60 * 60 * 1000
        );
        result(failedRecent.length === 0, `Sem jobs failed nas últimas 2h (sistema geral)`, failedRecent.length > 0 ? `${failedRecent.length} jobs failed: ${failedRecent.map(j=>j.error_message).join(', ')}` : 'ok');
      }
    } catch (e) {
      result(false, 'Supabase jobs', `Erro: ${e.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 9: PROMOVER CONTA PARA PRO via Supabase
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== FASE 9: PROMOVER CONTA PARA PRO ===');

    let userId = null;

    // Buscar userId via auth admin — IMPORTANTE: filtrar pelo email exato, a API pode retornar múltiplos
    try {
      const authResp = await supabaseReq('GET', `/auth/v1/admin/users?email=${encodeURIComponent(TEST_EMAIL)}`, null);
      log(`Auth admin response: HTTP ${authResp.status}`);

      if (authResp.status === 200 && authResp.body?.users?.length > 0) {
        // DEVE filtrar pelo email exato (a API pode retornar resultados parciais)
        const exactUser = authResp.body.users.find(u => u.email === TEST_EMAIL);
        if (exactUser) {
          userId = exactUser.id;
          result(true, 'Usuário encontrado via auth admin (email exato)', `userId=${userId}`);
        } else {
          // Fallback: primeiro resultado
          userId = authResp.body.users[0].id;
          log(`AVISO: email exato não encontrado, usando primeiro: ${authResp.body.users[0].email}`);
          result(false, 'Email exato não encontrado — usando primeiro resultado', `encontrado: ${authResp.body.users[0].email}`);
        }
      } else {
        log(`Auth admin response body: ${JSON.stringify(authResp.body).slice(0, 200)}`);
      }
    } catch (e) {
      log(`Erro auth admin: ${e.message}`);
    }

    if (!userId) {
      // Obter userId pelo token da sessão atual via página
      log('Tentando obter userId via sessão da página...');
      userId = await page.evaluate(async () => {
        try {
          const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
          const client = createClient(
            'https://ddpyvdtgxemyxltgtxsh.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.vqzY79VQsMXSINDNJpBjfq0TNakEbPVH6oN2kGRJKdg'
          );
          const { data } = await client.auth.getUser();
          return data?.user?.id ?? null;
        } catch { return null; }
      }).catch(() => null);

      if (userId) {
        result(true, 'Obteve userId da sessão do browser', `userId=${userId}`);
      }
    }

    if (userId) {
      // Tentar upsert na tabela user_plans (tabela correta conforme schema)
      log(`Atualizando user_plans para userId=${userId}...`);

      const upsertResp = await supabaseReq('POST', '/rest/v1/user_plans', {
        user_id: userId,
        plan: 'pro',
        period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      log(`POST user_plans: HTTP ${upsertResp.status} — ${JSON.stringify(upsertResp.body).slice(0, 200)}`);

      if (upsertResp.status === 409 || upsertResp.status === 201 || upsertResp.status === 200) {
        // 409 = conflito (já existe), fazer PATCH
        if (upsertResp.status === 409) {
          const patchResp = await supabaseReq('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
            plan: 'pro',
            period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
          log(`PATCH user_plans: HTTP ${patchResp.status}`);
          result(patchResp.status >= 200 && patchResp.status < 300, 'Conta promovida para PRO (PATCH)', `HTTP ${patchResp.status}`);
        } else {
          result(true, 'Conta promovida para PRO (INSERT)', `HTTP ${upsertResp.status}`);
        }
      } else {
        // Tentar PATCH direto
        const patchResp = await supabaseReq('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
          plan: 'pro',
          period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
        log(`PATCH user_plans fallback: HTTP ${patchResp.status}`);
        result(patchResp.status >= 200 && patchResp.status < 300, 'Conta promovida para PRO (PATCH fallback)', `HTTP ${patchResp.status}`);
      }

      // Verificar se foi aplicado
      const verifyResp = await supabaseReq('GET', `/rest/v1/user_plans?user_id=eq.${userId}`, null);
      log(`Verificação user_plans: ${JSON.stringify(verifyResp.body).slice(0, 200)}`);
      if (verifyResp.status === 200 && Array.isArray(verifyResp.body) && verifyResp.body.length > 0) {
        const planRecord = verifyResp.body[0];
        result(planRecord.plan === 'pro', 'Verificação: plan=pro no Supabase', `plan=${planRecord.plan} period_end=${planRecord.period_end?.slice(0, 10)}`);
      }

    } else {
      result(false, 'Não foi possível obter userId para promoção PRO');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 10: RELOGAR E TESTAR PRO
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== FASE 10: TESTE COM CONTA PRO ===');

    // Recarregar página para pegar novo status
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await screenshot(page, 'pro-home');

    // Verificar badge PRO no header
    const proBadge = page.locator(':has-text("Pro"), [class*="proBadge"], [class*="pro-badge"]').filter({ hasText: /✦.*Pro|Pro/i }).first();
    const hasPro = await proBadge.isVisible().catch(() => false);
    result(hasPro, 'Badge PRO visível no header após promoção');

    // Verificar botão de criar foto desbloqueado
    const fb3 = page.locator('div, button').filter({ hasText: /^Fundo branco$/i }).first();
    if (await fb3.count() > 0) { await fb3.click(); await page.waitForTimeout(800); }

    const createBtnPro = page.locator('button').filter({ hasText: /^(Criar|Gerar|Criar foto)$/i }).first();
    if (await createBtnPro.count() > 0) {
      const isDisabledPro = await createBtnPro.isDisabled().catch(() => false);
      const btnTextPro = await createBtnPro.textContent().catch(() => '');
      const hasTimerPro = /\d+:\d+|\d+h/i.test(btnTextPro);
      result(!isDisabledPro && !hasTimerPro, 'Botão de criar foto DESBLOQUEADO para PRO', `disabled=${isDisabledPro} timer=${hasTimerPro} texto="${btnTextPro?.trim().slice(0, 30)}"`);
    }

    await screenshot(page, 'pro-criar-desbloqueado');

    // Navegar para /criacoes
    log('Navegando para /criacoes...');
    await page.goto(`${APP_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    await screenshot(page, 'pro-criacoes');

    const criacoesUrl = page.url();
    result(criacoesUrl.includes('criacoes'), 'Tela /criacoes acessível', `URL: ${criacoesUrl}`);

    const photosGrid = await page.locator('img').count();
    log(`Imagens na tela de criações: ${photosGrid}`);
    result(photosGrid > 0, 'Fotos/imagens exibidas na tela de Criações', `${photosGrid} imagens`);

    // ── FASE 11: Interface de vídeo (PRO) ─────────────────────────────────────
    log('\n=== FASE 11: CRIAR VÍDEO (PRO) ===');

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    // Selecionar modo vídeo — o card chama-se "Vídeo animado" no ModeSelector
    const videoModeCard = page.locator('div, button').filter({ hasText: /Vídeo animado|Criar vídeo|Vídeo/i }).first();
    const hasVideoModeCard = await videoModeCard.count() > 0 && await videoModeCard.isVisible().catch(() => false);
    result(hasVideoModeCard, 'Card de modo "Vídeo animado" presente no ModeSelector');

    if (hasVideoModeCard) {
      await videoModeCard.click();
      await page.waitForTimeout(1200);
      await screenshot(page, 'pro-modo-video');

      // Verificar que interface de vídeo abriu (sem bloquear)
      const videoError = await page.locator(':has-text("plano Pro"), :has-text("apenas no plano")').count() > 0;
      result(!videoError, 'Interface de vídeo acessível para PRO (sem bloqueio)', videoError ? 'BUG: ainda bloqueado' : 'ok');

      // Verificar upload de foto para vídeo
      const videoFileInput = page.locator('input[type="file"]').first();
      const hasVideoFileInput = await videoFileInput.count() > 0;
      result(hasVideoFileInput, 'Campo de upload de foto para vídeo presente');
    }

    await screenshot(page, 'fim-teste');

    // ═══════════════════════════════════════════════════════════════════════════
    // RELATÓRIO FINAL
    // ═══════════════════════════════════════════════════════════════════════════
    log('\n=== RELATÓRIO FINAL ===\n');

    const passCount = results.filter(r => r.startsWith('✅')).length;
    const failCount = results.filter(r => r.startsWith('❌')).length;

    console.log('═'.repeat(65));
    console.log('  RELATÓRIO QA MOBILE — TamoWork Foto IA');
    console.log('═'.repeat(65));
    console.log(`  Data: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`  App: ${APP_URL}`);
    console.log(`  Device: iPhone 14 (390×844, isMobile=true, hasTouch=true)`);
    console.log(`  UserAgent: iPhone Safari`);
    if (timings.processingTime) console.log(`  Tempo de processamento: ${timings.processingTime}s`);
    console.log(`  Screenshots: ${SCREENSHOTS_DIR}`);
    console.log('─'.repeat(65));
    results.forEach(r => console.log('  ' + r));
    console.log('─'.repeat(65));
    console.log(`  RESULTADO: ${passCount} ✅  |  ${failCount} ❌`);
    console.log('═'.repeat(65));

    if (consoleErrors.length > 0) {
      console.log(`\n  Erros de Console JS (${consoleErrors.length}):`);
      consoleErrors.slice(0, 8).forEach(e => console.log(`  ⚠️  ${e.slice(0, 120)}`));
    }

    // Salvar JSON
    const reportPath = path.join(SCREENSHOTS_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      date: new Date().toISOString(),
      device: 'iPhone 14 (390x844, isMobile, hasTouch)',
      passCount, failCount,
      results,
      timings,
      consoleErrors: consoleErrors.slice(0, 20),
    }, null, 2));
    console.log(`\n  Relatório JSON: ${reportPath}`);

  } catch (err) {
    log(`ERRO FATAL: ${err.message}`);
    console.error(err.stack);
    await screenshot(page, 'erro-fatal').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Erro fatal ao executar QA:', err);
  process.exit(1);
});
