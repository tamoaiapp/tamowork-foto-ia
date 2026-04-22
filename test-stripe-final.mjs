/**
 * Teste final Stripe — aguarda sessão ser processada antes de ir para /planos
 */
import { chromium } from 'playwright';

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SCREENSHOTS = 'c:/tmp/screenshots';

function log(m) { console.log(`[${new Date().toISOString()}] ${m}`); }

async function main() {
  // Gerar magic link
  const r = await fetch('https://ddpyvdtgxemyxltgtxsh.supabase.co/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: 'teste4@teste4.com' })
  });
  const d = await r.json();
  const magicLink = d.action_link;
  log('Magic link OK');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const page = await context.newPage();

  let stripeUrl = null;
  let checkoutStatus = null;
  let checkoutBody = null;

  page.on('response', async resp => {
    if (resp.url().includes('/api/checkout')) {
      checkoutStatus = resp.status();
      checkoutBody = await resp.text().catch(() => '');
      log(`CHECKOUT API: ${checkoutStatus} — ${checkoutBody.substring(0, 300)}`);
      try {
        const parsed = JSON.parse(checkoutBody);
        if (parsed.url) stripeUrl = parsed.url;
      } catch {}
    }
  });

  page.on('framenavigated', frame => {
    const url = frame.url();
    if (url.includes('checkout.stripe.com') || url.includes('mercadopago')) {
      stripeUrl = url;
      log(`NAV para pagamento: ${url.substring(0, 80)}`);
    }
  });

  // 1. Ir para magic link
  log('Navegando para magic link...');
  await page.goto(magicLink, { timeout: 30000 });

  // 2. Aguardar o Supabase processar o hash e salvar no localStorage
  //    O client-side Supabase.js faz isso automaticamente ao detectar #access_token no hash
  log('Aguardando sessao Supabase ser salva...');
  let sessionFound = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const hasSession = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(k => k.includes('supabase') && localStorage[k].includes('access_token'));
    });
    if (hasSession) {
      sessionFound = true;
      log(`Sessao encontrada apos ${(i+1) * 0.5}s`);
      break;
    }
  }

  if (!sessionFound) {
    log('AVISO: Sessao nao encontrada no localStorage. Tentando continuar mesmo assim...');
  }

  log(`URL apos login: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS}/A-home.png`, fullPage: true });
  log('Screenshot A-home.png salva');

  // 3. Navegar para /planos — MESMA aba para manter sessão
  log('Navegando para /planos...');
  await page.goto('https://tamowork.com/planos', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  log(`URL em /planos: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS}/B-planos.png`, fullPage: true });
  log('Screenshot B-planos.png salva');

  // Verificar sessão
  const sessionCheck = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const sbKey = keys.find(k => k.includes('supabase') && localStorage[k].includes('access_token'));
    if (!sbKey) return null;
    try {
      const d = JSON.parse(localStorage[sbKey]);
      return { email: d?.user?.email, has_token: !!d?.access_token };
    } catch { return { raw: localStorage[sbKey]?.substring(0, 100) }; }
  });
  log(`Sessao em /planos: ${JSON.stringify(sessionCheck)}`);

  // 4. Clicar em Assinar
  const assinarBtn = page.locator('button').filter({ hasText: /Assinar/i }).first();
  const count = await assinarBtn.count();
  log(`Botao Assinar: count=${count}`);

  if (count > 0) {
    log('Clicando em Assinar agora...');
    await assinarBtn.click();

    // Aguardar qualquer coisa — navegação ou response da API
    await Promise.race([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 }).then(() => log('CHEGOU no Stripe!')).catch(() => {}),
      new Promise(resolve => {
        const interval = setInterval(async () => {
          if (stripeUrl) { clearInterval(interval); resolve(); }
        }, 200);
        setTimeout(() => { clearInterval(interval); resolve(); }, 15000);
      })
    ]);

    await page.waitForTimeout(2000);
    log(`URL apos click: ${page.url()}`);
    log(`stripeUrl capturado: ${stripeUrl ? stripeUrl.substring(0, 100) : 'NAO'}`);
    log(`checkout status: ${checkoutStatus}`);
    log(`checkout body: ${(checkoutBody || '').substring(0, 200)}`);

    // Se temos URL do Stripe mas o browser não navegou, navegar manualmente
    if (stripeUrl && !page.url().includes('stripe.com')) {
      log('Navegando manualmente para Stripe...');
      await page.goto(stripeUrl, { timeout: 20000 });
      await page.waitForTimeout(4000);
      log(`URL na pagina Stripe: ${page.url()}`);
    }
  }

  await page.screenshot({ path: `${SCREENSHOTS}/C-stripe.png`, fullPage: true });
  log('Screenshot C-stripe.png salva');
  log(`URL final C-stripe: ${page.url()}`);

  await browser.close();
  log('Concluido!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
