/**
 * debug-upload-m2b.js — Debug do fluxo após clicar "Usar agora" no modo foto_em_cena
 */
const { chromium } = require('C:/Users/Notebook/node_modules/playwright');
const fs = require('fs');

const EMAIL = 'test-stress-m2@tamowork.test';
const PASSWORD = 'StressM2@2026';
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m2';
const IMG_PATH = `${SCREENSHOTS_DIR}/relogio-test.jpg`;

const PIXEL7 = {
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  hasTouch: true,
  isMobile: true,
};

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...PIXEL7, locale: 'pt-BR' });
  const page = await ctx.newPage();

  // Login
  await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const entrarTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first();
  if (await entrarTab.count() > 0) { await entrarTab.click(); await page.waitForTimeout(400); }

  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForTimeout(5000);

  if (page.url().includes('/onboarding')) {
    await page.evaluate(() => localStorage.setItem('tw_onboarding_done', '1'));
    await page.goto('https://tamowork.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  console.log('Logado:', page.url());

  // Encontrar "Foto em cena" card com "Usar agora"
  // A estrutura parece ser: section/div com texto "FOTO EM CENA" e botão "Usar agora"
  console.log('\n=== Procurando card Foto em cena ===');

  // Abordagem: clicar no "Usar agora" que está próximo ao texto "FOTO EM CENA"
  // Vamos usar :has() seletor
  const cards = page.locator('[class*="card"], [class*="mode"], section, div').filter({ hasText: /foto em cena/i });
  const cardCount = await cards.count();
  console.log(`Cards com "Foto em cena": ${cardCount}`);

  for (let i = 0; i < Math.min(cardCount, 5); i++) {
    const txt = await cards.nth(i).textContent();
    console.log(`  Card ${i}: "${txt?.trim()?.slice(0, 80)}"`);
  }

  // Tentar encontrar o botão "Usar agora" dentro do card "Foto em cena"
  // Como o texto inclui "FOTO EM CENA" + "Usar agora", podemos usar:
  const fotoEmCenaUsarBtn = page.locator(':has-text("FOTO EM CENA") button:has-text("Usar agora"), :has-text("Foto em cena") button:has-text("Usar agora")').first();
  const hasFotoBtn = await fotoEmCenaUsarBtn.count() > 0;
  console.log(`\nBotão "Usar agora" dentro de Foto em cena: ${hasFotoBtn}`);

  if (!hasFotoBtn) {
    // Identificar todos os "Usar agora" e clicar no 2º (índice 1) — FOTO EM CENA é o 2º card
    const usarAgoraBtns = page.locator('button:has-text("Usar agora")');
    const count = await usarAgoraBtns.count();
    console.log(`Total de "Usar agora": ${count}`);

    for (let i = 0; i < count; i++) {
      const txt = await usarAgoraBtns.nth(i).evaluate(el => {
        let parent = el;
        for (let j = 0; j < 5; j++) {
          parent = parent.parentElement;
          if (!parent) break;
          const text = parent.textContent?.trim();
          if (text && text.length < 200) return text;
        }
        return 'unknown';
      });
      console.log(`  Btn ${i}: contexto="${txt?.slice(0, 80)}"`);
    }

    // Clicar no índice 1 (2º = FOTO EM CENA)
    if (count >= 2) {
      console.log('\nClicando no 2º "Usar agora" (FOTO EM CENA)...');
      await usarAgoraBtns.nth(1).click();
    } else if (count >= 1) {
      await usarAgoraBtns.first().click();
    }
  } else {
    console.log('\nClicando no "Usar agora" do FOTO EM CENA...');
    await fotoEmCenaUsarBtn.click();
  }

  await page.waitForTimeout(2000);
  const urlAfter = page.url();
  console.log(`URL após clicar Usar agora: ${urlAfter}`);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-04-apos-usar-agora.png` });

  // Analisar a nova página
  const analysis = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      accept: i.accept,
      placeholder: i.placeholder,
      id: i.id,
      visible: window.getComputedStyle(i).display !== 'none',
    }));

    const pageText = document.body.innerText?.slice(0, 800);
    const h1 = document.querySelector('h1')?.textContent;
    const h2 = document.querySelector('h2')?.textContent;

    const clickableEls = Array.from(document.querySelectorAll('[onClick], button, [class*="upload"], [class*="drop"], [class*="picker"]')).map(el => ({
      tag: el.tagName,
      className: el.className?.slice(0, 80),
      text: el.textContent?.trim()?.slice(0, 50),
    })).slice(0, 20);

    return { inputs, pageText, h1, h2, clickableEls };
  });

  console.log('\n--- Inputs na nova tela ---');
  console.log(JSON.stringify(analysis.inputs, null, 2));
  console.log('\n--- H1/H2 ---');
  console.log('H1:', analysis.h1);
  console.log('H2:', analysis.h2);
  console.log('\n--- Page text ---');
  console.log(analysis.pageText);

  // Se há input[type=file], tentar upload
  const hasFileInput = analysis.inputs.some(i => i.type === 'file');
  console.log(`\nTem input[type=file]: ${hasFileInput}`);

  if (hasFileInput) {
    const fileInput = page.locator('input[type="file"]').first();
    try {
      await fileInput.setInputFiles(IMG_PATH);
      console.log('Upload feito!');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-05-upload-ok.png` });
    } catch(e) {
      console.log('Upload erro:', e.message);
    }
  } else {
    // Tentar clicar em algo para abrir o picker de arquivo
    console.log('\nSem input[type=file] direto. Tentando click...');
    const clickSelectors = [
      '[class*="upload"]', '[class*="drop"]', '[class*="picker"]',
      'button:has-text("Escolher"), button:has-text("Upload"), button:has-text("Foto")',
      '[class*="zone"]',
    ];

    for (const sel of clickSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
        console.log(`Tentando: ${sel}`);
        try {
          const [fc] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
            el.click(),
          ]);
          if (fc) {
            console.log(`Filechooser aberto!`);
            await fc.setFiles(IMG_PATH);
            console.log('Upload via filechooser OK!');
            await page.waitForTimeout(2000);
            break;
          }
        } catch(e) {
          console.log(`Erro em ${sel}: ${e.message}`);
        }
      }
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-05-sem-file-input.png` });
  }

  // Verificar se há inputs agora
  const inputsNow = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, accept: i.accept, placeholder: i.placeholder,
    }));
  });
  console.log('\nInputs agora:', JSON.stringify(inputsNow));

  await browser.close();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
