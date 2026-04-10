// test-pro-c1.mjs — Agente de teste overnight TamoWork Foto IA
// Conta PRO, foco em geração de VÍDEO. 3 iterações completas foto → vídeo.
// Playwright headless:true, viewport 1440x900.
// Conta: pro-c1@tamowork.test | ProC1@2026
// Screenshots: test-screenshots/pro-c1/
// Relatório JSON: test-screenshots/pro-c1/report.json

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import https from 'https'

// ── Configuração ──────────────────────────────────────────────────────────────
const SCREENSHOTS_DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/pro-c1'
const REPORT_PATH = path.join(SCREENSHOTS_DIR, 'report.json')
const SITE_URL = 'https://tamowork.com'
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'
const EMAIL = 'pro-c1@tamowork.test'
const PASSWORD = 'ProC1@2026'
const IMAGE_URL = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'
const IMAGE_PATH = path.join(SCREENSHOTS_DIR, 'relogio-test.jpg')
const PRODUTO_DESC = 'Relógio dourado'
const CENARIO_DESC = 'mesa de escritório'
const VIDEO_PROMPT = 'produto girando suavemente com luz suave'
const TOTAL_ITERACOES = 3
const FOTO_POLL_MS = 10_000
const FOTO_TIMEOUT_MS = 8 * 60 * 1000
const VIDEO_POLL_MS = 15_000
const VIDEO_TIMEOUT_MS = 15 * 60 * 1000

// ── Utilitários ───────────────────────────────────────────────────────────────
const results = []
let userId = null

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[${ts}] ${msg}`)
}

function ss(page, name) {
  const fpath = path.join(SCREENSHOTS_DIR, `${name}.png`)
  return page.screenshot({ path: fpath, fullPage: false }).catch(e => log(`WARN screenshot "${name}": ${e.message}`))
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function supabaseRequest(method, path_, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path_}`)
    const payload = body ? JSON.stringify(body) : null
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function downloadImage() {
  if (fs.existsSync(IMAGE_PATH)) {
    log('Imagem de teste já existe, reutilizando.')
    return
  }
  log(`Baixando imagem de teste: ${IMAGE_URL}`)
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(IMAGE_PATH)
    const get = (url, redirect = 0) => {
      if (redirect > 5) return reject(new Error('Muitos redirects'))
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location, redirect + 1)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          return reject(new Error(`HTTP ${res.statusCode} ao baixar imagem`))
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); log('Imagem baixada com sucesso.'); resolve() })
      }).on('error', (e) => { file.close(); reject(e) })
    }
    get(IMAGE_URL)
  })
}

