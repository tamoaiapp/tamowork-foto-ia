/**
 * stress-test-m5.js — TamoWork Foto IA Stress Test
 * Samsung Galaxy S23 (360x780) — Modo CUSTOM (prompt livre)
 * Imagem: tenis esportivo Unsplash
 *
 * Testes:
 *  - 5x foto: login → custom → upload → produto + prompt → gera → tempo
 *  - 2x video: tempo
 *  - Checks Samsung/Android: teclado, upload, botoes, BottomNav
 *  - Stress simultaneo: 2 jobs ao mesmo tempo
 */

const { chromium } = require('C:/Users/Notebook/node_modules/playwright')
const https = require('https')
const fs = require('fs')
const path = require('path')

// ─── Config ──────────────────────────────────────────────────────────────────
const APP_URL = 'https://tamowork.com'
const EMAIL = 'test-stress-m5@tamowork.test'
const PASSWORD = 'StressM5@2026'
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m5'
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'

// Samsung Galaxy S23
const SAMSUNG_S23 = {
  viewport: { width: 360, height: 780 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
}

const IMAGE_URL = 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800'

// ─── Utils ────────────────────────────────────────────────────────────────────
let stepNum = 0
const results = []
const photoTimings = []
const videoTimings = []
const startTime = Date.now()

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

function result(ok, label, detail = '') {
  const icon = ok ? 'OK' : 'FAIL'
  const line = `[${icon}] ${label}${detail ? ' — ' + detail : ''}`
  results.push(line)
  console.log(line)
}

async function screenshot(page, name) {
  stepNum++
  const file = path.join(SCREENSHOTS_DIR, `${String(stepNum).padStart(3, '0')}-${name}.png`)
  try {
    await page.screenshot({ path: file, fullPage: false })
    log(`Screenshot: ${path.basename(file)}`)
  } catch (e) {
    log(`Screenshot falhou: ${e.message}`)
  }
  return file
}

function supaReq(method, endpoint, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const url = new URL(SUPABASE_URL + endpoint)
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...extraHeaders,
      },
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── Download imagem de teste ─────────────────────────────────────────────────
async function downloadTestImage() {
  const imgPath = path.join(SCREENSHOTS_DIR, 'test-tenis.jpg')
  if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 5000) {
    log(`Imagem ja existe: ${imgPath}`)
    return imgPath
  }
  log(`Baixando imagem de tenis: ${IMAGE_URL}`)
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath)
    https.get(IMAGE_URL, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          res2.pipe(file)
          file.on('finish', () => { file.close(); resolve(imgPath) })
        }).on('error', reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(imgPath) })
    }).on('error', (err) => {
      fs.unlink(imgPath, () => {})
      reject(err)
    })
  })
}

// ─── Criar novo browser context mobile ────────────────────────────────────────
async function createMobileContext(browser) {
  return browser.newContext({
    ...SAMSUNG_S23,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  })
}

// ─── Login ─────────────────────────────────────────────────────────────────────
async function doLogin(page, runLabel = '') {
  log(`[${runLabel}] Navegando para login...`)
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  await screenshot(page, `${runLabel}-01-login-page`)

  // Abrir form de email se necessário
  const emailToggle = page.locator('button:has-text("e-mail"), button:has-text("email"), button:has-text("Usar e-mail")').first()
  if (await emailToggle.count() > 0 && await emailToggle.isVisible().catch(() => false)) {
    await emailToggle.click()
    await page.waitForTimeout(500)
  }

  // Clicar na aba "Entrar" se existir (vs "Criar conta")
  const entrarTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first()
  if (await entrarTab.count() > 0) {
    await entrarTab.click()
    await page.waitForTimeout(300)
  }

  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await screenshot(page, `${runLabel}-02-login-filled`)

  // Submit
  const submitBtn = page.locator('form button').filter({ hasText: /^Entrar$/ }).first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
  } else {
    await page.locator('input[type="password"]').first().press('Enter')
  }

  await page.waitForTimeout(5000)
  let url = page.url()
  log(`[${runLabel}] URL pos-login: ${url}`)

  // Pular onboarding
  if (url.includes('/onboarding')) {
    for (let i = 0; i < 6; i++) {
      const skipBtn = page.locator('button').filter({ hasText: /pular|testar grátis|try for free|skip/i }).first()
      if (await skipBtn.count() > 0 && await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(1500)
      }
      if (!page.url().includes('/onboarding')) break
      // fallback JS
      await page.evaluate(() => { localStorage.setItem('tw_onboarding_done', '1') })
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(2000)
      break
    }
    url = page.url()
  }

  const loggedIn = !url.includes('/login')
  log(`[${runLabel}] Login: ${loggedIn ? 'OK' : 'FALHOU'} (${url})`)
  return loggedIn
}

