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

  // === LOGIN COM EMAIL EXPANDIDO ===
  await page.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  const usarEmailBtn = await page.$('button:has-text("Usar e-mail")');
  await usarEmailBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(DIR, '13-iphone-login-email-expandido.png'), fullPage: true });
  console.log('Screenshot 13: login com form email expandido');

  // Verificar tamanho dos inputs e botão
  const formDetails = await page.$$eval('input, button', els => els.map(e => {
    const r = e.getBoundingClientRect();
    return { tag: e.tagName, type: e.getAttribute('type'), text: e.textContent.trim().substring(0,30), h: Math.round(r.height), w: Math.round(r.width) };
  }));
  console.log('Form details:', JSON.stringify(formDetails, null, 2));

  // Scroll para ver se tem conteudo abaixo dos inputs
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR, '14-iphone-login-email-scroll-baixo.png'), fullPage: true });
  console.log('Screenshot 14: login email scroll baixo');

  // === SCROLL COMPLETO DA PÁGINA DE LOGIN (sem expandir email) ===
  await page.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Scroll por partes para capturar o carrossel de casos de uso
  for (let i = 1; i <= 5; i++) {
    await page.evaluate((step) => window.scrollTo(0, step * 200), i);
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(DIR, '15-iphone-login-scroll-carousel.png'), fullPage: true });
  console.log('Screenshot 15: tentando ver mais do carrossel');

  // Verificar o carousel JS
  const carouselInfo = await page.evaluate(() => {
    // Verificar se há intervalos de auto-scroll
    const allDivs = document.querySelectorAll('div');
    const scrollableDivs = [];
    allDivs.forEach(d => {
      const style = window.getComputedStyle(d);
      if (style.overflow === 'hidden' || style.overflowX === 'hidden') {
        const rect = d.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          scrollableDivs.push({ className: d.className.substring(0,50), w: Math.round(rect.width), h: Math.round(rect.height) });
        }
      }
    });
    return scrollableDivs.slice(0, 10);
  });
  console.log('Divs com overflow hidden:', JSON.stringify(carouselInfo, null, 2));

  // === PLANOS — verificar se está redirecionando para /login ===
  console.log('\n--- Testando /planos ---');
  await page.goto('https://tamowork.com/planos', { waitUntil: 'networkidle', timeout: 30000 });
  const planoUrl = page.url();
  console.log('URL em /planos:', planoUrl);
  const planoTitle = await page.title();
  console.log('Título em /planos:', planoTitle);
  const planoH1 = await page.$$eval('h1, h2', els => els.map(e => e.textContent.trim().substring(0,80)));
  console.log('Títulos em /planos:', JSON.stringify(planoH1));

  // === CRIACOES — verificar se está redirecionando para /login ===
  console.log('\n--- Testando /criacoes ---');
  await page.goto('https://tamowork.com/criacoes', { waitUntil: 'networkidle', timeout: 30000 });
  const criacoesUrl = page.url();
  console.log('URL em /criacoes:', criacoesUrl);

  // === EDITOR — verificar bottom nav ===
  console.log('\n--- Testando /editor ---');
  await page.goto('https://tamowork.com/editor', { waitUntil: 'networkidle', timeout: 30000 });
  const navItems = await page.$$eval('nav a, nav button, [class*="bottom"] a, [class*="tab"] a', els =>
    els.map(e => ({ text: e.textContent.trim().substring(0,30), h: Math.round(e.getBoundingClientRect().height) }))
  );
  console.log('Nav items no editor:', JSON.stringify(navItems, null, 2));

  // Verificar a barra inferior
  const bottomNav = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.position === 'fixed' && rect.bottom >= window.innerHeight - 5) {
        return { className: el.className.substring(0,80), h: Math.round(rect.height), tag: el.tagName };
      }
    }
    return null;
  });
  console.log('Bottom nav fixo:', JSON.stringify(bottomNav));

  // Botao de idioma — tamanho real
  await page.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  const langBtnSize = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent.includes('PT')) {
        const r = btn.getBoundingClientRect();
        return { text: btn.textContent.trim(), h: r.height, w: r.width, top: r.top, right: r.right };
      }
    }
    return null;
  });
  console.log('\nBotao idioma detalhe:', JSON.stringify(langBtnSize));

  await browser.close();
  console.log('\nDone.');
})();
