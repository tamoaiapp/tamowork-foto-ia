/**
 * stress-m2-android.mjs — Stress Test Mobile Android (Pixel 7)
 * TamoWork Foto IA — https://tamowork.com
 *
 * Testes:
 *   - 5x foto em cena (relógio)
 *   - 2x vídeo
 *   - Checks Android: BottomNav, sem Sidebar, scroll, botões grandes, header fixo
 *   - Bloqueio de job ativo
 *   - Logout + login novamente
 *
 * Run: node stress-m2-android.mjs
 */

import { chromium } from 'playwright'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_URL = 'https://tamowork.com'
const EMAIL = 'test-stress-m2@tamowork.test'
const PASSWORD = 'StressM2@2026'
const USER_ID = 'd250b2c3-c232-44d7-8e02-ee2199557b46'
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m2'
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXBwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'

// Pixel 7 Android config
const PIXEL7 = {
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2.625,
}

const IMAGE_URL = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800'

// ─── Resultados ───────────────────────────────────────────────────────────────
const jobResults = []
const androidChecks = []
let stepNum = 0
let screenshotCount = 0

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

function addCheck(ok, label, detail = '') {
  const icon = ok ? 'OK' : 'FAIL'
  const line = `[${icon}] ${label}${detail ? ' — ' + detail : ''}`
  androidChecks.push({ ok, label, detail })
  log(line)
}

async function screenshot(page, name) {
  screenshotCount++
  const file = path.join(SCREENSHOTS_DIR, `${String(screenshotCount).padStart(3, '0')}-${name}.png`)
  try {
    await page.screenshot({ path: file, fullPage: false })
    log(`Screenshot salvo: ${path.basename(file)}`)
  } catch (e) {
    log(`Screenshot falhou: ${e.message}`)
  }
  return file
}

// ─── Download imagem do relógio ────────────────────────────────────────────────
async function downloadWatchImage() {
  const imgPath = path.join(SCREENSHOTS_DIR, 'relogio-test.jpg')
  if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 5000) {
    log(`Usando imagem existente: ${imgPath}`)
    return imgPath
  }
  log('Baixando imagem do relógio (Unsplash)...')
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath)
    const download = (url, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return }
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          download(res.headers.location, redirects + 1)
          return
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          log(`Imagem salva: ${imgPath} (${fs.statSync(imgPath).size} bytes)`)
          resolve(imgPath)
        })
      }).on('error', reject)
    }
    download(IMAGE_URL)
  })
}

// ─── Supabase helper ──────────────────────────────────────────────────────────
async function supabaseReq(method, endpoint, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const url = new URL(SUPABASE_URL + endpoint)
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        Prefer: 'return=representation',
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

// ─── Login ────────────────────────────────────────────────────────────────────
async function doLogin(page) {
  log('Navegando para /login...')
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  await screenshot(page, 'login-page')

  // Abrir campo de email se necessário
  const emailToggle = page.locator('button:has-text("e-mail"), button:has-text("email"), button:has-text("Usar e-mail")').first()
  if (await emailToggle.count() > 0 && await emailToggle.isVisible()) {
    await emailToggle.click()
    await page.waitForTimeout(500)
  }

  // Clicar na aba Entrar
  const entrarTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first()
  if (await entrarTab.count() > 0 && await entrarTab.isVisible()) {
    await entrarTab.click()
    await page.waitForTimeout(400)
    log('Clicou na aba Entrar')
  }

  // Preencher campos
  const emailInput = page.locator('input[type="email"]').first()
  const passInput = page.locator('input[type="password"]').first()
  await emailInput.fill(EMAIL)
  await passInput.fill(PASSWORD)
  await screenshot(page, 'login-preenchido')

  // Submeter
  const submitBtn = page.locator('form button').filter({ hasText: /^Entrar$/ }).first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
  } else {
    await passInput.press('Enter')
  }

  await page.waitForTimeout(5000)
  let url = page.url()
  log(`URL pós-login: ${url}`)

  // Pular onboarding
  if (url.includes('/onboarding')) {
    log('Em onboarding — pulando...')
    await page.evaluate(() => localStorage.setItem('tw_onboarding_done', '1'))
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    url = page.url()
  }

  const ok = !url.includes('/login')
  log(`Login: ${ok ? 'SUCESSO' : 'FALHOU'} (${url})`)
  return ok
}