// ─── Check Samsung-specific layout ────────────────────────────────────────────
async function checkSamsungLayout(page, runLabel) {
  log(`\n[${runLabel}] === CHECK LAYOUT SAMSUNG ===`)

  // 1. BottomNav presente e fixo
  const bottomNavOk = await page.evaluate(() => {
    const elems = document.querySelectorAll('*')
    for (const el of elems) {
      const st = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (st.position === 'fixed' && rect.bottom >= window.innerHeight - 5 && rect.height > 40 && rect.height < 130) return true
    }
    return false
  })
  result(bottomNavOk, `[${runLabel}] BottomNav fixo presente`, bottomNavOk ? 'OK' : 'NAO ENCONTRADO')

  // 2. Sidebar NAO visivel
  const sidebarVisible = await page.evaluate(() => {
    const sels = ['aside', '[class*="sidebar"]', '[class*="Sidebar"]', '[class*="DesktopNav"]']
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const st = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        if (st.display !== 'none' && st.visibility !== 'hidden' && rect.width > 60 && rect.height > 100) return true
      }
    }
    return false
  })
  result(!sidebarVisible, `[${runLabel}] Sidebar NAO visivel no mobile`, sidebarVisible ? 'BUG: visivel!' : 'correto')

  // 3. Viewport fit — conteudo nao ultrapassa viewport
  const overflowOk = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth + 5
  })
  result(overflowOk, `[${runLabel}] Sem overflow horizontal`, overflowOk ? 'OK' : 'BUG: overflow')

  // 4. Botao Gerar visivel (nao escondido pelo teclado)
  const gerarBtnVisible = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    const gerar = buttons.find(b => /gerar|criar|generate/i.test(b.textContent || ''))
    if (!gerar) return null
    const rect = gerar.getBoundingClientRect()
    return { visible: rect.height > 0 && rect.width > 0, y: Math.round(rect.y), h: Math.round(rect.height) }
  })
  if (gerarBtnVisible) {
    result(gerarBtnVisible.visible, `[${runLabel}] Botao Gerar visivel`, `y=${gerarBtnVisible.y}, h=${gerarBtnVisible.h}`)
  } else {
    log(`[${runLabel}] Botao Gerar nao encontrado neste momento`)
  }

  await screenshot(page, `${runLabel}-layout-check`)
}

// ─── Selecionar modo CUSTOM ────────────────────────────────────────────────────
async function selectCustomMode(page, runLabel) {
  log(`[${runLabel}] Selecionando modo Custom...`)
  await page.waitForTimeout(1000)

  // Tentar clicar no card "Custom" ou "Personalizado"
  const customSelectors = [
    'button:has-text("Custom")',
    'button:has-text("Personalizado")',
    '[class*="mode"]:has-text("Custom")',
    '[class*="card"]:has-text("Custom")',
    'div:has-text("Custom")',
  ]

  let clicked = false
  for (const sel of customSelectors) {
    const el = page.locator(sel).first()
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.click()
      clicked = true
      log(`[${runLabel}] Clicou em Custom via: ${sel}`)
      break
    }
  }

  if (!clicked) {
    // Tentar pelo texto exato
    const allCards = page.locator('[class*="mode"], [class*="card"], div[role="button"]')
    const count = await allCards.count()
    log(`[${runLabel}] ${count} cards encontrados, tentando encontrar Custom...`)
    for (let i = 0; i < count; i++) {
      const text = await allCards.nth(i).textContent().catch(() => '')
      if (/custom|personaliz/i.test(text)) {
        await allCards.nth(i).click()
        clicked = true
        log(`[${runLabel}] Clicou em card #${i}: "${text.trim().slice(0, 30)}"`)
        break
      }
    }
  }

  if (!clicked) {
    log(`[${runLabel}] AVISO: nao encontrou card Custom — pode estar em outro lugar`)
  }

  await page.waitForTimeout(1000)
  await screenshot(page, `${runLabel}-custom-mode`)
  return clicked
}

// ─── Upload de imagem ──────────────────────────────────────────────────────────
async function uploadImage(page, imgPath, runLabel) {
  log(`[${runLabel}] Upload de imagem: ${path.basename(imgPath)}`)
  let uploadDone = false

  // Approach 1: setInputFiles direto
  const fileInputs = page.locator('input[type="file"]')
  const inputCount = await fileInputs.count()
  log(`[${runLabel}] ${inputCount} inputs type=file encontrados`)

  for (let i = 0; i < inputCount; i++) {
    try {
      await fileInputs.nth(i).setInputFiles(imgPath)
      uploadDone = true
      log(`[${runLabel}] Upload via input[${i}] OK`)
      break
    } catch (e) {
      log(`[${runLabel}] Input[${i}] falhou: ${e.message}`)
    }
  }

  if (!uploadDone) {
    // Approach 2: filechooser via dropzone click
    const dropzoneSelectors = [
      '[class*="drop"]', '[class*="upload"]', '[class*="picker"]',
      '[class*="Upload"]', '[class*="Drop"]',
    ]
    for (const sel of dropzoneSelectors) {
      const el = page.locator(sel).first()
      if (await el.count() > 0) {
        try {
          const [fc] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
            el.click(),
          ])
          if (fc) {
            await fc.setFiles(imgPath)
            uploadDone = true
            log(`[${runLabel}] Upload via filechooser OK (${sel})`)
            break
          }
        } catch (e) {
          log(`[${runLabel}] Filechooser ${sel} falhou: ${e.message}`)
        }
      }
    }
  }

  if (!uploadDone) {
    // Approach 3: DataTransfer via evaluate
    log(`[${runLabel}] Tentando upload via DataTransfer evaluate...`)
    const imgBase64 = fs.readFileSync(imgPath).toString('base64')
    uploadDone = await page.evaluate(async (b64) => {
      const inputs = document.querySelectorAll('input[type="file"]')
      if (!inputs.length) return false
      const bStr = atob(b64)
      const ab = new ArrayBuffer(bStr.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < bStr.length; i++) ia[i] = bStr.charCodeAt(i)
      const blob = new Blob([ab], { type: 'image/jpeg' })
      const file = new File([blob], 'tenis.jpg', { type: 'image/jpeg' })
      const dt = new DataTransfer()
      dt.items.add(file)
      inputs[0].files = dt.files
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, imgBase64)
    if (uploadDone) log(`[${runLabel}] Upload via DataTransfer OK`)
  }

  await page.waitForTimeout(2000)
  await screenshot(page, `${runLabel}-upload`)
  return uploadDone
}

