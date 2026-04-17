import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Settings, Info, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../../components/FormField'
import { getAdmitCardSettings, saveAdmitCardSettings, ADMIT_DEFAULTS, type AdmitCardSettings } from '../../lib/admitCardSettings'

function SignatureUpload({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [error, setError] = useState('')

  const handleFile = useCallback((file: File) => {
    setError('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Only JPG or PNG allowed'); return }
    if (file.size > 100 * 1024) { setError('Max size is 100 KB'); return }
    const reader = new FileReader()
    reader.onloadend = () => onChange(reader.result as string)
    reader.readAsDataURL(file)
  }, [onChange])

  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1.5">{label}</p>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="signature" className="h-12 max-w-[180px] object-contain border border-gray-200 rounded-lg bg-gray-50 p-1" />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-gray-400 hover:bg-gray-50 w-48">
          <span className="text-xs text-gray-500 text-center">Click to upload signature</span>
          <span className="text-[10px] text-gray-400">Max 100 KB · JPG, PNG</span>
          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function AdmitCardSettingsPage() {
  const navigate = useNavigate()
  const [s, setS] = useState<AdmitCardSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAdmitCardSettings()
      .then(v => { setS(v); setLoading(false) })
      .catch(() => { toast.error('Failed to load settings'); setLoading(false) })
  }, [])

  function update<K extends keyof AdmitCardSettings>(k: K, v: AdmitCardSettings[K]) {
    setS(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    try {
      await saveAdmitCardSettings(s)
      toast.success('Admit card settings saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  function resetInstructions() {
    if (!s) return
    update('instructions_en', ADMIT_DEFAULTS.instructions_en)
    update('instructions_hi', ADMIT_DEFAULTS.instructions_hi)
    toast.success('Instructions reset to default. Don\'t forget to Save.')
  }

  if (loading || !s) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/students/admit-card')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">Admit Card Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Configure header, footer, instructions for every admit card PDF</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>These settings apply to <strong>all admit cards generated across every branch</strong>. The header shows the main company identity. Instructions can be in Hindi, English, or both — they render on every downloaded PDF.</p>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Header (top of PDF)</h2>
        <FormField label="Brand Name" hint="Large bold heading (e.g. UNSKILLS COMPUTER)" required>
          <input value={s.header_title} onChange={e => update('header_title', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Subtitle" hint="Line below the brand name">
          <input value={s.header_subtitle} onChange={e => update('header_subtitle', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Certifications Line" hint="ISO / Govt. certifications shown below the subtitle">
          <textarea value={s.header_tagline} onChange={e => update('header_tagline', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </FormField>
        <FormField label="Bottom Strip" hint="Shown in the strip below the header (e.g. Skill Development | Computer Education)">
          <input value={s.header_strip} onChange={e => update('header_strip', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="ISO Block (top-right)" hint="Short text shown in the right ISO column">
          <input value={s.iso_line} onChange={e => update('iso_line', e.target.value)} className={inputClass} />
        </FormField>
      </div>

      {/* Signature */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Signature Line</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Left Signer Label"><input value={s.left_signer} onChange={e => update('left_signer', e.target.value)} className={inputClass} /></FormField>
          <FormField label="Website (center)"><input value={s.website} onChange={e => update('website', e.target.value)} className={inputClass} /></FormField>
          <FormField label="Right Signer Label"><input value={s.right_signer} onChange={e => update('right_signer', e.target.value)} className={inputClass} /></FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <SignatureUpload
            label="Controller of Examination — Signature Image"
            value={s.controller_signature_url}
            onChange={v => update('controller_signature_url', v)}
          />
          <SignatureUpload
            label="Director — Signature Image"
            value={s.director_signature_url}
            onChange={v => update('director_signature_url', v)}
          />
        </div>
        <p className="text-xs text-gray-400">Signatures appear above the signer labels on the PDF. Max 100 KB each (JPG or PNG).</p>
      </div>

      {/* Footer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Footer (red bar at bottom)</h2>
        <FormField label="Corporate Office Address" required>
          <textarea value={s.footer_address} onChange={e => update('footer_address', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </FormField>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Instructions / Terms & Conditions</h2>
          <button onClick={resetInstructions} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
            <RotateCcw size={12} /> Reset to default
          </button>
        </div>
        <FormField label="English Header" hint="Bold line shown above Hindi instructions">
          <input value={s.instructions_en} onChange={e => update('instructions_en', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Instructions (Hindi / हिंदी)" hint="One instruction per line. Uses Devanagari font on the PDF.">
          <textarea
            value={s.instructions_hi}
            onChange={e => update('instructions_hi', e.target.value)}
            rows={12}
            className={`${inputClass} resize-y font-[system-ui] leading-relaxed`}
            style={{ fontFamily: 'Noto Sans, Noto Sans Devanagari, system-ui, sans-serif' }}
          />
        </FormField>
      </div>

      <div className="flex justify-end pb-6">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
