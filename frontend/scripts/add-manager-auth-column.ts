/**
 * Add auth_user_id column to the managers table (if it doesn't exist).
 *
 * Run:  npx tsx scripts/add-manager-auth-column.ts
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

async function main() {
  console.log('Adding auth_user_id column to managers table…')

  // Try inserting a row with auth_user_id to check if column exists
  const { error: testErr } = await supabase
    .from('managers')
    .select('auth_user_id')
    .limit(1)

  if (!testErr) {
    console.log('✅ Column auth_user_id already exists on managers table.')
    return
  }

  console.log('Column does not exist. You need to run this SQL in Supabase Dashboard → SQL Editor:\n')
  console.log('  ALTER TABLE managers ADD COLUMN auth_user_id UUID UNIQUE;')
  console.log('\nThen run the seed-test-manager.ts script.')
}

main().catch(console.error)
