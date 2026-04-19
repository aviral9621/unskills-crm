import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PDFViewer } from '@react-pdf/renderer'
import { ArrowLeft, ArrowRight, Search, Loader2, Check, Plus, Trash2, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import {
  getCertificateSettings,
  listCertificateTemplates,
  listCourseMappings,
} from '../../lib/certificateSettings'
import {
  CertificateOfQualification,
  buildCertificateOfQualificationBlob,
} from '../../lib/pdf/certificate-qualification'
import {
  ComputerBasedTypingCertificate,
  buildComputerBasedTypingBlob,
} from '../../lib/pdf/certificate-typing'
import { generateQRDataUrl } from '../../lib/pdf/generate-qr'
import { toDataUrl } from '../../lib/pdf/marksheet'
import { formatDateDDMMYYYY } from '../../lib/utils'
import type {
  CertificateSettings,
  CertificateTemplate,
  CourseCertificateMapping,
  TypingSubject,
} from '../../types/certificate'

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

type Step = 1 | 2 | 3 | 4

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
  const [templates, setTemplates] = useState<CertificateTemplate[]>([])

  // Step 1
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [student, setStudent] = useState<StudentRow | null>(null)

  // Step 2
  const [mappings, setMappings] = useState<CourseCertificateMapping[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)

  // Step 3 shared
  const [salutation, setSalutation] = useState('Mr.')
  const [studentName, setStudentName] = useState('')
  const [fatherPrefix, setFatherPrefix] = useState('S/o')
  const [fatherName, setFatherName] = useState('')
  const [issueDate, setIssueDate] = useState(todayISO())

  // Horizontal-only
  const [courseLevel, setCourseLevel] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseName, setCourseName] = useState('')
  const [trainingCenterName, setTrainingCenterName] = useState('')
  const [performanceText, setPerformanceText] = useState('Excellent')
  const [marksScored, setMarksScored] = useState<number>(0)
  const [grade, setGrade] = useState('A+')

  // Vertical-only
  const [enrollmentNumber, setEnrollmentNumber] = useState('')
  const [trainingCenterCode, setTrainingCenterCode] = useState('')

  // Shared typing fields (horizontal uses if mapping.show_typing_fields)
  const [typingSubjects, setTypingSubjects] = useState<TypingSubject[]>([
    { name: 'HINDI TYPING', speed: 39, max: 100, min: 30, obtained: 85 },
    { name: 'ENGLISH TYPING', speed: 41, max: 100, min: 30, obtained: 85 },
  ])

  // Step 4
  const [qrPreview, setQrPreview] = useState('')
  const [certLogos, setCertLogos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const CERT_LOGO_URLS = [
    '/ISO LOGOs.png', '/MSME loogo.png', '/Skill India Logo.png',
    '/NSDC logo.png', '/Digital India logo.png', '/ANSI logo.png', '/IAF LOGO.png',
  ]

  useEffect(() => {
    Promise.all([getCertificateSettings(), listCertificateTemplates()])
      .then(([s, t]) => {
        setSettings(s)
        setTemplates(t)
      })
      .catch(() => toast.error('Failed to load settings'))
  }, [])

  useEffect(() => {
    if (step === 4 && settings) {
      generateQRDataUrl(`${settings.verification_url_base}/PREVIEW`).then(setQrPreview)
      if (certLogos.length === 0) {
        Promise.all(CERT_LOGO_URLS.map(u => toDataUrl(encodeURI(u)).catch(() => '')))
          .then(logos => setCertLogos(logos.filter(Boolean)))
          .catch(() => { /* non-fatal */ })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, settings])

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) ?? null,
    [templates, templateId],
  )
  const selectedMapping = useMemo(
    () => mappings.find(m => m.template_id === templateId) ?? null,
    [mappings, templateId],
  )

  async function runStudentSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const sel =
        'id, registration_no, name, father_name, photo_url, course_id, branch_id, enrollment_date, course:uce_courses(id, code, name), branch:uce_branches(id, name, b_code, code, center_logo_url)'
      const q = query.trim()
      let rows: StudentRow[] = []
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
    setStudent(st)
    setStudentName(st.name)
    setFatherName(st.father_name ?? '')
    setCourseCode(st.course?.code ?? '')
    setCourseName(st.course?.name ?? '')
    setTrainingCenterName(st.branch?.name ?? '')
    setTrainingCenterCode(st.branch?.b_code ?? st.branch?.code ?? '')
    setEnrollmentNumber(st.registration_no)

    // Load mappings for this course
    try {
      const maps = await listCourseMappings(st.course_id)
      setMappings(maps)
      const def = maps.find(m => m.is_default)
      setTemplateId(def?.template_id ?? maps[0]?.template_id ?? null)
      setStep(2)
    } catch {
      toast.error('Failed to load course mapping')
    }
  }

  function moveTypingRow(idx: number, patch: Partial<TypingSubject>) {
    setTypingSubjects(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function addTypingRow() {
    if (typingSubjects.length >= 5) return
    setTypingSubjects(prev => [...prev, { name: '', speed: 0, max: 100, min: 30, obtained: 0 }])
  }
  function removeTypingRow(idx: number) {
    setTypingSubjects(prev => prev.filter((_, i) => i !== idx))
  }

  async function confirmAndIssue() {
    if (!student || !settings || !selectedTemplate) return
    setSubmitting(true)
    try {
      const centerCode = trainingCenterCode || student.branch?.b_code || student.branch?.code || ''
      if (!centerCode) throw new Error('Training center code missing')

      const { data: numData, error: numErr } = await supabase.rpc('generate_certificate_number', {
        p_center_code: centerCode,
      })
      if (numErr) throw numErr
      const certNumber = numData as string

      const qrTarget = `${settings.verification_url_base}/${certNumber}`
      const qrDataUrl = await generateQRDataUrl(qrTarget)
      const formattedDate = formatDateDDMMYYYY(issueDate)

      const isHorizontal = selectedTemplate.slug === 'certificate-of-qualification'
      const showTyping = !!selectedMapping?.show_typing_fields
      const typingPayload = isHorizontal
        ? showTyping
          ? typingSubjects
          : null
        : typingSubjects

      const insertRow = {
        certificate_number: certNumber,
        student_id: student.id,
        template_id: selectedTemplate.id,
        course_id: student.course_id,
        branch_id: student.branch_id,
        salutation,
        student_name: studentName,
        father_prefix: fatherPrefix,
        father_name: fatherName,
        student_photo_url: student.photo_url,
        course_code: courseCode,
        course_name: courseName,
        course_level: isHorizontal ? courseLevel : null,
        training_center_name: trainingCenterName,
        training_center_code: centerCode,
        enrollment_number: enrollmentNumber,
        performance_text: isHorizontal ? performanceText : null,
        marks_scored: isHorizontal ? marksScored : null,
        grade: isHorizontal ? grade : null,
        typing_subjects: typingPayload,
        typing_grade: isHorizontal ? null : grade,
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

      // Build + download PDF
      let blob: Blob
      if (isHorizontal) {
        blob = await buildCertificateOfQualificationBlob({
          settings,
          certificateNumber: certNumber,
          issueDate: formattedDate,
          qrCodeDataUrl: qrDataUrl,
          salutation,
          studentName,
          fatherPrefix,
          fatherName,
          studentPhotoUrl: student.photo_url,
          courseLevel,
          courseCode,
          courseName,
          trainingCenterName,
          performanceText,
          marksScored,
          grade,
          typingSubjects: showTyping ? typingSubjects : null,
          trainingCenterLogoUrl: student.branch?.center_logo_url ?? null,
          certificationLogoUrls: certLogos,
        })
      } else {
        blob = await buildComputerBasedTypingBlob({
          settings,
          certificateNumber: certNumber,
          issueDate: formattedDate,
          qrCodeDataUrl: qrDataUrl,
          salutation,
          studentName,
          fatherPrefix,
          fatherName,
          studentPhotoUrl: student.photo_url,
          enrollmentNumber,
          trainingCenterCode: centerCode,
          trainingCenterName,
          trainingCenterLogoUrl: student.branch?.center_logo_url ?? null,
          typingSubjects,
          grade,
          certificationLogoUrls: certLogos,
        })
      }

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
        <span className="ml-auto text-xs text-gray-500">Step {step} of 4</span>
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          <p className="text-sm font-medium text-gray-700">Pick a template</p>
          {mappings.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              This course has no certificate template configured.{' '}
              <button
                onClick={() => navigate('/admin/certificates/settings')}
                className="underline font-medium"
              >
                Configure in Settings
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mappings.map(m => {
                const tpl = templates.find(t => t.id === m.template_id)
                if (!tpl) return null
                const isSel = templateId === tpl.id
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setTemplateId(tpl.id)}
                    className={`text-left p-4 rounded-lg border-2 ${
                      isSel ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{tpl.name}</p>
                      {isSel ? <Check size={14} className="text-red-600" /> : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {tpl.orientation} · {tpl.description}
                    </p>
                    {m.is_default ? (
                      <p className="text-[10px] text-gray-400 mt-2">Default for this course</p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-red-600">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!templateId}
              className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedTemplate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <p className="text-sm font-medium text-gray-700">Fill the certificate fields</p>

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

          {selectedTemplate.slug === 'certificate-of-qualification' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Course Code">
                  <input value={courseCode} onChange={e => setCourseCode(e.target.value)} className={inputClass} />
                </FormField>
                <FormField label="Course Name" className="sm:col-span-2">
                  <input value={courseName} onChange={e => setCourseName(e.target.value)} className={inputClass} />
                </FormField>
                <FormField label="Course Level" hint="e.g. 12">
                  <input value={courseLevel} onChange={e => setCourseLevel(e.target.value)} className={inputClass} />
                </FormField>
                <FormField label="Training Center" className="sm:col-span-2">
                  <input value={trainingCenterName} onChange={e => setTrainingCenterName(e.target.value)} className={inputClass} />
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

              {selectedMapping?.show_typing_fields ? (
                <TypingEditor
                  subjects={typingSubjects}
                  update={moveTypingRow}
                  add={addTypingRow}
                  remove={removeTypingRow}
                />
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Enrollment No.">
                  <input value={enrollmentNumber} onChange={e => setEnrollmentNumber(e.target.value)} className={inputClass} />
                </FormField>
                <FormField label="Center Code">
                  <input value={trainingCenterCode} onChange={e => setTrainingCenterCode(e.target.value)} className={inputClass} />
                </FormField>
                <FormField label="Training Center">
                  <input value={trainingCenterName} onChange={e => setTrainingCenterName(e.target.value)} className={inputClass} />
                </FormField>
              </div>

              <TypingEditor
                subjects={typingSubjects}
                update={moveTypingRow}
                add={addTypingRow}
                remove={removeTypingRow}
              />

              <FormField label="Grade">
                <select value={grade} onChange={e => setGrade(e.target.value)} className={selectClass}>
                  {GRADE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
            </div>
          )}

          <FormField label="Issue Date">
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputClass} />
          </FormField>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-red-600">Back</button>
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              Preview <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {step === 4 && student && settings && selectedTemplate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3">
          <p className="text-sm font-medium text-gray-700">Preview & confirm</p>
          <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              {selectedTemplate.slug === 'certificate-of-qualification' ? (
                <CertificateOfQualification
                  settings={settings}
                  certificateNumber="PREVIEW"
                  issueDate={formatDateDDMMYYYY(issueDate)}
                  qrCodeDataUrl={qrPreview}
                  salutation={salutation}
                  studentName={studentName}
                  fatherPrefix={fatherPrefix}
                  fatherName={fatherName}
                  studentPhotoUrl={student.photo_url}
                  courseLevel={courseLevel}
                  courseCode={courseCode}
                  courseName={courseName}
                  trainingCenterName={trainingCenterName}
                  performanceText={performanceText}
                  marksScored={marksScored}
                  grade={grade}
                  typingSubjects={selectedMapping?.show_typing_fields ? typingSubjects : null}
                  trainingCenterLogoUrl={student.branch?.center_logo_url ?? null}
                  certificationLogoUrls={certLogos}
                />
              ) : (
                <ComputerBasedTypingCertificate
                  settings={settings}
                  certificateNumber="PREVIEW"
                  issueDate={formatDateDDMMYYYY(issueDate)}
                  qrCodeDataUrl={qrPreview}
                  salutation={salutation}
                  studentName={studentName}
                  fatherPrefix={fatherPrefix}
                  fatherName={fatherName}
                  studentPhotoUrl={student.photo_url}
                  enrollmentNumber={enrollmentNumber}
                  trainingCenterCode={trainingCenterCode}
                  trainingCenterName={trainingCenterName}
                  trainingCenterLogoUrl={student.branch?.center_logo_url ?? null}
                  typingSubjects={typingSubjects}
                  grade={grade}
                  certificationLogoUrls={certLogos}
                />
              )}
            </PDFViewer>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="text-sm text-gray-500 hover:text-red-600">
              Back to Edit
            </button>
            <button
              onClick={() => void confirmAndIssue()}
              disabled={submitting}
              className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              Confirm &amp; Issue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TypingEditor({
  subjects,
  update,
  add,
  remove,
}: {
  subjects: TypingSubject[]
  update: (i: number, p: Partial<TypingSubject>) => void
  add: () => void
  remove: (i: number) => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">Typing Subjects (max 5)</p>
        {subjects.length < 5 ? (
          <button
            onClick={add}
            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
          >
            <Plus size={12} /> Add
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-200">
              <th className="text-left py-1 pr-2">Subject</th>
              <th className="text-left py-1 pr-2">Speed</th>
              <th className="text-left py-1 pr-2">Max</th>
              <th className="text-left py-1 pr-2">Min</th>
              <th className="text-left py-1 pr-2">Obtained</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-b-0">
                <td className="py-1 pr-2">
                  <input value={s.name} onChange={e => update(i, { name: e.target.value })} className={`${inputClass} py-1.5`} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" value={s.speed} onChange={e => update(i, { speed: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20`} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" value={s.max} onChange={e => update(i, { max: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20`} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" value={s.min} onChange={e => update(i, { min: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20`} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" value={s.obtained} onChange={e => update(i, { obtained: Number(e.target.value) })} className={`${inputClass} py-1.5 w-20`} />
                </td>
                <td className="py-1 pl-2 w-8">
                  <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-600 p-1">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
