// stress-setup-d5.mjs — Provisiona conta test-stress-d5 como PRO no Supabase
import https from 'https'

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY'
const EMAIL = 'test-stress-d5@tamowork.test'
const PASSWORD = 'StressD5@2026'

function request(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
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

async function main() {
  console.log('=== Setup conta PRO test-stress-d5 ===\n')

  // 1. Criar usuário via Admin API
  console.log('1. Criando usuário via Admin API...')
  const createResp = await request(
    'POST',
    `${SUPABASE_URL}/auth/v1/admin/users`,
    { email: EMAIL, password: PASSWORD, email_confirm: true },
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  )

  let userId
  if (createResp.status === 200 || createResp.status === 201) {
    userId = createResp.body.id
    console.log(`   OK Usuario criado: ${userId}`)
  } else {
    console.log(`   ! Usuario ja existe ou erro (${createResp.status}) — tentando login...`)
    const loginResp = await request(
      'POST',
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      { email: EMAIL, password: PASSWORD },
      { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
    )
    if (loginResp.status === 200) {
      userId = loginResp.body.user?.id
      console.log(`   OK ID obtido via login: ${userId}`)
    } else {
      // Buscar via admin list
      const listResp = await request(
        'GET',
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=500`,
        null,
        { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      )
      if (listResp.status === 200) {
        const found = (listResp.body.users || []).find(u => u.email === EMAIL)
        if (found) {
          userId = found.id
          console.log(`   OK ID encontrado na lista: ${userId}`)
          // Atualizar senha
          await request(
            'PUT',
            `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
            { password: PASSWORD },
            { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
          )
          console.log('   OK Senha atualizada')
        }
      }
    }
  }

  if (!userId) {
    console.error('   ERRO Nao conseguiu obter user_id')
    process.exit(1)
  }

  // 2. Login para obter access_token
  console.log('\n2. Fazendo login...')
  const loginResp = await request(
    'POST',
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    { email: EMAIL, password: PASSWORD },
    { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  )

  if (loginResp.status !== 200) {
    console.error('   ERRO Login falhou:', loginResp.status, JSON.stringify(loginResp.body))
    process.exit(1)
  }
  const accessToken = loginResp.body.access_token
  console.log(`   OK access_token obtido`)

  // 3. Upsert user_plans PRO
  console.log('\n3. Provisionando plano PRO...')
  const planResp = await request(
    'POST',
    `${SUPABASE_URL}/rest/v1/user_plans`,
    { user_id: userId, plan: 'pro', period_end: '2027-12-31', mp_subscription_id: 'stress-test-d5', updated_at: new Date().toISOString() },
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'resolution=merge-duplicates' }
  )

  if (planResp.status >= 200 && planResp.status < 300) {
    console.log(`   OK Plano PRO ativo ate 2027-12-31`)
  } else {
    console.log(`   ! POST status=${planResp.status}, tentando PATCH...`)
    const patchResp = await request(
      'PATCH',
      `${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`,
      { plan: 'pro', period_end: '2027-12-31', updated_at: new Date().toISOString() },
      { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' }
    )
    console.log(`   PATCH status=${patchResp.status}`)
    if (patchResp.status < 200 || patchResp.status >= 300) {
      // Tentar INSERT
      const insertResp = await request(
        'POST',
        `${SUPABASE_URL}/rest/v1/user_plans`,
        { user_id: userId, plan: 'pro', period_end: '2027-12-31' },
        { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' }
      )
      console.log(`   INSERT status=${insertResp.status}`)
    }
  }

  // 4. Verificar
  console.log('\n4. Verificando...')
  const verifyResp = await request(
    'GET',
    `${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=*`,
    null,
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  )
  console.log(`   Dados: ${JSON.stringify(verifyResp.body)}`)

  console.log('\n=== Setup concluido ===')
  console.log(`USER_ID=${userId}`)

  const { default: fs } = await import('fs')
  fs.writeFileSync(
    'c:/Users/Notebook/tamowork-foto-ia/stress-d5-credentials.json',
    JSON.stringify({ userId, email: EMAIL, password: PASSWORD }, null, 2)
  )
  console.log('OK Credenciais salvas em stress-d5-credentials.json')
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1) })
