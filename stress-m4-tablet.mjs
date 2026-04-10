/**
 * Stress Test M4 — TamoWork Foto IA — Tablet Pequeno (iPad mini 768x1024 touch)
 * 5 rodadas foto (modo: POST DE PROMOÇÃO) + 2 rodadas video + checks de layout tablet
 *
 * Fixes vs v1:
 * - usa innerText (nao textContent) para evitar CSS inline
 * - seleciona "POST DE PROMOÇÃO" corretamente (index 4 na lista de modos)
 * - clica no botao "✨ Gerar foto com IA" diretamente (nao .last())
 * - detecta "Falha ao processar" como erro real
 * - rastreia requests de API para diagnostico
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

const BASE_URL = 'https://tamowork.com'
const EMAIL = 'test-stress-m4@tamowork.test'
const PASSWORD = 'StressM4@2026'
const SCREENSHOTS = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/stress-m4'
const PRODUCT_IMAGE_URL = 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800'
const PRODUCT_NAME = 'Perfume Floral Feminino 100ml'
const PRODUCT_PRICE = 'R$ 89,90'

// Ordem dos modos na home (pelo innerText)
// FUNDO BRANCO | FOTO EM CENA | COM MODELO | VÍDEO ANIMADO | POST DE PROMOÇÃO | DO MEU JEITO
const MODO_FOTO_IDX = 4   // POST DE PROMOÇÃO (index 4 do Usar agora)
const MODO_VIDEO_IDX = 3  // VÍDEO ANIMADO (index 3 do Usar agora)

const results = {
  timestamp: new Date().toISOString(),
  viewport: '768x1024 iPad mini touch',
  setup: {},
  photo_runs: [],
  video_runs: [],
  layout_checks: {},
  api_errors: [],
  summary: {},
  errors: [],
}

function log(msg) {
  const ts = new Date().toTimeString().slice(0, 8)
  console.log(`[${ts}] ${msg}`)
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err) })
  })
}

async function ss(page, name) {
  const p = path.join(SCREENSHOTS, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false }).catch(e => log(`SS err: ${e.message}`))
  log(`Screenshot: ${name}.png`)
}

async function innerText(page) {
  return page.evaluate(() => document.body.innerText || '').catch(() => '')
}

async function doLogin(page) {
  log('Login...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  try {
    await page.waitForSelector('text=Usar e-mail e senha', { timeout: 8000 })
    await page.tap('text=Usar e-mail e senha')
    await page.waitForTimeout(800)
  } catch { /* ignore */ }
  try {
    const tabEntrar = page.locator('button').filter({ hasText: /^Entrar$/ }).first()
    if (await tabEntrar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tabEntrar.tap()
      await page.waitForTimeout(400)
    }
  } catch { /* ignore */ }

  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.locator('button[type="submit"]').first().tap()
  await page.waitForTimeout(5000)

  const url = page.url()
  if (url.includes('/onboarding')) {
    // Pular onboarding
    const cont = page.locator('button').filter({ hasText: /Continuar|Começar|Próximo|Pular/ }).first()
    if (await cont.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cont.tap()
      await page.waitForTimeout(1000)
    }
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2000)
  }

  const finalUrl = page.url()
  const ok = !finalUrl.includes('/login')
  log(`Login ${ok ? 'OK' : 'FALHOU'} — ${finalUrl}`)
  return ok
}

