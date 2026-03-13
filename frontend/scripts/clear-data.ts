import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hnwcrsxdkfqydfesybkk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhud2Nyc3hka2ZxeWRmZXN5YmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzExOTIsImV4cCI6MjA4NzcwNzE5Mn0.WUwcOHP3FR2D0P-qTrRBoC02GuwYsEzvzU0aytfrltE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function clearAllData() {
  console.log('Clearing all data from database...\n')

  // Delete in order respecting foreign key constraints
  const tables = [
    'maintenance_requests',
    'revenues',
    'tenants',
    'apartments',
    'managers',
    'inquiries',
    'clients',
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`❌ Failed to clear ${table}:`, error.message)
    } else {
      console.log(`✅ Cleared ${table}`)
    }
  }

  console.log('\nDone! All data has been cleared.')
}

clearAllData()
