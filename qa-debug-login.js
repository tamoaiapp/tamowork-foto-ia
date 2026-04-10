const { chromium } = require('C:/Users/Notebook/node_modules/playwright');

const IPHONE14 = {
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...IPHONE14, locale: 'pt-BR' });
  const page = await ctx.newPage();

  await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/debug-01-initial.png' });

  // Clicar em "Usar e-mail e senha"
  const emailToggle = page.locator('button:has-text("e-mail e senha")').first();
  console.log('emailToggle count:', await emailToggle.count());
  if (await emailToggle.count() > 0) {
    await emailToggle.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/debug-02-after-toggle.png' });

  // Log all buttons visible
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons);

  // Log all inputs
  const inputCount = await page.locator('input').count();
  console.log('Input count:', inputCount);
  for (let i = 0; i < inputCount; i++) {
    const inp = page.locator('input').nth(i);
    const type = await inp.getAttribute('type');
    const visible = await inp.isVisible();
    console.log(`  Input ${i}: type=${type} visible=${visible}`);
  }

  // Clicar em "Criar conta"
  const criarBtn = page.locator('button:has-text("Criar conta")').first();
  console.log('Criar conta count:', await criarBtn.count());
  if (await criarBtn.count() > 0) {
    await criarBtn.click();
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/debug-03-criar-conta.png' });

  // Fill email/pass
  await page.locator('input[type="email"]').fill('test-mobile-qa@tamowork.test');
  await page.locator('input[type="password"]').fill('TestQA2026!');
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/debug-04-after-submit.png' });
  console.log('URL after signup:', page.url());

  // Read page text for errors
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text:', bodyText.slice(0, 500));

  // Check if showEmail is still shown
  const inputs2 = await page.locator('input').count();
  console.log('Inputs after submit:', inputs2);

  await browser.close();
}

main().catch(console.error);
