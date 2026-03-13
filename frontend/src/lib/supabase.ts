import { createClient } from '@supabase/supabase-js'

// ⚠️ Replace these with your actual Supabase project credentials
// Found at: Supabase Dashboard → Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'primeliving-auth',
    storage: window.localStorage,
  },
})
