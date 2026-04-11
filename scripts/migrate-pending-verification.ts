// Quick migration script to add 'pending_verification' to tenants status CHECK constraint
// Run: npx tsx scripts/migrate-pending-verification.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function migrate() {
  // Test: try updating a tenant to pending_verification to see if constraint allows it
  // First, check if constraint already allows it
  const { data: testTenant } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (testTenant) {
    // Try setting to pending_verification
    const { error } = await supabase
      .from('tenants')
      .update({ status: 'pending_verification' })
      .eq('id', testTenant.id)

    if (error && error.message.includes('check')) {
      console.error('❌ The CHECK constraint does not allow pending_verification yet.')
      console.error('Please run this SQL in the Supabase Dashboard SQL Editor:')
      console.error('')
      console.error("ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;")
      console.error("ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive', 'pending', 'pending_verification'));")
      process.exit(1)
    } else if (error) {
      console.error('Error:', error.message)
      process.exit(1)
    } else {
      // Revert - set it back to pending
      await supabase
        .from('tenants')
        .update({ status: 'pending' })
        .eq('id', testTenant.id)
      console.log('✅ Constraint already allows pending_verification (tested and reverted)')
    }
  } else {
    console.log('No pending tenants to test with. Please run the SQL manually:')
    console.log('')
    console.log("ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;")
    console.log("ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive', 'pending', 'pending_verification'));")
  }
}

migrate().catch(console.error)
