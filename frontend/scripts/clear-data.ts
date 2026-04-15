import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '..', '.env') })

// Also load backend .env for service role key
dotenv.config({ path: resolve(__dirname, '..', '..', 'backend', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function clearAllData() {
  console.log('🗑️  Clearing ALL data from database...\n')

  // Delete in order respecting foreign key constraints (children first)
  const tables = [
    'apartment_logs',
    'sms_logs',
    'notifications',
    'documents',
    'announcements',
    'payments',
    'revenues',
    'maintenance',
    'unit_occupants',
    'tenants',
    'units',
    'apartments',
    'apartment_managers',
    'apartment_owners',
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`❌ Failed to clear ${table}:`, error.message)
    } else {
      console.log(`✅ Cleared ${table}`)
    }
  }

  // Delete all Supabase Auth users
  console.log('\n🔐 Clearing Supabase Auth users...')
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Failed to list auth users:', listError.message)
  } else if (authUsers?.users?.length) {
    for (const user of authUsers.users) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
      if (delError) {
        console.error(`❌ Failed to delete auth user ${user.email}:`, delError.message)
      } else {
        console.log(`✅ Deleted auth user: ${user.email}`)
      }
    }
  } else {
    console.log('ℹ️  No auth users to delete')
  }

  console.log('\n✨ Done! All data has been cleared. Visit the app to set up a new owner account.')
}

clearAllData()
