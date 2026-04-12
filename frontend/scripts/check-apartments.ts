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

const OWNER_ID = 'db8bf49b-fc06-49f9-bbf0-cd6d2676579c'

async function main() {
  // Check apartments
  const { data: apartments, error: aptErr } = await supabaseAdmin
    .from('apartments')
    .select('*')
    .eq('apartmentowner_id', OWNER_ID)
  
  console.log('Apartments for owner:', JSON.stringify(apartments, null, 2))
  if (aptErr) console.log('Error:', aptErr.message)

  // Check all apartments
  const { data: allApts } = await supabaseAdmin
    .from('apartments')
    .select('id, name, address, apartmentowner_id, status')
  
  console.log('\nAll apartments:', JSON.stringify(allApts, null, 2))
}

main()
