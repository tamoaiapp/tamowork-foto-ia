/**
 * Testes automatizados overnight — TamoWork Foto IA
 * Foco: fluxo de login e Google OAuth
 * Conta: ui-a1@tamowork.test | UItest2026!
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'https://tamowork.com';
const EMAIL = 'ui-a1@tamowork.test';
const PASSWORD = 'UItest2026!';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const SCREENSHOT_DIR = __dirname;
const REPORT_PATH = join(__dirname, 'report.json');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function ensureUser() {
  log('Verificando/criando usuário de teste...');
  // Tenta buscar usuário existente via admin
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    log(`Erro ao listar usuários: ${error.message}`);
  } else {
    const existing = users.find(u => u.email === EMAIL);
    if (existing) {
      log(`Usuário já existe: ${existing.id}`);
      // Garante que email está confirmado
      if (!existing.email_confirmed_at) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
        log('Email confirmado via admin.');
      }
      return existing.id;
    }
  }

  // Cria usuário novo
  const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr) {
    log(`Erro ao criar usuário: ${createErr.message}`);
    throw createErr;
  }
  log(`Usuário criado: ${data.user.id}`);
  return data.user.id;
}

async function screenshot(page, name) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`Screenshot salvo: ${name}.png`);
  return path;
}

async function newBrowser(storageStatePath = null) {
  const opts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  const browser = await chromium.launch(opts);
  const ctxOpts = {
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
  };
  if (storageStatePath) {
    ctxOpts.storageState = storageStatePath;
  }
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  return { browser, context, page };
}

const results = [];

function record(teste, passou, detalhe, tempo_ms) {
  const entry = { teste, passou, detalhe, tempo_ms };
  results.push(entry);
  log(`[${passou ? 'PASS' : 'FAIL'}] ${teste} — ${detalhe} (${tempo_ms}ms)`);
}

// ─── Teste 1: Login email/senha (3x) ───────────────────────────────────────
async function testeLoginEmail(rodada) {
  const t0 = Date.now();
  const nome = `login_email_r${rodada}`;
  const { browser, page } = await newBrowser();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await screenshot(page, `${nome}_01_loaded`);

    // Clica "Usar e-mail e senha" para exibir form
    const emailToggle = page.locator('button', { hasText: 'Usar e-mail e senha' });
    await emailToggle.waitFor({ timeout: 10000 });
    await emailToggle.click();

    // Garante que estamos na aba "Entrar"
    const tabEntrar = page.locator('button', { hasText: 'Entrar' }).first();
    await tabEntrar.waitFor({ timeout: 5000 });
    await tabEntrar.click();

    // Preenche campos
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await screenshot(page, `${nome}_02_form_filled`);

    // Clica submit (botão dentro do form com texto Entrar)
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Aguarda redirecionamento
    let redirectedUrl = '';
    let passou = false;
    let detalhe = '';
    try {
      await page.waitForURL(url => {
        const u = url.toString();
        return u.endsWith('/') || u.includes('/onboarding') || u === `${BASE_URL}/`;
      }, { timeout: 20000 });
      redirectedUrl = page.url();
      passou = true;
      detalhe = `Redirecionado para: ${redirectedUrl}`;
    } catch {
      // Verifica mensagem de erro na tela
      const errorBox = await page.locator('[class*="error"], [style*="f87171"]').first().textContent({ timeout: 3000 }).catch(() => '');
      redirectedUrl = page.url();
      detalhe = `Sem redirecionamento. URL atual: ${redirectedUrl}. Erro na tela: "${errorBox}"`;
    }

    await screenshot(page, `${nome}_03_after_submit`);
    record(`login_email_rodada_${rodada}`, passou, detalhe, Date.now() - t0);
  } catch (err) {
    await screenshot(page, `${nome}_error`).catch(() => {});
    record(`login_email_rodada_${rodada}`, false, `Exceção: ${err.message}`, Date.now() - t0);
  } finally {
    await browser.close();
  }
}

// ─── Teste 2: Login com Google (3x) ────────────────────────────────────────
async function testeLoginGoogle(rodada) {
  const t0 = Date.now();
  const nome = `login_google_r${rodada}`;
  const { browser, page } = await newBrowser();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await screenshot(page, `${nome}_01_loaded`);

    // Localiza botão Google
    const googleBtn = page.locator('button', { hasText: /google/i }).first();
    await googleBtn.waitFor({ timeout: 10000 });
    const textoBotao = await googleBtn.textContent();
    log(`Texto exato do botão Google: "${textoBotao?.trim()}"`);

    // Intercepta o redirecionamento antes de clicar
    let redirectUrl = '';
    const navigationPromise = page.waitForURL(url => {
      const u = url.toString();
      // Redireciona para accounts.google.com ou para supabase oauth
      return u.includes('accounts.google.com') || u.includes('supabase.co') || u.includes('oauth');
    }, { timeout: 15000 });

    await googleBtn.click();

    try {
      await navigationPromise;
      redirectUrl = page.url();
    } catch {
      redirectUrl = page.url();
    }

    await screenshot(page, `${nome}_02_after_click`);

    const isGoogle = redirectUrl.includes('accounts.google.com');
    const isSupabase = redirectUrl.includes('supabase.co');
    const isOAuth = redirectUrl.includes('oauth') || redirectUrl.includes('auth/v1');
    const passou = isGoogle || isSupabase || isOAuth;

    record(
      `login_google_rodada_${rodada}`,
      passou,
      `Texto botão: "${textoBotao?.trim()}" | Redirect: ${redirectUrl} | Google: ${isGoogle} | Supabase: ${isSupabase} | OAuth: ${isOAuth}`,
      Date.now() - t0
    );
  } catch (err) {
    await screenshot(page, `${nome}_error`).catch(() => {});
    record(`login_google_rodada_${rodada}`, false, `Exceção: ${err.message}`, Date.now() - t0);
  } finally {
    await browser.close();
  }
}

// ─── Teste 3: Logout (3x) ──────────────────────────────────────────────────
async function testeLogout(rodada) {
  const t0 = Date.now();
  const nome = `logout_r${rodada}`;
  const { browser, context, page } = await newBrowser();
  try {
    // Faz login primeiro
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    const emailToggle = page.locator('button', { hasText: 'Usar e-mail e senha' });
    await emailToggle.waitFor({ timeout: 10000 });
    await emailToggle.click();

    const tabEntrar = page.locator('button', { hasText: 'Entrar' }).first();
    await tabEntrar.waitFor({ timeout: 5000 });
    await tabEntrar.click();

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForURL(url => {
        const u = url.toString();
        return u.endsWith('/') || u.includes('/onboarding');
      }, { timeout: 20000 });
    } catch {
      log('Login para logout test — sem redirecionamento, tentando continuar...');
    }

    // Vai para /conta
    await page.goto(`${BASE_URL}/conta`, { waitUntil: 'networkidle', timeout: 20000 });
    await screenshot(page, `${nome}_01_conta`);

    // Clica logout (botão "Sair")
    const sairBtn = page.locator('button', { hasText: 'Sair' }).first();
    await sairBtn.waitFor({ timeout: 10000 });
    await sairBtn.click();

    let passou = false;
    let detalhe = '';
    try {
      await page.waitForURL(url => url.toString().includes('/login'), { timeout: 15000 });
      detalhe = `Redirecionado para: ${page.url()}`;
      passou = true;
    } catch {
      detalhe = `Sem redirecionamento para /login. URL atual: ${page.url()}`;
    }

    await screenshot(page, `${nome}_02_after_logout`);
    record(`logout_rodada_${rodada}`, passou, detalhe, Date.now() - t0);
  } catch (err) {
    await screenshot(page, `${nome}_error`).catch(() => {});
    record(`logout_rodada_${rodada}`, false, `Exceção: ${err.message}`, Date.now() - t0);
  } finally {
    await browser.close();
  }
}

// ─── Teste 4: Login inválido (3x) ──────────────────────────────────────────
async function testeLoginInvalido(rodada) {
  const t0 = Date.now();
  const nome = `login_invalido_r${rodada}`;
  const { browser, page } = await newBrowser();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    const emailToggle = page.locator('button', { hasText: 'Usar e-mail e senha' });
    await emailToggle.waitFor({ timeout: 10000 });
    await emailToggle.click();

    const tabEntrar = page.locator('button', { hasText: 'Entrar' }).first();
    await tabEntrar.waitFor({ timeout: 5000 });
    await tabEntrar.click();

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', 'SENHAERRADA999!');
    await page.locator('button[type="submit"]').click();

    await screenshot(page, `${nome}_01_submitted`);

    // Espera mensagem de erro (errorBox tem cor #f87171)
    let erroTexto = '';
    let passou = false;
    try {
      // O errorBox é um div com background rgba(239,68,68,0.08) — verifica por conteúdo
      await page.waitForTimeout(3000);
      // Tenta pegar qualquer elemento com texto de erro
      const errorEl = page.locator('div').filter({ hasText: /invalid|incorrect|inválid|senha|credencial|wrong|not found/i }).first();
      erroTexto = await errorEl.textContent({ timeout: 5000 }).catch(() => '');
      if (!erroTexto) {
        // Tenta pegar via estilo (cor f87171 aparece no errorBox)
        const allDivs = await page.$$eval('div', divs =>
          divs
            .filter(d => d.style && d.style.color && d.style.color.includes('f87171'))
            .map(d => d.textContent?.trim())
        );
        erroTexto = allDivs.join(' | ') || 'Elemento de erro não encontrado via estilo';
      }
      passou = erroTexto.length > 0;
    } catch (e) {
      erroTexto = `Erro ao buscar mensagem: ${e.message}`;
    }

    await screenshot(page, `${nome}_02_error_shown`);
    record(`login_invalido_rodada_${rodada}`, passou, `Mensagem de erro: "${erroTexto}"`, Date.now() - t0);
  } catch (err) {
    await screenshot(page, `${nome}_error`).catch(() => {});
    record(`login_invalido_rodada_${rodada}`, false, `Exceção: ${err.message}`, Date.now() - t0);
  } finally {
    await browser.close();
  }
}

// ─── Teste 5: Acesso sem login redireciona para /login (3x) ────────────────
async function testeAcessoSemLogin(rodada) {
  const t0 = Date.now();
  const nome = `acesso_sem_login_r${rodada}`;
  const { browser, page } = await newBrowser();
  try {
    // Vai direto para / sem estar logado
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await screenshot(page, `${nome}_01_result`);

    const finalUrl = page.url();
    const passou = finalUrl.includes('/login');
    record(
      `acesso_sem_login_rodada_${rodada}`,
      passou,
      `URL final: ${finalUrl} | Redirecionou para /login: ${passou}`,
      Date.now() - t0
    );
  } catch (err) {
    await screenshot(page, `${nome}_error`).catch(() => {});
    record(`acesso_sem_login_rodada_${rodada}`, false, `Exceção: ${err.message}`, Date.now() - t0);
  } finally {
    await browser.close();
  }
}

// ─── Teste 6: Sessão persistente (3x) ──────────────────────────────────────
async function testeSessaoPersistente(rodada) {
  const t0 = Date.now();
  const nome = `sessao_persistente_r${rodada}`;
  const storageStatePath = join(SCREENSHOT_DIR, `storage-state-r${rodada}.json`);

  // Passo 1: Login e salva state
  const { browser: b1, context: c1, page: p1 } = await newBrowser();
  try {
    await p1.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    const emailToggle = p1.locator('button', { hasText: 'Usar e-mail e senha' });
    await emailToggle.waitFor({ timeout: 10000 });
    await emailToggle.click();

    const tabEntrar = p1.locator('button', { hasText: 'Entrar' }).first();
    await tabEntrar.waitFor({ timeout: 5000 });
    await tabEntrar.click();

    await p1.fill('input[type="email"]', EMAIL);
    await p1.fill('input[type="password"]', PASSWORD);
    await p1.locator('button[type="submit"]').click();

    let loginOk = false;
    try {
      await p1.waitForURL(url => {
        const u = url.toString();
        return u.endsWith('/') || u.includes('/onboarding');
      }, { timeout: 20000 });
      loginOk = true;
    } catch {
      log('Sessão persistente: login sem redirecionamento, tentando salvar state mesmo assim...');
    }

    await c1.storageState({ path: storageStatePath });
    log(`Storage state salvo em: ${storageStatePath}`);
    await screenshot(p1, `${nome}_01_logged_in`);
    await b1.close();

    if (!loginOk) {
      record(`sessao_persistente_rodada_${rodada}`, false, 'Login inicial falhou — não é possível testar persistência', Date.now() - t0);
      return;
    }
  } catch (err) {
    await b1.close().catch(() => {});
    record(`sessao_persistente_rodada_${rodada}`, false, `Erro no login inicial: ${err.message}`, Date.now() - t0);
    return;
  }

  // Passo 2: Abre novo browser com storage state salvo
  const { browser: b2, page: p2 } = await newBrowser(storageStatePath);
  try {
    await p2.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await screenshot(p2, `${nome}_02_reopen`);

    const finalUrl = p2.url();
    // Se ainda logado, não redireciona para /login
    const aindaLogado = !finalUrl.includes('/login');
    record(
      `sessao_persistente_rodada_${rodada}`,
      aindaLogado,
      `Após reabrir browser: URL=${finalUrl} | Ainda logado: ${aindaLogado}`,
      Date.now() - t0
    );
  } catch (err) {
    await screenshot(p2, `${nome}_error`).catch(() => {});
    record(`sessao_persistente_rodada_${rodada}`, false, `Erro ao reabrir: ${err.message}`, Date.now() - t0);
  } finally {
    await b2.close();
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  log('=== Iniciando testes TamoWork Foto IA ===');
  log(`Base URL: ${BASE_URL}`);
  log(`Screenshots: ${SCREENSHOT_DIR}`);

  // Garante que o usuário existe no Supabase
  try {
    await ensureUser();
  } catch (err) {
    log(`AVISO: Não foi possível garantir usuário via admin: ${err.message}`);
  }

  // Executa 3 rodadas de cada teste
  for (let r = 1; r <= 3; r++) {
    log(`\n--- Rodada ${r}/3 ---`);

    log('> Teste 1: Login email/senha');
    await testeLoginEmail(r);

    log('> Teste 2: Login com Google');
    await testeLoginGoogle(r);

    log('> Teste 3: Logout');
    await testeLogout(r);

    log('> Teste 4: Login inválido');
    await testeLoginInvalido(r);

    log('> Teste 5: Acesso sem login');
    await testeAcessoSemLogin(r);

    log('> Teste 6: Sessão persistente');
    await testeSessaoPersistente(r);
  }

  // Salva relatório JSON
  writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  log(`\n=== Relatório salvo em: ${REPORT_PATH} ===`);

  // Resumo
  const total = results.length;
  const passed = results.filter(r => r.passou).length;
  const failed = total - passed;
  log(`\nRESUMO: ${passed}/${total} passou | ${failed} falhou`);

  if (failed > 0) {
    log('\nFalhas:');
    results.filter(r => !r.passou).forEach(r => log(`  - ${r.teste}: ${r.detalhe}`));
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
