const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });

  const url = page.url();
  console.log('URL final:', url);

  const inputs = await page.$$eval('input', els => els.map(e => ({ type: e.type, placeholder: e.placeholder, name: e.name, id: e.id })));
  console.log('Inputs encontrados:', JSON.stringify(inputs, null, 2));

  const btns = await page.$$eval('button', els => els.map(e => ({ text: e.textContent.trim().substring(0,50), h: Math.round(e.getBoundingClientRect().height) })));
  console.log('Botoes encontrados:', JSON.stringify(btns, null, 2));

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log('scrollHeight da pagina de login:', scrollHeight);

  const headings = await page.$$eval('h1, h2, h3, h4', els => els.map(e => e.textContent.trim().substring(0, 80)));
  console.log('Titulos na pagina:', JSON.stringify(headings, null, 2));

  // Verificar se "Usar e-mail e senha" expande form ou navega
  const usarEmailBtn = await page.$('button:has-text("Usar e-mail")');
  if (usarEmailBtn) {
    console.log('Botao "Usar e-mail e senha" encontrado, clicando...');
    await usarEmailBtn.click();
    await page.waitForTimeout(1000);
    const inputsAfter = await page.$$eval('input', els => els.map(e => ({ type: e.type, placeholder: e.placeholder })));
    console.log('Inputs apos click:', JSON.stringify(inputsAfter));
    const urlAfter = page.url();
    console.log('URL apos click:', urlAfter);
  }

  // Verificar o carrossel / slider
  const carouselIndicators = await page.$$eval('[class*="carousel"], [class*="slider"], [class*="swiper"]', els => els.length);
  console.log('Elementos carrossel:', carouselIndicators);

  // Verificar badge "1/4" - há mais conteudo?
  const badge14 = await page.$eval('*', el => {
    const all = Array.from(document.querySelectorAll('*'));
    const found = all.find(e => e.textContent.trim() === '1/4' && !e.children.length);
    return found ? found.outerHTML : null;
  }).catch(() => null);
  console.log('Badge 1/4:', badge14);

  await browser.close();
})();
