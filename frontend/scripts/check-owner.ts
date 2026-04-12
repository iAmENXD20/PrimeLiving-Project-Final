/**
 * Check status of a specific owner account.
 * Run from frontend/: npx tsx scripts/check-owner.ts
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

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const TARGET_EMAIL = 'nerma20hernandez@gmail.com'

async function main() {
  console.log(`🔍 Checking account: ${TARGET_EMAIL}\n`)

  // 1. Check auth user
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const authUser = users.find(u => u.email === TARGET_EMAIL)
  
  if (authUser) {
    console.log('✅ Auth user found:')
    console.log(`   ID: ${authUser.id}`)
    console.log(`   Email: ${authUser.email}`)
    console.log(`   Role metadata: ${JSON.stringify(authUser.user_metadata)}`)
    console.log(`   Created: ${authUser.created_at}`)
  } else {
    console.log('❌ No auth user found for this email')
    // List all users for reference
    console.log('\nAll auth users:')
    users.forEach(u => console.log(`  - ${u.email} (${u.id})`))
    return
  }

  // 2. Check apartment_owners record
  const { data: ownerByAuth } = await supabaseAdmin
    .from('apartment_owners')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  const { data: ownerByEmail } = await supabaseAdmin
    .from('apartment_owners')
    .select('*')
    .eq('email', TARGET_EMAIL)
    .maybeSingle()

  console.log('\n📋 apartment_owners by auth_user_id:', ownerByAuth ? JSON.stringify(ownerByAuth, null, 2) : 'NOT FOUND')
  console.log('\n📋 apartment_owners by email:', ownerByEmail ? JSON.stringify(ownerByEmail, null, 2) : 'NOT FOUND')

  // 3. List all apartment_owners for reference
  const { data: allOwners } = await supabaseAdmin
    .from('apartment_owners')
    .select('id, auth_user_id, first_name, last_name, email, status')
  
  console.log('\n📋 All apartment_owners:')
  if (allOwners && allOwners.length > 0) {
    allOwners.forEach(o => console.log(`  - ${o.email} | auth_user_id: ${o.auth_user_id} | name: ${o.first_name} ${o.last_name} | status: ${o.status}`))
  } else {
    console.log('  (none)')
  }
}

main()
