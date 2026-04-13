/**
 * Update owner name in Supabase.
 * Run from frontend/: npx tsx scripts/update-owner-name.ts
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
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found.')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const USER_ID = '4a3d2139-0fd0-4fd7-b9c0-fff251100fb6'
const NEW_FIRST = 'Jingle'
const NEW_LAST = 'George'

async function main() {
  console.log(`🔄 Updating name to: ${NEW_FIRST} ${NEW_LAST}\n`)

  // 1. Update auth user metadata
  const { data: updated, error: authErr } = await supabaseAdmin.auth.admin.updateUserById(USER_ID, {
    user_metadata: { name: `${NEW_FIRST} ${NEW_LAST}`, role: 'owner' }
  })
  if (authErr) {
    console.error('❌ Auth error:', authErr.message)
    return
  }
  console.log('✅ Auth metadata updated:', updated.user?.user_metadata)

  // 2. Update apartment_owners table
  const { data, error } = await supabaseAdmin
    .from('apartment_owners')
    .update({ first_name: NEW_FIRST, last_name: NEW_LAST })
    .eq('auth_user_id', USER_ID)
    .select('id, first_name, last_name, email')

  if (error) {
    console.error('❌ DB error:', error.message)
    return
  }
  console.log('✅ apartment_owners updated:', data)
  console.log(`\n✅ Done! Name is now: ${NEW_FIRST} ${NEW_LAST}`)
}

main()
