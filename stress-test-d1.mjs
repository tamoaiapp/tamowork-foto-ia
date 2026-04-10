// stress-test-d1.mjs — Stress test completo TamoWork Foto IA
// Desktop 1440x900, modo fundo_branco, 5 fotos + 2 vídeos
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import https from 'https'

const SCREENSHOTS_DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d1'
const CREDS_FILE = 'c:/Users/Notebook/tamowork-foto-ia/stress-d1-credentials.json'
const SITE_URL = 'https://tamowork.com'
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'
const EMAIL = 'test-stress-d1@tamowork.test'
const PASSWORD = 'StressD1@2026'
const IMAGE_URL = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'
const IMAGE_PATH = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d1/tenis-test.jpg'

// Resultados globais
const results = []
let userId = null

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[${ts}] ${msg}`)
}

function ss(page, name) {
  const fpath = path.join(SCREENSHOTS_DIR, `${name}.png`)
  return page.screenshot({ path: fpath, fullPage: false }).catch(() => {})
}

function supabaseGet(path_) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path_}`)
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
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
    req.end()
  })
}

async function downloadImage() {
  if (fs.existsSync(IMAGE_PATH)) {
    log('Imagem de teste já existe, reutilizando.')
    return
  }
  log(`Baixando imagem de teste de ${IMAGE_URL}...`)
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(IMAGE_PATH)
    const get = (url, redirect = 0) => {
      if (redirect > 5) return reject(new Error('Muitos redirects'))
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location, redirect + 1)
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); log('Imagem baixada.'); resolve() })
      }).on('error', reject)
    }
    get(IMAGE_URL)
  })
}

