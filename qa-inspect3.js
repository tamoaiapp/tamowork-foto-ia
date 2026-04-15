const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile-qa';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'pt-BR',
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();

  // Login com form email expandido — inspecionar links "Entrar" vs "Criar conta" e "esqueci"
  await page.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  const usarEmailBtn = await page.$('button:has-text("Usar e-mail")');
  await usarEmailBtn.click();
  await page.waitForTimeout(800);

  // Checar links de esqueci senha e criar conta
  const links = await page.$$eval('a', els => els.map(e => ({ text: e.textContent.trim().substring(0,50), href: e.href })));
  console.log('Links na pagina de login:', JSON.stringify(links, null, 2));

  // Checar se ha link "esqueci minha senha"
  const bodyText = await page.textContent('body');
  const hasEsqueci = bodyText.toLowerCase().includes('esqueci') || bodyText.toLowerCase().includes('forgot') || bodyText.toLowerCase().includes('redefinir');
  console.log('Tem link "esqueci senha":', hasEsqueci);
  console.log('Trecho relevante:', bodyText.substring(bodyText.toLowerCase().indexOf('entrar'), bodyText.toLowerCase().indexOf('entrar') + 200));

  // Verificar aba "Criar conta" - clicar nela
  const criarContaBtn = await page.$('button:has-text("Criar conta")');
  if (criarContaBtn) {
    await criarContaBtn.click();
    await page.waitForTimeout(800);
    const inputsCriar = await page.$$eval('input', els => els.map(e => ({ type: e.type, placeholder: e.placeholder })));
    console.log('Inputs em Criar conta:', JSON.stringify(inputsCriar));
    await page.screenshot({ path: path.join(DIR, '16-iphone-login-criar-conta.png'), fullPage: false });
    console.log('Screenshot 16: criar conta');
  }

  // Verificar carrossel — quantos slides existem?
  await page.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  const slides = await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="case"], [class*="slide"], [class*="item"]');
    return Array.from(items).map(el => ({
      className: el.className.substring(0,50),
      text: el.textContent.trim().substring(0,50),
      visible: el.getBoundingClientRect().width > 0
    }));
  });
  console.log('\nPossíveis slides:', JSON.stringify(slides.slice(0,10), null, 2));

  // Verificar o carrossel em detalhe — elemento pai do badge 1/4
  const carouselData = await page.evaluate(() => {
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      if (span.textContent.trim() === '1/4') {
        let parent = span.parentElement;
        let info = [];
        for (let i = 0; i < 5; i++) {
          if (!parent) break;
          const rect = parent.getBoundingClientRect();
          info.push({ tag: parent.tagName, className: parent.className.substring(0,60), w: Math.round(rect.width), h: Math.round(rect.height), children: parent.children.length });
          parent = parent.parentElement;
        }
        return info;
      }
    }
    return null;
  });
  console.log('\nEstrutura do carrossel:', JSON.stringify(carouselData, null, 2));

  // Verificar se pagina de /planos tem conteudo proprio ou so redireciona
  console.log('\n--- /planos acesso com usuario logado simulado ---');
  // Verificar o que o servidor retorna
  const response = await page.goto('https://tamowork.com/planos', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Status HTTP /planos:', response.status());
  const finalUrl = page.url();
  console.log('URL final /planos:', finalUrl);

  await browser.close();
  console.log('Done.');
})();
