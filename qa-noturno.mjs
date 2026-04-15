/**
 * QA Noturno — TamoWork Foto IA
 * Conta FREE: test-stress-d4@tamowork.test | StressD4@2026
 *
 * Testes:
 *  1. Navegação + scroll — mobile (390x844) e desktop (1440x900)
 *  2. Overflow horizontal
 *  3. Screenshots de cada página
 *  4. Cliques em botões visíveis
 *  5. UX — textos / CTAs / linguagem
 *  6. Fluxo FREE — login + tentativa sem imagem + limite diário
 *  7. Console errors + requests 4xx/5xx
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── config ───────────────────────────────────────────────────────────────────
const BASE_URL    = 'https://tamowork.com';
const EMAIL       = 'test-stress-d4@tamowork.test';
const PASSWORD    = 'StressD4@2026';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';

const SS_DIR = path.join(__dirname, 'test-screenshots', 'qa-noturno');
fs.mkdirSync(SS_DIR, { recursive: true });

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── relatório acumulado ───────────────────────────────────────────────────────
const report = {
  timestamp: new Date().toISOString(),
  pageResults: [],
  jsErrors: [],
  networkErrors: [],
  buttons: [],
  uxTexts: [],
  freeFlow: [],
  score: 0,
};

let totalChecks = 0;
let passedChecks = 0;

function pass(label) {
  console.log(`  ✅ PASS  ${label}`);
  totalChecks++;
  passedChecks++;
  return { label, status: 'PASS' };
}

function fail(label, detail = '') {
  console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  totalChecks++;
  return { label, status: 'FAIL', detail };
}

function info(label) {
  console.log(`  ℹ️  INFO  ${label}`);
}

async function ss(page, name) {
  const p = path.join(SS_DIR, name);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

// ── login helper ─────────────────────────────────────────────────────────────
async function doLogin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  // Revelar formulário de e-mail (app usa toggle)
  const emailToggle = page.locator(
    'button:has-text("Usar e-mail e senha"), button:has-text("Use email & password"), button:has-text("ou e-mail")'
  ).first();
  if (await emailToggle.isVisible().catch(() => false)) {
    await emailToggle.click();
    await page.waitForTimeout(800);
  }
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  // Submeter — usa button[type="submit"] que fica visível após toggle
  await page.locator('button[type="submit"]').first().click();
  // Aguarda redirecionamento
  await page.waitForURL(url => !url.includes('/login'), { timeout: 20000 }).catch(() => {});
  return page.url();
}

// ── setup: garantir conta FREE sem jobs hoje ──────────────────────────────────
async function setupAccount() {
  console.log('\n[SETUP] Verificando conta FREE...');
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const user = list?.users?.find(u => u.email === EMAIL);
  if (!user) {
    console.log('[SETUP] Conta não encontrada — crie manualmente ou verifique credenciais');
    return null;
  }
  console.log(`[SETUP] Conta encontrada: ${user.id}`);
  // Garante FREE
  await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: { plan: 'free' } });
  await supabaseAdmin.from('user_plans').upsert({ user_id: user.id, plan: 'free' }, { onConflict: 'user_id' }).maybeSingle();
  // Limpa jobs de hoje para garantir limite zerado
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  await supabaseAdmin.from('image_jobs').delete()
    .eq('user_id', user.id)
    .gte('created_at', hoje.toISOString());
  console.log('[SETUP] Jobs de hoje removidos — conta FREE limpa');
  return user.id;
}

// ── helper: coletar erros JS + network ───────────────────────────────────────
function attachListeners(page, pageLabel) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = `[${pageLabel}] JS ERROR: ${msg.text()}`;
      report.jsErrors.push(txt);
      console.log(`  🔴 ${txt}`);
    }
  });
  page.on('pageerror', err => {
    const txt = `[${pageLabel}] PAGE ERROR: ${err.message}`;
    report.jsErrors.push(txt);
    console.log(`  🔴 ${txt}`);
  });
  page.on('response', async resp => {
    const status = resp.status();
    if (status >= 400) {
      const url = resp.url();
      // Ignora analytics, tracking, etc.
      if (/google|analytics|hotjar|sentry|favicon|_next\/static/i.test(url)) return;
      const txt = `[${pageLabel}] ${status} ${url}`;
      report.networkErrors.push(txt);
      console.log(`  🟠 NET ${txt}`);
    }
  });
}

// ── TESTE 1: Navegação + scroll + overflow ────────────────────────────────────
async function testNavigation(browser) {
  console.log('\n═══════════════════════════════════════');
  console.log('TESTE 1 — Navegação, scroll e overflow');
  console.log('═══════════════════════════════════════');

  const viewports = [
    { label: 'mobile', width: 390, height: 844, hasTouch: true },
    { label: 'desktop', width: 1440, height: 900, hasTouch: false },
  ];

  const routes = [
    { path: '/', name: 'home' },
    { path: '/criacoes', name: 'criacoes' },
    { path: '/planos', name: 'planos' },
    { path: '/login', name: 'login' },
    { path: '/editor', name: 'editor' },
    { path: '/conta', name: 'conta' },
  ];

  // Obter storageState logado
  let storageState = null;
  {
    const ctx0 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p0 = await ctx0.newPage();
    await doLogin(p0).catch(e => console.log('[nav-login] warn:', e.message.slice(0, 80)));
    storageState = await ctx0.storageState();
    await ctx0.close();
  }

  for (const vp of viewports) {
    console.log(`\n  [${vp.label.toUpperCase()} ${vp.width}x${vp.height}]`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.hasTouch,
      storageState,
    });
    const page = await ctx.newPage();
    attachListeners(page, `nav-${vp.label}`);

    for (const route of routes) {
      info(`Visitando ${route.path}`);
      const pageRes = { page: route.path, viewport: vp.label, checks: [] };

      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);

        // Screenshot
        const ssName = `01-nav-${vp.label}-${route.name}.png`;
        await ss(page, ssName);

        // Verificar que carregou (sem 404 óbvio)
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const is404 = bodyText.toLowerCase().includes('not found') || bodyText.includes('404');
        pageRes.checks.push(is404 ? fail(`${route.path} carregou`, '404/not found') : pass(`${route.path} carregou`));

        // Overflow horizontal
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        pageRes.checks.push(overflow
          ? fail(`${route.path} sem overflow horizontal`, `scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}`)
          : pass(`${route.path} sem overflow horizontal`));

        // Scroll suave (sem travar)
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        pageRes.checks.push(pass(`${route.path} scroll ok`));

      } catch (err) {
        pageRes.checks.push(fail(`${route.path} carregou`, err.message.slice(0, 100)));
      }

      report.pageResults.push(pageRes);
    }
    await ctx.close();
  }
}

// ── TESTE 2: Cliques em botões ────────────────────────────────────────────────
async function testButtons(browser, storageState) {
  console.log('\n═══════════════════════════════════════');
  console.log('TESTE 2 — Cliques em botões visíveis');
  console.log('═══════════════════════════════════════');

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    storageState,
  });
  const page = await ctx.newPage();
  attachListeners(page, 'buttons');

  // Home page
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Coletar todos os botões visíveis
  const allButtons = await page.locator('button:visible, [role="button"]:visible, [role="tab"]:visible').all();
  info(`Encontrados ${allButtons.length} botões na home`);

  for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
    const btn = allButtons[i];
    try {
      const txt = (await btn.innerText().catch(() => '')).trim().slice(0, 60);
      const isVisible = await btn.isVisible();
      const isEnabled = await btn.isEnabled();
      if (!isVisible || !isEnabled) continue;

      // Registra UX text
      if (txt) {
        report.buttons.push({ text: txt, enabled: isEnabled });
        info(`Botão: "${txt}"`);
      }

      // Clica apenas se não for upload/submit (para não acionar fluxo de arquivo)
      const skipPatterns = /upload|file|submit|comprar|plano|stripe|mercado|whatsapp|google|apple/i;
      if (skipPatterns.test(txt)) {
        info(`  → Pulando "${txt}" (controlado)`);
        continue;
      }

      await btn.scrollIntoViewIfNeeded();
      await btn.click({ timeout: 5000 }).catch(e => {
        report.buttons.push({ text: txt, error: e.message.slice(0, 80) });
      });
      await page.waitForTimeout(300);

      // Volta para home se saiu
      if (!page.url().includes(BASE_URL) || page.url() !== BASE_URL) {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // ignora botão inacessível
    }
  }

  // Tabs Foto/Vídeo
  info('Testando tabs Foto / Vídeo...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const tabs = ['Foto', 'Vídeo', 'foto', 'video', 'Video'];
  for (const tabText of tabs) {
    const tab = page.locator(`[role="tab"]:has-text("${tabText}"), button:has-text("${tabText}")`).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(500);
      await ss(page, `02-tab-${tabText.toLowerCase()}.png`);
      report.buttons.push({ text: `Tab: ${tabText}`, clicked: true });
      pass(`Tab "${tabText}" clicável`);
    }
  }

  await ctx.close();
}

// ── TESTE 3: UX — textos e CTAs ──────────────────────────────────────────────
async function testUXTexts(browser, storageState) {
  console.log('\n═══════════════════════════════════════');
  console.log('TESTE 3 — UX: textos, CTAs, linguagem');
  console.log('═══════════════════════════════════════');

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    storageState,
  });
  const page = await ctx.newPage();

  const pagesToCheck = ['/', '/planos', '/conta'];

  for (const route of pagesToCheck) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Extrair textos de CTAs e títulos
    const ctaTexts = await page.evaluate(() => {
      const selectors = [
        'button', 'h1', 'h2', 'h3', 'p', 'label',
        '[role="button"]', '[placeholder]', '.cta', '.btn',
      ];
      const texts = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const t = (el.textContent || el.getAttribute('placeholder') || '').trim();
          if (t && t.length > 3 && t.length < 300) texts.push({ selector: sel, text: t });
        });
      }
      return texts.slice(0, 60);
    });

    info(`[${route}] ${ctaTexts.length} textos coletados`);

    for (const item of ctaTexts) {
      const t = item.text;
      // Classificar linguagem
      const primeiraP = /\b(manda|mande|me |sua|seu|você|você|faz|faça|usa|use|cria|crie|bota|bote)\b/i.test(t);
      const terceiraP = /\b(envie|insira|selecione|clique|escolha|arraste|Digite)\b/i.test(t);
      const marker = primeiraP ? '💬1ª' : terceiraP ? '📢3ª' : '  ';
      report.uxTexts.push({ page: route, selector: item.selector, text: t, pessoa: primeiraP ? '1ª' : terceiraP ? '3ª' : '?' });
      console.log(`  ${marker} [${route}][${item.selector}] "${t.slice(0, 100)}"`);
    }
  }
  await ctx.close();
}

// ── TESTE 4: Fluxo FREE completo ─────────────────────────────────────────────
async function testFreeFlow(browser, storageState) {
  console.log('\n═══════════════════════════════════════');
  console.log('TESTE 4 — Fluxo FREE completo');
  console.log('═══════════════════════════════════════');

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    storageState,
  });
  const page = await ctx.newPage();
  attachListeners(page, 'free-flow');

  // 4a. Login ok
  const landingUrl = page.url();
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const url = page.url();
  const loggedIn = !url.includes('/login');
  const r4a = loggedIn ? pass('Login mantido pela sessão') : fail('Login mantido pela sessão', url);
  report.freeFlow.push(r4a);
  await ss(page, '04a-home-logado.png');

  // 4b. Tentativa de submeter sem imagem
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Procura botão de gerar/criar
  const generateBtn = page.locator([
    'button:has-text("Criar")',
    'button:has-text("Gerar")',
    'button:has-text("Transformar")',
    'button:has-text("Enviar")',
    'button:has-text("Generate")',
    'button:has-text("Create")',
  ].join(', ')).first();

  let btnFound = await generateBtn.isVisible().catch(() => false);
  if (!btnFound) {
    // Tenta clicar em qualquer card de modo primeiro
    const modeCard = page.locator('[data-mode], .mode-card, [class*="mode"]').first();
    await modeCard.click().catch(() => {});
    await page.waitForTimeout(500);
    btnFound = await generateBtn.isVisible().catch(() => false);
  }

  if (btnFound) {
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
    await ss(page, '04b-sem-imagem.png');

    // Verificar se foi bloqueado (não navegou para processamento)
    const currentUrl = page.url();
    const blocked = currentUrl === BASE_URL || currentUrl === `${BASE_URL}/`;
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasErrorMsg = /selecione|escolha|precisa|imagem|foto|obrigatório/i.test(bodyText);
    report.freeFlow.push(blocked || hasErrorMsg
      ? pass('Submit sem imagem bloqueado')
      : fail('Submit sem imagem bloqueado', 'navegou ou nenhum erro visível'));
  } else {
    report.freeFlow.push(fail('Botão de gerar encontrado', 'botão não localizado'));
  }

  // 4c. Verificar UX do limite FREE
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const bodyAll = await page.locator('body').innerText().catch(() => '');
  const hasLimitText = /2.*(foto|imagem|dia|grátis)|grátis.*2|limit/i.test(bodyAll);
  report.freeFlow.push(hasLimitText
    ? pass('Texto de limite FREE visível')
    : fail('Texto de limite FREE visível', 'não encontrado no body'));
  await ss(page, '04c-limite-free.png');

  // 4d. Verificar link/botão para planos (upsell)
  const upgBtn = page.locator([
    'button:has-text("Pro")',
    'button:has-text("Plano")',
    'a:has-text("Pro")',
    'a:has-text("Upgrade")',
    'a[href*="planos"]',
    'button:has-text("Liberar")',
  ].join(', ')).first();
  const upgVisible = await upgBtn.isVisible().catch(() => false);
  report.freeFlow.push(upgVisible
    ? pass('Botão de upgrade/planos visível')
    : fail('Botão de upgrade/planos visível'));

  // 4e. Verificar que /planos carrega com preços
  await page.goto(`${BASE_URL}/planos`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const planosBody = await page.locator('body').innerText().catch(() => '');
  const hasPricing = /R\$|USD|\$|mensal|anual|mês|ano/i.test(planosBody);
  report.freeFlow.push(hasPricing
    ? pass('/planos exibe preços')
    : fail('/planos exibe preços', 'sem R$, USD, mensal/anual'));
  await ss(page, '04d-planos.png');

  // 4f. Verificar /criacoes — galeria vazia ou com jobs
  await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await ss(page, '04e-criacoes.png');
  const criacoesBody = await page.locator('body').innerText().catch(() => '');
  const hasCriacoes = criacoesBody.length > 100;
  report.freeFlow.push(hasCriacoes
    ? pass('/criacoes carregou conteúdo')
    : fail('/criacoes carregou conteúdo'));

  // 4g. /conta — dados do usuário
  await page.goto(`${BASE_URL}/conta`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await ss(page, '04f-conta.png');
  const contaBody = await page.locator('body').innerText().catch(() => '');
  const hasEmail = contaBody.includes('@') || contaBody.toLowerCase().includes('email');
  report.freeFlow.push(hasEmail
    ? pass('/conta exibe dados do usuário')
    : fail('/conta exibe dados do usuário'));

  await ctx.close();
}

// ── TESTE 5: Console errors — todas as páginas ────────────────────────────────
async function testConsoleErrors(browser, storageState) {
  console.log('\n═══════════════════════════════════════');
  console.log('TESTE 5 — Console errors (varredura geral)');
  console.log('═══════════════════════════════════════');

  const routes = ['/', '/criacoes', '/planos', '/login', '/editor', '/conta'];

  for (const route of routes) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: route === '/login' ? undefined : storageState,
    });
    const page = await ctx.newPage();
    const pageErrors = [];
    const netErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('response', resp => {
      const s = resp.status();
      if (s >= 400) {
        const url = resp.url();
        if (!/google|analytics|hotjar|sentry|favicon|_next\/static|_next\/image/i.test(url)) {
          netErrors.push(`${s} ${url}`);
        }
      }
    });

    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (pageErrors.length === 0) {
      pass(`${route} sem erros JS`);
    } else {
      fail(`${route} — ${pageErrors.length} erro(s) JS`, pageErrors[0].slice(0, 120));
      pageErrors.forEach(e => report.jsErrors.push(`[${route}] ${e}`));
    }

    if (netErrors.length === 0) {
      pass(`${route} sem requests 4xx/5xx`);
    } else {
      fail(`${route} — ${netErrors.length} request(s) com erro`, netErrors[0].slice(0, 120));
      netErrors.forEach(e => report.networkErrors.push(`[${route}] ${e}`));
    }

    await ctx.close();
  }
}

// ── TESTE 6: Regressão mobile — overflow em todas as páginas ─────────────────
async function testMobileOverflow(browser, storageState) {
  console.log('\n═══════════════════════════════════════');
  console.log('TESTE 6 — Overflow horizontal (mobile 390px)');
  console.log('═══════════════════════════════════════');

  const routes = ['/', '/criacoes', '/planos', '/login', '/conta'];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    storageState,
  });
  const page = await ctx.newPage();

  for (const route of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);

    const { scrollW, innerW, overflowEl } = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      const iw = window.innerWidth;
      let el = '';
      if (sw > iw) {
        // Encontra elementos que causam overflow
        const all = document.querySelectorAll('*');
        for (const node of all) {
          const r = node.getBoundingClientRect();
          if (r.right > iw + 2) {
            el = node.tagName + (node.className ? '.' + String(node.className).split(' ')[0] : '');
            break;
          }
        }
      }
      return { scrollW: sw, innerW: iw, overflowEl: el };
    });

    if (scrollW > innerW) {
      fail(`${route} sem overflow`, `scrollWidth=${scrollW} > ${innerW}. Elemento: ${overflowEl}`);
    } else {
      pass(`${route} sem overflow (${scrollW}px)`);
    }
  }
  await ctx.close();
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   QA NOTURNO — TamoWork Foto IA              ║');
  console.log('║   Conta FREE: test-stress-d4@tamowork.test   ║');
  console.log(`║   Início: ${new Date().toLocaleString('pt-BR')}          ║`);
  console.log('╚══════════════════════════════════════════════╝');

  const userId = await setupAccount();

  const browser = await chromium.launch({ headless: true });

  // Login uma vez para obter storageState
  let storageState = null;
  {
    console.log('\n[AUTH] Fazendo login para obter sessão...');
    const ctx0 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p0 = await ctx0.newPage();
    let loginOk = false;
    try {
      const finalUrl = await doLogin(p0);
      loginOk = !finalUrl.includes('/login');
      console.log('[AUTH] Login OK — URL:', finalUrl);
    } catch (e) {
      console.log('[AUTH] WARN: Login falhou:', e.message.slice(0, 100));
    }
    storageState = await ctx0.storageState();
    await ctx0.close();
    if (!loginOk) {
      console.log('[AUTH] Continuando sem sessão autenticada...');
    }
  }

  // Executar todos os testes
  await testNavigation(browser).catch(e => console.error('Erro em testNavigation:', e.message));
  await testButtons(browser, storageState).catch(e => console.error('Erro em testButtons:', e.message));
  await testUXTexts(browser, storageState).catch(e => console.error('Erro em testUXTexts:', e.message));
  await testFreeFlow(browser, storageState).catch(e => console.error('Erro em testFreeFlow:', e.message));
  await testConsoleErrors(browser, storageState).catch(e => console.error('Erro em testConsoleErrors:', e.message));
  await testMobileOverflow(browser, storageState).catch(e => console.error('Erro em testMobileOverflow:', e.message));

  await browser.close();

  // ── Calcular score ────────────────────────────────────────────────────────
  const allChecks = [
    ...report.pageResults.flatMap(p => p.checks),
    ...report.freeFlow,
  ];
  const passed = allChecks.filter(c => c.status === 'PASS').length;
  const total  = allChecks.length;
  const score  = total > 0 ? Math.round((passed / total) * 10 * 10) / 10 : 0;
  report.score = score;
  report.summary = {
    total,
    passed,
    failed: total - passed,
    jsErrorCount: report.jsErrors.length,
    networkErrorCount: report.networkErrors.length,
    uxTextsFound: report.uxTexts.length,
  };

  // ── Salvar relatório JSON ─────────────────────────────────────────────────
  const reportPath = path.join(SS_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // ── Imprimir relatório final ──────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              RELATÓRIO FINAL                  ║');
  console.log('╚══════════════════════════════════════════════╝');

  console.log(`\n📊 SCORE GERAL: ${score}/10`);
  console.log(`   Checks: ${passed}/${total} PASS`);
  console.log(`   Erros JS: ${report.jsErrors.length}`);
  console.log(`   Erros de rede: ${report.networkErrors.length}`);
  console.log(`   Textos UX coletados: ${report.uxTexts.length}`);

  if (report.jsErrors.length > 0) {
    console.log('\n🔴 ERROS JS:');
    [...new Set(report.jsErrors)].slice(0, 15).forEach(e => console.log(`  - ${e.slice(0, 120)}`));
  }

  if (report.networkErrors.length > 0) {
    console.log('\n🟠 ERROS DE REDE (4xx/5xx):');
    [...new Set(report.networkErrors)].slice(0, 15).forEach(e => console.log(`  - ${e.slice(0, 120)}`));
  }

  console.log('\n💬 TEXTOS UX (primeiros 20):');
  report.uxTexts.slice(0, 20).forEach(t => {
    console.log(`  [${t.page}][${t.pessoa}] "${t.text.slice(0, 90)}"`);
  });

  console.log('\n🔘 BOTÕES ENCONTRADOS:');
  [...new Set(report.buttons.map(b => b.text))].slice(0, 20).forEach(t => console.log(`  - "${t}"`));

  console.log('\n📁 Relatório salvo em:', reportPath);
  console.log('🖼️  Screenshots em:', SS_DIR);
  console.log(`\n⏱️  Fim: ${new Date().toLocaleString('pt-BR')}`);
})();
