/**
 * Remove old owner accounts from auth + apartment_owners table.
 * 
 * Run from frontend/:
 *   npx tsx scripts/cleanup-owners.ts
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

const EMAILS_TO_REMOVE = [
  'aptowner@ams.com',
  'owner@primeliving.test',
  'geeb@gmail.com',
]

async function deleteAccount(email: string) {
  // Find auth user
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const user = users.find(u => u.email === email)

  if (user) {
    // Delete apartment_owners record by auth_user_id
    await supabaseAdmin.from('apartment_owners').delete().eq('auth_user_id', user.id)
    // Also delete by email in case auth_user_id was never linked
    await supabaseAdmin.from('apartment_owners').delete().eq('email', email)
    // Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (error) {
      console.log(`⚠️  Could not delete auth user ${email}: ${error.message}`)
    } else {
      console.log(`✅ Deleted: ${email} (auth + DB)`)
    }
  } else {
    // Clean up orphaned DB records
    const { count } = await supabaseAdmin
      .from('apartment_owners')
      .delete()
      .eq('email', email)
      .select('*', { count: 'exact', head: true })
    
    if (count && count > 0) {
      console.log(`✅ Cleaned orphaned DB record for ${email}`)
    } else {
      console.log(`ℹ️  No records found for ${email}`)
    }
  }
}

async function main() {
  console.log('🧹 Removing old owner accounts...\n')

  for (const email of EMAILS_TO_REMOVE) {
    await deleteAccount(email)
  }

  console.log('\n✅ Cleanup complete!')
}

main()
