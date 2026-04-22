import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teste14@teste.com',
    password: 'teste123456'
  });
  if (authErr) { console.error('Auth error:', authErr.message); process.exit(1); }

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://tamowork.com', { waitUntil: 'networkidle' });
  await page.evaluate((sess) => {
    localStorage.setItem('sb-ddpyvdtgxemyxltgtxsh-auth-token', JSON.stringify(sess));
  }, authData.session);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Close modal
  const closeBtn = await page.$('button:has-text("Agora não")');
  if (closeBtn) { await closeBtn.click(); await page.waitForTimeout(500); }

  // Check if upsell is showing
  const verBtn = await page.$('button:has-text("Ver minha foto primeiro")');
  if (verBtn) {
    await verBtn.click();
    await page.waitForTimeout(2000);
    console.log('"Ver minha foto" clicado');
  }

  await page.screenshot({ path: '/tmp/ss_result_view.png' });
  console.log('SS: resultado');

  // Also check Criações section
  const criacoesBtn = await page.$('button:has-text("Criações")');
  if (criacoesBtn) {
    await criacoesBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/ss_criacoes.png' });
    console.log('SS: criações');
  }

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(e => { console.error('Erro:', e); process.exit(1); });
