const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://wigziplvujrexltfqqvu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpZ3ppcGx2dWpyZXhsdGZxcXZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYxMjkyNSwiZXhwIjoyMDg5MTg4OTI1fQ.A90nYwGfJ8zRKzSDrc7pRoh_vQSmLsSCia0O8lvcnUs',
  { db: { schema: 'public' } }
);

// We can't run raw SQL via the REST API. Let's check what columns exist
// and use Supabase client operations to make the changes we can.

async function checkAndReport() {
  console.log('=== Checking current database state ===\n');

  // Check units table columns
  const { data: unitsSample, error: unitsErr } = await supabase.from('units').select('*').limit(1);
  if (unitsErr) {
    console.log('units table error:', unitsErr.message);
  } else if (unitsSample && unitsSample.length > 0) {
    const cols = Object.keys(unitsSample[0]);
    console.log('units columns:', cols.join(', '));
    console.log('  - Has contract_duration:', cols.includes('contract_duration'));
    console.log('  - Has lease_start:', cols.includes('lease_start'));
    console.log('  - Has lease_end:', cols.includes('lease_end'));
    console.log('  - Has montly_rent (typo):', cols.includes('montly_rent'));
    console.log('  - Has monthly_rent:', cols.includes('monthly_rent'));
  } else {
    // No rows, try insert/select to see structure
    const { data, error } = await supabase.from('units').select('id').limit(0);
    console.log('units: empty table, error:', error?.message || 'none');
  }

  // Check tenants table columns
  const { data: tenantsSample, error: tenantsErr } = await supabase.from('tenants').select('*').limit(1);
  if (tenantsErr) {
    console.log('\ntenants table error:', tenantsErr.message);
  } else if (tenantsSample && tenantsSample.length > 0) {
    const cols = Object.keys(tenantsSample[0]);
    console.log('\ntenants columns:', cols.join(', '));
    console.log('  - Has contract_status:', cols.includes('contract_status'));
    console.log('  - Has renewal_date:', cols.includes('renewal_date'));
    console.log('  - Has renewal_count:', cols.includes('renewal_count'));
    console.log('  - Has aparment_id (typo):', cols.includes('aparment_id'));
    console.log('  - Has apartment_id:', cols.includes('apartment_id'));
  }

  // Check unit_occupants table
  const { data: occSample, error: occErr } = await supabase.from('unit_occupants').select('*').limit(1);
  if (occErr) {
    // Maybe the table is still named units_occupants
    const { data: occSample2, error: occErr2 } = await supabase.from('units_occupants').select('*').limit(1);
    if (occErr2) {
      console.log('\nunit_occupants: error -', occErr.message);
      console.log('units_occupants: error -', occErr2.message);
    } else {
      console.log('\nTable is still named "units_occupants" (needs rename)');
      if (occSample2 && occSample2.length > 0) {
        console.log('  columns:', Object.keys(occSample2[0]).join(', '));
      }
    }
  } else {
    if (occSample && occSample.length > 0) {
      const cols = Object.keys(occSample[0]);
      console.log('\nunit_occupants columns:', cols.join(', '));
      console.log('  - Has first_name:', cols.includes('first_name'));
      console.log('  - Has last_name:', cols.includes('last_name'));
      console.log('  - Has sex:', cols.includes('sex'));
      console.log('  - Has phone:', cols.includes('phone'));
    } else {
      console.log('\nunit_occupants: table exists but is empty');
    }
  }

  // Check notifications column
  const { data: notifSample, error: notifErr } = await supabase.from('notifications').select('*').limit(1);
  if (notifErr) {
    console.log('\nnotifications table error:', notifErr.message);
  } else if (notifSample && notifSample.length > 0) {
    const cols = Object.keys(notifSample[0]);
    console.log('\nnotifications columns:', cols.join(', '));
    console.log('  - Has ricipient_id (typo):', cols.includes('ricipient_id'));
    console.log('  - Has recipient_id:', cols.includes('recipient_id'));
  }

  // Check payments column
  const { data: paymentSample, error: paymentErr } = await supabase.from('payments').select('*').limit(1);
  if (paymentErr) {
    console.log('\npayments table error:', paymentErr.message);
  } else if (paymentSample && paymentSample.length > 0) {
    const cols = Object.keys(paymentSample[0]);
    console.log('\npayments columns:', cols.join(', '));
    console.log('  - Has recipient_url (typo):', cols.includes('recipient_url'));
    console.log('  - Has receipt_url:', cols.includes('receipt_url'));
  }

  // Check apartments column
  const { data: aptSample, error: aptErr } = await supabase.from('apartments').select('*').limit(1);
  if (aptErr) {
    console.log('\napartments table error:', aptErr.message);
  } else if (aptSample && aptSample.length > 0) {
    const cols = Object.keys(aptSample[0]);
    console.log('\napartments columns:', cols.join(', '));
    console.log('  - Has address_are (typo):', cols.includes('address_are'));
    console.log('  - Has address_area:', cols.includes('address_area'));
  }

  // Check documents column
  const { data: docSample, error: docErr } = await supabase.from('documents').select('*').limit(1);
  if (docErr) {
    console.log('\ndocuments table error:', docErr.message);
  } else if (docSample && docSample.length > 0) {
    const cols = Object.keys(docSample[0]);
    console.log('\ndocuments columns:', cols.join(', '));
    console.log('  - Has updated_by (typo):', cols.includes('updated_by'));
    console.log('  - Has uploaded_by:', cols.includes('uploaded_by'));
  }
}

checkAndReport().catch(e => console.error('Fatal error:', e));