// ── Criar / promover conta PRO ────────────────────────────────────────────────
async function ensureProAccount() {
  log('=== Verificando conta PRO ===')

  // 1. Tenta criar usuário
  log(`Criando usuário ${EMAIL}...`)
  const createRes = await supabaseRequest('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (createRes.status === 200 || createRes.status === 201) {
    userId = createRes.body.id
    log(`Usuário criado: ${userId}`)
  } else if (createRes.status === 422 && JSON.stringify(createRes.body).includes('already')) {
    log('Usuário já existe — buscando ID...')
    // Busca por email
    const listRes = await supabaseRequest('GET', `/auth/v1/admin/users?filter=${encodeURIComponent(EMAIL)}&page=1&per_page=10`)
    const users = listRes.body?.users ?? listRes.body
    const found = Array.isArray(users) ? users.find(u => u.email === EMAIL) : null
    if (found) {
      userId = found.id
      log(`Usuário encontrado: ${userId}`)
    } else {
      // Tenta listar todos e filtrar
      log('WARN: não encontrou por filter, tentando lista geral...')
      const allRes = await supabaseRequest('GET', '/auth/v1/admin/users?page=1&per_page=50')
      const allUsers = allRes.body?.users ?? allRes.body ?? []
      const u = Array.isArray(allUsers) ? allUsers.find(u => u.email === EMAIL) : null
      if (u) {
        userId = u.id
        log(`Usuário encontrado na lista geral: ${userId}`)
      } else {
        throw new Error('Não conseguiu obter user ID — verifique as credenciais')
      }
    }
  } else {
    throw new Error(`Erro ao criar usuário: ${createRes.status} — ${JSON.stringify(createRes.body)}`)
  }

  // 2. Upsert em user_plans → plan=pro, period_end=2027-12-31
  log(`Promovendo ${userId} para PRO (period_end: 2027-12-31)...`)
  const planRes = await supabaseRequest('POST', '/rest/v1/user_plans', {
    user_id: userId,
    plan: 'pro',
    period_end: '2027-12-31T23:59:59Z',
  })
  if (planRes.status >= 200 && planRes.status < 300) {
    log('Plano PRO inserido.')
  } else if (planRes.status === 409) {
    // conflict — update
    log('Registro já existe — atualizando...')
    const updRes = await supabaseRequest('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
      plan: 'pro',
      period_end: '2027-12-31T23:59:59Z',
    })
    log(`Update user_plans: ${updRes.status}`)
  } else {
    log(`WARN: upsert user_plans status=${planRes.status}: ${JSON.stringify(planRes.body)}`)
    // Tenta update direto
    await supabaseRequest('PATCH', `/rest/v1/user_plans?user_id=eq.${userId}`, {
      plan: 'pro',
      period_end: '2027-12-31T23:59:59Z',
    })
  }

  log(`Conta PRO pronta. user_id=${userId}`)
}

