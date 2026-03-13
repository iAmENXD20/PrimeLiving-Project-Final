import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const NERMA_EMAIL = 'nerma@primeliving.test'
const NERMA_PASSWORD = 'Nerma@2026!'
const NERMA_NAME = 'Nerma'

async function main() {
  console.log('🔧 Creating owner account for Nerma...\n')

  // 1. Sign up auth user with owner role
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: NERMA_EMAIL,
    password: NERMA_PASSWORD,
    options: {
      data: { name: NERMA_NAME, role: 'owner' },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('⚠️  Auth user already exists. Verifying sign-in...\n')
    } else {
      console.error('❌ Auth signup failed:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Auth user created:', authData.user?.id)
  }

  // 2. Get user id
  let userId = authData?.user?.id
  if (!userId) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: NERMA_EMAIL,
      password: NERMA_PASSWORD,
    })
    if (signInError) {
      console.error('❌ Sign-in failed:', signInError.message)
      process.exit(1)
    }
    userId = signInData.user?.id
    console.log('✅ Signed in as:', userId)
  }

  // 3. Link auth_user_id to existing client record
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .update({ auth_user_id: userId })
    .eq('email', NERMA_EMAIL)
    .select()
    .single()

  if (clientError) {
    console.error('❌ Failed to link client record:', clientError.message)
  } else {
    console.log('✅ Client record linked:', client.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Nerma Owner Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Email:    ${NERMA_EMAIL}`)
  console.log(`  Password: ${NERMA_PASSWORD}`)
  console.log('════════════════════════════════════════\n')

  await supabase.auth.signOut()
}

main()
