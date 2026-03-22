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

async function clearOwnerUnits() {
  console.log('🔧 Finding test manager\'s client...\n')

  // Find the test manager's apartmentowner_id
  const { data: manager, error: mgrError } = await supabase
    .from('apartment_managers')
    .select('id, apartmentowner_id')
    .eq('email', 'manager@primeliving.test')
    .single()

  if (mgrError || !manager || !manager.apartmentowner_id) {
    console.error('❌ Test manager or client not found:', mgrError?.message)
    process.exit(1)
  }

  const clientId = manager.apartmentowner_id
  console.log(`✅ Found client: ${clientId}\n`)

  // First, unlink any tenants from these apartments
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id')
    .eq('apartmentowner_id', clientId)

  if (apartments && apartments.length > 0) {
    const aptIds = apartments.map(a => a.id)
    console.log(`Found ${aptIds.length} apartment(s) to delete`)

    // Clear tenant apartment_id references for these apartments
    const { error: tenantErr } = await supabase
      .from('tenants')
      .update({ apartment_id: null })
      .in('apartment_id', aptIds)
    
    if (tenantErr) {
      console.error('⚠️ Failed to unlink tenants:', tenantErr.message)
    } else {
      console.log('✅ Unlinked tenants from apartments')
    }

    // Delete the apartments
    const { error: delErr } = await supabase
      .from('apartments')
      .delete()
      .eq('apartmentowner_id', clientId)

    if (delErr) {
      console.error('❌ Failed to delete apartments:', delErr.message)
    } else {
      console.log(`✅ Deleted ${aptIds.length} apartment(s)`)
    }
  } else {
    console.log('No apartments found for this client.')
  }

  console.log('\nDone! Units module data cleared.')
}

clearOwnerUnits()
