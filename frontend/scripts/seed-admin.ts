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

const OWNER_EMAIL = 'aptowner@ams.com'
const OWNER_PASSWORD = 'Owner@2026!'
const OWNER_NAME = 'Apartment Owner'

async function main() {
  console.log('🔧 Creating apartment owner account...\n')

  // 1. Sign up the owner user with role=owner in metadata
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    options: {
      data: { name: OWNER_NAME, role: 'owner' },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('⚠️  Auth user already exists. Attempting to link owner record...\n')
    } else {
      console.error('❌ Auth signup failed:', authError.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Auth user created:', authData.user?.id)
  }

  // 2. Get the user id (sign in if signup returned user with existing account)
  let userId = authData?.user?.id
  if (!userId) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    })
    if (signInError) {
      console.error('❌ Sign-in failed:', signInError.message)
      process.exit(1)
    }
    userId = signInData.user?.id
  }

  // 3. Create apartment_owners record linked to auth user
  const { data: existingOwner } = await supabase
    .from('apartment_owners')
    .select('id')
    .eq('email', OWNER_EMAIL)
    .single()

  if (existingOwner) {
    console.log('⚠️  Owner record already exists:', existingOwner.id)
  } else {
    const { data: owner, error: ownerError } = await supabase
      .from('apartment_owners')
      .insert({
        auth_user_id: userId,
        first_name: OWNER_NAME,
        last_name: '',
        email: OWNER_EMAIL,
        status: 'active',
      })
      .select()
      .single()

    if (ownerError) {
      console.error('❌ Owner insert failed:', ownerError.message)
      process.exit(1)
    }
    console.log('✅ Owner record created:', owner.id)
  }

  console.log('\n════════════════════════════════════════')
  console.log('  🎉 Apartment Owner Account Ready!')
  console.log('════════════════════════════════════════')
  console.log(`  Email:    ${OWNER_EMAIL}`)
  console.log(`  Password: ${OWNER_PASSWORD}`)
  console.log('════════════════════════════════════════')
  console.log('\nLogin at /login and you will be redirected to /owner\n')

  await supabase.auth.signOut()
}

main()
