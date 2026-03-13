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

const ADMIN_EMAIL = 'admin@primeliving.com'
const ADMIN_PASSWORD = 'admin123'

async function main() {
  console.log('🔧 Creating admin account...\n')

  // 1. Try to sign up the admin user with role=admin in metadata
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: {
      data: { name: 'System Admin', role: 'admin' },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('⚠️  Admin auth user already exists. Trying to sign in...\n')
      // Try signing in to verify credentials work
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      if (signInError) {
        console.error('❌ Admin sign-in failed:', signInError.message)
        console.log('\nThe admin account exists but the password may be different.')
        process.exit(1)
      }
      console.log('✅ Admin account verified — sign-in works!')
    } else {
      console.error('❌ Auth signup failed:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Admin auth user created:', authData.user?.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Admin Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
  console.log('════════════════════════════════════════\n')

  await supabase.auth.signOut()
}

main()
