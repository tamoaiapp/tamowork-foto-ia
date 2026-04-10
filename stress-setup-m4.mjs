// stress-setup-m4.mjs — Provisiona conta test-stress-m4 como PRO no Supabase
import https from 'https'

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY'
const EMAIL = 'test-stress-m4@tamowork.test'
const PASSWORD = 'StressM4@2026'

async function request(method, url, body, headers) {
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function main() {
  console.log('=== Setup conta PRO test-stress-m4 ===\n')

  // 1. Criar usuário via Admin API
  console.log('1. Criando usuário via Admin API...')
  const createResp = await request('POST', `${SUPABASE_URL}/auth/v1/admin/users`,
    { email: EMAIL, password: PASSWORD, email_confirm: true },
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  )

  let userId
  if (createResp.status === 200 || createResp.status === 201) {
    userId = createResp.body.id
    console.log(`   OK Usuário criado: ${userId}`)
  } else if (createResp.body?.msg?.includes('already') || createResp.body?.message?.includes('already') || createResp.status === 422) {
    console.log(`   ! Usuário já existe — buscando via login...`)
    const loginResp = await request('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      { email: EMAIL, password: PASSWORD },
      { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
    )
    if (loginResp.status === 200) {
      userId = loginResp.body.user?.id
      console.log(`   OK ID via login: ${userId}`)
    } else {
      console.log('   ! Listando users...')
      const listResp = await request('GET', `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, null,
        { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      )
      if (listResp.status === 200) {
        const found = (listResp.body.users || []).find(u => u.email === EMAIL)
        if (found) {
          userId = found.id
          console.log(`   OK ID na lista: ${userId}`)
          await request('PUT', `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
            { password: PASSWORD },
            { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
          )
        }
      }
    }
  } else {
    console.error('   ERRO ao criar:', createResp.status, JSON.stringify(createResp.body))
    process.exit(1)
  }

  if (!userId) { console.error('   ERRO: sem user_id'); process.exit(1) }

  // 2. Login
  console.log('\n2. Login para obter access_token...')
  const loginResp = await request('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    { email: EMAIL, password: PASSWORD },
    { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  )
  if (loginResp.status !== 200) {
    console.error('   ERRO login:', loginResp.status, JSON.stringify(loginResp.body))
    process.exit(1)
  }
  const accessToken = loginResp.body.access_token
  console.log(`   OK token: ${accessToken.substring(0, 20)}...`)

  // 3. Upsert user_plans PRO
  console.log('\n3. Provisionando plano PRO...')
  const planResp = await request('POST', `${SUPABASE_URL}/rest/v1/user_plans`,
    { user_id: userId, plan: 'pro', period_end: '2027-12-31' },
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'resolution=merge-duplicates' }
  )
  if ([200, 201, 204].includes(planResp.status)) {
    console.log(`   OK Plano PRO ativo ate 2027-12-31`)
  } else {
    console.log(`   ! POST ${planResp.status} — tentando PATCH...`)
    const patchResp = await request('PATCH', `${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`,
      { plan: 'pro', period_end: '2027-12-31' },
      { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' }
    )
    console.log(`   PATCH: ${patchResp.status}`)
  }

  // 4. Verificar
  const verifyResp = await request('GET', `${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=*`, null,
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  )
  console.log('\n4. Verificação:', JSON.stringify(verifyResp.body))

  // Salvar credenciais
  const fs = await import('fs')
  const creds = { userId, email: EMAIL, password: PASSWORD }
  fs.default.writeFileSync('c:/Users/Notebook/tamowork-foto-ia/stress-m4-credentials.json', JSON.stringify(creds, null, 2))
  console.log('\n=== Setup concluido ===')
  console.log(`USER_ID=${userId}`)
  console.log('Credenciais salvas em stress-m4-credentials.json')
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1) })
