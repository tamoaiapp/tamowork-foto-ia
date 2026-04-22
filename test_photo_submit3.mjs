import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import https from 'https';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const IMG_PATH = '/tmp/conjunto_inverno.jpg';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teste14@teste.com',
    password: 'teste123456'
  });
  if (authErr) { console.error('Auth error:', authErr.message); process.exit(1); }

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://tamowork.com', { waitUntil: 'networkidle' });

  await page.evaluate((sess) => {
    localStorage.setItem('sb-ddpyvdtgxemyxltgtxsh-auth-token', JSON.stringify(sess));
  }, authData.session);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Close modal
  const closeBtn = await page.$('button:has-text("Agora não")');
  if (closeBtn) { await closeBtn.click(); await page.waitForTimeout(500); }

  // Click first "Usar agora" button
  const usarButtons = await page.$$('button:has-text("Usar agora")');
  console.log('Botões "Usar agora":', usarButtons.length);
  if (usarButtons.length > 0) {
    await usarButtons[0].click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: '/tmp/ss_02_after_usar.png' });
  console.log('SS2: após clicar Usar agora');

  // Now look for form elements
  const inputs = await page.$$eval('input, textarea', els => 
    els.map(el => ({ tag: el.tagName, type: el.type, placeholder: el.placeholder, name: el.name, id: el.id }))
  );
  console.log('Inputs:', JSON.stringify(inputs, null, 2));
  
  await browser.close();
}

main().catch(e => { console.error('Erro:', e); process.exit(1); });
