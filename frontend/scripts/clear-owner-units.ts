import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hnwcrsxdkfqydfesybkk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhud2Nyc3hka2ZxeWRmZXN5YmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzExOTIsImV4cCI6MjA4NzcwNzE5Mn0.WUwcOHP3FR2D0P-qTrRBoC02GuwYsEzvzU0aytfrltE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function clearOwnerUnits() {
  console.log('🔧 Finding test manager\'s client...\n')

  // Find the test manager's client_id
  const { data: manager, error: mgrError } = await supabase
    .from('managers')
    .select('id, client_id')
    .eq('email', 'manager@primeliving.test')
    .single()

  if (mgrError || !manager || !manager.client_id) {
    console.error('❌ Test manager or client not found:', mgrError?.message)
    process.exit(1)
  }

  const clientId = manager.client_id
  console.log(`✅ Found client: ${clientId}\n`)

  // First, unlink any tenants from these apartments
  const { data: apartments } = await supabase
    .from('apartments')
    .select('id')
    .eq('client_id', clientId)

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
      .eq('client_id', clientId)

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
