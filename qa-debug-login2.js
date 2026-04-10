const { chromium } = require('C:/Users/Notebook/node_modules/playwright');
const IPHONE14 = {
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  isMobile: true, hasTouch: true, deviceScaleFactor: 3,
};
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...IPHONE14, locale: 'pt-BR' });
  const page = await ctx.newPage();

  await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Clicar em "Usar e-mail e senha"
  await page.locator('button:has-text("e-mail e senha")').first().click();
  await page.waitForTimeout(600);

  // Clicar "Entrar" tab (primeiro com esse texto)
  await page.locator('button').filter({ hasText: /^Entrar$/ }).first().click();
  await page.waitForTimeout(300);

  // Preencher
  await page.locator('input[type="email"]').first().fill('test-mobile-qa@tamowork.test');
  await page.locator('input[type="password"]').first().fill('TestQA2026!');

  await page.screenshot({ path: 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/debug-login-ready.png' });

  // Submit via form button
  const submitBtn = page.locator('form button').filter({ hasText: /^Entrar$/ }).first();
  console.log('Submit btn count:', await submitBtn.count());
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
  } else {
    await page.locator('input[type="password"]').first().press('Enter');
  }

  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/debug-login-done.png' });
  await browser.close();
}
main().catch(console.error);
