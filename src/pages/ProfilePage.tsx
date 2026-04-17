import { useEffect, useState, useCallback } from 'react'
import { UserCircle, Save, Loader2, KeyRound, Upload, Shield, Mail, Phone, Calendar, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../components/FormField'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { uploadPublicFile, STORAGE_BUCKETS } from '../lib/uploads'

interface BranchRow { name: string; district: string; state: string }

function AvatarUpload({ value, name, onFile, uploading }: { value: string | null; name: string; onFile: (f: File) => void; uploading: boolean }) {
  const [error, setError] = useState('')

  const handle = useCallback((file: File) => {
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP allowed'); return
    }
    if (file.size > 500 * 1024) { setError('Max size is 500 KB'); return }
    onFile(file)
  }, [onFile])

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <div className="relative">
        {value ? (
          <img src={value} alt="avatar" className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-white shadow ring-2 ring-red-100" />
        ) : (
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-red-600 flex items-center justify-center border-2 border-white shadow ring-2 ring-red-100">
            <span className="text-2xl sm:text-3xl font-semibold text-white">{name.charAt(0).toUpperCase() || 'U'}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="animate-spin text-white" size={22} />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
          <Upload size={14} />
          <span>{value ? 'Change photo' : 'Upload photo'}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }}
          />
        </label>
        <p className="text-[11px] text-gray-400">JPG, PNG, WebP · max 500 KB</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [branch, setBranch] = useState<BranchRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setPhone(profile.phone ?? '')
    setAvatarUrl(profile.avatar_url ?? null)
  }, [profile])

  useEffect(() => {
    if (!profile?.branch_id) { setBranch(null); return }
    supabase.from('uce_branches').select('name, district, state').eq('id', profile.branch_id).single()
      .then(({ data }) => setBranch((data as BranchRow | null) ?? null))
  }, [profile?.branch_id])

  const roleLabel = profile?.role === 'super_admin' ? 'Super Admin'
    : profile?.role === 'branch_admin' ? 'Branch Admin'
    : profile?.role === 'branch_staff' ? 'Staff' : profile?.role ?? ''

  async function handleAvatarUpload(file: File) {
    if (!profile) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`
      const url = await uploadPublicFile(STORAGE_BUCKETS.avatars, path, file)
      const { error } = await supabase.from('uce_profiles').update({ avatar_url: url }).eq('id', profile.id)
      if (error) throw error
      setAvatarUrl(url)
      await refreshProfile()
      toast.success('Photo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (!profile) return
    if (!fullName.trim()) { toast.error('Full name is required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('uce_profiles').update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!user?.email) { toast.error('No email on session'); return }
    if (!currentPwd) { toast.error('Enter your current password'); return }
    if (newPwd.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match'); return }
    if (newPwd === currentPwd) { toast.error('New password must be different from current'); return }

    setChangingPwd(true)
    try {
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email, password: currentPwd,
      })
      if (reauthErr) { toast.error('Current password is incorrect'); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
      if (updateErr) { toast.error(updateErr.message); return }
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      toast.success('Password updated successfully')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change password')
    } finally {
      setChangingPwd(false)
    }
  }

  if (!profile) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <UserCircle size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">My Profile</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage your personal information, photo, and password</p>
        </div>
      </div>

      {/* Identity card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <AvatarUpload value={avatarUrl} name={fullName} onFile={handleAvatarUpload} uploading={uploadingAvatar} />
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600"><Shield size={14} className="text-gray-400" /><span className="font-medium text-gray-900">{roleLabel}</span></div>
          <div className="flex items-center gap-2 text-gray-600"><Mail size={14} className="text-gray-400" /><span className="truncate">{user?.email ?? profile.email ?? '—'}</span></div>
          {branch && (
            <div className="flex items-center gap-2 text-gray-600 col-span-full"><Building2 size={14} className="text-gray-400" /><span>{branch.name} · {branch.district}, {branch.state}</span></div>
          )}
          <div className="flex items-center gap-2 text-gray-400 text-xs col-span-full"><Calendar size={12} /><span>Joined {new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Personal Information</h2>
        <FormField label="Full Name" required>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email" hint="Contact your administrator to change the email">
            <input value={user?.email ?? profile.email ?? ''} disabled className={inputClass} />
          </FormField>
          <FormField label="Phone">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" className={`${inputClass} pl-9`} />
            </div>
          </FormField>
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Change Password</h2>
        </div>
        <FormField label="Current Password" required>
          <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} autoComplete="current-password" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="New Password" required hint="Minimum 8 characters">
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoComplete="new-password" className={inputClass} />
          </FormField>
          <FormField label="Confirm New Password" required>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password" className={inputClass} />
          </FormField>
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={handleChangePassword} disabled={changingPwd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 shadow-sm">
            {changingPwd ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {changingPwd ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="pb-6" />
    </div>
  )
}
