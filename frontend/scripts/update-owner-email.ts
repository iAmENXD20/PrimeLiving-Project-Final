/**
 * Update owner authentication email in Supabase.
 * Run from frontend/: npx tsx scripts/update-owner-email.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '..', '.env') })
dotenv.config({ path: resolve(__dirname, '..', '..', 'backend', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found. Make sure backend/.env exists.')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const OLD_EMAIL = 'nerma20hernandez@gmail.com'
const NEW_EMAIL = 'jinglegeorge44@gmail.com'

async function main() {
  console.log(`🔄 Updating email: ${OLD_EMAIL} → ${NEW_EMAIL}\n`)

  // 1. Find auth user by old email
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const authUser = users.find(u => u.email === OLD_EMAIL)

  if (!authUser) {
    console.log('❌ No auth user found with email:', OLD_EMAIL)
    console.log('\nAll auth users:')
    users.forEach(u => console.log(`  - ${u.email} (${u.id})`))
    return
  }

  console.log(`✅ Found auth user: ${authUser.id} (${authUser.email})`)

  // 2. Update auth user email
  const { data: updatedUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    authUser.id,
    { email: NEW_EMAIL, email_confirm: true }
  )

  if (authError) {
    console.error('❌ Failed to update auth email:', authError.message)
    return
  }

  console.log(`✅ Auth email updated to: ${updatedUser.user?.email}`)

  // 3. Update apartment_owners table
  const { data: ownerRecord, error: ownerError } = await supabaseAdmin
    .from('apartment_owners')
    .update({ email: NEW_EMAIL })
    .eq('auth_user_id', authUser.id)
    .select()

  if (ownerError) {
    console.error('❌ Failed to update apartment_owners email:', ownerError.message)
  } else if (ownerRecord && ownerRecord.length > 0) {
    console.log(`✅ apartment_owners email updated for ${ownerRecord.length} record(s)`)
  } else {
    console.log('⚠️  No apartment_owners record found with this auth_user_id, trying by email...')
    
    const { data: ownerByEmail, error: byEmailErr } = await supabaseAdmin
      .from('apartment_owners')
      .update({ email: NEW_EMAIL })
      .eq('email', OLD_EMAIL)
      .select()

    if (byEmailErr) {
      console.error('❌ Failed to update by email:', byEmailErr.message)
    } else if (ownerByEmail && ownerByEmail.length > 0) {
      console.log(`✅ apartment_owners email updated for ${ownerByEmail.length} record(s) (matched by email)`)
    } else {
      console.log('⚠️  No apartment_owners record found with either auth_user_id or email')
    }
  }

  console.log('\n✅ Done! The owner can now log in with:', NEW_EMAIL)
}

main()
