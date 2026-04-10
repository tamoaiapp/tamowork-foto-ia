import { chromium } from 'playwright'

const EMAIL = 'test-stress-d4@tamowork.test'
const PASSWORD = 'StressD4@2026'

const br = await chromium.launch({ headless: true })
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Login
await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2000)

const emailBtn = page.locator('button').filter({ hasText: /e-mail e senha/i }).first()
await emailBtn.click()
await page.waitForTimeout(1000)

await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.locator('button').filter({ hasText: /^Entrar$/ }).first().click()

// Aguarda saída do login
await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 20000 })
console.log('Logado. URL:', page.url())
await page.waitForTimeout(5000)
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_home.png' })

// Texto geral
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Home (1000 chars):', bodyText.substring(0, 1000))

// Todos os botões
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(e => e.innerText.trim().substring(0, 50))
)
console.log('\nButtons:', JSON.stringify(buttons))

// Clica em promoção para ver form
const promoBtn = [...await page.$$('div, button')].find ? null : null
// Encontra pela busca de texto
const allDivs = await page.evaluate(() =>
  [...document.querySelectorAll('div')].filter(e => /promoção|promo/i.test(e.innerText) && e.innerText.length < 200).map(e => ({
    text: e.innerText.substring(0, 80),
    role: e.getAttribute('role'),
    style: (e.getAttribute('style') || '').substring(0, 60)
  }))
)
console.log('\nDivs com promo:', JSON.stringify(allDivs.slice(0, 5), null, 2))

await br.close()
