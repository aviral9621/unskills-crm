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

// Profile cache — avoids refetch on every auth event
let profileCache: { id: string; data: Profile | null } | null = null

async function fetchProfileWithTimeout(userId: string): Promise<Profile | null> {
  if (profileCache?.id === userId) return profileCache.data

  try {
    // Race between profile fetch and a 4s timeout
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

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    profileCache = null
    const profile = await fetchProfileWithTimeout(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }, [state.user])

  useEffect(() => {
    let mounted = true
    let gotInitialSession = false

    // Safety net: if INITIAL_SESSION never fires within 3s, force loading off
    const safetyTimeout = setTimeout(() => {
      if (mounted && !gotInitialSession) {
        console.warn('Auth: INITIAL_SESSION never fired, forcing loading off')
        setState({ session: null, user: null, profile: null, loading: false })
      }
    }, 3000)

    // SINGLE source of truth: onAuthStateChange handles ALL auth events
    // - INITIAL_SESSION: fires immediately with stored session (no network call)
    // - SIGNED_IN: fires after successful login
    // - TOKEN_REFRESHED: fires after background token refresh
    // - SIGNED_OUT: fires after logout or token refresh failure
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // Mark that we received the initial session event
        if (event === 'INITIAL_SESSION') {
          gotInitialSession = true
          clearTimeout(safetyTimeout)
        }

        // No session = clear everything, show login
        if (!session) {
          profileCache = null
          setState({ session: null, user: null, profile: null, loading: false })
          return
        }

        // We have a session — set it immediately to stop the loading spinner
        // Then fetch profile in the background
        setState(prev => ({
          session,
          user: session.user,
          profile: prev.profile, // keep existing profile while fetching new one
          loading: false,
        }))

        // Fetch profile (uses cache, so instant on subsequent calls)
        const profile = await fetchProfileWithTimeout(session.user.id)
        if (mounted) {
          setState(prev => ({
            ...prev,
            session,
            user: session.user,
            profile,
          }))
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    profileCache = null
    // Clear state immediately — don't wait for API
    setState({ session: null, user: null, profile: null, loading: false })
    try {
      await supabase.auth.signOut()
    } catch {
      // State already cleared above
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
