/**
 * Agente de teste overnight — TamoWork Foto IA
 * Conta FREE: free-b1@tamowork.test | FreeB1@2026
 *
 * Fluxo:
 *  1. Login
 *  2. Seleciona "Fundo branco" → upload imagem → produto "Tênis Nike vermelho" → Gerar
 *  3. Aguarda resultado (poll 10s, timeout 8min)
 *  4. Verifica: foto apareceu, download funciona, ProUpsell visível
 *  5. Tenta gerar SEGUNDA foto → verifica bloqueio + texto do botão/countdown
 *  6. Clica "Liberar agora" (ou equivalente) → registra redirect
 *  7. Repete iteração 2 (já bloqueada)
 *  8. Salva report.json
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

// ── Configuração ─────────────────────────────────────────────────────────────
const BASE_URL      = 'https://tamowork.com';
const EMAIL         = 'free-b1@tamowork.test';
const PASSWORD      = 'FreeB1@2026';
const SUPABASE_URL  = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600';
const SCREENSHOT_DIR = 'c:/Users/Notebook/tamowork-foto-ia/test-screenshots/free-b1';
const REPORT_PATH    = path.join(SCREENSHOT_DIR, 'report.json');
const POLL_INTERVAL  = 10_000;  // 10s
const TIMEOUT_MS     = 8 * 60 * 1000; // 8 min

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

async function downloadImageFromUrl(imageUrl, dest) {
  // Tenta com fetch primeiro (melhor para URLs do Supabase com query params)
  try {
    const { default: fetchFn } = await import('node-fetch').catch(() => ({ default: null }));
    const fn = fetchFn ?? fetch;
    const res = await fn(imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    // fallback para downloadFile
    try { await downloadFile(imageUrl, dest); return true; } catch { return false; }
  }
}

// ── Supabase: cria conta se não existir ──────────────────────────────────────
async function ensureAccount() {
  log('Verificando/criando conta FREE...');

  // Tenta login com API admin primeiro para ver se usuário existe
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });

  if (listRes.ok) {
    const { users } = await listRes.json();
    const existing = (users ?? []).find(u => u.email === EMAIL);
    if (existing) {
      log(`Conta já existe: ${existing.id}`);
      return;
    }
  }

  // Cria conta
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { plan: 'free' },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    // Se erro for "already registered" é ok
    if (JSON.stringify(err).includes('already')) {
      log('Conta já existe (erro ignorado).');
      return;
    }
    throw new Error(`Falha ao criar conta: ${JSON.stringify(err)}`);
  }

  const user = await createRes.json();
  log(`Conta criada: ${user.id}`);
}

// ── Limpa jobs antigos da conta (para garantir estado limpo na 1ª iteração) ──
async function clearOldJobs(token) {
  log('Limpando jobs antigos...');
  const res = await fetch(`${BASE_URL}/api/image-jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  const jobs = data.jobs ?? [];
  for (const j of jobs) {
    await fetch(`${BASE_URL}/api/image-jobs/${j.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  log(`${jobs.length} job(s) removido(s).`);
}

// ── Login via API Supabase → pega token ──────────────────────────────────────
async function getSupabaseToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login API falhou: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ── Fluxo principal via Playwright ───────────────────────────────────────────
async function runIteration(browser, iterNum, report) {
  log(`\n═══ ITERAÇÃO ${iterNum} ═══`);
  const iterKey = `iteracao_${iterNum}`;
  report[iterKey] = {
    started_at: new Date().toISOString(),
    status_foto: null,
    tempo_geracao_seg: null,
    foto_apareceu: false,
    download_funcionou: false,
    pro_upsell_visivel: false,
    bloqueio_funcionou: false,
    texto_botao_bloqueado: null,
    redirect_liberar_agora: null,
    erros: [],
  };

  const R = report[iterKey];

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  try {
    // ── 1. Login ──────────────────────────────────────────────────────────────
    log('Navegando para login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-01-login.png`) });

    // Preenche email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.waitFor({ timeout: 10_000 });
    await emailInput.fill(EMAIL);

    // Preenche senha
    const pwInput = page.locator('input[type="password"]').first();
    await pwInput.fill(PASSWORD);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-02-login-filled.png`) });

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Aguarda redirecionamento para home
    log('Aguardando redirecionamento pós-login...');
    await page.waitForURL(url => !url.includes('/login'), { timeout: 20_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-03-home.png`) });
    log(`URL após login: ${page.url()}`);

    // ── 2. Se iteração 2, verifica se bloqueio já aparece na tela inicial ─────
    if (iterNum === 2) {
      log('Verificando bloqueio na home (iteração 2)...');
      await sleep(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-04-home-bloqueado.png`) });
    }

    // ── 3. Seleciona modo "Fundo branco" ──────────────────────────────────────
    log('Selecionando modo Fundo Branco...');
    // Procura botão/card de modo de criação
    // Tenta clicar em "Fundo Branco" ou similar
    const fundoBrancoSel = page.locator('text=/fundo branco/i, text=/background/i').first();
    const modeMenuVisible = await fundoBrancoSel.isVisible().catch(() => false);

    if (modeMenuVisible) {
      await fundoBrancoSel.click();
      log('Clicou em Fundo Branco.');
    } else {
      // Pode estar em menu de modos — tenta texto parcial
      const modeItems = page.locator('[data-mode="fundo_branco"], button:has-text("Fundo"), div:has-text("Fundo Branco")');
      const count = await modeItems.count();
      if (count > 0) {
        await modeItems.first().click();
        log('Clicou em item de modo Fundo Branco.');
      } else {
        log('Modo Fundo Branco não encontrado — pode já estar no form direto.');
      }
    }

    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-05-modo-selecionado.png`) });

    // ── 4. Upload da imagem do produto ────────────────────────────────────────
    log('Fazendo upload da imagem...');
    // Baixa imagem localmente
    const tmpImg = path.join(SCREENSHOT_DIR, 'tenis-temp.jpg');
    if (!fs.existsSync(tmpImg)) {
      log('Baixando imagem do Unsplash...');
      await downloadImageFromUrl(PRODUCT_IMAGE, tmpImg);
    }

    // Localiza input de arquivo
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ timeout: 15_000 });
    await fileInput.setInputFiles(tmpImg);
    log('Imagem enviada via setInputFiles.');

    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-06-upload.png`) });

    // ── 5. Preenche nome do produto ────────────────────────────────────────────
    log('Preenchendo nome do produto...');
    const produtoInput = page.locator(
      'input[placeholder*="produto"], input[placeholder*="Produto"], textarea[placeholder*="produto"]'
    ).first();

    const prodVisible = await produtoInput.isVisible().catch(() => false);
    if (prodVisible) {
      await produtoInput.fill('Tênis Nike vermelho');
      log('Campo produto preenchido.');
    } else {
      // Tenta encontrar qualquer input de texto disponível
      const textInputs = page.locator('input[type="text"], input:not([type])');
      const textCount = await textInputs.count();
      log(`Encontrei ${textCount} inputs de texto.`);
      if (textCount > 0) {
        await textInputs.first().fill('Tênis Nike vermelho');
        log('Preencheu primeiro input de texto disponível.');
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-07-form-preenchido.png`) });

    // ── 6. Clica em Gerar ─────────────────────────────────────────────────────
    log('Clicando em Gerar...');
    const gerarBtn = page.locator(
      'button:has-text("Gerar"), button:has-text("Criar"), button[type="submit"]:has-text("Gerar")'
    ).first();

    const gerarVisible = await gerarBtn.isVisible().catch(() => false);
    if (!gerarVisible) {
      // Tenta submit do form
      const submitBtns = page.locator('button[type="submit"]');
      const submitCount = await submitBtns.count();
      if (submitCount > 0) {
        await submitBtns.last().click();
        log('Clicou em submit (fallback).');
      }
    } else {
      await gerarBtn.click();
      log('Clicou em Gerar.');
    }

    const gerarClickedAt = new Date();
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-08-gerando.png`) });

    // ── 7. Verifica rate limit IMEDIATO (iteração 2) ──────────────────────────
    const pageText = await page.textContent('body');
    const isRateLimited = /limite diário|próxima foto|liberar agora|assinar/i.test(pageText ?? '');

    if (isRateLimited && iterNum === 2) {
      log('Rate limit detectado imediatamente na iteração 2!');
      R.bloqueio_funcionou = true;

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-09-bloqueio.png`) });

      // Captura texto do botão bloqueado / countdown
      const countdownEl = page.locator('text=/\\d{2}:\\d{2}/, text=/\\dh \\d{2}m/, [data-testid="countdown"]').first();
      const countdownText = await countdownEl.textContent().catch(() => null);

      // Pega todo o texto visível do bloco de rate limit
      const limitBlock = page.locator('text=/limite diário/i').first();
      const limitParent = limitBlock.locator('xpath=ancestor::div[3]');
      const limitText = await limitParent.textContent().catch(() => null);

      R.texto_botao_bloqueado = countdownText ?? limitText ?? pageText?.substring(0, 500);
      log(`Texto bloqueio: ${R.texto_botao_bloqueado}`);

      // Clica em "Liberar agora" / "Assinar"
      const liberarBtn = page.locator(
        'button:has-text("Liberar"), button:has-text("Assinar"), button:has-text("assinar"), a:has-text("Assinar")'
      ).first();
      const liberarVisible = await liberarBtn.isVisible().catch(() => false);

      if (liberarVisible) {
        log('Clicando em "Liberar agora"...');
        const [response] = await Promise.all([
          page.waitForNavigation({ timeout: 10_000, waitUntil: 'commit' }).catch(() => null),
          liberarBtn.click(),
        ]);
        await sleep(2000);
        R.redirect_liberar_agora = page.url();
        log(`Redirect "Liberar agora": ${R.redirect_liberar_agora}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-10-redirect-planos.png`) });
      } else {
        log('Botão "Liberar agora" não encontrado.');
        R.redirect_liberar_agora = 'botao_nao_encontrado';
      }

      return; // iteração 2 termina aqui
    }

    // ── 8. Poll até resultado (iteração 1) ────────────────────────────────────
    log('Aguardando resultado da geração...');
    const startPoll = Date.now();
    let jobDone = false;
    let outputImageUrl = null;
    let jobId = null;

    while (Date.now() - startPoll < TIMEOUT_MS) {
      await sleep(POLL_INTERVAL);
      const elapsed = Math.floor((Date.now() - gerarClickedAt.getTime()) / 1000);
      log(`Poll... ${elapsed}s decorridos`);

      const bodyText = await page.textContent('body').catch(() => '');

      // Verifica se apareceu rate limit (fundo branco é síncrono, pode já ter terminado)
      const hitRateLimit = /limite diário|próxima foto|liberar agora/i.test(bodyText ?? '');
      if (hitRateLimit) {
        log('Rate limit detectado durante poll — geração concluída (fundo branco é rápido)!');
        R.tempo_geracao_seg = elapsed;
        break;
      }

      // Verifica se foto apareceu
      const outputImg = page.locator('img[src*="output"], img[src*="whitebg"], img[src*="image-jobs"]').first();
      const imgVisible = await outputImg.isVisible().catch(() => false);
      if (imgVisible) {
        outputImageUrl = await outputImg.getAttribute('src').catch(() => null);
        jobDone = true;
        R.tempo_geracao_seg = elapsed;
        R.status_foto = 'done';
        log(`Foto gerada em ${elapsed}s. URL: ${outputImageUrl?.substring(0, 80)}...`);
        break;
      }

      // Verifica se gerou (done state na página — sem rate limit ainda)
      const doneEl = page.locator('text=/sua foto/i, text=/download/i, text=/baixar/i').first();
      const doneVisible = await doneEl.isVisible().catch(() => false);
      if (doneVisible) {
        jobDone = true;
        R.tempo_geracao_seg = elapsed;
        R.status_foto = 'done';
        log(`Estado "done" detectado em ${elapsed}s.`);
        break;
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-poll-${elapsed}s.png`) });
    }

    if (!R.tempo_geracao_seg) {
      R.tempo_geracao_seg = Math.floor((Date.now() - gerarClickedAt.getTime()) / 1000);
      R.erros.push(`Timeout após ${R.tempo_geracao_seg}s`);
      R.status_foto = 'timeout';
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-09-resultado.png`) });

    // ── 9. Verifica foto na tela ──────────────────────────────────────────────
    const outputImgs = page.locator('img[src*="supabase"], img[src*="whitebg"], img[src*="image-jobs"], img[src*="output"]');
    const imgCount = await outputImgs.count();
    log(`Imagens de resultado na tela: ${imgCount}`);

    if (imgCount > 0) {
      R.foto_apareceu = true;
      outputImageUrl = outputImageUrl ?? await outputImgs.first().getAttribute('src').catch(() => null);
      log(`URL da foto: ${outputImageUrl?.substring(0, 100)}...`);

      // Verifica se é URL válida de resultado
      if (outputImageUrl && outputImageUrl.includes('supabase')) {
        R.status_foto = 'done';
      }
    } else {
      R.erros.push('Imagem de resultado não encontrada na tela');
    }

    // ── 10. Testa download ────────────────────────────────────────────────────
    if (outputImageUrl) {
      log('Testando download da imagem...');
      const downloadPath = path.join(SCREENSHOT_DIR, `iter${iterNum}-resultado.jpg`);
      const downloaded = await downloadImageFromUrl(outputImageUrl, downloadPath);
      R.download_funcionou = downloaded && fs.existsSync(downloadPath) && fs.statSync(downloadPath).size > 1000;
      log(`Download: ${R.download_funcionou ? 'OK' : 'FALHOU'}`);
    }

    // ── 11. Verifica ProUpsell ────────────────────────────────────────────────
    log('Verificando ProUpsell...');
    const proUpsell = page.locator('text=/PRO/i, text=/assinar/i, text=/plano/i').first();
    R.pro_upsell_visivel = await proUpsell.isVisible().catch(() => false);
    log(`ProUpsell visível: ${R.pro_upsell_visivel}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-10-upsell.png`) });

    // ── 12. Tenta gerar SEGUNDA foto ──────────────────────────────────────────
    if (iterNum === 1) {
      log('Tentando gerar segunda foto (deve ser bloqueada)...');

      // Procura botão "Nova foto" / "Criar nova" / "Voltar"
      const novaFotoBtn = page.locator(
        'button:has-text("Nova foto"), button:has-text("Criar nova"), button:has-text("nova foto"), button:has-text("Criar outra")'
      ).first();
      const novaVisible = await novaFotoBtn.isVisible().catch(() => false);

      if (novaVisible) {
        await novaFotoBtn.click();
        log('Clicou em Nova foto.');
        await sleep(1500);
      }

      // Agora tenta submeter form novamente (pode precisar de upload outra vez)
      const fileInput2 = page.locator('input[type="file"]').first();
      const fi2Visible = await fileInput2.isVisible().catch(() => false);
      if (fi2Visible) {
        const tmpImg = path.join(SCREENSHOT_DIR, 'tenis-temp.jpg');
        await fileInput2.setInputFiles(tmpImg);
        await sleep(1000);
      }

      // Preenche produto se necessário
      const produtoInput2 = page.locator(
        'input[placeholder*="produto"], input[placeholder*="Produto"]'
      ).first();
      const p2Visible = await produtoInput2.isVisible().catch(() => false);
      if (p2Visible) {
        await produtoInput2.fill('Tênis Nike vermelho');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-11-segunda-tentativa.png`) });

      // Tenta clicar Gerar
      const gerarBtn2 = page.locator(
        'button:has-text("Gerar"), button:has-text("Criar"), button[type="submit"]'
      ).first();
      const g2Visible = await gerarBtn2.isVisible().catch(() => false);
      if (g2Visible) {
        await gerarBtn2.click();
        log('Clicou Gerar (2ª vez).');
        await sleep(3000);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-12-pos-segunda-tentativa.png`) });

      // Verifica bloqueio
      const bodyText2 = await page.textContent('body').catch(() => '');
      const bloqueado = /limite diário|próxima foto|liberar agora|assinar e criar/i.test(bodyText2 ?? '');
      R.bloqueio_funcionou = bloqueado;
      log(`Bloqueio funcionou: ${bloqueado}`);

      if (bloqueado) {
        // Captura countdown
        const countdownEl = page.locator('[class*="countdown"], text=/\\d{2}:\\d{2}/, text=/\\dh \\d{2}m/').first();
        const cText = await countdownEl.textContent().catch(() => null);
        R.texto_botao_bloqueado = cText;

        // Tenta capturar o bloco completo de texto do rate limit
        if (!R.texto_botao_bloqueado) {
          const limitBlock = page.locator('text=/limite diário/i').first();
          const parentEl = limitBlock.locator('xpath=ancestor::div[4]');
          R.texto_botao_bloqueado = await parentEl.textContent().catch(() => bodyText2?.substring(0, 800));
        }
        log(`Texto botão bloqueado: ${R.texto_botao_bloqueado?.substring(0, 200)}`);

        // Clica em "Liberar agora" / "Assinar"
        const liberarBtn = page.locator(
          'button:has-text("Liberar"), button:has-text("Assinar"), button:has-text("assinar e criar")'
        ).first();
        const lbVisible = await liberarBtn.isVisible().catch(() => false);
        if (lbVisible) {
          log('Clicando Liberar agora...');
          const urlBefore = page.url();
          const [nav] = await Promise.all([
            page.waitForNavigation({ timeout: 10_000, waitUntil: 'commit' }).catch(() => null),
            liberarBtn.click(),
          ]);
          await sleep(2000);
          R.redirect_liberar_agora = page.url();
          log(`Redirect: ${R.redirect_liberar_agora}`);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-13-redirect.png`) });
        } else {
          R.redirect_liberar_agora = 'botao_nao_encontrado';
          log('Botão Liberar não encontrado.');
        }
      } else {
        R.erros.push('Bloqueio de rate limit NÃO detectado após 2ª tentativa');
        log('AVISO: bloqueio não detectado!');
      }
    }

  } catch (err) {
    log(`ERRO na iteração ${iterNum}: ${err.message}`);
    R.erros.push(err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `iter${iterNum}-erro.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('Iniciando agente de teste TamoWork Foto IA — FREE B1');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const report = {
    test_started: new Date().toISOString(),
    conta: EMAIL,
    plano: 'free',
    url_base: BASE_URL,
    produto: 'Tênis Nike vermelho',
    modo: 'fundo_branco',
  };

  // Cria conta se necessário
  await ensureAccount();

  // Limpa jobs antigos para começar com estado limpo
  try {
    const token0 = await getSupabaseToken();
    await clearOldJobs(token0);
  } catch (e) {
    log(`Aviso: não foi possível limpar jobs: ${e.message}`);
  }

  // Lança browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ── Iteração 1: gera foto, verifica resultado e bloqueio ──────────────────
    await runIteration(browser, 1, report);

    // Salva relatório parcial
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    log('Relatório parcial salvo.');

    // Pausa breve entre iterações
    await sleep(3000);

    // ── Iteração 2: conta já bloqueada, verifica comportamento ────────────────
    await runIteration(browser, 2, report);

  } finally {
    await browser.close();
  }

  // Finaliza relatório
  report.test_finished = new Date().toISOString();
  report.resumo = {
    iter1_foto_apareceu: report.iteracao_1?.foto_apareceu,
    iter1_download_ok: report.iteracao_1?.download_funcionou,
    iter1_tempo_geracao_seg: report.iteracao_1?.tempo_geracao_seg,
    iter1_pro_upsell: report.iteracao_1?.pro_upsell_visivel,
    iter1_bloqueio: report.iteracao_1?.bloqueio_funcionou,
    iter1_texto_bloqueio: report.iteracao_1?.texto_botao_bloqueado,
    iter1_redirect: report.iteracao_1?.redirect_liberar_agora,
    iter2_bloqueio: report.iteracao_2?.bloqueio_funcionou,
    iter2_texto_bloqueio: report.iteracao_2?.texto_botao_bloqueado,
    iter2_redirect: report.iteracao_2?.redirect_liberar_agora,
    erros_iter1: report.iteracao_1?.erros ?? [],
    erros_iter2: report.iteracao_2?.erros ?? [],
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  log('\n═══ RELATÓRIO FINAL ═══');
  log(JSON.stringify(report.resumo, null, 2));
  log(`\nRelatório salvo em: ${REPORT_PATH}`);
  log(`Screenshots em: ${SCREENSHOT_DIR}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
