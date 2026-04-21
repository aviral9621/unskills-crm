import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  Info,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../../components/FormField'
import { useAuth } from '../../contexts/AuthContext'
import {
  getCertificateSettings,
  saveCertificateSettings,
  syncCertificateFromMarksheet,
} from '../../lib/certificateSettings'
import type { CertificateSettings } from '../../types/certificate'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'

type Tab = 'branding' | 'signatory'

function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  subfolder,
}: {
  label: string
  hint?: string
  value: string | null
  onChange: (url: string | null) => void
  subfolder: string
}) {
  const [uploading, setUploading] = useState(false)
  async function handleFile(file: File) {
    setUploading(true)
    try {
      const path = `${subfolder}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const url = await uploadPublicFile(STORAGE_BUCKETS.certificateAssets, path, file)
      onChange(url)
      toast.success('Uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">{label}</p>
      {hint ? <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p> : null}
      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt=""
            className="h-14 max-w-[200px] object-contain border border-gray-200 rounded-lg bg-gray-50 p-1"
          />
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-500 hover:underline">
            Remove
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-gray-400 hover:bg-gray-50 w-56">
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-red-500" />
          ) : (
            <ImageIcon size={20} className="text-gray-400" />
          )}
          <span className="text-xs text-gray-500 text-center">
            {uploading ? 'Uploading…' : 'Click to upload'}
          </span>
          <span className="text-[10px] text-gray-400">PNG / JPG / SVG</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {hint ? <p className="text-xs text-gray-400 mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

export default function CertificateSettingsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('branding')
  const [s, setS] = useState<CertificateSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    getCertificateSettings()
      .then(sett => {
        setS(sett)

        // Auto-sync on first load if institute_reg_number is empty
        if (!sett.institute_reg_number) {
          const hasAnyContent = sett.tagline || sett.corporate_office_address || sett.signatory_name
          if (!hasAnyContent) {
            syncCertificateFromMarksheet()
              .then(synced => setS(synced))
              .catch(() => { /* silent */ })
          }
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) {
    setS(prev => (prev ? { ...prev, [k]: v } : prev))
  }

  async function handleSaveSettings() {
    if (!s) return
    setSaving(true)
    try {
      await saveCertificateSettings(s)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const synced = await syncCertificateFromMarksheet()
      setS(synced)
      toast.success('Synced from marksheet settings')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (profile && profile.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />
  }

  if (loading || !s) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigate('/admin/certificates')}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">
            Certificate Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Branding and signatory applied to all certificates
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>
          Templates are assigned per <strong>program</strong> (hardcoded). These settings apply to
          <strong> all certificates</strong> across every branch. Only super admins can edit.
        </p>
      </div>

      {/* Sync from marksheet button */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Sync Shared Fields from Marksheet Settings</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Copies tagline, sub-headers, address, email, signatory and signature from marksheet settings.
          </p>
        </div>
        <button
          onClick={() => void handleSync()}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ['branding', 'Branding & Content'],
          ['signatory', 'Signatory'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === id
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Branding & Content ── */}
      {tab === 'branding' && (
        <div className="space-y-4">
          <SectionCard title="Institute Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Institute Name">
                <input
                  value={s.institute_name ?? ''}
                  onChange={e => update('institute_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField
                label="Institute Reg. Number"
                hint="Required — displayed top-right on certificates"
              >
                <input
                  value={s.institute_reg_number ?? ''}
                  onChange={e => update('institute_reg_number', e.target.value)}
                  className={`${inputClass} ${!s.institute_reg_number ? 'border-amber-400 focus:ring-amber-500/20' : ''}`}
                  placeholder="e.g. REG/2024/12345 (required)"
                />
                {!s.institute_reg_number ? (
                  <p className="text-[11px] text-amber-600 mt-1">⚠ Required — fill this before issuing certificates</p>
                ) : null}
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageUploadField
                label="Institute Logo"
                value={s.logo_url}
                onChange={v => update('logo_url', v)}
                subfolder="logos"
              />
              <ImageUploadField
                label="Training Center Default Logo"
                hint="Used when a branch has no logo"
                value={s.training_center_logo_url}
                onChange={v => update('training_center_logo_url', v)}
                subfolder="center-logos"
              />
            </div>
          </SectionCard>

          <SectionCard title="Header Content" hint="Appears below the brand title on certificates">
            <FormField label="Tagline (ISO black bar text)">
              <input
                value={s.tagline ?? ''}
                onChange={e => update('tagline', e.target.value)}
                className={inputClass}
                placeholder="An ISO 9001:2015 Certified Organization"
              />
            </FormField>
            <FormField label="Sub-header Line 1">
              <textarea
                value={s.sub_header_line_1 ?? ''}
                onChange={e => update('sub_header_line_1', e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </FormField>
            <FormField label="Sub-header Line 2">
              <textarea
                value={s.sub_header_line_2 ?? ''}
                onChange={e => update('sub_header_line_2', e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </FormField>
            <FormField label="Sub-header Line 3">
              <textarea
                value={s.sub_header_line_3 ?? ''}
                onChange={e => update('sub_header_line_3', e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </FormField>
          </SectionCard>

          <SectionCard title="Contact">
            <FormField label="Corporate Office Address">
              <textarea
                value={s.corporate_office_address ?? ''}
                onChange={e => update('corporate_office_address', e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Contact Email">
                <input
                  value={s.contact_email ?? ''}
                  onChange={e => update('contact_email', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField
                label="Verification URL Base"
                hint="QR points to {base}/{certificateNumber}"
              >
                <input
                  value={s.verification_url_base ?? ''}
                  onChange={e => update('verification_url_base', e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <button
              onClick={() => void handleSaveSettings()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Signatory ── */}
      {tab === 'signatory' && (
        <div className="space-y-4">
          <SectionCard title="Signatory" hint="Name, designation, and signature image for certificates">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Signatory Name">
                <input
                  value={s.signatory_name ?? ''}
                  onChange={e => update('signatory_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Designation">
                <input
                  value={s.signatory_designation ?? ''}
                  onChange={e => update('signatory_designation', e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="Company Line">
              <input
                value={s.signatory_company_line ?? ''}
                onChange={e => update('signatory_company_line', e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField
              label="Registration Line"
              hint="Small gray text under the signature block"
            >
              <textarea
                value={s.signatory_reg_line ?? ''}
                onChange={e => update('signatory_reg_line', e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </FormField>
            <ImageUploadField
              label="Signature Image"
              hint="Upload a transparent PNG — shown above the printed name"
              value={s.signature_image_url}
              onChange={v => update('signature_image_url', v)}
              subfolder="signatures"
            />
          </SectionCard>

          {/* Live preview */}
          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 mb-3">Live preview</p>
            {s.signature_image_url ? (
              <img src={s.signature_image_url} alt="" className="h-10 mb-1 object-contain" />
            ) : (
              <div className="h-10 border-b border-gray-400 w-48 mb-1" />
            )}
            <p className="text-xs font-bold border-t border-gray-300 pt-1 mt-1 inline-block">
              {s.signatory_name || '—'}
            </p>
            {s.signatory_designation ? (
              <p className="text-xs text-gray-600">{s.signatory_designation}</p>
            ) : null}
            {s.signatory_company_line ? (
              <p className="text-xs text-gray-600">{s.signatory_company_line}</p>
            ) : null}
            {s.signatory_reg_line ? (
              <p className="text-[10px] text-gray-400">{s.signatory_reg_line}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void handleSaveSettings()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
