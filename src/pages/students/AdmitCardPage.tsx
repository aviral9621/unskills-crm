import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ClipboardList, Download, Loader2, Settings, History } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass, selectClass } from '../../components/FormField'
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
  course?: { name: string; code: string; total_semesters: number | null } | null
  branch?: { name: string; address_line1: string | null; district: string; state: string; pincode: string | null; director_phone: string } | null
}

interface SubjectRow { id: string; name: string; code: string | null; semester: number | null; selected: boolean }
type ScheduleEntry = Omit<AdmitCardSchedule, 'subject_id' | 'subject_name'>

interface AdmitCardRecord {
  id: string
  student_id: string
  course_id: string
  semester: number | null
  exam_center_name: string | null
  exam_center_code: string | null
  exam_center_address: string | null
  schedule: AdmitCardSchedule[]
  created_at: string
  student?: { name: string; registration_no: string } | null
  course?: { name: string; code: string } | null
}

export default function AdmitCardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(searchParams.get('student') || '')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [centerName, setCenterName] = useState('')
  const [centerCode, setCenterCode] = useState('')
  const [centerAddress, setCenterAddress] = useState('')
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('')
  const [courseTotalSemesters, setCourseTotalSemesters] = useState(0)

  const [entries, setEntries] = useState<ScheduleEntry[]>([])

  const [history, setHistory] = useState<AdmitCardRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => { loadHistory() }, [])
  useEffect(() => {
    if (searchParams.get('student')) handleSearch()
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('uce_admit_cards')
        .select('id, student_id, course_id, semester, exam_center_name, exam_center_code, exam_center_address, schedule, created_at, student:uce_students(name, registration_no), course:uce_courses(name, code)')
        .order('created_at', { ascending: false })
        .limit(50)
      setHistory((data ?? []) as unknown as AdmitCardRecord[])
    } catch { /* silent */ }
    finally { setHistoryLoading(false) }
  }

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); setStudent(null); setSubjects([]); setAllSubjects([]); setEntries([])
    setSelectedSemester(''); setCourseTotalSemesters(0)
    try {
      const sel = 'id, registration_no, name, father_name, dob, gender, photo_url, address, district, state, course_id, session, enrollment_date, course:uce_courses(name, code, total_semesters), branch:uce_branches(name, address_line1, district, state, pincode, director_phone)'
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

      const br = s.branch
      if (br) {
        setCenterName(br.name)
        setCenterAddress(`${br.address_line1 || ''}, ${br.district}, ${br.state}${br.pincode ? ' - ' + br.pincode : ''}`)
      }

      const total = (s.course as StudentData['course'])?.total_semesters ?? 0
      setCourseTotalSemesters(total)

      // Load all subjects for this course
      const { data: subs } = await supabase
        .from('uce_subjects').select('id, name, code, semester')
        .eq('course_id', s.course_id).eq('is_active', true)
        .order('semester', { nullsFirst: false }).order('display_order')
      const subRows = (subs ?? []).map(sub => ({ ...sub, selected: true })) as SubjectRow[]
      setAllSubjects(subRows)

      // If course has no semesters, show all subjects immediately
      if (total === 0) {
        setSubjects(subRows)
        setEntries(subRows.map(() => ({ date: '', reporting_time: '09:30', exam_time: '10:00', end_time: '12:00' })))
      }
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  function handleSemesterChange(sem: number | '') {
    setSelectedSemester(sem)
    if (sem === '') {
      setSubjects([]); setEntries([]); return
    }
    const filtered = allSubjects.filter(s => s.semester === Number(sem))
    setSubjects(filtered.map(s => ({ ...s, selected: true })))
    setEntries(filtered.map(() => ({ date: '', reporting_time: '09:30', exam_time: '10:00', end_time: '12:00' })))
  }

  function updateEntry(idx: number, field: keyof ScheduleEntry, value: string) {
    setEntries(p => p.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function handleGenerate() {
    if (!student) return
    const selected = subjects.map((sub, i) => ({ sub, entry: entries[i] })).filter(({ sub }) => sub.selected)
    if (selected.length === 0) { toast.error('Select at least one subject'); return }
    if (courseTotalSemesters > 0 && selectedSemester === '') { toast.error('Please select a semester'); return }

    setGenerating(true)
    try {
      const [settings, logoDataUrl] = await Promise.all([
        getAdmitCardSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      ])

      let photoDataUrl = ''
      if (student.photo_url) photoDataUrl = await toDataUrl(student.photo_url).catch(() => '')

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
          id: student.id, registration_no: student.registration_no, name: student.name,
          father_name: student.father_name, dob: student.dob, gender: student.gender,
          photo_url: student.photo_url, course_name: course ? `${course.name} (${course.code})` : '—',
          session: student.session, enrollment_date: student.enrollment_date,
        },
        center: { name: centerName, code: centerCode, address: centerAddress, semester: selectedSemester !== '' ? `Semester ${selectedSemester}` : null },
        schedule, settings, logoDataUrl, photoDataUrl,
      })

      // Save to history
      await supabase.from('uce_admit_cards').insert({
        student_id: student.id,
        course_id: student.course_id,
        semester: selectedSemester !== '' ? Number(selectedSemester) : null,
        exam_center_name: centerName || null,
        exam_center_code: centerCode || null,
        exam_center_address: centerAddress || null,
        schedule,
      })
      loadHistory()

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

  async function handleDownloadHistory(record: AdmitCardRecord) {
    setDownloading(record.id)
    try {
      const { data: studentData } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, gender, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code)')
        .eq('id', record.student_id).single()

      if (!studentData) { toast.error('Student not found'); return }

      const [settings, logoDataUrl] = await Promise.all([
        getAdmitCardSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      ])

      const sd = studentData as typeof studentData & { course?: { name: string; code: string } | null }
      let photoDataUrl = ''
      if (sd.photo_url) photoDataUrl = await toDataUrl(sd.photo_url).catch(() => '')

      const blob = await buildAdmitCardPdfBlob({
        student: {
          id: sd.id, registration_no: sd.registration_no, name: sd.name,
          father_name: sd.father_name, dob: sd.dob, gender: sd.gender,
          photo_url: sd.photo_url, course_name: sd.course ? `${sd.course.name} (${sd.course.code})` : '—',
          session: sd.session, enrollment_date: sd.enrollment_date,
        },
        center: {
          name: record.exam_center_name || '', code: record.exam_center_code || '',
          address: record.exam_center_address || '',
          semester: record.semester != null ? `Semester ${record.semester}` : null,
        },
        schedule: record.schedule,
        settings, logoDataUrl, photoDataUrl,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Admit-Card-${sd.registration_no.replace('/', '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error(err); toast.error('Failed to download') }
    finally { setDownloading(null) }
  }

  function fmtDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
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
          {/* Student Info */}
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

            {/* Semester selector */}
            {courseTotalSemesters > 0 && (
              <div className="mb-4">
                <FormField label="Select Semester" hint="Subjects will be filtered by semester">
                  <select
                    value={selectedSemester}
                    onChange={e => handleSemesterChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value="">Choose semester</option>
                    {Array.from({ length: courseTotalSemesters }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Semester {n}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}

            {subjects.length > 0 && (
              <>
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
                </div>
              </>
            )}
            {courseTotalSemesters > 0 && selectedSemester === '' && (
              <p className="text-sm text-gray-400 text-center py-4">Select a semester to load subjects</p>
            )}
            {courseTotalSemesters > 0 && selectedSemester !== '' && subjects.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No subjects found for Semester {selectedSemester}</p>
            )}
          </div>

          {/* Center details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Exam Center Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Center Name">
                <input value={centerName} onChange={e => setCenterName(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Center Code">
                <input value={centerCode} onChange={e => setCenterCode(e.target.value)} className={inputClass} placeholder="e.g., UCE-EC-001" />
              </FormField>
            </div>
            <FormField label="Center Address">
              <input value={centerAddress} onChange={e => setCenterAddress(e.target.value)} className={inputClass} />
            </FormField>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || subjects.length === 0}
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

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Generated Admit Cards</h3>
        </div>
        {historyLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No admit cards generated yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map(rec => {
              const st = rec.student as { name: string; registration_no: string } | null
              const co = rec.course as { name: string; code: string } | null
              return (
                <div key={rec.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{st?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {st?.registration_no} &middot; {co?.name ?? '—'}
                      {rec.semester != null ? ` · Sem ${rec.semester}` : ''}
                      &nbsp;&middot;&nbsp;{fmtDate(rec.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadHistory(rec)}
                    disabled={downloading === rec.id}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    {downloading === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Download
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
