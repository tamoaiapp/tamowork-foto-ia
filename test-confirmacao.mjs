import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SCREENSHOTS_DIR = 'c:/tmp/screenshots';
const APP_URL = 'https://tamowork.com';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  log(`Screenshot salva: ${filePath} | URL atual: ${page.url()}`);
  return filePath;
}

async function generateMagicLink(email) {
  log(`Gerando magic link para: ${email}`);
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'magiclink', email })
  });
  const data = await resp.json();
  log(`Resposta generate_link (${resp.status}): ${JSON.stringify(data).substring(0, 200)}`);
  if (!data.action_link) {
    throw new Error(`Falha ao gerar magic link: ${JSON.stringify(data)}`);
  }
  return data.action_link;
}

async function createNewUser(email) {
  log(`Criando novo usuário: ${email}`);
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: 'test123456', email_confirm: true })
  });
  const data = await resp.json();
  log(`Resposta create_user (${resp.status}): ${JSON.stringify(data).substring(0, 200)}`);
  if (data.error || !data.id) {
    throw new Error(`Falha ao criar usuário: ${JSON.stringify(data)}`);
  }
  return data;
}

async function teste1_checkout_stripe(browser) {
  log('\n========== TESTE 1: Checkout Stripe ==========');
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'pt-BR'
  });
  const page = await context.newPage();

  // Monitorar respostas de API
  page.on('response', async r => {
    if (r.url().includes('/api/checkout')) {
      const text = await r.text().catch(() => '(erro ao ler)');
      log(`CHECKOUT API RESPONSE: ${r.status()} ${r.url()}\n  Body: ${text.substring(0, 300)}`);
    }
  });

  try {
    // 1. Gerar magic link para teste4@teste4.com
    const magicLink = await generateMagicLink('teste4@teste4.com');
    log(`Magic link gerado: ${magicLink.substring(0, 80)}...`);

    // 2. Navegar para o magic link
    log('Navegando para magic link...');
    await page.goto(magicLink, { waitUntil: 'networkidle', timeout: 30000 });
    log(`URL após magic link: ${page.url()}`);
    await page.waitForTimeout(5000);
    log(`URL após 5s: ${page.url()}`);
    await screenshot(page, 'A-home.png');

    // 3. Navegar para /planos
    log('Navegando para /planos...');
    await page.goto(`${APP_URL}/planos`, { waitUntil: 'networkidle', timeout: 20000 });
    log(`URL em /planos: ${page.url()}`);
    await page.waitForTimeout(2000);
    await screenshot(page, 'B-planos.png');

    // 4. Clicar em "Assinar" — botão mensal (primeiro botão de checkout)
    log('Procurando botão Assinar...');

    // Listar todos os botões visíveis
    const buttons = await page.$$eval('button', btns =>
      btns.map(b => ({ text: b.textContent?.trim(), class: b.className, disabled: b.disabled }))
    );
    log(`Botões encontrados: ${JSON.stringify(buttons.slice(0, 10))}`);

    // Tentar encontrar o botão de assinar
    const assinarBtn = await page.$('button:has-text("Assinar")') ||
                       await page.$('button:has-text("assinar")') ||
                       await page.$('[data-testid="checkout-btn"]') ||
                       await page.$('button:has-text("Começar")') ||
                       await page.$('button:has-text("Contratar")');

    if (!assinarBtn) {
      log('AVISO: Botão Assinar não encontrado. Listando todos os botões e links...');
      const allBtns = await page.$$eval('button, a[href*="checkout"], a[href*="stripe"]', els =>
        els.map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 50), href: e.href }))
      );
      log(`Elementos de checkout: ${JSON.stringify(allBtns)}`);
    } else {
      log('Botão Assinar encontrado, clicando...');

      // Aguardar possível navegação para Stripe
      const navigationPromise = page.waitForURL('**checkout.stripe.com**', { timeout: 8000 }).catch(() => {
        log('Stripe URL não detectada via waitForURL (timeout)');
      });

      await assinarBtn.click();
      await navigationPromise;
      await page.waitForTimeout(3000);
      log(`URL após click em Assinar: ${page.url()}`);
    }

    await screenshot(page, 'C-stripe.png');
    log(`Teste 1 concluído. URL final: ${page.url()}`);

  } catch (err) {
    log(`ERRO no Teste 1: ${err.message}`);
    await screenshot(page, 'C-stripe.png').catch(() => {});
  } finally {
    await context.close();
  }
}

async function teste2_onboarding_nova_conta(browser) {
  log('\n========== TESTE 2: Onboarding Nova Conta ==========');

  // Novo contexto (localStorage limpo)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'pt-BR'
  });
  const page = await context.newPage();

  try {
    // 1. Criar novo usuário
    const email = `novo${Date.now()}@teste.com`;
    const newUser = await createNewUser(email);
    log(`Novo usuário criado: ${newUser.id} — ${email}`);

    // 2. Gerar magic link para o novo usuário
    const magicLink = await generateMagicLink(email);
    log(`Magic link do novo usuário: ${magicLink.substring(0, 80)}...`);

    // 3. Navegar para o magic link
    log('Navegando para magic link da nova conta...');
    await page.goto(magicLink, { waitUntil: 'networkidle', timeout: 30000 });
    log(`URL imediata após magic link: ${page.url()}`);

    // Aguardar redirecionamento para onboarding
    await page.waitForTimeout(8000);
    log(`URL após 8s: ${page.url()}`);

    // Verificar se chegou em /onboarding
    const finalUrl = page.url();
    if (finalUrl.includes('/onboarding')) {
      log('SUCESSO: Redirecionado para /onboarding!');
    } else {
      log(`ATENÇÃO: URL não é /onboarding — está em: ${finalUrl}`);
    }

    await screenshot(page, 'D-onboarding.png');

    // Descrever o que está na tela
    const pageTitle = await page.title();
    const h1Text = await page.$eval('h1', el => el.textContent?.trim()).catch(() => '(sem h1)');
    const bodyText = await page.$eval('body', el => el.textContent?.trim().substring(0, 300)).catch(() => '');
    log(`Título da página: ${pageTitle}`);
    log(`H1: ${h1Text}`);
    log(`Texto da página (300 chars): ${bodyText}`);

  } catch (err) {
    log(`ERRO no Teste 2: ${err.message}`);
    await screenshot(page, 'D-onboarding.png').catch(() => {});
  } finally {
    await context.close();
  }
}

async function main() {
  log('Iniciando testes finais TamoWork...');
  log(`Screenshots serão salvas em: ${SCREENSHOTS_DIR}`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    await teste1_checkout_stripe(browser);
    await teste2_onboarding_nova_conta(browser);
  } finally {
    await browser.close();
    log('\nTodos os testes concluídos!');
    log(`Screenshots em: ${SCREENSHOTS_DIR}`);
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
