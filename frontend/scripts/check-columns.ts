import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function main() {
  const { data, error } = await supabase.from('apartment_managers').select('*').limit(1)
  if (error) {
    console.log('ERROR:', error.message)
  } else if (data && data.length > 0) {
    console.log('COLUMNS:', Object.keys(data[0]).join(', '))
  } else {
    console.log('No manager rows found. Trying insert check...')
    // Try to see if apartmentowner_id column exists by selecting it
    const { error: err2 } = await supabase.from('apartment_managers').select('apartmentowner_id').limit(1)
    if (err2) {
      console.log('apartmentowner_id column does NOT exist:', err2.message)
      console.log('You need to run Migration 1 (rename client_id to apartmentowner_id)')
    } else {
      console.log('apartmentowner_id column EXISTS')
    }
  }
}

main().catch(console.error)
