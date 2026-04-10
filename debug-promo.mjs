import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import https from 'https'

const EMAIL = 'test-stress-d4@tamowork.test'
const PASSWORD = 'StressD4@2026'
const PERFUME_URL = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800'
const SCREENSHOT_DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d4'

async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    const get = (u) => https.get(u, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        get(res.headers.location)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', reject)
    }).on('error', reject)
    get(url)
  })
}

const br = await chromium.launch({ headless: true })
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

// Login
await page.goto('https://tamowork.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2000)
await page.locator('button').filter({ hasText: /e-mail e senha/i }).first().click()
await page.waitForTimeout(1000)
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.locator('button').filter({ hasText: /^Entrar$/ }).last().click()
await page.waitForTimeout(5000)

// Vai para home
await page.goto('https://tamowork.com/', { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.waitForTimeout(3000)

// Clica em POST DE PROMOÇÃO
const promoDiv = page.locator('div[style*="cursor"]').filter({ hasText: /POST DE PROMOÇÃO/i }).first()
await promoDiv.click()
await page.waitForTimeout(2000)
await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_promo_form.png') })

const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Promo form body:', bodyText.substring(0, 600))

const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('input')].map(e => ({
    type: e.type, placeholder: e.placeholder, value: e.value
  }))
)
console.log('Inputs in promo:', JSON.stringify(inputs, null, 2))

const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(e => ({
    type: e.type, text: e.innerText.trim().substring(0, 50), disabled: e.disabled
  }))
)
console.log('Buttons in promo:', JSON.stringify(buttons, null, 2))

// Download perfume
const imgPath = path.join(SCREENSHOT_DIR, 'perfume_test.jpg')
if (!fs.existsSync(imgPath)) {
  console.log('Baixando perfume...')
  await downloadImage(PERFUME_URL, imgPath)
}

// Upload
const uploadInput = page.locator('input[type="file"]').first()
await uploadInput.setInputFiles(imgPath)
await page.waitForTimeout(1000)
await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_promo_uploaded.png') })

// Preenche campos
const allInputs = page.locator('input[type="text"], input:not([type="file"])')
const inputCount = await allInputs.count()
console.log('Text inputs count:', inputCount)
for (let i = 0; i < inputCount; i++) {
  const ph = await allInputs.nth(i).getAttribute('placeholder').catch(() => '')
  console.log(`  Input ${i}: placeholder="${ph}"`)
}

// Preenche nome
const nomeInput = page.locator('input[placeholder*="Tênis" i], input[placeholder*="produto" i], input[placeholder*="nome" i]').first()
if (await nomeInput.isVisible().catch(() => false)) {
  await nomeInput.fill('Perfume floral feminino')
  console.log('Nome preenchido')
}

// Preenche preço atual
const precoInput = page.locator('input[placeholder*="R$" i]').last()
if (await precoInput.isVisible().catch(() => false)) {
  await precoInput.fill('R$ 189,90')
  console.log('Preco preenchido')
}

await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_promo_filled.png') })

const buttons2 = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(e => ({
    type: e.type, text: e.innerText.trim().substring(0, 50), disabled: e.disabled
  }))
)
console.log('Buttons after fill:', JSON.stringify(buttons2, null, 2))

// Verifica preview
const hasPreview = await page.locator('img[alt="produto"], img[src*="blob"]').first().isVisible().catch(() => false)
console.log('Preview visível:', hasPreview)

await br.close()