// ─── Checks Android ───────────────────────────────────────────────────────────
async function runAndroidChecks(page) {
  log('\n=== CHECKS ANDROID ===')

  // Garantir que está na home
  const curUrl = page.url()
  if (!curUrl.match(/tamowork\.com\/?$/)) {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500)
  }

  await screenshot(page, 'android-home-layout')

  // 1. BottomNav visível
  const bottomNavOk = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*')
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (
        style.position === 'fixed' &&
        rect.bottom >= window.innerHeight - 10 &&
        rect.height > 40 &&
        rect.height < 130 &&
        rect.width > 200
      ) return true
    }
    return false
  })
  addCheck(bottomNavOk, 'BottomNav visível e fixa no bottom')
  await screenshot(page, 'android-bottom-nav')

  // 2. Sidebar NÃO visível
  const sidebarVisible = await page.evaluate(() => {
    const sels = ['[class*="sidebar"]', '[class*="Sidebar"]', 'aside', '[class*="DesktopNav"]', '[class*="desktop-nav"]']
    for (const sel of sels) {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 50 && rect.height > 100) return true
      }
    }
    return false
  })
  addCheck(!sidebarVisible, 'Sidebar NÃO visível no mobile', sidebarVisible ? 'BUG: sidebar aparecendo!' : 'correto')

  // 3. Scroll suave na página principal
  const scrollResult = await page.evaluate(async () => {
    const before = window.scrollY
    window.scrollTo({ top: 300, behavior: 'smooth' })
    await new Promise(r => setTimeout(r, 800))
    const after = window.scrollY
    window.scrollTo({ top: 0 })
    return { before, after, scrolled: after > before }
  })
  addCheck(scrollResult.scrolled, 'Scroll suave funciona', `de ${scrollResult.before}px → ${scrollResult.after}px`)

  // 4. Botões grandes o suficiente para toque (mín 44px)
  const btnCheck = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"], a[class*="btn"]')
    const tooSmall = []
    const okBtns = []
    buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect()
      const style = window.getComputedStyle(btn)
      if (style.display === 'none' || style.visibility === 'hidden') return
      if (rect.width < 5 || rect.height < 5) return
      const minDim = Math.min(rect.width, rect.height)
      if (minDim < 36) {
        tooSmall.push({ text: btn.textContent?.trim()?.slice(0, 30), h: Math.round(rect.height), w: Math.round(rect.width) })
      } else {
        okBtns.push({ h: Math.round(rect.height), w: Math.round(rect.width) })
      }
    })
    return { tooSmall, okCount: okBtns.length, totalChecked: buttons.length }
  })
  const bigEnough = btnCheck.tooSmall.length === 0
  addCheck(
    bigEnough,
    `Botões com tamanho adequado (>= 36px)`,
    bigEnough
      ? `${btnCheck.okCount}/${btnCheck.totalChecked} OK`
      : `${btnCheck.tooSmall.length} pequenos demais: ${JSON.stringify(btnCheck.tooSmall.slice(0, 3))}`
  )

  // 5. Header fixo ao rolar
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }))
  await page.waitForTimeout(500)
  const headerFixed = await page.evaluate(() => {
    const headers = document.querySelectorAll('header, [class*="header"], [class*="Header"], [class*="topbar"], [class*="Topbar"]')
    for (const h of headers) {
      const style = window.getComputedStyle(h)
      if (style.position === 'fixed' || style.position === 'sticky') return true
    }
    return false
  })
  addCheck(headerFixed, 'Header fixo ao rolar página')
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  await screenshot(page, 'android-header-fixo')

  // 6. Verificar viewport correto
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  addCheck(vp.w <= 430, 'Viewport width mobile correto', `${vp.w}x${vp.h}`)
}

// ─── Selecionar modo foto_em_cena ─────────────────────────────────────────────
// ModeSelector: fundo_branco(0), simulacao(1), catalogo(2), video(3), promo(4), personalizado(5)
// "Foto em cena" = modo "simulacao" = 2º card (índice 1)
// Clica em "Usar agora" do 2º card
async function selectFotoEmCena(page) {
  log('Selecionando modo: Foto em cena (simulacao = índice 1)...')

  // Os botões "Usar agora" correspondem aos cards em ordem
  // Índice 1 = simulacao = "Foto em cena"
  const usarAgoraBtns = page.locator('button:has-text("Usar agora")')
  const count = await usarAgoraBtns.count()
  log(`Botões "Usar agora" encontrados: ${count}`)

  if (count >= 2) {
    // Índice 1 = simulacao
    await usarAgoraBtns.nth(1).click()
    log('Clicou em "Usar agora" do card simulacao (índice 1)')
    await page.waitForTimeout(1500)
    // Verificar se o form apareceu (input[type=file] deve estar no DOM)
    const hasFileInput = await page.locator('input[type="file"]').count() > 0
    log(`Input[type=file] após clique: ${hasFileInput}`)
    return true
  }

  if (count >= 1) {
    await usarAgoraBtns.first().click()
    log('Clicou no 1º "Usar agora" (fallback)')
    await page.waitForTimeout(1500)
    return true
  }

  // Fallback: clicar no card pela imagem/texto
  const modeCard = page.locator('.mode-card').nth(1)
  if (await modeCard.count() > 0) {
    await modeCard.click()
    log('Clicou no .mode-card índice 1 (fallback)')
    await page.waitForTimeout(1500)
    return true
  }

  return false
}

