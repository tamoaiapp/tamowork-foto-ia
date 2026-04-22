import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import https from 'https';

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';

const IMAGE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co/storage/v1/object/public/input-images/00468d62-16ec-4c86-8809-f2a67ffbd6d2/1776391435138.jpg';
const IMG_PATH = '/tmp/conjunto_inverno.jpg';

// Download the original image
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
  console.log('Baixando imagem original...');
  await downloadImage(IMAGE_URL, IMG_PATH);
  console.log('Imagem baixada:', fs.statSync(IMG_PATH).size, 'bytes');

  // Sign in with Supabase to get a token
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teste14@teste.com',
    password: 'teste123456'
  });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    process.exit(1);
  }
  console.log('Login OK, user:', authData.user.id);

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Set session in localStorage
  await page.goto('https://tamowork.com', { waitUntil: 'networkidle' });
  
  const session = authData.session;
  await page.evaluate((sess) => {
    const key = `sb-ddpyvdtgxemyxltgtxsh-auth-token`;
    localStorage.setItem(key, JSON.stringify(sess));
  }, session);
  
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/ss_01_loaded.png' });
  console.log('Screenshot 1: página carregada');

  // Wait for the upload area
  await page.waitForTimeout(2000);
  
  // Find the file input
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    await page.screenshot({ path: '/tmp/ss_02_no_input.png' });
    console.log('File input não encontrado, veja ss_02_no_input.png');
    await browser.close();
    return;
  }
  
  await fileInput.setInputFiles(IMG_PATH);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/ss_02_uploaded.png' });
  console.log('Screenshot 2: imagem carregada');

  // Fill in product name
  const productInput = await page.$('input[placeholder*="Produto"], input[placeholder*="produto"], input[name="produto"], input[placeholder*="Nome"]');
  if (productInput) {
    await productInput.fill('Conjunto de meninos 12 anos');
    console.log('Produto preenchido');
  } else {
    console.log('Campo produto não encontrado');
  }

  // Fill in scenario
  const scenarioInput = await page.$('input[placeholder*="cenário"], input[placeholder*="Cenário"], input[name="cenario"], input[placeholder*="cena"]');
  if (scenarioInput) {
    await scenarioInput.fill('No campo de futebol');
    console.log('Cenário preenchido');
  } else {
    console.log('Campo cenário não encontrado, tentando textarea...');
    const ta = await page.$('textarea');
    if (ta) {
      await ta.fill('No campo de futebol');
    }
  }

  await page.screenshot({ path: '/tmp/ss_03_form_filled.png' });
  console.log('Screenshot 3: formulário preenchido');

  // Click submit button
  const submitBtn = await page.$('button[type="submit"], button:has-text("Gerar"), button:has-text("Criar"), button:has-text("Enviar")');
  if (submitBtn) {
    await submitBtn.click();
    console.log('Botão submit clicado');
  } else {
    console.log('Botão submit não encontrado');
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const txt = await btn.innerText();
      console.log('Botão:', txt);
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/ss_04_submitted.png' });
  console.log('Screenshot 4: após submit');

  // Wait up to 5 minutes for completion
  let done = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(5000);
    const ss = await page.screenshot({ path: `/tmp/ss_wait_${i}.png` });
    
    // Check if there's an image result
    const resultImg = await page.$('img[src*="output"], img[src*="result"], img.result-image, .result img');
    if (resultImg) {
      console.log('Imagem resultado encontrada!');
      done = true;
      break;
    }
    
    // Check for success indicators
    const pageContent = await page.textContent('body');
    if (pageContent.includes('Pronto') || pageContent.includes('Concluído') || pageContent.includes('done')) {
      console.log('Status: concluído!');
      done = true;
      break;
    }
    
    console.log(`Aguardando... ${(i+1)*5}s`);
  }

  await page.screenshot({ path: '/tmp/ss_final.png' });
  console.log('Screenshot final salvo em /tmp/ss_final.png');
  
  await page.waitForTimeout(2000);
  await browser.close();
}

main().catch(e => {
  console.error('Erro:', e);
  process.exit(1);
});
