import { useEffect, useState } from 'react'
import { Loader2, Save, Plus, Trash2, MessageSquare, Sparkles, BookOpen, Timer, Power } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass } from '../../components/FormField'

interface SpecialOffer { title: string; value: string }

interface PopupSettings {
  id: string
  is_enabled: boolean
  hindi_line: string
  top_courses: string[]
  special_offers: SpecialOffer[]
  display_seconds: number
}

const DEFAULT: Omit<PopupSettings, 'id'> = {
  is_enabled: true,
  hindi_line: 'सरकारी नौकरी का सपना पूरा करें',
  top_courses: ['O Level & CCC', 'ADCA & DCA', 'Tally Prime with GST', 'Beautician Courses', 'University Admissions'],
  special_offers: [
    { title: 'Agniveer', value: '+15 Bonus Marks' },
    { title: 'SC/ST & Divyang', value: '₹12,000 Scholarship' },
  ],
  display_seconds: 0,
}

export default function HomepagePopupSettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<PopupSettings | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_homepage_popup_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setForm({
          id: data.id,
          is_enabled: data.is_enabled,
          hindi_line: data.hindi_line ?? DEFAULT.hindi_line,
          top_courses: Array.isArray(data.top_courses) ? data.top_courses : DEFAULT.top_courses,
          special_offers: Array.isArray(data.special_offers) ? data.special_offers : DEFAULT.special_offers,
          display_seconds: data.display_seconds ?? 0,
        })
      } else {
        // Should never happen — migration seeds a row — but fall back gracefully.
        setForm({ id: '', ...DEFAULT })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!form) return
    if (!form.id) { toast.error('Settings row missing — contact dev'); return }
    setSaving(true)
    try {
      const payload = {
        is_enabled: form.is_enabled,
        hindi_line: form.hindi_line.trim(),
        top_courses: form.top_courses.map(s => s.trim()).filter(Boolean),
        special_offers: form.special_offers
          .map(o => ({ title: o.title.trim(), value: o.value.trim() }))
          .filter(o => o.title || o.value),
        display_seconds: Math.max(0, Math.floor(Number(form.display_seconds) || 0)),
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      }
      const { error } = await supabase
        .from('uce_homepage_popup_settings')
        .update(payload)
        .eq('id', form.id)
      if (error) throw error
      toast.success('Popup settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Homepage Popup</h1>
          <p className="text-xs sm:text-sm text-gray-500">Controls the welcome modal that appears on the public website homepage.</p>
        </div>
      </div>

      {/* Master toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Power size={16} className={form.is_enabled ? 'text-emerald-600' : 'text-gray-400'} />
            <span className="text-sm font-semibold text-gray-900">Show popup on homepage</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">When off, no popup is shown to any visitor.</p>
        </div>
        <ToggleSwitch
          checked={form.is_enabled}
          onChange={v => setForm({ ...form, is_enabled: v })}
        />
      </div>

      {/* Display timer */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <Timer size={16} className="text-red-600" />
          <span className="text-sm font-semibold text-gray-900">Auto-close timer</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          How long the popup stays on screen before closing automatically. Set to <strong>0</strong> to disable
          auto-close (the visitor closes it manually).
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            value={form.display_seconds}
            onChange={e => setForm({ ...form, display_seconds: Number(e.target.value) || 0 })}
            className={`${inputClass} w-32`}
          />
          <span className="text-sm text-gray-500">seconds</span>
        </div>
      </div>

      {/* Hindi line */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-red-600" />
          <span className="text-sm font-semibold text-gray-900">Hindi tagline</span>
        </div>
        <p className="text-xs text-gray-500">Shown in gold under the institute name.</p>
        <FormField label="">
          <input
            type="text"
            value={form.hindi_line}
            onChange={e => setForm({ ...form, hindi_line: e.target.value })}
            className={inputClass}
            placeholder="सरकारी नौकरी का सपना पूरा करें"
          />
        </FormField>
      </div>

      {/* Top courses */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-red-600" />
          <span className="text-sm font-semibold text-gray-900">Top courses</span>
        </div>
        <p className="text-xs text-gray-500">Listed under "Top Courses" inside the popup. Empty rows are ignored.</p>
        <div className="space-y-2">
          {form.top_courses.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={c}
                onChange={e => {
                  const next = [...form.top_courses]
                  next[idx] = e.target.value
                  setForm({ ...form, top_courses: next })
                }}
                className={inputClass}
                placeholder="Course name"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, top_courses: form.top_courses.filter((_, i) => i !== idx) })}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, top_courses: [...form.top_courses, ''] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Plus size={14} /> Add course
          </button>
        </div>
      </div>

      {/* Special offers */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-red-600" />
          <span className="text-sm font-semibold text-gray-900">Special offers</span>
        </div>
        <p className="text-xs text-gray-500">Each offer is shown as a card with a title and a value. Up to 4 fits cleanly in the popup.</p>
        <div className="space-y-2">
          {form.special_offers.map((o, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                type="text"
                value={o.title}
                onChange={e => {
                  const next = [...form.special_offers]
                  next[idx] = { ...next[idx], title: e.target.value }
                  setForm({ ...form, special_offers: next })
                }}
                className={inputClass}
                placeholder="Title (e.g. Agniveer)"
              />
              <input
                type="text"
                value={o.value}
                onChange={e => {
                  const next = [...form.special_offers]
                  next[idx] = { ...next[idx], value: e.target.value }
                  setForm({ ...form, special_offers: next })
                }}
                className={inputClass}
                placeholder="Value (e.g. +15 Bonus Marks)"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, special_offers: form.special_offers.filter((_, i) => i !== idx) })}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, special_offers: [...form.special_offers, { title: '', value: '' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Plus size={14} /> Add offer
          </button>
        </div>
      </div>

      {/* Save button */}
      <div className="sticky bottom-2 sm:static">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 shadow"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center pb-4">
        Visitors see the popup at most once per device on the homepage. Changes appear after their next visit.
      </p>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center cursor-pointer select-none shrink-0">
      <span className="relative inline-block">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
