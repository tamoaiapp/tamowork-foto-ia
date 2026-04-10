import { chromium } from 'playwright'
import fs from 'fs'

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

await page.waitForURL(url => !url.includes('/login'), { timeout: 20000 })
console.log('Logado. URL:', page.url())
await page.waitForTimeout(3000)
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_home.png' })

// Examina o menu
const cards = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="mode"], div[style*="cursor"]')].slice(0, 20).map(e => ({
    text: e.innerText.substring(0, 80),
    className: e.className.substring(0, 60),
  }))
)
console.log('Mode cards:', JSON.stringify(cards, null, 2))

// Texto geral da home
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('\nHome body (500 chars):', bodyText.substring(0, 500))

await br.close()
