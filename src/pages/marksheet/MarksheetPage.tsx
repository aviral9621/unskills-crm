import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ScrollText, Download, Loader2, Settings, History, Trash2, AlertTriangle, Sparkles, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass } from '../../components/FormField'
import { useAuth } from '../../contexts/AuthContext'
import {
  getMarksheetSettings,
  parseGradingScheme,
  resolveGrade,
  marksheetVerifyUrl,
} from '../../lib/marksheetSettings'
import {
  buildMarksheetPdfBlob,
  toDataUrl,
  type MarksheetSubjectRow,
} from '../../lib/pdf/marksheet'

async function buildQrDataUrl(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: '#111827', light: '#ffffff' },
    })
  } catch {
    return ''
  }
}

// Ordered list of certification logos to display at the bottom of the PDF.
const CERT_LOGO_PATHS = [
  '/ISO LOGOs.png',
  '/MSME loogo.png',
  '/Skill India Logo.png',
  '/NSDC logo.png',
  '/Digital India logo.png',
  '/ANSI logo.png',
  '/IAF LOGO.png',
]
async function loadCertLogos(): Promise<string[]> {
  return Promise.all(CERT_LOGO_PATHS.map(p => toDataUrl(encodeURI(p)).catch(() => '')))
}

interface StudentData {
  id: string; registration_no: string; name: string; father_name: string
  dob: string | null; photo_url: string | null
  course_id: string; session: string | null; enrollment_date: string | null
  course?: { name: string; code: string; duration_label: string | null; duration_months: number | null; total_semesters: number | null; is_marksheet_eligible: boolean } | null
  branch?: { name: string; b_code: string | null; code: string | null; address_line1: string | null; district: string | null; state: string | null; pincode: string | null } | null
}

interface SubjectDef {
  id: string; code: string | null; name: string; semester: number | null
  theory_max_marks: number; practical_max_marks: number; display_order: number | null
}

interface MarksheetRecord {
  id: string
  student_id: string
  course_id: string
  serial_no: string | null
  total_obtained: number | null
  total_max: number | null
  percentage: number | null
  grade: string | null
  result: string | null
  issue_date: string | null
  created_at: string
  marks_data: MarksheetMarksData
  student?: { name: string; registration_no: string } | null
  course?: { name: string; code: string } | null
}

