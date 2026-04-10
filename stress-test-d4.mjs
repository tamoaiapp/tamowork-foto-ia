/**
 * stress-test-d4.mjs — Stress test desktop TamoWork Foto IA
 * Modo principal: arte_promocao (Post de promoção / modo "promo")
 * Viewport: 1440x900, headless: true
 *
 * Fluxo foto (5x): login → POST DE PROMOÇÃO → upload perfume → nome + preço → baixar
 * Fluxo vídeo (2x): VÍDEO ANIMADO → upload → prompt → aguarda job
 * Testes UI extras: 6 verificações
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import https from 'https'

const BASE_URL = 'https://tamowork.com'
const EMAIL = 'test-stress-d4@tamowork.test'
const PASSWORD = 'StressD4@2026'
const SCREENSHOT_DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-d4'
const PERFUME_URL = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800'
const PRODUTO_NOME = 'Perfume floral feminino'
const PRECO = 'R$ 189,90'
const VIDEO_PROMPT = 'câmera aproximando do produto com luz suave'
const JOB_TIMEOUT_MS = 10 * 60 * 1000  // 10 min

const results = []
let ssIdx = 0
let browser, page

function log(msg) {
  const ts = new Date().toISOString().split('T')[1].substring(0, 8)
  console.log(`[${ts}] ${msg}`)
}

async function screenshot(name) {
  ssIdx++
  const fname = `${String(ssIdx).padStart(3, '0')}_${name}.png`
  try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname), fullPage: false }) } catch {}
}

async function downloadPerfume() {
  const imgPath = path.join(SCREENSHOT_DIR, 'perfume_test.jpg')
  if (fs.existsSync(imgPath)) return imgPath
  log('Baixando imagem do perfume...')
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imgPath)
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          // Nova tentativa com redirect
          const newFile = fs.createWriteStream(imgPath)
          https.get(res.headers.location, (res2) => {
            res2.pipe(newFile)
            newFile.on('finish', () => { newFile.close(); resolve(imgPath) })
            newFile.on('error', reject)
          }).on('error', reject)
          return
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve(imgPath) })
        file.on('error', reject)
      }).on('error', reject)
    }
    get(PERFUME_URL)
  })
}

async function login() {
  log('Login...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  // Expande form de email
  await page.locator('button').filter({ hasText: /e-mail e senha/i }).first().click()
  await page.waitForTimeout(1000)

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await screenshot('login_preenchido')

  await page.locator('button').filter({ hasText: /^Entrar$/ }).last().click()
  await page.waitForTimeout(6000)  // aguarda autenticação + possível redirect onboarding

  log(`URL pós-login: ${page.url()}`)
  await screenshot('pos_login')
}

async function goHome() {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  // Aguarda os cards de modo aparecerem
  await page.waitForSelector('.mode-selector', { timeout: 15000 }).catch(() => {})
}

// ═══════════════════════════════════════════════════════
// JOB FOTO: modo POST DE PROMOÇÃO (PromoCreator local)
// ═══════════════════════════════════════════════════════

async function runPromoJob(jobNum) {
  log(`\n--- Foto Job #${jobNum} (arte_promocao) ---`)
  const startMs = Date.now()
  let status = 'ok'
  let erro = '-'

  try {
    await goHome()
    await screenshot(`fj${jobNum}_home`)

    // Clica em POST DE PROMOÇÃO
    log('Selecionando modo POST DE PROMOÇÃO...')
    await page.locator('div[style*="cursor"]').filter({ hasText: /POST DE PROMOÇÃO/i }).first().click()
    await page.waitForTimeout(2000)
    await screenshot(`fj${jobNum}_modo_selecionado`)

    // Verifica que form carregou
    await page.waitForSelector('input[placeholder*="Tênis" i]', { timeout: 10000 })

    // Upload imagem
    const imgPath = await downloadPerfume()
    const uploadInput = page.locator('input[type="file"]').first()
    await uploadInput.setInputFiles(imgPath)
    await page.waitForTimeout(1500)
    await screenshot(`fj${jobNum}_upload_ok`)

    // Clica em todos os campos antes de submeter (conforme spec)
    log('Clicando em todos os campos...')
    const nomeInput = page.locator('input[placeholder*="Tênis" i]').first()
    await nomeInput.click()
    await nomeInput.fill(PRODUTO_NOME)

    // Campo preço "de" (opcional)
    const precoDeInput = page.locator('input[placeholder*="R$ 99" i]').first()
    if (await precoDeInput.isVisible().catch(() => false)) {
      await precoDeInput.click()
      await precoDeInput.fill('R$ 249,90')
    }

    // Campo preço "por" (campo obrigatório com preço)
    const precoPorInput = page.locator('input[placeholder*="R$ 69" i]').first()
    if (await precoPorInput.isVisible().catch(() => false)) {
      await precoPorInput.click()
      await precoPorInput.fill(PRECO)
    }
    await screenshot(`fj${jobNum}_form_preenchido`)

    // Aguarda botão baixar aparecer (depende do upload da foto)
    await page.waitForSelector('button:has-text("Baixar")', { timeout: 10000 }).catch(() => {})
    const baixarBtn = page.locator('button').filter({ hasText: /baixar/i }).first()
    const btnVisible = await baixarBtn.isVisible().catch(() => false)
    log(`Botão Baixar visível: ${btnVisible}`)

    if (btnVisible) {
      // Verifica que botão ficou habilitado
      const isDisabled = await baixarBtn.isDisabled().catch(() => false)
      log(`Botão Baixar habilitado: ${!isDisabled}`)

      // Clica para gerar (html2canvas)
      await baixarBtn.click()
      await page.waitForTimeout(4000)  // html2canvas pode demorar
      await screenshot(`fj${jobNum}_baixado`)
      log(`Job #${jobNum} concluído — PromoCreator html2canvas`)
      status = 'done'
    } else {
      erro = 'Botão Baixar não apareceu após upload'
      status = 'erro_ui'
      log(`WARN: ${erro}`)
    }
  } catch (err) {
    erro = err.message.substring(0, 120)
    status = 'erro'
    log(`ERRO job #${jobNum}: ${err.message.substring(0, 100)}`)
    await screenshot(`fj${jobNum}_erro`)
  }

  const tempo_seg = Math.round((Date.now() - startMs) / 1000)
  results.push({ job: jobNum, modo: 'arte_promocao', tempo_seg, status, erro })
  log(`Foto job #${jobNum}: ${status} em ${tempo_seg}s`)
  return { tempo_seg, status }
}

// ═══════════════════════════════════════════════════════
// JOB VÍDEO: modo VÍDEO ANIMADO (API GPU)
// ═══════════════════════════════════════════════════════

async function runVideoJob(jobNum) {
  log(`\n--- Video Job #${jobNum} ---`)
  const startMs = Date.now()
  let status = 'ok'
  let erro = '-'

  try {
    await goHome()
    await screenshot(`vj${jobNum}_home`)

    // Clica em VÍDEO ANIMADO
    log('Selecionando modo VÍDEO ANIMADO...')
    await page.locator('div[style*="cursor"]').filter({ hasText: /VÍDEO ANIMADO/i }).first().click()
    await page.waitForTimeout(2000)
    await screenshot(`vj${jobNum}_modo`)

    // Aguarda form
    await page.waitForSelector('input[type="file"]', { timeout: 10000 })

    // Upload
    const imgPath = await downloadPerfume()
    const uploadInput = page.locator('input[type="file"]').first()
    await uploadInput.setInputFiles(imgPath)
    await page.waitForTimeout(1000)
    await screenshot(`vj${jobNum}_upload`)

    // Prompt (campo opcional)
    const promptInput = page.locator('input[placeholder*="câmera" i], input[placeholder*="aconteça" i], input[type="text"]').first()
    if (await promptInput.isVisible().catch(() => false)) {
      await promptInput.click()
      await promptInput.fill(VIDEO_PROMPT)
      log('Prompt preenchido')
    }
    await screenshot(`vj${jobNum}_form`)

    // Verifica que submit está habilitado
    const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /gerar vídeo|Gerar/i }).first()
    const isDisabled = await submitBtn.isDisabled().catch(() => false)
    log(`Submit vídeo habilitado: ${!isDisabled}`)

    await submitBtn.click()
    await screenshot(`vj${jobNum}_submitted`)
    log('Job de vídeo submetido. Aguardando...')

    // Poll até ter vídeo ou erro
    const deadline = Date.now() + JOB_TIMEOUT_MS
    let found = false
    while (Date.now() < deadline) {
      // Vídeo gerado
      const video = page.locator('video').first()
      const hasVideo = await video.isVisible().catch(() => false)
      if (hasVideo) {
        const src = await video.getAttribute('src').catch(() => '')
        log(`Vídeo pronto! src: ${src.substring(0, 60)}`)
        await screenshot(`vj${jobNum}_result`)
        status = 'done'
        found = true
        break
      }
      // Mensagem de erro
      const errTxt = await page.locator('*').filter({ hasText: /erro|falhou|deu errado/i }).first().textContent().catch(() => '')
      if (errTxt && errTxt.length < 200) {
        log(`Erro vídeo: ${errTxt}`)
        status = `erro: ${errTxt.substring(0, 60)}`
        found = true
        break
      }
      await page.waitForTimeout(10000)
    }
    if (!found) status = 'timeout'
  } catch (err) {
    erro = err.message.substring(0, 120)
    status = 'erro'
    log(`ERRO video #${jobNum}: ${err.message.substring(0, 80)}`)
    await screenshot(`vj${jobNum}_erro`)
  }

  const tempo_seg = Math.round((Date.now() - startMs) / 1000)
  results.push({ job: `V${jobNum}`, modo: 'video', tempo_seg, status, erro })
  log(`Video job #${jobNum}: ${status} em ${tempo_seg}s`)
  return { tempo_seg, status }
}

// ═══════════════════════════════════════════════════════
// TESTES UI EXTRAS
// ═══════════════════════════════════════════════════════

async function ui1_SubmitSemImagem() {
  log('\n[UI1] Submit sem imagem...')
  await goHome()

  // Clica em Foto em cena (modo com upload obrigatório)
  await page.locator('div[style*="cursor"]').filter({ hasText: /FOTO EM CENA/i }).first().click()
  await page.waitForTimeout(2000)

  // Não faz upload
  // Preenche produto
  const prodInput = page.locator('input, textarea').filter({ hasText: '' }).first()
  const prodInputVisible = page.locator('input[placeholder*="produto" i], input[placeholder*="descreva" i]').first()
  if (await prodInputVisible.isVisible().catch(() => false)) {
    await prodInputVisible.fill('Teste produto sem imagem')
  }

  // Tenta submeter
  const submitBtn = page.locator('button[type="submit"]').first()
  await submitBtn.click()
  await page.waitForTimeout(1000)

  // Verifica erro
  const bodyAfter = await page.evaluate(() => document.body.innerText)
  const hasErrMsg = /envie a foto|foto.*obrig|sem imagem|escolha/i.test(bodyAfter)
  // Verifica também se não navegou para estado "gerando"
  const stillOnForm = await page.locator('input[type="file"]').isVisible().catch(() => false)
  const bloqueou = hasErrMsg || stillOnForm
  log(`[UI1] Bloqueou submit sem imagem: ${bloqueou} (erro msg: ${hasErrMsg}, ainda no form: ${stillOnForm})`)
  await screenshot('ui1_sem_imagem')
  results.push({ job: 'UI1', modo: 'ui', tempo_seg: 0, status: bloqueou ? 'ok_bloqueou' : 'fail_nao_bloqueou', erro: '-' })
}

async function ui2_BotaoDesabilitadoDuranteGeracao() {
  log('\n[UI2] Botão desabilitado durante geração...')
  // Este teste é verificado inline nos jobs de vídeo (quando há submissão real)
  // Aqui fazemos uma verificação extra no modo de foto em cena
  await goHome()
  await page.locator('div[style*="cursor"]').filter({ hasText: /FOTO EM CENA/i }).first().click()
  await page.waitForTimeout(2000)

  // Verifica se o submit está habilitado antes de ter imagem
  const submitBtn = page.locator('button[type="submit"]').first()
  const enabledSemFoto = !(await submitBtn.isDisabled().catch(() => false))

  // Faz upload
  const imgPath = await downloadPerfume()
  const uploadInput = page.locator('input[type="file"]').first()
  await uploadInput.setInputFiles(imgPath)
  await page.waitForTimeout(500)

  // Preenche campos
  const prodInput = page.locator('input[placeholder*="produto" i], input[placeholder*="descreva" i]').first()
  if (await prodInput.isVisible().catch(() => false)) await prodInput.fill('Perfume floral feminino')
  const cenInput = page.locator('input[placeholder*="cenário" i], input[placeholder*="ambiente" i]').first()
  if (await cenInput.isVisible().catch(() => false)) await cenInput.fill('mesa de madeira com flores')

  await submitBtn.click()
  await page.waitForTimeout(1500)

  // Botão deve estar desabilitado agora
  const disabledDuranteGer = await submitBtn.isDisabled().catch(() => false)
  log(`[UI2] Submit habilitado sem foto: ${enabledSemFoto} | Desabilitado durante geração: ${disabledDuranteGer}`)
  await screenshot('ui2_botao_gerando')

  // Cancela job se necessário
  const cancelBtn = page.locator('button').filter({ hasText: /cancelar|cancel/i }).first()
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click()
    await page.waitForTimeout(2000)
  }

  const status = disabledDuranteGer ? 'ok' : 'fail_botao_habilitado'
  results.push({ job: 'UI2', modo: 'ui', tempo_seg: 0, status, erro: '-' })
}

async function ui3_CampoPrecoPromo() {
  log('\n[UI3] Campo preço no modo promo...')
  await goHome()
  await page.locator('div[style*="cursor"]').filter({ hasText: /POST DE PROMOÇÃO/i }).first().click()
  await page.waitForTimeout(2000)

  // O modo promo é o único com campo de preço
  const precoInput = page.locator('input[placeholder*="R$ 69" i], input[placeholder*="R$ 99" i]').first()
  const visible = await precoInput.isVisible().catch(() => false)
  log(`[UI3] Campo preço visível: ${visible}`)
  await screenshot('ui3_campo_preco')

  if (visible) {
    await precoInput.click()
    await precoInput.fill('189,90')
    const val = await precoInput.inputValue().catch(() => '')
    log(`[UI3] Valor digitado: "${val}"`)
  }

  // Verifica que modo simulacao NÃO tem campo preço
  await goHome()
  await page.locator('div[style*="cursor"]').filter({ hasText: /FOTO EM CENA/i }).first().click()
  await page.waitForTimeout(2000)
  const precoInSimulacao = await page.locator('input[placeholder*="R$ 69" i], input[placeholder*="R$ 99" i]').first().isVisible().catch(() => false)
  log(`[UI3] Campo preço em simulacao (esperado: false): ${precoInSimulacao}`)

  results.push({ job: 'UI3', modo: 'ui', tempo_seg: 0, status: (visible && !precoInSimulacao) ? 'ok' : 'fail', erro: '-' })
}

async function ui4_ContaPlanoPRO() {
  log('\n[UI4] Página /conta — plano PRO...')
  await page.goto(`${BASE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(4000)
  await screenshot('ui4_conta')

  const bodyText = await page.evaluate(() => document.body.innerText)
  const hasPro = /pro|PRO|Pro/i.test(bodyText)
  const hasEmail = bodyText.includes('@tamowork') || bodyText.includes('test-stress')
  const hasDate = /2027|2026/i.test(bodyText)  // data de expiração
  log(`[UI4] Plano PRO: ${hasPro} | Email: ${hasEmail} | Data: ${hasDate}`)
  log(`[UI4] Body snippet: ${bodyText.substring(0, 300)}`)

  results.push({ job: 'UI4', modo: 'ui', tempo_seg: 0, status: hasPro ? 'ok' : 'pro_nao_aparece', erro: '-' })
}

async function ui5_LogoutLoginCriacoes() {
  log('\n[UI5] Logout → login → /criacoes...')

  // Procura botão logout
  await page.goto(`${BASE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(3000)

  const logoutBtn = page.locator('button').filter({ hasText: /sair|logout|desconectar/i }).first()
  const logoutVisible = await logoutBtn.isVisible().catch(() => false)
  log(`[UI5] Botão logout visível: ${logoutVisible}`)

  if (logoutVisible) {
    await logoutBtn.click()
    await page.waitForTimeout(3000)
    await screenshot('ui5_apos_logout')
    log(`[UI5] URL após logout: ${page.url()}`)

    // Faz login novamente
    const atLogin = page.url().includes('/login')
    if (!atLogin) await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1500)
    await page.locator('button').filter({ hasText: /e-mail e senha/i }).first().click()
    await page.waitForTimeout(800)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.locator('button').filter({ hasText: /^Entrar$/ }).last().click()
    await page.waitForTimeout(6000)
    await screenshot('ui5_relogado')
  } else {
    log('[UI5] Botão logout não encontrado — tentando via URL')
    // Tenta deslogar via JS
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('auth') || k.includes('supabase'))
      if (key) localStorage.removeItem(key)
    })
  }

  // Vai para /criacoes
  await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(5000)
  await screenshot('ui5_criacoes')

  const bodyText = await page.evaluate(() => document.body.innerText)
  const hasCriacoes = bodyText.length > 200 && !bodyText.includes('Fazer login')
  log(`[UI5] /criacoes acessível após re-login: ${hasCriacoes}`)
  log(`[UI5] URL: ${page.url()}`)

  results.push({ job: 'UI5', modo: 'ui', tempo_seg: 0, status: hasCriacoes ? 'ok' : 'sem_criacoes_ou_redirect', erro: '-' })
}

async function ui6_Editor() {
  log('\n[UI6] Editor — adiciona texto e verifica salvar...')
  await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(3000)
  await screenshot('ui6_editor')

  const bodyText = await page.evaluate(() => document.body.innerText)
  const hasEditor = /texto|text|sticker|adicionar|editar/i.test(bodyText)
  log(`[UI6] Editor carregou: ${hasEditor}`)

  // Tenta subir uma foto para editar
  const uploadFile = page.locator('input[type="file"]').first()
  const imgPath = await downloadPerfume()
  if (await uploadFile.isVisible().catch(() => false)) {
    await uploadFile.setInputFiles(imgPath)
    await page.waitForTimeout(2000)
    await screenshot('ui6_editor_img')
  }

  // Botões de texto
  const allBtns = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(e => e.innerText.trim().substring(0, 30))
  )
  log(`[UI6] Botões: ${JSON.stringify(allBtns.slice(0, 15))}`)

  // Tenta clicar em adicionar texto / preset
  const textBtn = page.locator('button').filter({ hasText: /💰 Preço|📞 Telefone|✏️ Texto|texto livre/i }).first()
  if (await textBtn.isVisible().catch(() => false)) {
    await textBtn.click()
    await page.waitForTimeout(1000)
    await screenshot('ui6_texto_adicionado')
    log('[UI6] Texto adicionado via preset')
  }

  // Verifica botão salvar
  const saveBtn = page.locator('button').filter({ hasText: /salvar|download|baixar|💾/i }).first()
  const hasSave = await saveBtn.isVisible().catch(() => false)
  log(`[UI6] Botão salvar: ${hasSave}`)

  if (hasSave) {
    await saveBtn.click()
    await page.waitForTimeout(2000)
    await screenshot('ui6_salvo')
  }

  results.push({ job: 'UI6', modo: 'ui', tempo_seg: 0, status: hasEditor ? 'ok' : 'editor_nao_carregou', erro: '-' })
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  log('=== Iniciando stress test D4 — TamoWork Foto IA ===')
  log(`URL: ${BASE_URL} | Viewport: 1440x900 | headless: true`)
  log(`Screenshots: ${SCREENSHOT_DIR}`)

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  page = await context.newPage()

  // === Login inicial ===
  await login()
  await goHome()
  await screenshot('home_inicial')

  // === FASE 1: 5 jobs de foto (arte_promocao) ===
  log('\n' + '═'.repeat(60))
  log('FASE 1: 5 Jobs de Foto — modo arte_promocao (Post de promoção)')
  log('═'.repeat(60))

  for (let i = 1; i <= 5; i++) {
    await runPromoJob(i)
    if (i < 5) await page.waitForTimeout(1500)
  }

  // === FASE 2: 2 jobs de vídeo ===
  log('\n' + '═'.repeat(60))
  log('FASE 2: 2 Jobs de Vídeo — modo VÍDEO ANIMADO')
  log('═'.repeat(60))

  for (let i = 1; i <= 2; i++) {
    await runVideoJob(i)
    if (i < 2) await page.waitForTimeout(1500)
  }

  // === FASE 3: Testes UI extras ===
  log('\n' + '═'.repeat(60))
  log('FASE 3: Testes UI Extras')
  log('═'.repeat(60))

  await ui1_SubmitSemImagem()
  await ui2_BotaoDesabilitadoDuranteGeracao()
  await ui3_CampoPrecoPromo()
  await ui4_ContaPlanoPRO()
  await ui5_LogoutLoginCriacoes()
  await ui6_Editor()

  await browser.close()

  // ═══════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ═══════════════════════════════════════════════════════

  const sep = '─'.repeat(105)
  const header = ['job#'.padEnd(6), 'modo'.padEnd(15), 'tempo_seg'.padEnd(12), 'status'.padEnd(28), 'erro'].join(' | ')

  log('\n\n' + '═'.repeat(105))
  log('                         RELATÓRIO STRESS TEST D4 — TamoWork Foto IA')
  log('═'.repeat(105))
  log(`Data: ${new Date().toISOString()} | Conta: ${EMAIL} | Viewport: 1440x900`)
  log(sep)
  log(header)
  log(sep)

  results.forEach(r => {
    const row = [
      String(r.job).padEnd(6),
      String(r.modo).padEnd(15),
      String(r.tempo_seg).padEnd(12),
      String(r.status).padEnd(28),
      String(r.erro || '-').substring(0, 40),
    ].join(' | ')
    log(row)
  })
  log(sep)

  // Médias
  const fotoJobs = results.filter(r => r.modo === 'arte_promocao')
  const fotoDone = fotoJobs.filter(r => r.status === 'done')
  const videoJobs = results.filter(r => r.modo === 'video')
  const videoDone = videoJobs.filter(r => r.status === 'done')

  log('\nRESUMO:')
  log(`  Foto (promo): ${fotoDone.length}/${fotoJobs.length} concluídos`)
  if (fotoDone.length > 0) {
    const avg = Math.round(fotoDone.reduce((a, b) => a + b.tempo_seg, 0) / fotoDone.length)
    const min = Math.min(...fotoDone.map(r => r.tempo_seg))
    const max = Math.max(...fotoDone.map(r => r.tempo_seg))
    log(`    Tempo médio: ${avg}s | min: ${min}s | max: ${max}s`)
  }
  log(`  Vídeo: ${videoDone.length}/${videoJobs.length} concluídos`)
  if (videoDone.length > 0) {
    const avg = Math.round(videoDone.reduce((a, b) => a + b.tempo_seg, 0) / videoDone.length)
    log(`    Tempo médio: ${avg}s`)
  }

  const uiResults = results.filter(r => r.modo === 'ui')
  const uiOk = uiResults.filter(r => r.status.startsWith('ok') || r.status === 'verificado_em_jobs')
  log(`  Testes UI: ${uiOk.length}/${uiResults.length} ok`)

  // Bugs
  const bugs = results.filter(r =>
    r.status !== 'ok' && r.status !== 'done' &&
    !r.status.startsWith('ok_') && r.status !== 'verificado_em_jobs'
  )
  if (bugs.length > 0) {
    log('\nPROBLEMAS ENCONTRADOS:')
    bugs.forEach(b => log(`  [${b.job}] ${b.modo}: ${b.status} — ${b.erro}`))
  } else {
    log('\nNenhum bug crítico encontrado.')
  }

  // Salva JSON
  const reportPath = path.join(SCREENSHOT_DIR, 'relatorio-d4.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    email: EMAIL,
    viewport: '1440x900',
    results,
    summary: {
      foto: { total: fotoJobs.length, done: fotoDone.length },
      video: { total: videoJobs.length, done: videoDone.length },
      ui: { total: uiResults.length, ok: uiOk.length },
    }
  }, null, 2))
  log(`\nRelatório JSON: ${reportPath}`)
  log(`Screenshots (${ssIdx} total): ${SCREENSHOT_DIR}`)
}

main().catch(err => {
  console.error('\nERRO FATAL:', err.message)
  if (browser) browser.close().catch(() => {})
  process.exit(1)
})
