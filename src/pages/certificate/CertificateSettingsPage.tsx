import { useEffect, useMemo, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Loader2,
  Settings,
  Info,
  Search,
  Image as ImageIcon,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import FormField, { inputClass } from '../../components/FormField'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  getCertificateSettings,
  saveCertificateSettings,
  listCertificateTemplates,
  listCourseMappings,
  upsertCourseMapping,
  deleteCourseMapping,
} from '../../lib/certificateSettings'
import type {
  CertificateSettings,
  CertificateTemplate,
  CourseCertificateMapping,
} from '../../types/certificate'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'

type Tab = 'branding' | 'signatory' | 'mapping'

interface CourseRow {
  id: string
  code: string
  name: string
}

function ImageUploadField({
  label,
  value,
  onChange,
  subfolder,
}: {
  label: string
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
      <p className="text-xs font-medium text-gray-700 mb-1.5">{label}</p>
      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt=""
            className="h-14 max-w-[200px] object-contain border border-gray-200 rounded-lg bg-gray-50 p-1"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-500 hover:underline"
          >
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

export default function CertificateSettingsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('branding')
  const [s, setS] = useState<CertificateSettings | null>(null)
  const [templates, setTemplates] = useState<CertificateTemplate[]>([])
  const [mappings, setMappings] = useState<CourseCertificateMapping[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Mapping tab state
  const [search, setSearch] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [mapTemplateIds, setMapTemplateIds] = useState<string[]>([])
  const [mapDefaultId, setMapDefaultId] = useState<string | null>(null)
  const [mapShowTyping, setMapShowTyping] = useState(false)

  useEffect(() => {
    Promise.all([
      getCertificateSettings(),
      listCertificateTemplates(),
      listCourseMappings(),
      supabase
        .from('uce_courses')
        .select('id, code, name')
        .eq('is_active', true)
        .order('name'),
    ])
      .then(([sett, tpls, maps, coursesRes]) => {
        setS(sett)
        setTemplates(tpls)
        setMappings(maps)
        setCourses(((coursesRes.data ?? []) as CourseRow[]))
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  // When course selected, sync mapping state
  useEffect(() => {
    if (!selectedCourseId) return
    const rows = mappings.filter(m => m.course_id === selectedCourseId)
    setMapTemplateIds(rows.map(r => r.template_id))
    const def = rows.find(r => r.is_default)
    setMapDefaultId(def?.template_id ?? rows[0]?.template_id ?? null)
    setMapShowTyping(rows.some(r => r.show_typing_fields))
  }, [selectedCourseId, mappings])

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return courses
    return courses.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    )
  }, [courses, search])

  const isConfigured = useCallback(
    (courseId: string) => mappings.some(m => m.course_id === courseId),
    [mappings],
  )

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

  async function handleSaveMapping() {
    if (!selectedCourseId) return
    setSaving(true)
    try {
      if (mapTemplateIds.length === 0) {
        await deleteCourseMapping(selectedCourseId)
      } else {
        const def = mapDefaultId && mapTemplateIds.includes(mapDefaultId)
          ? mapDefaultId
          : mapTemplateIds[0]
        await upsertCourseMapping({
          courseId: selectedCourseId,
          templateIds: mapTemplateIds,
          defaultTemplateId: def,
          showTypingFields: mapShowTyping,
        })
      }
      const fresh = await listCourseMappings()
      setMappings(fresh)
      toast.success('Mapping saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function toggleTemplate(tid: string) {
    setMapTemplateIds(prev => {
      const exists = prev.includes(tid)
      const next = exists ? prev.filter(id => id !== tid) : [...prev, tid]
      if (!next.includes(mapDefaultId ?? '')) setMapDefaultId(next[0] ?? null)
      return next
    })
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

  const horizontalId = templates.find(t => t.slug === 'certificate-of-qualification')?.id

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
            Branding, signatory, and course-to-template mapping
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>
          Applies to <strong>all certificates</strong> generated across every branch. Only super
          admins can edit these.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ['branding', 'Branding & Content'],
          ['signatory', 'Signatory'],
          ['mapping', 'Course Mapping'],
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

      {tab === 'branding' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Institute Name">
              <input value={s.institute_name ?? ''} onChange={e => update('institute_name', e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Institute Reg. Number">
              <input value={s.institute_reg_number ?? ''} onChange={e => update('institute_reg_number', e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Tagline (black bar text)">
            <input value={s.tagline ?? ''} onChange={e => update('tagline', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Sub-header Line 1">
            <textarea value={s.sub_header_line_1 ?? ''} onChange={e => update('sub_header_line_1', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </FormField>
          <FormField label="Sub-header Line 2">
            <textarea value={s.sub_header_line_2 ?? ''} onChange={e => update('sub_header_line_2', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </FormField>
          <FormField label="Sub-header Line 3">
            <textarea value={s.sub_header_line_3 ?? ''} onChange={e => update('sub_header_line_3', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </FormField>
          <FormField label="Corporate Office Address">
            <textarea value={s.corporate_office_address ?? ''} onChange={e => update('corporate_office_address', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Verification URL Base" hint="QR links to {base}/{certificateNumber}">
              <input value={s.verification_url_base ?? ''} onChange={e => update('verification_url_base', e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Contact Email">
              <input value={s.contact_email ?? ''} onChange={e => update('contact_email', e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <ImageUploadField label="Institute Logo" value={s.logo_url} onChange={v => update('logo_url', v)} subfolder="logos" />
            <ImageUploadField label="Training Center Default Logo" value={s.training_center_logo_url} onChange={v => update('training_center_logo_url', v)} subfolder="center-logos" />
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSaveSettings} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {tab === 'signatory' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Signatory Name">
              <input value={s.signatory_name ?? ''} onChange={e => update('signatory_name', e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Designation">
              <input value={s.signatory_designation ?? ''} onChange={e => update('signatory_designation', e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <FormField label="Company Line">
            <input value={s.signatory_company_line ?? ''} onChange={e => update('signatory_company_line', e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Registration Line" hint="Small gray text under signature">
            <textarea value={s.signatory_reg_line ?? ''} onChange={e => update('signatory_reg_line', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </FormField>
          <ImageUploadField label="Signature Image" value={s.signature_image_url} onChange={v => update('signature_image_url', v)} subfolder="signatures" />

          <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">Live preview</p>
            {s.signature_image_url ? (
              <img src={s.signature_image_url} alt="" className="h-10 mb-1 object-contain" />
            ) : null}
            <p
              className="text-2xl"
              style={{ fontFamily: '"Great Vibes", cursive' }}
            >
              {s.signatory_name || '—'}
            </p>
            <p className="text-xs font-semibold border-t border-gray-300 pt-1 mt-1 inline-block">
              {s.signatory_name || '—'}
            </p>
            {s.signatory_designation ? <p className="text-xs text-gray-600">{s.signatory_designation}</p> : null}
            {s.signatory_company_line ? <p className="text-xs text-gray-600">{s.signatory_company_line}</p> : null}
            {s.signatory_reg_line ? <p className="text-[10px] text-gray-400">{s.signatory_reg_line}</p> : null}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSaveSettings} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {tab === 'mapping' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 lg:col-span-1">
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">
              {filteredCourses.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No courses</p>
              ) : (
                filteredCourses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`w-full text-left px-2 py-2 flex items-center justify-between gap-2 rounded ${
                      selectedCourseId === c.id ? 'bg-red-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{c.code}</p>
                      <p className="text-xs text-gray-500 truncate">{c.name}</p>
                    </div>
                    {isConfigured(c.id) ? (
                      <span className="text-[10px] inline-flex items-center gap-0.5 text-green-700">
                        <Check size={10} /> Set
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Not configured</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:col-span-2 space-y-4">
            {!selectedCourseId ? (
              <p className="text-sm text-gray-500 text-center py-8">Pick a course on the left.</p>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-900">
                  {courses.find(c => c.id === selectedCourseId)?.code} — mapping
                </h3>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Allowed templates</p>
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={mapTemplateIds.includes(t.id)}
                        onChange={() => toggleTemplate(t.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-gray-500">
                          {t.orientation} · {t.description}
                        </p>
                      </div>
                      {mapTemplateIds.includes(t.id) ? (
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={mapDefaultId === t.id}
                            onChange={() => setMapDefaultId(t.id)}
                          />
                          Default
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>

                {horizontalId && mapTemplateIds.includes(horizontalId) ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mapShowTyping}
                      onChange={e => setMapShowTyping(e.target.checked)}
                    />
                    <span>Show typing marks on horizontal certificate</span>
                  </label>
                ) : null}

                <div className="flex justify-between pt-2">
                  <button
                    onClick={async () => {
                      if (!selectedCourseId) return
                      setSaving(true)
                      try {
                        await deleteCourseMapping(selectedCourseId)
                        setMappings(await listCourseMappings())
                        setMapTemplateIds([])
                        setMapDefaultId(null)
                        setMapShowTyping(false)
                        toast.success('Mapping removed')
                      } catch {
                        toast.error('Failed')
                      } finally {
                        setSaving(false)
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                  >
                    <X size={12} /> Clear mapping
                  </button>
                  <button
                    onClick={handleSaveMapping}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Mapping
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
