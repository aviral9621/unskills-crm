import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ScrollText, Download, Loader2, Settings, Trash2, AlertTriangle, Sparkles, Pencil, X, Eye, Filter } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass, selectClass } from '../../components/FormField'
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
import { autoIssueCertificateForMarksheet } from '../../lib/certificate/autoIssue'
import MarksheetHTMLPreview, { type MarksheetPreviewData } from '../../components/MarksheetHTMLPreview'

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
  branch?: { name: string; b_code: string | null; code: string | null; address_line1: string | null; district: string | null; state: string | null; pincode: string | null; category: string | null; center_logo_url: string | null } | null
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
  is_final: boolean
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

type Tab = 'generate' | 'records'

export default function MarksheetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [activeTab, setActiveTab] = useState<Tab>('generate')

  // ── Generate tab state ──────────────────────────────────────────────────
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
  const [editingRecord, setEditingRecord] = useState<MarksheetRecord | null>(null)
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null)

  // ── Records tab state ───────────────────────────────────────────────────
  const [history, setHistory] = useState<MarksheetRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [filterCourse, setFilterCourse] = useState('')
  const [filterSemester, setFilterSemester] = useState('')
  const [filterName, setFilterName] = useState('')

  // ── Preview state ───────────────────────────────────────────────────────
  const [previewData, setPreviewData] = useState<MarksheetPreviewData | null>(null)
  const [previewRec, setPreviewRec] = useState<MarksheetRecord | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const [previewDownloading, setPreviewDownloading] = useState(false)

  useEffect(() => { loadHistory() }, [])
  useEffect(() => {
    if (searchParams.get('student')) handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      let q = supabase
        .from('uce_marksheets')
        .select('id, student_id, course_id, serial_no, total_obtained, total_max, percentage, grade, result, issue_date, created_at, is_final, marks_data, student:uce_students!inner(name, registration_no, branch_id), course:uce_courses(name, code)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (!isSuperAdmin && (profile as { branch_id?: string })?.branch_id) {
        q = q.eq('uce_students.branch_id', (profile as { branch_id?: string }).branch_id!)
      }
      const { data } = await q
      setHistory((data ?? []) as unknown as MarksheetRecord[])
    } catch { /* silent */ }
    finally { setHistoryLoading(false) }
  }

  // ── Derived filters for Records tab ────────────────────────────────────
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>()
    history.forEach(r => {
      if (r.course_id && r.course?.name) map.set(r.course_id, r.course.name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [history])

  const filteredHistory = useMemo(() => {
    return history.filter(rec => {
      const st = rec.student as { name: string; registration_no: string } | null
      if (filterCourse && rec.course_id !== filterCourse) return false
      if (filterSemester) {
        const sems: number[] = rec.marks_data?.semesters ?? []
        if (!sems.includes(Number(filterSemester))) return false
      }
      if (filterName) {
        const q = filterName.toLowerCase()
        const name = (st?.name || '').toLowerCase()
        const reg = (st?.registration_no || '').toLowerCase()
        if (!name.includes(q) && !reg.includes(q)) return false
      }
      return true
    })
  }, [history, filterCourse, filterSemester, filterName])

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
        .select('id, registration_no, name, father_name, dob, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months, total_semesters, is_marksheet_eligible), branch:uce_branches!uce_students_branch_id_fkey(name, b_code, code, address_line1, district, state, pincode, category, center_logo_url)')
        .eq('id', rec.student_id).single()

      if (error || !sd) { toast.error('Could not load student for edit'); return }

      const sdc = sd as unknown as StudentData
      setStudent(sdc)

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

      setActiveTab('generate')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success(`Editing marksheet ${rec.serial_no || ''}`)
    } catch { toast.error('Failed to open for editing') }
    finally { setLoadingEdit(null) }
  }

  async function openPreview(rec: MarksheetRecord) {
    setPreviewLoading(rec.id)
    try {
      const { data: sd } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, photo_url, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months), branch:uce_branches!uce_students_branch_id_fkey(name, b_code, code, address_line1, district, state, pincode)')
        .eq('id', rec.student_id).single()
      if (!sd) { toast.error('Student not found'); return }

      const [settings, logoDataUrl] = await Promise.all([
        getMarksheetSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      ])

      const sdc = sd as unknown as StudentData
      const br = sdc.branch
      const centerAddress = br
        ? [br.address_line1, br.district, br.state, br.pincode ? `- ${br.pincode}` : null].filter(Boolean).join(', ')
        : ''

      const [photoDataUrl, signatureDataUrl, qrDataUrl] = await Promise.all([
        sdc.photo_url ? toDataUrl(sdc.photo_url).catch(() => '') : Promise.resolve(''),
        settings.left_signature_url ? toDataUrl(settings.left_signature_url).catch(() => '') : Promise.resolve(''),
        buildQrDataUrl(marksheetVerifyUrl(settings.verify_base_url, rec.serial_no || '')),
      ])

      const bands = rec.marks_data.grading_scheme ?? parseGradingScheme(settings.grading_scheme_json)
      const courseDuration = sdc.course?.duration_label || (sdc.course?.duration_months ? `${sdc.course.duration_months} Months` : '—')
      const courseFull = sdc.course ? `${sdc.course.name}${sdc.course.code ? ` (${sdc.course.code})` : ''}` : '—'

      setPreviewRec(rec)
      setPreviewData({
        serial_no: rec.serial_no || '',
        issue_date: rec.issue_date,
        grade: rec.grade,
        result: rec.result,
        percentage: rec.percentage,
        total_obtained: rec.total_obtained,
        total_max: rec.total_max,
        is_final: rec.is_final,
        roll_no: rec.marks_data.roll_no,
        subjects: rec.marks_data.subjects,
        grading_scheme: bands,
        session: sdc.session,
        student_name: sdc.name,
        registration_no: sdc.registration_no,
        father_name: sdc.father_name,
        enrollment_date: sdc.enrollment_date,
        center_name: br?.name || '—',
        center_code: br?.b_code || br?.code || '—',
        center_address: centerAddress || '—',
        course_name: courseFull,
        course_duration: courseDuration,
        signer_name: settings.left_signer_name,
        signer_title: settings.left_signer_title,
        signer_org: settings.left_signer_org,
        signature_url: signatureDataUrl || null,
        footer_address: settings.footer_address,
        website: settings.website,
        email: settings.email,
        notes: settings.notes,
        qrDataUrl,
        logoDataUrl,
        photoDataUrl,
      })
    } catch (err) { console.error(err); toast.error('Failed to load preview') }
    finally { setPreviewLoading(null) }
  }

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); resetStudentState()
    try {
      const sel = 'id, registration_no, name, father_name, dob, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months, total_semesters, is_marksheet_eligible), branch:uce_branches!uce_students_branch_id_fkey(name, b_code, code, address_line1, district, state, pincode, category, center_logo_url)'
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

      const initialRows = buildRowsForSemesters(defs, new Set(sems))
      setRows(initialRows)

      buildNextRollNo().then(setRollNo).catch(() => { /* leave blank */ })
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

  const isFinalMarksheet = useMemo(() => {
    if (!student) return false
    const totalSems = student.course?.total_semesters ?? 1
    if (totalSems <= 0) return true
    return Array.from({ length: totalSems }, (_, i) => i + 1).every(n => selectedSemesters.has(n))
  }, [student, selectedSemesters])

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

    const totalSems = student.course?.total_semesters ?? 1
    const is_final = totalSems <= 0 || Array.from({ length: totalSems }, (_, i) => i + 1).every(n => selectedSemesters.has(n))

    setGenerating(true)
    try {
      const br = student.branch
      const centerCode = br?.b_code || br?.code || ''
      const centerAddress = br ? `${br.address_line1 || ''}${br.district ? ', ' + br.district : ''}${br.state ? ', ' + br.state : ''}${br.pincode ? ' - ' + br.pincode : ''}`.replace(/^,\s*/, '') : ''
      const courseDuration = student.course?.duration_label || (student.course?.duration_months ? `${student.course.duration_months} Months` : '')

      const bands = parseGradingScheme((await getMarksheetSettings()).grading_scheme_json)
      const { grade, isPass } = resolveGrade(totals.percentage, bands)
      const resultStr: 'pass' | 'fail' = isPass ? 'pass' : 'fail'

      const serial_no = editingRecord?.serial_no || (await buildSerialNo())

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
            is_final,
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
          is_final,
        })
        if (insertError) { console.error(insertError); toast.error(`Save failed: ${insertError.message}`); return }

        if (is_final) {
          const autoCert = await autoIssueCertificateForMarksheet({
            studentId: student.id,
            courseId: student.course_id,
            grade,
            result: resultStr,
            marksScored: Number(totals.percentage.toFixed(0)),
            issuedBy: user?.id ?? null,
            supabase,
          })
          if (autoCert.ok && !autoCert.skipped) {
            toast.success(`Certificate auto-issued: ${autoCert.certificateNumber}`)
          } else if (autoCert.skipped === 'already_exists') {
            // silent
          } else if (autoCert.reason) {
            console.warn('[auto-cert]', autoCert.reason)
          }
        }
      }

      loadHistory()

      if (is_final || editingRecord) {
        const [settings, logoDataUrl, certLogos] = await Promise.all([
          getMarksheetSettings(),
          toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
          loadCertLogos(),
        ])
        const photoDataUrl = student.photo_url ? await toDataUrl(student.photo_url).catch(() => '') : ''
        const branchLogoDataUrl = br?.center_logo_url ? await toDataUrl(br.center_logo_url).catch(() => '') : ''
        const qrDataUrl = await buildQrDataUrl(marksheetVerifyUrl(settings.verify_base_url, serial_no))

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
          branch_category: br?.category ?? undefined,
          branchLogoDataUrl,
        })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Marksheet-${student.registration_no.replace(/\//g, '-')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(editingRecord ? 'Marksheet updated & re-downloaded!' : 'Marksheet saved & downloaded!')
        if (editingRecord) setEditingRecord(null)
      } else {
        toast.success('Semester marks saved. Generate final marksheet when all semesters are complete to download the PDF.')
      }
    } catch (err) { console.error(err); toast.error('Failed to generate marksheet') }
    finally { setGenerating(false) }
  }

  async function handleDownloadHistory(rec: MarksheetRecord) {
    setDownloading(rec.id)
    try {
      const { data: sd } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, photo_url, course_id, session, enrollment_date, course:uce_courses(name, code, duration_label, duration_months), branch:uce_branches!uce_students_branch_id_fkey(name, b_code, code, address_line1, district, state, pincode, category, center_logo_url)')
        .eq('id', rec.student_id).single()
      if (!sd) { toast.error('Student not found'); return }

      const [settings, logoDataUrl, certLogos] = await Promise.all([
        getMarksheetSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
        loadCertLogos(),
      ])
      const sdc = sd as unknown as StudentData
      const photoDataUrl = sdc.photo_url ? await toDataUrl(sdc.photo_url).catch(() => '') : ''
      const branchLogoDataUrl = sdc.branch?.center_logo_url ? await toDataUrl(sdc.branch.center_logo_url).catch(() => '') : ''
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
        branch_category: br?.category ?? undefined,
        branchLogoDataUrl,
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
      if (previewRec?.id === id) { setPreviewData(null); setPreviewRec(null) }
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
    <>
      {/* Preview overlay */}
      {previewData && (
        <MarksheetHTMLPreview
          data={previewData}
          onClose={() => { setPreviewData(null); setPreviewRec(null) }}
          onDownload={previewRec?.is_final ? async () => {
            if (!previewRec) return
            setPreviewDownloading(true)
            try { await handleDownloadHistory(previewRec) }
            finally { setPreviewDownloading(false) }
          } : undefined}
          downloading={previewDownloading}
        />
      )}

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

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['generate', 'Generate'], ['records', 'Records']] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
              {tab === 'records' && history.length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'records' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>
                  {history.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Generate tab ─────────────────────────────────────────────── */}
        {activeTab === 'generate' && (
          <>
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
                    <FormField label="Roll No" hint="Auto-generated as YYYY + sequence. Edit if needed." required>
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

                {!isFinalMarksheet && !editingRecord && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>Only Semester 1 is selected — marks will be <strong>saved but not downloaded</strong>. Select all semesters to generate the final downloadable marksheet.</span>
                  </div>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={generating || rows.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
                >
                  {generating
                    ? <Loader2 size={18} className="animate-spin" />
                    : editingRecord ? <Pencil size={18} /> : (isFinalMarksheet ? <Download size={18} /> : <ScrollText size={18} />)}
                  {generating
                    ? (editingRecord ? 'Updating…' : 'Saving…')
                    : editingRecord ? 'Update & Re-Download Marksheet (PDF)'
                    : isFinalMarksheet ? 'Save & Download Marksheet (PDF)' : 'Save Semester Marks (no PDF)'}
                </button>
              </>
            )}

            {!student && !loading && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <ScrollText size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">Search for a student to generate their marksheet</p>
              </div>
            )}
          </>
        )}

        {/* ── Records tab ──────────────────────────────────────────────── */}
        {activeTab === 'records' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={selectClass}>
                    <option value="">All courses</option>
                    {uniqueCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                  <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} className={selectClass}>
                    <option value="">All semesters</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Semester {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Search student</label>
                  <input
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    placeholder="Name or reg. number"
                    className={inputClass}
                  />
                </div>
              </div>
              {(filterCourse || filterSemester || filterName) && (
                <button
                  onClick={() => { setFilterCourse(''); setFilterSemester(''); setFilterName('') }}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Marksheets</h3>
                <span className="text-xs text-gray-400">{filteredHistory.length} of {history.length}</span>
              </div>
              {historyLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
              ) : filteredHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No marksheets found</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredHistory.map(rec => {
                    const st = rec.student as { name: string; registration_no: string } | null
                    const co = rec.course as { name: string; code: string } | null
                    const isLoadingPreview = previewLoading === rec.id
                    return (
                      <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 sm:gap-3">
                        <button
                          onClick={() => openPreview(rec)}
                          disabled={isLoadingPreview}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 truncate hover:text-red-700">{st?.name ?? '—'}</p>
                            {rec.is_final
                              ? <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Final</span>
                              : <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Partial</span>}
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {st?.registration_no} &middot; {co?.name ?? '—'}
                            {rec.grade ? ` · ${rec.grade}` : ''}
                            {rec.percentage != null ? ` · ${Number(rec.percentage).toFixed(2)}%` : ''}
                            &nbsp;&middot;&nbsp;{fmtHistoryDate(rec.created_at)}
                          </p>
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <button
                            onClick={() => openPreview(rec)}
                            disabled={isLoadingPreview}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                          >
                            {isLoadingPreview ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                            View
                          </button>
                          <button
                            onClick={() => handleEditRecord(rec)}
                            disabled={loadingEdit === rec.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                          >
                            {loadingEdit === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
                            Edit
                          </button>
                          {rec.is_final && (
                            <button
                              onClick={() => handleDownloadHistory(rec)}
                              disabled={downloading === rec.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              {downloading === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              PDF
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDelete(rec.id)}
                              disabled={deleting === rec.id}
                              className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
          </>
        )}
      </div>
    </>
  )
}
