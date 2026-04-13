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
  // Track if initial session has been resolved
  const initialResolved = useRef(false)

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    profileCache = null
    const profile = await fetchProfileWithTimeout(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }, [state.user])

  useEffect(() => {
    let mounted = true

    // 1. Resolve stored session immediately (reads localStorage, no network)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted || initialResolved.current) return
      initialResolved.current = true

      if (session) {
        hadSession.current = true
        // Show the page instantly with session — profile loads in background
        setState(prev => ({
          session,
          user: session.user,
          profile: prev.profile,
          loading: false,
        }))
        const profile = await fetchProfileWithTimeout(session.user.id)
        if (mounted) {
          setState(prev => ({ ...prev, profile }))
        }
      } else {
        setState({ session: null, user: null, profile: null, loading: false })
      }
    })

    // 2. Listen for ongoing auth changes (token refresh, sign-in, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // Skip INITIAL_SESSION — already handled by getSession() above
        if (event === 'INITIAL_SESSION') return

        if (!session) {
          // Only clear state on EXPLICIT sign-out by the user.
          // Ignore transient null sessions from token refresh failures —
          // Supabase SDK will auto-retry, and we don't want a login flash.
          if (explicitSignOut.current) {
            profileCache = null
            hadSession.current = false
            setState({ session: null, user: null, profile: null, loading: false })
          }
          return
        }

        // Valid session update (TOKEN_REFRESHED, SIGNED_IN, etc.)
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
