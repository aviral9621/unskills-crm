import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Settings, Info } from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../../components/FormField'
import { getStaffCardSettings, saveStaffCardSettings, type StaffCardSettings } from '../../lib/staffCardSettings'

function SignatureUpload({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [error, setError] = useState('')
  const handleFile = useCallback((file: File) => {
    setError('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Only JPG or PNG allowed'); return }
    if (file.size > 200 * 1024) { setError('Max size is 200 KB'); return }
    const r = new FileReader()
    r.onloadend = () => onChange(r.result as string)
    r.readAsDataURL(file)
  }, [onChange])

  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1.5">{label}</p>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="signature" className="h-16 max-w-[220px] object-contain border border-gray-200 rounded-lg bg-gray-50 p-1" />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-gray-400 hover:bg-gray-50 w-56">
          <span className="text-xs text-gray-500 text-center">Click to upload signature / stamp</span>
          <span className="text-[10px] text-gray-400">Max 200 KB · JPG, PNG · Transparent PNG recommended</span>
          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function StaffIdCardSettingsPage() {
  const navigate = useNavigate()
  const [s, setS] = useState<StaffCardSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getStaffCardSettings()
      .then(v => { setS(v); setLoading(false) })
      .catch(() => { toast.error('Failed to load settings'); setLoading(false) })
  }, [])

  function update<K extends keyof StaffCardSettings>(k: K, v: StaffCardSettings[K]) {
    setS(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    try { await saveStaffCardSettings(s); toast.success('Teachers ID settings saved') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading || !s) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/staff/id-card')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">Teachers ID Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Authority name, designation and authorised stamp for every staff ID card</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>Upload the <strong>authority signature / stamp</strong> here. It prints on the back of every teacher / staff ID card above "Authorised Signatory". The HQ header and branch footer are shared with the Student ID Card settings.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Authorised Signatory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Authority Name" required>
            <input value={s.authority_name} onChange={e => update('authority_name', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Designation" required>
            <input value={s.authority_designation} onChange={e => update('authority_designation', e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <SignatureUpload label="Authorised Signature / Stamp" value={s.signature_url} onChange={v => update('signature_url', v)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Validity & QR</h2>
        <FormField label="Validity Line" hint="Small line printed on the back of the ID card">
          <input value={s.validity_line} onChange={e => update('validity_line', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Verify Base URL" hint="QR links to {base}/verify/staff/{employee_code}" required>
          <input value={s.verify_base_url} onChange={e => update('verify_base_url', e.target.value)} className={inputClass} placeholder="https://www.unskillseducation.org" />
        </FormField>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
