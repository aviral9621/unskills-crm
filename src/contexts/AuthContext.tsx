import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Profile cache to avoid refetching on every auth event
let profileCache: { id: string; profile: Profile | null } | null = null

async function fetchProfile(userId: string): Promise<Profile | null> {
  // Return cached if same user
  if (profileCache?.id === userId) return profileCache.profile

  try {
    const { data, error } = await supabase
      .from('uce_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.warn('Profile fetch failed:', error.message)
      return null
    }
    const profile = data as Profile
    profileCache = { id: userId, profile }
    return profile
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  })

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    profileCache = null // bust cache
    const profile = await fetchProfile(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }, [state.user])

  useEffect(() => {
    let mounted = true

    // 1. Check localStorage synchronously first — if no token stored, skip network call
    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    const hasStoredSession = !!storageKey && !!localStorage.getItem(storageKey)

    if (!hasStoredSession) {
      // No stored session — show login immediately, no network call needed
      setState({ session: null, user: null, profile: null, loading: false })
      // Still set up the listener for future sign-ins
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return
          if (!session || event === 'SIGNED_OUT') {
            profileCache = null
            setState({ session: null, user: null, profile: null, loading: false })
            return
          }
          const profile = await fetchProfile(session.user.id)
          if (mounted) {
            setState({ session, user: session.user, profile, loading: false })
          }
        }
      )
      return () => { mounted = false; subscription.unsubscribe() }
    }

    // 2. Has stored session — validate it with Supabase (with timeout)
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth timed out — clearing stale session')
        localStorage.removeItem(storageKey!)
        profileCache = null
        setState({ session: null, user: null, profile: null, loading: false })
      }
    }, 5000)

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      clearTimeout(timeout)
      if (!mounted) return

      if (error || !session) {
        if (storageKey) localStorage.removeItem(storageKey)
        profileCache = null
        setState({ session: null, user: null, profile: null, loading: false })
        return
      }

      const profile = await fetchProfile(session.user.id)
      if (mounted) {
        setState({ session, user: session.user, profile, loading: false })
      }
    }).catch(() => {
      clearTimeout(timeout)
      if (mounted) {
        if (storageKey) localStorage.removeItem(storageKey)
        profileCache = null
        setState({ session: null, user: null, profile: null, loading: false })
      }
    })

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (!session || event === 'SIGNED_OUT') {
          profileCache = null
          setState({ session: null, user: null, profile: null, loading: false })
          return
        }
        const profile = await fetchProfile(session.user.id)
        if (mounted) {
          setState({ session, user: session.user, profile, loading: false })
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    profileCache = null
    setState({ session: null, user: null, profile: null, loading: false })
    try { await supabase.auth.signOut() } catch { /* force-cleared above */ }
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
