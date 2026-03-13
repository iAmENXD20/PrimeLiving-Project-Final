/**
 * Seed script: Create a test manager account.
 *
 * Run from the project root:
 *   npx tsx scripts/seed-test-manager.ts
 *
 * Credentials:
 *   Email:    manager@primeliving.test
 *   Password: Manager@2026!
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

const TEST_EMAIL = 'manager@primeliving.test'
const TEST_PASSWORD = 'Manager@2026!'
const TEST_NAME = 'Test Manager'
const TEST_PHONE = '09198765432'

async function main() {
  console.log('🚀 Seeding test manager account…\n')

  // 1. Ensure auth_user_id column exists on managers table
  // (If schema was already updated, this is harmless — just try the insert)

  // 2. Sign up auth user
  console.log(`Creating auth user: ${TEST_EMAIL}`)
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: { data: { role: 'manager' } },
  })

  let userId: string | undefined

  if (signUpErr) {
    // If already exists, try to sign in to get the user id
    if (signUpErr.message.includes('already registered') || signUpErr.message.includes('already been registered')) {
      console.log('Auth user already exists — signing in to get ID…')
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
      if (signInErr) {
        console.error('❌ Cannot sign in existing user:', signInErr.message)
        process.exit(1)
      }
      userId = signInData.user?.id
    } else {
      console.error('❌ Auth signup failed:', signUpErr.message)
      process.exit(1)
    }
  } else {
    userId = signUpData.user?.id
  }

  if (!userId) {
    console.error('❌ No user ID available')
    process.exit(1)
  }

  console.log(`✅ Auth user ID: ${userId}`)

  // 3. Check if manager record already exists
  const { data: existing } = await supabase
    .from('managers')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single()

  if (existing) {
    // Update with auth_user_id
    const { error } = await supabase
      .from('managers')
      .update({ auth_user_id: userId })
      .eq('id', existing.id)

    if (error) {
      console.warn('⚠️ Could not update auth_user_id:', error.message)
    } else {
      console.log('✅ Linked existing manager record to auth user')
    }
  } else {
    // Get first client to link the manager to
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .limit(1)

    const clientId = clients?.[0]?.id || null

    const { error: insertErr } = await supabase
      .from('managers')
      .insert({
        auth_user_id: userId,
        name: TEST_NAME,
        email: TEST_EMAIL,
        phone: TEST_PHONE,
        client_id: clientId,
        status: 'active',
      })

    if (insertErr) {
      console.error('❌ Failed to insert manager:', insertErr.message)
      // It might fail if auth_user_id column doesn't exist — try without it
      if (insertErr.message.includes('auth_user_id')) {
        console.log('Retrying without auth_user_id (column may not exist yet)…')
        const { error: retryErr } = await supabase
          .from('managers')
          .insert({
            name: TEST_NAME,
            email: TEST_EMAIL,
            phone: TEST_PHONE,
            client_id: clientId,
            status: 'active',
          })

        if (retryErr) {
          console.error('❌ Retry also failed:', retryErr.message)
          process.exit(1)
        }
        console.log('✅ Manager record created (without auth_user_id link)')
        console.log('⚠️ You need to add auth_user_id column to managers table and update it manually.')
      } else {
        process.exit(1)
      }
    } else {
      console.log('✅ Manager record created and linked to auth user')
    }

    if (clientId) {
      console.log(`   Linked to client: ${clientId}`)
    } else {
      console.log('   ⚠️ No clients found — manager is not linked to any owner')
    }
  }

  console.log('\n🎉 Done!')
  console.log(`   Email:    ${TEST_EMAIL}`)
  console.log(`   Password: ${TEST_PASSWORD}`)
  console.log('   Role:     manager')
  console.log('   Login at: /login → redirects to /manager')
}

main().catch(console.error)
