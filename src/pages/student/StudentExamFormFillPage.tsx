import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { useImpersonation } from '../../contexts/ImpersonationContext'
import FormField, { inputClass } from '../../components/FormField'

interface Window {
  id: string
  semester: number
  exam_session: string
  course_id: string
}

interface SubjectRow { id: string; name: string; code: string | null }

export default function StudentExamFormFillPage() {
  const { windowId } = useParams<{ windowId: string }>()
  const navigate = useNavigate()
  const { rec } = useStudentRecord()
  const { isImpersonating } = useImpersonation()

  const [window, setWindow] = useState<Window | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingFormId, setExistingFormId] = useState<string | null>(null)

  // Editable fields stored in details
  const [phone, setPhone] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [address, setAddress] = useState('')

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
      setSubjects((subs ?? []) as SubjectRow[])

      // If a previous resubmit/rejected submission exists for this window, prefill
      const { data: prev } = await supabase
        .from('uce_exam_forms')
        .select('id, status, details')
        .eq('student_id', rec.id)
        .eq('window_id', wd.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (prev && (prev.status === 'resubmit' || prev.status === 'rejected')) {
        setExistingFormId(prev.id)
        const d = (prev.details ?? {}) as Record<string, string>
        setPhone(d.phone || rec.phone || '')
        setAltPhone(d.alt_phone || rec.alt_phone || '')
        setAddress(d.address || rec.address || '')
      } else if (prev && (prev.status === 'submitted' || prev.status === 'approved')) {
        // Already submitted/approved — bounce back
        toast.info('This form has already been submitted.')
        navigate('/student/exam-forms')
        return
      } else {
        setPhone(rec.phone || '')
        setAltPhone(rec.alt_phone || '')
        setAddress(rec.address || '')
      }

      setLoading(false)
    })()
  }, [rec, windowId])

  async function handleSubmit() {
    if (!rec || !window) return
    if (isImpersonating) {
      return toast.error('Read-only admin view — cannot submit.')
    }
    if (subjects.length === 0) return toast.error('No subjects configured for this semester. Contact your branch.')

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
      subject_ids: subjects.map(s => s.id),
      details,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    }
    let error: { message: string } | null = null
    if (existingFormId) {
      const res = await supabase.from('uce_exam_forms').update(payload).eq('id', existingFormId)
      error = res.error
    } else {
      const res = await supabase.from('uce_exam_forms').insert(payload)
      error = res.error
    }
    setSubmitting(false)
    if (error) return toast.error(error.message)
    setSubmitted(true)
  }

  if (loading || !rec || !window) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-red-600" /></div>
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto pt-6 text-center space-y-4">
        <div className="inline-flex h-16 w-16 rounded-full bg-green-100 items-center justify-center">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>
        <h2 className="text-xl font-heading font-bold">Exam Form Submitted</h2>
        <p className="text-sm text-gray-600">
          Your form is awaiting review. After it is approved you will be able to start your paper.
        </p>
        <button onClick={() => navigate('/student/exam-forms')} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
          Back to Exam Forms
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/student/exam-forms')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading">Exam Form</h1>
          <p className="text-xs text-gray-500">Sem {window.semester} · Session {window.exam_session}</p>
        </div>
      </div>

      {/* Auto-filled student details (read-only) */}
      <div className="bg-white rounded-xl border p-4 sm:p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Your Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-gray-500">Name</p><p className="font-medium">{rec.name}</p></div>
          <div><p className="text-xs text-gray-500">Father's Name</p><p className="font-medium">{rec.father_name}</p></div>
          <div><p className="text-xs text-gray-500">Registration No</p><p className="font-mono font-medium">{rec.registration_no}</p></div>
          <div><p className="text-xs text-gray-500">Course</p><p className="font-medium">{rec.course?.name}</p></div>
        </div>
      </div>

      {/* Editable contact fields */}
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

      {/* Subjects */}
      <div className="bg-white rounded-xl border p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase">Subjects ({subjects.length})</h2>
          <span className="text-xs text-gray-500">All subjects for Sem {window.semester} are auto-included</span>
        </div>
        {subjects.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            No subjects configured for Semester {window.semester}. Contact your branch.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {subjects.map(s => (
              <span key={s.id} className="inline-flex px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                {s.name}{s.code ? ` (${s.code})` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pb-6">
        <button onClick={() => navigate('/student/exam-forms')} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={submitting || isImpersonating} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? 'Submitting...' : isImpersonating ? 'Read-only view' : 'Submit Form'}
        </button>
      </div>
    </div>
  )
}