async function gotoHome(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(2000)
  // Aguardar cards
  await page.waitForSelector('text=Usar agora', { timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function runFotoTest(page, run, modeIdx, productImgPath, apiErrorsCollector) {
  const runResult = { run, mode_idx: modeIdx, success: false, duration: 0, api_status: null, error: null, steps: {} }
  const start = Date.now()

  try {
    await gotoHome(page)
    await ss(page, `foto-run${run}-00-home`)

    // Selecionar modo
    const usarBtns = page.locator('button').filter({ hasText: 'Usar agora' })
    const count = await usarBtns.count()
    log(`Run ${run}: ${count} modos disponiveis — usando index ${modeIdx}`)

    if (count <= modeIdx) {
      runResult.error = `Modo index ${modeIdx} nao existe (apenas ${count} disponiveis)`
      return runResult
    }

    // Verificar qual modo vamos clicar
    const modeText = await usarBtns.nth(modeIdx).evaluate(el => {
      let n = el
      for (let j = 0; j < 6; j++) {
        if (!n.parentElement) break
        n = n.parentElement
        const t = (n.innerText || '').trim()
        if (t.length > 10) return t.substring(0, 80)
      }
      return 'desconhecido'
    })
    log(`Run ${run}: clicando modo "${modeText.replace(/\n/g, ' ')}..."`)
    runResult.mode_name = modeText.replace(/\n/g, ' ').trim().substring(0, 60)

    await usarBtns.nth(modeIdx).tap()
    await page.waitForTimeout(2000)
    await ss(page, `foto-run${run}-01-modo`)
    runResult.steps.mode = true

    // Upload foto
    const fileCount = await page.locator('input[type="file"]').count()
    if (fileCount === 0) {
      runResult.error = 'Input file nao encontrado'
      return runResult
    }
    await page.locator('input[type="file"]').first().setInputFiles(productImgPath)
    await page.waitForTimeout(1500)
    await ss(page, `foto-run${run}-02-upload`)
    runResult.steps.upload = true

    // Preencher campo de produto
    const textInputCount = await page.locator('input[type="text"]').count()
    if (textInputCount > 0) {
      await page.locator('input[type="text"]').first().fill(PRODUCT_NAME)
      log(`Run ${run}: campo produto preenchido`)
    }

    // Preencher preco se houver segundo campo de texto
    if (textInputCount > 1) {
      await page.locator('input[type="text"]').nth(1).fill(PRODUCT_PRICE)
      log(`Run ${run}: campo preco preenchido`)
    }

    await page.waitForTimeout(500)
    await ss(page, `foto-run${run}-03-form`)

    // Verificar botoes antes de gerar
    const btns = await page.$$eval('button', bs =>
      bs.map(b => ({ text: (b.innerText || '').trim(), disabled: b.disabled })).filter(b => b.text)
    )
    log(`Run ${run} botoes: ${JSON.stringify(btns.map(b => b.text))}`)

    // Clicar "✨ Gerar foto com IA" (PRIMEIRO botao com esse texto)
    const gerarBtn = page.locator('button').filter({ hasText: /Gerar foto com IA/i }).first()
    const gerarVisible = await gerarBtn.isVisible({ timeout: 3000 }).catch(() => false)

    if (!gerarVisible) {
      // Fallback: qualquer botao com Gerar/Transformar
      const fallbackBtn = page.locator('button').filter({ hasText: /Gerar|Transformar|Criar foto|Processar/i }).first()
      if (await fallbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const t = await fallbackBtn.textContent()
        log(`Run ${run}: fallback botao "${t}"`)
        await fallbackBtn.tap()
      } else {
        runResult.error = 'Botao de geracao nao encontrado'
        return runResult
      }
    } else {
      await gerarBtn.tap()
      log(`Run ${run}: botao Gerar clicado`)
    }

    runResult.steps.submit = true

    // Aguardar resultado (max 3 min)
    const maxMs = 180000
    const poll = 5000
    let found = false

    while (Date.now() - start < maxMs) {
      await page.waitForTimeout(poll)
      const t = await innerText(page)
      const elapsed = Math.round((Date.now() - start) / 1000)

      // Verificar sinais de sucesso
      const successSignals = ['Pronto', 'Baixar', 'Download', 'Gerada', 'Sua foto', 'sua arte', 'Concluído', 'finalizado', 'resultado']
      for (const sig of successSignals) {
        if (t.toLowerCase().includes(sig.toLowerCase())) {
          runResult.success = true
          runResult.signal = sig
          runResult.duration = elapsed
          found = true
          log(`Run ${run} SUCESSO "${sig}" em ${elapsed}s`)
          await ss(page, `foto-run${run}-04-resultado-ok`)
          break
        }
      }
      if (found) break

      // Verificar erros especificos
      if (t.includes('Falha ao processar')) {
        runResult.error = 'Falha ao processar (API retornou erro)'
        runResult.duration = elapsed
        log(`Run ${run} FALHA: "Falha ao processar" em ${elapsed}s`)
        await ss(page, `foto-run${run}-04-falha`)
        break
      }

      // Verificar imagem de resultado (blob ou url gerada)
      const resultImgs = await page.$$eval('img', imgs =>
        imgs.map(i => ({ src: i.src?.substring(0, 60), w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) }))
          .filter(i => i.w > 200 && i.h > 200 && (i.src?.includes('blob:') || i.src?.includes('supabase') || i.src?.includes('storage')))
      )
      if (resultImgs.length > 0) {
        runResult.success = true
        runResult.signal = 'result-image'
        runResult.result_images = resultImgs
        runResult.duration = elapsed
        found = true
        log(`Run ${run} SUCESSO via imagem em ${elapsed}s: ${resultImgs[0].w}x${resultImgs[0].h}px`)
        await ss(page, `foto-run${run}-04-resultado-ok`)
        break
      }

      if (elapsed % 30 === 0) log(`Run ${run}: aguardando... ${elapsed}s`)
    }

    if (!found && !runResult.error) {
      runResult.error = 'Timeout sem resultado'
      runResult.duration = Math.round((Date.now() - start) / 1000)
      await ss(page, `foto-run${run}-04-timeout`)
    }
  } catch (e) {
    runResult.error = `Excecao: ${e.message}`
    runResult.duration = Math.round((Date.now() - start) / 1000)
    await ss(page, `foto-run${run}-ERRO`).catch(() => {})
  }

  log(`Run ${run} foto: ${runResult.success ? 'OK' : 'FALHOU'} | ${runResult.duration}s | ${runResult.error || runResult.signal}`)
  return runResult
}

async function runVideoTest(page, run, productImgPath) {
  const runResult = { run, success: false, duration: 0, error: null, steps: {} }
  const start = Date.now()

  try {
    await gotoHome(page)

    // Verificar se modo video existe
    const pageText = await innerText(page)
    const hasVideo = pageText.toLowerCase().includes('vídeo') || pageText.toLowerCase().includes('video')
    runResult.steps.video_mode_exists = hasVideo

    if (!hasVideo) {
      runResult.error = 'Modo video nao encontrado'
      return runResult
    }

    // Clicar no modo VÍDEO ANIMADO (index 3)
    const usarBtns = page.locator('button').filter({ hasText: 'Usar agora' })
    const count = await usarBtns.count()

    if (count <= MODO_VIDEO_IDX) {
      runResult.error = `Modo video (index ${MODO_VIDEO_IDX}) nao disponivel`
      return runResult
    }

    const videoModeText = await usarBtns.nth(MODO_VIDEO_IDX).evaluate(el => {
      let n = el
      for (let j = 0; j < 6; j++) {
        if (!n.parentElement) break
        n = n.parentElement
        const t = (n.innerText || '').trim()
        if (t.length > 10) return t.substring(0, 80)
      }
      return ''
    })
    log(`Video run ${run}: modo "${videoModeText.replace(/\n/g, ' ')}"`)

    await usarBtns.nth(MODO_VIDEO_IDX).tap()
    await page.waitForTimeout(2000)
    await ss(page, `video-run${run}-01-modo`)
    runResult.steps.mode = true
    runResult.mode_name = videoModeText.replace(/\n/g, ' ').trim().substring(0, 60)

    // Upload
    const fileCount = await page.locator('input[type="file"]').count()
    if (fileCount === 0) {
      runResult.error = 'Input file nao encontrado'
      return runResult
    }
    await page.locator('input[type="file"]').first().setInputFiles(productImgPath)
    await page.waitForTimeout(1500)
    runResult.steps.upload = true

    // Preencher campos
    const textInputs = await page.locator('input[type="text"]').count()
    if (textInputs > 0) {
      await page.locator('input[type="text"]').first().fill(PRODUCT_NAME)
    }

    await ss(page, `video-run${run}-02-form`)

    // Clicar botao de gerar video
    const videoGenBtn = page.locator('button').filter({ hasText: /Criar vídeo|Gerar vídeo|Gerar video|Animar/i }).first()
    const videoGenVisible = await videoGenBtn.isVisible({ timeout: 3000 }).catch(() => false)

    if (!videoGenVisible) {
      // Fallback: qualquer botao de submit
      const anyGenBtn = page.locator('button').filter({ hasText: /Gerar|Criar|Transformar|Processar/i }).first()
      if (await anyGenBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const t = await anyGenBtn.textContent()
        log(`Video run ${run}: fallback "${t}"`)
        await anyGenBtn.tap()
      } else {
        runResult.error = 'Botao de gerar video nao encontrado'
        return runResult
      }
    } else {
      await videoGenBtn.tap()
    }
    runResult.steps.submit = true

    // Aguardar resultado (max 5 min para video)
    const maxMs = 300000
    const poll = 5000
    let found = false

    while (Date.now() - start < maxMs) {
      await page.waitForTimeout(poll)
      const t = await innerText(page)
      const elapsed = Math.round((Date.now() - start) / 1000)

      const successSignals = ['Pronto', 'Baixar', 'Download', 'vídeo pronto', 'Concluído']
      for (const sig of successSignals) {
        if (t.toLowerCase().includes(sig.toLowerCase())) {
          runResult.success = true
          runResult.signal = sig
          runResult.duration = elapsed
          found = true
          log(`Video run ${run} SUCESSO "${sig}" em ${elapsed}s`)
          await ss(page, `video-run${run}-03-ok`)
          break
        }
      }
      if (found) break

      if (t.includes('Falha ao processar')) {
        runResult.error = 'Falha ao processar'
        runResult.duration = elapsed
        await ss(page, `video-run${run}-03-falha`)
        break
      }

      // Verificar elemento video
      const videos = await page.$$eval('video', vs =>
        vs.map(v => ({ src: v.src?.substring(0, 60), w: Math.round(v.getBoundingClientRect().width) })).filter(v => v.w > 100)
      )
      if (videos.length > 0) {
        runResult.success = true
        runResult.signal = 'video-element'
        runResult.duration = elapsed
        found = true
        log(`Video run ${run} SUCESSO via elemento <video> em ${elapsed}s`)
        await ss(page, `video-run${run}-03-ok`)
        break
      }

      if (elapsed % 30 === 0) log(`Video run ${run}: aguardando... ${elapsed}s`)
    }

    if (!found && !runResult.error) {
      runResult.error = 'Timeout sem resultado'
      runResult.duration = Math.round((Date.now() - start) / 1000)
      await ss(page, `video-run${run}-03-timeout`)
    }
  } catch (e) {
    runResult.error = `Excecao: ${e.message}`
    runResult.duration = Math.round((Date.now() - start) / 1000)
    await ss(page, `video-run${run}-ERRO`).catch(() => {})
  }

  log(`Video run ${run}: ${runResult.success ? 'OK' : 'FALHOU'} | ${runResult.duration}s | ${runResult.error || runResult.signal}`)
  return runResult
}

async function checkTabletLayout(page) {
  log('=== LAYOUT CHECKS TABLET 768px ===')
  const checks = {}

  await gotoHome(page)
  await ss(page, 'layout-home-tablet')

  // 1. BottomNav vs Sidebar
  // Verificar visibilidade via JS — medir posicao e tamanho dos navs
  const navInfo = await page.evaluate(() => {
    // BottomNav: elemento com posicao fixed na parte inferior
    const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el)
      return s.position === 'fixed' && el.getBoundingClientRect().height > 30
    })
    const bottomFixed = allFixed.filter(el => {
      const r = el.getBoundingClientRect()
      return r.top > window.innerHeight * 0.7
    })
    const topFixed = allFixed.filter(el => {
      const r = el.getBoundingClientRect()
      return r.top < 80
    })

    // Aside/sidebar
    const aside = document.querySelector('aside')
    const asideInfo = aside ? { w: Math.round(aside.getBoundingClientRect().width), visible: window.getComputedStyle(aside).display !== 'none' } : null

    return {
      bottomFixed: bottomFixed.map(el => ({
        tag: el.tagName,
        classes: el.className?.substring(0, 80),
        h: Math.round(el.getBoundingClientRect().height),
        w: Math.round(el.getBoundingClientRect().width),
        top: Math.round(el.getBoundingClientRect().top),
      })),
      topFixed: topFixed.map(el => ({
        tag: el.tagName,
        classes: el.className?.substring(0, 80),
        h: Math.round(el.getBoundingClientRect().height),
      })),
      asideInfo,
      vw: window.innerWidth,
      vh: window.innerHeight,
    }
  })
  checks.nav_info = navInfo
  checks.bottomNav_visible = navInfo.bottomFixed.length > 0
  checks.sidebar_visible = navInfo.asideInfo?.visible || false
  checks.nav_mode = checks.bottomNav_visible
    ? `BottomNav (mobile - CORRETO) — ${navInfo.bottomFixed.length} elem fixed no fundo`
    : checks.sidebar_visible
      ? `Sidebar (desktop)`
      : 'Nenhum nav identificado'
  log(`Nav: ${checks.nav_mode}`)
  log(`Viewport real: ${navInfo.vw}x${navInfo.vh}`)

  // 2. Grid de cards — quantas colunas
  const gridInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]'))
    if (cards.length === 0) {
      // Tentar por role ou tag
      const articles = Array.from(document.querySelectorAll('article, section > div'))
      if (articles.length === 0) return { count: 0, columns: 0 }
      const rects = articles.map(e => e.getBoundingClientRect()).filter(r => r.height > 50 && r.width > 50)
      if (rects.length === 0) return { count: 0, columns: 0 }
      const firstY = rects[0].top
      const sameRow = rects.filter(r => Math.abs(r.top - firstY) < 30)
      return { count: rects.length, columns: sameRow.length, type: 'article' }
    }
    const rects = cards.map(e => e.getBoundingClientRect()).filter(r => r.height > 50)
    if (rects.length === 0) return { count: cards.length, columns: 0 }
    const firstY = rects[0].top
    const sameRow = rects.filter(r => Math.abs(r.top - firstY) < 30)
    return { count: cards.length, columns: sameRow.length, type: 'card' }
  })
  checks.card_count = gridInfo.count
  checks.card_columns = gridInfo.columns
  checks.card_expected = '2 colunas (mobile) ou 3 colunas (tablet)'
  log(`Cards: ${gridInfo.count} total, ${gridInfo.columns} por linha (tipo: ${gridInfo.type || 'card'})`)

  // 3. Formulario — largura adequada
  await gotoHome(page)
  await page.waitForTimeout(1000)
  const usarBtns = page.locator('button').filter({ hasText: 'Usar agora' })
  if (await usarBtns.count() > 0) {
    await usarBtns.first().tap()
    await page.waitForTimeout(1500)
    const formInfo = await page.evaluate(() => {
      const form = document.querySelector('form') ||
                   document.querySelector('[class*="form"]') ||
                   document.querySelector('[class*="Form"]') ||
                   document.querySelector('main')
      if (!form) return null
      const r = form.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth }
    })
    if (formInfo) {
      const ratio = (formInfo.w / formInfo.vw * 100).toFixed(1)
      checks.form_width = formInfo
      checks.form_width_ratio = `${ratio}%`
      checks.form_width_ok = formInfo.w <= formInfo.vw && formInfo.w >= formInfo.vw * 0.5
      log(`Form: ${formInfo.w}px / ${formInfo.vw}px = ${ratio}%`)
    }
  }

  // 4. Tamanho dos botoes (touch targets — minimo 44x44px)
  const btnSizes = await page.$$eval('button:not([aria-hidden="true"])', bs =>
    bs.filter(b => b.offsetParent !== null).slice(0, 15).map(b => {
      const r = b.getBoundingClientRect()
      return { text: (b.innerText || '').trim().substring(0, 30), h: Math.round(r.height), w: Math.round(r.width) }
    }).filter(b => b.h > 0)
  )
  checks.button_sizes = btnSizes
  const tinyBtns = btnSizes.filter(b => b.h < 44)
  checks.tiny_buttons_count = tinyBtns.length
  checks.tiny_buttons = tinyBtns
  log(`Botoes < 44px altura: ${tinyBtns.length} — ${JSON.stringify(tinyBtns)}`)

  // 5. Screenshot da pagina de resultado (se existir de uma run anterior)
  await ss(page, 'layout-form-tablet')

  return checks
}

