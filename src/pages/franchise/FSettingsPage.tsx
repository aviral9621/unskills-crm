import { useState } from 'react'
import { Settings, ShieldCheck, LogOut, Clock, Mail, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function FSettingsPage() {
  const { profile, user, session, signOut } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOutAll() {
    setSigningOut(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      await signOut()
      toast.success('Signed out on all devices')
    } catch {
      toast.error('Failed to sign out on all devices')
    } finally {
      setSigningOut(false)
      setConfirmOpen(false)
    }
  }

  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null
  const accountCreated = session?.user.created_at ? new Date(session.user.created_at) : null
  const roleLabel = profile?.role === 'branch_admin' ? 'Branch Admin' : profile?.role === 'branch_staff' ? 'Branch Staff' : profile?.role ?? '—'

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Account preferences and security controls</p>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCircle size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Account Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              <Mail size={11} /><span>Email</span>
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email || profile?.email || '—'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Role</p>
            <p className="text-sm font-medium text-gray-900">{roleLabel}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              <Clock size={11} /><span>Last Sign-in</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {lastSignIn
                ? lastSignIn.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              <Clock size={11} /><span>Account Created</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {accountCreated
                ? accountCreated.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Security & Session */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Security &amp; Session</h2>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-amber-900">
            <LogOut size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Sign out on all devices</p>
              <p className="text-amber-800/90 mt-0.5">
                This will invalidate every active session — including this one — across every browser and device.
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 shadow-sm shrink-0"
          >
            <LogOut size={13} /> Sign out everywhere
          </button>
        </div>
      </div>

      <div className="pb-6" />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSignOutAll}
        title="Sign out of all devices?"
        message="You'll be signed out here and on every other device where you're logged in. You'll need to sign in again everywhere."
        confirmText="Sign out everywhere"
        variant="warning"
        loading={signingOut}
      />
    </div>
  )
}