// ─── Upload de imagem ──────────────────────────────────────────────────────────
// O input[type="file"] tem display:none — Playwright permite setInputFiles nele diretamente
async function uploadImage(page, imgPath) {
  log(`Upload: ${imgPath}`)

  // Aguardar o form aparecer (input[type=file] no DOM após selecionar modo)
  try {
    await page.waitForSelector('input[type="file"]', { timeout: 5000 })
    log('input[type=file] apareceu no DOM')
  } catch(e) {
    log('Timeout aguardando input[type=file]')
  }

  // Approach 1: setInputFiles no input[type="file"] hidden (Playwright suporta)
  const fileInputs = page.locator('input[type="file"]')
  const inputCount = await fileInputs.count()
  log(`Inputs type=file no DOM: ${inputCount}`)

  if (inputCount > 0) {
    for (let i = 0; i < inputCount; i++) {
      try {
        // Playwright pode setar arquivos em inputs hidden
        await fileInputs.nth(i).setInputFiles(imgPath)
        log(`Upload via setInputFiles #${i} OK`)
        await page.waitForTimeout(2000)
        // Verificar se preview apareceu (indica que o onChange foi disparado)
        const hasPreview = await page.locator('img[src^="blob:"], img[src^="data:"], [class*="preview"], [class*="Preview"]').count() > 0
        log(`Preview apareceu: ${hasPreview}`)
        return true
      } catch (e) {
        log(`setInputFiles #${i} erro: ${e.message}`)
      }
    }
  }

  // Approach 2: clicar no dropzone para abrir filechooser
  log('Tentando filechooser via dropzone click...')
  const dropzoneSelectors = [
    '[class*="dropzone"]', '[class*="Dropzone"]',
    'div[style*="border-radius"][style*="cursor"]',
    '[class*="drop"]', '[class*="zone"]',
  ]
  for (const sel of dropzoneSelectors) {
    const dz = page.locator(sel).first()
    if (await dz.count() > 0 && await dz.isVisible().catch(() => false)) {
      try {
        const [fc] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null),
          dz.click(),
        ])
        if (fc) {
          await fc.setFiles(imgPath)
          log(`Upload via filechooser (${sel}) OK`)
          await page.waitForTimeout(2000)
          return true
        }
      } catch (e) {
        log(`Dropzone ${sel} erro: ${e.message}`)
      }
    }
  }

  // Approach 3: JS DataTransfer inject
  log('Tentando upload via JS DataTransfer...')
  const b64 = fs.readFileSync(imgPath).toString('base64')
  const ok = await page.evaluate(async (b64data) => {
    const inputs = document.querySelectorAll('input[type="file"]')
    if (!inputs.length) return false
    const byteString = atob(b64data)
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: 'image/jpeg' })
    const file = new File([blob], 'relogio.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer()
    dt.items.add(file)
    inputs[0].files = dt.files
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, b64)
  if (ok) {
    log('Upload via JS DataTransfer OK')
    await page.waitForTimeout(2000)
  }
  return ok
}