// ─── Preencher campos e submeter ────────────────────────────────────────────────
async function fillAndSubmit(page, runLabel, isVideo = false) {
  log(`[${runLabel}] Preenchendo campos...`)

  // Campo produto
  const produtoSelectors = [
    'input[placeholder*="produto"]',
    'input[placeholder*="Product"]',
    'input[placeholder*="product"]',
    'textarea[placeholder*="produto"]',
    'input[name="product"]',
    'input[name="produto"]',
  ]
  let produtoFilled = false
  for (const sel of produtoSelectors) {
    const el = page.locator(sel).first()
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.fill('Tenis esportivo Nike branco')
      produtoFilled = true
      log(`[${runLabel}] Campo produto preenchido via ${sel}`)
      break
    }
  }

  // Campo prompt livre / custom
  const promptSelectors = [
    'textarea[placeholder*="prompt"]',
    'textarea[placeholder*="descri"]',
    'textarea[placeholder*="cenário"]',
    'textarea[placeholder*="scene"]',
    'input[placeholder*="prompt"]',
    'textarea',
  ]
  let promptFilled = false
  for (const sel of promptSelectors) {
    const el = page.locator(sel).first()
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      const val = await el.inputValue().catch(() => '')
      if (!val) {
        await el.fill('Foto profissional de tenis esportivo em fundo branco clean, luz de estudio suave, sombra minima, produto centrado')
        promptFilled = true
        log(`[${runLabel}] Prompt preenchido via ${sel}`)
        break
      } else {
        promptFilled = true
        log(`[${runLabel}] Prompt ja tem valor: "${val.slice(0, 40)}"`)
        break
      }
    }
  }

  await screenshot(page, `${runLabel}-campos-preenchidos`)

  // Verificar se botao Gerar nao esta escondido pelo teclado
  const btnCheck = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    const gerar = buttons.find(b => /gerar|criar|generate/i.test(b.textContent || ''))
    if (!gerar) return { found: false }
    const rect = gerar.getBoundingClientRect()
    const vh = window.innerHeight
    return {
      found: true,
      visible: rect.top < vh && rect.bottom > 0,
      aboveViewport: rect.bottom < 0,
      belowViewport: rect.top > vh,
      y: Math.round(rect.y),
      viewportH: vh,
    }
  })
  log(`[${runLabel}] Botao Gerar check: ${JSON.stringify(btnCheck)}`)
  result(
    btnCheck.found && btnCheck.visible,
    `[${runLabel}] Botao Gerar visivel (nao escondido pelo teclado)`,
    btnCheck.found ? `y=${btnCheck.y}, vh=${btnCheck.viewportH}` : 'botao nao encontrado'
  )

  // Clicar fora para fechar teclado (simular tap fora do input)
  await page.mouse.click(180, 100)
  await page.waitForTimeout(500)

  // Submeter
  const gerarBtnSelectors = [
    'form button[type="submit"]',
    'button:has-text("Gerar")',
    'button:has-text("Criar foto")',
    'button:has-text("Criar imagem")',
    'button:has-text("Criar")',
    'button:has-text("Generate")',
  ]

  let gerarBtn = null
  for (const sel of gerarBtnSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
      gerarBtn = btn
      const txt = await btn.textContent().catch(() => '')
      log(`[${runLabel}] Botao submit encontrado: "${txt.trim()}" via ${sel}`)
      break
    }
  }

  if (!gerarBtn) {
    log(`[${runLabel}] AVISO: botao submit nao encontrado`)
    return { submitted: false, jobStart: 0 }
  }

  const isDisabled = await gerarBtn.isDisabled().catch(() => false)
  if (isDisabled) {
    const btnTxt = await gerarBtn.textContent().catch(() => '')
    log(`[${runLabel}] Botao esta desabilitado: "${btnTxt.trim()}"`)
    await screenshot(page, `${runLabel}-btn-disabled`)
    result(true, `[${runLabel}] Botao Gerar desabilitado (rate limit ou erro)`, btnTxt.trim().slice(0, 60))
    return { submitted: false, jobStart: 0, disabled: true, btnText: btnTxt.trim() }
  }

  const jobStart = Date.now()
  await gerarBtn.click()
  log(`[${runLabel}] Job submetido!`)
  await page.waitForTimeout(2000)
  await screenshot(page, `${runLabel}-generating`)

  return { submitted: true, jobStart }
}

