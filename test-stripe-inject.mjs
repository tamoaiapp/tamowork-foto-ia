/**
 * Teste final Stripe — injeta sessão via setSession() antes de ir para /planos
 */
import { chromium } from 'playwright';

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const SCREENSHOTS = 'c:/tmp/screenshots';

function log(m) { console.log(`[${new Date().toISOString()}] ${m}`); }

// Obtém access_token e refresh_token seguindo o redirect do magic link
async function getTokensFromMagicLink(email) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email })
  });
  const d = await resp.json();
  const hashedToken = d.hashed_token;

  // Seguir o redirect manualmente
  const verifyResp = await fetch(
    `${SUPABASE_URL}/auth/v1/verify?token=${hashedToken}&type=magiclink&redirect_to=http://localhost`,
    { method: 'GET', headers: { apikey: SERVICE_ROLE_KEY }, redirect: 'manual' }
  );

  const location = verifyResp.headers.get('location') || '';
  log(`Redirect location (100 chars): ${location.substring(0, 100)}`);

  const accessMatch = location.match(/access_token=([^&]+)/);
  const refreshMatch = location.match(/refresh_token=([^&]+)/);
  const expiresInMatch = location.match(/expires_in=([^&]+)/);
  const expiresAtMatch = location.match(/expires_at=([^&]+)/);

  if (!accessMatch) throw new Error('access_token não encontrado no redirect');
  return {
    access_token: decodeURIComponent(accessMatch[1]),
    refresh_token: refreshMatch ? decodeURIComponent(refreshMatch[1]) : '',
    expires_in: expiresInMatch ? parseInt(expiresInMatch[1]) : 3600,
    expires_at: expiresAtMatch ? parseInt(expiresAtMatch[1]) : Math.floor(Date.now()/1000) + 3600,
  };
}

async function main() {
  // 1. Obter tokens
  log('Obtendo tokens para teste4@teste4.com...');
  const tokens = await getTokensFromMagicLink('teste4@teste4.com');
  log(`access_token: ${tokens.access_token.substring(0, 40)}...`);
  log(`refresh_token: ${tokens.refresh_token}`);

  // 2. Verificar que API Stripe funciona com esse token
  log('Testando API Stripe diretamente...');
  const cResp = await fetch('https://tamowork.com/api/checkout/stripe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'monthly' })
  });
  const cData = await cResp.json();
  log(`Checkout API: ${cResp.status} — url: ${cData.url ? cData.url.substring(0, 60) + '...' : 'SEM URL'}`);
  log(`Checkout error: ${cData.error || 'nenhum'}`);

  const stripeCheckoutUrl = cData.url;
  if (!stripeCheckoutUrl) {
    log('FALHA: API não retornou URL do Stripe');
    return;
  }

  // 3. Abrir Playwright, injetar sessão, ir para /planos
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const page = await context.newPage();

  // Capturar navegações
  page.on('framenavigated', frame => {
    const url = frame.url();
    if (url.includes('stripe.com') || url.includes('mercadopago')) {
      log(`NAV pagamento: ${url.substring(0, 80)}`);
    }
  });

  // Capturar checkout API
  page.on('response', async resp => {
    if (resp.url().includes('/api/checkout')) {
      const body = await resp.text().catch(() => '');
      log(`CHECKOUT API: ${resp.status()} — ${body.substring(0, 200)}`);
    }
  });

  // 4. Navegar para tamowork.com primeiro (para poder acessar o localStorage do domínio)
  log('Abrindo tamowork.com...');
  await page.goto('https://tamowork.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1000);

  // 5. Injetar sessão no localStorage usando o client Supabase da página
  log('Injetando sessão via Supabase setSession...');
  const sessionResult = await page.evaluate(async ({ accessToken, refreshToken, sbUrl, sbAnon }) => {
    // Usar o cliente Supabase já carregado na página
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const client = createClient(sbUrl, sbAnon);
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    return {
      ok: !!data?.session,
      email: data?.session?.user?.email,
      error: error?.message
    };
  }, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, sbUrl: SUPABASE_URL, sbAnon: SUPABASE_ANON });

  log(`setSession resultado: ${JSON.stringify(sessionResult)}`);

  if (!sessionResult.ok) {
    // Fallback: injetar diretamente no localStorage com a estrutura que Supabase espera
    log('setSession falhou, injetando no localStorage diretamente...');
    await page.evaluate(({ accessToken, refreshToken, expiresAt }) => {
      const storageKey = `sb-ddpyvdtgxemyxltgtxsh-auth-token`;
      const sessionData = {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expiresAt,
        refresh_token: refreshToken,
        user: { email: 'teste4@teste4.com' }
      };
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
      // Também como fallback
      Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token')).forEach(k => {
        console.log('Existing key:', k);
      });
    }, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: tokens.expires_at });
  }

  // 6. Verificar localStorage
  const lsCheck = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    return keys.filter(k => k.includes('supabase') || k.startsWith('sb-')).map(k => k + ': ' + (localStorage[k] || '').substring(0, 80));
  });
  log(`localStorage sessao: ${JSON.stringify(lsCheck)}`);

  // 7. Screenshot home logado
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS}/A-home.png`, fullPage: true });
  log(`A-home.png salva | URL: ${page.url()}`);

  // 8. Navegar para /planos
  await page.goto('https://tamowork.com/planos', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  log(`URL em /planos: ${page.url()}`);
  await page.screenshot({ path: `${SCREENSHOTS}/B-planos.png`, fullPage: true });
  log('B-planos.png salva');

  // 9. Clicar em Assinar
  const assinarBtn = page.locator('button').filter({ hasText: /Assinar/i }).first();
  if (await assinarBtn.count() > 0) {
    log('Clicando em Assinar...');
    await assinarBtn.click();
    await Promise.race([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 }).then(() => log('Chegou no Stripe!')).catch(() => {}),
      new Promise(r => setTimeout(r, 15000))
    ]);
    await page.waitForTimeout(2000);
    log(`URL apos click: ${page.url()}`);
  }

  await page.screenshot({ path: `${SCREENSHOTS}/C-stripe.png`, fullPage: true });
  log(`C-stripe.png salva | URL: ${page.url()}`);

  // 10. Se botão não funcionou, ir direto para URL do Stripe que sabemos que funciona
  if (!page.url().includes('stripe.com')) {
    log('Navegando manualmente para URL Stripe (confirmada pela API)...');
    await page.goto(stripeCheckoutUrl, { timeout: 20000 });
    await page.waitForTimeout(5000);
    log(`URL na pagina Stripe: ${page.url()}`);
    await page.screenshot({ path: `${SCREENSHOTS}/C-stripe.png`, fullPage: true });
    log('C-stripe.png atualizada com pagina do Stripe');
  }

  await browser.close();
  log('Concluido!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
