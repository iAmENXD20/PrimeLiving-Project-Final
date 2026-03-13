import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get the current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // If session exists but "remember me" was not checked and browser was reopened, sign out
      if (session && !localStorage.getItem('primeliving-remember') && !sessionStorage.getItem('primeliving-session-active')) {
        await supabase.auth.signOut()
        setSession(null)
        setLoading(false)
        return
      }
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes — only act on explicit sign-out or new sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
