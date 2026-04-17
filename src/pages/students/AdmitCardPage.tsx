import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ClipboardList, Download, Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass } from '../../components/FormField'
import { getAdmitCardSettings } from '../../lib/admitCardSettings'
import {
  buildAdmitCardPdfBlob,
  toDataUrl,
  type AdmitCardSchedule,
} from '../../lib/pdf/admit-card'

interface StudentData {
  id: string; registration_no: string; name: string; father_name: string
  dob: string | null; gender: string | null; photo_url: string | null
  address: string | null; district: string | null; state: string | null
  course_id: string; session: string | null; enrollment_date: string
  course?: { name: string; code: string } | null
  branch?: { name: string; address_line1: string | null; district: string; state: string; pincode: string | null; director_phone: string } | null
}

interface SubjectRow { id: string; name: string; code: string | null; selected: boolean }
type ScheduleEntry = Omit<AdmitCardSchedule, 'subject_id' | 'subject_name'>

export default function AdmitCardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(searchParams.get('student') || '')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Exam center
  const [centerName, setCenterName] = useState('')
  const [centerCode, setCenterCode] = useState('')
  const [centerAddress, setCenterAddress] = useState('')
  const [semester, setSemester] = useState('')

  // Per-subject schedule entries
  const [entries, setEntries] = useState<ScheduleEntry[]>([])

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); setStudent(null); setSubjects([]); setEntries([])
    try {
      const sel = 'id, registration_no, name, father_name, dob, gender, photo_url, address, district, state, course_id, session, enrollment_date, course:uce_courses(name, code), branch:uce_branches(name, address_line1, district, state, pincode, director_phone)'
      const trimmed = query.trim()
      let data: Record<string, unknown> | null = null

      if (trimmed.includes('-') && trimmed.length > 20) {
        const { data: d } = await supabase.from('uce_students').select(sel).eq('id', trimmed).limit(1).maybeSingle()
        data = d
      }
      if (!data) {
        const { data: d } = await supabase.from('uce_students').select(sel).ilike('registration_no', trimmed).limit(1).maybeSingle()
        data = d
      }
      if (!data) {
        const { data: d } = await supabase.from('uce_students').select(sel).ilike('registration_no', `%${trimmed}%`).limit(1).maybeSingle()
        data = d
      }
      if (!data) {
        const { data: d } = await supabase.from('uce_students').select(sel).ilike('name', `%${trimmed}%`).limit(1).maybeSingle()
        data = d
      }

      if (!data) { toast.error('Student not found. Try registration number or name.'); return }
      const s = data as unknown as StudentData
      setStudent(s)

      // Pre-fill center from branch
      const br = s.branch as typeof s.branch
      if (br) {
        setCenterName(br.name)
        setCenterAddress(`${br.address_line1 || ''}, ${br.district}, ${br.state}${br.pincode ? ' - ' + br.pincode : ''}`)
      }

      // Load subjects
      const { data: subs } = await supabase
        .from('uce_subjects').select('id, name, code')
        .eq('course_id', s.course_id).eq('is_active', true).order('display_order')
      const subRows = (subs ?? []).map(sub => ({ ...sub, selected: true })) as SubjectRow[]
      setSubjects(subRows)
      setEntries(subRows.map(() => ({ date: '', reporting_time: '09:30', exam_time: '10:00', end_time: '12:00' })))
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (searchParams.get('student')) handleSearch()
  }, [])

  function updateEntry(idx: number, field: keyof ScheduleEntry, value: string) {
    setEntries(p => p.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function handleGenerate() {
    if (!student) return
    const selected = subjects
      .map((sub, i) => ({ sub, entry: entries[i] }))
      .filter(({ sub }) => sub.selected)
    if (selected.length === 0) { toast.error('Select at least one subject'); return }

    setGenerating(true)
    try {
      const [settings, logoDataUrl] = await Promise.all([
        getAdmitCardSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      ])

      let photoDataUrl = ''
      if (student.photo_url) {
        photoDataUrl = await toDataUrl(student.photo_url).catch(() => '')
      }

      const schedule: AdmitCardSchedule[] = selected.map(({ sub, entry }) => ({
        subject_id: sub.id,
        subject_name: sub.name,
        date: entry.date,
        reporting_time: entry.reporting_time,
        exam_time: entry.exam_time,
        end_time: entry.end_time || null,
      }))

      const course = student.course as { name: string; code: string } | null

      const blob = await buildAdmitCardPdfBlob({
        student: {
          id: student.id,
          registration_no: student.registration_no,
          name: student.name,
          father_name: student.father_name,
          dob: student.dob,
          gender: student.gender,
          photo_url: student.photo_url,
          course_name: course ? `${course.name} (${course.code})` : '—',
          session: student.session,
          enrollment_date: student.enrollment_date,
        },
        center: {
          name: centerName,
          code: centerCode,
          address: centerAddress,
          semester: semester || null,
        },
        schedule,
        settings,
        logoDataUrl,
        photoDataUrl,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Admit-Card-${student.registration_no.replace('/', '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Admit Card downloaded!')
    } catch (err) { console.error(err); toast.error('Failed to generate admit card') }
    finally { setGenerating(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Admit Card</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Generate exam admit cards</p>
        </div>
        <button
          onClick={() => navigate('/admin/students/admit-card-settings')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <Settings size={14} /> Settings
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <FormField label="Search Student" hint="Search by registration number or name">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className={`${inputClass} flex-1`}
              placeholder="e.g., UCE/0001 or student name"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shrink-0 flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
            </button>
          </div>
        </FormField>
      </div>

      {student && (
        <>
          {/* Student Info + Subjects */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              {student.photo_url
                ? <img src={student.photo_url} className="h-12 w-12 rounded-full object-cover border border-gray-200" />
                : <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-red-600">{student.name.charAt(0)}</span>
                  </div>}
              <div>
                <p className="text-base font-semibold text-gray-900">{student.name}</p>
                <p className="text-xs font-mono text-gray-400">
                  {student.registration_no} &middot; {(student.course as { name: string } | null)?.name}
                </p>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-900 mb-2">Subjects & Exam Schedule</h3>
            <div className="space-y-2">
              {subjects.map((sub, idx) => (
                <div key={sub.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={sub.selected}
                      onChange={() => setSubjects(p => p.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                    {sub.code && <span className="text-xs text-gray-400 font-mono">({sub.code})</span>}
                  </div>
                  {sub.selected && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-6">
                      <FormField label="Date">
                        <input type="date" value={entries[idx]?.date || ''} onChange={e => updateEntry(idx, 'date', e.target.value)} className={`${inputClass} text-xs`} />
                      </FormField>
                      <FormField label="Reporting">
                        <input type="time" value={entries[idx]?.reporting_time || '09:30'} onChange={e => updateEntry(idx, 'reporting_time', e.target.value)} className={`${inputClass} text-xs`} />
                      </FormField>
                      <FormField label="Exam Start">
                        <input type="time" value={entries[idx]?.exam_time || '10:00'} onChange={e => updateEntry(idx, 'exam_time', e.target.value)} className={`${inputClass} text-xs`} />
                      </FormField>
                      <FormField label="End">
                        <input type="time" value={entries[idx]?.end_time || '12:00'} onChange={e => updateEntry(idx, 'end_time', e.target.value)} className={`${inputClass} text-xs`} />
                      </FormField>
                    </div>
                  )}
                </div>
              ))}
              {subjects.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No subjects found for this course</p>}
            </div>
          </div>

          {/* Center details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Exam Center Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Center Name">
                <input value={centerName} onChange={e => setCenterName(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Center Code">
                <input value={centerCode} onChange={e => setCenterCode(e.target.value)} className={inputClass} placeholder="e.g., UCE-EC-001" />
              </FormField>
              <FormField label="Semester (optional)">
                <input value={semester} onChange={e => setSemester(e.target.value)} className={inputClass} placeholder="e.g., 1st Sem" />
              </FormField>
            </div>
            <FormField label="Center Address">
              <input value={centerAddress} onChange={e => setCenterAddress(e.target.value)} className={inputClass} />
            </FormField>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {generating ? 'Generating…' : 'Download Admit Card (PDF)'}
          </button>
        </>
      )}

      {!student && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Search for a student to generate their admit card</p>
        </div>
      )}
    </div>
  )
}
