/**
 * Teste final TamoWork — v2 (mais robusto)
 * Usa interceptação de request para capturar URL do Stripe antes do redirect
 */
import { chromium } from 'playwright';
import path from 'path';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SCREENSHOTS_DIR = 'c:/tmp/screenshots';

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  log(`Screenshot: ${filePath} | URL: ${page.url()}`);
}

async function generateMagicLink(email) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST', headers,
    body: JSON.stringify({ type: 'magiclink', email })
  });
  const d = await resp.json();
  if (!d.action_link) throw new Error(`Falha magic link: ${JSON.stringify(d)}`);
  return d.action_link;
}

async function createNewUser(email) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password: 'test123456', email_confirm: true })
  });
  const d = await resp.json();
  if (!d.id) throw new Error(`Falha criar usuário: ${JSON.stringify(d)}`);
  return d;
}

async function main() {
  log('=== Iniciando testes finais TamoWork v2 ===');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  // =============================================
  // TESTE 1 — Login + Planos + Checkout Stripe
  // =============================================
  log('\n=== TESTE 1: Checkout Stripe ===');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
    const page = await context.newPage();

    // Capturar respostas de checkout
    let stripeUrl = null;
    let checkoutStatus = null;
    let checkoutBody = null;
    page.on('response', async r => {
      if (r.url().includes('/api/checkout')) {
        checkoutStatus = r.status();
        checkoutBody = await r.text().catch(() => '');
        log(`CHECKOUT API: ${checkoutStatus} — ${checkoutBody.substring(0, 200)}`);
        try {
          const parsed = JSON.parse(checkoutBody);
          if (parsed.url) stripeUrl = parsed.url;
          if (parsed.init_point) stripeUrl = parsed.init_point;
        } catch {}
      }
    });

    // Capturar navegação para Stripe (via window.location.href)
    page.on('framenavigated', frame => {
      const url = frame.url();
      if (url.includes('checkout.stripe.com') || url.includes('mercadopago.com')) {
        log(`NAVEGACAO DETECTADA: ${url.substring(0, 100)}`);
        stripeUrl = url;
      }
    });

    try {
      // 1. Magic link
      const magicLink = await generateMagicLink('teste4@teste4.com');
      log(`Magic link: ${magicLink.substring(0, 80)}...`);

      // 2. Navegar — magic link redireciona para tamowork.com/#access_token=...
      await page.goto(magicLink, { timeout: 30000 });
      await page.waitForTimeout(5000);
      log(`URL após magic link + 5s: ${page.url()}`);
      await screenshot(page, 'A-home.png');

      // 3. Ir para /planos
      await page.goto('https://tamowork.com/planos', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);
      log(`URL em /planos: ${page.url()}`);
      await screenshot(page, 'B-planos.png');

      // 4. Listar botões
      const btns = await page.$$eval('button', els => els.map(e => e.textContent?.trim()));
      log(`Botões: ${JSON.stringify(btns)}`);

      // 5. Clicar em Assinar
      const assinarBtn = page.locator('button', { hasText: /Assinar/i }).first();
      if (await assinarBtn.count() === 0) {
        log('Botão Assinar não encontrado!');
      } else {
        log('Clicando em Assinar...');
        await assinarBtn.click();

        // Aguardar: ou navega para Stripe, ou response da API chega
        await Promise.race([
          page.waitForURL('**checkout.stripe.com**', { timeout: 12000 }).catch(() => {}),
          page.waitForURL('**mercadopago.com**', { timeout: 12000 }).catch(() => {}),
          new Promise(r => setTimeout(r, 12000))
        ]);

        await page.waitForTimeout(2000);
        log(`URL após click: ${page.url()}`);
        log(`Stripe URL capturada: ${stripeUrl ? stripeUrl.substring(0, 80) + '...' : 'NÃO CAPTURADA'}`);
        log(`Checkout API status: ${checkoutStatus} | body: ${(checkoutBody || '').substring(0, 150)}`);
      }

      await screenshot(page, 'C-stripe.png');

      // 6. Se a página ainda está em /planos mas temos a URL do Stripe, navegar manualmente
      if (stripeUrl && (page.url().includes('tamowork.com') || page.url().includes('tamowork.com'))) {
        log('Navegando manualmente para URL do Stripe/MP...');
        await page.goto(stripeUrl, { timeout: 20000 });
        await page.waitForTimeout(4000);
        log(`URL na página de pagamento: ${page.url()}`);
        await screenshot(page, 'C-stripe.png');
      }

    } catch (err) {
      log(`ERRO Teste 1: ${err.message}`);
      await screenshot(page, 'C-stripe.png').catch(() => {});
    }
    await context.close();
  }

  // =============================================
  // TESTE 2 — Nova conta → Onboarding
  // =============================================
  log('\n=== TESTE 2: Onboarding Nova Conta ===');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
    const page = await context.newPage();

    try {
      const email = `novo${Date.now()}@teste.com`;
      const newUser = await createNewUser(email);
      log(`Novo usuário: ${newUser.id} — ${email}`);

      const magicLink = await generateMagicLink(email);
      log(`Magic link nova conta: ${magicLink.substring(0, 80)}...`);

      // Monitorar todas as navegações
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
          log(`Nav detectada: ${frame.url()}`);
        }
      });

      await page.goto(magicLink, { timeout: 30000 });
      log(`URL imediata: ${page.url()}`);

      // Aguardar possível redirecionamento para /onboarding
      await Promise.race([
        page.waitForURL('**/onboarding**', { timeout: 10000 }).then(() => log('CHEGOU em /onboarding!')).catch(() => {}),
        new Promise(r => setTimeout(r, 10000))
      ]);

      log(`URL após 10s: ${page.url()}`);

      if (page.url().includes('/onboarding')) {
        log('SUCESSO: onboarding apareceu!');
      } else {
        log(`ATENCAO: ficou em ${page.url()} — sem redirect para /onboarding`);
      }

      await screenshot(page, 'D-onboarding.png');

      // Descrever o conteúdo da tela
      const h1 = await page.$eval('h1', e => e.textContent?.trim()).catch(() => '(sem h1)');
      const mainText = await page.$eval('main, [class*="main"], #__next', e => e.textContent?.trim().substring(0, 400)).catch(async () => {
        return await page.$eval('body', e => e.textContent?.trim().substring(0, 400)).catch(() => '');
      });
      log(`H1: ${h1}`);
      log(`Texto principal: ${mainText}`);

    } catch (err) {
      log(`ERRO Teste 2: ${err.message}`);
      await screenshot(page, 'D-onboarding.png').catch(() => {});
    }
    await context.close();
  }

  await browser.close();
  log('\n=== TESTES CONCLUÍDOS ===');
  log(`Screenshots: ${SCREENSHOTS_DIR}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