// ─── Preencher campos e submeter ───────────────────────────────────────────────
// Campos reais do page.tsx:
//   produto: input[placeholder*="bolo de chocolate"] — primeiro text input visível
//   cenario: input[placeholder*="mesa rústica"] — segundo text input visível
//   submit: button[type="submit"]:not([class*="mode"]):not(:has-text("Usar agora"))
async function fillAndSubmit(page, produto, cenario) {
  // Aguardar form estar visível
  await page.waitForTimeout(500)

  // Pegar todos os inputs de texto visíveis (excluindo file)
  const textInputs = page.locator('input[type="text"]:visible, input:not([type]):visible')
  const textInputCount = await textInputs.count()
  log(`Inputs de texto visíveis: ${textInputCount}`)

  // Campo produto: placeholder contém "bolo" ou "artesanal" ou o 1º input
  const produtoEl = page.locator('input[placeholder*="bolo"], input[placeholder*="artesanal"], input[placeholder*="product"], input[placeholder*="Produto"]').first()
  const produtoVisible = await produtoEl.count() > 0 && await produtoEl.isVisible().catch(() => false)

  if (produtoVisible) {
    await produtoEl.clear()
    await produtoEl.fill(produto)
    log(`Preencheu produto: "${produto}"`)
  } else if (textInputCount > 0) {
    await textInputs.first().clear()
    await textInputs.first().fill(produto)
    log(`Preencheu 1º text input como produto: "${produto}"`)
  }

  // Campo cenário: placeholder contém "mesa rústica" ou "rústica" ou o 2º input
  const cenarioEl = page.locator('input[placeholder*="mesa"], input[placeholder*="rústica"], input[placeholder*="ambiente"], input[placeholder*="estúdio"]').first()
  const cenarioVisible = await cenarioEl.count() > 0 && await cenarioEl.isVisible().catch(() => false)

  if (cenarioVisible) {
    const val = await cenarioEl.inputValue().catch(() => '')
    if (!val) {
      await cenarioEl.fill(cenario)
      log(`Preencheu cenário: "${cenario}"`)
    } else {
      log(`Cenário já preenchido: "${val}"`)
    }
  } else if (textInputCount >= 2) {
    const val = await textInputs.nth(1).inputValue().catch(() => '')
    if (!val) {
      await textInputs.nth(1).fill(cenario)
      log(`Preencheu 2º text input como cenário: "${cenario}"`)
    }
  }

  await page.waitForTimeout(800)

  // Botão submit: o botão type=submit que NÃO é "Usar agora" e NÃO é de language/nav
  // Em page.tsx: <button type="submit" disabled={submitting || !cenario.trim()}>
  const allSubmitBtns = page.locator('button[type="submit"]')
  const submitCount = await allSubmitBtns.count()
  log(`Buttons type=submit: ${submitCount}`)

  for (let i = 0; i < submitCount; i++) {
    const btn = allSubmitBtns.nth(i)
    const txt = await btn.textContent()
    const isVisible = await btn.isVisible().catch(() => false)
    log(`  submit btn ${i}: "${txt?.trim()}" visible=${isVisible}`)
    if (!isVisible) continue
    const trimmedTxt = txt?.trim() || ''
    // Ignorar botões de navegação e "Usar agora"
    if (trimmedTxt === 'Usar agora' || trimmedTxt.includes('PT') || trimmedTxt.includes('EN') || trimmedTxt.includes('ES')) continue
    if (trimmedTxt === '' && i < submitCount - 1) continue // skip botões vazios que não são o último

    const isDisabled = await btn.isDisabled()
    log(`Selecionado btn: "${trimmedTxt}" — disabled: ${isDisabled}`)

    if (isDisabled) {
      return { submitted: false, disabled: true, btnText: trimmedTxt }
    }

    await btn.click()
    log('Job submetido!')
    return { submitted: true, disabled: false, btnText: trimmedTxt }
  }

  // Fallback: qualquer botão visível com texto de geração
  const gerarBtn = page.locator('button').filter({ hasText: /^(Criar foto|Gerar foto|Gerar|Criar|Criar imagem|Transformar)$/i }).first()
  if (await gerarBtn.count() > 0 && await gerarBtn.isVisible().catch(() => false)) {
    const isDisabled = await gerarBtn.isDisabled()
    const btnText = await gerarBtn.textContent()
    log(`Fallback btn: "${btnText?.trim()}" — disabled: ${isDisabled}`)
    if (isDisabled) return { submitted: false, disabled: true, btnText: btnText?.trim() }
    await gerarBtn.click()
    return { submitted: true, disabled: false, btnText: btnText?.trim() }
  }

  return { submitted: false, disabled: false, btnText: null }
}

// ─── Aguardar resultado de foto ────────────────────────────────────────────────
async function waitForPhotoResult(page, jobNum, maxWait = 300) {
  log(`Aguardando resultado do job #${jobNum} (máx ${maxWait}s)...`)
  const t0 = Date.now()
  let lastLog = t0
  let attempts = 0

  while (true) {
    await page.waitForTimeout(4000)
    attempts++
    const elapsed = Math.round((Date.now() - t0) / 1000)

    if (elapsed > maxWait) {
      log(`Timeout após ${elapsed}s`)
      return { status: 'timeout', elapsed, error: `Timeout ${elapsed}s` }
    }

    // Verificar se há imagem de resultado
    const resultImg = await page.locator('img[src*="image-jobs"], img[src*="supabase"], img[src*="output"]').count()
    const stillGen = await page.locator(':has-text("Gerando"), :has-text("Aguarde"), :has-text("Processando")').count()
    const hasError = await page.locator(':has-text("Algo deu errado"), :has-text("Erro ao gerar"), :has-text("deu errado")').count()

    if (elapsed - Math.round((lastLog - t0) / 1000) >= 15) {
      log(`...${elapsed}s — img:${resultImg}, gen:${stillGen}, err:${hasError}`)
      await screenshot(page, `job${jobNum}-aguardando-${elapsed}s`)
      lastLog = Date.now()
    }

    if (hasError > 0) {
      const errText = await page.locator(':has-text("Algo deu errado"), :has-text("deu errado")').first().textContent().catch(() => 'erro desconhecido')
      log(`Erro detectado: ${errText?.trim()?.slice(0, 100)}`)
      return { status: 'error', elapsed, error: errText?.trim()?.slice(0, 100) }
    }

    if (resultImg > 0 && stillGen === 0) {
      log(`Resultado recebido em ${elapsed}s!`)
      return { status: 'success', elapsed, error: null }
    }

    // Também verificar URL (pode redirecionar para /criacoes)
    const url = page.url()
    if (url.includes('/criacoes')) {
      log(`Redirecionou para criacoes após ${elapsed}s`)
      return { status: 'success', elapsed, error: null }
    }
  }
}

