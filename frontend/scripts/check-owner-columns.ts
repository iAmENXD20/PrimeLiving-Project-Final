import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '..', '.env') })
dotenv.config({ path: resolve(__dirname, '..', '..', 'backend', '.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runSQL(sql: string, label: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  })
  // Supabase doesn't have a direct SQL execution via REST API
  // Use the management API instead
  console.log(`${label}: Need to run in Supabase SQL Editor`)
}

async function run() {
  console.log('\n📋 Please run the following SQL in the Supabase SQL Editor:\n')
  console.log("ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('Male', 'Female'));")
  console.log('ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS birthdate DATE;')
  console.log('\n-- Also run pending migrations:')
  console.log('ALTER TABLE unit_occupants ADD COLUMN IF NOT EXISTS birthdate DATE;')
  console.log('ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS review_rating INTEGER CHECK (review_rating >= 1 AND review_rating <= 5);')
  console.log('ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS review_comment TEXT;')
  console.log('ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;')
}

run()
