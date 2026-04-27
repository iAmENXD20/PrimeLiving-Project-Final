import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here'

function getInviteTabStorageKey() {
  if (typeof window === 'undefined') return 'app-auth-invite'

  const tabIdKey = 'invite-auth-tab-id'
  let tabId = window.sessionStorage.getItem(tabIdKey)

  if (!tabId) {
    tabId = crypto.randomUUID()
    window.sessionStorage.setItem(tabIdKey, tabId)
  }

  return `app-auth-invite-${tabId}`
}

// Invite/account-activation auth state is intentionally isolated per-tab so
// activating a manager/tenant account never replaces the owner's web session.
export const inviteSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: getInviteTabStorageKey(),
    storage: window.sessionStorage,
  },
})