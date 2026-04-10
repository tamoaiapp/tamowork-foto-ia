import { chromium } from 'playwright'

const EMAIL = 'test-stress-d4@tamowork.test'
const PASSWORD = 'StressD4@2026'

const br = await chromium.launch({ headless: false }) // visível para debug
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Monitora navegação
page.on('response', async (res) => {
  if (res.url().includes('supabase') || res.url().includes('auth')) {
    console.log(`[RESP] ${res.status()} ${res.url().substring(0, 100)}`)
  }
})

await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2000)

const emailBtn = page.locator('button').filter({ hasText: /e-mail e senha/i }).first()
await emailBtn.click()
await page.waitForTimeout(1500)

console.log('Preenchendo campos...')
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_filled.png' })

console.log('Clicando Entrar...')
// Clica no botão submit que contém "Entrar" (não "Entrar com Google")
const entrarBtns = page.locator('button[type="submit"]')
const count = await entrarBtns.count()
console.log('Submit buttons count:', count)
for (let i = 0; i < count; i++) {
  const txt = await entrarBtns.nth(i).textContent()
  console.log(`  [${i}] "${txt}"`)
}

// Clica no "Entrar" que não seja Google
await page.locator('button').filter({ hasText: /^Entrar$/ }).last().click()
console.log('Clicou. Aguardando 10s...')
await page.waitForTimeout(10000)
await page.screenshot({ path: 'test-screenshots/stress-d4/debug_after_login.png' })
console.log('URL após login:', page.url())

await br.close()
