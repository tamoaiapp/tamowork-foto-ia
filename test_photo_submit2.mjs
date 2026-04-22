import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import https from 'https';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const IMAGE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/00468d62-16ec-4c86-8809-f2a67ffbd6d2/1776391435138.jpg';
const IMG_PATH = '/tmp/conjunto_inverno.jpg';

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(IMG_PATH)) {
    console.log('Baixando imagem...');
    await downloadImage(IMAGE_URL, IMG_PATH);
  }
  console.log('Imagem:', fs.statSync(IMG_PATH).size, 'bytes');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teste14@teste.com',
    password: 'teste123456'
  });
  if (authErr) { console.error('Auth error:', authErr.message); process.exit(1); }
  console.log('Login OK, user:', authData.user.id);

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://tamowork.com', { waitUntil: 'networkidle' });

  const session = authData.session;
  await page.evaluate((sess) => {
    const key = 'sb-ddpyvdtgxemyxltgtxsh-auth-token';
    localStorage.setItem(key, JSON.stringify(sess));
  }, session);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Close any modal/dialog if present
  const closeBtn = await page.$('button:has-text("Agora não"), button:has-text("Fechar"), button[aria-label="Close"]');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
    console.log('Modal fechado');
  }

  await page.screenshot({ path: '/tmp/ss_01_loaded.png' });
  console.log('SS1: página carregada');

  // List all interactive elements to understand the form
  const inputs = await page.$$eval('input, textarea, button', els => 
    els.map(el => ({ tag: el.tagName, type: el.type, placeholder: el.placeholder, text: el.textContent?.trim().slice(0, 50), name: el.name, id: el.id }))
  );
  console.log('Elementos:', JSON.stringify(inputs, null, 2));
  
  await browser.close();
}

main().catch(e => { console.error('Erro:', e); process.exit(1); });