// ── Login no browser ──────────────────────────────────────────────────────────
async function loginBrowser(page) {
  log('=== Login no browser ===')
  await page.goto(`${SITE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  await ss(page, '00-login-page')

  // Toggle e-mail/senha se necessário
  const toggle = page.locator('button:has-text("Usar e-mail e senha"), button:has-text("e-mail e senha")').first()
  if (await toggle.count() > 0) {
    await toggle.click()
    log('Clicado em "Usar e-mail e senha"')
    await page.waitForTimeout(1000)
  }

  const emailInput = page.locator('input[type="email"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 15000 })
  await emailInput.fill(EMAIL)

  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(PASSWORD)
  await ss(page, '01-login-filled')

  // Submit
  const submitBtn = page.locator('form button[type="submit"], form button:has-text("Entrar")').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
  } else {
    await passwordInput.press('Enter')
  }

  // Aguarda redirecionamento
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 25000 })

  if (page.url().includes('/onboarding')) {
    log('Redirecionado para onboarding — indo para home...')
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  }

  log(`Login OK! URL: ${page.url()}`)
  await page.waitForTimeout(3000)
  await ss(page, '02-home-after-login')
}

// ── Checks de conta PRO ───────────────────────────────────────────────────────
async function checkProUI(page) {
  log('=== Verificando UI PRO ===')
  const checks = {}

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

  // Badge PRO no header
  const proBadge = page.locator('span:has-text("Pro"), span:has-text("PRO"), [class*="pro"], [class*="badge"]').first()
  checks.badge_pro_visivel = await proBadge.count() > 0
  if (checks.badge_pro_visivel) {
    const txt = await proBadge.textContent().catch(() => '')
    checks.badge_pro_texto = txt.trim()
    log(`Badge PRO: "${txt.trim()}"`)
  } else {
    log('AVISO: badge PRO não encontrado no header')
  }

  // Botão vídeo NÃO bloqueado — busca card "Vídeo animado" sem cadeado
  const videoCard = page.locator('text=Vídeo animado').first()
  if (await videoCard.count() > 0) {
    const cardHtml = await videoCard.evaluate(el => el.closest('[class]')?.outerHTML ?? el.outerHTML).catch(() => '')
    checks.video_btn_nao_bloqueado = !cardHtml.includes('bloqueado') && !cardHtml.includes('cursor: not-allowed')
    log(`Card vídeo animado encontrado. Bloqueado? ${!checks.video_btn_nao_bloqueado}`)
  }

  await ss(page, '03-pro-ui-check')

  // Página /conta
  log('Navegando para /conta...')
  await page.goto(`${SITE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(3000)
  await ss(page, '04-conta-page')

  const contaText = await page.locator('body').textContent().catch(() => '')
  checks.conta_plano_pro = contaText.toLowerCase().includes('pro')
  checks.conta_sidebar_pro = contaText.toLowerCase().includes('pro ativo') ||
    contaText.toLowerCase().includes('plano pro') ||
    contaText.toLowerCase().includes('pro até')
  log(`/conta tem texto PRO: ${checks.conta_plano_pro}`)

  return checks
}

// ── Selecionar modo "Foto em cena" ────────────────────────────────────────────
async function selecionarFotoEmCena(page) {
  log('=== Selecionando "Foto em cena" (simulacao) ===')
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(3000)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

  // Busca card "Foto em cena" ou "simulacao"
  const cena = page.locator('text=Foto em cena').first()
  if (await cena.count() > 0) {
    await cena.click()
    log('Clicado em "Foto em cena"')
    await page.waitForTimeout(1500)
    return true
  }

  // Fallback: qualquer card de simulação
  const simCard = page.locator('[data-mode="simulacao"], [value="simulacao"]').first()
  if (await simCard.count() > 0) {
    await simCard.click()
    log('Clicado no modo simulacao (atributo)')
    await page.waitForTimeout(1500)
    return true
  }

  log('AVISO: card "Foto em cena" não encontrado')
  await ss(page, 'modo-nao-encontrado')
  return false
}

// ── Upload da foto e preenchimento do form ─────────────────────────────────────
async function uploadEPreencherForm(page, iteracao) {
  log(`[Iteração ${iteracao}] Upload da imagem e preenchimento do form`)

  // Aguarda form aparecer
  await page.waitForTimeout(1500)
  await ss(page, `i${iteracao}-01-form`)

  // Input file
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(IMAGE_PATH)
    log(`[Iteração ${iteracao}] Arquivo selecionado`)
    await page.waitForTimeout(2000)
    await ss(page, `i${iteracao}-02-upload-ok`)
  } else {
    // Fallback fileChooser
    log(`[Iteração ${iteracao}] Input file não encontrado diretamente — tentando fileChooser`)
    const dropzone = page.locator('[class*="drop"], [class*="upload"], label').first()
    if (await dropzone.count() > 0) {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }),
        dropzone.click(),
      ])
      await chooser.setFiles(IMAGE_PATH)
      await page.waitForTimeout(2000)
      await ss(page, `i${iteracao}-02-upload-ok`)
    } else {
      log(`[Iteração ${iteracao}] ERRO: nenhum input file acessível`)
      await ss(page, `i${iteracao}-02-upload-erro`)
      return false
    }
  }

  // Campo "produto"
  const produtoInput = page.locator(
    'input[placeholder*="produto"], input[placeholder*="Produto"], input[placeholder*="bolo"], textarea[placeholder*="produto"]'
  ).first()
  if (await produtoInput.count() > 0) {
    await produtoInput.fill(PRODUTO_DESC)
    log(`[Iteração ${iteracao}] Campo produto preenchido: "${PRODUTO_DESC}"`)
  } else {
    const inputs = await page.locator('input[type="text"]:visible').all()
    if (inputs.length > 0) {
      await inputs[0].fill(PRODUTO_DESC)
      log(`[Iteração ${iteracao}] Campo texto preenchido (fallback)`)
    } else {
      log(`[Iteração ${iteracao}] AVISO: campo produto não encontrado`)
    }
  }

  // Campo "cenário"
  const cenarioInput = page.locator(
    'input[placeholder*="cenário"], input[placeholder*="cena"], input[placeholder*="mesa"], input[placeholder*="ambiente"], input[placeholder*="rústica"]'
  ).first()
  if (await cenarioInput.count() > 0) {
    await cenarioInput.fill(CENARIO_DESC)
    log(`[Iteração ${iteracao}] Campo cenário preenchido: "${CENARIO_DESC}"`)
  } else {
    const inputs = await page.locator('input[type="text"]:visible').all()
    if (inputs.length > 1) {
      await inputs[1].fill(CENARIO_DESC)
      log(`[Iteração ${iteracao}] Campo cenário preenchido (fallback index 1)`)
    }
  }

  await ss(page, `i${iteracao}-03-form-preenchido`)
  return true
}

