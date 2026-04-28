import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Search, Loader2, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import {
  getCertificateSettings,
  listCertificateTemplates,
} from '../../lib/certificateSettings'
import { generateCertificateBlob, type TypingSubjectRow } from '../../lib/pdf/cert-generator'
import { canIssueCertificate } from '../../lib/pdf/certificate-registry'
import { generateQRDataUrl } from '../../lib/pdf/generate-qr'
import { toDataUrl } from '../../lib/pdf/marksheet'
import { formatDateDDMMYYYY } from '../../lib/utils'
import type { CertificateSettings } from '../../types/certificate'

interface StudentRow {
  id: string
  registration_no: string
  name: string
  father_name: string | null
  photo_url: string | null
  course_id: string
  branch_id: string | null
  enrollment_date: string | null
  course?: { id: string; code: string; name: string } | null
  branch?: { id: string; name: string; b_code: string | null; code: string | null; center_logo_url: string | null } | null
}

type Step = 1 | 2 | 3

const PERFORMANCE_OPTIONS = ['Excellent', 'Very Good', 'Good', 'Pass']
const GRADE_OPTIONS = ['A+', 'A', 'B', 'C', 'D', 'F']
const SALUTATION_OPTIONS = ['Mr.', 'Miss', 'Mrs.']
const FATHER_PREFIX_OPTIONS = ['S/o', 'D/o', 'W/o']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function IssueCertificatePage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [settings, setSettings] = useState<CertificateSettings | null>(null)
  // Retained only to satisfy the NOT NULL uce_certificates.template_id FK —
  // rendering is driven by the course → program registry, not template_id.
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null)

  // Step 1
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [student, setStudent] = useState<StudentRow | null>(null)
  const [programName, setProgramName] = useState<string | null>(null)
  const [programSlug, setProgramSlug] = useState<string | null>(null)

  // Step 2 — form fields
  const [salutation, setSalutation] = useState('Mr.')
  const [studentName, setStudentName] = useState('')
  const [fatherPrefix, setFatherPrefix] = useState('S/o')
  const [fatherName, setFatherName] = useState('')
  const [issueDate, setIssueDate] = useState(todayISO())
  const [courseLevel, setCourseLevel] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseName, setCourseName] = useState('')
  const [trainingCenterName, setTrainingCenterName] = useState('')
  const [trainingCenterCode, setTrainingCenterCode] = useState('')
  const [enrollmentNumber, setEnrollmentNumber] = useState('')
  const [performanceText, setPerformanceText] = useState('Excellent')
  const [marksScored, setMarksScored] = useState<number>(0)
  const [grade, setGrade] = useState('A+')
  // Typing-specific — subjects table with speed + marks
  const [typingSubjects, setTypingSubjects] = useState<TypingSubjectRow[]>([
    { subject: 'Hindi Typing', speedWpm: 0, maxMarks: 100, minMarks: 30, obtainedMarks: 0 },
    { subject: 'English Typing', speedWpm: 0, maxMarks: 100, minMarks: 30, obtainedMarks: 0 },
  ])
  const isTyping = programSlug === 'typing'

  // Step 3
  const [qrPreview, setQrPreview] = useState('')
  const [certLogos, setCertLogos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const CERT_LOGO_URLS = [
    '/ISO LOGOs.png', '/MSME loogo.png', '/Skill India Logo.png',
    '/NSDC logo.png', '/Digital India logo.png', '/ANSI logo.png', '/IAF LOGO.png',
  ]

  useEffect(() => {
    Promise.all([getCertificateSettings(), listCertificateTemplates()])
      .then(([s, tpls]) => {
        setSettings(s)
        const horiz = tpls.find(t => t.slug === 'certificate-of-qualification')
        setDefaultTemplateId(horiz?.id ?? tpls[0]?.id ?? null)
      })
      .catch(() => toast.error('Failed to load settings'))
  }, [])

  useEffect(() => {
    if (step === 3 && settings) {
      generateQRDataUrl(`${settings.verification_url_base}/PREVIEW`).then(setQrPreview)
      if (certLogos.length === 0) {
        Promise.all(CERT_LOGO_URLS.map(u => toDataUrl(encodeURI(u)).catch(() => '')))
          .then(logos => setCertLogos(logos.filter(Boolean)))
          .catch(() => { /* non-fatal */ })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, settings])

  async function runStudentSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const sel =
        'id, registration_no, name, father_name, photo_url, course_id, branch_id, enrollment_date, course:uce_courses(id, code, name), branch:uce_branches!uce_students_branch_id_fkey(id, name, b_code, code, center_logo_url)'
      const q = query.trim()
      const rows: StudentRow[] = []
      const { data: byReg } = await supabase
        .from('uce_students')
        .select(sel)
        .ilike('registration_no', `%${q}%`)
        .limit(10)
      const { data: byName } = await supabase
        .from('uce_students')
        .select(sel)
        .ilike('name', `%${q}%`)
        .limit(10)
      const seen = new Set<string>()
      ;[...(byReg ?? []), ...(byName ?? [])].forEach(r => {
        const row = r as unknown as StudentRow
        if (!seen.has(row.id)) {
          seen.add(row.id)
          rows.push(row)
        }
      })
      setStudents(rows)
      if (rows.length === 0) toast.error('No students found')
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function chooseStudent(st: StudentRow) {
    // Guard against unregistered programs before letting staff fill anything in
    const check = await canIssueCertificate(st.course_id, supabase)
    if (!check.canIssue) {
      toast.error(check.reason ?? 'Certificate not available for this course')
      return
    }

    setStudent(st)
    setProgramName(check.programName ?? null)
    setProgramSlug(check.programSlug ?? null)
    setStudentName(st.name)
    setFatherName(st.father_name ?? '')
    setCourseCode(st.course?.code ?? '')
    setCourseName(st.course?.name ?? '')
    setTrainingCenterName(st.branch?.name ?? '')
    setTrainingCenterCode(st.branch?.b_code ?? st.branch?.code ?? '')
    setEnrollmentNumber(st.registration_no)
    setStep(2)
  }

  async function confirmAndIssue() {
    if (!student || !settings) return
    if (!defaultTemplateId) {
      toast.error('Certificate templates not seeded — contact admin')
      return
    }
    setSubmitting(true)
    try {
      const centerCode = trainingCenterCode || student.branch?.b_code || student.branch?.code || ''
      if (!centerCode) throw new Error('Training center code missing')

      const { data: numData, error: numErr } = await supabase.rpc('generate_certificate_number', {
        p_center_code: centerCode,
      })
      if (numErr) throw numErr
      const certNumber = numData as string

      // Point QR to the public certificate-verification route on the website,
      // not just the domain root — otherwise scans land on the homepage.
      const base = (settings.verification_url_base || '').replace(/\/+$/, '')
      const qrTarget = `${base}/verify/certificate/${encodeURIComponent(certNumber)}`
      const qrDataUrl = await generateQRDataUrl(qrTarget)
      const formattedDate = formatDateDDMMYYYY(issueDate)

      const insertRow = {
        certificate_number: certNumber,
        student_id: student.id,
        template_id: defaultTemplateId,
        course_id: student.course_id,
        branch_id: student.branch_id,
        salutation,
        student_name: studentName,
        father_prefix: fatherPrefix,
        father_name: fatherName,
        student_photo_url: student.photo_url,
        course_code: courseCode,
        course_name: courseName,
        course_level: courseLevel || null,
        training_center_name: trainingCenterName,
        training_center_code: centerCode,
        enrollment_number: enrollmentNumber,
        performance_text: performanceText,
        marks_scored: marksScored,
        grade,
        typing_subjects: isTyping ? typingSubjects : null,
        typing_grade: isTyping ? grade : null,
        qr_code_data_url: qrDataUrl,
        qr_target_url: qrTarget,
        issue_date: issueDate,
        issued_by: user?.id ?? null,
        status: 'active' as const,
      }

      const { data: inserted, error: insErr } = await supabase
        .from('uce_certificates')
        .insert(insertRow)
        .select('id')
        .single()
      if (insErr) throw insErr

      const blob = await generateCertificateBlob(
        student.course_id,
        {
          settings,
          certificateNumber: certNumber,
          enrollmentNumber: enrollmentNumber || student.registration_no,
          issueDate: formattedDate,
          qrCodeDataUrl: qrDataUrl,
          salutation,
          studentName,
          fatherPrefix,
          fatherName,
          studentPhotoUrl: student.photo_url,
          courseCode,
          courseName,
          trainingCenterName,
          trainingCenterCode: centerCode,
          performanceText,
          percentage: marksScored,
          grade,
          trainingCenterLogoUrl: student.branch?.center_logo_url ?? null,
          certificationLogoUrls: certLogos,
          typingSubjects: isTyping ? typingSubjects : undefined,
        },
        supabase,
      )

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Certificate-${certNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Issued ${certNumber}`)
      navigate(`/admin/certificates/${inserted.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to issue')
    } finally {
      setSubmitting(false)
    }
  }

  if (profile && !['super_admin', 'branch_admin'].includes(profile.role)) {
    return <div className="p-6 text-sm text-gray-500">Not authorised.</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/certificates')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold font-heading">Issue Certificate</h1>
        <span className="ml-auto text-xs text-gray-500">Step {step} of 3</span>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          <p className="text-sm font-medium text-gray-700">Search for the student</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void runStudentSearch() }}
                placeholder="Registration number or name"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            <button
              onClick={() => void runStudentSearch()}
              disabled={searching}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => void chooseStudent(s)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
              >
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {s.registration_no} · {s.course?.code} · {s.branch?.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && student && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Fill the certificate fields</p>
            {programName ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                {programName}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Salutation">
              <select value={salutation} onChange={e => setSalutation(e.target.value)} className={selectClass}>
                {SALUTATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Student Name" className="sm:col-span-2">
              <input value={studentName} onChange={e => setStudentName(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Father Prefix">
              <select value={fatherPrefix} onChange={e => setFatherPrefix(e.target.value)} className={selectClass}>
                {FATHER_PREFIX_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Father Name" className="sm:col-span-2">
              <input value={fatherName} onChange={e => setFatherName(e.target.value)} className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Course Code">
              <input value={courseCode} onChange={e => setCourseCode(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Course Name" className="sm:col-span-2">
              <input value={courseName} onChange={e => setCourseName(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Course Level" hint="optional">
              <input value={courseLevel} onChange={e => setCourseLevel(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Training Center" className="sm:col-span-2">
              <input value={trainingCenterName} onChange={e => setTrainingCenterName(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Enrollment No.">
              <input value={enrollmentNumber} onChange={e => setEnrollmentNumber(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Center Code">
              <input value={trainingCenterCode} onChange={e => setTrainingCenterCode(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Performance">
              <select value={performanceText} onChange={e => setPerformanceText(e.target.value)} className={selectClass}>
                {PERFORMANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Marks Scored">
              <input type="number" value={marksScored} onChange={e => setMarksScored(Number(e.target.value))} className={inputClass} />
            </FormField>
            <FormField label="Grade">
              <select value={grade} onChange={e => setGrade(e.target.value)} className={selectClass}>
                {GRADE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Issue Date">
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputClass} />
          </FormField>

          {isTyping && (
            <div className="space-y-2 border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Typing Subjects</p>
                <button
                  type="button"
                  onClick={() => setTypingSubjects([
                    ...typingSubjects,
                    { subject: '', speedWpm: 0, maxMarks: 100, minMarks: 30, obtainedMarks: 0 },
                  ])}
                  className="text-xs text-red-600 hover:underline"
                >
                  + Add Subject
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Subject</th>
                      <th className="px-2 py-1 text-center font-medium w-20">Speed (WPM)</th>
                      <th className="px-2 py-1 text-center font-medium w-20">Max</th>
                      <th className="px-2 py-1 text-center font-medium w-20">Min</th>
                      <th className="px-2 py-1 text-center font-medium w-20">Obtained</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {typingSubjects.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-1">
                          <input
                            value={row.subject}
                            onChange={e => {
                              const next = [...typingSubjects]
                              next[i] = { ...next[i], subject: e.target.value }
                              setTypingSubjects(next)
                            }}
                            placeholder="e.g., Hindi Typing"
                            className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </td>
                        {(['speedWpm', 'maxMarks', 'minMarks', 'obtainedMarks'] as const).map(k => (
                          <td key={k} className="p-1">
                            <input
                              type="number"
                              value={row[k]}
                              onChange={e => {
                                const next = [...typingSubjects]
                                next[i] = { ...next[i], [k]: Number(e.target.value) }
                                setTypingSubjects(next)
                              }}
                              className="w-full px-2 py-1 text-xs text-center rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-red-400"
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center">
                          {typingSubjects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setTypingSubjects(typingSubjects.filter((_, j) => j !== i))}
                              className="text-gray-400 hover:text-red-600 text-xs"
                              title="Remove row"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-500">
                These marks render as a table on the typing certificate. "Marks Scored" above is ignored for typing.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-red-600">Back</button>
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              Preview <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && student && settings && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          <p className="text-sm font-medium text-gray-700">Preview & confirm</p>
          <StepThreePreview
            settings={settings}
            student={student}
            enrollmentNumber={enrollmentNumber}
            salutation={salutation}
            studentName={studentName}
            fatherPrefix={fatherPrefix}
            fatherName={fatherName}
            issueDate={issueDate}
            courseCode={courseCode}
            courseName={courseName}
            trainingCenterName={trainingCenterName}
            trainingCenterCode={trainingCenterCode}
            performanceText={performanceText}
            marksScored={marksScored}
            grade={grade}
            qrPreview={qrPreview}
            certLogos={certLogos}
            typingSubjects={isTyping ? typingSubjects : undefined}
          />
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-red-600">
              Back to Edit
            </button>
            <button
              onClick={() => void confirmAndIssue()}
              disabled={submitting}
              className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Confirm &amp; Issue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepThreePreview({
  settings, student, enrollmentNumber,
  salutation, studentName, fatherPrefix, fatherName, issueDate,
  courseCode, courseName, trainingCenterName, trainingCenterCode, performanceText, marksScored, grade,
  qrPreview, certLogos, typingSubjects,
}: {
  settings: CertificateSettings
  student: StudentRow
  enrollmentNumber: string
  salutation: string; studentName: string; fatherPrefix: string; fatherName: string; issueDate: string
  courseCode: string; courseName: string; trainingCenterName: string; trainingCenterCode: string
  performanceText: string
  marksScored: number; grade: string; qrPreview: string; certLogos: string[]
  typingSubjects?: TypingSubjectRow[]
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const blob = await generateCertificateBlob(
          student.course_id,
          {
            settings, certificateNumber: 'PREVIEW',
            enrollmentNumber: enrollmentNumber || student.registration_no,
            issueDate: formatDateDDMMYYYY(issueDate), qrCodeDataUrl: qrPreview,
            salutation, studentName, fatherPrefix, fatherName,
            studentPhotoUrl: student.photo_url, courseCode, courseName,
            trainingCenterName,
            trainingCenterCode,
            performanceText, percentage: marksScored, grade,
            trainingCenterLogoUrl: student.branch?.center_logo_url ?? null,
            certificationLogoUrls: certLogos,
            typingSubjects,
          },
          supabase,
        )
        if (cancelled) return
        const newUrl = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = newUrl
        setUrl(newUrl)
        setErr(null)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Preview failed')
      }
    })()
    return () => {
      cancelled = true
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
      {err ? (
        <div className="h-full flex items-center justify-center text-sm text-red-600 p-4 text-center bg-gray-50">{err}</div>
      ) : url ? (
        <iframe src={`${url}#toolbar=0&navpanes=0&view=FitH`} title="Preview" style={{ width: '100%', height: '100%', border: 'none' }} />
      ) : (
        <div className="h-full flex items-center justify-center bg-gray-50 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin mr-2" /> Generating preview…
        </div>
      )}
    </div>
  )
}
