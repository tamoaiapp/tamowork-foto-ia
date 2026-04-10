import { chromium } from 'playwright'

const br = await chromium.launch({ headless: true })
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(5000)
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_login.png' })

const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Body text:', bodyText.substring(0, 500))

const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('input')].map(e => ({
    type: e.type, name: e.name, placeholder: e.placeholder, id: e.id, className: e.className
  }))
)
console.log('Inputs:', JSON.stringify(inputs, null, 2))

const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(e => ({
    type: e.type, text: e.innerText.substring(0, 40)
  }))
)
console.log('Buttons:', JSON.stringify(buttons, null, 2))

await br.close()
