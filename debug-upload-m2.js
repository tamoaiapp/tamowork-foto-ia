/**
 * debug-upload-m2.js — Debug do fluxo de upload no mobile (Pixel 7)
 */
const { chromium } = require('C:/Users/Notebook/node_modules/playwright');
const fs = require('fs');

const EMAIL = 'test-stress-m2@tamowork.test';
const PASSWORD = 'StressM2@2026';
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m2';

const PIXEL7 = {
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2.625,
};

async function doLogin(page) {
  await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Abrir email/senha se necessário
  const emailToggle = page.locator('button:has-text("e-mail"), button:has-text("email"), button:has-text("Usar e-mail")').first();
  if (await emailToggle.count() > 0 && await emailToggle.isVisible()) {
    await emailToggle.click();
    await page.waitForTimeout(500);
  }

  // Aba Entrar
  const entrarTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
  if (await entrarTab.count() > 0 && await entrarTab.isVisible()) {
    await entrarTab.click();
    await page.waitForTimeout(400);
    console.log('Clicou aba Entrar');
  }

  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);

  const submitBtn = page.locator('form button').filter({ hasText: /^Entrar$/ }).first();
  if (await submitBtn.count() > 0) await submitBtn.click();
  else await page.locator('input[type="password"]').first().press('Enter');

  await page.waitForTimeout(5000);

  if (page.url().includes('/onboarding')) {
    await page.evaluate(() => localStorage.setItem('tw_onboarding_done', '1'));
    await page.goto('https://tamowork.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  return !page.url().includes('/login');
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    ...PIXEL7,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = await context.newPage();

  console.log('=== Login ===');
  const ok = await doLogin(page);
  console.log('Login:', ok, page.url());

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-01-home.png` });

  // Selecionar modo foto_em_cena
  console.log('\n=== Selecionando modo foto_em_cena ===');
  const modeEl = page.locator('div, button, [class*="card"], [class*="mode"]').filter({ hasText: /Foto em cena/i }).first();
  const modeCount = await modeEl.count();
  console.log(`Elementos com "Foto em cena": ${modeCount}`);

  if (modeCount > 0) {
    await modeEl.click();
    console.log('Clicou no modo');
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-02-modo.png` });

  // Analisar a página
  const analysis = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      placeholder: i.placeholder,
      id: i.id,
      name: i.name,
      accept: i.accept,
      visible: window.getComputedStyle(i).display !== 'none',
      className: i.className.slice(0, 80),
    }));

    const uploadEls = Array.from(document.querySelectorAll('[class*="drop"], [class*="upload"], [class*="picker"], [class*="zone"], [class*="file"], [class*="Photo"]')).map(el => ({
      tag: el.tagName,
      className: el.className.slice(0, 100),
      visible: window.getComputedStyle(el).display !== 'none',
      text: el.textContent?.trim()?.slice(0, 60),
      onclick: !!el.onclick,
    }));

    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim()?.slice(0, 50),
      disabled: b.disabled,
      type: b.type,
    }));

    const pageText = document.body.innerText?.slice(0, 500);

    return { inputs, uploadEls, buttons, pageText };
  });

  console.log('\n--- Inputs ---');
  console.log(JSON.stringify(analysis.inputs, null, 2));

  console.log('\n--- Upload elements ---');
  console.log(JSON.stringify(analysis.uploadEls, null, 2));

  console.log('\n--- Buttons ---');
  console.log(JSON.stringify(analysis.buttons, null, 2));

  console.log('\n--- Page text (500 chars) ---');
  console.log(analysis.pageText);

  // Tentar clicar na área de upload
  console.log('\n=== Tentando clicar na área de upload ===');

  const dropSelectors = [
    '[class*="dropzone"]',
    '[class*="Dropzone"]',
    '[class*="upload"]',
    '[class*="Upload"]',
    '[class*="picker"]',
    '[class*="Picker"]',
    '[class*="zone"]',
    '[class*="FileInput"]',
    '[class*="fileInput"]',
    '[class*="PhotoPicker"]',
  ];

  for (const sel of dropSelectors) {
    const el = page.locator(sel).first();
    const count = await el.count();
    if (count > 0) {
      const visible = await el.isVisible().catch(() => false);
      console.log(`${sel}: count=${count}, visible=${visible}`);
      if (visible) {
        try {
          const [fc] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null),
            el.click(),
          ]);
          if (fc) {
            console.log(`  => Filechooser aberto via ${sel}!`);
            await fc.setFiles(`${SCREENSHOTS_DIR}/relogio-test.jpg`);
            await page.waitForTimeout(2000);
            break;
          } else {
            console.log(`  => Click feito mas sem filechooser`);
          }
        } catch(e) {
          console.log(`  => Erro: ${e.message}`);
        }
      }
    }
  }

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-03-apos-clique.png` });

  // Verificar file inputs após clicar
  const inputsAfter = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="file"]')).map(i => ({
      accept: i.accept,
      id: i.id,
      className: i.className.slice(0, 80),
    }));
  });
  console.log('\nFile inputs após clique:', JSON.stringify(inputsAfter));

  await browser.close();
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
