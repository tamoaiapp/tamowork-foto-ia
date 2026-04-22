import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
  console.log('Login OK');

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://tamowork.com', { waitUntil: 'networkidle' });
  await page.evaluate((sess) => {
    localStorage.setItem('sb-ddpyvdtgxemyxltgtxsh-auth-token', JSON.stringify(sess));
  }, authData.session);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Close modal if present
  const closeBtn = await page.$('button:has-text("Agora não")');
  if (closeBtn) { await closeBtn.click(); await page.waitForTimeout(500); }

  // Click first "Usar agora"
  const usarBtn = await page.$('button:has-text("Usar agora")');
  if (usarBtn) { await usarBtn.click(); await page.waitForTimeout(1500); }

  // Upload image
  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles(IMG_PATH);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/ss_03_uploaded.png' });
  console.log('SS3: imagem carregada');

  // Fill product name
  const productInput = await page.$('input[placeholder*="vestido feminino"]');
  await productInput.fill('Conjunto de meninos 12 anos');

  // Fill scenario
  const scenarioInput = await page.$('input[placeholder*="Deixe vazio"]');
  await scenarioInput.fill('No campo de futebol');

  await page.screenshot({ path: '/tmp/ss_04_form_filled.png' });
  console.log('SS4: formulário preenchido');

  // Click "Cria pra mim"
  const submitBtn = await page.$('button:has-text("Cria pra mim")');
  if (submitBtn) {
    await submitBtn.click();
    console.log('Submit clicado!');
  } else {
    console.log('Botão submit não encontrado');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/ss_05_submitted.png' });
  console.log('SS5: após submit');

  // Wait for completion - up to 6 minutes, screenshot every 10s
  let finalResult = false;
  for (let i = 0; i < 36; i++) {
    await page.waitForTimeout(10000);
    await page.screenshot({ path: `/tmp/ss_wait_${String(i).padStart(2,'0')}.png` });
    console.log(`Aguardando... ${(i+1)*10}s`);
    
    // Check for completion
    const content = await page.textContent('body').catch(() => '');
    if (content.includes('Pronto') || content.includes('Ficou assim') || content.includes('Baixar')) {
      finalResult = true;
      console.log('CONCLUÍDO!');
      await page.screenshot({ path: '/tmp/ss_FINAL.png' });
      break;
    }
    
    // Check for error
    if (content.includes('Algo deu errado') || content.includes('Tenta novamente')) {
      console.log('ERRO detectado');
      await page.screenshot({ path: '/tmp/ss_ERROR.png' });
      break;
    }
  }

  if (!finalResult) {
    await page.screenshot({ path: '/tmp/ss_FINAL.png' });
    console.log('Tempo esgotado ou status incerto');
  }

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(e => { console.error('Erro:', e); process.exit(1); });
