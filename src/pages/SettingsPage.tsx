import { useEffect, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  Settings, Save, Loader2, Info, Building2, Mail, Phone, Globe, MapPin,
  Facebook, Instagram, Youtube, Linkedin, IdCard, FileBadge2, Users, Briefcase,
  BookOpen, LogOut, ShieldCheck, Clock, ChevronRight, Upload, X,
} from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getSiteSettings, saveSiteSettings, type SiteSettings } from '../lib/siteSettings'

function LogoUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [error, setError] = useState('')

  const handle = useCallback((file: File) => {
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP allowed'); return
    }
    if (file.size > 300 * 1024) { setError('Max size is 300 KB'); return }
    const r = new FileReader()
    r.onloadend = () => onChange(r.result as string)
    r.readAsDataURL(file)
  }, [onChange])

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-4">
          <img src={value} alt="logo" className="h-20 w-20 object-contain border border-gray-200 rounded-lg bg-gray-50 p-2" />
          <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline">
            <X size={12} /> Remove
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-gray-400 hover:bg-gray-50 w-full sm:w-64">
          <Upload size={18} className="text-gray-400" />
          <span className="text-xs text-gray-500 text-center">Click to upload institute logo</span>
          <span className="text-[10px] text-gray-400">JPG, PNG, WebP · max 300 KB</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface QuickLink { to: string; icon: React.ElementType; title: string; desc: string }
const QUICK_LINKS: QuickLink[] = [
  { to: '/admin/students/admit-card-settings', icon: FileBadge2, title: 'Admit Card Settings', desc: 'Header, footer, signatures & instructions' },
  { to: '/admin/students/id-card-settings',    icon: IdCard,     title: 'ID Card Settings',    desc: 'Institute details on student ID cards' },
  { to: '/admin/users',                         icon: Users,      title: 'Users & Permissions', desc: 'Manage staff access and permissions' },
  { to: '/admin/branches',                      icon: Briefcase,  title: 'Branches',            desc: 'Add, edit, and track franchise branches' },
  { to: '/admin/courses',                       icon: BookOpen,   title: 'Courses & Subjects',  desc: 'Programs, courses, subjects & batches' },
]

export default function SettingsPage() {
  const { profile, session, user, signOut } = useAuth()
  const [s, setS] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (profile && profile.role !== 'super_admin') return
    getSiteSettings()
      .then(v => { setS(v); setLoading(false) })
      .catch(() => { toast.error('Failed to load settings'); setLoading(false) })
  }, [profile])

  if (profile && profile.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />
  }

  function update<K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) {
    setS(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    try {
      await saveSiteSettings(s)
      toast.success('Institute settings saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

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
  const sessionCreated = session?.user.created_at ? new Date(session.user.created_at) : null

  if (loading || !s) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Institute identity, quick access, and security controls</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>These settings control the <strong>global institute identity</strong>. Card-specific settings (admit card, ID card) live in their own dedicated pages — use the Quick Links below.</p>
      </div>

      {/* Institute Information */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Institute Information</h2>
        </div>

        <FormField label="Institute Logo" hint="Shown on login screen, dashboards, and public pages">
          <LogoUpload value={s.institute_logo_url} onChange={v => update('institute_logo_url', v)} />
        </FormField>

        <FormField label="Institute Name" required>
          <input value={s.institute_name} onChange={e => update('institute_name', e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Tagline" hint="Short line shown below the institute name">
          <input value={s.tagline} onChange={e => update('tagline', e.target.value)} className={inputClass} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Contact Email">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="email" value={s.contact_email} onChange={e => update('contact_email', e.target.value)} placeholder="contact@unskillsc.org" className={`${inputClass} pl-9`} />
            </div>
          </FormField>
          <FormField label="Contact Phone">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={s.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder="+91 98765 43210" className={`${inputClass} pl-9`} />
            </div>
          </FormField>
        </div>

        <FormField label="Website">
          <div className="relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={s.website} onChange={e => update('website', e.target.value)} placeholder="www.unskillsc.org" className={`${inputClass} pl-9`} />
          </div>
        </FormField>

        <FormField label="Corporate Address">
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
            <textarea value={s.address} onChange={e => update('address', e.target.value)} rows={2} className={`${inputClass} pl-9 resize-none`} />
          </div>
        </FormField>

        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Social Links</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Facebook size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1877F2] pointer-events-none" />
              <input value={s.social_facebook} onChange={e => update('social_facebook', e.target.value)} placeholder="Facebook URL" className={`${inputClass} pl-9`} />
            </div>
            <div className="relative">
              <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E4405F] pointer-events-none" />
              <input value={s.social_instagram} onChange={e => update('social_instagram', e.target.value)} placeholder="Instagram URL" className={`${inputClass} pl-9`} />
            </div>
            <div className="relative">
              <Youtube size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF0000] pointer-events-none" />
              <input value={s.social_youtube} onChange={e => update('social_youtube', e.target.value)} placeholder="YouTube URL" className={`${inputClass} pl-9`} />
            </div>
            <div className="relative">
              <Linkedin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A66C2] pointer-events-none" />
              <input value={s.social_linkedin} onChange={e => update('social_linkedin', e.target.value)} placeholder="LinkedIn URL" className={`${inputClass} pl-9`} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map(l => {
            const Icon = l.icon
            return (
              <Link key={l.to} to={l.to}
                className="group flex items-center gap-3 p-3.5 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-gray-50 group-hover:bg-white flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-gray-600 group-hover:text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                  <p className="text-xs text-gray-500 truncate">{l.desc}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-red-500 shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Security & Session */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Security & Session</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Clock size={12} /><span>Last sign-in</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {lastSignIn ? lastSignIn.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
              <Clock size={12} /><span>Account created</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {sessionCreated ? sessionCreated.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-amber-900">
            <LogOut size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Sign out on all devices</p>
              <p className="text-amber-800/90">This will invalidate every active session — including this one — across every browser and device.</p>
            </div>
          </div>
          <button onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 shadow-sm shrink-0">
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
