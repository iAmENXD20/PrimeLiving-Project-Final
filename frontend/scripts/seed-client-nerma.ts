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
  console.log('🔧 Adding client "Nerma"...\n')

  // Insert client record (no auth account, just a DB record)
  const { data: existing } = await supabase
    .from('apartment_owners')
    .select('id')
    .eq('name', 'Nerma')
    .single()

  if (existing) {
    console.log('⚠️  Client "Nerma" already exists:', existing.id)
  } else {
    const { data: client, error } = await supabase
      .from('apartment_owners')
      .insert({
        name: 'Nerma',
        email: 'nerma@primeliving.test',
        phone: '09987654321',
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Failed to create client:', error.message)
      process.exit(1)
    }
    console.log('✅ Client "Nerma" created:', client.id)
  }

  console.log('\nDone!')
}

main()