async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true })

  // Baixar imagem
  const imgPath = path.join(SCREENSHOTS, 'produto-perfume.jpg')
  if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size < 5000) {
    log('Baixando imagem de produto...')
    try {
      await downloadFile(PRODUCT_IMAGE_URL, imgPath)
      log(`Imagem: ${fs.statSync(imgPath).size} bytes`)
    } catch (e) {
      log(`Erro download: ${e.message}`)
    }
  } else {
    log(`Imagem existente: ${fs.statSync(imgPath).size} bytes`)
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  // Contexto tablet iPad mini touch
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
    locale: 'pt-BR',
  })

  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

  // Monitorar erros de API
  page.on('response', async resp => {
    const url = resp.url()
    const status = resp.status()
    if (url.includes('/api/') && !url.includes('_next') && status >= 400) {
      let body = ''
      try { body = await resp.text() } catch {}
      const err = { url, status, body: body.substring(0, 200) }
      results.api_errors.push(err)
      log(`API ERRO: ${resp.request().method()} ${url} => ${status}`)
    }
  })

  try {
    // LOGIN
    log('\n=== SETUP: Login ===')
    results.setup.login = await doLogin(page)
    await ss(page, '00-login-result')

    if (!results.setup.login) {
      results.errors.push('Login falhou — abortando')
      log('ABORTANDO — login falhou')
      await browser.close()
      saveReport()
      return
    }

    // LAYOUT CHECKS
    log('\n=== LAYOUT CHECKS ===')
    results.layout_checks = await checkTabletLayout(page)

    // Verificar modos disponiveis
    await gotoHome(page)
    const homeText = await innerText(page)
    log(`Home texto: ${homeText.replace(/\n/g, ' | ').substring(0, 400)}`)
    const usarCount = await page.locator('button').filter({ hasText: 'Usar agora' }).count()
    results.setup.modes_available = usarCount
    log(`Modos disponíveis: ${usarCount}`)

    // FOTOS (5 runs — modo POST DE PROMOÇÃO idx=4)
    log('\n=== 5 RUNS DE FOTO (POST DE PROMOÇÃO) ===')
    for (let run = 1; run <= 5; run++) {
      const r = await runFotoTest(page, run, MODO_FOTO_IDX, imgPath, results.api_errors)
      results.photo_runs.push(r)
      if (run < 5) await page.waitForTimeout(2000)
    }

    // VIDEOS (2 runs — modo VÍDEO ANIMADO idx=3)
    log('\n=== 2 RUNS DE VIDEO (VÍDEO ANIMADO) ===')
    for (let run = 1; run <= 2; run++) {
      const r = await runVideoTest(page, run, imgPath)
      results.video_runs.push(r)
      if (run < 2) await page.waitForTimeout(2000)
    }

  } catch (e) {
    log(`ERRO FATAL: ${e.message}`)
    results.errors.push(e.message)
    await ss(page, 'FATAL-ERROR').catch(() => {})
  } finally {
    results.console_errors = consoleErrors

    // Summary
    const ps = results.photo_runs
    const photoOk = ps.filter(r => r.success)
    const photoDur = photoOk.map(r => r.duration)
    const vs = results.video_runs
    const videoOk = vs.filter(r => r.success)
    const videoDur = videoOk.map(r => r.duration)

    results.summary = {
      photo: {
        total: ps.length,
        success: photoOk.length,
        failed: ps.length - photoOk.length,
        avg_s: photoDur.length > 0 ? Math.round(photoDur.reduce((a, b) => a + b, 0) / photoDur.length) : null,
        min_s: photoDur.length > 0 ? Math.min(...photoDur) : null,
        max_s: photoDur.length > 0 ? Math.max(...photoDur) : null,
      },
      video: {
        total: vs.length,
        success: videoOk.length,
        failed: vs.length - videoOk.length,
        avg_s: videoDur.length > 0 ? Math.round(videoDur.reduce((a, b) => a + b, 0) / videoDur.length) : null,
        min_s: videoDur.length > 0 ? Math.min(...videoDur) : null,
        max_s: videoDur.length > 0 ? Math.max(...videoDur) : null,
      },
      api_errors_count: results.api_errors.length,
      console_errors_count: consoleErrors.length,
    }

    await browser.close()
    saveReport()
  }
}

