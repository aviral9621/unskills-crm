import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Download, FileText,
  ShieldAlert, AlertCircle, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { useImpersonation } from '../../contexts/ImpersonationContext'
import FormField, { inputClass } from '../../components/FormField'
import { getAdmitCardSettings } from '../../lib/admitCardSettings'
import { buildExamFormPdfBlob, toDataUrl } from '../../lib/pdf/exam-form'

interface Window { id: string; semester: number; exam_session: string; course_id: string }
interface SubjectRow { id: string; name: string; code: string | null }

type Step = 1 | 2 | 3 | 4 | 5

export default function StudentExamFormFillPage() {
  const { windowId } = useParams<{ windowId: string }>()
  const navigate = useNavigate()
  const { rec } = useStudentRecord()
  const { isImpersonating } = useImpersonation()

  const [step, setStep] = useState<Step>(1)
  const [window, setWindow] = useState<Window | null>(null)
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [existingFormId, setExistingFormId] = useState<string | null>(null)

  const [formType, setFormType] = useState<'regular' | 'carry_forward'>('regular')
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set())

  const [phone, setPhone] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [address, setAddress] = useState('')

  const [submittedFormId, setSubmittedFormId] = useState<string | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!rec || !windowId) return
    ;(async () => {
      setLoading(true)
      const { data: w } = await supabase
        .from('uce_exam_form_windows')
        .select('id, semester, exam_session, course_id')
        .eq('id', windowId)
        .maybeSingle()
      if (!w) { toast.error('Form window not found'); navigate('/student/exam-forms'); return }
      const wd = w as unknown as Window
      setWindow(wd)

      const { data: subs } = await supabase
        .from('uce_subjects')
        .select('id, name, code')
        .eq('course_id', rec.course_id)
        .eq('semester', wd.semester)
        .eq('is_active', true)
        .order('display_order')
      const list = (subs ?? []) as SubjectRow[]
      setAllSubjects(list)

      const { data: prev } = await supabase
        .from('uce_exam_forms')
        .select('id, status, details, form_type, subject_ids')
        .eq('student_id', rec.id)
        .eq('window_id', wd.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (prev && (prev.status === 'submitted' || prev.status === 'approved')) {
        toast.info('This form has already been submitted.')
        navigate('/student/exam-forms')
        return
      }
      if (prev && (prev.status === 'resubmit' || prev.status === 'rejected')) {
        setExistingFormId(prev.id)
        const d = (prev.details ?? {}) as Record<string, string>
        setPhone(d.phone || rec.phone || '')
        setAltPhone(d.alt_phone || rec.alt_phone || '')
        setAddress(d.address || rec.address || '')
        if (prev.form_type === 'carry_forward') setFormType('carry_forward')
        if (prev.subject_ids && prev.subject_ids.length > 0) {
          setSelectedSubjectIds(new Set(prev.subject_ids as string[]))
        } else {
          setSelectedSubjectIds(new Set(list.map(s => s.id)))
        }
      } else {
        setPhone(rec.phone || '')
        setAltPhone(rec.alt_phone || '')
        setAddress(rec.address || '')
        // Default = all subjects (for regular)
        setSelectedSubjectIds(new Set(list.map(s => s.id)))
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, windowId])

  // Keep selected subjects in sync with formType (regular = all, CF = manual)
  useEffect(() => {
    if (formType === 'regular') {
      setSelectedSubjectIds(new Set(allSubjects.map(s => s.id)))
    }
    // for CF we leave whatever the user has chosen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formType, allSubjects.length])

  const finalSubjects = useMemo(
    () => allSubjects.filter(s => selectedSubjectIds.has(s.id)),
    [allSubjects, selectedSubjectIds],
  )

  function toggleSubject(id: string) {
    setSelectedSubjectIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!rec || !window) return
    if (isImpersonating) return toast.error('Read-only admin view — cannot submit.')
    if (allSubjects.length === 0) return toast.error('No subjects configured for this semester. Contact your branch.')
    if (formType === 'carry_forward' && finalSubjects.length === 0) {
      return toast.error('Pick at least one carry-forward subject.')
    }

    const details = {
      name: rec.name,
      father_name: rec.father_name,
      registration_no: rec.registration_no,
      course: rec.course?.name || '',
      semester: window.semester,
      exam_session: window.exam_session,
      phone: phone.trim(),
      alt_phone: altPhone.trim(),
      address: address.trim(),
      district: rec.district,
      state: rec.state,
      pincode: rec.pincode,
    }

    setSubmitting(true)
    const payload = {
      student_id: rec.id,
      course_id: rec.course_id,
      branch_id: rec.branch_id,
      window_id: window.id,
      semester: window.semester,
      exam_session: window.exam_session,
      status: 'submitted' as const,
      form_type: formType,
      source: 'student_panel',
      subject_ids: finalSubjects.map(s => s.id),
      details,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    }

    let error: { message: string } | null = null
    let newId: string | null = null
    if (existingFormId) {
      const res = await supabase.from('uce_exam_forms').update(payload).eq('id', existingFormId).select('id').single()
      error = res.error
      newId = res.data?.id ?? existingFormId
    } else {
      const res = await supabase.from('uce_exam_forms').insert(payload).select('id').single()
      error = res.error
      newId = res.data?.id ?? null
    }
    setSubmitting(false)
    if (error) return toast.error(error.message)
    setSubmittedFormId(newId)
    setSubmittedAt(new Date().toISOString())
    setStep(5)
  }

  async function downloadPdf() {
    if (!rec || !window) return
    setDownloadingPdf(true)
    try {
      const [settings, logoDataUrl, isoLogoDataUrl] = await Promise.all([
        getAdmitCardSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
        toDataUrl('/ISO LOGOs.png').catch(() => ''),
      ])
      const photoDataUrl = rec.photo_url ? await toDataUrl(rec.photo_url).catch(() => '') : ''

      const blob = await buildExamFormPdfBlob({
        student: {
          registration_no: rec.registration_no,
          name: rec.name,
          father_name: rec.father_name,
          course_name: rec.course?.name || '',
          course_code: rec.course?.code || null,
          branch_name: rec.branch?.name || null,
          branch_code: rec.branch?.code || null,
          session: rec.session,
          photo_url: rec.photo_url,
          phone: phone || rec.phone,
          alt_phone: altPhone || rec.alt_phone,
          address: address || rec.address,
          district: rec.district,
          state: rec.state,
          pincode: rec.pincode,
        },
        semester: window.semester,
        examSession: window.exam_session,
        formType,
        subjects: finalSubjects,
        settings,
        logoDataUrl,
        isoLogoDataUrl,
        photoDataUrl,
        ackNumber: submittedFormId ? submittedFormId.slice(0, 8).toUpperCase() : undefined,
        submittedOn: submittedAt || undefined,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Exam-Form-${rec.registration_no.replace(/\//g, '-')}-Sem${window.semester}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF generation failed')
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (loading || !rec || !window) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 && step !== 5 ? setStep((step - 1) as Step) : navigate('/student/exam-forms')}
          className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold font-heading">Exam Form</h1>
          <p className="text-xs text-gray-500">Sem {window.semester} · Session {window.exam_session}</p>
        </div>
      </div>

      {/* Stepper */}
      {step !== 5 && (
        <div className="flex items-center gap-2">
          {([1, 2, 3, 4] as const).map(n => (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === n ? 'bg-red-600 text-white' :
                step > n ? 'bg-emerald-500 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>{step > n ? <Check size={14} /> : n}</div>
              {n < 4 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* STEP 1: Verify identity */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Verify your details</h2>
            <div className="flex items-start gap-4">
              {rec.photo_url ? (
                <img src={rec.photo_url} alt="" className="h-24 w-20 object-cover rounded border shrink-0" />
              ) : (
                <div className="h-24 w-20 rounded border bg-gray-100 grid place-items-center text-2xl font-bold text-gray-300 shrink-0">
                  {rec.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Name</p><p className="font-semibold">{rec.name}</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Reg No</p><p className="font-mono text-sm">{rec.registration_no}</p></div>
                  <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Father's Name</p><p className="text-sm">{rec.father_name}</p></div>
                </div>
                <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Course</p><p className="text-sm">{rec.course?.name}{rec.course?.code ? ` (${rec.course.code})` : ''}</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Semester</p><p className="text-sm font-bold text-red-600">{window.semester}</p></div>
                  <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Session</p><p className="text-sm">{window.exam_session}</p></div>
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>Confirm the details above are correct. If your name, photo or course is wrong, contact your branch <strong>before</strong> submitting this form.</span>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-2">
              Continue to fill form <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Type select + subject pick (CF) */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">I am applying as</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setFormType('regular')}
                className={`text-left rounded-xl border-2 p-4 transition ${formType === 'regular' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold">Regular</p>
                  {formType === 'regular' && <CheckCircle2 size={18} className="text-emerald-600" />}
                </div>
                <p className="text-xs text-gray-600 mt-1">All subjects of Semester {window.semester}</p>
              </button>
              <button onClick={() => setFormType('carry_forward')}
                className={`text-left rounded-xl border-2 p-4 transition ${formType === 'carry_forward' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold">Carry-Forward</p>
                  {formType === 'carry_forward' && <CheckCircle2 size={18} className="text-amber-600" />}
                </div>
                <p className="text-xs text-gray-600 mt-1">Retest only specific subjects</p>
              </button>
            </div>
          </div>

          {formType === 'regular' ? (
            <div className="bg-white rounded-xl border p-4 sm:p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">All Subjects of Semester {window.semester}</h2>
              {allSubjects.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No subjects configured. Contact your branch.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {allSubjects.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="h-5 w-5 rounded bg-emerald-100 text-emerald-700 grid place-items-center text-[10px] font-bold">{i + 1}</span>
                      <span className="font-medium">{s.name}</span>
                      {s.code && <span className="text-xs text-gray-500">({s.code})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border p-4 sm:p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">Select subjects to retake ({selectedSubjectIds.size}/{allSubjects.length})</h2>
              {allSubjects.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">No subjects configured.</p>
              ) : (
                <ul className="space-y-1">
                  {allSubjects.map(s => {
                    const checked = selectedSubjectIds.has(s.id)
                    return (
                      <li key={s.id}>
                        <label className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${checked ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSubject(s.id)} className="h-4 w-4" />
                          <span className="font-medium text-sm flex-1">{s.name}</span>
                          {s.code && <span className="text-xs text-gray-500">({s.code})</span>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Back</button>
            <button onClick={() => setStep(3)}
              disabled={allSubjects.length === 0 || (formType === 'carry_forward' && selectedSubjectIds.size === 0)}
              className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
              Continue <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Contact details */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase">Contact (editable)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Phone" required>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Alt Phone">
                <input value={altPhone} onChange={e => setAltPhone(e.target.value)} className={inputClass} />
              </FormField>
            </div>
            <FormField label="Address" required>
              <textarea value={address} onChange={e => setAddress(e.target.value)} className={inputClass} rows={2} />
            </FormField>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Back</button>
            <button onClick={() => setStep(4)} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-2">
              Continue <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Confirm + submit */}
      {step === 4 && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Final review</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Name</p><p className="font-semibold">{rec.name}</p></div>
              <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Reg No</p><p className="font-mono">{rec.registration_no}</p></div>
              <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Course</p><p>{rec.course?.name}</p></div>
              <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Semester / Session</p><p>{window.semester} · {window.exam_session}</p></div>
              <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Form Type</p>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${formType === 'regular' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {formType === 'regular' ? 'REGULAR' : 'CARRY-FORWARD'}
                </span>
              </div>
              <div><p className="text-[10px] uppercase text-gray-400 font-semibold">Subjects</p><p className="font-semibold">{finalSubjects.length}</p></div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Subjects applying for</p>
              <div className="flex flex-wrap gap-1.5">
                {finalSubjects.map(s => (
                  <span key={s.id} className={`px-2.5 py-1 rounded text-xs font-medium ${formType === 'regular' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                    {s.name}{s.code ? ` (${s.code})` : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Clicking <strong>Submit</strong> will send this form for branch review. Roll number and admit card will be issued after approval.</span>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Back</button>
            <button onClick={handleSubmit} disabled={submitting || isImpersonating}
              className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {isImpersonating ? 'Read-only view' : (submitting ? 'Submitting…' : 'Submit Exam Form')}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Success + PDF */}
      {step === 5 && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-6 text-center">
            <div className="inline-flex h-16 w-16 rounded-full bg-emerald-100 items-center justify-center mb-3">
              <CheckCircle2 size={36} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold font-heading">Exam Form Submitted</h2>
            <p className="text-sm text-gray-600 mt-1">
              Your {formType === 'carry_forward' ? 'carry-forward ' : ''}form is awaiting branch review. Roll number and admit card will be issued after approval.
            </p>
            {submittedFormId && (
              <p className="text-xs text-gray-500 mt-2">
                Acknowledgement: <span className="font-mono font-semibold text-gray-800">{submittedFormId.slice(0, 8).toUpperCase()}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row justify-center gap-2 mt-5">
              <button onClick={downloadPdf} disabled={downloadingPdf}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download Exam Form (PDF)
              </button>
              <button onClick={() => navigate('/student/exam-forms')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
                <FileText size={16} /> Back to Forms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
