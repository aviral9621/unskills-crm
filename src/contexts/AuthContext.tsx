import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  })

  async function fetchProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('uce_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        console.warn('Failed to fetch profile:', error.message)
        return null
      }
      return data as Profile
    } catch (err) {
      console.warn('Profile fetch exception:', err)
      return null
    }
  }

  async function refreshProfile() {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }

  useEffect(() => {
    let mounted = true

    // Safety timeout — if auth check takes >8s, stop loading and clear session
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth initialization timed out — clearing stale session')
        setState({ session: null, user: null, profile: null, loading: false })
      }
    }, 8000)

    async function initAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        // If session fetch failed or no session, clear loading immediately
        if (error || !session) {
          if (error) {
            console.warn('getSession error:', error.message)
            // Clear any stale tokens from storage
            await supabase.auth.signOut().catch(() => {})
          }
          setState({ session: null, user: null, profile: null, loading: false })
          clearTimeout(timeout)
          return
        }

        // Valid session — fetch profile
        const profile = await fetchProfile(session.user.id)
        if (mounted) {
          setState({ session, user: session.user, profile, loading: false })
        }
      } catch (err) {
        console.warn('Auth init exception:', err)
        if (mounted) {
          // On any error, clear session and stop loading
          await supabase.auth.signOut().catch(() => {})
          setState({ session: null, user: null, profile: null, loading: false })
        }
      } finally {
        clearTimeout(timeout)
      }
    }

    initAuth()

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT' || !session) {
          setState({ session: null, user: null, profile: null, loading: false })
          return
        }

        // For TOKEN_REFRESHED, SIGNED_IN — fetch profile
        let profile: Profile | null = null
        if (session.user) {
          profile = await fetchProfile(session.user.id)
        }
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
    try {
      await supabase.auth.signOut()
    } catch {
      // Force clear even if signOut API fails
    }
    setState({ session: null, user: null, profile: null, loading: false })
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
