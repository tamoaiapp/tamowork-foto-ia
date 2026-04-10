// stress-setup-m2.mjs — Provisiona conta test-stress-m2 como PRO no Supabase
import https from 'https'

const SUPABASE_URL = 'https://ddpyvdtgxemyxltgtxsh.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTgyMiwiZXhwIjoyMDkwMjExODIyfQ.1q9S08D-0X-UL5yZVsrXfCOAXgBCVKnO7SAtFdAMBdI'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcHl2ZHRneGVteXhsdGd0eHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzU4MjIsImV4cCI6MjA5MDIxMTgyMn0.h2Om8VozW7CuBp2lFoVIrt73CEgRgXNzntZ3duewkgY'
const EMAIL = 'test-stress-m2@tamowork.test'
const PASSWORD = 'StressM2@2026'

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
  console.log('=== Setup conta PRO test-stress-m2 ===\n')

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
  } else if (createResp.status === 422 || createResp.body?.message?.includes('already')) {
    console.log('   ! Usuario ja existe — buscando ID via login...')
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
      // Tentar listar via admin
      console.log('   ! Login falhou — tentando admin list users...')
      const listResp = await request(
        'GET',
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
        null,
        { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      )
      if (listResp.status === 200) {
        const users = listResp.body.users || []
        const found = users.find(u => u.email === EMAIL)
        if (found) {
          userId = found.id
          console.log(`   OK ID via listagem: ${userId}`)
          // Resetar senha
          await request(
            'PUT',
            `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
            { password: PASSWORD },
            { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
          )
          console.log('   OK Senha resetada')
        }
      }
    }
  } else {
    console.error('   ERRO ao criar usuario:', createResp.status, JSON.stringify(createResp.body))
    process.exit(1)
  }

  if (!userId) {
    console.error('   ERRO: nao foi possivel obter userId')
    process.exit(1)
  }

  // 2. Upsert user_plans como PRO
  console.log('\n2. Configurando plano PRO...')
  const upsertResp = await request(
    'POST',
    `${SUPABASE_URL}/rest/v1/user_plans`,
    {
      user_id: userId,
      plan: 'pro',
      period_end: '2027-12-31T23:59:59Z',
      updated_at: new Date().toISOString(),
    },
    {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'resolution=merge-duplicates',
    }
  )
  console.log(`   Status upsert: ${upsertResp.status}`)

  if (upsertResp.status >= 200 && upsertResp.status < 300) {
    console.log('   OK Plano PRO configurado ate 2027-12-31')
  } else {
    console.log('   Resp:', JSON.stringify(upsertResp.body).slice(0, 200))
  }

  // 3. Limpar image_jobs anteriores
  console.log('\n3. Limpando jobs anteriores...')
  const cleanResp = await request(
    'DELETE',
    `${SUPABASE_URL}/rest/v1/image_jobs?user_id=eq.${userId}`,
    null,
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=representation' }
  )
  console.log(`   Jobs deletados: status ${cleanResp.status}`)

  // 4. Verificar
  console.log('\n4. Verificando plano...')
  const verifyResp = await request(
    'GET',
    `${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=*`,
    null,
    { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  )
  if (verifyResp.status === 200 && verifyResp.body.length > 0) {
    console.log('   OK Plan:', JSON.stringify(verifyResp.body[0]))
  }

  console.log('\n=== Setup completo ===')
  console.log(`Email: ${EMAIL}`)
  console.log(`Senha: ${PASSWORD}`)
  console.log(`UserId: ${userId}`)
  console.log(`Plano: PRO (ate 2027-12-31)`)

  return { userId, email: EMAIL, password: PASSWORD }
}

main().catch(err => {
  console.error('ERRO FATAL:', err)
  process.exit(1)
})
