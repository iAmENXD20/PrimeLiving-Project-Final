/**
 * Update apartment name for testing.
 *
 * Run from the project root:
 *   npx tsx scripts/update-apartment-name.ts
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
  console.log('🔧 Updating apartment name for test owner...\n')

  // Find the test owner
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('email', 'owner@primeliving.test')
    .single()

  if (clientError || !client) {
    console.error('❌ Test owner not found. Try another email or update the script.')
    process.exit(1)
  }

  console.log(`Found owner: ${client.name} (${client.id})`)

  // Update apartments belonging to this owner
  const { data: apartments, error: aptError } = await supabase
    .from('apartments')
    .select('id, name')
    .eq('client_id', client.id)

  if (aptError || !apartments?.length) {
    console.error('❌ No apartments found for this owner.')
    process.exit(1)
  }

  console.log(`Found ${apartments.length} apartment(s):`)
  apartments.forEach(a => console.log(`  - ${a.name} (${a.id})`))

  // Update the first apartment name to a proper building name
  const newName = 'PrimeLiving Residences Sta. Maria'
  const { error: updateError } = await supabase
    .from('apartments')
    .update({ name: newName })
    .eq('id', apartments[0].id)

  if (updateError) {
    console.error('❌ Update failed:', updateError.message)
    process.exit(1)
  }

  console.log(`\n✅ Apartment renamed: "${apartments[0].name}" → "${newName}"`)
  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Apartment name updated!')
  console.log('════════════════════════════════════════')
}

main()
