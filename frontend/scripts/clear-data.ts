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

async function clearAllData() {
  console.log('Clearing all data from database...\n')

  // Delete in order respecting foreign key constraints
  const tables = [
    'maintenance_requests',
    'revenues',
    'tenants',
    'apartments',
    'managers',
    'inquiries',
    'clients',
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`❌ Failed to clear ${table}:`, error.message)
    } else {
      console.log(`✅ Cleared ${table}`)
    }
  }

  console.log('\nDone! All data has been cleared.')
}

clearAllData()
