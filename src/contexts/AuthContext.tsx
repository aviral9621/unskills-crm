import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
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

// Profile cache — avoids refetch on every auth event
let profileCache: { id: string; data: Profile | null } | null = null

async function fetchProfileWithTimeout(userId: string): Promise<Profile | null> {
  if (profileCache?.id === userId) return profileCache.data

  try {
    const result = await Promise.race([
      supabase.from('uce_profiles').select('*').eq('id', userId).single(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ])

    if (result.error) return null
    const profile = result.data as Profile
    profileCache = { id: userId, data: profile }
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

  // Track if user explicitly signed out — prevents flash from token refresh events
  const explicitSignOut = useRef(false)
  // Track if we've ever had a valid session — prevents clearing on transient events
  const hadSession = useRef(false)

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    profileCache = null
    const profile = await fetchProfileWithTimeout(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }, [state.user])

  useEffect(() => {
    let mounted = true
    let gotInitialSession = false

    const safetyTimeout = setTimeout(() => {
      if (mounted && !gotInitialSession) {
        setState({ session: null, user: null, profile: null, loading: false })
      }
    }, 3000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'INITIAL_SESSION') {
          gotInitialSession = true
          clearTimeout(safetyTimeout)
        }

        // Only clear state on explicit sign out, NOT on transient null sessions
        if (!session) {
          if (event === 'SIGNED_OUT' || explicitSignOut.current || !hadSession.current) {
            profileCache = null
            hadSession.current = false
            setState({ session: null, user: null, profile: null, loading: false })
          }
          // Otherwise ignore transient null (token refresh in progress)
          return
        }

        // We have a valid session
        hadSession.current = true
        explicitSignOut.current = false

        // Set session immediately — keep existing profile to avoid flash
        setState(prev => ({
          session,
          user: session.user,
          profile: prev.profile,
          loading: false,
        }))

        // Fetch profile in background (cached = instant)
        const profile = await fetchProfileWithTimeout(session.user.id)
        if (mounted) {
          setState(prev => ({ ...prev, session, user: session.user, profile }))
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    explicitSignOut.current = false
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    profileCache = null
    explicitSignOut.current = true
    hadSession.current = false
    setState({ session: null, user: null, profile: null, loading: false })
    try {
      await supabase.auth.signOut()
    } catch {
      // State already cleared
    }
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
