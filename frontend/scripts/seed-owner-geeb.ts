/**
 * Create a new owner account and clean up old test accounts.
 * 
 * Run from frontend/:
 *   npx tsx scripts/seed-owner-geeb.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load frontend .env for URL + anon key
dotenv.config({ path: resolve(__dirname, '..', '.env') })
// Also load backend .env for service role key
dotenv.config({ path: resolve(__dirname, '..', '..', 'backend', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found. Make sure backend/.env exists.')
  process.exit(1)
}

// Admin client (service role) for deleting users + DB records
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Regular client for sign-up
const supabase = createClient(SUPABASE_URL, ANON_KEY)

const OLD_EMAILS = ['nerma@primeliving.test', 'owner@primeliving.test']
const NEW_EMAIL = 'geeb@gmail.com'
const NEW_PASSWORD = 'Geeb@1234'
const NEW_NAME = 'Geeb'

async function deleteOldAccount(email: string) {
  // Find auth user
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  
  if (user) {
    // Delete apartment_owners record
    await supabaseAdmin.from('apartment_owners').delete().eq('auth_user_id', user.id)
    await supabaseAdmin.from('apartment_owners').delete().eq('email', email)
    // Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (error) {
      console.log(`⚠️  Could not delete auth user ${email}: ${error.message}`)
    } else {
      console.log(`🗑️  Deleted: ${email}`)
    }
  } else {
    // Still try to clean up orphaned DB records
    await supabaseAdmin.from('apartment_owners').delete().eq('email', email)
    console.log(`ℹ️  No auth user found for ${email}, cleaned DB records`)
  }
}

async function main() {
  console.log('🔧 Cleaning old test accounts...\n')
  
  for (const email of OLD_EMAILS) {
    await deleteOldAccount(email)
  }
  
  // Also clean up if geeb@gmail.com already exists
  await deleteOldAccount(NEW_EMAIL)

  console.log('\n🔧 Creating new owner account...\n')

  // 1. Sign up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    options: {
      data: { name: NEW_NAME, role: 'owner' },
    },
  })

  if (authError) {
    console.error('❌ Sign-up failed:', authError.message)
    process.exit(1)
  }

  const userId = authData.user?.id
  console.log('✅ Auth user created:', userId)

  // 2. Create apartment_owners record
  const { data: owner, error: ownerError } = await supabaseAdmin
    .from('apartment_owners')
    .insert({
      auth_user_id: userId,
      first_name: NEW_NAME,
      last_name: '',
      email: NEW_EMAIL,
      phone: '',
      status: 'active',
    })
    .select()
    .single()

  if (ownerError) {
    console.error('❌ Failed to create owner record:', ownerError.message)
  } else {
    console.log('✅ Owner record created:', owner.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Owner Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Email:    ${NEW_EMAIL}`)
  console.log(`  Password: ${NEW_PASSWORD}`)
  console.log('════════════════════════════════════════\n')
}

main()