// ─── Aguardar resultado ────────────────────────────────────────────────────────
async function waitForResult(page, runLabel, jobStart, maxMinutes = 4) {
  log(`[${runLabel}] Aguardando resultado (max ${maxMinutes} min)...`)
  const maxMs = maxMinutes * 60 * 1000
  let jobDone = false
  let jobFailed = false
  let errorMsg = ''
  const iterations = Math.ceil(maxMs / 5000)

  for (let i = 0; i < iterations; i++) {
    await page.waitForTimeout(5000)

    const hasOutputImg = await page.locator('img[src*="image-jobs"], img[src*="output"], video[src*="jobs"]').count() > 0
    const pageContent = await page.content()
    const hasError = /algo deu errado|something went wrong|error|falhou|failed/i.test(pageContent)
    const stillWaiting = /gerando|processando|aguarde|generating|processing/i.test(pageContent)

    if (hasOutputImg && !stillWaiting) {
      const elapsed = Math.round((Date.now() - jobStart) / 1000)
      log(`[${runLabel}] SUCESSO! Tempo: ${elapsed}s`)
      jobDone = true
      await screenshot(page, `${runLabel}-result-done`)
      return { done: true, failed: false, elapsed, error: '' }
    }

    if (hasError && !stillWaiting) {
      elapsed = Math.round((Date.now() - jobStart) / 1000)
      const errEl = page.locator('[class*="error"], [class*="Error"]').first()
      errorMsg = await errEl.textContent().catch(() => 'erro desconhecido')
      log(`[${runLabel}] FALHOU: ${errorMsg.trim().slice(0, 100)}`)
      jobFailed = true
      await screenshot(page, `${runLabel}-result-error`)
      return { done: false, failed: true, elapsed: Math.round((Date.now() - jobStart) / 1000), error: errorMsg.trim().slice(0, 100) }
    }

    if (i % 6 === 0) {
      const elapsed = Math.round((Date.now() - jobStart) / 1000)
      log(`[${runLabel}] Aguardando... ${elapsed}s`)
      await screenshot(page, `${runLabel}-wait-${elapsed}s`)
    }
  }

  const elapsed = Math.round((Date.now() - jobStart) / 1000)
  log(`[${runLabel}] TIMEOUT apos ${elapsed}s`)
  await screenshot(page, `${runLabel}-timeout`)
  return { done: false, failed: false, elapsed, error: 'TIMEOUT' }
}

// ─── Verificar BottomNav nao sobrepoe conteudo ─────────────────────────────────
async function checkBottomNavOverlap(page, runLabel) {
  const overlap = await page.evaluate(() => {
    // Encontrar BottomNav
    const fixed = [...document.querySelectorAll('*')].filter(el => {
      const st = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return st.position === 'fixed' && rect.bottom >= window.innerHeight - 5 && rect.height > 40 && rect.height < 130
    })
    if (!fixed.length) return { navFound: false }

    const nav = fixed[0]
    const navRect = nav.getBoundingClientRect()

    // Scroll ate o final e checar se conteudo esta visivel
    const mainContent = document.querySelector('main, [class*="content"], [class*="Content"]')
    if (!mainContent) return { navFound: true, contentFound: false, navH: Math.round(navRect.height) }

    const contentRect = mainContent.getBoundingClientRect()
    const contentBottom = contentRect.bottom
    const navTop = navRect.top

    return {
      navFound: true,
      contentFound: true,
      navH: Math.round(navRect.height),
      contentBottom: Math.round(contentBottom),
      navTop: Math.round(navTop),
      overlaps: contentBottom > navTop + 20,
    }
  })

  result(
    overlap.navFound && (!overlap.overlaps),
    `[${runLabel}] BottomNav nao sobrepoe conteudo principal`,
    overlap.navFound
      ? `navH=${overlap.navH}px, overlap=${overlap.overlaps ? 'SIM (BUG)' : 'NAO'}`
      : 'BottomNav nao encontrado'
  )
  return overlap
}

