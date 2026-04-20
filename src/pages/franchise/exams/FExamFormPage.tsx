import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import { formatDateDDMMYYYY } from '../../../lib/utils'
import Modal from '../../../components/Modal'
import FormField, { inputClass } from '../../../components/FormField'

interface Row {
  id: string; semester: number | null; exam_session: string | null; status: string; created_at: string
  student: { name: string; registration_no: string } | null
  course: { name: string } | null
}

export default function FExamFormPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [studentId, setStudentId] = useState(''); const [semester, setSemester] = useState('')
  const [session, setSession] = useState(''); const [note, setNote] = useState('')
  const [students, setStudents] = useState<Array<{ id: string; name: string; registration_no: string; course_id: string }>>([])
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!branchId) return
    const { data } = await supabase.from('uce_exam_forms')
      .select('id,semester,exam_session,status,created_at,student:uce_students(name,registration_no),course:uce_courses(name)')
      .eq('branch_id', branchId).order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => {
    load()
    if (branchId) supabase.from('uce_students').select('id,name,registration_no,course_id').eq('branch_id', branchId).eq('is_active', true).order('name')
      .then(({ data }) => setStudents((data ?? []) as typeof students))
  }, [branchId])

  async function submit() {
    if (!studentId || !session) return toast.error('Student & session required')
    const s = students.find(x => x.id === studentId)
    if (!s) return
    setSaving(true)
    const { error } = await supabase.from('uce_exam_forms').insert({
      student_id: studentId, course_id: s.course_id, branch_id: branchId,
      semester: semester ? Number(semester) : null, exam_session: session,
      note: note || null, submitted_by: user?.id || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Exam form submitted')
    setModalOpen(false); setStudentId(''); setSemester(''); setSession(''); setNote(''); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Exam Forms</h1>
          <p className="text-sm text-gray-500">Submit per-semester exam forms for your students.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> New Form
        </button>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Course</th><th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Semester</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3">{formatDateDDMMYYYY(r.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.student?.name}</p>
                  <p className="text-xs font-mono text-gray-400">{r.student?.registration_no}</p>
                </td>
                <td className="px-4 py-3">{r.course?.name}</td>
                <td className="px-4 py-3">{r.exam_session}</td>
                <td className="px-4 py-3">{r.semester ?? '—'}</td>
                <td className="px-4 py-3 capitalize">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === 'approved' ? 'bg-green-50 text-green-700' : r.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No exam forms yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit Exam Form">
        <div className="space-y-4">
          <FormField label="Student" required>
            <select className={inputClass} value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.registration_no})</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Semester"><input type="number" className={inputClass} value={semester} onChange={e => setSemester(e.target.value)} placeholder="1" /></FormField>
            <FormField label="Exam Session" required><input className={inputClass} value={session} onChange={e => setSession(e.target.value)} placeholder="2026-27" /></FormField>
          </div>
          <FormField label="Note"><textarea rows={2} className={inputClass} value={note} onChange={e => setNote(e.target.value)} /></FormField>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
