import { chromium } from 'playwright';

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';

async function main() {
  const r = await fetch('https://ddpyvdtgxemyxltgtxsh.supabase.co/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type: 'magiclink', email: 'teste4@teste4.com' })
  });
  const d = await r.json();
  const magicLink = d.action_link;
  console.log('Magic link gerado:', magicLink.substring(0, 80));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const page = await context.newPage();

  // Capturar console do browser
  page.on('console', m => {
    if (m.type() === 'error' || m.text().includes('checkout') || m.text().includes('stripe') || m.text().includes('Erro')) {
      console.log(`BROWSER ${m.type().toUpperCase()}: ${m.text().substring(0, 300)}`);
    }
  });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  // Capturar todas as requests de rede
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('stripe') || req.url().includes('mercadopago')) {
      console.log('REQUEST:', req.method(), req.url().substring(0, 100));
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/api/') || resp.url().includes('stripe') || resp.url().includes('mercadopago')) {
      const body = await resp.text().catch(() => '');
      console.log('RESPONSE:', resp.status(), resp.url().substring(0, 80));
      if (body.length < 500) console.log('  Body:', body);
    }
  });

  // Login via magic link
  await page.goto(magicLink, { timeout: 30000 });
  await page.waitForTimeout(4000);
  console.log('URL apos login:', page.url());

  // Verificar sessão no localStorage
  const session = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const sbKey = keys.find(k => k.includes('supabase'));
    if (!sbKey) return null;
    try { return JSON.parse(localStorage[sbKey]); } catch { return localStorage[sbKey]; }
  });
  console.log('Sessao Supabase:', session ? 'ENCONTRADA (user: ' + (session?.user?.email || 'N/A') + ')' : 'NAO ENCONTRADA');

  // Ir para /planos
  await page.goto('https://tamowork.com/planos', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('URL em /planos:', page.url());

  // Verificar sessão novamente após navegar
  const session2 = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const sbKey = keys.find(k => k.includes('supabase'));
    if (!sbKey) return null;
    try { return JSON.parse(localStorage[sbKey]); } catch { return localStorage[sbKey]; }
  });
  console.log('Sessao apos navegacao:', session2 ? 'ENCONTRADA (user: ' + (session2?.user?.email || 'N/A') + ')' : 'NAO ENCONTRADA');

  // Botão Assinar
  const btnText = await page.$$eval('button', els => els.map(e => e.textContent?.trim()));
  console.log('Botoes:', JSON.stringify(btnText));

  const assinarBtn = await page.locator('button').filter({ hasText: 'Assinar' }).first();
  const count = await assinarBtn.count();
  console.log('Botao Assinar count:', count);

  if (count > 0) {
    const isDisabled = await assinarBtn.isDisabled();
    const isVisible = await assinarBtn.isVisible();
    console.log('Botao - disabled:', isDisabled, 'visible:', isVisible);

    console.log('Clicando...');
    await assinarBtn.click();

    // Aguardar qualquer coisa acontecer
    await page.waitForTimeout(8000);
    console.log('URL apos click:', page.url());
  }

  // Screenshot final
  await page.screenshot({ path: 'c:/tmp/screenshots/C-stripe-debug.png', fullPage: true });
  console.log('Screenshot salva: C-stripe-debug.png');

  await browser.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
