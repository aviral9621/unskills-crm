import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// In-tab no-op lock — bypass navigator.locks-based cross-tab locking which
// causes "Lock was released because another request stole it" errors when
// the same app is open in multiple tabs (e.g. super admin's panel + the
// view-as-student tab share the same auth-token storage). Token refresh
// still works because autoRefreshToken is on and only one tab will actually
// be refreshing at a time in practice.
async function noopLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return await fn()
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: noopLock,
  },
})
