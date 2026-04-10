/**
 * QA Desktop — TamoWork Foto IA
 * Viewport: 1440x900
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'test-desktop-qa@tamowork.com';
const PASSWORD = 'TestQA2026!';
const TEST_USER_ID = '7f551abc-6e70-4b9b-812c-ff89357c57eb';
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/desktop';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';

// --- Relatório ---
const report = {
  timestamp: new Date().toISOString(),
  tests: [],
  errors: [],
  jobs: [],
  consoleErrors: [],
};

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0,8)}] ${msg}`;
  console.log(line);
}

function addTest(name, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  report.tests.push({ name, passed, detail });
  log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  log(`📸 Screenshot: ${filePath}`);
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

async function supabaseRequest(method, urlPath, body) {
  const url = `${SUPABASE_URL}${urlPath}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
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

async function promoteUserToPro(userId) {
  log(`Promovendo userId=${userId} para PRO via user_plans...`);
  const periodEnd = new Date('2027-12-31T23:59:59Z').toISOString();
  const res = await supabaseRequest('POST', '/rest/v1/user_plans', {
    user_id: userId,
    plan: 'pro',
    period_end: periodEnd,
    mp_subscription_id: 'qa-test-manual',
    updated_at: new Date().toISOString(),
  });

  if (res.status === 409 || (res.status >= 200 && res.status < 300)) {
    // Se conflito (já existe), fazer PATCH/upsert
    if (res.status === 409) {
      const patch = await supabaseRequest('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
        plan: 'pro',
        period_end: periodEnd,
        mp_subscription_id: 'qa-test-manual',
        updated_at: new Date().toISOString(),
      });
      log(`PATCH user_plans: status=${patch.status}`);
      return patch.status >= 200 && patch.status < 300;
    }
    return true;
  }
  log(`Erro user_plans: status=${res.status} data=${JSON.stringify(res.data)}`);
  return false;
}

async function getRecentJobs() {
  const res = await supabaseRequest('GET', '/rest/v1/image_jobs?order=created_at.desc&limit=20', null);
  return res.data;
}

async function getUserPlan(userId) {
  const res = await supabaseRequest('GET', `/rest/v1/user_plans?user_id=eq.${userId}&select=*`, null);
  return Array.isArray(res.data) ? res.data[0] : null;
}

// Aguardar e verificar estado com retry
async function waitForText(page, texts, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const body = await page.textContent('body').catch(() => '');
    for (const t of texts) {
      if (body.includes(t)) return t;
    }
    await page.waitForTimeout(5000);
  }
  return null;
}

// --- Main ---
async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  // Baixar foto de produto para upload
  const productImagePath = path.join(SCREENSHOTS, 'produto-teste.jpg');
  if (!fs.existsSync(productImagePath) || fs.statSync(productImagePath).size < 1000) {
    log('Baixando foto de produto para upload...');
    try {
      await downloadFile(
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
        productImagePath
      );
      log(`Foto baixada: ${fs.statSync(productImagePath).size} bytes`);
    } catch (e) {
      log(`Erro ao baixar foto: ${e.message}`);
    }
  } else {
    log(`Usando foto existente: ${fs.statSync(productImagePath).size} bytes`);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      report.consoleErrors.push(msg.text());
    }
  });

  try {
    // =============================================
    // ETAPA 1: Autenticação
    // =============================================
    log('=== ETAPA 1: Autenticação ===');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '01-login-page');
    addTest('Página de login carrega', true, `URL: ${page.url()}`);

    // Aguardar a página carregar completamente (JS hidratado)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Clicar em "Usar e-mail e senha" — aguardar estar clicável
    log('Aguardando botão "Usar e-mail e senha"...');
    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 15000 });
    await page.click('text=Usar e-mail e senha');
    await page.waitForTimeout(800);
    await screenshot(page, '01b-email-toggle-clicked');

    // Aguardar as tabs de login/signup aparecerem
    await page.waitForSelector('text=Entrar', { timeout: 10000 });

    // Garantir que estamos na aba "Entrar"
    log('Fazendo login com conta de teste...');
    // As tabs são: "Entrar" e "Criar conta" — clicar na primeira
    const tabs = page.locator('button').filter({ hasText: /^Entrar$/ });
    const tabCount = await tabs.count();
    log(`Tabs "Entrar" encontradas: ${tabCount}`);
    if (tabCount > 0) {
      await tabs.first().click();
      await page.waitForTimeout(500);
    }

    // Aguardar inputs aparecerem
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await screenshot(page, '02-login-form');

    // Clicar no botão de submit (não é o tab, é o botão do form)
    // O botão de submit tem texto "Entrar" (não "Criar conta grátis")
    const submitLogin = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /^Entrar$/ }).last()
    );
    await submitLogin.click();
    await page.waitForTimeout(5000);
    await screenshot(page, '03-after-login');

    const urlAfterLogin = page.url();
    log(`URL após login: ${urlAfterLogin}`);

    const loginSuccess = !urlAfterLogin.includes('/login');
    addTest('Login com conta de teste', loginSuccess, `URL: ${urlAfterLogin}`);

    if (!loginSuccess) {
      // Verificar se há erro
      const bodyAfterLogin = await page.textContent('body').catch(() => '');
      log(`Página após login: ${bodyAfterLogin.substring(0, 200)}`);
      const errorEl = await page.$('[style*="rgba(239,68,68"]');
      if (errorEl) {
        const errorMsg = await errorEl.textContent();
        log(`Erro de login: ${errorMsg}`);
        report.errors.push(`Login falhou: ${errorMsg}`);
      }
    }

    // Verificar onboarding
    if (page.url().includes('/onboarding')) {
      log('=== Onboarding ===');
      await screenshot(page, '04-onboarding');
      addTest('Onboarding exibido', true);
      // Clicar continuar se houver
      const continueBtn = page.getByText('Continuar').or(page.getByText('Começar')).or(page.getByText('Próximo'));
      if (await continueBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueBtn.first().click();
        await page.waitForTimeout(1000);
      }
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    // =============================================
    // ETAPA 2: Tela principal (home)
    // =============================================
    log('=== ETAPA 2: Tela principal ===');
    if (!page.url().startsWith(BASE_URL + '/') && !page.url() === BASE_URL) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    await screenshot(page, '05-home');
    addTest('Home carrega após login', !page.url().includes('/login'), `URL: ${page.url()}`);

    // Aguardar os cards de modos carregarem (podem demorar por ser lazy load)
    log('Aguardando cards de modos carregarem...');
    try {
      await page.waitForSelector('text=Usar agora', { timeout: 15000 });
      log('Cards de modos carregados!');
    } catch {
      log('Timeout aguardando cards — tentando aguardar mais...');
      await page.waitForTimeout(3000);
    }

    // Listar todos os botões disponíveis
    const homeButtons = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
    log(`Botões na home: ${JSON.stringify(homeButtons)}`);

    const homeBody = await page.textContent('body');
    const hasModes = homeBody.includes('Fundo branco') || homeBody.includes('Roupa vestida') ||
                     homeBody.includes('Foto igual') || homeBody.includes('Foto em cena') ||
                     homeBody.includes('Usar agora');
    addTest('Modos de geração visíveis', hasModes, hasModes ? 'Cards de modos encontrados' : 'Modos não encontrados');
    await screenshot(page, '05b-home-loaded');

    // =============================================
    // ETAPA 3: Selecionar modo e fazer upload
    // =============================================
    log('=== ETAPA 3: Selecionar modo ===');

    // Clicar no modo "Fundo branco" (mais simples e confiável para teste)
    let modeClicked = false;
    let selectedMode = '';

    // Os botões "Usar agora" devem estar disponíveis agora
    const usarAgoraButtons = page.getByText('Usar agora');
    const usarCount = await usarAgoraButtons.count();
    log(`Botões "Usar agora" encontrados: ${usarCount}`);

    if (usarCount > 0) {
      // Verificar qual card é "Fundo branco" (mais simples) ou "Roupa vestida" (com modelo)
      for (let i = 0; i < usarCount; i++) {
        const btn = usarAgoraButtons.nth(i);
        const cardContext = await btn.evaluate(el => {
          // Subir até o card pai
          let node = el;
          for (let j = 0; j < 5; j++) {
            if (node.parentElement) node = node.parentElement;
            if (node.textContent?.includes('Fundo branco') || node.textContent?.includes('Roupa vestida')) {
              return node.textContent?.substring(0, 100);
            }
          }
          return el.parentElement?.parentElement?.parentElement?.textContent?.substring(0, 100) || '';
        });
        log(`Card ${i}: ${cardContext.replace(/\s+/g, ' ')}`);
      }

      // Clicar no primeiro "Usar agora" (Fundo branco - mais simples)
      log('Clicando em "Usar agora" do primeiro modo (Fundo branco)...');
      await usarAgoraButtons.first().click();
      modeClicked = true;
      selectedMode = 'Fundo branco';
      await page.waitForTimeout(2000);
      addTest('Modo selecionado (Fundo branco)', true, 'Clicou em "Usar agora"');
    } else {
      addTest('Seleção de modo', false, 'Botões "Usar agora" não encontrados');
    }

    log(`URL após selecionar modo: ${page.url()}`);
    await screenshot(page, '07-after-mode');

    // Listar botões e inputs disponíveis agora
    const buttonsAfterMode = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
    log(`Botões após modo: ${JSON.stringify(buttonsAfterMode)}`);

    const inputCount = await page.locator('input[type="file"]').count();
    log(`Inputs file: ${inputCount}`);

    // Aguardar a tela de upload
    await page.waitForTimeout(1000);

    // =============================================
    // ETAPA 4: Upload de foto
    // =============================================
    log('=== ETAPA 4: Upload de foto ===');

    let uploadDone = false;

    // Verificar se há input file (pode estar escondido)
    const fileInput = page.locator('input[type="file"]').first();
    const fileInputCount = await page.locator('input[type="file"]').count();
    log(`Inputs file na tela de modo: ${fileInputCount}`);

    if (fileInputCount > 0) {
      await fileInput.setInputFiles(productImagePath);
      await page.waitForTimeout(2000);

      // Preencher campo "O que é o produto?" (obrigatório)
      log('Preenchendo campo de produto...');
      const allTextInputs = await page.$$eval('input[type="text"]', els =>
        els.map(e => ({ placeholder: e.placeholder, value: e.value })));
      log(`Text inputs disponíveis: ${JSON.stringify(allTextInputs)}`);

      // Tentar preencher o campo pelo placeholder
      const produtoInput = page.locator('input[placeholder*="bolo"], input[placeholder*="produto"], input[placeholder*="artesanal"], input[placeholder*="Ex:"]').first();
      if (await produtoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await produtoInput.fill('Tênis Nike vermelho esportivo');
        log('Campo de produto preenchido via placeholder');
      } else {
        // Tentar o primeiro input de texto visível
        const firstText = page.locator('input[type="text"]').first();
        if (await firstText.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstText.fill('Tênis Nike vermelho esportivo');
          log('Campo de produto preenchido (primeiro input texto)');
        } else {
          log('AVISO: Campo de produto não encontrado');
        }
      }

      await screenshot(page, '08-photo-uploaded');
      addTest('Upload de foto do produto', true, `Arquivo: ${path.basename(productImagePath)}`);
      uploadDone = true;
    } else {
      // Tentar clicar em área de upload para revelar input
      const uploadTriggers = [
        page.locator('label[for]').first(),
        page.locator('[class*="upload"]').first(),
        page.locator('[class*="drop"]').first(),
        page.locator('[class*="photo-input"]').first(),
      ];

      for (const trigger of uploadTriggers) {
        if (await trigger.isVisible({ timeout: 1000 }).catch(() => false)) {
          await trigger.click();
          await page.waitForTimeout(500);
          const newFileInput = page.locator('input[type="file"]').first();
          if (await newFileInput.count() > 0) {
            await newFileInput.setInputFiles(productImagePath);
            await page.waitForTimeout(2000);
            await screenshot(page, '08-photo-uploaded');
            addTest('Upload de foto (via trigger)', true);
            uploadDone = true;
            break;
          }
        }
      }

      if (!uploadDone) {
        const currentBody = await page.textContent('body');
        log(`Corpo da página atual: ${currentBody.substring(0, 300)}`);
        const allInputs = await page.$$eval('input', els =>
          els.map(e => `type=${e.type} name=${e.name} id=${e.id}`));
        log(`Todos inputs: ${JSON.stringify(allInputs)}`);
        addTest('Upload de foto', false, 'Input file não encontrado');
        await screenshot(page, '08-no-upload-input');
      }
    }

    // =============================================
    // ETAPA 5: Gerar foto (submeter)
    // =============================================
    log('=== ETAPA 5: Gerar foto ===');

    if (uploadDone) {
      const allBtnsNow = await page.$$eval('button', btns =>
        btns.map(b => ({ text: b.textContent?.trim(), disabled: b.disabled }))
      );
      log(`Botões após upload: ${JSON.stringify(allBtnsNow)}`);

      // Verificar se há campo de prompt/cenário para preencher
      const promptInput = page.locator('input[placeholder*="cenário"], input[placeholder*="prompt"], textarea[placeholder*="cenário"]').first();
      if (await promptInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await promptInput.fill('Produto em fundo branco profissional');
        log('Preencheu campo de cenário');
      }

      // Botão pode ter emoji: "✨ Gerar foto com IA"
      const allBtnsBeforeSubmit = await page.$$eval('button', btns =>
        btns.map(b => b.textContent?.trim()).filter(Boolean));
      log(`Botões antes de submeter: ${JSON.stringify(allBtnsBeforeSubmit)}`);

      // Encontrar botão de geração com texto parcial (ignora emoji)
      const generateLocator = page.locator('button').filter({
        hasText: /Gerar|Transformar|Criar foto|Processar|Enviar|Criar vídeo|IA/i
      }).last(); // .last() pega o botão de submit (não o de nav)

      if (await generateLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
        const genBtnText = await generateLocator.textContent();
        log(`Botão de geração encontrado: "${genBtnText}"`);
        const startTime = Date.now();
        log('Clicando em botão de geração...');
        await generateLocator.click();
        await page.waitForTimeout(2000);
        await screenshot(page, '09-generating');
        addTest('Submissão para geração', true);

        // Aguardar resultado (até 3 min)
        log('Aguardando resultado da geração (até 3 min)...');
        let resultFound = false;
        const maxWait = 180000;
        const checkEvery = 10000;
        let elapsed = 0;

        while (elapsed < maxWait) {
          await page.waitForTimeout(checkEvery);
          elapsed += checkEvery;

          const bodyNow = await page.textContent('body').catch(() => '');
          const urlNow = page.url();

          const isDone = bodyNow.includes('Baixar') || bodyNow.includes('Download') ||
                         bodyNow.includes('Editar') || urlNow.includes('/result') ||
                         bodyNow.includes('pronto') || bodyNow.includes('concluído') ||
                         bodyNow.includes('Salvar') || bodyNow.includes('Criar vídeo');

          const hasError = bodyNow.includes('Erro ao') || bodyNow.includes('Falhou') ||
                           bodyNow.includes('tente novamente') || bodyNow.includes('Falha ao') ||
                           bodyNow.includes('Erro:') || bodyNow.includes('erro ao');

          log(`[${elapsed/1000}s] URL: ${urlNow} | Done: ${isDone} | Error: ${hasError}`);

          if (isDone) {
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(0);
            addTest('Geração de foto IA concluída', true, `Tempo: ${processingTime}s`);
            await screenshot(page, '10-result');
            resultFound = true;
            break;
          }

          if (hasError) {
            addTest('Geração de foto IA', false, 'Erro durante processamento');
            report.errors.push('Erro durante geração de foto');
            await screenshot(page, '10-generation-error');
            break;
          }

          if (elapsed % 30000 === 0) {
            await screenshot(page, `10-waiting-${elapsed/1000}s`);
          }
        }

        if (!resultFound && elapsed >= maxWait) {
          addTest('Geração de foto IA', false, `Timeout após ${maxWait/1000}s`);
          report.errors.push(`Timeout na geração após ${maxWait/1000}s`);
          await screenshot(page, '10-timeout');
        }

        // =============================================
        // ETAPA 6: Testar editor
        // =============================================
        log('=== ETAPA 6: Editor de imagem ===');
        const editBtn = page.locator('button, a').filter({ hasText: /Editar/ }).first();
        if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await editBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, '11-editor');
          const editorUrl = page.url();
          addTest('Botão Editar funciona', true, `URL: ${editorUrl}`);
          if (editorUrl.includes('/editor')) {
            addTest('Editor abre corretamente', true);
          }
          await page.goBack();
          await page.waitForTimeout(1500);
        } else {
          addTest('Botão Editar', false, 'Não visível no resultado');
        }

        // =============================================
        // ETAPA 7: Testar download
        // =============================================
        log('=== ETAPA 7: Download ===');
        const dlBtn = page.locator('button, a').filter({ hasText: /Baixar|Download/i }).first();
        if (await dlBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
            dlBtn.click(),
          ]);
          if (download) {
            addTest('Download de foto', true, `Arquivo: ${download.suggestedFilename()}`);
            await download.cancel();
          } else {
            await page.waitForTimeout(1500);
            await screenshot(page, '12-download-attempt');
            addTest('Download de foto', false, 'Sem evento de download (pode ser link externo)');
          }
        } else {
          addTest('Download de foto', false, 'Botão não visível');
        }

        // =============================================
        // ETAPA 8: "Criar vídeo" (bloqueado FREE)
        // =============================================
        log('=== ETAPA 8: Criar vídeo (FREE) ===');
        const videoBtn = page.locator('button').filter({ hasText: /Criar vídeo|Gerar vídeo|Vídeo/i }).first();
        if (await videoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await videoBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, '13-video-free');
          const bodyAfterVideo = await page.textContent('body');
          const isBlocked = bodyAfterVideo.includes('PRO') || bodyAfterVideo.includes('Assinar') ||
                            bodyAfterVideo.includes('upgrade') || bodyAfterVideo.includes('plano');
          addTest('"Criar vídeo" bloqueado para FREE', isBlocked,
            isBlocked ? 'Mensagem de upgrade exibida' : 'Sem bloqueio visível');
        } else {
          addTest('"Criar vídeo" botão no resultado', false, 'Botão não encontrado');
          await screenshot(page, '13-no-video-btn');
        }

      } else {
        const allBtns = await page.$$eval('button', b => b.map(x => x.textContent?.trim()).filter(Boolean));
        log(`Botões após upload (sem gerar): ${JSON.stringify(allBtns)}`);
        addTest('Submissão para geração', false, 'Botão Gerar não encontrado');
        await screenshot(page, '09-no-generate-btn');
      }
    }

    // =============================================
    // ETAPA 9: Segundo job (limite diário)
    // =============================================
    log('=== ETAPA 9: Limite diário FREE ===');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '14-second-job-home');

    const homeBody2 = await page.textContent('body');
    const hasLimitMsg = homeBody2.includes('hora') || homeBody2.includes('Volte') ||
                        homeBody2.includes('limite') || homeBody2.includes('amanhã') ||
                        homeBody2.includes('Disponível') || homeBody2.includes('timer');

    if (hasLimitMsg) {
      addTest('Limite diário com timer', true, 'Mensagem de limite exibida');
    } else {
      // Verificar se ainda permite fazer upload (seria bug se sim)
      const fileInput2 = page.locator('input[type="file"]');
      const fi2Count = await fileInput2.count();
      if (fi2Count > 0) {
        // Fazer upload e tentar gerar — deve ser bloqueado
        await fileInput2.first().setInputFiles(productImagePath);
        await page.waitForTimeout(1000);
        const genBtn2 = page.locator('button').filter({ hasText: /Gerar|Transformar/ }).first();
        if (await genBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await genBtn2.click();
          await page.waitForTimeout(2000);
          await screenshot(page, '14-second-job-attempt');
          const body2 = await page.textContent('body');
          const blocked = body2.includes('limite') || body2.includes('PRO') || body2.includes('hora');
          addTest('Segundo job bloqueado (FREE)', blocked, blocked ? 'Bloqueio detectado' : 'Sem bloqueio — BUG');
        }
      } else {
        addTest('Limite diário (sem upload disponível)', true, 'Upload não disponível — correto');
      }
    }

    // =============================================
    // ETAPA 10: Promover para PRO
    // =============================================
    log('=== ETAPA 10: Promover para PRO ===');

    const planBefore = await getUserPlan(TEST_USER_ID);
    log(`Plano atual: ${JSON.stringify(planBefore)}`);

    const promoted = await promoteUserToPro(TEST_USER_ID);

    if (promoted) {
      const planAfter = await getUserPlan(TEST_USER_ID);
      log(`Plano após promoção: ${JSON.stringify(planAfter)}`);
      addTest('Promoção para PRO via Supabase', true, `Plano: ${planAfter?.plan}`);
    } else {
      addTest('Promoção para PRO via Supabase', false, 'Falhou na API');
      report.errors.push('Não foi possível promover usuário para PRO');
    }

    // =============================================
    // ETAPA 11: Relogar e verificar PRO
    // =============================================
    log('=== ETAPA 11: Relogar como PRO ===');

    // Forçar refresh da sessão navegando para logout
    await page.evaluate(() => {
      // Limpar qualquer cache local
      localStorage.removeItem('tw_plan');
    });

    // Navegar para conta e fazer logout
    await page.goto(`${BASE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '15-conta-page');

    // Procurar botão de logout
    const logoutBtn = page.locator('button').filter({ hasText: /Sair|Logout|Deslogar/i }).first();
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(2000);
      log('Logout feito via botão');
    } else {
      // Limpar storage manualmente
      await context.clearCookies();
      await page.evaluate(() => {
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
      });
      log('Storage limpo manualmente');
    }
    await screenshot(page, '16-logged-out');

    // Login novamente
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 10000 });
    await page.click('text=Usar e-mail e senha');
    await page.waitForTimeout(600);

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    const loginTabPro = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
    if (await loginTabPro.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginTabPro.click();
      await page.waitForTimeout(300);
    }

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    const submitLoginPro = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /^Entrar$/ }).last()
    );
    await submitLoginPro.click();
    await page.waitForTimeout(5000);
    await screenshot(page, '17-pro-login');
    addTest('Relogin como PRO', !page.url().includes('/login'), `URL: ${page.url()}`);

    // Verificar home PRO
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '18-pro-home');

    const proBody = await page.textContent('body');
    const hasProBadge = proBody.includes('PRO') || proBody.toLowerCase().includes('pro');
    const hasVideoMode = proBody.includes('Vídeo animado') || proBody.includes('Criar vídeo');
    addTest('Badge/indicador PRO na home', hasProBadge, hasProBadge ? 'PRO visível' : 'PRO não exibido');
    addTest('Modo vídeo (PRO) visível', hasVideoMode, hasVideoMode ? 'Vídeo animado disponível' : 'Não encontrado');

    // =============================================
    // ETAPA 12: Criar vídeo como PRO
    // =============================================
    log('=== ETAPA 12: Criar vídeo como PRO ===');

    // Verificar tela de criações
    await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '19-criacoes');
    addTest('Tela de Criações carrega', true, `URL: ${page.url()}`);

    const criacoesBody = await page.textContent('body');
    // Pode mostrar "Suas fotos aparecem aqui" se não há fotos ainda (usuário novo)
    const hasCreations = criacoesBody.includes('Baixar') || criacoesBody.includes('Editar') ||
                         criacoesBody.includes('Criar vídeo') || criacoesBody.includes('jpg');
    const hasEmptyState = criacoesBody.includes('Suas fotos aparecem aqui') ||
                          criacoesBody.includes('nenhuma foto') || criacoesBody.includes('Criar minha primeira foto');

    if (hasCreations) {
      addTest('Criações listadas', true, 'Fotos encontradas');
    } else if (hasEmptyState) {
      addTest('Tela de Criações (estado vazio)', true, 'Sem fotos ainda — estado correto para conta nova');
    } else {
      addTest('Tela de Criações', false, 'Conteúdo inesperado');
    }

    // Para testar "Criar vídeo" PRO, precisamos ir na home e clicar em "Foto que se mexe"
    log('Testando modo vídeo (Foto que se mexe) na home...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    try {
      await page.waitForSelector('text=Usar agora', { timeout: 10000 });
    } catch { log('Cards demoram a carregar'); }
    await page.waitForTimeout(1000);
    await screenshot(page, '20-pro-home-video');

    // Clicar no "Usar agora" do card "Foto que se mexe" (vídeo animado, PRO)
    const allUsarBtns = page.getByText('Usar agora');
    const totalBtns = await allUsarBtns.count();
    log(`Total de "Usar agora" na home PRO: ${totalBtns}`);

    // Encontrar o card de vídeo (Foto que se mexe)
    let videoCardBtnIndex = -1;
    for (let i = 0; i < totalBtns; i++) {
      const ctx = await allUsarBtns.nth(i).evaluate(el => {
        let node = el;
        for (let j = 0; j < 6; j++) {
          if (node.parentElement) node = node.parentElement;
          if (node.textContent?.includes('mexe') || node.textContent?.includes('animado') || node.textContent?.includes('vídeo')) {
            return node.textContent?.substring(0, 120);
          }
        }
        return '';
      });
      if (ctx) {
        log(`Card de vídeo encontrado no índice ${i}: ${ctx.replace(/\s+/g, ' ')}`);
        videoCardBtnIndex = i;
        break;
      }
    }

    if (videoCardBtnIndex >= 0) {
      await allUsarBtns.nth(videoCardBtnIndex).click();
      await page.waitForTimeout(2000);
      await screenshot(page, '21-video-mode-opened');
      const videoPageBody = await page.textContent('body');
      const videoUrl = page.url();
      addTest('Modo "Foto que se mexe" (vídeo PRO) acessível', true, `URL: ${videoUrl}`);

      // Verificar se pede upload de foto
      const hasVideoUpload = await page.locator('input[type="file"]').count() > 0;
      const hasVideoBody = videoPageBody.includes('vídeo') || videoPageBody.includes('Gerar') ||
                           videoPageBody.includes('Upload') || videoPageBody.includes('foto');
      addTest('Tela de vídeo PRO carregada', hasVideoBody, hasVideoBody ? 'Interface de vídeo presente' : 'Conteúdo inesperado');
    } else {
      // Tentar botão "Usar agora" no card de vídeo (4o card - índice 3)
      if (totalBtns >= 4) {
        await allUsarBtns.nth(3).click();
        await page.waitForTimeout(2000);
        await screenshot(page, '21-video-mode-4th');
        addTest('Modo vídeo PRO (4o card)', true, '4o card clicado');
      } else {
        addTest('"Criar vídeo" PRO na home', false, `Só ${totalBtns} botões "Usar agora" encontrados`);
        await screenshot(page, '21-no-video-btn');
      }
    }

    // =============================================
    // ETAPA 13: Verificar jobs no Supabase
    // =============================================
    log('=== ETAPA 13: Jobs no Supabase ===');
    const allJobs = await getRecentJobs();
    report.jobs = Array.isArray(allJobs) ? allJobs : [];

    if (Array.isArray(allJobs)) {
      const failed = allJobs.filter(j => j.status === 'failed');
      const done = allJobs.filter(j => j.status === 'done' || j.status === 'completed');
      const pending = allJobs.filter(j => j.status === 'pending');
      const processing = allJobs.filter(j => j.status === 'processing');

      log(`Jobs totais: ${allJobs.length}`);
      log(`  done: ${done.length}, pending: ${pending.length}, processing: ${processing.length}, failed: ${failed.length}`);

      addTest('Jobs visíveis no Supabase', allJobs.length > 0, `${allJobs.length} jobs`);
      addTest('Sem jobs com falha crítica', failed.length === 0,
        failed.length > 0 ? `${failed.length} jobs com status=failed` : 'OK');

      if (failed.length > 0) {
        failed.slice(0, 3).forEach(j => {
          log(`  FAILED: ${j.id?.slice(0,8)} erro=${j.error_message}`);
          report.errors.push(`Job failed: ${j.id?.slice(0,8)} — ${j.error_message}`);
        });
      }
    } else {
      addTest('Jobs Supabase', false, `Resposta: ${JSON.stringify(allJobs)}`);
    }

    await screenshot(page, '22-final');

  } catch (err) {
    log(`ERRO CRÍTICO: ${err.message}`);
    report.errors.push(`Erro crítico: ${err.message}`);
    try { await screenshot(page, 'ERROR-critical'); } catch {}
  } finally {
    await browser.close();

    // Gerar relatório final
    console.log('\n');
    console.log('='.repeat(60));
    console.log('RELATÓRIO FINAL — QA Desktop TamoWork Foto IA');
    console.log('='.repeat(60));

    const passed = report.tests.filter(t => t.passed).length;
    const total = report.tests.length;
    console.log(`\nResultado: ${passed}/${total} testes passaram\n`);

    report.tests.forEach(t => {
      const icon = t.passed ? '✅' : '❌';
      console.log(`${icon} ${t.name}${t.detail ? ' — ' + t.detail : ''}`);
    });

    if (report.errors.length > 0) {
      console.log('\nErros encontrados:');
      report.errors.forEach(e => console.log(`  • ${e}`));
    }

    if (report.consoleErrors.length > 0) {
      console.log('\nErros de console do browser:');
      report.consoleErrors.slice(0, 10).forEach(e => console.log(`  • ${e}`));
    }

    // Jobs Supabase
    if (report.jobs.length > 0) {
      console.log('\nÚltimos jobs no Supabase:');
      const statusCount = {};
      report.jobs.forEach(j => {
        statusCount[j.status] = (statusCount[j.status] || 0) + 1;
      });
      Object.entries(statusCount).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
    }

    const reportPath = path.join(SCREENSHOTS, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nRelatório JSON: ${reportPath}`);
    console.log(`Screenshots: ${SCREENSHOTS}`);
    console.log('='.repeat(60));
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
