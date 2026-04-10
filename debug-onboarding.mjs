import { chromium } from 'playwright'

const EMAIL = 'test-stress-d4@tamowork.test'
const PASSWORD = 'StressD4@2026'

const br = await chromium.launch({ headless: true })
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2000)
await page.locator('button').filter({ hasText: /e-mail e senha/i }).first().click()
await page.waitForTimeout(1000)
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.locator('button').filter({ hasText: /^Entrar$/ }).last().click()
await page.waitForTimeout(8000)

console.log('URL:', page.url())
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_onboarding.png' })

const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Body:', bodyText.substring(0, 800))

const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(e => e.innerText.trim().substring(0, 50))
)
console.log('Buttons:', JSON.stringify(buttons))

// Tenta navegar para home direto
await page.goto('https://tamowork.com', { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.waitForTimeout(5000)
console.log('URL home:', page.url())
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_home_direct.png' })

const homeText = await page.evaluate(() => document.body.innerText)
console.log('Home body:', homeText.substring(0, 600))

const homeButtons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(e => e.innerText.trim().substring(0, 50))
)
console.log('Home buttons:', JSON.stringify(homeButtons))

// Verifica se existe .mode-selector
const modeSelector = await page.$('.mode-selector')
console.log('mode-selector existe:', !!modeSelector)

// Clica num card qualquer
const allClickable = await page.evaluate(() =>
  [...document.querySelectorAll('div[style*="cursor: pointer"], div[style*="cursor:pointer"]')]
    .slice(0, 10).map(e => ({ text: e.innerText.substring(0, 50), style: e.getAttribute('style').substring(0, 80) }))
)
console.log('Clickable divs:', JSON.stringify(allClickable, null, 2))

await br.close()
