const https = require('https');
const http = require('http');

const SUPABASE_URL = "https://ddpyvdtgxemyxltgtxsh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI";
const APP_URL = "https://tamowork-foto-ia.vercel.app";
const SECRET = "tamowork-internal-2026";
const USER_ID = "b5ba115d-06db-4d03-8df4-e4c811b825af";

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createJob(prompt, imageUrl) {
  const payload = JSON.stringify({
    user_id: USER_ID,
    prompt: prompt,
    input_image_url: imageUrl,
    status: "queued"
  });

  const res = await request(`${SUPABASE_URL}/rest/v1/image_jobs`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);

  const data = JSON.parse(res.body);
  if (Array.isArray(data) && data.length > 0) {
    return data[0].id;
  }
  throw new Error(`Create job failed: ${res.body}`);
}

async function submitJob(jobId) {
  const payload = JSON.stringify({ jobId });
  const res = await request(`${APP_URL}/api/internal/image-jobs/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': SECRET,
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);
  return { status: res.status, body: res.body.substring(0, 200) };
}

async function getJobStatus(jobId) {
  const res = await request(`${SUPABASE_URL}/rest/v1/image_jobs?id=eq.${jobId}`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = JSON.parse(res.body);
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

async function getAllJobs() {
  const res = await request(
    `${SUPABASE_URL}/rest/v1/image_jobs?user_id=eq.${USER_ID}&order=created_at.desc&limit=60`,
    {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  return JSON.parse(res.body);
}

async function triggerRecover() {
  const res = await request(`${APP_URL}/api/internal/jobs/recover`, {
    method: 'GET',
    headers: {
      'x-internal-secret': SECRET
    }
  });
  return { status: res.status, body: res.body.substring(0, 500) };
}

async function checkImageUrl(url) {
  try {
    const res = await request(url, { method: 'GET', headers: {} });
    return res.status;
  } catch (e) {
    return 'ERROR';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const jobs_config = [
  // Rodada 1
  { prompt: "shorts masculino azul | cenario praia de dia", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "camiseta branca feminina | cenario estudio fundo branco", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "tenis esportivo | cenario academia", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "jaqueta casual | cenario rua movimentada", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "calca jeans | cenario cafe moderno", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  { prompt: "vestido floral | cenario jardim", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "bolsa de couro | cenario mesa de escritorio", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "oculos de sol | cenario praia", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "relogio masculino | cenario fundo preto", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "colar dourado | cenario pescoco feminino", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  // Rodada 2
  { prompt: "tenis corrida | cenario pista atletismo", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "hoodie cinza | cenario parque outono", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "bermuda estampada | cenario piscina", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  { prompt: "blazer feminino | cenario reuniao corporativa", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "mochila escolar | cenario campus universitario", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "sandalia feminina | cenario shopping", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  { prompt: "camisa polo masculina | cenario campo de golfe", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "legging esportiva | cenario yoga studio", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "bota couro | cenario outono rua", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "pulseira prata | cenario fundo escuro", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  // Rodada 3
  { prompt: "vestido longo | cenario cerimonia casamento", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "calca moletom | cenario home office", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  { prompt: "camiseta polo feminina | cenario jardim flores", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "chapeu panama | cenario praia tropical", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "bone snapback | cenario skatepark urbano", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "regata masculina | cenario academia musculacao", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "saia midi | cenario restaurante sofisticado", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "carteira masculina | cenario mesa madeira", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "bracelete dourado | cenario luz natural janela", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "tenis casual colorido | cenario cidade", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  // Rodada 4
  { prompt: "moletom com capuz | cenario neve montanha", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "biquini listrado | cenario resort luxo", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "camisa social masculina | cenario escritorio moderno", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "mala de viagem | cenario aeroporto", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "sapato social masculino | cenario escadaria marmor", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "vestido rodado | cenario festa ao ar livre", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "pochete | cenario festival musica", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  { prompt: "kimono japones | cenario jardim zen", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "tenis plataforma | cenario loja vintage", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "anel prata | cenario fundo branco minimalista", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  // Rodada 5
  { prompt: "camisa xadrez masculina | cenario bar rustico", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "top fitness | cenario vista montanha", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "trench coat | cenario rua paris", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "shorts jeans feminino | cenario sunset praia", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "terno completo | cenario hotel luxo", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600" },
  { prompt: "chinelo rasteirinha | cenario piscina resort", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600" },
  { prompt: "camiseta banda rock | cenario show noturno", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
  { prompt: "clutch feminina | cenario evento gala", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600" },
  { prompt: "oculos armacao quadrada | cenario biblioteca", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600" },
  { prompt: "conjunto moletom | cenario inverno nevando", image: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600" },
];

async function main() {
  console.log("=== TAMOWORK FOTO IA — TESTE COMPLETO 50 JOBS ===\n");
  console.log(`Data: ${new Date().toISOString()}`);
  console.log(`Total de jobs a criar: ${jobs_config.length}\n`);

  const all_ids = [];
  const ROUNDS = 5;
  const JOBS_PER_ROUND = 10;

  for (let round = 0; round < ROUNDS; round++) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`RODADA ${round + 1} — Jobs ${round * JOBS_PER_ROUND + 1} a ${(round + 1) * JOBS_PER_ROUND}`);
    console.log('='.repeat(50));

    const round_ids = [];

    // Criar jobs da rodada
    for (let i = 0; i < JOBS_PER_ROUND; i++) {
      const idx = round * JOBS_PER_ROUND + i;
      const job = jobs_config[idx];
      try {
        const id = await createJob(job.prompt, job.image);
        round_ids.push(id);
        all_ids.push(id);
        console.log(`  [CREATE] Job ${idx + 1}: OK | ID=${id.substring(0, 8)}... | "${job.prompt.substring(0, 40)}"`);
      } catch (e) {
        console.log(`  [CREATE] Job ${idx + 1}: ERRO | ${e.message.substring(0, 100)}`);
        round_ids.push("ERROR");
        all_ids.push("ERROR");
      }
    }

    // Disparar submits
    console.log(`\n  Disparando ${JOBS_PER_ROUND} submits...`);
    for (let i = 0; i < round_ids.length; i++) {
      const jobId = round_ids[i];
      if (jobId === "ERROR") {
        console.log(`  [SUBMIT] Job ${i + 1}: SKIP`);
        continue;
      }
      try {
        const res = await submitJob(jobId);
        console.log(`  [SUBMIT] Job ${i + 1} (${jobId.substring(0, 8)}...): HTTP ${res.status} | ${res.body.substring(0, 80)}`);
      } catch (e) {
        console.log(`  [SUBMIT] Job ${i + 1}: ERRO | ${e.message}`);
      }
    }

    if (round < ROUNDS - 1) {
      console.log(`\n  Aguardando 2 minutos antes da proxima rodada...`);
      await sleep(120000);
    }
  }

  // FASE 5: Trigger recover
  console.log(`\n${'='.repeat(50)}`);
  console.log('FASE 5 — Testando endpoint recover');
  console.log('='.repeat(50));
  try {
    const recoverRes = await triggerRecover();
    console.log(`Recover: HTTP ${recoverRes.status} | ${recoverRes.body}`);
  } catch (e) {
    console.log(`Recover ERRO: ${e.message}`);
  }

  // Aguardar mais 3 minutos para jobs finalizarem
  console.log('\nAguardando 3 minutos para jobs finalizarem...');
  await sleep(180000);

  // FASE 6+7: Verificar status final
  console.log(`\n${'='.repeat(50)}`);
  console.log('FASE 6+7 — Status final e relatório');
  console.log('='.repeat(50));

  let done_count = 0;
  let failed_count = 0;
  let queued_count = 0;
  let processing_count = 0;
  let error_count = 0;
  let total_time_ms = 0;
  let timed_count = 0;
  const errors_found = [];
  const output_urls = [];

  try {
    const all_jobs = await getAllJobs();
    console.log(`\nTotal de jobs recuperados: ${all_jobs.length}`);

    // Mapear apenas os jobs criados nesta sessão
    const valid_ids = all_ids.filter(id => id !== "ERROR");
    const session_jobs = all_jobs.filter(j => valid_ids.includes(j.id));

    console.log(`Jobs desta sessão: ${session_jobs.length}`);
    console.log('\nDetalhes por job:');
    console.log('-'.repeat(90));

    for (const job of session_jobs) {
      const created = new Date(job.created_at);
      const updated = new Date(job.updated_at);
      const elapsed_sec = Math.round((updated - created) / 1000);

      let status_str = job.status;
      switch (job.status) {
        case 'done': done_count++; break;
        case 'failed': failed_count++; break;
        case 'queued': queued_count++; break;
        case 'processing': processing_count++; break;
        default: error_count++;
      }

      if (job.status === 'done' && job.output_image_url) {
        output_urls.push({ id: job.id, url: job.output_image_url });
        total_time_ms += (updated - created);
        timed_count++;
      }

      if (job.error_message) {
        errors_found.push({ id: job.id.substring(0, 8), prompt: job.prompt.substring(0, 40), error: job.error_message.substring(0, 100) });
      }

      console.log(`  ${job.id.substring(0, 8)}... | ${job.status.padEnd(10)} | ${elapsed_sec}s | ${job.prompt.substring(0, 40)}`);
    }

    // Verificar URLs de output
    if (output_urls.length > 0) {
      console.log(`\n${'='.repeat(50)}`);
      console.log('FASE 6 — Verificando URLs de output');
      console.log('='.repeat(50));

      let urls_ok = 0;
      let urls_fail = 0;

      for (const item of output_urls.slice(0, 10)) { // Verificar max 10
        const status = await checkImageUrl(item.url);
        const ok = status === 200;
        if (ok) urls_ok++; else urls_fail++;
        console.log(`  ${item.id.substring(0, 8)}...: HTTP ${status} | ${ok ? 'OK' : 'FALHOU'}`);
      }

      console.log(`\n  URLs OK: ${urls_ok} | URLs falhas: ${urls_fail}`);
    }

    // Relatório Final
    console.log(`\n${'='.repeat(60)}`);
    console.log('RELATORIO FINAL — TAMOWORK FOTO IA — 50 JOBS');
    console.log('='.repeat(60));
    console.log(`Data do teste:        ${new Date().toISOString()}`);
    console.log(`Total jobs criados:   ${valid_ids.length}`);
    console.log(`Total jobs falhas:    ${all_ids.filter(id => id === "ERROR").length} (erro na criacao)`);
    console.log('');
    console.log('STATUS:');
    console.log(`  done:               ${done_count}`);
    console.log(`  failed:             ${failed_count}`);
    console.log(`  queued:             ${queued_count}`);
    console.log(`  processing:         ${processing_count}`);
    console.log(`  outros:             ${error_count}`);
    console.log('');
    const success_rate = valid_ids.length > 0 ? ((done_count / valid_ids.length) * 100).toFixed(1) : 0;
    console.log(`Taxa de sucesso:      ${success_rate}% (${done_count}/${valid_ids.length})`);

    if (timed_count > 0) {
      const avg_sec = Math.round(total_time_ms / timed_count / 1000);
      console.log(`Tempo medio (done):  ${avg_sec}s`);
    }

    if (errors_found.length > 0) {
      console.log('\nERROS ENCONTRADOS:');
      for (const e of errors_found) {
        console.log(`  [${e.id}] "${e.prompt}" => ${e.error}`);
      }
    }

    // Jobs travados (queued/processing por muito tempo)
    const stuck_jobs = session_jobs.filter(j => {
      const created = new Date(j.created_at);
      const now = new Date();
      const elapsed_min = (now - created) / 1000 / 60;
      return (j.status === 'queued' || j.status === 'processing') && elapsed_min > 5;
    });

    if (stuck_jobs.length > 0) {
      console.log(`\nJOBS TRAVADOS (>5min sem completar): ${stuck_jobs.length}`);
      for (const j of stuck_jobs) {
        console.log(`  ${j.id.substring(0, 8)}... | ${j.status} | "${j.prompt.substring(0, 40)}"`);
      }
    }

  } catch (e) {
    console.log(`Erro ao buscar jobs: ${e.message}`);
  }

  console.log('\n=== FIM DO TESTE ===');
}

main().catch(e => {
  console.error('Erro fatal:', e.message);
  process.exit(1);
});
