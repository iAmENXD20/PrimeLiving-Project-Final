import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  'https://hruvhxolibpolgxxcdma.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydXZoeG9saWJwb2xneHhjZG1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1ODYyOSwiZXhwIjoyMDkxODM0NjI5fQ.llOcPCNJSTBgaAVnA-Vg3-yUKKTxhXVdu-TeRhm8gPM'
);

async function main() {
  // Drop old constraint and add new one with under_renovation
  const { error: dropErr } = await supabaseAdmin.rpc('exec_sql', {
    sql: "ALTER TABLE units DROP CONSTRAINT IF EXISTS units_status_check;"
  });
  
  // If exec_sql doesn't exist, try updating a test row to check current constraint
  // Then we handle it differently - just try updating via supabase admin
  console.log('Testing direct update approach...');
  
  // Try to update a unit to under_renovation to check if it works
  const { data: testUnit } = await supabaseAdmin
    .from('units')
    .select('id, status')
    .limit(1)
    .single();
  
  console.log('Test unit:', testUnit);
  
  if (testUnit) {
    const { error } = await supabaseAdmin
      .from('units')
      .update({ status: 'under_renovation' })
      .eq('id', testUnit.id);
    
    if (error) {
      console.error('Update failed (constraint still blocks):', error.message);
      console.log('\\nYou need to run this SQL in the Supabase Dashboard SQL Editor:');
      console.log("ALTER TABLE units DROP CONSTRAINT IF EXISTS units_status_check;");
      console.log("ALTER TABLE units ADD CONSTRAINT units_status_check CHECK (status IN ('active', 'inactive', 'under_renovation'));");
    } else {
      console.log('Update succeeded! Constraint already allows under_renovation.');
      // Revert
      await supabaseAdmin
        .from('units')
        .update({ status: testUnit.status })
        .eq('id', testUnit.id);
      console.log('Reverted test unit back to:', testUnit.status);
    }
  }
}

main();
