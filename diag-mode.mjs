import { chromium } from 'playwright';

const EMAIL = 'test-stress-d5@tamowork.test';
const PASSWORD = 'StressD5@2026';
const BASE_URL = 'https://tamowork.com';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const emailToggle = page.locator('text=Usar e-mail e senha');
  if (await emailToggle.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailToggle.click();
    await page.waitForTimeout(800);
  }
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  if (page.url().includes('/onboarding')) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  await page.waitForSelector('text=Usar agora', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Listar TODOS os botões "Usar agora" e seus contextos
  const usarBtns = page.locator('button').filter({ hasText: 'Usar agora' });
  const count = await usarBtns.count();
  console.log(`Total botões "Usar agora": ${count}`);

  for (let i = 0; i < count; i++) {
    const btn = usarBtns.nth(i);
    const context = await btn.evaluate(el => {
      let node = el;
      const results = [];
      for (let j = 0; j < 10; j++) {
        if (node.parentElement) node = node.parentElement;
        const t = (node.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 120);
        results.push({ level: j, len: t.length, text: t });
        if (t.length > 50 && t.length < 300) break;
      }
      return results;
    });
    console.log(`\nBotão ${i}:`);
    context.forEach(c => console.log(`  Level ${c.level} (len=${c.len}): "${c.text}"`));
  }

  // Verificar corpo completo para texto de modos
  const bodyText = await page.textContent('body');
  const hasCustom = bodyText.includes('Do meu jeito') || bodyText.includes('Personalizado');
  console.log(`\nTexto "Do meu jeito" na página: ${hasCustom}`);

  // Achar o índice do botão do personalizado procurando diferente
  for (let i = 0; i < count; i++) {
    const btn = usarBtns.nth(i);
    const nearbyText = await btn.evaluate(el => {
      // Pegar apenas o container imediato (pai, avô)
      const p1 = el.parentElement?.textContent?.replace(/\s+/g, ' ').trim().substring(0, 200) || '';
      const p2 = el.parentElement?.parentElement?.textContent?.replace(/\s+/g, ' ').trim().substring(0, 200) || '';
      return { p1, p2 };
    });
    const isCustom = nearbyText.p1.includes('Do meu jeito') || nearbyText.p2.includes('Do meu jeito') ||
                     nearbyText.p1.includes('Personalizado') || nearbyText.p2.includes('Personalizado') ||
                     nearbyText.p1.includes('livremente') || nearbyText.p2.includes('livremente');
    console.log(`Btn ${i} isCustom=${isCustom}: p1="${nearbyText.p1.substring(0,60)}" | p2="${nearbyText.p2.substring(0,60)}"`);
  }

  // Screenshot
  await page.screenshot({ path: 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d5/diag-home.png' });
  console.log('\nScreenshot salvo: diag-home.png');

  // Verificar se clicar no modo custom abre cenário input
  console.log('\n--- Testando click no botão correto ---');
  // Tentar encontrar pelo texto do card pai que seja pequeno
  for (let i = 0; i < count; i++) {
    const btn = usarBtns.nth(i);
    const directParent = await btn.evaluate(el => {
      return (el.parentElement?.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80);
    });
    if (directParent.includes('Do meu jeito') || directParent.includes('jeito')) {
      console.log(`\nClicando no botão ${i} (parent: "${directParent}")...`);
      await btn.click();
      await page.waitForTimeout(2000);

      // Contar inputs
      const inputs = await page.locator('input[type="text"]').count();
      const fileInputs = await page.locator('input[type="file"]').count();
      console.log(`Inputs text: ${inputs} | file: ${fileInputs}`);

      // Pegar placeholders
      const placeholders = await page.$$eval('input[type="text"]', els =>
        els.map(e => ({ ph: e.placeholder, visible: e.offsetParent !== null }))
      );
      console.log('Placeholders:', JSON.stringify(placeholders));

      await page.screenshot({ path: 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d5/diag-after-custom.png' });
      break;
    }
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
