/**
 * TamoWork Foto IA — Agente de Teste Overnight
 * Conta: free-b5 | Viewport: 375x667 (iPhone SE) | headless: true
 *
 * Testes:
 *   1. Overflow horizontal em todas as páginas
 *   2. Cards de modos cabem na tela
 *   3. Font-size dos campos >= 16px (iOS no-zoom)
 *   4. Altura dos botões >= 44px (touch accessibility)
 *   5. Geração de foto (modo personalizado) — upload + aguarda resultado
 *   6. BottomNav visível e não sobrepõe conteúdo
 *   7. Botão "Entrar com Google" visível e legível
 *
 * Screenshots: c:\Users\Notebook\tamowork-foto-ia\test-screenshots\free-b5\
 * Relatório:   c:\Users\Notebook\tamowork-foto-ia\test-screenshots\free-b5\report.json
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL        = 'https://tamowork.com';
const EMAIL           = 'free-b5@tamowork.test';
const PASSWORD        = 'FreeB5@2026';
const SUPABASE_URL    = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const SCREENSHOT_DIR  = path.join(__dirname, 'test-screenshots', 'free-b5');
const PRODUCT_IMG_URL = 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600';
const VIEWPORT        = { width: 375, height: 667 };
const MAX_GEN_MS      = 8 * 60 * 1000; // 8 min

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function ss(name) {
  return path.join(SCREENSHOT_DIR, `${name}.png`);
}

async function shot(page, name) {
  await page.screenshot({ path: ss(name), fullPage: false });
  log(`Screenshot → ${name}.png`);
}

async function checkOverflow(page) {
  return await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth:  document.documentElement.clientWidth,
      overflow:     document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

async function getFontSizes(page) {
  return await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    return inputs.map(el => {
      const fs = parseFloat(window.getComputedStyle(el).fontSize);
      return { tag: el.tagName, type: el.getAttribute('type') || '', name: el.getAttribute('name') || el.getAttribute('placeholder') || '', fontSize: fs };
    });
  });
}

async function getButtonHeights(page) {
  return await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a.btn, input[type="submit"]'));
    return btns.slice(0, 20).map(el => {
      const r = el.getBoundingClientRect();
      const txt = (el.textContent || '').trim().slice(0, 40);
      return { text: txt, height: Math.round(r.height), width: Math.round(r.width) };
    }).filter(b => b.height > 0);
  });
}

async function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function ensureAccount() {
  log('Verificando/criando conta FREE free-b5...');
  // Tenta buscar usuário existente
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listData?.users?.find(u => u.email === EMAIL);

  let userId;
  if (existing) {
    log(`Conta já existe: ${existing.id}`);
    userId = existing.id;
    // Garante senha conhecida
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
  } else {
    log('Criando conta nova...');
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Falha ao criar conta: ${error.message}`);
    userId = data.user.id;
    log(`Conta criada: ${userId}`);
  }

  // Garante perfil na tabela users (plano free)
  const { error: upsertErr } = await supabaseAdmin.from('users').upsert({
    id: userId,
    email: EMAIL,
    plan: 'free',
  }, { onConflict: 'id', ignoreDuplicates: false });
  if (upsertErr) log(`Aviso upsert users: ${upsertErr.message}`);

  return userId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const report = {
    timestamp:       new Date().toISOString(),
    viewport:        VIEWPORT,
    base_url:        BASE_URL,
    account:         EMAIL,
    overflow_pages:  [],
    font_sizes:      {},
    button_heights:  {},
    bottomnav:       {},
    cards_visible:   null,
    google_button:   null,
    tempo_geracao:   null,
    gen_result:      null,
    errors:          [],
  };

  // ── 0. Criar conta ───────────────────────────────────────────────────────
  let userId;
  try {
    userId = await ensureAccount();
  } catch (e) {
    report.errors.push({ step: 'create_account', message: e.message });
    log(`ERRO criar conta: ${e.message}`);
  }

  // ── Browser ──────────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // ── TESTE 7: Botão Google na tela de login ────────────────────────────────
  log('=== TESTE 7: Login page — botão Google ===');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await shot(page, '07-login');

    // Overflow
    const ov = await checkOverflow(page);
    if (ov.overflow) report.overflow_pages.push('/login');
    log(`Login overflow: ${ov.overflow} (scrollWidth=${ov.scrollWidth})`);

    // Botão Google
    const googleBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const g = btns.find(b => /google/i.test(b.textContent));
      if (!g) return null;
      const r = g.getBoundingClientRect();
      const style = window.getComputedStyle(g);
      return {
        text:    g.textContent.trim().slice(0, 60),
        visible: r.width > 0 && r.height > 0,
        inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
        height:  Math.round(r.height),
        width:   Math.round(r.width),
        fontSize: parseFloat(style.fontSize),
      };
    });
    report.google_button = googleBtn;
    log(`Botão Google: ${JSON.stringify(googleBtn)}`);
  } catch (e) {
    report.errors.push({ step: 'login_page', message: e.message });
    log(`ERRO login page: ${e.message}`);
  }

  // ── Login com email/senha ─────────────────────────────────────────────────
  log('=== Login com email/senha ===');
  try {
    // Procura campo de email
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const passField  = page.locator('input[type="password"]').first();

    await emailField.waitFor({ state: 'visible', timeout: 10000 });
    await emailField.fill(EMAIL);
    await passField.fill(PASSWORD);
    await shot(page, '07b-login-filled');

    // Submete
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Sign in")').first();
    await submitBtn.click();

    // Aguarda redirecionamento
    await page.waitForURL(url => !url.includes('/login'), { timeout: 20000 });
    log(`Logado! URL: ${page.url()}`);
    await shot(page, '07c-after-login');
  } catch (e) {
    report.errors.push({ step: 'login', message: e.message });
    log(`ERRO login: ${e.message}`);

    // Tenta via Supabase direto e injeta cookie de sessão
    log('Tentando login via Supabase API diretamente...');
    try {
      const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);
      const { data: authData, error: authErr } = await supabaseAnon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
      if (authErr) throw new Error(authErr.message);

      const session = authData.session;
      log(`Sessão obtida via API. Injetando localStorage...`);

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(({ url, session }) => {
        const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
        localStorage.setItem(key, JSON.stringify(session));
        // Também tenta chave Supabase padrão
        localStorage.setItem('sb-ddpyvdtgxemyxltgtxsh-auth-token', JSON.stringify(session));
      }, { url: SUPABASE_URL, session });

      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      log(`URL após injeção: ${page.url()}`);
      await shot(page, '07d-after-inject');
    } catch (e2) {
      report.errors.push({ step: 'login_inject', message: e2.message });
      log(`ERRO login inject: ${e2.message}`);
    }
  }

  // ── TESTE 1: Overflow em todas as páginas ─────────────────────────────────
  const pagesToTest = [
    { path: '/',         name: 'home'     },
    { path: '/editor',   name: 'editor'   },
    { path: '/criacoes', name: 'criacoes' },
    { path: '/conta',    name: 'conta'    },
    { path: '/planos',   name: 'planos'   },
  ];

  for (const p of pagesToTest) {
    log(`=== TESTE 1+: ${p.path} ===`);
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await shot(page, `01-${p.name}`);

      // Overflow
      const ov = await checkOverflow(page);
      log(`  overflow: ${ov.overflow} (scrollWidth=${ov.scrollWidth}, clientWidth=${ov.clientWidth})`);
      if (ov.overflow) report.overflow_pages.push(p.path);

      // Font sizes
      const fonts = await getFontSizes(page);
      report.font_sizes[p.path] = fonts;
      const bad = fonts.filter(f => f.fontSize < 16);
      if (bad.length > 0) log(`  ALERTA font < 16px: ${JSON.stringify(bad)}`);

      // Button heights
      const btns = await getButtonHeights(page);
      report.button_heights[p.path] = btns;
      const smallBtns = btns.filter(b => b.height > 0 && b.height < 44);
      if (smallBtns.length > 0) log(`  ALERTA botões < 44px: ${JSON.stringify(smallBtns)}`);

    } catch (e) {
      report.errors.push({ step: `page_${p.name}`, message: e.message });
      log(`ERRO ${p.path}: ${e.message}`);
    }
  }

  // ── TESTE 2: Cards de modos cabem na tela ────────────────────────────────
  log('=== TESTE 2: Cards de modos ===');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const cardsInfo = await page.evaluate(() => {
      // Busca cards de modo
      const cards = Array.from(document.querySelectorAll('[data-mode], .mode-card, [class*="mode"], [class*="card"]'));
      // Fallback: qualquer elemento com imagem e texto que pareça um card
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return cards.slice(0, 10).map(el => {
        const r = el.getBoundingClientRect();
        return {
          className: el.className?.toString().slice(0, 50) || '',
          inViewport: r.top < vh,
          overflowsRight: r.right > vw + 2,
          rect: { top: Math.round(r.top), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) },
        };
      });
    });

    report.cards_visible = cardsInfo;
    log(`  Cards encontrados: ${cardsInfo.length}`);
    await shot(page, '02-cards');
  } catch (e) {
    report.errors.push({ step: 'cards_check', message: e.message });
    log(`ERRO cards: ${e.message}`);
  }

  // ── TESTE 6: BottomNav ────────────────────────────────────────────────────
  log('=== TESTE 6: BottomNav ===');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const navInfo = await page.evaluate(() => {
      const nav = document.querySelector('nav, .bottom-nav, [class*="bottom"]');
      if (!nav) return { found: false };
      const r = nav.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Verifica se está fixo na parte de baixo
      const style = window.getComputedStyle(nav);
      // Pega o conteúdo principal e verifica se BottomNav não sobrepõe
      const main = document.querySelector('main, [class*="content"], [class*="main"]');
      let contentBottom = null;
      if (main) {
        const mr = main.getBoundingClientRect();
        contentBottom = Math.round(mr.bottom);
      }
      return {
        found:       true,
        visible:     r.width > 0 && r.height > 0,
        inViewport:  r.top < vh && r.bottom > 0,
        top:         Math.round(r.top),
        bottom:      Math.round(r.bottom),
        height:      Math.round(r.height),
        position:    style.position,
        contentBottom,
        overlaps:    contentBottom ? contentBottom > r.top : null,
      };
    });

    report.bottomnav = navInfo;
    log(`  BottomNav: ${JSON.stringify(navInfo)}`);
  } catch (e) {
    report.errors.push({ step: 'bottomnav', message: e.message });
    log(`ERRO bottomnav: ${e.message}`);
  }

  // ── TESTE 5: Geração de foto (modo personalizado) ─────────────────────────
  log('=== TESTE 5: Geração de foto ===');
  const genStart = Date.now();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await shot(page, '05a-before-gen');

    // Baixa imagem do tênis
    log('  Baixando imagem do produto...');
    const imgBuffer = await downloadImageBuffer(PRODUCT_IMG_URL);
    const tmpImg = path.join(SCREENSHOT_DIR, 'product-upload.jpg');
    fs.writeFileSync(tmpImg, imgBuffer);
    log(`  Imagem salva: ${tmpImg} (${imgBuffer.length} bytes)`);

    // Seleciona modo "personalizado" se disponível, caso contrário "simulacao"
    log('  Procurando cards de modo...');
    const modeSelected = await page.evaluate(() => {
      // Tenta clicar no card "Foto em cena" (simulacao) ou personalizado
      const allText = document.body.innerText;
      return allText.includes('personalizado') || allText.includes('Foto em cena') || allText.includes('simulacao');
    });
    log(`  Modos disponíveis: ${modeSelected}`);

    // Clica no modo "Foto em cena" (simulacao — modo sem PRO)
    try {
      const modeCard = page.locator('text=Foto em cena, text=simulacao, text=Fundo branco').first();
      await modeCard.click({ timeout: 5000 });
      log('  Modo selecionado');
    } catch {
      log('  Não encontrou card de modo específico, tenta o primeiro card clicável');
      try {
        await page.locator('[data-mode], .mode-card, button:has-text("Foto"), button:has-text("Fundo")').first().click({ timeout: 5000 });
      } catch {
        log('  Nenhum card de modo encontrado, segue com estado atual');
      }
    }

    await page.waitForTimeout(1000);
    await shot(page, '05b-mode-selected');

    // Upload da imagem
    log('  Procurando input de upload...');
    const fileInput = page.locator('input[type="file"]').first();
    const fileInputExists = await fileInput.count();

    if (fileInputExists > 0) {
      await fileInput.setInputFiles(tmpImg);
      log('  Arquivo enviado para input');
    } else {
      // Tenta encontrar botão de upload e clicar
      log('  Input file não encontrado diretamente, procura botão de upload...');
      const uploadBtn = page.locator('button:has-text("foto"), button:has-text("Selecionar"), button:has-text("Upload"), button:has-text("Enviar"), label:has-text("foto")').first();
      const uploadExists = await uploadBtn.count();
      if (uploadExists > 0) {
        await uploadBtn.click();
        await page.waitForTimeout(500);
        // Tenta novamente o input
        await page.locator('input[type="file"]').first().setInputFiles(tmpImg);
      } else {
        log('  AVISO: Não encontrou botão de upload');
      }
    }

    await page.waitForTimeout(2000);
    await shot(page, '05c-after-upload');

    // Preenche campos de produto e cenário (modo personalizado)
    try {
      const produtoField = page.locator('input[placeholder*="produto" i], input[placeholder*="roupa" i], input[name*="produto" i], textarea[placeholder*="produto" i]').first();
      if (await produtoField.count() > 0) {
        await produtoField.fill('Tênis esportivo');
        log('  Campo produto preenchido');
      }

      const cenarioField = page.locator('input[placeholder*="cenário" i], input[placeholder*="cena" i], input[placeholder*="fundo" i], textarea[placeholder*="cenário" i], input[placeholder*="ambiente" i]').first();
      if (await cenarioField.count() > 0) {
        await cenarioField.fill('pista de corrida');
        log('  Campo cenário preenchido');
      }
    } catch (e) {
      log(`  Campos produto/cenário: ${e.message}`);
    }

    await shot(page, '05d-fields-filled');

    // Clica em Gerar
    log('  Procurando botão Gerar...');
    const gerarBtn = page.locator('button:has-text("Gerar"), button:has-text("gerar"), button:has-text("Criar"), button:has-text("Transformar")').first();
    const gerarExists = await gerarBtn.count();

    if (gerarExists > 0) {
      await gerarBtn.click();
      log('  Botão Gerar clicado');
      await shot(page, '05e-generating');

      // Aguarda resultado (até MAX_GEN_MS)
      log(`  Aguardando resultado (até ${MAX_GEN_MS / 60000} min)...`);
      const pollInterval = 10000;
      let resultFound = false;
      let elapsed = 0;

      while (elapsed < MAX_GEN_MS) {
        await page.waitForTimeout(pollInterval);
        elapsed += pollInterval;

        const state = await page.evaluate(() => {
          // Verifica se apareceu imagem resultado
          const resultImg = document.querySelector('[class*="result"] img, [class*="output"] img, [class*="done"] img, img[src*="image-jobs"]');
          const errorMsg = document.querySelector('[class*="error"], [class*="fail"]');
          const progress = document.querySelector('[class*="progress"], [class*="loading"], [class*="generating"], [class*="processing"]');
          return {
            hasResult:  !!resultImg,
            hasError:   !!errorMsg,
            inProgress: !!progress,
            bodyText:   document.body.innerText.slice(0, 300),
          };
        });

        log(`  [${Math.round(elapsed / 1000)}s] hasResult=${state.hasResult} hasError=${state.hasError} inProgress=${state.inProgress}`);

        if (state.hasResult) {
          resultFound = true;
          break;
        }
        if (state.hasError && !state.inProgress) {
          log('  Erro detectado na geração');
          break;
        }

        // Screenshot a cada 60s
        if (elapsed % 60000 < pollInterval) {
          await shot(page, `05f-waiting-${Math.round(elapsed / 1000)}s`);
        }
      }

      const tempoTotal = Date.now() - genStart;
      report.tempo_geracao = Math.round(tempoTotal / 1000);

      await shot(page, '05g-result');

      // Verifica overflow no resultado
      const ovResult = await checkOverflow(page);
      report.gen_result = {
        success:  resultFound,
        elapsed_s: report.tempo_geracao,
        overflow:  ovResult.overflow,
        scrollWidth: ovResult.scrollWidth,
      };

      log(`  Resultado: ${resultFound ? 'SUCESSO' : 'TIMEOUT/ERRO'} em ${report.tempo_geracao}s`);
    } else {
      log('  AVISO: Botão Gerar não encontrado');
      report.gen_result = { success: false, error: 'Botão Gerar não encontrado' };
      report.tempo_geracao = null;
    }

  } catch (e) {
    report.errors.push({ step: 'generate_photo', message: e.message });
    log(`ERRO geração: ${e.message}`);
    report.tempo_geracao = Math.round((Date.now() - genStart) / 1000);
    try { await shot(page, '05z-error'); } catch {}
  }

  // ── Screenshots finais de cada página com BottomNav visível ──────────────
  log('=== Screenshots finais ===');
  const finalPages = [
    { path: '/',         name: 'final-home'     },
    { path: '/editor',   name: 'final-editor'   },
    { path: '/criacoes', name: 'final-criacoes'  },
    { path: '/conta',    name: 'final-conta'     },
    { path: '/planos',   name: 'final-planos'    },
  ];
  for (const p of finalPages) {
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1500);
      await shot(page, p.name);
    } catch (e) {
      log(`ERRO screenshot final ${p.path}: ${e.message}`);
    }
  }

  // ── Relatório ─────────────────────────────────────────────────────────────
  await browser.close();

  const reportPath = path.join(SCREENSHOT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  log('\n═══════════════════════════════════════');
  log('RELATÓRIO FINAL');
  log('═══════════════════════════════════════');
  log(`Overflow pages:    ${report.overflow_pages.length === 0 ? 'NENHUM ✓' : report.overflow_pages.join(', ')}`);
  log(`Botão Google:      ${report.google_button ? report.google_button.text + ` (${report.google_button.height}px)` : 'NÃO ENCONTRADO'}`);
  log(`BottomNav:         ${report.bottomnav?.found ? `height=${report.bottomnav.height}px position=${report.bottomnav.position}` : 'NÃO ENCONTRADO'}`);
  log(`Tempo de geração:  ${report.tempo_geracao != null ? report.tempo_geracao + 's' : 'N/A'}`);
  log(`Resultado geração: ${report.gen_result?.success ? 'SUCESSO' : 'FALHOU'}`);
  log(`Erros:             ${report.errors.length}`);
  if (report.errors.length > 0) {
    for (const e of report.errors) log(`  - [${e.step}] ${e.message}`);
  }
  log(`\nRelatório salvo: ${reportPath}`);
  log(`Screenshots: ${SCREENSHOT_DIR}`);
  log('═══════════════════════════════════════');

  return report;
}

main().catch(e => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
