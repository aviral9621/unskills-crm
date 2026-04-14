import { useEffect, useState } from 'react'
import { Save, Loader2, Settings, Info } from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../../components/FormField'
import { getCardSettings, saveCardSettings, type CardSettings } from '../../lib/cardSettings'

export default function IdCardSettingsPage() {
  const [s, setS] = useState<CardSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCardSettings().then(v => { setS(v); setLoading(false) }).catch(() => { toast.error('Failed to load'); setLoading(false) })
  }, [])

  function update<K extends keyof CardSettings>(k: K, v: CardSettings[K]) {
    setS(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    try { await saveCardSettings(s); toast.success('Card settings saved') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading || !s) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Card Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Shared header / footer for ID Card, Admit Card, Marksheet, Certificate</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>These settings are used in the header/footer of every generated ID card, admit card, marksheet and certificate. The <strong>Verify Base URL</strong> is what the QR code on each card links to — it must match your website.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Header</h2>
        <FormField label="Organization Name" hint="Top bar title on every card" required>
          <input value={s.header_title} onChange={e => update('header_title', e.target.value.toUpperCase())} className={inputClass} />
        </FormField>
        <FormField label="Subtitle / Registration Line" hint="Small text below the organization name">
          <textarea value={s.header_subtitle} onChange={e => update('header_subtitle', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </FormField>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Footer</h2>
        <FormField label="Director" required>
          <input value={s.director_name} onChange={e => update('director_name', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Address" required>
          <textarea value={s.address} onChange={e => update('address', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone"><input value={s.phone} onChange={e => update('phone', e.target.value)} className={inputClass} placeholder="8382898686, 9838382898" /></FormField>
          <FormField label="Website"><input value={s.website} onChange={e => update('website', e.target.value)} className={inputClass} placeholder="www.unskillseducation.org" /></FormField>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Verification (QR Code)</h2>
        <FormField label="Verify Base URL" hint="e.g. https://www.unskillseducation.org — QR on ID card points to {base}/verify/id-card/{registrationNo}" required>
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