interface MarksheetMarksData {
  roll_no: string
  semesters: number[]
  subjects: MarksheetSubjectRow[]
  grading_scheme?: ReturnType<typeof parseGradingScheme>
  notes?: string
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

export default function MarksheetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [query, setQuery] = useState(searchParams.get('student') || '')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [allSubjects, setAllSubjects] = useState<SubjectDef[]>([])
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([])
  const [selectedSemesters, setSelectedSemesters] = useState<Set<number>>(new Set())
  const [rows, setRows] = useState<MarksheetSubjectRow[]>([])
  const [rollNo, setRollNo] = useState('')
  const [issueDate, setIssueDate] = useState(todayISO())
  const [autoFilled, setAutoFilled] = useState<{ matched: number; total: number } | null>(null)

  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [history, setHistory] = useState<MarksheetRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // When non-null, the generate button performs an UPDATE on this existing
  // marksheet record instead of creating a new one. Reset to null via cancelEdit.
  const [editingRecord, setEditingRecord] = useState<MarksheetRecord | null>(null)
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null)

  useEffect(() => { loadHistory() }, [])
  useEffect(() => {
    if (searchParams.get('student')) handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('uce_marksheets')
        .select('id, student_id, course_id, serial_no, total_obtained, total_max, percentage, grade, result, issue_date, created_at, marks_data, student:uce_students(name, registration_no), course:uce_courses(name, code)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50)
      setHistory((data ?? []) as unknown as MarksheetRecord[])
    } catch { /* silent */ }
    finally { setHistoryLoading(false) }
  }

  function resetStudentState() {
    setStudent(null); setAllSubjects([]); setAvailableSemesters([])
    setSelectedSemesters(new Set()); setRows([]); setRollNo(''); setAutoFilled(null)
  }

  function cancelEdit() {
    setEditingRecord(null)
    resetStudentState()
    setIssueDate(todayISO())
  }

  async function handleEditRecord(rec: MarksheetRecord) {
    setLoadingEdit(rec.id)
    try {
      const { data: sd, error } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months, total_semesters, is_marksheet_eligible), branch:uce_branches(name, b_code, code, address_line1, district, state, pincode)')
        .eq('id', rec.student_id).single()

      if (error || !sd) { toast.error('Could not load student for edit'); return }

      const sdc = sd as unknown as StudentData
      setStudent(sdc)

      // Re-fetch the course's subject catalog so max-mark inputs still work
      const { data: subs } = await supabase
        .from('uce_subjects')
        .select('id, code, name, semester, theory_max_marks, practical_max_marks, display_order')
        .eq('course_id', sdc.course_id).eq('is_active', true)
        .order('semester', { nullsFirst: false }).order('display_order')
      const defs = (subs ?? []) as SubjectDef[]
      setAllSubjects(defs)

      const semNums = Array.from(new Set(defs.map(d => d.semester).filter((n): n is number => n != null))).sort((a, b) => a - b)
      setAvailableSemesters(semNums)
      setSelectedSemesters(new Set(rec.marks_data.semesters || semNums))
      setRows(rec.marks_data.subjects || [])
      setRollNo(rec.marks_data.roll_no || '')
      setIssueDate(rec.issue_date || todayISO())
      setEditingRecord(rec)
      setAutoFilled(null)

      // Scroll up so the user sees the editing banner + form
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success(`Editing marksheet ${rec.serial_no || ''}`)
    } catch { toast.error('Failed to open for editing') }
    finally { setLoadingEdit(null) }
  }

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); resetStudentState()
    try {
      const sel = 'id, registration_no, name, father_name, dob, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months, total_semesters, is_marksheet_eligible), branch:uce_branches(name, b_code, code, address_line1, district, state, pincode)'
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

      // Load subjects
      const { data: subs } = await supabase
        .from('uce_subjects')
        .select('id, code, name, semester, theory_max_marks, practical_max_marks, display_order')
        .eq('course_id', s.course_id).eq('is_active', true)
        .order('semester', { nullsFirst: false }).order('display_order')

      const defs = (subs ?? []) as SubjectDef[]
      setAllSubjects(defs)

      const semNums = Array.from(new Set(defs.map(d => d.semester).filter((n): n is number => n != null))).sort((a, b) => a - b)
      const courseTotalSems = s.course?.total_semesters ?? 0
      const sems = semNums.length > 0 ? semNums : (courseTotalSems > 0 ? Array.from({ length: courseTotalSems }, (_, i) => i + 1) : [])
      setAvailableSemesters(sems)
      setSelectedSemesters(new Set(sems))

      // Build rows for all available semesters by default
      const initialRows = buildRowsForSemesters(defs, new Set(sems))
      setRows(initialRows)

      // Auto-populate roll number (user can still override)
      buildNextRollNo().then(setRollNo).catch(() => { /* leave blank */ })

      // Best-effort auto-fill from declared exam results
      await autoFillFromResults(s.id, s.course_id, initialRows)
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  function buildRowsForSemesters(defs: SubjectDef[], sems: Set<number>): MarksheetSubjectRow[] {
    return defs
      .filter(d => d.semester == null || sems.has(d.semester))
      .map(d => ({
        subject_id: d.id,
        code: d.code,
        name: d.name,
        semester: d.semester,
        theory_max: d.theory_max_marks ?? 0,
        theory_obtained: null,
        practical_max: d.practical_max_marks ?? 0,
        practical_obtained: null,
        total: 0,
      }))
  }

  async function autoFillFromResults(studentId: string, courseId: string, baseRows: MarksheetSubjectRow[]) {
    try {
      const { data: results } = await supabase
        .from('uce_exam_results')
        .select('obtained_marks, paper_set:uce_paper_sets!inner(course_id, paper_name, category)')
        .eq('student_id', studentId)
        .eq('is_declared', true)

      if (!results || results.length === 0) { setAutoFilled({ matched: 0, total: baseRows.length }); return }

      type Row = { obtained_marks: number | null; paper_set: { course_id: string | null; paper_name: string | null; category: string | null } | null }
      const scoped = (results as unknown as Row[]).filter(r => r.paper_set?.course_id === courseId)

      let matched = 0
      const updated = baseRows.map(row => {
        const rowCode = (row.code || '').toLowerCase()
        const rowName = (row.name || '').toLowerCase()
        const theoryHit = scoped.find(r => {
          if ((r.paper_set?.category || '').toLowerCase() !== 'theory') return false
          const pn = (r.paper_set?.paper_name || '').toLowerCase()
          return (rowCode && pn.includes(rowCode)) || (rowName && pn.includes(rowName))
        })
        const practicalHit = scoped.find(r => {
          if ((r.paper_set?.category || '').toLowerCase() !== 'practical') return false
          const pn = (r.paper_set?.paper_name || '').toLowerCase()
          return (rowCode && pn.includes(rowCode)) || (rowName && pn.includes(rowName))
        })
        const next = { ...row }
        if (theoryHit && theoryHit.obtained_marks != null) { next.theory_obtained = Number(theoryHit.obtained_marks); matched++ }
        if (practicalHit && practicalHit.obtained_marks != null) { next.practical_obtained = Number(practicalHit.obtained_marks); matched++ }
        next.total = (next.theory_obtained ?? 0) + (next.practical_obtained ?? 0)
        return next
      })
      setRows(updated)
      setAutoFilled({ matched, total: baseRows.length })
    } catch {
      setAutoFilled({ matched: 0, total: baseRows.length })
    }
  }

  function toggleSemester(sem: number) {
    const next = new Set(selectedSemesters)
    if (next.has(sem)) next.delete(sem); else next.add(sem)
    setSelectedSemesters(next)
    setRows(prev => {
      const rebuilt = buildRowsForSemesters(allSubjects, next)
      // Preserve edits where possible
      const prevMap = new Map(prev.map(r => [r.subject_id, r]))
      return rebuilt.map(r => {
        const old = prevMap.get(r.subject_id)
        if (!old) return r
        const theory_obtained = old.theory_obtained
        const practical_obtained = old.practical_obtained
        const total = (theory_obtained ?? 0) + (practical_obtained ?? 0)
        return { ...r, theory_max: old.theory_max, practical_max: old.practical_max, theory_obtained, practical_obtained, total }
      })
    })
  }

  function toggleAllSemesters() {
    const targetAll = selectedSemesters.size !== availableSemesters.length
    const next = targetAll ? new Set(availableSemesters) : new Set<number>()
    setSelectedSemesters(next)
    setRows(prev => {
      const rebuilt = buildRowsForSemesters(allSubjects, next)
      const prevMap = new Map(prev.map(r => [r.subject_id, r]))
      return rebuilt.map(r => {
        const old = prevMap.get(r.subject_id)
        if (!old) return r
        const theory_obtained = old.theory_obtained
        const practical_obtained = old.practical_obtained
        const total = (theory_obtained ?? 0) + (practical_obtained ?? 0)
        return { ...r, theory_max: old.theory_max, practical_max: old.practical_max, theory_obtained, practical_obtained, total }
      })
    })
  }

  function updateRow(idx: number, patch: Partial<MarksheetSubjectRow>) {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, ...patch }
      // Clamp obtained marks to max and warn the user once per over-entry.
      if (patch.theory_obtained != null && Number(patch.theory_obtained) > (Number(next.theory_max) || 0)) {
        toast.error(`Theory obtained cannot exceed max marks (${next.theory_max})`)
        next.theory_obtained = next.theory_max
      }
      if (patch.practical_obtained != null && Number(patch.practical_obtained) > (Number(next.practical_max) || 0)) {
        toast.error(`Practical obtained cannot exceed max marks (${next.practical_max})`)
        next.practical_obtained = next.practical_max
      }
      next.total = (Number(next.theory_obtained) || 0) + (Number(next.practical_obtained) || 0)
      return next
    }))
  }

  const totals = useMemo(() => {
    let totalObtained = 0, totalMax = 0
    rows.forEach(r => {
      totalObtained += (Number(r.theory_obtained) || 0) + (Number(r.practical_obtained) || 0)
      totalMax += (Number(r.theory_max) || 0) + (Number(r.practical_max) || 0)
    })
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
    return { totalObtained, totalMax, percentage }
  }, [rows])

  async function currentYearMarksheetCount(): Promise<number> {
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('uce_marksheets')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
      .lt('created_at', `${year + 1}-01-01`)
    return count ?? 0
  }

  async function buildSerialNo(): Promise<string> {
    const year = new Date().getFullYear()
    const n = (await currentYearMarksheetCount()) + 1
    return `UCE/MS/${year}/${String(n).padStart(4, '0')}`
  }

  /** Roll number format: YYYY + 3-digit sequence (e.g. 2026001, 2026272). */
  async function buildNextRollNo(): Promise<string> {
    const year = new Date().getFullYear()
    const n = (await currentYearMarksheetCount()) + 1
    return `${year}${String(n).padStart(3, '0')}`
  }

  async function handleGenerate() {
    if (!student) return
    if (!rollNo.trim()) { toast.error('Please enter a Roll No'); return }
    if (selectedSemesters.size === 0) { toast.error('Please select at least one semester'); return }
    if (rows.length === 0) { toast.error('No subjects available for the selected semesters'); return }

    setGenerating(true)
    try {
      const [settings, logoDataUrl, certLogos] = await Promise.all([
        getMarksheetSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
        loadCertLogos(),
      ])
      const photoDataUrl = student.photo_url ? await toDataUrl(student.photo_url).catch(() => '') : ''

      const bands = parseGradingScheme(settings.grading_scheme_json)
      const { grade, isPass } = resolveGrade(totals.percentage, bands)
      const resultStr: 'pass' | 'fail' = isPass ? 'pass' : 'fail'

      // When editing, preserve the original serial so the QR + existing
      // verification links keep resolving to the same record.
      const serial_no = editingRecord?.serial_no || (await buildSerialNo())
      const qrDataUrl = await buildQrDataUrl(marksheetVerifyUrl(settings.verify_base_url, serial_no))
      const br = student.branch
      const centerCode = br?.b_code || br?.code || ''
      const centerAddress = br ? `${br.address_line1 || ''}${br.district ? ', ' + br.district : ''}${br.state ? ', ' + br.state : ''}${br.pincode ? ' - ' + br.pincode : ''}`.replace(/^,\s*/, '') : ''
      const courseDuration = student.course?.duration_label || (student.course?.duration_months ? `${student.course.duration_months} Months` : '')

      const blob = await buildMarksheetPdfBlob({
        student: {
          id: student.id, registration_no: student.registration_no, name: student.name,
          father_name: student.father_name, dob: student.dob, photo_url: student.photo_url,
          course_name: student.course ? `${student.course.name}${student.course.code ? ' (' + student.course.code + ')' : ''}` : '—',
          course_duration: courseDuration,
          session: student.session, enrollment_date: student.enrollment_date,
        },
        center: { name: br?.name || '—', code: centerCode, address: centerAddress || '—' },
        rows,
        roll_no: rollNo,
        issue_date: issueDate,
        serial_no,
        totals,
        finalGrade: grade,
        result: resultStr === 'pass' ? 'Pass' : 'Fail',
        gradingScheme: bands,
        settings,
        logoDataUrl, certLogos, photoDataUrl, qrDataUrl,
      })

      const marksData: MarksheetMarksData = {
        roll_no: rollNo,
        semesters: Array.from(selectedSemesters).sort((a, b) => a - b),
        subjects: rows,
        grading_scheme: bands,
      }

      if (editingRecord) {
        const { error: updateError } = await supabase.from('uce_marksheets')
          .update({
            marks_data: marksData,
            total_obtained: totals.totalObtained,
            total_max: totals.totalMax,
            percentage: Number(totals.percentage.toFixed(2)),
            grade,
            result: resultStr,
            issue_date: issueDate,
          })
          .eq('id', editingRecord.id)
        if (updateError) { console.error(updateError); toast.error(`Update failed: ${updateError.message}`); return }
      } else {
        const { error: insertError } = await supabase.from('uce_marksheets').insert({
          student_id: student.id,
          course_id: student.course_id,
          serial_no,
          marks_data: marksData,
          total_obtained: totals.totalObtained,
          total_max: totals.totalMax,
          percentage: Number(totals.percentage.toFixed(2)),
          grade,
          result: resultStr,
          issue_date: issueDate,
        })
        if (insertError) { console.error(insertError); toast.error(`Save failed: ${insertError.message}`); return }
      }
      const wasEditing = !!editingRecord
      loadHistory()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Marksheet-${student.registration_no.replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(wasEditing ? 'Marksheet updated & re-downloaded!' : 'Marksheet downloaded!')
      if (wasEditing) setEditingRecord(null)
    } catch (err) { console.error(err); toast.error('Failed to generate marksheet') }
    finally { setGenerating(false) }
  }

  async function handleDownloadHistory(rec: MarksheetRecord) {
    setDownloading(rec.id)
    try {
      const { data: sd } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months), branch:uce_branches(name, b_code, code, address_line1, district, state, pincode)')
        .eq('id', rec.student_id).single()
      if (!sd) { toast.error('Student not found'); return }

      const [settings, logoDataUrl, certLogos] = await Promise.all([
        getMarksheetSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
        loadCertLogos(),
      ])
      const sdc = sd as unknown as StudentData
      const photoDataUrl = sdc.photo_url ? await toDataUrl(sdc.photo_url).catch(() => '') : ''
      const qrDataUrl = await buildQrDataUrl(marksheetVerifyUrl(settings.verify_base_url, rec.serial_no || sdc.registration_no))
      const bands = rec.marks_data.grading_scheme ?? parseGradingScheme(settings.grading_scheme_json)
      const br = sdc.branch
      const centerCode = br?.b_code || br?.code || ''
      const centerAddress = br ? `${br.address_line1 || ''}${br.district ? ', ' + br.district : ''}${br.state ? ', ' + br.state : ''}${br.pincode ? ' - ' + br.pincode : ''}`.replace(/^,\s*/, '') : ''
      const courseDuration = sdc.course?.duration_label || (sdc.course?.duration_months ? `${sdc.course.duration_months} Months` : '')

      const blob = await buildMarksheetPdfBlob({
        student: {
          id: sdc.id, registration_no: sdc.registration_no, name: sdc.name,
          father_name: sdc.father_name, dob: sdc.dob, photo_url: sdc.photo_url,
          course_name: sdc.course ? `${sdc.course.name}${sdc.course.code ? ' (' + sdc.course.code + ')' : ''}` : '—',
          course_duration: courseDuration,
          session: sdc.session, enrollment_date: sdc.enrollment_date,
        },
        center: { name: br?.name || '—', code: centerCode, address: centerAddress || '—' },
        rows: rec.marks_data.subjects,
        roll_no: rec.marks_data.roll_no,
        issue_date: rec.issue_date || todayISO(),
        serial_no: rec.serial_no || '',
        totals: { totalObtained: Number(rec.total_obtained) || 0, totalMax: Number(rec.total_max) || 0, percentage: Number(rec.percentage) || 0 },
        finalGrade: rec.grade || '-',
        result: rec.result || '-',
        gradingScheme: bands,
        settings,
        logoDataUrl, certLogos, photoDataUrl, qrDataUrl,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Marksheet-${sdc.registration_no.replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error(err); toast.error('Failed to download') }
    finally { setDownloading(null) }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this marksheet record? The PDF can still be regenerated from the student.')) return
    setDeleting(id)
    try {
      const { error } = await supabase.from('uce_marksheets').update({ is_active: false }).eq('id', id)
      if (error) throw error
      setHistory(p => p.filter(r => r.id !== id))
      toast.success('Record deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(null) }
  }

  function fmtHistoryDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  const eligible = !student || student.course?.is_marksheet_eligible !== false
  const rowsBySemester = useMemo(() => {
    const map = new Map<number, MarksheetSubjectRow[]>()
    rows.forEach(r => {
      const k = r.semester ?? 0
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [rows])

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Marksheet</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Generate student marksheet (Statement of Marks)</p>
        </div>
        <button
          onClick={() => navigate('/admin/marksheets/settings')}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <Settings size={14} /> Settings
        </button>
      </div>

      {editingRecord && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <Pencil size={16} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Editing marksheet <span className="font-mono">{editingRecord.serial_no || '—'}</span>
            </p>
            <p className="text-xs text-amber-800 mt-0.5">Saving will update the existing record and re-download the PDF (same serial & QR).</p>
          </div>
          <button
            onClick={cancelEdit}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-50"
          >
            <X size={14} /> Cancel edit
          </button>
        </div>
      )}

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

      {student && !eligible && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">This course is not marksheet-eligible</p>
            <p className="text-xs text-amber-800 mt-1">Enable <strong>is_marksheet_eligible</strong> on the course in Courses → Edit before generating a marksheet.</p>
          </div>
        </div>
      )}

      {student && eligible && (
        <>
          {/* Student info & Header details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              {student.photo_url
                ? <img src={student.photo_url} className="h-12 w-12 rounded-full object-cover border border-gray-200" />
                : <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-red-600">{student.name.charAt(0)}</span>
                  </div>}
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">{student.name}</p>
                <p className="text-xs font-mono text-gray-400 truncate">
                  {student.registration_no} &middot; {student.course?.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Roll No" hint="Auto-generated as YYYY + sequence (e.g. 2026272). Edit if needed." required>
                <input value={rollNo} onChange={e => setRollNo(e.target.value)} className={inputClass} placeholder="e.g., 2026001" />
              </FormField>
              <FormField label="Date of Issue">
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Session">
                <input value={student.session ?? ''} readOnly className={`${inputClass} bg-gray-50`} />
              </FormField>
            </div>
          </div>

          {/* Semester multi-select */}
          {availableSemesters.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Include Semesters</h3>
                <button type="button" onClick={toggleAllSemesters} className="text-xs text-red-600 hover:underline">
                  {selectedSemesters.size === availableSemesters.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSemesters.map(n => {
                  const on = selectedSemesters.has(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleSemester(n)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${on ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                      Semester {n}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Subjects + marks */}
          {rows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Subjects & Marks</h3>
                {autoFilled && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                    <Sparkles size={11} /> Auto-filled {autoFilled.matched} of {autoFilled.total * 2} cells from declared results
                  </span>
                )}
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium">Subject</th>
                      <th className="py-2 px-2 font-medium">Theory Max</th>
                      <th className="py-2 px-2 font-medium">Theory Obt.</th>
                      <th className="py-2 px-2 font-medium">Pract. Max</th>
                      <th className="py-2 px-2 font-medium">Pract. Obt.</th>
                      <th className="py-2 px-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsBySemester.flatMap(([sem, list]) => {
                      const out: ReactNode[] = []
                      if (sem > 0) {
                        out.push(
                          <tr key={`sem-${sem}`}>
                            <td colSpan={6} className="bg-gray-50 text-gray-700 font-semibold px-2 py-1.5">
                              Semester {sem}
                            </td>
                          </tr>
                        )
                      }
                      list.forEach(r => {
                        const idx = rows.findIndex(x => x.subject_id === r.subject_id)
                        out.push(
                          <tr key={r.subject_id} className="border-b border-gray-100 last:border-b-0">
                            <td className="py-1.5 px-2">
                              <div className="text-gray-900">{r.name}</div>
                              {r.code && <div className="text-[10px] text-gray-400 font-mono">{r.code}</div>}
                            </td>
                            <td className="py-1.5 px-2">
                              <input type="number" value={r.theory_max || ''} onChange={e => updateRow(idx, { theory_max: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20 text-center`} />
                            </td>
                            <td className="py-1.5 px-2">
                              <input type="number" min={0} max={r.theory_max || undefined} value={r.theory_obtained ?? ''} onChange={e => updateRow(idx, { theory_obtained: e.target.value === '' ? null : Number(e.target.value) })} className={`${inputClass} py-1.5 w-20 text-center`} />
                            </td>
                            <td className="py-1.5 px-2">
                              <input type="number" min={0} value={r.practical_max || ''} onChange={e => updateRow(idx, { practical_max: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20 text-center`} />
                            </td>
                            <td className="py-1.5 px-2">
                              <input type="number" min={0} max={r.practical_max || undefined} value={r.practical_obtained ?? ''} onChange={e => updateRow(idx, { practical_obtained: e.target.value === '' ? null : Number(e.target.value) })} className={`${inputClass} py-1.5 w-20 text-center`} />
                            </td>
                            <td className="py-1.5 px-2 text-center font-semibold text-gray-900">{r.total || '—'}</td>
                          </tr>
                        )
                      })
                      return out
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="py-2 px-2 font-semibold text-gray-900">Total</td>
                      <td colSpan={4} className="py-2 px-2 text-right text-gray-500">Max {totals.totalMax} · Percentage {totals.percentage.toFixed(2)}%</td>
                      <td className="py-2 px-2 text-center font-bold text-gray-900">{totals.totalObtained}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || rows.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
          >
            {generating
              ? <Loader2 size={18} className="animate-spin" />
              : editingRecord ? <Pencil size={18} /> : <Download size={18} />}
            {generating
              ? (editingRecord ? 'Updating…' : 'Generating…')
              : editingRecord ? 'Update & Re-Download Marksheet (PDF)' : 'Save & Download Marksheet (PDF)'}
          </button>
        </>
      )}

      {!student && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ScrollText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Search for a student to generate their marksheet</p>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Generated Marksheets</h3>
        </div>
        {historyLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No marksheets generated yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map(rec => {
              const st = rec.student as { name: string; registration_no: string } | null
              const co = rec.course as { name: string; code: string } | null
              return (
                <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{st?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {st?.registration_no} &middot; {co?.name ?? '—'}
                      {rec.grade ? ` · ${rec.grade}` : ''}
                      {rec.percentage != null ? ` · ${Number(rec.percentage).toFixed(2)}%` : ''}
                      &nbsp;&middot;&nbsp;{fmtHistoryDate(rec.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      onClick={() => handleEditRecord(rec)}
                      disabled={loadingEdit === rec.id || editingRecord?.id === rec.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                      title="Edit & re-download"
                    >
                      {loadingEdit === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
                      {editingRecord?.id === rec.id ? 'Editing' : 'Edit'}
                    </button>
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
