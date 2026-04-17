import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ClipboardList, Download, Loader2, Settings, History, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import { getAdmitCardSettings } from '../../lib/admitCardSettings'
import { useAuth } from '../../contexts/AuthContext'
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
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [query, setQuery] = useState(searchParams.get('student') || '')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([])
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [centerName, setCenterName] = useState('')
  const [centerCode, setCenterCode] = useState('')
  const [centerAddress, setCenterAddress] = useState('')
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('')

  const [entries, setEntries] = useState<ScheduleEntry[]>([])

  const [history, setHistory] = useState<AdmitCardRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

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
    setLoading(true); setStudent(null); setSubjects([]); setAllSubjects([])
    setEntries([]); setSelectedSemester(''); setAvailableSemesters([])
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

      // Load all subjects for this course
      const { data: subs } = await supabase
        .from('uce_subjects').select('id, name, code, semester')
        .eq('course_id', s.course_id).eq('is_active', true)
        .order('semester', { nullsFirst: false }).order('display_order')
      const subRows = (subs ?? []).map(sub => ({ ...sub, selected: true })) as SubjectRow[]
      setAllSubjects(subRows)

      // Detect unique semesters from subjects (primary source of truth)
      // Fall back to course.total_semesters if subjects have no semester values
      const semNums = Array.from(new Set(subRows.map(r => r.semester).filter((n): n is number => n != null))).sort((a, b) => a - b)
      const courseTotalSems = (s.course as StudentData['course'])?.total_semesters ?? 0

      if (semNums.length > 0) {
        // Subjects have semester assignments — show semester selector
        setAvailableSemesters(semNums)
        // Don't show subjects yet — user must pick a semester first
      } else if (courseTotalSems > 0) {
        // Course has semesters defined but subjects don't have semester values yet
        setAvailableSemesters(Array.from({ length: courseTotalSems }, (_, i) => i + 1))
      } else {
        // No semester structure — show all subjects directly
        setSubjects(subRows)
        setEntries(subRows.map(() => ({ date: '', reporting_time: '09:30', exam_time: '10:00', end_time: '12:00' })))
      }
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  function handleSemesterChange(sem: number | '') {
    setSelectedSemester(sem)
    if (sem === '') { setSubjects([]); setEntries([]); return }
    // Filter subjects for this semester; fall back to all subjects if none are tagged
    const filtered = allSubjects.filter(s => s.semester === Number(sem))
    const list = filtered.length > 0 ? filtered : allSubjects
    setSubjects(list.map(s => ({ ...s, selected: true })))
    setEntries(list.map(() => ({ date: '', reporting_time: '09:30', exam_time: '10:00', end_time: '12:00' })))
  }

  function updateEntry(idx: number, field: keyof ScheduleEntry, value: string) {
    setEntries(p => p.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function buildBlob(
    studentData: Pick<StudentData, 'id'|'registration_no'|'name'|'father_name'|'dob'|'gender'|'photo_url'|'course_id'|'session'|'enrollment_date'> & { course?: { name: string; code: string } | null },
    centerInfo: { name: string; code: string; address: string; semester: string | null },
    sched: AdmitCardSchedule[],
    photoUrl: string | null,
  ) {
    const [settings, logoDataUrl, isoLogoDataUrl] = await Promise.all([
      getAdmitCardSettings(),
      toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      toDataUrl('/ISO LOGOs.png').catch(() => ''),
    ])
    let photoDataUrl = ''
    if (photoUrl) photoDataUrl = await toDataUrl(photoUrl).catch(() => '')

    return buildAdmitCardPdfBlob({
      student: {
        id: studentData.id, registration_no: studentData.registration_no,
        name: studentData.name, father_name: studentData.father_name,
        dob: studentData.dob, gender: studentData.gender, photo_url: studentData.photo_url,
        course_name: studentData.course ? `${studentData.course.name} (${studentData.course.code})` : '—',
        session: studentData.session, enrollment_date: studentData.enrollment_date,
      },
      center: centerInfo,
      schedule: sched, settings, logoDataUrl, isoLogoDataUrl, photoDataUrl,
    })
  }

  async function handleGenerate() {
    if (!student) return
    const selected = subjects.map((sub, i) => ({ sub, entry: entries[i] })).filter(({ sub }) => sub.selected)
    if (selected.length === 0) { toast.error('Select at least one subject'); return }
    if (availableSemesters.length > 0 && selectedSemester === '') { toast.error('Please select a semester'); return }

    setGenerating(true)
    try {
      const schedule: AdmitCardSchedule[] = selected.map(({ sub, entry }) => ({
        subject_id: sub.id, subject_name: sub.name,
        date: entry.date, reporting_time: entry.reporting_time,
        exam_time: entry.exam_time, end_time: entry.end_time || null,
      }))

      const course = student.course as { name: string; code: string } | null
      const semLabel = selectedSemester !== '' ? `Semester ${selectedSemester}` : null

      const blob = await buildBlob(
        { ...student, course },
        { name: centerName, code: centerCode, address: centerAddress, semester: semLabel },
        schedule, student.photo_url,
      )

      await supabase.from('uce_admit_cards').insert({
        student_id: student.id, course_id: student.course_id,
        semester: selectedSemester !== '' ? Number(selectedSemester) : null,
        exam_center_name: centerName || null, exam_center_code: centerCode || null,
        exam_center_address: centerAddress || null, schedule,
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
      const { data: sd } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, gender, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code)')
        .eq('id', record.student_id).single()
      if (!sd) { toast.error('Student not found'); return }

      const sdc = sd as typeof sd & { course?: { name: string; code: string } | null }
      const semLabel = record.semester != null ? `Semester ${record.semester}` : null

      const blob = await buildBlob(
        sdc,
        { name: record.exam_center_name || '', code: record.exam_center_code || '', address: record.exam_center_address || '', semester: semLabel },
        record.schedule, sdc.photo_url,
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Admit-Card-${sdc.registration_no.replace('/', '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error(err); toast.error('Failed to download') }
    finally { setDownloading(null) }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this admit card record? The PDF can still be regenerated from the student.')) return
    setDeleting(id)
    try {
      const { error } = await supabase.from('uce_admit_cards').delete().eq('id', id)
      if (error) throw error
      setHistory(p => p.filter(r => r.id !== id))
      toast.success('Record deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(null) }
  }

  function fmtDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  const hasSemesterSelector = availableSemesters.length > 0

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
          {/* Student info card */}
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

            {/* Semester selector — shown whenever subjects have semesters or course has semesters */}
            {hasSemesterSelector && (
              <div className="mb-4">
                <FormField label="Select Semester" hint="Only subjects of the selected semester will be shown">
                  <select
                    value={selectedSemester}
                    onChange={e => handleSemesterChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className={selectClass}
                  >
                    <option value="">Choose semester…</option>
                    {availableSemesters.map(n => (
                      <option key={n} value={n}>Semester {n}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}

            {/* Subjects list — with manual tick/untick */}
            {subjects.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Subjects & Exam Schedule</h3>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setSubjects(p => p.map(s => ({ ...s, selected: true })))} className="text-red-600 hover:underline">All</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSubjects(p => p.map(s => ({ ...s, selected: false })))} className="text-gray-500 hover:underline">None</button>
                  </div>
                </div>
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

            {hasSemesterSelector && selectedSemester === '' && (
              <p className="text-sm text-gray-400 text-center py-4">Select a semester above to load subjects</p>
            )}
            {hasSemesterSelector && selectedSemester !== '' && subjects.length === 0 && (
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDownloadHistory(rec)}
                      disabled={downloading === rec.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      {downloading === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Download
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(rec.id)}
                        disabled={deleting === rec.id}
                        className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Delete record"
                      >
                        {deleting === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