// ─── Teste de VIDEO ────────────────────────────────────────────────────────────
async function testVideoGeneration(browser, imgPath, runNum) {
  const runLabel = `VIDEO-${runNum}`
  log(`\n${'='.repeat(60)}`)
  log(`  ${runLabel}: Testando geracao de VIDEO`)
  log(`${'='.repeat(60)}`)

  const context = await createMobileContext(browser)
  const page = await context.newPage()
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))

  try {
    const loggedIn = await doLogin(page, runLabel)
    result(loggedIn, `[${runLabel}] Login OK`)
    if (!loggedIn) return { run: runNum, type: 'video', elapsed: 0, success: false, error: 'login falhou' }

    await page.waitForTimeout(1500)
    await screenshot(page, `${runLabel}-home`)

    // Navegar para a aba de video
    const videoSelectors = [
      'button:has-text("Video")',
      'button:has-text("Vídeo")',
      'a:has-text("Video")',
      'a:has-text("Vídeo")',
      '[class*="nav"] button',
    ]
    let videoNavClicked = false
    for (const sel of videoSelectors) {
      const el = page.locator(sel)
      const cnt = await el.count()
      for (let i = 0; i < cnt; i++) {
        const txt = await el.nth(i).textContent().catch(() => '')
        if (/v[íi]deo/i.test(txt)) {
          await el.nth(i).click()
          videoNavClicked = true
          log(`[${runLabel}] Clicou em video nav: "${txt.trim()}"`)
          break
        }
      }
      if (videoNavClicked) break
    }

    await page.waitForTimeout(1500)
    await screenshot(page, `${runLabel}-video-section`)

    // Selecionar modo Custom para video
    await selectCustomMode(page, runLabel)

    // Upload
    const uploadOk = await uploadImage(page, imgPath, runLabel)
    result(uploadOk, `[${runLabel}] Upload OK`)

    // Fill e submit
    const submitResult = await fillAndSubmit(page, runLabel, true)
    if (!submitResult.submitted) {
      const reason = submitResult.disabled ? `btn desabilitado: ${submitResult.btnText}` : 'submit falhou'
      result(false, `[${runLabel}] Submit VIDEO`, reason)
      await context.close()
      return { run: runNum, type: 'video', elapsed: 0, success: false, error: reason }
    }

    // Aguardar resultado (video demora mais)
    const res = await waitForResult(page, runLabel, submitResult.jobStart, 6)
    result(res.done, `[${runLabel}] Video gerado`, res.done ? `${res.elapsed}s` : res.error)

    if (res.done) videoTimings.push(res.elapsed)
    return { run: runNum, type: 'video', elapsed: res.elapsed, success: res.done, error: res.error }

  } finally {
    await context.close()
  }
}

// ─── Teste de FOTO ─────────────────────────────────────────────────────────────
async function testPhotoGeneration(browser, imgPath, runNum) {
  const runLabel = `FOTO-${runNum}`
  log(`\n${'='.repeat(60)}`)
  log(`  ${runLabel}: Testando geracao de FOTO (modo Custom)`)
  log(`${'='.repeat(60)}`)

  const context = await createMobileContext(browser)
  const page = await context.newPage()
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))

  try {
    // Login
    const loggedIn = await doLogin(page, runLabel)
    result(loggedIn, `[${runLabel}] Login OK`)
    if (!loggedIn) return { run: runNum, type: 'foto', elapsed: 0, success: false, error: 'login falhou' }

    await page.waitForTimeout(1500)

    // Home screenshot
    await screenshot(page, `${runLabel}-home`)

    // Check layout Samsung na home
    await checkSamsungLayout(page, runLabel)

    // Verificar BottomNav overlap
    await checkBottomNavOverlap(page, runLabel)

    // Selecionar modo Custom
    const customOk = await selectCustomMode(page, runLabel)
    result(customOk, `[${runLabel}] Modo Custom selecionado`)

    // Upload
    const uploadOk = await uploadImage(page, imgPath, runLabel)
    result(uploadOk, `[${runLabel}] Upload de imagem`)

    // Fill e submit
    const submitResult = await fillAndSubmit(page, runLabel)

    if (!submitResult.submitted) {
      const reason = submitResult.disabled
        ? `btn desabilitado: ${submitResult.btnText}`
        : 'submit falhou'
      result(false, `[${runLabel}] Submit`, reason)
      await context.close()
      return { run: runNum, type: 'foto', elapsed: 0, success: false, error: reason }
    }

    result(true, `[${runLabel}] Job submetido com sucesso`)

    // Aguardar resultado
    const res = await waitForResult(page, runLabel, submitResult.jobStart, 4)
    result(res.done, `[${runLabel}] Foto gerada`, res.done ? `${res.elapsed}s` : res.error)

    if (res.done) photoTimings.push(res.elapsed)

    // Checar imagem resultado
    if (res.done) {
      const imgCount = await page.locator('img[src*="image-jobs"], img[src*="output"]').count()
      result(imgCount > 0, `[${runLabel}] Imagem resultado exibida`, `${imgCount} imagem(ns)`)
      await screenshot(page, `${runLabel}-resultado-final`)
    }

    return { run: runNum, type: 'foto', elapsed: res.elapsed, success: res.done, error: res.error }

  } finally {
    await context.close()
  }
}

