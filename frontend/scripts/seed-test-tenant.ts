/**
 * Seed script: Create a sample tenant account for testing.
 *
 * Run from the project root:
 *   npx tsx scripts/seed-test-tenant.ts
 *
 * Sample credentials:
 *   Email:    maria.clar@primeliving.test
 *   Password: Tenant@2026!
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

const TEST_EMAIL = 'maria.clar@primeliving.test'
const TEST_PASSWORD = 'Tenant@2026!'
const TEST_NAME = 'Maria Clar'
const TEST_PHONE = '09171234567'

async function main() {
  console.log('🔧 Creating test tenant account...\n')

  // 1. Sign up auth user with tenant role in metadata
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: {
      data: { name: TEST_NAME, role: 'tenant' },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('⚠️  Auth user already exists. Attempting to link tenant record...\n')
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

  // 3. Find an existing apartment to assign the tenant to
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id, name')
    .eq('status', 'active')
    .limit(1)

  const apartmentId = apartments && apartments.length > 0 ? apartments[0].id : null
  if (apartmentId) {
    console.log(`✅ Will assign tenant to apartment: ${apartments![0].name} (${apartmentId})`)
  } else {
    console.log('⚠️  No apartments found. Tenant will not be assigned to a unit.')
  }

  // 4. Create tenant record linked to auth user
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single()

  if (existingTenant) {
    // Update existing tenant to link auth_user_id
    await supabase
      .from('tenants')
      .update({ auth_user_id: userId })
      .eq('id', existingTenant.id)
    console.log('⚠️  Tenant record already exists, linked auth_user_id:', existingTenant.id)
  } else {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        auth_user_id: userId,
        name: TEST_NAME,
        email: TEST_EMAIL,
        phone: TEST_PHONE,
        apartment_id: apartmentId,
        status: 'active',
      })
      .select()
      .single()

    if (tenantError) {
      console.error('❌ Tenant insert failed:', tenantError.message)
      process.exit(1)
    }
    console.log('✅ Tenant record created:', tenant.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Test Tenant Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Name:     ${TEST_NAME}`)
  console.log(`  Email:    ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
  console.log('════════════════════════════════════════')
  console.log('\nLogin at /login and you will be redirected to /tenant\n')

  // Sign out so it doesn't interfere with current session
  await supabase.auth.signOut()
}

main()
