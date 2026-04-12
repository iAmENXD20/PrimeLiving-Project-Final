/**
 * Seed script: Create a sample owner account for testing.
 *
 * Run from the project root:
 *   npx tsx scripts/seed-test-owner.ts
 *
 * Sample credentials:
 *   Email:    owner@primeliving.test
 *   Password: Owner@2026!
 */

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

const TEST_EMAIL = 'owner@primeliving.test'
const TEST_PASSWORD = 'Owner@2026!'
const TEST_NAME = 'Sample Owner'
const TEST_PHONE = '09123456789'

async function main() {
  console.log('🔧 Creating test owner account...\n')

  // 1. Sign up auth user with owner role in metadata
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: {
      data: { name: TEST_NAME, role: 'owner' },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('⚠️  Auth user already exists. Attempting to link client record...\n')
    } else {
      console.error('❌ Auth signup failed:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Auth user created:', authData.user?.id)
  }

  // 2. Get the user id (sign in if signup returned user with existing account)
  let userId = authData?.user?.id
  if (!userId) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (signInError) {
      console.error('❌ Sign-in failed:', signInError.message)
      process.exit(1)
    }
    userId = signInData.user?.id
  }

  // 3. Create client record linked to auth user
  const { data: existingClient } = await supabase
    .from('apartment_owners')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single()

  if (existingClient) {
    console.log('⚠️  Client record already exists:', existingClient.id)
  } else {
    const { data: client, error: clientError } = await supabase
      .from('apartment_owners')
      .insert({
        auth_user_id: userId,
        first_name: TEST_NAME,
        last_name: '',
        email: TEST_EMAIL,
        phone: TEST_PHONE,
        status: 'active',
      })
      .select()
      .single()

    if (clientError) {
      console.error('❌ Client insert failed:', clientError.message)
      process.exit(1)
    }
    console.log('✅ Client record created:', client.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Test Owner Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Email:    ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
  console.log('════════════════════════════════════════')
  console.log('\nLogin at /login and you will be redirected to /owner\n')

  // Sign out so it doesn't interfere with current session
  await supabase.auth.signOut()
}

main()