// ─── Teste SIMULTANEO (2 abas) ─────────────────────────────────────────────────
async function testSimultaneous(browser, imgPath) {
  log(`\n${'='.repeat(60)}`)
  log('  STRESS: 2 JOBS SIMULTANEOS (mesma conta, 2 abas)')
  log(`${'='.repeat(60)}`)

  const context = await createMobileContext(browser)
  const page1 = await context.newPage()
  const page2 = await context.newPage()

  const simultaneousResult = {
    job1: { submitted: false, result: null },
    job2: { submitted: false, result: null },
    bothCreated: false,
    oneFailed: false,
    errorMsg: '',
  }

  try {
    // Login em ambas as abas
    log('[SIMUL] Fazendo login na aba 1...')
    const login1 = await doLogin(page1, 'SIMUL-1')
    result(login1, '[SIMUL] Login aba 1')

    log('[SIMUL] Fazendo login na aba 2...')
    const login2 = await doLogin(page2, 'SIMUL-2')
    result(login2, '[SIMUL] Login aba 2')

    if (!login1 || !login2) {
      result(false, '[SIMUL] Login falhou em uma das abas')
      return simultaneousResult
    }

    // Preparar ambas as abas: modo custom + upload
    log('[SIMUL] Preparando aba 1...')
    await selectCustomMode(page1, 'SIMUL-1')
    await uploadImage(page1, imgPath, 'SIMUL-1')
    await page1.waitForTimeout(1000)

    log('[SIMUL] Preparando aba 2...')
    await selectCustomMode(page2, 'SIMUL-2')
    await uploadImage(page2, imgPath, 'SIMUL-2')
    await page2.waitForTimeout(1000)

    // Preencher campos em ambas
    for (const [pg, lbl] of [[page1, 'SIMUL-1'], [page2, 'SIMUL-2']]) {
      const produtoSelectors = ['input[placeholder*="produto"]', 'input[placeholder*="Product"]', 'input[name="product"]']
      for (const sel of produtoSelectors) {
        const el = pg.locator(sel).first()
        if (await el.count() > 0) { await el.fill('Tenis Nike stress test'); break }
      }
      const promptSelectors = ['textarea[placeholder*="prompt"]', 'textarea[placeholder*="descri"]', 'textarea']
      for (const sel of promptSelectors) {
        const el = pg.locator(sel).first()
        if (await el.count() > 0) {
          const v = await el.inputValue().catch(() => '')
          if (!v) await el.fill('Foto profissional produto branco fundo clean stress test')
          break
        }
      }
    }

    await screenshot(page1, 'SIMUL-1-pronto')
    await screenshot(page2, 'SIMUL-2-pronto')

    // Encontrar botoes em ambas antes de clicar
    const gerarSelectors = ['form button[type="submit"]', 'button:has-text("Gerar")', 'button:has-text("Criar foto")', 'button:has-text("Criar")']

    let btn1 = null, btn2 = null
    for (const sel of gerarSelectors) {
      if (!btn1) {
        const b = page1.locator(sel).first()
        if (await b.count() > 0 && !(await b.isDisabled().catch(() => true))) { btn1 = b }
      }
      if (!btn2) {
        const b = page2.locator(sel).first()
        if (await b.count() > 0 && !(await b.isDisabled().catch(() => true))) { btn2 = b }
      }
      if (btn1 && btn2) break
    }

    if (!btn1 || !btn2) {
      result(false, '[SIMUL] Nao encontrou botao Gerar em uma das abas')
      return simultaneousResult
    }

    // SUBMISSAO SIMULTANEA
    log('[SIMUL] Submetendo DOIS jobs ao mesmo tempo...')
    const t0 = Date.now()
    await Promise.all([
      btn1.click().then(() => { simultaneousResult.job1.submitted = true; log(`[SIMUL] Job 1 clicado em ${Date.now() - t0}ms`) }),
      btn2.click().then(() => { simultaneousResult.job2.submitted = true; log(`[SIMUL] Job 2 clicado em ${Date.now() - t0}ms`) }),
    ])

    await page1.waitForTimeout(3000)
    await page2.waitForTimeout(3000)
    await screenshot(page1, 'SIMUL-1-apos-submit')
    await screenshot(page2, 'SIMUL-2-apos-submit')

    // Verificar o que aconteceu em cada aba
    for (const [pg, lbl, jobObj] of [[page1, 'SIMUL-1', simultaneousResult.job1], [page2, 'SIMUL-2', simultaneousResult.job2]]) {
      const content = await pg.content()
      const hasError = /algo deu errado|something went wrong|error|falhou|limit|limite/i.test(content)
      const isGenerating = /gerando|processando|aguarde|generating/i.test(content)
      const hasResult = await pg.locator('img[src*="image-jobs"]').count() > 0

      jobObj.result = hasError ? 'error' : isGenerating ? 'generating' : hasResult ? 'done' : 'unknown'
      log(`[${lbl}] Estado pos-submit: ${jobObj.result}`)

      if (hasError) {
        const errEl = pg.locator('[class*="error"], [class*="Error"], [class*="alert"]').first()
        const errTxt = await errEl.textContent().catch(() => 'erro nao capturado')
        log(`[${lbl}] Mensagem de erro: "${errTxt.trim().slice(0, 150)}"`)
        simultaneousResult.errorMsg += `[${lbl}]: ${errTxt.trim().slice(0, 100)} | `
        simultaneousResult.oneFailed = true
      }
    }

    simultaneousResult.bothCreated = simultaneousResult.job1.submitted && simultaneousResult.job2.submitted
      && simultaneousResult.job1.result !== 'error' && simultaneousResult.job2.result !== 'error'

    result(
      simultaneousResult.job1.submitted && simultaneousResult.job2.submitted,
      '[SIMUL] Ambos os cliques foram executados'
    )
    result(
      simultaneousResult.bothCreated,
      '[SIMUL] Ambos os jobs criados sem erro',
      simultaneousResult.bothCreated ? 'OK' : `Um ou mais falhou. Estados: ${simultaneousResult.job1.result} / ${simultaneousResult.job2.result}`
    )
    if (simultaneousResult.oneFailed) {
      log(`[SIMUL] Erro capturado: ${simultaneousResult.errorMsg}`)
      result(true, '[SIMUL] Sistema respondeu ao conflito', `Erro: ${simultaneousResult.errorMsg.slice(0, 100)}`)
    }

  } finally {
    await context.close()
  }

  return simultaneousResult
}