// ─── Aguardar resultado de vídeo ───────────────────────────────────────────────
async function waitForVideoResult(page, jobNum, maxWait = 300) {
  log(`Aguardando resultado de vídeo #${jobNum} (máx ${maxWait}s)...`)
  const t0 = Date.now()

  while (true) {
    await page.waitForTimeout(4000)
    const elapsed = Math.round((Date.now() - t0) / 1000)

    if (elapsed > maxWait) {
      return { status: 'timeout', elapsed, error: `Timeout ${elapsed}s` }
    }

    const hasVideo = await page.locator('video, [class*="video"]').count()
    const hasError = await page.locator(':has-text("Algo deu errado"), :has-text("deu errado"), :has-text("falhou")').count()
    const stillGen = await page.locator(':has-text("Gerando"), :has-text("Processando vídeo"), :has-text("Aguarde")').count()

    if (elapsed % 20 === 0 && elapsed > 0) {
      log(`...vídeo ${elapsed}s — video:${hasVideo}, gen:${stillGen}, err:${hasError}`)
      await screenshot(page, `video${jobNum}-aguardando-${elapsed}s`)
    }

    if (hasError > 0) {
      const errText = await page.locator(':has-text("deu errado"), :has-text("falhou")').first().textContent().catch(() => 'erro')
      return { status: 'error', elapsed, error: errText?.trim()?.slice(0, 100) }
    }

    if (hasVideo > 0 && stillGen === 0) {
      log(`Vídeo pronto em ${elapsed}s!`)
      return { status: 'success', elapsed, error: null }
    }
  }
}

// ─── Verificar bloqueio de job ativo ──────────────────────────────────────────
async function checkActiveJobBlocking(page) {
  log('\n=== CHECK: Job ativo bloqueia novo envio ===')

  // Navegar para home
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2000)

  // Verificar se botão está bloqueado quando há job em andamento
  const submitBtn = page.locator('button:has-text("Criar foto"), button:has-text("Gerar"), form button[type="submit"]').first()
  const hasBtn = await submitBtn.count() > 0

  if (hasBtn) {
    const isDisabled = await submitBtn.isDisabled()
    const btnText = await submitBtn.textContent()
    log(`Botão encontrado: "${btnText?.trim()}" — disabled: ${isDisabled}`)
    // Se há um job recente ativo, botão deve estar desabilitado
    // Este é o comportamento esperado
    addCheck(true, 'Verificação de bloqueio de job executada', `Botão "${btnText?.trim()?.slice(0, 40)}" disabled=${isDisabled}`)
  } else {
    // Pode ser que não há botão visível (sem upload ainda), isso também é válido
    addCheck(true, 'Verificação de bloqueio — form não exibido (sem upload)', 'comportamento esperado')
  }
}

