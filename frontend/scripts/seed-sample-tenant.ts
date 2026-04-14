/**
 * Seed script: Create a sample tenant account for testing.
 *
 * Run from the frontend folder:
 *   npx tsx scripts/seed-sample-tenant.ts
 *
 * Sample credentials:
 *   Email:    tenant@primeliving.com
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
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const TEST_EMAIL = 'bebietdelmundomanalo@gmail.com'
const TEST_PASSWORD = 'Nerma@1234'
const FIRST_NAME = 'Bebiet'
const LAST_NAME = 'Manalo'
const PHONE = '09171234567'

async function main() {
  console.log('Creating sample tenant account...\n')

  // 1. Sign up auth user with tenant role
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: {
      data: { name: `${FIRST_NAME} ${LAST_NAME}`, role: 'tenant' },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('Auth user already exists. Linking tenant record...\n')
    } else {
      console.error('Auth signup failed:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('Auth user created:', authData.user?.id)
  }

  // 2. Get user ID
  let userId = authData?.user?.id
  if (!userId) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (signInError) {
      console.error('Sign-in failed:', signInError.message)
      process.exit(1)
    }
    userId = signInData.user?.id
  }

  // 3. Find the owner to link tenant under
  const { data: owners } = await supabase
    .from('apartment_owners')
    .select('id')
    .limit(1)

  const ownerId = owners?.[0]?.id || null

  // 4. Find an active unit to assign
  const { data: units } = await supabase
    .from('units')
    .select('id, name, apartment_id')
    .eq('status', 'occupied')
    .limit(1)

  let unitId = units?.[0]?.id || null
  let apartmentId = units?.[0]?.apartment_id || null

  // Fallback: any available unit
  if (!unitId) {
    const { data: anyUnits } = await supabase
      .from('units')
      .select('id, name, apartment_id')
      .limit(1)
    unitId = anyUnits?.[0]?.id || null
    apartmentId = anyUnits?.[0]?.apartment_id || null
  }

  if (unitId) console.log(`Assigning to unit: ${unitId}`)
  if (apartmentId) console.log(`In apartment: ${apartmentId}`)

  // 5. Create or update tenant record
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single()

  if (existingTenant) {
    await supabase
      .from('tenants')
      .update({
        auth_user_id: userId,
        first_name: FIRST_NAME,
        last_name: LAST_NAME,
        phone: PHONE,
        unit_id: unitId,
        apartment_id: apartmentId,
        apartmentowner_id: ownerId,
        status: 'active',
      })
      .eq('id', existingTenant.id)
    console.log('Tenant record updated:', existingTenant.id)
  } else {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        auth_user_id: userId,
        first_name: FIRST_NAME,
        last_name: LAST_NAME,
        email: TEST_EMAIL,
        phone: PHONE,
        unit_id: unitId,
        apartment_id: apartmentId,
        apartmentowner_id: ownerId,
        status: 'active',
      })
      .select()
      .single()

    if (tenantError) {
      console.error('Tenant insert failed:', tenantError.message)
      process.exit(1)
    }
    console.log('Tenant record created:', tenant.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  Sample Tenant Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Name:     ${FIRST_NAME} ${LAST_NAME}`)
  console.log(`  Email:    ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
  console.log('════════════════════════════════════════')
  console.log('\nLogin at /login -> redirect to /tenant\n')

  await supabase.auth.signOut()
}

main()
