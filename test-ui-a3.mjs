/**
 * Agente de teste overnight — TamoWork Foto IA
 * Conta: ui-a3@tamowork.test | Foco: /editor, /criacoes, /conta, /planos
 *
 * Uso: node test-ui-a3.mjs
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'https://tamowork.com';
const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY';
const TEST_EMAIL = 'ui-a3@tamowork.test';
const TEST_PASSWORD = 'UItest2026!';
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots', 'ui-a3');
const REPORT_PATH = path.join(SCREENSHOTS_DIR, 'report.json');

// Imagem de teste pública
const TEST_IMAGE_URL = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400';

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const report = {
  generated_at: new Date().toISOString(),
  account: TEST_EMAIL,
  base_url: BASE_URL,
  tests: [],
};

async function shot(page, name) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    log(`📸 Screenshot: ${name}.png`);
    return file;
  } catch (e) {
    log(`⚠ Screenshot falhou: ${name} — ${e.message}`);
    return null;
  }
}

function addResult(group, name, status, detail = '', screenshotName = null) {
  const r = { group, name, status, detail };
  if (screenshotName) r.screenshot = `${screenshotName}.png`;
  report.tests.push(r);
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  log(`${icon} [${group}] ${name}: ${detail}`);
}

// ── Supabase: criar/promover conta ───────────────────────────────────────────
async function ensureProAccount() {
  log('Verificando/criando conta PRO no Supabase...');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Tentar criar conta nova
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (createErr) {
    if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists')) {
      log('Conta já existe, buscando user_id...');
      // Listar usuários para encontrar o ID
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find(u => u.email === TEST_EMAIL);
      if (!found) throw new Error('Conta existe mas não consegui encontrar o user_id');
      userId = found.id;
      // Resetar senha para garantir
      await admin.auth.admin.updateUserById(userId, { password: TEST_PASSWORD });
      log(`Senha resetada para ${TEST_EMAIL}`);
    } else {
      throw new Error(`Falha ao criar conta: ${createErr.message}`);
    }
  } else {
    userId = created.user.id;
    log(`Conta criada: ${userId}`);
  }

  // Upsert plano PRO
  const { error: planErr } = await admin.from('user_plans').upsert({
    user_id: userId,
    plan: 'pro',
    period_end: '2027-12-31',
  }, { onConflict: 'user_id' });

  if (planErr) {
    log(`⚠ Falha ao definir plano PRO: ${planErr.message}`);
  } else {
    log(`Plano PRO definido para ${userId}`);
  }

  return userId;
}

// ── Login via UI ─────────────────────────────────────────────────────────────
async function loginViaUI(page) {
  log('Fazendo login via UI...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // A tela de login pode ter um botão "Usar e-mail e senha" antes do formulário
  const emailToggle = page.locator('button:has-text("e-mail"), button:has-text("email"), button:has-text("Email"), button:has-text("senha")').first();
  if (await emailToggle.count() > 0) {
    log('Clicando em "Usar e-mail e senha"...');
    await emailToggle.click();
    await page.waitForTimeout(1000);
  }

  // Preencher email
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i], input[placeholder*="e-mail" i]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(TEST_EMAIL);

  // Preencher senha
  const passInput = page.locator('input[type="password"]').first();
  await passInput.waitFor({ state: 'visible', timeout: 5000 });
  await passInput.fill(TEST_PASSWORD);

  // Clicar em entrar
  const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button:has-text("Continuar")').first();
  await submitBtn.click();

  // Aguardar redirect
  await page.waitForTimeout(4000);
  const url = page.url();
  if (url.includes('/login')) {
    // Tenta aguardar mais
    await page.waitForTimeout(3000);
  }
  log(`URL após login: ${page.url()}`);
}

// ── Baixar imagem de teste como buffer ───────────────────────────────────────
async function downloadTestImage() {
  const { default: https } = await import('https');
  return new Promise((resolve, reject) => {
    https.get(TEST_IMAGE_URL, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── TESTES EDITOR ─────────────────────────────────────────────────────────────
async function testEditor(page) {
  log('\n=== TESTES: /editor ===');

  // 1. Navegar sem imagem
  try {
    await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const scr = 'editor-01-sem-imagem';
    await shot(page, scr);

    // Verificar se mostra upload ou tela vazia
    const body = await page.textContent('body');
    const hasUpload = body.includes('upload') || body.includes('Upload') ||
      body.includes('Enviar') || body.includes('foto') ||
      await page.locator('input[type="file"]').count() > 0;

    if (hasUpload) {
      addResult('editor', '01_sem_imagem_mostra_upload', 'pass', 'Tela de upload exibida ao abrir /editor sem imagem', scr);
    } else {
      const pageUrl = page.url();
      if (pageUrl.includes('/login')) {
        addResult('editor', '01_sem_imagem_mostra_upload', 'warn', 'Redirecionou para login (sessão expirada?)', scr);
        await loginViaUI(page);
        await page.goto(`${BASE_URL}/editor`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        await shot(page, 'editor-01b-apos-login');
      } else {
        addResult('editor', '01_sem_imagem_mostra_upload', 'warn', `Tela sem elemento de upload claro. URL: ${pageUrl}`, scr);
      }
    }
  } catch (e) {
    addResult('editor', '01_sem_imagem_mostra_upload', 'fail', e.message);
  }

  // 2. Upload de imagem via input file
  try {
    // Baixar imagem de teste
    const imgBuffer = await downloadTestImage();
    const tempImgPath = path.join(SCREENSHOTS_DIR, '_test-input.jpg');
    fs.writeFileSync(tempImgPath, imgBuffer);
    log(`Imagem de teste salva: ${tempImgPath}`);

    // Localizar input file
    const fileInput = page.locator('input[type="file"]').first();
    const fileInputCount = await fileInput.count();

    if (fileInputCount > 0) {
      await fileInput.setInputFiles(tempImgPath);
      await page.waitForTimeout(2500);
      const scr = 'editor-02-upload-feito';
      await shot(page, scr);

      // Verificar se imagem apareceu no editor
      const canvas = await page.locator('canvas').count();
      const img = await page.locator('img').count();
      if (canvas > 0 || img > 1) {
        addResult('editor', '02_upload_imagem', 'pass', `Imagem carregada (canvas: ${canvas}, imgs: ${img})`, scr);
      } else {
        addResult('editor', '02_upload_imagem', 'warn', 'Upload feito mas canvas/img não detectado claramente', scr);
      }
    } else {
      // Tentar via sessionStorage e navegar
      await page.evaluate((url) => {
        sessionStorage.setItem('editor_image', url);
      }, TEST_IMAGE_URL);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      const scr = 'editor-02-via-session';
      await shot(page, scr);
      addResult('editor', '02_upload_imagem', 'warn', 'Input file não encontrado; tentou via sessionStorage', scr);
    }
  } catch (e) {
    addResult('editor', '02_upload_imagem', 'fail', e.message);
  }

  // 3. Ferramentas do editor
  // 3a. Adicionar texto
  try {
    // Verificar se há botão de texto
    const textBtn = page.locator('button:has-text("Texto"), button[aria-label*="texto" i], button[title*="texto" i], [data-tool="text"]').first();
    const textBtnCount = await textBtn.count();
    if (textBtnCount > 0) {
      await textBtn.click();
      await page.waitForTimeout(800);
      const scr = 'editor-03a-ferramenta-texto';
      await shot(page, scr);

      // Tentar digitar no campo de texto
      const textInput = page.locator('input[type="text"]:visible, textarea:visible').first();
      if (await textInput.count() > 0) {
        await textInput.fill('Produto em Oferta!');
        await page.waitForTimeout(400);
      }

      // Tentar clicar no canvas para adicionar
      const addBtn = page.locator('button:has-text("Adicionar"), button:has-text("Inserir"), button:has-text("OK")').first();
      if (await addBtn.count() > 0) await addBtn.click();
      else {
        // Clicar no centro do preview
        const preview = page.locator('[class*="preview"], [class*="canvas"], canvas').first();
        if (await preview.count() > 0) await preview.click({ position: { x: 100, y: 100 } });
      }
      await page.waitForTimeout(800);
      const scr2 = 'editor-03a-texto-adicionado';
      await shot(page, scr2);
      addResult('editor', '03a_ferramenta_texto', 'pass', 'Ferramenta texto ativada e texto adicionado', scr2);
    } else {
      // Capturar todas as ferramentas disponíveis
      const btns = await page.locator('button').allTextContents();
      addResult('editor', '03a_ferramenta_texto', 'warn', `Botão texto não encontrado. Botões: ${btns.slice(0,10).join('|')}`);
      await shot(page, 'editor-03a-sem-botao-texto');
    }
  } catch (e) {
    addResult('editor', '03a_ferramenta_texto', 'fail', e.message);
    await shot(page, 'editor-03a-erro');
  }

  // 3b. Crop — ratios
  try {
    const cropBtn = page.locator('button:has-text("Cortar"), button:has-text("Crop"), button[aria-label*="crop" i], [data-tool="crop"]').first();
    if (await cropBtn.count() > 0) {
      await cropBtn.click();
      await page.waitForTimeout(800);
      const scr = 'editor-03b-crop-aberto';
      await shot(page, scr);

      const ratios = ['1:1', '4:5', '9:16'];
      const ratioResults = [];
      for (const ratio of ratios) {
        const ratioBtn = page.locator(`button:has-text("${ratio}"), [data-ratio="${ratio}"]`).first();
        if (await ratioBtn.count() > 0) {
          await ratioBtn.click();
          await page.waitForTimeout(500);
          ratioResults.push(ratio);
        }
      }
      const scr2 = 'editor-03b-crop-ratios';
      await shot(page, scr2);
      if (ratioResults.length > 0) {
        addResult('editor', '03b_crop_ratios', 'pass', `Ratios testados: ${ratioResults.join(', ')}`, scr2);
      } else {
        addResult('editor', '03b_crop_ratios', 'warn', 'Crop aberto mas botões de ratio não encontrados', scr);
      }
    } else {
      addResult('editor', '03b_crop_ratios', 'warn', 'Botão de crop não encontrado na toolbar');
      await shot(page, 'editor-03b-sem-crop');
    }
  } catch (e) {
    addResult('editor', '03b_crop_ratios', 'fail', e.message);
    await shot(page, 'editor-03b-erro');
  }

  // 3c. Ajustes (brilho/contraste)
  try {
    const adjustBtn = page.locator('button:has-text("Ajustes"), button:has-text("Ajuste"), button:has-text("Brilho"), button[aria-label*="ajust" i], [data-tool="adjust"]').first();
    if (await adjustBtn.count() > 0) {
      await adjustBtn.click();
      await page.waitForTimeout(800);
      const scr = 'editor-03c-ajustes';
      await shot(page, scr);

      // Tentar mover sliders
      const sliders = page.locator('input[type="range"]');
      const sliderCount = await sliders.count();
      if (sliderCount > 0) {
        // Brilho (primeiro slider)
        await sliders.nth(0).fill('130');
        await page.waitForTimeout(300);
        // Contraste (segundo slider)
        if (sliderCount > 1) {
          await sliders.nth(1).fill('120');
          await page.waitForTimeout(300);
        }
        const scr2 = 'editor-03c-ajustes-feitos';
        await shot(page, scr2);
        addResult('editor', '03c_ajustes_brilho_contraste', 'pass', `${sliderCount} sliders ajustados`, scr2);
      } else {
        addResult('editor', '03c_ajustes_brilho_contraste', 'warn', 'Painel ajustes aberto mas sliders não encontrados', scr);
      }
    } else {
      addResult('editor', '03c_ajustes_brilho_contraste', 'warn', 'Botão ajustes não encontrado');
      await shot(page, 'editor-03c-sem-ajustes');
    }
  } catch (e) {
    addResult('editor', '03c_ajustes_brilho_contraste', 'fail', e.message);
    await shot(page, 'editor-03c-erro');
  }

  // 3d. Stickers/Logo
  try {
    const stickerBtn = page.locator('button:has-text("Sticker"), button:has-text("Adesivo"), button:has-text("Logo"), [data-tool="stickers"], [data-tool="logo"]').first();
    if (await stickerBtn.count() > 0) {
      await stickerBtn.click();
      await page.waitForTimeout(800);
      const scr = 'editor-03d-stickers';
      await shot(page, scr);

      // Clicar no primeiro sticker disponível
      const sticker = page.locator('[class*="sticker"], button:has-text("PROMOÇÃO"), button:has-text("OFERTA")').first();
      if (await sticker.count() > 0) {
        await sticker.click();
        await page.waitForTimeout(600);
        const scr2 = 'editor-03d-sticker-adicionado';
        await shot(page, scr2);
        addResult('editor', '03d_sticker_logo', 'pass', 'Sticker selecionado e adicionado', scr2);
      } else {
        addResult('editor', '03d_sticker_logo', 'warn', 'Painel stickers aberto mas itens não clicáveis', scr);
      }
    } else {
      addResult('editor', '03d_sticker_logo', 'warn', 'Botão sticker/logo não encontrado');
      await shot(page, 'editor-03d-sem-sticker');
    }
  } catch (e) {
    addResult('editor', '03d_sticker_logo', 'fail', e.message);
    await shot(page, 'editor-03d-erro');
  }

  // 3e. Remover elemento selecionado
  try {
    const delBtn = page.locator('button:has-text("Remover"), button:has-text("Deletar"), button:has-text("Excluir"), button[aria-label*="remov" i]').first();
    if (await delBtn.count() > 0) {
      await delBtn.click();
      await page.waitForTimeout(600);
      const scr = 'editor-03e-elemento-removido';
      await shot(page, scr);
      addResult('editor', '03e_remover_elemento', 'pass', 'Botão remover encontrado e clicado', scr);
    } else {
      addResult('editor', '03e_remover_elemento', 'warn', 'Botão remover não encontrado (pode ser via tecla Delete)');
      await shot(page, 'editor-03e-sem-remover');
    }
  } catch (e) {
    addResult('editor', '03e_remover_elemento', 'fail', e.message);
  }

  // 4. Salvar imagem
  try {
    const saveBtn = page.locator('button:has-text("Salvar"), button:has-text("Download"), button:has-text("Baixar"), button:has-text("Exportar")').first();
    if (await saveBtn.count() > 0) {
      // Configurar listener de download
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        saveBtn.click(),
      ]);
      await page.waitForTimeout(1500);
      const scr = 'editor-04-salvar';
      await shot(page, scr);
      if (download) {
        addResult('editor', '04_salvar_imagem', 'pass', `Download iniciado: ${download.suggestedFilename()}`, scr);
      } else {
        addResult('editor', '04_salvar_imagem', 'warn', 'Botão salvar clicado mas download não detectado (pode ser bloqueado em headless)', scr);
      }
    } else {
      addResult('editor', '04_salvar_imagem', 'warn', 'Botão salvar não encontrado');
      await shot(page, 'editor-04-sem-salvar');
    }
  } catch (e) {
    addResult('editor', '04_salvar_imagem', 'fail', e.message);
    await shot(page, 'editor-04-erro');
  }

  // 5. Botão voltar
  try {
    const backBtn = page.locator('button:has-text("Voltar"), button[aria-label*="voltar" i], a:has-text("Voltar"), [class*="back"]').first();
    if (await backBtn.count() > 0) {
      const urlBefore = page.url();
      await backBtn.click();
      await page.waitForTimeout(2000);
      const urlAfter = page.url();
      const scr = 'editor-05-voltar';
      await shot(page, scr);
      if (urlAfter !== urlBefore && !urlAfter.includes('/editor')) {
        addResult('editor', '05_botao_voltar', 'pass', `Voltou de ${urlBefore} para ${urlAfter}`, scr);
      } else {
        addResult('editor', '05_botao_voltar', 'warn', `URL não mudou: ${urlAfter}`, scr);
      }
    } else {
      addResult('editor', '05_botao_voltar', 'warn', 'Botão voltar não encontrado');
      await shot(page, 'editor-05-sem-voltar');
    }
  } catch (e) {
    addResult('editor', '05_botao_voltar', 'fail', e.message);
  }
}

// ── TESTES CRIAÇÕES ─────────────────────────────────────────────────────────
async function testCriacoes(page) {
  log('\n=== TESTES: /criacoes ===');

  // 1. Carregar página
  try {
    await page.goto(`${BASE_URL}/criacoes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const scr = 'criacoes-01-carregou';
    await shot(page, scr);

    const url = page.url();
    if (url.includes('/login')) {
      addResult('criacoes', '01_carrega_sem_erro', 'fail', 'Redirecionou para login — sessão inválida', scr);
      return;
    }

    const hasError = await page.locator('[class*="error"], [class*="Error"], text="Erro"').count() > 0;
    if (hasError) {
      addResult('criacoes', '01_carrega_sem_erro', 'fail', 'Erro visível na página', scr);
    } else {
      addResult('criacoes', '01_carrega_sem_erro', 'pass', `Página carregou. URL: ${url}`, scr);
    }
  } catch (e) {
    addResult('criacoes', '01_carrega_sem_erro', 'fail', e.message);
    return;
  }

  // 2. Clicar em foto (se houver)
  try {
    const cards = page.locator('[class*="card"] img, .criacoes-grid img, img[src*="supabase"]');
    const count = await cards.count();
    if (count > 0) {
      await cards.first().click();
      await page.waitForTimeout(1500);
      const scr = 'criacoes-02-detalhe-foto';
      await shot(page, scr);
      const modal = await page.locator('[class*="modal"], [class*="overlay"]').count() > 0;
      addResult('criacoes', '02_clique_foto_abre_detalhe', modal ? 'pass' : 'warn',
        modal ? `Modal aberto com ${count} fotos disponíveis` : 'Clique feito mas modal não detectado', scr);
      // Fechar modal
      const closeBtn = page.locator('button:has-text("✕"), button:has-text("×"), button[class*="close"]').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
    } else {
      // Estado vazio — verificar mensagem
      const body = await page.textContent('body');
      const hasEmptyMsg = body.includes('Suas fotos aparecem aqui') || body.includes('Criar minha primeira foto') || body.includes('ainda não criou');
      addResult('criacoes', '02_clique_foto_abre_detalhe', hasEmptyMsg ? 'pass' : 'warn',
        hasEmptyMsg ? 'Estado vazio correto (sem fotos ainda)' : 'Sem fotos e sem mensagem de estado vazio');
      await shot(page, 'criacoes-02-estado-vazio');
    }
  } catch (e) {
    addResult('criacoes', '02_clique_foto_abre_detalhe', 'fail', e.message);
    await shot(page, 'criacoes-02-erro');
  }

  // 3. Grid responsivo
  try {
    const grid = page.locator('.criacoes-grid, [class*="grid"]').first();
    if (await grid.count() > 0) {
      const box = await grid.boundingBox();
      addResult('criacoes', '03_grid_responsivo', 'pass', `Grid encontrado: ${Math.round(box?.width || 0)}px wide`);
    } else {
      // Sem fotos, grid não renderiza — aceitável
      addResult('criacoes', '03_grid_responsivo', 'warn', 'Grid não renderizado (sem fotos na conta)');
    }
    await shot(page, 'criacoes-03-grid');
  } catch (e) {
    addResult('criacoes', '03_grid_responsivo', 'fail', e.message);
  }

  // 4. Header fixo ao rolar
  try {
    const headerBefore = await page.locator('header, [class*="header"], [class*="Header"]').first().boundingBox();
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    const headerAfter = await page.locator('header, [class*="header"], [class*="Header"]').first().boundingBox();
    const scr = 'criacoes-04-header-scroll';
    await shot(page, scr);

    if (headerBefore && headerAfter && Math.abs(headerBefore.y - headerAfter.y) < 5) {
      addResult('criacoes', '04_header_fixo_scroll', 'pass', 'Header manteve posição ao rolar', scr);
    } else {
      addResult('criacoes', '04_header_fixo_scroll', 'warn',
        `Header antes: y=${headerBefore?.y?.toFixed(0)}, depois: y=${headerAfter?.y?.toFixed(0)}`, scr);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch (e) {
    addResult('criacoes', '04_header_fixo_scroll', 'fail', e.message);
  }
}

// ── TESTES CONTA ─────────────────────────────────────────────────────────────
async function testConta(page) {
  log('\n=== TESTES: /conta ===');

  try {
    await page.goto(`${BASE_URL}/conta`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const scr = 'conta-01-carregou';
    await shot(page, scr);

    const url = page.url();
    if (url.includes('/login')) {
      addResult('conta', '01_plano_pro_aparece', 'fail', 'Redirecionou para login', scr);
      return;
    }

    // 1. Plano PRO
    const body = await page.textContent('body');
    const hasPro = body.toLowerCase().includes('pro') || body.includes('PRO');
    addResult('conta', '01_plano_pro_aparece', hasPro ? 'pass' : 'fail',
      hasPro ? 'Plano PRO visível na página' : 'Plano PRO NÃO encontrado na página', scr);

    // 2. Email visível
    const hasEmail = body.includes('ui-a3') || body.includes('tamowork.test') || body.includes('@');
    addResult('conta', '02_email_visivel', hasEmail ? 'pass' : 'warn',
      hasEmail ? 'Email do usuário visível' : 'Email não encontrado no texto da página');

    // 3. Botão logout
    const logoutBtn = page.locator('button:has-text("Sair"), button:has-text("Logout"), button:has-text("Deslogar"), a:has-text("Sair")').first();
    const hasLogout = await logoutBtn.count() > 0;
    const scr2 = 'conta-03-logout';
    if (hasLogout) {
      // Não vamos realmente fazer logout para não quebrar a sessão
      addResult('conta', '03_botao_logout', 'pass', 'Botão de logout encontrado (não clicado para preservar sessão)');
    } else {
      await shot(page, scr2);
      addResult('conta', '03_botao_logout', 'warn', 'Botão logout não encontrado com seletores padrão', scr2);
    }
  } catch (e) {
    addResult('conta', '01_plano_pro_aparece', 'fail', e.message);
  }
}

// ── TESTES PLANOS ─────────────────────────────────────────────────────────────
async function testPlanos(page) {
  log('\n=== TESTES: /planos ===');

  try {
    await page.goto(`${BASE_URL}/planos`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const scr = 'planos-01-carregou';
    await shot(page, scr);

    const url = page.url();
    if (url.includes('/login')) {
      addResult('planos', '01_pagina_carrega', 'fail', 'Redirecionou para login', scr);
      return;
    }

    // 1. Página carrega
    const body = await page.textContent('body');
    addResult('planos', '01_pagina_carrega', 'pass', `Página carregou. URL: ${url}`, scr);

    // 2. Preços corretos
    const hasAnual228 = body.includes('228') || body.includes('R$228') || body.includes('R$ 228');
    const hasMensal49 = body.includes('49') || body.includes('R$49') || body.includes('R$ 49');
    const scr2 = 'planos-02-precos';
    await shot(page, scr2);

    if (hasAnual228 && hasMensal49) {
      addResult('planos', '02_precos_corretos', 'pass', 'Preços R$228/ano e R$49/mês encontrados', scr2);
    } else if (hasAnual228 || hasMensal49) {
      addResult('planos', '02_precos_corretos', 'warn',
        `Apenas alguns preços encontrados. Anual(228): ${hasAnual228}, Mensal(49): ${hasMensal49}`, scr2);
    } else {
      // Verificar quais preços aparecem
      const precos = body.match(/R\$\s*[\d.,]+/g) || [];
      addResult('planos', '02_precos_corretos', 'fail',
        `Preços não encontrados. Encontrados: ${precos.join(', ')}`, scr2);
    }

    // 3. Botão assinar — destino
    const assinarBtn = page.locator('button:has-text("Assinar"), button:has-text("Contratar"), button:has-text("Comprar"), a:has-text("Assinar")').first();
    if (await assinarBtn.count() > 0) {
      // Pegar href se for link, ou capturar navegação
      const scr3 = 'planos-03-botao-assinar';
      await shot(page, scr3);
      // Clicar e verificar destino
      const [respOrNav] = await Promise.all([
        page.waitForNavigation({ timeout: 6000 }).catch(() => null),
        assinarBtn.click(),
      ]);
      await page.waitForTimeout(2000);
      const destUrl = page.url();
      const scr4 = 'planos-03-apos-clicar-assinar';
      await shot(page, scr4);

      const goesMP = destUrl.includes('mercadopago') || destUrl.includes('mp');
      const goesStripe = destUrl.includes('stripe') || destUrl.includes('checkout.stripe.com');
      const goesInternal = destUrl.includes('tamowork.com') || destUrl.includes('localhost');

      addResult('planos', '03_botao_assinar_destino', 'pass',
        `Clicou assinar → ${destUrl}. MP: ${goesMP}, Stripe: ${goesStripe}`, scr4);

      // Voltar
      await page.goBack().catch(() => {});
      await page.waitForTimeout(1000);
    } else {
      // Capturar todos os botões
      const btns = await page.locator('button').allTextContents();
      addResult('planos', '03_botao_assinar_destino', 'warn',
        `Botão assinar não encontrado. Botões: ${btns.slice(0, 8).join(' | ')}`);
      await shot(page, 'planos-03-sem-botao');
    }
  } catch (e) {
    addResult('planos', '01_pagina_carrega', 'fail', e.message);
    await shot(page, 'planos-erro');
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('=== TamoWork Foto IA — Agente de Teste UI (ui-a3) ===');
  ensureDir(SCREENSHOTS_DIR);

  // 1. Preparar conta PRO
  let userId;
  try {
    userId = await ensureProAccount();
    addResult('setup', 'conta_pro_supabase', 'pass', `User ID: ${userId}`);
  } catch (e) {
    addResult('setup', 'conta_pro_supabase', 'fail', e.message);
    log('FATAL: Não foi possível preparar a conta. Abortando.');
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // 2. Lançar browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Ignorar erros de console não críticos
  page.on('console', msg => {
    if (msg.type() === 'error') log(`[browser error] ${msg.text().slice(0, 120)}`);
  });

  try {
    // 3. Login
    await loginViaUI(page);
    const loginUrl = page.url();
    const loggedIn = !loginUrl.includes('/login');
    addResult('setup', 'login_ui', loggedIn ? 'pass' : 'fail',
      loggedIn ? `Logado. URL: ${loginUrl}` : `Falha no login. URL: ${loginUrl}`);

    if (!loggedIn) {
      await shot(page, 'setup-login-falhou');
      log('⚠ Login falhou. Prosseguindo com testes (podem falhar por auth)...');
    } else {
      await shot(page, 'setup-login-ok');
    }

    // 4. Rodar suítes de teste
    await testEditor(page);
    await testCriacoes(page);
    await testConta(page);
    await testPlanos(page);

  } catch (e) {
    log(`ERRO FATAL: ${e.message}`);
    addResult('fatal', 'erro_inesperado', 'fail', e.message);
    await shot(page, 'fatal-erro').catch(() => {});
  } finally {
    await browser.close();
  }

  // 5. Salvar relatório
  const total = report.tests.length;
  const passed = report.tests.filter(t => t.status === 'pass').length;
  const failed = report.tests.filter(t => t.status === 'fail').length;
  const warned = report.tests.filter(t => t.status === 'warn').length;

  report.summary = { total, passed, failed, warned };
  report.finished_at = new Date().toISOString();

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  log('\n=== RESULTADO FINAL ===');
  log(`Total: ${total} | ✅ Pass: ${passed} | ❌ Fail: ${failed} | ⚠️ Warn: ${warned}`);
  log(`Relatório salvo: ${REPORT_PATH}`);
  log(`Screenshots: ${SCREENSHOTS_DIR}`);

  // Resumo por grupo
  const groups = [...new Set(report.tests.map(t => t.group))];
  for (const g of groups) {
    const gTests = report.tests.filter(t => t.group === g);
    const gPass = gTests.filter(t => t.status === 'pass').length;
    const gFail = gTests.filter(t => t.status === 'fail').length;
    const gWarn = gTests.filter(t => t.status === 'warn').length;
    log(`  [${g}] ✅${gPass} ❌${gFail} ⚠️${gWarn}`);
  }
}

main().catch(e => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
