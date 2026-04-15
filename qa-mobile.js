const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile-qa';
fs.mkdirSync(DIR, { recursive: true });

const issues = [];
const log = (msg) => { console.log(msg); };

async function shot(page, name) {
  const p = path.join(DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  log(`📸 ${name}`);
}

async function checkPage(page, name) {
  const scrollW = await page.evaluate(() => document.body.scrollWidth);
  const viewW = await page.evaluate(() => window.innerWidth);
  if (scrollW > viewW + 5) {
    issues.push(`[${name}] OVERFLOW: body=${scrollW}px > viewport=${viewW}px`);
  }

  const jsErr = [];
  page.once('pageerror', e => jsErr.push(e.message));

  // Checar elementos essenciais
  const bodyText = await page.textContent('body').catch(() => '');
  const chars = bodyText.length;
  log(`[${name}] chars=${chars}, scrollW=${scrollW}`);

  // Checar botões pequenos
  const smallBtns = await page.$$eval('button', btns =>
    btns.filter(b => {
      const r = b.getBoundingClientRect();
      return r.height > 0 && r.height < 36;
    }).map(b => b.textContent?.trim().substring(0,20))
  ).catch(() => []);
  if (smallBtns.filter(Boolean).length > 0) {
    log(`[${name}] Botões pequenos (<36px): ${smallBtns.filter(Boolean).join(', ')}`);
    issues.push(`[${name}] Botões pequenos: ${smallBtns.filter(Boolean).slice(0,3).join(', ')}`);
  }

  return { scrollW, chars };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // === IPHONE 390x844 ===
  log('\n=== iPhone 390x844 ===');
  const ctx1 = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'pt-BR',
    deviceScaleFactor: 3,
  });
  const p1 = await ctx1.newPage();
  const pageErrors1 = [];
  p1.on('pageerror', e => pageErrors1.push(`[JS] ${e.message.substring(0,100)}`));
  p1.on('console', m => { if (m.type() === 'error') pageErrors1.push(`[Console] ${m.text().substring(0,80)}`); });

  // /login
  await p1.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p1, '01-iphone-login-top');
  await p1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p1.waitForTimeout(500);
  await shot(p1, '02-iphone-login-bottom');
  await checkPage(p1, 'login-iphone');

  // Checar elementos do login
  const hasEmailInput = await p1.$('input[type="email"]') !== null;
  const hasPassInput = await p1.$('input[type="password"]') !== null;
  const hasGoogleBtn = !!(await p1.$('button:has-text("Google"), [aria-label*="Google"]'));
  const loginText = await p1.textContent('body');
  const hasLangSelector = loginText.includes('PT') || loginText.includes('EN');
  log(`[login] email=${hasEmailInput}, password=${hasPassInput}, google=${hasGoogleBtn}, langSelector=${hasLangSelector}`);
  if (!hasEmailInput) issues.push('[login] Input de email AUSENTE');
  if (!hasPassInput) issues.push('[login] Input de senha AUSENTE');
  if (!hasGoogleBtn) issues.push('[login] Botão Google AUSENTE');

  // /editor
  await p1.goto('https://tamowork.com/editor', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p1, '03-iphone-editor');
  await checkPage(p1, 'editor-iphone');

  // /criacoes
  await p1.goto('https://tamowork.com/criacoes', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p1, '04-iphone-criacoes');
  await checkPage(p1, 'criacoes-iphone');

  // /planos
  await p1.goto('https://tamowork.com/planos', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p1, '05-iphone-planos');
  await checkPage(p1, 'planos-iphone');

  // /conta
  await p1.goto('https://tamowork.com/conta', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p1, '06-iphone-conta');
  await checkPage(p1, 'conta-iphone');

  await ctx1.close();

  // === ANDROID 412x915 ===
  log('\n=== Android 412x915 ===');
  const ctx2 = await browser.newContext({
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    locale: 'pt-BR',
    deviceScaleFactor: 2.625,
  });
  const p2 = await ctx2.newPage();
  const pageErrors2 = [];
  p2.on('pageerror', e => pageErrors2.push(`[JS] ${e.message.substring(0,100)}`));

  // /login
  await p2.goto('https://tamowork.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p2, '07-android-login');
  await checkPage(p2, 'login-android');

  // Tela home (vai para login pois sem auth)
  await p2.goto('https://tamowork.com', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p2, '08-android-home');
  await checkPage(p2, 'home-android');

  // Scroll na home
  await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await p2.waitForTimeout(300);
  await shot(p2, '09-android-home-scroll-mid');
  await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p2.waitForTimeout(300);
  await shot(p2, '10-android-home-bottom');

  // /editor
  await p2.goto('https://tamowork.com/editor', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p2, '11-android-editor');
  await checkPage(p2, 'editor-android');

  // /planos no android
  await p2.goto('https://tamowork.com/planos', { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p2, '12-android-planos');
  await checkPage(p2, 'planos-android');

  await ctx2.close();

  // === RELATÓRIO FINAL ===
  log('\n========== RELATÓRIO FINAL ==========');
  log(`Total de issues: ${issues.length}`);
  if (issues.length === 0) {
    log('✅ NENHUM PROBLEMA ENCONTRADO — PASS');
  } else {
    issues.forEach(i => log(`❌ ${i}`));
  }
  log('Erros JS (iPhone): ' + (pageErrors1.length ? pageErrors1.slice(0,5).join(' | ') : 'nenhum'));
  log('Erros JS (Android): ' + (pageErrors2.length ? pageErrors2.slice(0,5).join(' | ') : 'nenhum'));
  log(`\nScreenshots salvas em: ${DIR}`);
  log('======================================');

  await browser.close();
})();