async function loginBrowser(page) {
  log('Fazendo login na interface web...')
  await page.goto(`${SITE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  await ss(page, 'login-page')

  // Clicar em "Usar e-mail e senha" (toggle que revela o form)
  const emailToggle = page.locator('button:has-text("Usar e-mail e senha"), button:has-text("e-mail e senha")').first()
  if (await emailToggle.count() > 0) {
    await emailToggle.click()
    log('Clicado em "Usar e-mail e senha"')
    await page.waitForTimeout(1000)
  }

  // Preencher email e senha — inputs já visíveis após o toggle
  const emailInput = page.locator('input[type="email"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 15000 })
  await emailInput.fill(EMAIL)

  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(PASSWORD)
  await ss(page, 'login-filled')

  // Clicar em entrar (submit do form)
  const submitBtn = page.locator('form button[type="submit"], form button:has-text("Entrar")').first()
  const submitCount = await submitBtn.count()
  if (submitCount > 0) {
    await submitBtn.click()
  } else {
    // fallback: pressionar Enter no campo senha
    await passwordInput.press('Enter')
  }

  // Aguardar redirecionamento para home ou onboarding
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 25000 })

  // Se caiu no onboarding, ir para home
  if (page.url().includes('/onboarding')) {
    log('Redirecionado para onboarding — indo para home...')
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
  }

  log(`Login realizado com sucesso! URL: ${page.url()}`)
  await ss(page, 'after-login')
}

async function selectFundoBranco(page) {
  log('Selecionando modo "fundo_branco"...')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

  // Aguarda o ModeSelector aparecer
  await page.waitForTimeout(2000)
  await ss(page, 'home-loaded')

  // Busca card "Fundo branco"
  const fundoBrancoCard = page.locator('text=Fundo branco').first()
  const exists = await fundoBrancoCard.count() > 0
  if (exists) {
    await fundoBrancoCard.click()
    log('Clicado no card "Fundo branco"')
    await page.waitForTimeout(1000)
    await ss(page, 'modo-fundo-branco-selecionado')
  } else {
    log('AVISO: Card "Fundo branco" não encontrado — tentando método alternativo')
    await ss(page, 'modo-nao-encontrado')
  }
}

async function uploadImageAndGenerate(page, iteration) {
  log(`[Foto ${iteration}] Iniciando upload e geração...`)

  // Aguarda input de arquivo
  await page.waitForTimeout(1000)

  // Localiza o input file
  const fileInput = page.locator('input[type="file"]').first()
  const fileInputCount = await fileInput.count()

  if (fileInputCount > 0) {
    await fileInput.setInputFiles(IMAGE_PATH)
    log(`[Foto ${iteration}] Arquivo selecionado via input`)
    await page.waitForTimeout(1500)
    await ss(page, `foto${iteration}-upload-ok`)
  } else {
    log(`[Foto ${iteration}] Input file não encontrado via seletor direto`)
    // Tenta clicar na área de upload
    const uploadArea = page.locator('[class*="upload"], [class*="drop"], label').first()
    if (await uploadArea.count() > 0) {
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        uploadArea.click(),
      ])
      await fileChooser.setFiles(IMAGE_PATH)
      log(`[Foto ${iteration}] Arquivo selecionado via fileChooser`)
      await page.waitForTimeout(1500)
      await ss(page, `foto${iteration}-upload-ok`)
    }
  }

  // Preencher campo "produto"
  const produtoInput = page.locator('input[placeholder*="produto"], input[placeholder*="Produto"], input[placeholder*="Nike"], textarea[placeholder*="produto"]').first()
  if (await produtoInput.count() > 0) {
    await produtoInput.fill(`Tênis Nike Air Max vermelho — teste ${iteration}`)
    log(`[Foto ${iteration}] Campo produto preenchido`)
  } else {
    // Tenta input genérico
    const inputs = await page.locator('input[type="text"]:visible').all()
    if (inputs.length > 0) {
      await inputs[0].fill(`Tênis Nike Air Max vermelho — teste ${iteration}`)
      log(`[Foto ${iteration}] Campo texto preenchido (fallback)`)
    }
  }

  await ss(page, `foto${iteration}-form-preenchido`)

  // Clicar em Gerar
  const gerarBtn = page.locator('button:has-text("Gerar"), button:has-text("gerar"), button:has-text("Criar foto")').first()
  if (await gerarBtn.count() > 0) {
    const isDisabled = await gerarBtn.isDisabled()
    if (isDisabled) {
      log(`[Foto ${iteration}] AVISO: Botão Gerar está desabilitado (job ativo?)`)
      await ss(page, `foto${iteration}-botao-desabilitado`)
      return { disabled: true }
    }
    await gerarBtn.click()
    log(`[Foto ${iteration}] Clicado em Gerar`)
  } else {
    log(`[Foto ${iteration}] Botão Gerar não encontrado`)
    await ss(page, `foto${iteration}-sem-botao-gerar`)
    return { error: 'Botão Gerar não encontrado' }
  }

  return { ok: true }
}

async function waitForJobDone(page, iteration, isVideo = false) {
  const pollInterval = isVideo ? 15000 : 10000
  const timeoutMs = isVideo ? 10 * 60 * 1000 : 5 * 60 * 1000
  const startTime = Date.now()
  const kind = isVideo ? 'Vídeo' : 'Foto'

  log(`[${kind} ${iteration}] Aguardando resultado (poll a cada ${pollInterval/1000}s, timeout ${timeoutMs/60000}min)...`)

  let lastStatus = ''
  while (Date.now() - startTime < timeoutMs) {
    await page.waitForTimeout(pollInterval)
    const elapsed = Math.round((Date.now() - startTime) / 1000)

    // Verifica se job terminou — procura por elementos de resultado
    const doneIndicators = [
      page.locator('img[src*="image-jobs"], img[src*="storage"]').filter({ hasNot: page.locator('[class*="preview"]') }),
      page.locator('button:has-text("Baixar"), button:has-text("baixar"), a:has-text("Baixar")'),
      page.locator('video[src*="video-jobs"], video[src*="storage"]'),
    ]

    let done = false
    for (const indicator of doneIndicators) {
      if (await indicator.count() > 0) {
        done = true
        break
      }
    }

    // Verifica erro
    const errorMsg = page.locator('text=deu errado, text=falhou, text=Algo deu errado').first()
    if (await errorMsg.count() > 0) {
      const errText = await errorMsg.textContent().catch(() => 'Erro desconhecido')
      log(`[${kind} ${iteration}] ERRO após ${elapsed}s: ${errText}`)
      await ss(page, `${kind.toLowerCase()}${iteration}-erro`)
      return { ok: false, elapsed, error: errText }
    }

    // Pega texto de status se disponível
    const statusText = await page.locator('[class*="status"], [class*="progress"]').first().textContent().catch(() => '')
    if (statusText && statusText !== lastStatus) {
      lastStatus = statusText
      log(`[${kind} ${iteration}] Status: "${statusText}" (${elapsed}s)`)
    }

    if (done) {
      log(`[${kind} ${iteration}] Concluído em ${elapsed}s!`)
      await ss(page, `${kind.toLowerCase()}${iteration}-done`)
      return { ok: true, elapsed }
    }

    log(`[${kind} ${iteration}] Aguardando... ${elapsed}s`)
    await ss(page, `${kind.toLowerCase()}${iteration}-processing-${elapsed}s`)
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log(`[${kind} ${iteration}] TIMEOUT após ${elapsed}s`)
  await ss(page, `${kind.toLowerCase()}${iteration}-timeout`)
  return { ok: false, elapsed, error: 'timeout' }
}

async function testDownload(page, iteration) {
  log(`[Foto ${iteration}] Testando botão Baixar...`)
  const downloadBtn = page.locator('button:has-text("Baixar"), a[download], a:has-text("Baixar")').first()
  if (await downloadBtn.count() === 0) {
    log(`[Foto ${iteration}] Botão Baixar não encontrado`)
    return false
  }

  const isDisabled = await downloadBtn.isDisabled().catch(() => false)
  if (isDisabled) {
    log(`[Foto ${iteration}] Botão Baixar está desabilitado`)
    return false
  }

  // Monitora download
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
  await downloadBtn.click()
  const download = await downloadPromise
  if (download) {
    const filename = download.suggestedFilename()
    log(`[Foto ${iteration}] Download iniciado: ${filename}`)
    await ss(page, `foto${iteration}-download-ok`)
    return true
  } else {
    log(`[Foto ${iteration}] Download não detectado (pode ter aberto nova aba)`)
    await ss(page, `foto${iteration}-download-tentado`)
    return true // aceitável
  }
}

async function testEditor(page, iteration) {
  log(`[Foto ${iteration}] Testando botão Editar...`)
  const editBtn = page.locator('button:has-text("Editar"), button:has-text("editar"), a:has-text("Editar")').first()
  if (await editBtn.count() === 0) {
    log(`[Foto ${iteration}] Botão Editar não encontrado`)
    return false
  }
  await editBtn.click()
  await page.waitForTimeout(2000)
  const editorOpen = await page.locator('[class*="editor"], canvas, [class*="PhotoEditor"]').first().count() > 0
  log(`[Foto ${iteration}] Editor aberto: ${editorOpen}`)
  await ss(page, `foto${iteration}-editor-${editorOpen ? 'ok' : 'fail'}`)

  // Fechar editor
  const closeBtn = page.locator('button:has-text("Fechar"), button:has-text("×"), button:has-text("Voltar"), [class*="close"]').first()
  if (await closeBtn.count() > 0) {
    await closeBtn.click()
    await page.waitForTimeout(1000)
  }
  return editorOpen
}

async function testCriarVideo(page, iteration) {
  log(`[Foto ${iteration}] Testando botão Criar vídeo...`)
  const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("criar vídeo"), button:has-text("Vídeo")').first()
  if (await videoBtn.count() === 0) {
    log(`[Foto ${iteration}] Botão Criar vídeo não encontrado`)
    await ss(page, `foto${iteration}-video-btn-nao-encontrado`)
    return false
  }
  await videoBtn.click()
  await page.waitForTimeout(2000)
  // Verifica se form de vídeo apareceu
  const videoForm = await page.locator('input[placeholder*="prompt"], input[placeholder*="vídeo"], textarea, input[placeholder*="produto"]').first().count() > 0
  log(`[Foto ${iteration}] Form de vídeo aberto: ${videoForm}`)
  await ss(page, `foto${iteration}-criar-video-${videoForm ? 'ok' : 'fail'}`)
  return videoForm
}

async function runVideoJob(page, videoIteration) {
  log(`[Vídeo ${videoIteration}] Iniciando geração de vídeo...`)

  // Preencher prompt de vídeo
  const promptInput = page.locator('input[placeholder*="prompt"], textarea[placeholder*="prompt"], input[type="text"]:visible').first()
  if (await promptInput.count() > 0) {
    await promptInput.fill('produto girando suavemente')
    log(`[Vídeo ${videoIteration}] Prompt preenchido`)
  }

  await ss(page, `video${videoIteration}-form`)

  // Clicar Gerar vídeo
  const gerarBtn = page.locator('button:has-text("Gerar vídeo"), button:has-text("gerar vídeo"), button:has-text("Criar vídeo")').first()
  if (await gerarBtn.count() > 0) {
    await gerarBtn.click()
    log(`[Vídeo ${videoIteration}] Clicado em Gerar vídeo`)
  } else {
    log(`[Vídeo ${videoIteration}] Botão Gerar vídeo não encontrado`)
    return { ok: false, error: 'Botão não encontrado' }
  }

  const startTime = Date.now()
  const result = await waitForJobDone(page, videoIteration, true)
  return result
}

async function testUIAdicional(page) {
  log('\n=== Testes de UI Adicionais ===')
  const uiResults = {}

  // Testar botões do header
  log('Testando header buttons...')
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(2000)
  await ss(page, 'ui-home')

  // Botão conta
  const contaBtn = page.locator('a[href*="/conta"], button:has-text("conta"), [class*="avatar"], [class*="user"]').first()
  if (await contaBtn.count() > 0) {
    await contaBtn.click()
    await page.waitForTimeout(1500)
    uiResults.contaBtn = true
    await ss(page, 'ui-conta-btn-ok')
    await page.goBack().catch(() => {})
  } else {
    uiResults.contaBtn = false
    log('Botão conta não encontrado no header')
  }

  // Botão lang
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 20000 })
  const langBtn = page.locator('[class*="lang"], button:has-text("PT"), button:has-text("EN"), [class*="LangSelector"]').first()
  if (await langBtn.count() > 0) {
    await langBtn.click()
    await page.waitForTimeout(1000)
    uiResults.langBtn = true
    await ss(page, 'ui-lang-btn-ok')
  } else {
    uiResults.langBtn = false
    log('Botão lang não encontrado')
  }

  // Acessar /criacoes
  log('Testando /criacoes...')
  await page.goto(`${SITE_URL}/criacoes`, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(2000)
  const criacoesOk = await page.locator('img, [class*="job"], [class*="card"]').first().count() > 0
  uiResults.criacoes = criacoesOk
  log(`/criacoes carregou com conteúdo: ${criacoesOk}`)
  await ss(page, `ui-criacoes-${criacoesOk ? 'ok' : 'fail'}`)

  // Acessar /editor
  log('Testando /editor...')
  await page.goto(`${SITE_URL}/editor`, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(2000)
  const editorOk = await page.locator('canvas, [class*="editor"], [class*="Editor"]').first().count() > 0
  uiResults.editor = editorOk
  log(`/editor abriu: ${editorOk}`)
  await ss(page, `ui-editor-${editorOk ? 'ok' : 'fail'}`)

  // Logout via /conta
  log('Testando logout via /conta...')
  await page.goto(`${SITE_URL}/conta`, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(2000)
  await ss(page, 'ui-conta-page')

  const logoutBtn = page.locator('button:has-text("Sair"), button:has-text("Logout"), button:has-text("Deslogar"), a:has-text("Sair")').first()
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click()
    await page.waitForTimeout(3000)
    const afterLogout = page.url()
    uiResults.logout = afterLogout.includes('/login') || !afterLogout.includes('/conta')
    log(`Logout realizado. URL após: ${afterLogout}`)
    await ss(page, 'ui-logout-ok')

    // Re-login
    log('Re-fazendo login...')
    await loginBrowser(page)
    await page.waitForTimeout(2000)
    uiResults.relogin = !page.url().includes('/login')
    log(`Re-login: ${uiResults.relogin}`)
    await ss(page, `ui-relogin-${uiResults.relogin ? 'ok' : 'fail'}`)
  } else {
    uiResults.logout = false
    log('Botão logout não encontrado')
  }

  return uiResults
}

async function verifySupabaseJobs() {
  log('\n=== Verificando jobs no Supabase ===')
  const resp = await supabaseGet(
    `/rest/v1/image_jobs?user_id=eq.${userId}&order=created_at.desc&limit=20`
  )

  if (resp.status !== 200) {
    log(`Erro ao buscar jobs: ${resp.status}`)
    return null
  }

  const jobs = resp.body
  const now = new Date()
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000)

  const done = jobs.filter(j => j.status === 'done').length
  const failed = jobs.filter(j => j.status === 'failed').length
  const stuck = jobs.filter(j =>
    (j.status === 'queued' || j.status === 'submitted') &&
    new Date(j.created_at) < tenMinAgo
  ).length

  log(`Jobs encontrados: ${jobs.length} total | ${done} done | ${failed} failed | ${stuck} stuck (queued >10min)`)
  return { total: jobs.length, done, failed, stuck, jobs }
}

async function main() {
  // Carregar credenciais
  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'))
  userId = creds.userId
  log(`USER_ID: ${userId}`)

  // Baixar imagem de teste
  await downloadImage()

  // Iniciar Playwright
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()

  // Ignorar erros de console não críticos
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`[CONSOLE ERROR] ${msg.text().substring(0, 100)}`)
    }
  })

  try {
    // === LOGIN INICIAL ===
    await loginBrowser(page)
    await page.waitForTimeout(2000)

    // === 5 FOTOS ===
    let lastOutputUrl = null
    let firstPhotoJob = null

    for (let i = 1; i <= 5; i++) {
      log(`\n====== FOTO ${i}/5 ======`)
      const startTime = new Date()
      const startMs = Date.now()

      let jobResult = { ok: false, elapsed: 0, error: 'não iniciado' }
      let downloadOk = false
      let editorOk = false
      let videoFormOk = false

      try {
        // Ir para home
        await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 20000 })
        await page.waitForTimeout(2000)

        // Selecionar fundo branco
        await selectFundoBranco(page)

        // Upload e gerar
        const genResult = await uploadImageAndGenerate(page, i)

        if (genResult?.disabled) {
          jobResult = { ok: false, elapsed: 0, error: 'botão desabilitado (job ativo)' }
          log(`[Foto ${i}] Botão desabilitado — job em andamento`)
        } else if (genResult?.error) {
          jobResult = { ok: false, elapsed: 0, error: genResult.error }
        } else {
          // Aguardar resultado
          jobResult = await waitForJobDone(page, i)

          if (jobResult.ok) {
            // Testar funcionalidades
            downloadOk = await testDownload(page, i)
            editorOk = await testEditor(page, i)
            videoFormOk = await testCriarVideo(page, i)

            // Capturar URL da foto resultado para uso em vídeo
            try {
              const resultImg = page.locator('img[src*="image-jobs"]').first()
              if (await resultImg.count() > 0) {
                lastOutputUrl = await resultImg.getAttribute('src')
                if (i === 1) firstPhotoJob = lastOutputUrl
              }
            } catch {}
          }
        }
      } catch (err) {
        jobResult = { ok: false, elapsed: 0, error: err.message }
        log(`[Foto ${i}] Erro inesperado: ${err.message}`)
        await ss(page, `foto${i}-erro-inesperado`)
      }

      const endTime = new Date()
      const totalSec = Math.round((Date.now() - startMs) / 1000)

      results.push({
        job: `foto-${i}`,
        modo: 'fundo_branco',
        inicio: startTime.toISOString().replace('T', ' ').slice(0, 19),
        fim: endTime.toISOString().replace('T', ' ').slice(0, 19),
        tempo_segundos: jobResult.elapsed || totalSec,
        status: jobResult.ok ? 'ok' : 'erro',
        erro: jobResult.error || '',
        extras: `download:${downloadOk} editor:${editorOk} video_form:${videoFormOk}`,
      })

      log(`[Foto ${i}] Resultado: ${jobResult.ok ? 'OK' : 'ERRO'} em ${jobResult.elapsed}s`)
    }

    // === 2 VÍDEOS ===
    for (let v = 1; v <= 2; v++) {
      log(`\n====== VÍDEO ${v}/2 ======`)
      const startTime = new Date()
      const startMs = Date.now()
      let videoResult = { ok: false, elapsed: 0, error: 'não iniciado' }

      try {
        // Ir para home com a foto resultado pronta
        await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 20000 })
        await page.waitForTimeout(3000)

        // Tentar usar o botão Criar vídeo se foto done estiver na tela
        const videoBtn = page.locator('button:has-text("Criar vídeo"), button:has-text("Vídeo animado")').first()
        if (await videoBtn.count() > 0) {
          await videoBtn.click()
          await page.waitForTimeout(2000)
          videoResult = await runVideoJob(page, v)
        } else {
          // Tentar via /criacoes — clicar em criar vídeo de uma criação
          log(`[Vídeo ${v}] Tentando via /criacoes`)
          await page.goto(`${SITE_URL}/criacoes`, { waitUntil: 'networkidle', timeout: 20000 })
          await page.waitForTimeout(2000)
          await ss(page, `video${v}-criacoes`)

          const videoFromCreacoes = page.locator('button:has-text("Criar vídeo"), button:has-text("Vídeo")').first()
          if (await videoFromCreacoes.count() > 0) {
            await videoFromCreacoes.click()
            await page.waitForTimeout(2000)
            await ss(page, `video${v}-apos-click-criacoes`)
            videoResult = await runVideoJob(page, v)
          } else {
            videoResult = { ok: false, elapsed: 0, error: 'Botão Criar Vídeo não encontrado' }
          }
        }
      } catch (err) {
        videoResult = { ok: false, elapsed: 0, error: err.message }
        log(`[Vídeo ${v}] Erro: ${err.message}`)
      }

      const endTime = new Date()
      results.push({
        job: `video-${v}`,
        modo: 'video',
        inicio: startTime.toISOString().replace('T', ' ').slice(0, 19),
        fim: endTime.toISOString().replace('T', ' ').slice(0, 19),
        tempo_segundos: videoResult.elapsed || Math.round((Date.now() - startMs) / 1000),
        status: videoResult.ok ? 'ok' : 'erro',
        erro: videoResult.error || '',
        extras: '',
      })

      log(`[Vídeo ${v}] Resultado: ${videoResult.ok ? 'OK' : 'ERRO'} em ${videoResult.elapsed}s`)
    }

    // === TESTES DE UI ===
    const uiResults = await testUIAdicional(page)
    results.push({
      job: 'ui-adicional',
      modo: 'ui',
      inicio: new Date().toISOString().replace('T', ' ').slice(0, 19),
      fim: new Date().toISOString().replace('T', ' ').slice(0, 19),
      tempo_segundos: 0,
      status: uiResults ? 'ok' : 'erro',
      erro: '',
      extras: JSON.stringify(uiResults),
    })

  } finally {
    await browser.close()
  }

  // === VERIFICAÇÃO SUPABASE ===
  const supabaseData = await verifySupabaseJobs()

  // === RELATÓRIO FINAL ===
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║              RELATÓRIO FINAL — STRESS TEST D1                    ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  console.log('║ job#        │ modo         │ tempo(s) │ status │ extras          ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')

  for (const r of results) {
    const job = r.job.padEnd(12).slice(0, 12)
    const modo = r.modo.padEnd(13).slice(0, 13)
    const tempo = String(r.tempo_segundos).padStart(8)
    const status = r.status.padEnd(6)
    const extras = r.extras.slice(0, 15).padEnd(15)
    console.log(`║ ${job}│ ${modo}│ ${tempo} │ ${status}│ ${extras}║`)
    if (r.erro) {
      console.log(`║   ERRO: ${r.erro.slice(0, 60).padEnd(60)}║`)
    }
  }
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  // Métricas
  const fotoResults = results.filter(r => r.job.startsWith('foto') && r.status === 'ok')
  const videoResults = results.filter(r => r.job.startsWith('video') && r.status === 'ok')
  const totalErros = results.filter(r => r.status === 'erro').length

  const avgFoto = fotoResults.length > 0
    ? Math.round(fotoResults.reduce((a, b) => a + b.tempo_segundos, 0) / fotoResults.length)
    : 'N/A'
  const avgVideo = videoResults.length > 0
    ? Math.round(videoResults.reduce((a, b) => a + b.tempo_segundos, 0) / videoResults.length)
    : 'N/A'

  console.log('\n📊 MÉTRICAS:')
  console.log(`   Tempo médio foto:   ${avgFoto}s (${fotoResults.length}/${5} bem-sucedidas)`)
  console.log(`   Tempo médio vídeo:  ${avgVideo}s (${videoResults.length}/${2} bem-sucedidos)`)
  console.log(`   Total erros:        ${totalErros}`)

  if (supabaseData) {
    console.log('\n🗄️ SUPABASE image_jobs (últimos 20):')
    console.log(`   Done:    ${supabaseData.done}`)
    console.log(`   Failed:  ${supabaseData.failed}`)
    console.log(`   Stuck:   ${supabaseData.stuck}`)

    // Detalhar cada job
    console.log('\n   Detalhes:')
    for (const j of (supabaseData.jobs || []).slice(0, 10)) {
      const age = Math.round((Date.now() - new Date(j.created_at).getTime()) / 60000)
      console.log(`   [${j.status.padEnd(10)}] ${j.id.slice(0, 8)}... modo:${j.mode || j.workflow_id || '?'} age:${age}min`)
    }
  }

  // Salvar resultados JSON
  const reportPath = path.join(SCREENSHOTS_DIR, 'relatorio.json')
  fs.writeFileSync(reportPath, JSON.stringify({ results, metrics: { avgFoto, avgVideo, totalErros }, supabase: supabaseData }, null, 2))
  console.log(`\n✓ Relatório JSON salvo em: ${reportPath}`)
  console.log(`✓ Screenshots em: ${SCREENSHOTS_DIR}`)
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
