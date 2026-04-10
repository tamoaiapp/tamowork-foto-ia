/**
 * stress-m3.mjs — Stress Test Mobile (iPhone SE 375x667)
 * Conta: test-stress-m3@tamowork.test | StressM3@2026
 * Testes: 5x foto (catálogo + óculos) + 2x vídeo
 * Checks: layout mobile tela pequena (375px)
 *
 * Run: node stress-m3.mjs
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Notebook/node_modules/playwright')
import https from 'https'
import fs from 'fs'
import path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────
const APP_URL = 'https://tamowork.com'
const EMAIL = 'test-stress-m3@tamowork.test'
const PASSWORD = 'StressM3@2026'
const SCREENSHOTS_DIR = 'C:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m3'
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY'
const PRODUCT_IMAGE_URL = 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800'
const PRODUCT_NAME = 'Óculos de sol aviador'
const JOB_TIMEOUT_MS = 4 * 60 * 1000  // 4 min por job
const JOB_POLL_MS = 5000

// iPhone SE viewport
const IPHONE_SE = {
  viewport: { width: 375, height: 667 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
}

// ─── State ────────────────────────────────────────────────────────────────────
let stepNum = 0
const jobResults = []
const layoutBugs = []

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

async function shot(page, name) {
  stepNum++
  const file = path.join(SCREENSHOTS_DIR, `${String(stepNum).padStart(3, '0')}-${name}.png`)
  try {
    await page.screenshot({ path: file, fullPage: false })
    log(`📸 ${file}`)
  } catch (e) {
    log(`Screenshot falhou: ${e.message}`)
  }
  return file
}

// ─── Supabase HTTP helper ─────────────────────────────────────────────────────
function supaReq(method, endpoint, body, key = SERVICE_KEY) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + endpoint)
    const bodyStr = body ? JSON.stringify(body) : ''
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── Download imagem de teste (óculos) ───────────────────────────────────────
async function getTestImage() {
  const imgPath = path.join(SCREENSHOTS_DIR, 'oculos-test.jpg')
  if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 5000) {
    log(`Usando imagem existente: ${imgPath}`)
    return imgPath
  }
  log(`Baixando imagem de óculos: ${PRODUCT_IMAGE_URL}`)
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath)
    const doGet = (url, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return }
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          log(`Redirect (${res.statusCode}) → ${res.headers.location}`)
          doGet(res.headers.location, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve(imgPath) })
      }).on('error', (err) => { fs.unlink(imgPath, () => {}); reject(err) })
    }
    doGet(PRODUCT_IMAGE_URL)
  })
}

// ─── Setup conta PRO ──────────────────────────────────────────────────────────
async function setupProAccount() {
  log('=== Setup conta PRO ===')

  // 1. Criar ou obter usuário
  let userId = null

  const createResp = await supaReq('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })

  if (createResp.status === 200 || createResp.status === 201) {
    userId = createResp.body.id
    log(`✓ Usuário criado: ${userId}`)
  } else {
    log(`Usuário já existe (${createResp.status}) — fazendo login para obter ID`)
    const loginResp = await supaReq('POST', '/auth/v1/token?grant_type=password', {
      email: EMAIL, password: PASSWORD,
    }, ANON_KEY)

    if (loginResp.status === 200) {
      userId = loginResp.body.user?.id
      log(`✓ ID via login: ${userId}`)
    } else {
      // Admin list
      log('Tentando admin list...')
      const listResp = await supaReq('GET', '/auth/v1/admin/users?page=1&per_page=200', null)
      if (listResp.status === 200) {
        const found = (listResp.body.users || []).find(u => u.email === EMAIL)
        if (found) {
          userId = found.id
          log(`✓ ID via list: ${userId}`)
          // Atualizar senha
          await supaReq('PUT', `/auth/v1/admin/users/${userId}`, { password: PASSWORD })
          log('✓ Senha atualizada')
        }
      }
    }
  }

  if (!userId) {
    throw new Error('Não conseguiu obter user_id')
  }

  // 2. Upsert user_plans PRO
  const planResp = await supaReq('POST', '/rest/v1/user_plans', {
    user_id: userId,
    plan: 'pro',
    period_end: '2027-12-31',
  })
  if ([200, 201, 204].includes(planResp.status)) {
    log(`✓ Plano PRO ativo (HTTP ${planResp.status})`)
  } else {
    log(`Upsert plan retornou ${planResp.status} — tentando PATCH`)
    const patchResp = await supaReq('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
      plan: 'pro', period_end: '2027-12-31',
    })
    log(`PATCH result: ${patchResp.status}`)
  }

  // 3. Salvar credenciais
  fs.writeFileSync(
    'c:/Users/Notebook/tamowork-foto-ia/stress-m3-credentials.json',
    JSON.stringify({ userId, email: EMAIL, password: PASSWORD }, null, 2)
  )
  log(`✓ Credenciais salvas — userId=${userId}`)
  return userId
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function doLogin(page) {
  log('Navegando para /login...')
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  await shot(page, 'login-page')

  // Expandir campos de e-mail (botão "Usar e-mail e senha")
  const emailToggle = page.locator('button').filter({ hasText: /usar e-mail/i }).first()
  if (await emailToggle.count() > 0) {
    await emailToggle.click()
    await page.waitForTimeout(800)
    log('Clicou em "Usar e-mail e senha"')
  }

  // Garantir que estamos na aba "Entrar" (não "Criar conta")
  const entrarTab = page.locator('button').filter({ hasText: /^Entrar$/ }).first()
  if (await entrarTab.count() > 0) {
    await entrarTab.click()
    await page.waitForTimeout(400)
  }

  // Aguardar input de email aparecer
  await page.locator('input[type="email"]').first().waitFor({ timeout: 5000 }).catch(() => {})

  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await shot(page, 'login-preenchido')

  // Submit — "Entrar" no form (pode ter múltiplos botões Entrar — o do form é o submit)
  const submitBtn = page.locator('form button').filter({ hasText: /^Entrar$/ }).first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
  } else {
    await page.locator('input[type="password"]').first().press('Enter')
  }

  await page.waitForTimeout(6000)
  const url = page.url()
  log(`URL após login: ${url}`)

  // Pular onboarding
  if (url.includes('/onboarding')) {
    log('Em onboarding — pulando via localStorage...')
    await page.evaluate(() => localStorage.setItem('tw_onboarding_done', '1'))
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
  }

  const finalUrl = page.url()
  const loggedIn = !finalUrl.includes('/login')
  log(`Login: ${loggedIn ? 'OK' : 'FALHOU'} — ${finalUrl}`)
  return loggedIn
}

// ─── Upload de imagem ─────────────────────────────────────────────────────────
async function uploadImage(page, imgPath) {
  // O input[type=file] existe mas com display:none — setInputFiles funciona mesmo assim
  const fileInputs = page.locator('input[type="file"]')
  const count = await fileInputs.count()
  log(`Inputs file encontrados: ${count}`)

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      try {
        // setInputFiles funciona em inputs hidden no Playwright
        await fileInputs.nth(i).setInputFiles(imgPath, { noWaitAfter: false })
        await page.waitForTimeout(2000)
        log(`Upload via input #${i} OK`)
        return true
      } catch (e) {
        log(`Input #${i} falhou: ${e.message}`)
      }
    }
  }

  // Fallback: filechooser via click na área de upload
  log('Tentando upload via filechooser...')
  const uploadArea = page.locator('[class*="drop"], [class*="Drop"], [class*="upload"], [class*="Upload"], [class*="picker"]').first()
  if (await uploadArea.count() > 0) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 6000 }).catch(() => null),
      uploadArea.click(),
    ])
    if (fileChooser) {
      await fileChooser.setFiles(imgPath)
      await page.waitForTimeout(2000)
      log('Upload via filechooser OK')
      return true
    }
  }

  // Fallback base64 evaluate
  log('Tentando upload via base64 evaluate...')
  const b64 = fs.readFileSync(imgPath).toString('base64')
  const done = await page.evaluate(async (b64data) => {
    const inputs = document.querySelectorAll('input[type="file"]')
    if (!inputs.length) return false
    const byteString = atob(b64data)
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: 'image/jpeg' })
    const file = new File([blob], 'oculos.jpg', { type: 'image/jpeg' })
    const dt = new DataTransfer()
    dt.items.add(file)
    inputs[0].files = dt.files
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, b64)
  if (done) {
    await page.waitForTimeout(2000)
    log('Upload via evaluate OK')
  }
  return done
}

// ─── Selecionar modo catálogo ─────────────────────────────────────────────────
async function selectCatalogMode(page) {
  await page.waitForTimeout(1000)

  // Os cards de modo têm classe .mode-card
  const modeCards = page.locator('.mode-card')
  const cardCount = await modeCards.count()
  log(`mode-card encontrados: ${cardCount}`)

  if (cardCount === 0) {
    log('AVISO: nenhum .mode-card — tentando seletores alternativos')
    const altCard = page.locator('[class*="mode-card"], [class*="modeCard"]').first()
    if (await altCard.count() > 0) {
      await altCard.click()
      await page.waitForTimeout(1500)
      return true
    }
    return false
  }

  // Tentar encontrar card "Catálogo" ou "Fundo branco" (1º modo free)
  // Modo catálogo = "Fundo branco" (fundo limpo, similar a catálogo)
  // Índices: 0=Fundo branco, 1=Foto em cena, 2=Com modelo, 3=Vídeo(PRO), 4=Post de promoção, 5=Do meu jeito
  for (let i = 0; i < cardCount; i++) {
    const card = modeCards.nth(i)
    const text = await card.textContent().catch(() => '')
    if (/catálogo|fundo branco|catalog/i.test(text)) {
      await card.click()
      log(`Modo catálogo/fundo branco selecionado (card #${i}): "${text.trim().slice(0, 40)}"`)
      await page.waitForTimeout(1500)
      return true
    }
  }

  // Fallback: primeiro card disponível (não PRO)
  log('Catálogo não encontrado — usando primeiro card disponível')
  await modeCards.first().click()
  await page.waitForTimeout(1500)
  return true
}

// ─── Preencher campos e submeter ──────────────────────────────────────────────
async function fillAndSubmit(page, imgPath) {
  // Upload
  const uploaded = await uploadImage(page, imgPath)
  if (!uploaded) {
    log('ERRO: upload falhou — nenhuma técnica funcionou')
    return false
  }

  // Verificar se a imagem foi reconhecida pela UI (preview aparece)
  await page.waitForTimeout(1000)
  const uploadRecognized = await page.evaluate(() => {
    // Procurar preview de imagem ou mudança de estado
    const preview = document.querySelector('[class*="preview"], [class*="Preview"], img[class*="thumb"], img[class*="product"]')
    const fileInput = document.querySelector('input[type="file"]')
    return {
      hasPreview: !!preview,
      fileInputHasFiles: fileInput?.files?.length > 0,
    }
  })
  log(`Upload reconhecido pela UI: preview=${uploadRecognized.hasPreview}, files=${uploadRecognized.fileInputHasFiles}`)

  await shot(page, `upload-ok`)

  // Campo produto
  const produtoSelectors = [
    'input[placeholder*="produto"]',
    'input[placeholder*="Produto"]',
    'input[placeholder*="Product"]',
    'input[placeholder*="item"]',
    'textarea[placeholder*="produto"]',
    'input[name*="product"]',
    'input[name*="produto"]',
  ]
  for (const sel of produtoSelectors) {
    const inp = page.locator(sel).first()
    if (await inp.count() > 0 && await inp.isVisible().catch(() => false)) {
      await inp.fill(PRODUCT_NAME)
      log(`Campo produto preenchido: "${PRODUCT_NAME}"`)
      break
    }
  }

  await page.waitForTimeout(500)

  // Botão de gerar/criar
  const gerarSelectors = [
    'form button[type="submit"]',
    'button:has-text("Criar foto")',
    'button:has-text("Gerar")',
    'button:has-text("Criar")',
    'button:has-text("Generate")',
  ]

  let gerarBtn = null
  for (const sel of gerarSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
      gerarBtn = btn
      break
    }
  }

  if (!gerarBtn) {
    // Genérico
    gerarBtn = page.locator('button').filter({ hasText: /^(Criar|Gerar|Criar foto|Criar imagem|Generate)$/i }).first()
  }

  if (!gerarBtn || !(await gerarBtn.count() > 0)) {
    log('ERRO: botão de gerar não encontrado')
    await shot(page, 'sem-botao-gerar')
    return false
  }

  const isDisabled = await gerarBtn.isDisabled().catch(() => false)
  const btnText = await gerarBtn.textContent().catch(() => '')
  log(`Botão encontrado: "${btnText?.trim()}" disabled=${isDisabled}`)

  if (isDisabled) {
    log('Botão desabilitado (rate limit ou formulário inválido)')
    await shot(page, 'btn-disabled')
    return false
  }

  await gerarBtn.click()
  await page.waitForTimeout(2000)
  log('Job submetido')
  return true
}

// ─── Aguardar resultado ───────────────────────────────────────────────────────
async function waitForResult(page, jobIdx, jobType = 'photo') {
  const start = Date.now()
  log(`Aguardando resultado do job #${jobIdx} (${jobType})... (máx ${JOB_TIMEOUT_MS / 1000}s)`)

  let status = 'timeout'
  let erro = ''

  for (let i = 0; i * JOB_POLL_MS < JOB_TIMEOUT_MS; i++) {
    await page.waitForTimeout(JOB_POLL_MS)

    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '')
    const hasOutputImg = await page.locator('img[src*="image-jobs"], img[src*="supabase"], video[src*="supabase"], video[src*="image-jobs"]').count().then(c => c > 0).catch(() => false)
    const hasVideo = jobType === 'video' && await page.locator('video').count().then(c => c > 0).catch(() => false)
    const hasError = bodyText.includes('Algo deu errado') || bodyText.includes('deu errado') || bodyText.includes('Erro ao')
    const stillGen = bodyText.includes('Gerando') || bodyText.includes('gerando') || bodyText.includes('Aguarde') || bodyText.includes('Processando')

    if ((hasOutputImg || hasVideo) && !stillGen) {
      status = 'done'
      break
    }
    if (hasError) {
      status = 'failed'
      erro = bodyText.match(/(Algo deu errado[^.]*\.|Erro ao[^.]*\.)/)?.[0] || 'erro desconhecido'
      break
    }

    if (i % 3 === 0) {
      const elapsed = Math.round((Date.now() - start) / 1000)
      log(`  Aguardando... ${elapsed}s`)
      await shot(page, `job${jobIdx}-aguardando-${elapsed}s`)
    }
  }

  const elapsed = Math.round((Date.now() - start) / 1000)
  return { status, elapsed, erro }
}

// ─── Checks de layout mobile (375px) ─────────────────────────────────────────
async function checkMobileLayout(page, phase) {
  log(`\n=== Checks de Layout Mobile (${phase}) ===`)

  const bugs = []

  // 1. Overflow horizontal
  const overflowX = await page.evaluate(() => {
    const bodyW = document.body.scrollWidth
    const winW = window.innerWidth
    return { bodyW, winW, overflow: bodyW > winW + 5 }
  })
  if (overflowX.overflow) {
    bugs.push(`OVERFLOW HORIZONTAL: body.scrollWidth=${overflowX.bodyW} > window.innerWidth=${overflowX.winW}`)
  }
  log(`Overflow horizontal: ${overflowX.overflow ? `BUG (${overflowX.bodyW}px > ${overflowX.winW}px)` : 'OK'}`)

  // 2. BottomNav não sobrepõe conteúdo
  const bottomNavCheck = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*')
    for (const el of allEls) {
      const style = window.getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (style.position === 'fixed' && rect.bottom >= window.innerHeight - 5 && rect.height > 40 && rect.height < 120) {
        // Verificar se o main content tem padding-bottom suficiente
        const mainEls = document.querySelectorAll('main, [class*="content"], [class*="main"]')
        for (const main of mainEls) {
          const mainStyle = window.getComputedStyle(main)
          const pb = parseInt(mainStyle.paddingBottom)
          if (pb < rect.height - 10) {
            return { ok: false, navH: rect.height, contentPb: pb }
          }
        }
        return { ok: true, navH: rect.height }
      }
    }
    return { ok: true, navH: 0, note: 'sem bottom nav fixo detectado' }
  })
  if (!bottomNavCheck.ok) {
    bugs.push(`BOTTOM NAV SOBREPOSIÇÃO: navH=${bottomNavCheck.navH}px, content padding-bottom=${bottomNavCheck.contentPb}px`)
  }
  log(`BottomNav sobreposição: ${bottomNavCheck.ok ? 'OK' : `BUG (navH=${bottomNavCheck.navH}, pb=${bottomNavCheck.contentPb})`}`)

  // 3. Botões com altura mínima de 44px
  const smallBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, [role="button"], a.btn, [class*="btn"]')
    const small = []
    for (const btn of btns) {
      const rect = btn.getBoundingClientRect()
      const style = window.getComputedStyle(btn)
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0) continue
      if (rect.height > 0 && rect.height < 44) {
        small.push({ text: btn.textContent?.trim().slice(0, 30), h: Math.round(rect.height) })
      }
    }
    return small.slice(0, 5)
  })
  if (smallBtns.length > 0) {
    bugs.push(`BOTÕES PEQUENOS (<44px): ${smallBtns.map(b => `"${b.text}" (${b.h}px)`).join(', ')}`)
  }
  log(`Botões <44px: ${smallBtns.length === 0 ? 'nenhum (OK)' : smallBtns.map(b => `"${b.text}"=${b.h}px`).join(', ')}`)

  // 4. Texto com fonte < 12px
  const tinyText = await page.evaluate(() => {
    const els = document.querySelectorAll('p, span, div, h1, h2, h3, h4, label, button')
    const found = []
    for (const el of els) {
      const style = window.getComputedStyle(el)
      const size = parseFloat(style.fontSize)
      const rect = el.getBoundingClientRect()
      if (size < 12 && rect.width > 0 && rect.height > 0 && el.textContent?.trim().length > 2) {
        found.push({ tag: el.tagName, text: el.textContent?.trim().slice(0, 20), size })
        if (found.length >= 5) break
      }
    }
    return found
  })
  if (tinyText.length > 0) {
    bugs.push(`FONTE PEQUENA (<12px): ${tinyText.map(t => `"${t.text}"=${t.size}px`).join(', ')}`)
  }
  log(`Fonte <12px: ${tinyText.length === 0 ? 'nenhuma (OK)' : tinyText.map(t => `"${t.text}"=${t.size}px`).join(', ')}`)

  // 5. Cards de modo visíveis sem scroll horizontal
  const modesCheck = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="mode"], [class*="Mode"], [class*="card"], [class*="Card"]')
    let cutoff = 0
    for (const c of cards) {
      const rect = c.getBoundingClientRect()
      if (rect.right > window.innerWidth + 5) cutoff++
    }
    return cutoff
  })
  if (modesCheck > 0) {
    bugs.push(`CARDS CORTADOS: ${modesCheck} card(s) ultrapassam a tela (overflow-x)`)
  }
  log(`Cards cortados: ${modesCheck === 0 ? 'nenhum (OK)' : modesCheck}`)

  // 6. Resultado de foto cabe na tela
  const resultImgCheck = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="image-jobs"], img[src*="supabase"]')
    for (const img of imgs) {
      const rect = img.getBoundingClientRect()
      if (rect.right > window.innerWidth + 5) {
        return { ok: false, right: rect.right, win: window.innerWidth }
      }
    }
    return { ok: true }
  })
  if (!resultImgCheck.ok) {
    bugs.push(`IMAGEM RESULTADO OVERFLOW: right=${resultImgCheck.right}px > win=${resultImgCheck.win}px`)
  }

  // 7. Botões Baixar e Editar lado a lado
  const downloadEditCheck = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b =>
      /baixar|download|editar|edit/i.test(b.textContent || '')
    )
    if (btns.length < 2) return { ok: true, note: `só ${btns.length} btn(s) encontrado(s)` }
    const rects = btns.map(b => b.getBoundingClientRect())
    for (const r of rects) {
      if (r.right > window.innerWidth + 5) {
        return { ok: false, right: r.right, win: window.innerWidth }
      }
    }
    // Verificar se estão na mesma linha (mesmo y aproximado) sem quebrar
    if (rects.length >= 2) {
      const yDiff = Math.abs(rects[0].y - rects[1].y)
      if (yDiff > 60) {
        return { ok: false, note: `botões em linhas diferentes (yDiff=${yDiff}px)`, yDiff }
      }
    }
    return { ok: true }
  })
  if (!downloadEditCheck.ok) {
    bugs.push(`BOTÕES BAIXAR/EDITAR: ${downloadEditCheck.note || `overflow (right=${downloadEditCheck.right})`}`)
  }
  log(`Botões Baixar/Editar: ${downloadEditCheck.ok ? 'OK' : `BUG — ${downloadEditCheck.note || 'overflow'}`}`)

  layoutBugs.push(...bugs.map(b => `[${phase}] ${b}`))

  await shot(page, `layout-check-${phase.replace(/\s+/g, '-')}`)
  return bugs
}

// ─── Rodar um job de foto ─────────────────────────────────────────────────────
async function runPhotoJob(page, imgPath, jobIdx) {
  log(`\n${'═'.repeat(50)}`)
  log(`FOTO JOB #${jobIdx}`)
  log('═'.repeat(50))

  const jobStart = Date.now()

  try {
    // Garantir que está na home
    const currUrl = page.url()
    if (!currUrl.match(/^https:\/\/tamowork\.com\/?$/) && !currUrl.includes('/?')) {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(2000)
    }

    await shot(page, `foto${jobIdx}-home`)

    // Selecionar modo catálogo
    const modeSelected = await selectCatalogMode(page)
    log(`Modo catálogo: ${modeSelected ? 'OK' : 'AVISO — não selecionado'}`)

    await shot(page, `foto${jobIdx}-modo-selecionado`)

    // Layout check antes de submeter
    await checkMobileLayout(page, `foto-${jobIdx}-pre-submit`)

    // Upload e submit
    const submitted = await fillAndSubmit(page, imgPath)
    if (!submitted) {
      const elapsed = Math.round((Date.now() - jobStart) / 1000)
      await shot(page, `foto${jobIdx}-submit-falhou`)
      jobResults.push({ job: `foto#${jobIdx}`, tempo_seg: elapsed, status: 'submit_falhou', erro: 'upload ou submit falhou' })
      return
    }

    await shot(page, `foto${jobIdx}-gerando`)

    // Aguardar resultado
    const { status, elapsed, erro } = await waitForResult(page, jobIdx, 'photo')
    log(`Job #${jobIdx}: ${status} em ${elapsed}s`)

    await shot(page, `foto${jobIdx}-resultado`)

    // Layout check pós resultado
    if (status === 'done') {
      const bugs = await checkMobileLayout(page, `foto-${jobIdx}-resultado`)
      log(`Bugs layout resultado: ${bugs.length}`)

      // Verificar botões Baixar e Editar
      const downloadBtn = page.locator('button').filter({ hasText: /baixar|download/i }).first()
      const hasDownload = await downloadBtn.count() > 0 && await downloadBtn.isVisible().catch(() => false)
      log(`Botão Baixar: ${hasDownload ? 'presente' : 'ausente'}`)

      await shot(page, `foto${jobIdx}-botoes`)
    }

    jobResults.push({
      job: `foto#${jobIdx}`,
      tempo_seg: elapsed,
      status,
      erro: erro || '',
    })

    // Voltar para home para próximo job
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

  } catch (err) {
    const elapsed = Math.round((Date.now() - jobStart) / 1000)
    log(`ERRO no job #${jobIdx}: ${err.message}`)
    await shot(page, `foto${jobIdx}-erro`).catch(() => {})
    jobResults.push({ job: `foto#${jobIdx}`, tempo_seg: elapsed, status: 'erro', erro: err.message })
  }
}

// ─── Rodar um job de vídeo ────────────────────────────────────────────────────
async function runVideoJob(page, imgPath, jobIdx) {
  log(`\n${'═'.repeat(50)}`)
  log(`VÍDEO JOB #${jobIdx}`)
  log('═'.repeat(50))

  const jobStart = Date.now()

  try {
    // Garantir que está na home
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

    await shot(page, `video${jobIdx}-home`)

    // Procurar modo vídeo via .mode-card
    // Índices: 0=Fundo branco, 1=Foto em cena, 2=Com modelo, 3=Vídeo(PRO), 4=Post promoção, 5=Do meu jeito
    const modeCards = page.locator('.mode-card')
    const cardCount = await modeCards.count()
    log(`mode-cards encontrados: ${cardCount}`)

    let videoModeSelected = false
    for (let i = 0; i < cardCount; i++) {
      const card = modeCards.nth(i)
      const text = await card.textContent().catch(() => '')
      if (/vídeo|video/i.test(text)) {
        await card.click()
        log(`Modo vídeo selecionado (card #${i}): "${text.trim().slice(0, 40)}"`)
        videoModeSelected = true
        await page.waitForTimeout(1500)
        break
      }
    }

    if (!videoModeSelected) {
      log('Modo vídeo não encontrado por texto — tentando card #3 (PRO Vídeo)')
      if (cardCount >= 4) {
        await modeCards.nth(3).click()
        videoModeSelected = true
        await page.waitForTimeout(1500)
      }
    }

    await shot(page, `video${jobIdx}-modo`)

    // Layout check
    await checkMobileLayout(page, `video-${jobIdx}-pre`)

    // Upload e submit
    const submitted = await fillAndSubmit(page, imgPath)
    if (!submitted) {
      const elapsed = Math.round((Date.now() - jobStart) / 1000)
      await shot(page, `video${jobIdx}-submit-falhou`)

      // Verificar se foi bloqueado por PRO check
      const bodyText = await page.evaluate(() => document.body.innerText)
      const isProWall = /pro|assinar|plano|plan|upgrade/i.test(bodyText)
      jobResults.push({
        job: `video#${jobIdx}`,
        tempo_seg: elapsed,
        status: isProWall ? 'bloqueado_pro' : 'submit_falhou',
        erro: isProWall ? 'pro wall ativo (conta deveria ser PRO)' : 'submit falhou',
      })
      return
    }

    await shot(page, `video${jobIdx}-gerando`)

    // Aguardar resultado
    const { status, elapsed, erro } = await waitForResult(page, jobIdx, 'video')
    log(`Vídeo Job #${jobIdx}: ${status} em ${elapsed}s`)

    await shot(page, `video${jobIdx}-resultado`)

    if (status === 'done') {
      await checkMobileLayout(page, `video-${jobIdx}-resultado`)
    }

    jobResults.push({
      job: `video#${jobIdx}`,
      tempo_seg: elapsed,
      status,
      erro: erro || '',
    })

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

  } catch (err) {
    const elapsed = Math.round((Date.now() - jobStart) / 1000)
    log(`ERRO vídeo #${jobIdx}: ${err.message}`)
    await shot(page, `video${jobIdx}-erro`).catch(() => {})
    jobResults.push({ job: `video#${jobIdx}`, tempo_seg: elapsed, status: 'erro', erro: err.message })
  }
}

// ─── Imprimir relatório final ─────────────────────────────────────────────────
function printReport() {
  console.log('\n')
  console.log('═'.repeat(65))
  console.log('  RELATÓRIO STRESS TEST M3 — iPhone SE 375x667')
  console.log('  Data: ' + new Date().toISOString().slice(0, 19).replace('T', ' '))
  console.log('═'.repeat(65))

  console.log('\n📊 TABELA DE JOBS:')
  console.log('─'.repeat(65))
  console.log(`${'Job'.padEnd(12)} ${'Tempo'.padEnd(8)} ${'Status'.padEnd(18)} Erro`)
  console.log('─'.repeat(65))
  for (const r of jobResults) {
    const statusIcon = r.status === 'done' ? '✅' : r.status === 'timeout' ? '⏱️' : '❌'
    console.log(`${r.job.padEnd(12)} ${(r.tempo_seg + 's').padEnd(8)} ${(statusIcon + ' ' + r.status).padEnd(20)} ${r.erro || '—'}`)
  }
  console.log('─'.repeat(65))

  const done = jobResults.filter(r => r.status === 'done').length
  const total = jobResults.length
  const tempos = jobResults.filter(r => r.status === 'done').map(r => r.tempo_seg)
  const avgTempo = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0

  console.log(`\nResumo: ${done}/${total} jobs concluídos com sucesso`)
  if (avgTempo) console.log(`Tempo médio (jobs concluídos): ${avgTempo}s`)

  console.log('\n🔍 BUGS DE LAYOUT MOBILE (375px):')
  if (layoutBugs.length === 0) {
    console.log('  ✅ Nenhum bug de layout detectado')
  } else {
    for (const bug of layoutBugs) {
      console.log(`  ❌ ${bug}`)
    }
  }

  console.log('\n📁 Screenshots em: ' + SCREENSHOTS_DIR)
  console.log('═'.repeat(65))
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  console.log('═'.repeat(65))
  console.log('  STRESS TEST M3 — TamoWork Foto IA')
  console.log('  Device: iPhone SE (375x667, isMobile, hasTouch)')
  console.log(`  Email: ${EMAIL}`)
  console.log('═'.repeat(65))

  // 1. Setup conta PRO
  let userId
  try {
    userId = await setupProAccount()
    log(`✓ Conta PRO pronta — userId=${userId}`)
  } catch (err) {
    log(`ERRO no setup PRO: ${err.message}`)
    process.exit(1)
  }

  // 2. Download imagem de óculos
  let testImagePath
  try {
    testImagePath = await getTestImage()
    log(`✓ Imagem de teste: ${testImagePath} (${fs.statSync(testImagePath).size} bytes)`)
  } catch (err) {
    log(`ERRO ao baixar imagem: ${err.message}`)
    process.exit(1)
  }

  // 3. Iniciar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  })

  const context = await browser.newContext({
    ...IPHONE_SE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
  })

  const page = await context.newPage()

  const consoleErrs = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrs.push(msg.text()) })
  page.on('pageerror', err => consoleErrs.push(`PAGE ERROR: ${err.message}`))

  try {
    // 4. Login
    log('\n=== FASE 1: LOGIN ===')
    const loggedIn = await doLogin(page)
    if (!loggedIn) {
      log('ERRO: login falhou — abortando')
      await shot(page, 'login-falhou')
      await browser.close()
      printReport()
      process.exit(1)
    }
    await shot(page, 'login-ok')

    // 5. Layout check inicial (home)
    log('\n=== FASE 2: LAYOUT CHECK INICIAL ===')
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    await shot(page, 'home-inicial')
    const initBugs = await checkMobileLayout(page, 'home-inicial')
    log(`Bugs na home: ${initBugs.length}`)

    // 6. 5x jobs de foto
    log('\n=== FASE 3: 5x JOBS DE FOTO (CATÁLOGO + ÓCULOS) ===')
    for (let i = 1; i <= 5; i++) {
      await runPhotoJob(page, testImagePath, i)
      if (i < 5) {
        log(`Pausa de 3s entre jobs...`)
        await page.waitForTimeout(3000)
      }
    }

    // 7. 2x jobs de vídeo
    log('\n=== FASE 4: 2x JOBS DE VÍDEO ===')
    for (let i = 1; i <= 2; i++) {
      await runVideoJob(page, testImagePath, i)
      if (i < 2) {
        log(`Pausa de 3s entre jobs de vídeo...`)
        await page.waitForTimeout(3000)
      }
    }

    // 8. Layout check final
    log('\n=== FASE 5: LAYOUT CHECK FINAL ===')
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)
    await shot(page, 'layout-final')
    await checkMobileLayout(page, 'final')

    // 9. Console errors
    if (consoleErrs.length > 0) {
      log(`\nConsole errors (${consoleErrs.length}):`)
      consoleErrs.slice(0, 10).forEach(e => log(`  [JS ERROR] ${e.slice(0, 120)}`))
    }

  } catch (err) {
    log(`ERRO FATAL: ${err.message}`)
    await shot(page, 'erro-fatal').catch(() => {})
  } finally {
    await browser.close()
  }

  printReport()
}

main().catch(err => {
  console.error('ERRO FATAL:', err)
  process.exit(1)
})