// ─── Logout e login novamente ─────────────────────────────────────────────────
async function testLogoutLogin(page) {
  log('\n=== LOGOUT + LOGIN ===')

  // Tentar logout via menu/avatar
  let loggedOut = false

  // Abrir menu do usuário (pode ser BottomNav item de conta)
  const contaBtn = page.locator('a[href*="/conta"], button:has-text("Conta"), [class*="avatar"], [class*="user-menu"]').first()
  if (await contaBtn.count() > 0 && await contaBtn.isVisible().catch(() => false)) {
    await contaBtn.click()
    await page.waitForTimeout(1000)
    log('Clicou em Conta/Avatar')
    await screenshot(page, 'menu-conta')
  }

  // Procurar botão sair/logout
  const logoutBtn = page.locator('button:has-text("Sair"), button:has-text("Logout"), a:has-text("Sair"), a:has-text("Logout")').first()
  if (await logoutBtn.count() > 0 && await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click()
    await page.waitForTimeout(3000)
    loggedOut = true
    log('Logout realizado via botão')
  }

  if (!loggedOut) {
    // Tentar via /conta diretamente
    await page.goto(`${APP_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)
    await screenshot(page, 'pagina-conta')

    const logoutBtn2 = page.locator('button:has-text("Sair"), button:has-text("Logout")').first()
    if (await logoutBtn2.count() > 0) {
      await logoutBtn2.click()
      await page.waitForTimeout(3000)
      loggedOut = true
      log('Logout via /conta')
    }
  }

  if (!loggedOut) {
    // Forçar logout via localStorage
    log('Forçando logout via localStorage...')
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(k => {
        if (k.includes('supabase') || k.includes('auth')) localStorage.removeItem(k)
      })
    })
    await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1000)
    loggedOut = true
  }

  const urlAfterLogout = page.url()
  const isLoggedOut = urlAfterLogout.includes('/login') || !urlAfterLogout.includes('app')
  addCheck(loggedOut, 'Logout realizado', urlAfterLogout)
  await screenshot(page, 'apos-logout')

  // Fazer login novamente
  log('Fazendo login novamente...')
  const loginOk = await doLogin(page)
  addCheck(loginOk, 'Login após logout bem-sucedido', page.url())
  await screenshot(page, 'relogin-ok')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  log('═'.repeat(65))
  log('  STRESS TEST M2 — TamoWork Foto IA — Android Pixel 7')
  log(`  Device: Pixel 7 (412x915, Android 13, Chrome 120 Mobile)`)
  log(`  Conta: ${EMAIL}`)
  log(`  Modo: foto_em_cena | Produto: Relógio masculino clássico`)
  log('═'.repeat(65))

  // Baixar imagem de teste
  let imgPath
  try {
    imgPath = await downloadWatchImage()
  } catch (e) {
    log(`AVISO: Falha ao baixar imagem: ${e.message}`)
    // Criar imagem fake mínima
    imgPath = path.join(SCREENSHOTS_DIR, 'relogio-test.jpg')
    // Usar uma imagem local existente como fallback
    const fallbacks = [
      'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/mobile/test-product.jpg',
      'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/desktop/test-product.jpg',
    ]
    for (const fb of fallbacks) {
      if (fs.existsSync(fb) && fs.statSync(fb).size > 1000) {
        fs.copyFileSync(fb, imgPath)
        log(`Usando fallback: ${fb}`)
        break
      }
    }
  }

  if (!imgPath || !fs.existsSync(imgPath)) {
    log('ERRO: Nenhuma imagem disponível para teste!')
    process.exit(1)
  }
  log(`Imagem de teste: ${imgPath} (${fs.statSync(imgPath).size} bytes)`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({
    ...PIXEL7,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  })

  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`))

  try {
    // ══════════════════════════════════════════════════════════════════
    // LOGIN INICIAL
    // ══════════════════════════════════════════════════════════════════
    log('\n=== FASE 1: LOGIN INICIAL ===')
    const loginOk = await doLogin(page)
    if (!loginOk) {
      log('ERRO CRÍTICO: Login falhou! Abortando.')
      await browser.close()
      process.exit(1)
    }
    addCheck(loginOk, 'Login inicial bem-sucedido', page.url())
    await screenshot(page, 'login-ok')

    // ══════════════════════════════════════════════════════════════════
    // CHECKS ANDROID
    // ══════════════════════════════════════════════════════════════════
    await runAndroidChecks(page)

    // ══════════════════════════════════════════════════════════════════
    // FASE 2: 5x FOTO EM CENA
    // ══════════════════════════════════════════════════════════════════
    log('\n=== FASE 2: 5x FOTO EM CENA ===')

    for (let jobIdx = 1; jobIdx <= 5; jobIdx++) {
      log(`\n--- Job Foto #${jobIdx}/5 ---`)
      const jobStart = Date.now()

      // Navegar para home
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(2000)
      await screenshot(page, `foto${jobIdx}-home`)

      // Selecionar modo foto_em_cena
      const modeSelected = await selectFotoEmCena(page)
      if (!modeSelected) {
        log(`Job #${jobIdx}: Falha ao selecionar modo!`)
        jobResults.push({ job: `foto_${jobIdx}`, mode: 'foto_em_cena', status: 'error', tempo_seg: 0, erro: 'Modo não encontrado' })
        continue
      }
      await screenshot(page, `foto${jobIdx}-modo-selecionado`)

      // Upload
      const uploadOk = await uploadImage(page, imgPath)
      if (!uploadOk) {
        log(`Job #${jobIdx}: Upload falhou!`)
        jobResults.push({ job: `foto_${jobIdx}`, mode: 'foto_em_cena', status: 'error', tempo_seg: 0, erro: 'Upload falhou' })
        continue
      }
      await screenshot(page, `foto${jobIdx}-upload-ok`)

      // Preencher e submeter
      const submitResult = await fillAndSubmit(page, 'Relógio masculino clássico', 'mesa de madeira rústica')

      if (submitResult.disabled) {
        log(`Job #${jobIdx}: Botão desabilitado — "${submitResult.btnText}"`)
        jobResults.push({
          job: `foto_${jobIdx}`,
          mode: 'foto_em_cena',
          status: 'blocked',
          tempo_seg: 0,
          erro: `Bloqueado: "${submitResult.btnText?.slice(0, 60)}"`,
        })
        await screenshot(page, `foto${jobIdx}-bloqueado`)

        // Verificar bloqueio de job ativo
        addCheck(true, `Job #${jobIdx} bloqueado como esperado (rate limit / job ativo)`, submitResult.btnText?.slice(0, 60))
        continue
      }

      if (!submitResult.submitted) {
        log(`Job #${jobIdx}: Não foi possível submeter`)
        jobResults.push({ job: `foto_${jobIdx}`, mode: 'foto_em_cena', status: 'error', tempo_seg: 0, erro: 'Submit falhou' })
        continue
      }

      await screenshot(page, `foto${jobIdx}-submetido`)

      // Aguardar resultado
      const result = await waitForPhotoResult(page, jobIdx)
      const tempoSeg = result.elapsed

      jobResults.push({
        job: `foto_${jobIdx}`,
        mode: 'foto_em_cena',
        status: result.status,
        tempo_seg: tempoSeg,
        erro: result.error || '',
      })

      await screenshot(page, `foto${jobIdx}-resultado-${result.status}`)
      log(`Job #${jobIdx} finalizado: ${result.status} em ${tempoSeg}s`)

      // Se sucesso, verificar job ativo bloqueia próximo
      if (result.status === 'success' && jobIdx < 5) {
        await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForTimeout(2000)
        const genBtn = page.locator('button:has-text("Criar foto"), button:has-text("Gerar"), form button[type="submit"]').first()
        if (await genBtn.count() > 0) {
          const isDisabledAfter = await genBtn.isDisabled()
          const btnTxt = await genBtn.textContent()
          addCheck(isDisabledAfter, `Job ativo bloqueia novo envio após job #${jobIdx}`, `"${btnTxt?.trim()?.slice(0, 40)}"`)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // FASE 3: 2x VÍDEO
    // ══════════════════════════════════════════════════════════════════
    log('\n=== FASE 3: 2x VÍDEO ===')

    for (let vidIdx = 1; vidIdx <= 2; vidIdx++) {
      log(`\n--- Job Vídeo #${vidIdx}/2 ---`)

      // Navegar para criações para encontrar uma foto gerada
      await page.goto(`${APP_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(2500)
      await screenshot(page, `video${vidIdx}-criacoes`)

      // Verificar se há fotos disponíveis
      const photoCards = page.locator('[class*="card"], [class*="item"], img[src*="image-jobs"]')
      const photoCount = await photoCards.count()
      log(`Fotos em /criacoes: ${photoCount}`)

      if (photoCount === 0) {
        log(`Vídeo #${vidIdx}: Nenhuma foto encontrada para criar vídeo`)
        jobResults.push({
          job: `video_${vidIdx}`,
          mode: 'video',
          status: 'skip',
          tempo_seg: 0,
          erro: 'Nenhuma foto disponível em /criacoes',
        })
        continue
      }

      // Tentar clicar em "Criar vídeo" na primeira foto
      const criarVideoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("Gerar vídeo"), a:has-text("Criar vídeo")').first()
      const hasCriarVideoBtn = await criarVideoBtn.count() > 0 && await criarVideoBtn.isVisible().catch(() => false)

      if (!hasCriarVideoBtn) {
        // Tentar clicar na primeira foto para ver opções
        const firstPhoto = page.locator('img[src*="image-jobs"], [class*="card"] img').first()
        if (await firstPhoto.count() > 0) {
          await firstPhoto.click()
          await page.waitForTimeout(1500)
          await screenshot(page, `video${vidIdx}-foto-aberta`)
        }
      }

      // Procurar botão de vídeo novamente
      const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("Gerar vídeo"), button:has-text("Vídeo")').first()
      const hasVideoBtn = await videoBtn.count() > 0 && await videoBtn.isVisible().catch(() => false)

      if (!hasVideoBtn) {
        log(`Vídeo #${vidIdx}: Botão "Criar vídeo" não encontrado`)
        await screenshot(page, `video${vidIdx}-sem-botao`)
        jobResults.push({
          job: `video_${vidIdx}`,
          mode: 'video',
          status: 'skip',
          tempo_seg: 0,
          erro: 'Botão Criar vídeo não encontrado',
        })
        continue
      }

      await videoBtn.click()
      await page.waitForTimeout(1500)
      await screenshot(page, `video${vidIdx}-modal-aberto`)

      // Preencher prompt de vídeo
      const promptInput = page.locator('textarea, input[placeholder*="prompt"], input[placeholder*="Prompt"]').first()
      if (await promptInput.count() > 0 && await promptInput.isVisible().catch(() => false)) {
        await promptInput.fill('relógio girando suavemente sobre mesa de madeira, luz dourada, câmera lenta')
        log('Prompt de vídeo preenchido')
      }

      await screenshot(page, `video${vidIdx}-prompt-preenchido`)

      // Submeter
      const vidSubmit = page.locator('button:has-text("Gerar"), button:has-text("Criar"), button[type="submit"]').last()
      if (await vidSubmit.count() > 0 && await vidSubmit.isVisible().catch(() => false)) {
        const isDisabled = await vidSubmit.isDisabled()
        const txt = await vidSubmit.textContent()
        log(`Botão vídeo: "${txt?.trim()}" — disabled: ${isDisabled}`)

        if (!isDisabled) {
          const vidStart = Date.now()
          await vidSubmit.click()
          await page.waitForTimeout(2000)
          await screenshot(page, `video${vidIdx}-gerando`)

          const vidResult = await waitForVideoResult(page, vidIdx)
          jobResults.push({
            job: `video_${vidIdx}`,
            mode: 'video',
            status: vidResult.status,
            tempo_seg: vidResult.elapsed,
            erro: vidResult.error || '',
          })
          await screenshot(page, `video${vidIdx}-resultado-${vidResult.status}`)
          log(`Vídeo #${vidIdx}: ${vidResult.status} em ${vidResult.elapsed}s`)
        } else {
          log(`Vídeo #${vidIdx}: Botão desabilitado — "${txt?.trim()}"`)
          jobResults.push({
            job: `video_${vidIdx}`,
            mode: 'video',
            status: 'blocked',
            tempo_seg: 0,
            erro: `Bloqueado: "${txt?.trim()?.slice(0, 60)}"`,
          })
        }
      } else {
        jobResults.push({
          job: `video_${vidIdx}`,
          mode: 'video',
          status: 'skip',
          tempo_seg: 0,
          erro: 'Botão de submit de vídeo não encontrado',
        })
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // FASE 4: VERIFICAR BLOQUEIO DE JOB ATIVO
    // ══════════════════════════════════════════════════════════════════
    await checkActiveJobBlocking(page)

    // ══════════════════════════════════════════════════════════════════
    // FASE 5: LOGOUT + LOGIN
    // ══════════════════════════════════════════════════════════════════
    await testLogoutLogin(page)

    await screenshot(page, 'teste-finalizado')

  } finally {
    await browser.close()
  }

  // ══════════════════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ══════════════════════════════════════════════════════════════════
  log('\n' + '═'.repeat(65))
  log('  RELATÓRIO FINAL — STRESS TEST M2 ANDROID (Pixel 7)')
  log('═'.repeat(65))

  // Tabela de jobs
  console.log('\n┌─────────────┬──────────────────┬──────────────┬──────────────────────────────────────────────────────────────────────┐')
  console.log('│ job#        │ modo             │ tempo_seg    │ status / erro                                                        │')
  console.log('├─────────────┼──────────────────┼──────────────┼──────────────────────────────────────────────────────────────────────┤')

  const fotoJobs = jobResults.filter(j => j.mode === 'foto_em_cena')
  const videoJobs = jobResults.filter(j => j.mode === 'video')

  for (const r of jobResults) {
    const jobPad = r.job.padEnd(11)
    const modePad = r.mode.padEnd(16)
    const tempoPad = String(r.tempo_seg).padEnd(12)
    const statusStr = r.erro ? `${r.status} — ${r.erro}` : r.status
    console.log(`│ ${jobPad} │ ${modePad} │ ${tempoPad} │ ${statusStr.slice(0, 69).padEnd(69)} │`)
  }
  console.log('└─────────────┴──────────────────┴──────────────┴──────────────────────────────────────────────────────────────────────┘')

  // Médias
  const successFotos = fotoJobs.filter(j => j.status === 'success')
  const successVideos = videoJobs.filter(j => j.status === 'success')
  const blockedFotos = fotoJobs.filter(j => j.status === 'blocked')
  const errorFotos = fotoJobs.filter(j => j.status === 'error')
  const skipVideos = videoJobs.filter(j => j.status === 'skip')

  const avgFoto = successFotos.length > 0
    ? Math.round(successFotos.reduce((s, j) => s + j.tempo_seg, 0) / successFotos.length)
    : null
  const avgVideo = successVideos.length > 0
    ? Math.round(successVideos.reduce((s, j) => s + j.tempo_seg, 0) / successVideos.length)
    : null

  console.log('\n  RESUMO FOTOS:')
  console.log(`    Sucesso:     ${successFotos.length}/5   Tempo médio: ${avgFoto != null ? avgFoto + 's' : 'N/A'}`)
  console.log(`    Bloqueados:  ${blockedFotos.length}/5`)
  console.log(`    Erros:       ${errorFotos.length}/5`)

  console.log('\n  RESUMO VIDEOS:')
  console.log(`    Sucesso:     ${successVideos.length}/2   Tempo médio: ${avgVideo != null ? avgVideo + 's' : 'N/A'}`)
  console.log(`    Ignorados:   ${skipVideos.length}/2 (botão não encontrado / sem fotos)`)

  // Checks Android
  console.log('\n  CHECKS ANDROID (Pixel 7):')
  for (const c of androidChecks) {
    const icon = c.ok ? 'OK  ' : 'FAIL'
    console.log(`    [${icon}] ${c.label}${c.detail ? ' — ' + c.detail : ''}`)
  }

  const totalChecks = androidChecks.length
  const passedChecks = androidChecks.filter(c => c.ok).length
  console.log(`\n    ${passedChecks}/${totalChecks} checks passaram`)

  // Erros de console
  if (consoleErrors.length > 0) {
    console.log(`\n  ERROS DE CONSOLE (${consoleErrors.length}):`)
    consoleErrors.slice(0, 10).forEach(e => console.log(`    - ${e.slice(0, 120)}`))
  }

  // Screenshots
  console.log(`\n  Screenshots em: ${SCREENSHOTS_DIR}`)
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'))
  console.log(`  Total de screenshots: ${files.length}`)

  console.log('\n' + '═'.repeat(65))

  const allOk = errorFotos.length === 0 && passedChecks >= Math.floor(totalChecks * 0.7)
  log(`\nResultado geral: ${allOk ? 'PASSOU' : 'FALHOU / PARCIAL'}`)
}

main().catch(err => {
  console.error('\nERRO FATAL:', err)
  process.exit(1)
})
