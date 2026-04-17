import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Settings, Info, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../../components/FormField'
import {
  getMarksheetSettings,
  saveMarksheetSettings,
  MARKSHEET_DEFAULTS,
  DEFAULT_GRADING_SCHEME,
  parseGradingScheme,
  type MarksheetSettings,
  type GradeBand,
} from '../../lib/marksheetSettings'

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

export default function MarksheetSettingsPage() {
  const navigate = useNavigate()
  const [s, setS] = useState<MarksheetSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getMarksheetSettings()
      .then(v => { setS(v); setLoading(false) })
      .catch(() => { toast.error('Failed to load settings'); setLoading(false) })
  }, [])

  function update<K extends keyof MarksheetSettings>(k: K, v: MarksheetSettings[K]) {
    setS(prev => prev ? { ...prev, [k]: v } : prev)
  }

  const grades = useMemo<GradeBand[]>(() => s ? parseGradingScheme(s.grading_scheme_json) : [], [s])

  function updateGrades(next: GradeBand[]) {
    update('grading_scheme_json', JSON.stringify(next))
  }

  function updateBand(idx: number, patch: Partial<GradeBand>) {
    const next = grades.map((b, i) => i === idx ? { ...b, ...patch } : b)
    updateGrades(next)
  }

  function addBand() {
    updateGrades([...grades, { label: 'New', min: 0, max: 0, grade: '-' }])
  }

  function removeBand(idx: number) {
    updateGrades(grades.filter((_, i) => i !== idx))
  }

  function resetGrades() {
    updateGrades(DEFAULT_GRADING_SCHEME)
    toast.success('Grading scheme reset. Don\'t forget to Save.')
  }

  async function handleSave() {
    if (!s) return
    setSaving(true)
    try {
      await saveMarksheetSettings(s)
      toast.success('Marksheet settings saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading || !s) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/marksheets')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-red-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">Marksheet Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Configure header, footer, grading scheme, and signature for every marksheet PDF</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>These settings apply to <strong>all marksheets generated across every branch</strong>. The institute logo is the main <code>MAIN LOGO FOR ALL CARDS.png</code> from public assets.</p>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Header (top of PDF)</h2>
        <FormField label="Brand Name" hint="Large bold heading" required>
          <input value={s.header_title} onChange={e => update('header_title', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Subtitle" hint="ISO line below the brand">
          <input value={s.header_subtitle} onChange={e => update('header_subtitle', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Tagline (multi-line)" hint="One line per entry. Usually the company & alliance lines.">
          <textarea value={s.header_tagline} onChange={e => update('header_tagline', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
        </FormField>
        <FormField label="Registration Line" hint="e.g. 'Registered under Company Act 2013'">
          <input value={s.reg_line} onChange={e => update('reg_line', e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="ISO Block (top-right)" hint="Short text shown in the right ISO column">
          <input value={s.iso_line} onChange={e => update('iso_line', e.target.value)} className={inputClass} />
        </FormField>
      </div>

      {/* Signature */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Authorised Signatory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Primary Signer Name"><input value={s.left_signer_name} onChange={e => update('left_signer_name', e.target.value)} className={inputClass} /></FormField>
          <FormField label="Primary Signer Title"><input value={s.left_signer_title} onChange={e => update('left_signer_title', e.target.value)} className={inputClass} /></FormField>
        </div>
        <FormField label="Primary Signer Organization (optional)">
          <input value={s.left_signer_org} onChange={e => update('left_signer_org', e.target.value)} className={inputClass} />
        </FormField>
        <SignatureUpload label="Primary Signature Image" value={s.left_signature_url} onChange={v => update('left_signature_url', v)} />

        <div className="pt-2 border-t border-gray-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Secondary Signer Name (optional)"><input value={s.right_signer_name} onChange={e => update('right_signer_name', e.target.value)} className={inputClass} /></FormField>
          <FormField label="Secondary Signer Title (optional)"><input value={s.right_signer_title} onChange={e => update('right_signer_title', e.target.value)} className={inputClass} /></FormField>
        </div>
        <SignatureUpload label="Secondary Signature Image (optional)" value={s.right_signature_url} onChange={v => update('right_signature_url', v)} />
        <p className="text-xs text-gray-400">Signatures appear above the signer labels on the PDF. Max 100 KB each (JPG or PNG).</p>
      </div>

      {/* Grading Scheme */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Grading Scheme</h2>
          <div className="flex items-center gap-2">
            <button onClick={resetGrades} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={addBand} className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700">
              <Plus size={12} /> Add band
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="text-left py-1 pr-2 font-medium">Label</th>
                <th className="text-left py-1 pr-2 font-medium">Min %</th>
                <th className="text-left py-1 pr-2 font-medium">Max %</th>
                <th className="text-left py-1 pr-2 font-medium">Grade</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grades.map((b, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-1 pr-2"><input value={b.label} onChange={e => updateBand(idx, { label: e.target.value })} className={`${inputClass} py-1.5`} /></td>
                  <td className="py-1 pr-2"><input type="number" value={b.min} onChange={e => updateBand(idx, { min: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20`} /></td>
                  <td className="py-1 pr-2"><input type="number" value={b.max} onChange={e => updateBand(idx, { max: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20`} /></td>
                  <td className="py-1 pr-2"><input value={b.grade} onChange={e => updateBand(idx, { grade: e.target.value })} className={`${inputClass} py-1.5 w-20`} /></td>
                  <td className="py-1 pl-2 w-8">
                    <button onClick={() => removeBand(idx)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">Percentages are inclusive. Order from highest to lowest. The row with grade &ldquo;F&rdquo; (or label &ldquo;Fail&rdquo;) is treated as a failing result.</p>
      </div>

      {/* Footer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Footer</h2>
        <FormField label="Head Office Address" required>
          <textarea value={s.footer_address} onChange={e => update('footer_address', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Verification Website"><input value={s.website} onChange={e => update('website', e.target.value)} className={inputClass} /></FormField>
          <FormField label="Contact Email"><input value={s.email} onChange={e => update('email', e.target.value)} className={inputClass} /></FormField>
        </div>
        <FormField label="Optional Note on PDF" hint="Small line shown below the final grade banner">
          <input value={s.notes} onChange={e => update('notes', e.target.value)} className={inputClass} placeholder="e.g. This certificate is subject to verification via QR code" />
        </FormField>
        <div className="flex justify-end">
          <button
            onClick={() => { if (s) { const reset = { ...s, ...MARKSHEET_DEFAULTS }; setS(reset) } }}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
          >
            <RotateCcw size={12} /> Reset header/footer to defaults
          </button>
        </div>
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