// ── Clicar em "Gerar foto" ────────────────────────────────────────────────────
async function clicarGerar(page, iteracao) {
  const gerarBtn = page.locator(
    'button:has-text("Gerar foto"), button:has-text("Gerar com IA"), button:has-text("✨ Gerar"), button[type="submit"]'
  ).first()

  if (await gerarBtn.count() === 0) {
    log(`[Iteração ${iteracao}] ERRO: botão Gerar não encontrado`)
    await ss(page, `i${iteracao}-gerar-nao-encontrado`)
    return false
  }

  const disabled = await gerarBtn.isDisabled()
  if (disabled) {
    log(`[Iteração ${iteracao}] AVISO: botão Gerar está desabilitado`)
    const btnText = await gerarBtn.textContent().catch(() => '')
    log(`[Iteração ${iteracao}] Texto do botão: "${btnText}"`)
    await ss(page, `i${iteracao}-gerar-disabled`)
    return false
  }

  await gerarBtn.click()
  log(`[Iteração ${iteracao}] Clicado em Gerar foto`)
  await page.waitForTimeout(2000)
  await ss(page, `i${iteracao}-04-gerando`)
  return true
}

// ── Aguardar foto pronta ──────────────────────────────────────────────────────
async function aguardarFotoPronta(page, iteracao) {
  const startTime = Date.now()
  log(`[Iteração ${iteracao}] Aguardando foto (poll ${FOTO_POLL_MS/1000}s, timeout ${FOTO_TIMEOUT_MS/60000}min)...`)
  let lastStatus = ''
  let tentativa = 0

  while (Date.now() - startTime < FOTO_TIMEOUT_MS) {
    await page.waitForTimeout(FOTO_POLL_MS)
    tentativa++
    const elapsed = Math.round((Date.now() - startTime) / 1000)

    // Verificar resultado: imagem de output no DOM
    const resultImg = page.locator('.result-image-col img, img[src*="image-jobs"], img[src*="output"]').first()
    const downloadBtn = page.locator('button:has-text("Baixar"), a:has-text("Baixar"), button:has-text("Download")').first()
    const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("vídeo")').first()

    const hasResult = await resultImg.count() > 0
    const hasDownload = await downloadBtn.count() > 0
    const hasVideoBtn = await videoBtn.count() > 0

    // Verifica erro
    const errTexts = ['deu errado', 'falhou', 'Algo deu errado', 'Erro na geração', 'Tente novamente']
    let hasError = false
    for (const txt of errTexts) {
      if (await page.locator(`text=${txt}`).count() > 0) {
        hasError = true
        log(`[Iteração ${iteracao}] ERRO após ${elapsed}s: "${txt}"`)
        await ss(page, `i${iteracao}-foto-erro`)
        return { ok: false, elapsed, error: txt }
      }
    }

    // Status text
    const statusEl = await page.locator('[class*="status"], [class*="progress"], [class*="generating"]').first().textContent().catch(() => '')
    if (statusEl && statusEl !== lastStatus) {
      lastStatus = statusEl
      log(`[Iteração ${iteracao}] Status: "${statusEl.slice(0, 80)}" (${elapsed}s)`)
    }

    if (hasResult || hasDownload || hasVideoBtn) {
      log(`[Iteração ${iteracao}] Foto pronta em ${elapsed}s! (result=${hasResult}, download=${hasDownload}, videoBtn=${hasVideoBtn})`)
      await ss(page, `i${iteracao}-05-foto-done`)
      return { ok: true, elapsed, has_video_btn: hasVideoBtn }
    }

    log(`[Iteração ${iteracao}] Tentativa ${tentativa} — aguardando... ${elapsed}s`)
    if (tentativa % 3 === 0) await ss(page, `i${iteracao}-foto-poll-${elapsed}s`)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log(`[Iteração ${iteracao}] TIMEOUT foto após ${elapsed}s`)
  await ss(page, `i${iteracao}-foto-timeout`)
  return { ok: false, elapsed, error: 'timeout' }
}

// ── Clicar em "Criar vídeo" na tela de resultado ─────────────────────────────
async function clicarCriarVideo(page, iteracao) {
  log(`[Iteração ${iteracao}] Procurando botão "Criar vídeo"...`)

  // Tenta: botão na coluna de actions (desktop) ou mobile
  const videoBtn = page.locator(
    'button:has-text("Criar vídeo"), button:has-text("criar vídeo"), button:has-text("Vídeo animado")'
  ).first()

  if (await videoBtn.count() === 0) {
    log(`[Iteração ${iteracao}] ERRO: botão "Criar vídeo" não encontrado`)
    await ss(page, `i${iteracao}-video-btn-nao-encontrado`)
    return { ok: false, error: 'Botão Criar vídeo não encontrado' }
  }

  const isDisabled = await videoBtn.isDisabled()
  if (isDisabled) {
    const text = await videoBtn.textContent().catch(() => '')
    log(`[Iteração ${iteracao}] AVISO: botão "Criar vídeo" está desabilitado — "${text}"`)
    await ss(page, `i${iteracao}-video-btn-bloqueado`)
    return { ok: false, error: `Botão bloqueado: "${text}"` }
  }

  await videoBtn.click()
  log(`[Iteração ${iteracao}] Clicado em "Criar vídeo"`)
  await page.waitForTimeout(2000)
  await ss(page, `i${iteracao}-06-video-form`)
  return { ok: true }
}

// ── Verificar formulário de vídeo ─────────────────────────────────────────────
async function verificarFormVideo(page, iteracao) {
  log(`[Iteração ${iteracao}] Verificando formulário de vídeo...`)

  // Deve existir input de prompt de vídeo
  const promptInput = page.locator(
    'input[placeholder*="câmera"], input[placeholder*="movimento"], input[placeholder*="girando"], input[placeholder*="Movimento"], input[placeholder*="acontecer"]'
  ).first()

  const formVisible = await promptInput.count() > 0
  log(`[Iteração ${iteracao}] Formulário de vídeo visível: ${formVisible}`)
  await ss(page, `i${iteracao}-07-video-form-check`)
  return formVisible
}

// ── Preencher prompt e gerar vídeo ────────────────────────────────────────────
async function gerarVideo(page, iteracao) {
  log(`[Iteração ${iteracao}] Preenchendo prompt de vídeo: "${VIDEO_PROMPT}"`)

  // Preencher prompt (opcional mas o preenchemos)
  const promptInput = page.locator(
    'input[placeholder*="câmera"], input[placeholder*="movimento"], input[placeholder*="girando"], input[placeholder*="Movimento"], input[placeholder*="acontecer"]'
  ).first()

  if (await promptInput.count() > 0) {
    await promptInput.fill(VIDEO_PROMPT)
    log(`[Iteração ${iteracao}] Prompt vídeo preenchido`)
  } else {
    // Preenche qualquer input de texto visível na tela
    const inputs = await page.locator('input[type="text"]:visible, textarea:visible').all()
    if (inputs.length > 0) {
      await inputs[0].fill(VIDEO_PROMPT)
      log(`[Iteração ${iteracao}] Prompt vídeo preenchido (fallback)`)
    } else {
      log(`[Iteração ${iteracao}] AVISO: campo de prompt não encontrado — gerando sem prompt`)
    }
  }

  await ss(page, `i${iteracao}-08-video-prompt-preenchido`)

  // Botão Gerar vídeo
  const gerarVideoBtn = page.locator(
    'button:has-text("Gerar vídeo"), button:has-text("🎬 Gerar"), button:has-text("Enviar")'
  ).first()

  if (await gerarVideoBtn.count() === 0) {
    log(`[Iteração ${iteracao}] ERRO: botão "Gerar vídeo" não encontrado`)
    await ss(page, `i${iteracao}-gerar-video-nao-encontrado`)
    return false
  }

  const disabled = await gerarVideoBtn.isDisabled()
  if (disabled) {
    log(`[Iteração ${iteracao}] AVISO: botão "Gerar vídeo" está desabilitado`)
    await ss(page, `i${iteracao}-gerar-video-disabled`)
    return false
  }

  await gerarVideoBtn.click()
  log(`[Iteração ${iteracao}] Clicado em "Gerar vídeo"`)
  await page.waitForTimeout(2000)
  await ss(page, `i${iteracao}-09-video-gerando`)
  return true
}

// ── Aguardar vídeo pronto ─────────────────────────────────────────────────────
async function aguardarVideoPronto(page, iteracao) {
  const startTime = Date.now()
  log(`[Iteração ${iteracao}] Aguardando vídeo (poll ${VIDEO_POLL_MS/1000}s, timeout ${VIDEO_TIMEOUT_MS/60000}min)...`)
  let tentativa = 0

  while (Date.now() - startTime < VIDEO_TIMEOUT_MS) {
    await page.waitForTimeout(VIDEO_POLL_MS)
    tentativa++
    const elapsed = Math.round((Date.now() - startTime) / 1000)

    // Vídeo pronto: elemento <video> com src
    const videoEl = page.locator('video[src], video source[src]').first()
    const downloadLink = page.locator('a:has-text("Baixar vídeo"), a[download*=".mp4"], a[href*="video-jobs"]').first()
    const prontoText = page.locator('text=Seu vídeo está pronto, text=vídeo está pronto').first()

    const hasVideo = await videoEl.count() > 0
    const hasDownload = await downloadLink.count() > 0
    const hasProntoText = await prontoText.count() > 0

    // Erro
    const errTexts = ['Erro ao gerar vídeo', 'Não foi possível gerar o vídeo', 'Tentar novamente']
    for (const txt of errTexts) {
      if (await page.locator(`text=${txt}`).first().count() > 0) {
        const errMsg = await page.locator('[class*="error"], [class*="desc"]').first().textContent().catch(() => txt)
        log(`[Iteração ${iteracao}] ERRO vídeo após ${elapsed}s: "${errMsg}"`)
        await ss(page, `i${iteracao}-video-erro`)
        return { ok: false, elapsed, error: errMsg }
      }
    }

    if (hasVideo || hasDownload || hasProntoText) {
      log(`[Iteração ${iteracao}] Vídeo pronto em ${elapsed}s! (video=${hasVideo}, download=${hasDownload}, text=${hasProntoText})`)
      await ss(page, `i${iteracao}-10-video-done`)

      // Verificar download
      const downloadOk = await verificarDownloadVideo(page, iteracao, downloadLink)
      return { ok: true, elapsed, download_ok: downloadOk }
    }

    log(`[Iteração ${iteracao}] Tentativa ${tentativa} — aguardando vídeo... ${elapsed}s`)
    if (tentativa % 2 === 0) await ss(page, `i${iteracao}-video-poll-${elapsed}s`)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log(`[Iteração ${iteracao}] TIMEOUT vídeo após ${elapsed}s`)
  await ss(page, `i${iteracao}-video-timeout`)
  return { ok: false, elapsed, error: 'timeout' }
}

// ── Verificar download do vídeo ───────────────────────────────────────────────
async function verificarDownloadVideo(page, iteracao, downloadLink) {
  log(`[Iteração ${iteracao}] Verificando download do vídeo...`)

  const dl = downloadLink ?? page.locator('a:has-text("Baixar vídeo"), a[download*=".mp4"], a[href*="video-jobs"]').first()
  if (await dl.count() === 0) {
    log(`[Iteração ${iteracao}] AVISO: link de download não encontrado`)
    return false
  }

  // Verifica que o href é válido
  const href = await dl.getAttribute('href').catch(() => null)
  if (href && (href.startsWith('http') || href.startsWith('//'))) {
    log(`[Iteração ${iteracao}] Link download OK: ${href.slice(0, 80)}`)
    return true
  }

  log(`[Iteração ${iteracao}] Link download: "${href}"`)
  return !!href
}

// ── Resetar para nova iteração ────────────────────────────────────────────────
async function resetParaNovaIteracao(page, iteracao) {
  log(`[Iteração ${iteracao}] Resetando para nova foto...`)

  // Botão "Nova foto" ou "Gerar novamente"
  const novaFotoBtn = page.locator(
    'button:has-text("Nova foto"), button:has-text("📷 Nova foto"), button:has-text("Gerar novamente"), button:has-text("nova foto")'
  ).first()

  if (await novaFotoBtn.count() > 0) {
    await novaFotoBtn.click()
    log(`[Iteração ${iteracao}] Clicado em "Nova foto"`)
    await page.waitForTimeout(2000)
  } else {
    log(`[Iteração ${iteracao}] Botão "Nova foto" não encontrado — navegando para home`)
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2000)
  }

  await ss(page, `i${iteracao}-11-reset`)
}

// ── Execução principal ────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  log('══════════════════════════════════════════════════════')
  log('TamoWork Foto IA — Agente de Teste Overnight PRO-C1')
  log(`Iterações: ${TOTAL_ITERACOES}`)
  log('══════════════════════════════════════════════════════')

  // 1. Baixar imagem de teste
  await downloadImage()

  // 2. Criar/promover conta PRO
  await ensureProAccount()

  // 3. Lançar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    locale: 'pt-BR',
  })
  const page = await context.newPage()

  try {
    // 4. Login
    await loginBrowser(page)

    // 5. Checks de UI PRO
    const proChecks = await checkProUI(page)
    log(`Checks PRO: ${JSON.stringify(proChecks)}`)

    // 6. Voltar para home antes das iterações
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2000)

    // 7. 3 iterações foto → vídeo
    for (let i = 1; i <= TOTAL_ITERACOES; i++) {
      log(`\n═══ ITERAÇÃO ${i}/${TOTAL_ITERACOES} ═══`)
      const resultado = {
        iteracao: i,
        tempo_foto_seg: null,
        tempo_video_seg: null,
        foto_ok: false,
        video_ok: false,
        video_form_visivel: false,
        video_download_ok: false,
        pro_checks: i === 1 ? proChecks : undefined,
        erro: null,
        erro_detalhe: null,
      }

      try {
        // Selecionar "Foto em cena"
        const modoOk = await selecionarFotoEmCena(page)
        if (!modoOk) {
          resultado.erro = 'Modo "Foto em cena" não selecionado'
          results.push(resultado)
          continue
        }

        // Upload + form
        const formOk = await uploadEPreencherForm(page, i)
        if (!formOk) {
          resultado.erro = 'Falha no upload/form'
          results.push(resultado)
          await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
          continue
        }

        // Clicar Gerar
        const gerarOk = await clicarGerar(page, i)
        if (!gerarOk) {
          resultado.erro = 'Falha ao clicar em Gerar'
          results.push(resultado)
          await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
          continue
        }

        // Aguardar foto
        const fotoRes = await aguardarFotoPronta(page, i)
        resultado.tempo_foto_seg = fotoRes.elapsed
        resultado.foto_ok = fotoRes.ok
        if (!fotoRes.ok) {
          resultado.erro = `Foto falhou: ${fotoRes.error}`
          results.push(resultado)
          await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
          continue
        }

        // Clicar "Criar vídeo"
        const videoClickRes = await clicarCriarVideo(page, i)
        if (!videoClickRes.ok) {
          resultado.erro = videoClickRes.error
          results.push(resultado)
          await resetParaNovaIteracao(page, i)
          continue
        }

        // Verificar formulário
        resultado.video_form_visivel = await verificarFormVideo(page, i)

        // Gerar vídeo
        const gerarVideoOk = await gerarVideo(page, i)
        if (!gerarVideoOk) {
          resultado.erro = 'Falha ao clicar em Gerar vídeo'
          results.push(resultado)
          await resetParaNovaIteracao(page, i)
          continue
        }

        // Aguardar vídeo
        const videoRes = await aguardarVideoPronto(page, i)
        resultado.tempo_video_seg = videoRes.elapsed
        resultado.video_ok = videoRes.ok
        resultado.video_download_ok = videoRes.download_ok ?? false
        if (!videoRes.ok) {
          resultado.erro = `Vídeo falhou: ${videoRes.error}`
        }

        // Reset para próxima iteração
        if (i < TOTAL_ITERACOES) {
          await resetParaNovaIteracao(page, i)
        }

      } catch (e) {
        log(`[Iteração ${i}] EXCEÇÃO: ${e.message}`)
        resultado.erro = 'Exceção não tratada'
        resultado.erro_detalhe = e.message
        await ss(page, `i${i}-excecao`)
        await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      }

      results.push(resultado)

      // Resumo da iteração
      log(`\n── Resultado iteração ${i}: foto=${resultado.foto_ok}(${resultado.tempo_foto_seg}s) | vídeo=${resultado.video_ok}(${resultado.tempo_video_seg}s) | erro=${resultado.erro ?? 'nenhum'}`)
    }

  } catch (e) {
    log(`EXCEÇÃO FATAL: ${e.message}`)
    log(e.stack)
    await ss(page, 'fatal-error')
  } finally {
    await browser.close()
  }

  // 8. Salvar relatório JSON
  const report = {
    gerado_em: new Date().toISOString(),
    site: SITE_URL,
    conta: EMAIL,
    user_id: userId,
    pro_period_end: '2027-12-31',
    total_iteracoes: TOTAL_ITERACOES,
    iteracoes_foto_ok: results.filter(r => r.foto_ok).length,
    iteracoes_video_ok: results.filter(r => r.video_ok).length,
    tempo_medio_foto_seg: (() => {
      const validos = results.filter(r => r.foto_ok && r.tempo_foto_seg)
      return validos.length ? Math.round(validos.reduce((a, r) => a + r.tempo_foto_seg, 0) / validos.length) : null
    })(),
    tempo_medio_video_seg: (() => {
      const validos = results.filter(r => r.video_ok && r.tempo_video_seg)
      return validos.length ? Math.round(validos.reduce((a, r) => a + r.tempo_video_seg, 0) / validos.length) : null
    })(),
    resultados: results,
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  log(`\n══════════════════════════════════════════════════════`)
  log(`Relatório salvo em: ${REPORT_PATH}`)
  log(`Fotos OK: ${report.iteracoes_foto_ok}/${TOTAL_ITERACOES}`)
  log(`Vídeos OK: ${report.iteracoes_video_ok}/${TOTAL_ITERACOES}`)
  log(`Tempo médio foto: ${report.tempo_medio_foto_seg ?? 'N/A'}s`)
  log(`Tempo médio vídeo: ${report.tempo_medio_video_seg ?? 'N/A'}s`)
  log(`══════════════════════════════════════════════════════`)
}

main().catch(e => {
  console.error('ERRO FATAL:', e)
  process.exit(1)
})