// ─── Relatorio Supabase (jobs das ultimas 2h) ──────────────────────────────────
async function fetchSupabaseReport() {
  log('\n=== CONSULTANDO SUPABASE (jobs ultimas 2h) ===')
  const resp = await supaReq(
    'GET',
    `/rest/v1/image_jobs?created_at=gte.${encodeURIComponent(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())}&order=created_at.desc&select=*`,
    null
  )

  if (resp.status !== 200) {
    log(`ERRO ao buscar jobs: ${resp.status}`)
    return null
  }

  const jobs = Array.isArray(resp.body) ? resp.body : []
  log(`Total de jobs nas ultimas 2h: ${jobs.length}`)

  const byStatus = {}
  const timingsDone = []
  const errors = []

  for (const job of jobs) {
    const st = job.status || 'unknown'
    byStatus[st] = (byStatus[st] || 0) + 1

    if (st === 'done' && job.created_at && job.updated_at) {
      const created = new Date(job.created_at).getTime()
      const updated = new Date(job.updated_at).getTime()
      const diffSec = Math.round((updated - created) / 1000)
      if (diffSec > 0 && diffSec < 3600) timingsDone.push(diffSec)
    }

    if (st === 'failed' || job.error) {
      errors.push({ id: job.id, user_id: job.user_id, error: job.error, created_at: job.created_at })
    }
  }

  const avgTime = timingsDone.length > 0
    ? Math.round(timingsDone.reduce((a, b) => a + b, 0) / timingsDone.length)
    : null

  return { total: jobs.length, byStatus, avgTimeDone: avgTime, timingsDone, errors, jobs }
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  log('='.repeat(60))
  log('  STRESS TEST M5 — TamoWork Foto IA')
  log('  Device: Samsung Galaxy S23 (360x780, Android 13)')
  log(`  Conta: ${EMAIL}`)
  log(`  Modo: CUSTOM (prompt livre)`)
  log(`  Imagem: tenis esportivo (Unsplash)`)
  log(`  Screenshots: ${SCREENSHOTS_DIR}`)
  log('='.repeat(60))

  // Baixar imagem de teste
  let imgPath
  try {
    imgPath = await downloadTestImage()
    log(`Imagem de teste pronta: ${imgPath} (${Math.round(fs.statSync(imgPath).size / 1024)}KB)`)
  } catch (e) {
    log(`AVISO: nao foi possivel baixar imagem: ${e.message}`)
    // Usar imagem de fallback se existir
    const fallback = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m4/test-tenis.jpg'
    if (fs.existsSync(fallback)) {
      imgPath = fallback
      log(`Usando fallback: ${fallback}`)
    } else {
      log('ERRO FATAL: sem imagem de teste disponivel')
      process.exit(1)
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-dev-shm-usage'],
  })

  const fotoResults = []
  const videoResults = []

  try {
    // ─── 5 TESTES DE FOTO ───────────────────────────────────────────────────
    log('\n### INICIANDO 5 TESTES DE FOTO (Custom) ###')
    for (let i = 1; i <= 5; i++) {
      log(`\n--- FOTO RUN ${i}/5 ---`)
      try {
        const res = await testPhotoGeneration(browser, imgPath, i)
        fotoResults.push(res)
        log(`[FOTO-${i}] Resultado: ${res.success ? 'SUCESSO' : 'FALHA'} — ${res.elapsed}s${res.error ? ' — ' + res.error : ''}`)
      } catch (e) {
        log(`[FOTO-${i}] EXCECAO: ${e.message}`)
        fotoResults.push({ run: i, type: 'foto', elapsed: 0, success: false, error: e.message })
      }
      // Pausa entre runs para nao sobrecarregar
      if (i < 5) {
        log('Aguardando 5s entre runs...')
        await new Promise(r => setTimeout(r, 5000))
      }
    }

    // ─── 2 TESTES DE VIDEO ──────────────────────────────────────────────────
    log('\n### INICIANDO 2 TESTES DE VIDEO ###')
    for (let i = 1; i <= 2; i++) {
      log(`\n--- VIDEO RUN ${i}/2 ---`)
      try {
        const res = await testVideoGeneration(browser, imgPath, i)
        videoResults.push(res)
        log(`[VIDEO-${i}] Resultado: ${res.success ? 'SUCESSO' : 'FALHA'} — ${res.elapsed}s${res.error ? ' — ' + res.error : ''}`)
      } catch (e) {
        log(`[VIDEO-${i}] EXCECAO: ${e.message}`)
        videoResults.push({ run: i, type: 'video', elapsed: 0, success: false, error: e.message })
      }
      if (i < 2) await new Promise(r => setTimeout(r, 5000))
    }

    // ─── TESTE SIMULTANEO ────────────────────────────────────────────────────
    log('\n### TESTE DE STRESS SIMULTANEO (2 jobs ao mesmo tempo) ###')
    let simultResult
    try {
      simultResult = await testSimultaneous(browser, imgPath)
    } catch (e) {
      log(`[SIMUL] EXCECAO: ${e.message}`)
      simultResult = { error: e.message }
    }

  } finally {
    await browser.close()
  }

  // ─── RELATORIO SUPABASE ─────────────────────────────────────────────────────
  const supaReport = await fetchSupabaseReport()

  // ─── RELATORIO FINAL ────────────────────────────────────────────────────────
  const totalElapsed = Math.round((Date.now() - startTime) / 1000)
  const fotoSuccess = fotoResults.filter(r => r.success).length
  const videoSuccess = videoResults.filter(r => r.success).length
  const avgFoto = photoTimings.length > 0
    ? Math.round(photoTimings.reduce((a, b) => a + b, 0) / photoTimings.length)
    : 'N/A'
  const avgVideo = videoTimings.length > 0
    ? Math.round(videoTimings.reduce((a, b) => a + b, 0) / videoTimings.length)
    : 'N/A'

  console.log('\n')
  console.log('='.repeat(70))
  console.log('  RELATORIO FINAL — STRESS TEST M5 (Samsung Galaxy S23)')
  console.log('='.repeat(70))
  console.log(`\nDevice: Samsung Galaxy S23 | 360x780 | Android 13 | Chrome 120`)
  console.log(`Conta: ${EMAIL}`)
  console.log(`Modo: CUSTOM (prompt livre)`)
  console.log(`Duracao total: ${totalElapsed}s`)
  console.log(`\n--- TESTES DE FOTO (5x Custom) ---`)
  console.log(`Sucesso: ${fotoSuccess}/5`)
  for (const r of fotoResults) {
    console.log(`  FOTO-${r.run}: ${r.success ? 'OK' : 'FAIL'} — ${r.elapsed}s${r.error ? ' — ' + r.error : ''}`)
  }
  console.log(`Tempo medio foto (runs OK): ${avgFoto}s`)
  console.log(`\n--- TESTES DE VIDEO (2x Custom) ---`)
  console.log(`Sucesso: ${videoSuccess}/2`)
  for (const r of videoResults) {
    console.log(`  VIDEO-${r.run}: ${r.success ? 'OK' : 'FAIL'} — ${r.elapsed}s${r.error ? ' — ' + r.error : ''}`)
  }
  console.log(`Tempo medio video (runs OK): ${avgVideo}s`)
  console.log('\n--- CHECKS SAMSUNG/ANDROID ---')
  for (const r of results) console.log(`  ${r}`)

  if (supaReport) {
    console.log('\n--- SUPABASE — Jobs ultimas 2h (todos os agentes) ---')
    console.log(`Total de jobs: ${supaReport.total}`)
    console.log(`Distribuicao por status:`)
    for (const [st, cnt] of Object.entries(supaReport.byStatus)) {
      console.log(`  ${st}: ${cnt}`)
    }
    console.log(`Tempo medio global (done): ${supaReport.avgTimeDone !== null ? supaReport.avgTimeDone + 's' : 'N/A'}`)
    if (supaReport.timingsDone.length > 0) {
      console.log(`  Min: ${Math.min(...supaReport.timingsDone)}s | Max: ${Math.max(...supaReport.timingsDone)}s`)
    }
    if (supaReport.errors.length > 0) {
      console.log(`\nJobs com erro (${supaReport.errors.length}):`)
      for (const e of supaReport.errors.slice(0, 10)) {
        console.log(`  ID: ${e.id} | User: ${e.user_id} | Erro: ${String(e.error || 'sem msg').slice(0, 80)}`)
      }
    } else {
      console.log('Jobs com erro: nenhum')
    }
  }

  console.log('\n--- SCREENSHOTS ---')
  try {
    const shots = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'))
    console.log(`${shots.length} screenshots em ${SCREENSHOTS_DIR}`)
  } catch {}

  console.log('\n='.repeat(70))
  console.log('  FIM DO STRESS TEST M5')
  console.log('='.repeat(70))

  // Salvar relatorio JSON
  const report = {
    agent: 'stress-m5',
    device: 'Samsung Galaxy S23 (360x780)',
    timestamp: new Date().toISOString(),
    email: EMAIL,
    mode: 'custom',
    foto: { runs: 5, success: fotoSuccess, results: fotoResults, avgElapsed: avgFoto },
    video: { runs: 2, success: videoSuccess, results: videoResults, avgElapsed: avgVideo },
    androidChecks: results,
    supabase: supaReport,
    totalElapsedSec: totalElapsed,
  }
  fs.writeFileSync(
    `${SCREENSHOTS_DIR}/stress-m5-report.json`,
    JSON.stringify(report, null, 2)
  )
  log(`Relatorio JSON salvo em ${SCREENSHOTS_DIR}/stress-m5-report.json`)
}

main().catch(err => {
  console.error('ERRO FATAL:', err)
  process.exit(1)
})
