import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, IdCard, Loader2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import { getAdmitCardSettings, type AdmitCardSettings } from '../../lib/admitCardSettings'

interface ExamForm {
  id: string
  student_id: string
  course_id: string
  branch_id: string
  semester: number | null
  exam_session: string | null
  status: string
  form_type: string | null
  subject_ids: string[] | null
  details: Record<string, unknown> | null
  student: { id: string; name: string; registration_no: string; photo_url: string | null } | null
  course: { name: string; code: string } | null
}

interface PaperSetOption {
  id: string
  paper_name: string
  category: string | null
  available_from: string | null
  available_to: string | null
}

interface SubjectRow { id: string; name: string; code: string | null }

interface ScheduleEntry {
  subject_id: string
  subject_name: string
  date: string
  reporting_time: string
  exam_time: string
  end_time: string
}

export default function AdminAdmitCardFormPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const formId = params.get('formId')

  const [examForm, setExamForm] = useState<ExamForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])

  const [centerName, setCenterName] = useState('')
  const [centerCode, setCenterCode] = useState('')
  const [centerAddress, setCenterAddress] = useState('')
  const [visibleFrom, setVisibleFrom] = useState('')
  const [visibleUntil, setVisibleUntil] = useState('')
  const [paperSets, setPaperSets] = useState<PaperSetOption[]>([])
  const [paperSetId, setPaperSetId] = useState('')

  useEffect(() => {
    if (!formId) {
      toast.error('Missing form ID')
      navigate('/admin/exams/forms')
      return
    }
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('uce_exam_forms')
        .select('id,student_id,course_id,branch_id,semester,exam_session,status,form_type,subject_ids,details,student:uce_students(id,name,registration_no,photo_url),course:uce_courses(name,code)')
        .eq('id', formId)
        .maybeSingle()
      if (error || !data) {
        toast.error('Failed to load exam form')
        navigate('/admin/exams/forms')
        return
      }
      const ef = data as unknown as ExamForm
      if (ef.status !== 'approved') {
        toast.error('Exam form is not approved yet')
        navigate('/admin/exams/forms')
        return
      }
      setExamForm(ef)

      const ids = ef.subject_ids ?? []
      let subjects: SubjectRow[] = []
      if (ids.length > 0) {
        const { data: sd } = await supabase.from('uce_subjects').select('id, name, code').in('id', ids).order('display_order')
        subjects = (sd ?? []) as SubjectRow[]
      }
      setEntries(subjects.map(s => ({
        subject_id: s.id,
        subject_name: s.name,
        date: '',
        reporting_time: '09:00',
        exam_time: '09:30',
        end_time: '12:30',
      })))

      // Defaults from settings
      try {
        const settings: AdmitCardSettings = await getAdmitCardSettings()
        setCenterAddress(settings.footer_address ?? '')
      } catch { /* ignore */ }

      // Auto-suggest paper sets matching this course+semester (best-effort)
      const { data: ps } = await supabase
        .from('uce_paper_sets')
        .select('id, paper_name, category, available_from, available_to, semester')
        .eq('course_id', ef.course_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      const matched = ((ps ?? []) as Array<PaperSetOption & { semester: number | null }>)
        .filter(p => p.semester == null || p.semester === ef.semester)
      setPaperSets(matched as PaperSetOption[])
      // Pre-select the most recent active paper set if any
      if (matched.length > 0) setPaperSetId(matched[0].id)

      setLoading(false)
    })()
  }, [formId])

  function updateEntry(idx: number, field: keyof ScheduleEntry, value: string) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function handleGenerate() {
    if (!examForm) return
    if (!centerName.trim() || !centerCode.trim() || !centerAddress.trim()) {
      return toast.error('Fill all exam center fields')
    }
    if (entries.some(e => !e.date || !e.reporting_time || !e.exam_time)) {
      return toast.error('Fill date and times for every subject')
    }
    setSaving(true)
    const { error } = await supabase.from('uce_admit_cards').insert({
      student_id: examForm.student_id,
      course_id: examForm.course_id,
      semester: examForm.semester,
      exam_session: examForm.exam_session,
      exam_form_id: examForm.id,
      exam_center_name: centerName.trim(),
      exam_center_code: centerCode.trim(),
      exam_center_address: centerAddress.trim(),
      schedule: entries,
      subject_ids: entries.map(e => e.subject_id),
      issue_date: new Date().toISOString().slice(0, 10),
      is_active: true,
      student_visible: true,
      visible_from: visibleFrom ? new Date(visibleFrom).toISOString() : null,
      visible_until: visibleUntil ? new Date(visibleUntil).toISOString() : null,
      paper_set_id: paperSetId || null,
      generated_by: user?.id || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Admit card generated. Now visible on student dashboard.')
    navigate('/admin/exams/forms')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-red-600" />
      </div>
    )
  }
  if (!examForm) return null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/exams/forms')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Generate Admit Card</h1>
          <p className="text-xs text-gray-500">Prefilled from approved exam form. Set dates, times and exam center, then generate.</p>
        </div>
      </div>

      {/* Student summary */}
      <div className="bg-white rounded-xl border p-4 flex items-start gap-4">
        {examForm.student?.photo_url ? (
          <img src={examForm.student.photo_url} alt="" className="h-20 w-16 object-cover rounded border" />
        ) : (
          <div className="h-20 w-16 bg-gray-100 rounded border flex items-center justify-center text-gray-300 text-xs">No photo</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{examForm.student?.name}</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
              examForm.form_type === 'carry_forward'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {examForm.form_type === 'carry_forward' ? 'Carry-Forward' : 'Regular'}
            </span>
          </div>
          <p className="text-xs font-mono text-gray-500">{examForm.student?.registration_no}</p>
          <p className="text-xs text-gray-500 mt-1">
            {examForm.course?.name} · Semester {examForm.semester} · Session {examForm.exam_session}
          </p>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Subject Schedule</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left py-2 pr-2 min-w-[140px]">Subject</th>
                <th className="text-left py-2 pr-2">Date</th>
                <th className="text-left py-2 pr-2">Report</th>
                <th className="text-left py-2 pr-2">Exam Time</th>
                <th className="text-left py-2 pr-2">End</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e, i) => (
                <tr key={e.subject_id}>
                  <td className="py-2 pr-2 text-gray-900">{e.subject_name}</td>
                  <td className="py-2 pr-2"><input type="date" value={e.date} onChange={ev => updateEntry(i, 'date', ev.target.value)} className="rounded border-gray-300 px-2 py-1 text-xs" /></td>
                  <td className="py-2 pr-2"><input type="time" value={e.reporting_time} onChange={ev => updateEntry(i, 'reporting_time', ev.target.value)} className="rounded border-gray-300 px-2 py-1 text-xs" /></td>
                  <td className="py-2 pr-2"><input type="time" value={e.exam_time} onChange={ev => updateEntry(i, 'exam_time', ev.target.value)} className="rounded border-gray-300 px-2 py-1 text-xs" /></td>
                  <td className="py-2 pr-2"><input type="time" value={e.end_time} onChange={ev => updateEntry(i, 'end_time', ev.target.value)} className="rounded border-gray-300 px-2 py-1 text-xs" /></td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No subjects on this form. Cannot generate admit card.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visibility & Online Paper */}
      <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Calendar size={14} /> Visibility & Online Paper
        </h2>
        <p className="text-xs text-gray-500">
          Control when the admit card (and the linked online paper) becomes visible to the student. Leave empty to make it visible immediately and indefinitely.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Visible From (date & time)">
            <input type="datetime-local" value={visibleFrom} onChange={e => setVisibleFrom(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Visible Until (date & time)">
            <input type="datetime-local" value={visibleUntil} onChange={e => setVisibleUntil(e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <FormField
          label="Linked Paper Set (optional)"
          hint="When the admit card is visible, this paper set will become available for the student to attempt online"
        >
          <select value={paperSetId} onChange={e => setPaperSetId(e.target.value)} className={selectClass}>
            <option value="">— No online paper —</option>
            {paperSets.map(p => (
              <option key={p.id} value={p.id}>
                {p.paper_name}{p.category ? ` · ${p.category}` : ''}
              </option>
            ))}
          </select>
        </FormField>
        {paperSets.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            No active paper sets found for this course/semester. Create one under Online Exams → Paper Sets if needed.
          </p>
        )}
      </div>

      {/* Exam Center */}
      <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Exam Center</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Center Name" required>
            <input value={centerName} onChange={e => setCenterName(e.target.value)} className={inputClass} placeholder="e.g., UnSkills Computer Education, Mariahu" />
          </FormField>
          <FormField label="Center Code" required>
            <input value={centerCode} onChange={e => setCenterCode(e.target.value)} className={inputClass} placeholder="e.g., UCE-MJP-01" />
          </FormField>
        </div>
        <FormField label="Center Address" required>
          <textarea value={centerAddress} onChange={e => setCenterAddress(e.target.value)} className={inputClass} rows={2} />
        </FormField>
      </div>

      <div className="flex justify-end gap-2 pb-6">
        <button onClick={() => navigate('/admin/exams/forms')} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={handleGenerate} disabled={saving || entries.length === 0} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <IdCard size={16} />}
          {saving ? 'Generating...' : 'Generate Admit Card'}
        </button>
      </div>
    </div>
  )
}