function saveReport() {
  const p = path.join(SCREENSHOTS, 'report.json')
  fs.writeFileSync(p, JSON.stringify(results, null, 2))

  console.log('\n' + '='.repeat(65))
  console.log('STRESS TEST M4 — TABLET iPad mini 768x1024 touch')
  console.log('='.repeat(65))
  console.log(`Timestamp: ${results.timestamp}`)
  console.log(`Login: ${results.setup.login ? 'OK' : 'FALHOU'}`)
  console.log(`Modos disponiveis: ${results.setup.modes_available}`)

  console.log('\n--- FOTOS (5 runs — POST DE PROMOÇÃO) ---')
  console.log('| Run | Modo                     | Status  | Tempo | Sinal/Erro                     |')
  console.log('|-----|--------------------------|---------|-------|--------------------------------|')
  results.photo_runs.forEach(r => {
    const status = r.success ? 'OK    ' : 'FALHOU'
    const mode = (r.mode_name || '').substring(0, 24).padEnd(24)
    const dur = String(r.duration + 's').padEnd(5)
    const detail = (r.signal || r.error || '').substring(0, 30)
    console.log(`|  ${r.run}  | ${mode} | ${status} | ${dur} | ${detail}`)
  })
  const ps = results.summary.photo
  console.log(`\nResumo foto: ${ps.success}/${ps.total} OK | Média: ${ps.avg_s}s | Min: ${ps.min_s}s | Max: ${ps.max_s}s`)

  console.log('\n--- VIDEOS (2 runs — VÍDEO ANIMADO) ---')
  console.log('| Run | Modo                     | Status  | Tempo | Sinal/Erro                     |')
  console.log('|-----|--------------------------|---------|-------|--------------------------------|')
  results.video_runs.forEach(r => {
    const status = r.success ? 'OK    ' : 'FALHOU'
    const mode = (r.mode_name || '').substring(0, 24).padEnd(24)
    const dur = String(r.duration + 's').padEnd(5)
    const detail = (r.signal || r.error || '').substring(0, 30)
    console.log(`|  ${r.run}  | ${mode} | ${status} | ${dur} | ${detail}`)
  })
  const vs = results.summary.video
  console.log(`\nResumo video: ${vs.success}/${vs.total} OK | Média: ${vs.avg_s}s`)

  console.log('\n--- LAYOUT TABLET (768px) ---')
  const lc = results.layout_checks
  console.log(`  Nav: ${lc.nav_mode}`)
  console.log(`  BottomNav visivel: ${lc.bottomNav_visible}`)
  console.log(`  Sidebar visivel: ${lc.sidebar_visible}`)
  console.log(`  Cards: ${lc.card_count} total, ${lc.card_columns} colunas`)
  console.log(`  Form width: ${lc.form_width_ratio || 'N/A'} (OK: ${lc.form_width_ok})`)
  console.log(`  Botoes pequenos (<44px): ${lc.tiny_buttons_count}`)
  if (lc.tiny_buttons?.length > 0) {
    lc.tiny_buttons.forEach(b => console.log(`    - "${b.text}" ${b.w}x${b.h}px`))
  }

  if (results.api_errors.length > 0) {
    console.log('\n--- ERROS DE API ---')
    results.api_errors.forEach(e => console.log(`  ${e.status} ${e.url}`))
  }

  if (results.console_errors?.length > 0) {
    console.log(`\nErros JS console: ${results.console_errors.length}`)
    results.console_errors.slice(0, 3).forEach(e => console.log(`  ${e.substring(0, 100)}`))
  }

  if (results.errors.length > 0) {
    console.log('\n--- ERROS GERAIS ---')
    results.errors.forEach(e => console.log(`  ! ${e}`))
  }

  console.log('\n' + '='.repeat(65))
  console.log(`Relatorio JSON: ${p}`)
  console.log(`Screenshots: ${SCREENSHOTS}`)
}

main().catch(err => {
  console.error('UNCAUGHT:', err)
  process.exit(1)
})
