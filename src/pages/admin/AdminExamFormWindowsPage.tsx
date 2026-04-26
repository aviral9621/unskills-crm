import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Power, Trash2, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface CourseOpt { id: string; name: string; code: string; total_semesters: number | null }
interface FormWindow {
  id: string
  course_id: string
  semester: number
  exam_session: string
  opens_at: string | null
  closes_at: string | null
  instructions: string | null
  is_active: boolean
  created_at: string
  course?: { name: string; code: string } | null
}

export default function AdminExamFormWindowsPage() {
  const { user } = useAuth()
  const [windows, setWindows] = useState<FormWindow[]>([])
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    course_id: '', semester: '', exam_session: '', opens_at: '', closes_at: '', instructions: '', is_active: true,
  })

  async function load() {
    const { data } = await supabase
      .from('uce_exam_form_windows')
      .select('*, course:uce_courses(name, code)')
      .order('created_at', { ascending: false })
    setWindows((data ?? []) as unknown as FormWindow[])
  }

  async function loadCourses() {
    const { data } = await supabase.from('uce_courses').select('id, name, code, total_semesters').eq('is_active', true).order('name')
    setCourses((data ?? []) as unknown as CourseOpt[])
  }

  useEffect(() => { load(); loadCourses() }, [])

  async function toggleActive(w: FormWindow) {
    const ns = !w.is_active
    const { error } = await supabase.from('uce_exam_form_windows').update({ is_active: ns }).eq('id', w.id)
    if (error) return toast.error(error.message)
    toast.success(`Form window ${ns ? 'activated' : 'closed'}`)
    setWindows(prev => prev.map(x => x.id === w.id ? { ...x, is_active: ns } : x))
  }

  async function remove(w: FormWindow) {
    if (!confirm(`Delete form window for ${w.course?.name} Sem ${w.semester}? This won't affect existing submissions.`)) return
    const { error } = await supabase.from('uce_exam_form_windows').delete().eq('id', w.id)
    if (error) return toast.error(error.message)
    toast.success('Deleted')
    setWindows(prev => prev.filter(x => x.id !== w.id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.course_id) return toast.error('Select a course')
    if (!form.semester) return toast.error('Select a semester')
    if (!form.exam_session.trim()) return toast.error('Enter exam session (e.g., 2026-27)')

    setSaving(true)
    const { error } = await supabase.from('uce_exam_form_windows').insert({
      course_id: form.course_id,
      semester: parseInt(form.semester),
      exam_session: form.exam_session.trim(),
      opens_at: form.opens_at || null,
      closes_at: form.closes_at || null,
      instructions: form.instructions.trim() || null,
      is_active: form.is_active,
      created_by: user?.id || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Form window created')
    setShowForm(false)
    setForm({ course_id: '', semester: '', exam_session: '', opens_at: '', closes_at: '', instructions: '', is_active: true })
    load()
  }

  const selCourse = courses.find(c => c.id === form.course_id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Exam Form Windows</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Open exam-form submission for a course and semester. Active windows appear on student dashboards.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <Plus size={16} /> {showForm ? 'Cancel' : 'Open Form'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Course" required>
              <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value, semester: '' }))} className={selectClass}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </FormField>
            <FormField label="Semester" required>
              <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} className={selectClass} disabled={!form.course_id}>
                <option value="">Select semester</option>
                {Array.from({ length: selCourse?.total_semesters || 8 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Exam Session" required hint="e.g., 2026-27">
              <input value={form.exam_session} onChange={e => setForm(f => ({ ...f, exam_session: e.target.value }))} className={inputClass} placeholder="2026-27" />
            </FormField>
            <FormField label="Opens On">
              <input type="date" value={form.opens_at} onChange={e => setForm(f => ({ ...f, opens_at: e.target.value }))} className={inputClass} />
            </FormField>
            <FormField label="Closes On">
              <input type="date" value={form.closes_at} onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))} className={inputClass} />
            </FormField>
          </div>

          <FormField label="Instructions (optional)">
            <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} className={inputClass} rows={2} placeholder="Anything students should know before filling the form" />
          </FormField>

          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-red-600" />
              Active (visible to students)
            </label>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Window'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Sem</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Opens</th>
              <th className="px-4 py-3">Closes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {windows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                <ClipboardList size={28} className="mx-auto mb-2 text-gray-300" />
                No form windows yet. Open one to let students submit exam forms.
              </td></tr>
            ) : windows.map(w => (
              <tr key={w.id}>
                <td className="px-4 py-3">{w.course?.name ?? '—'}</td>
                <td className="px-4 py-3">Sem {w.semester}</td>
                <td className="px-4 py-3 font-mono text-xs">{w.exam_session}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{w.opens_at ? formatDateDDMMYYYY(w.opens_at) : '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{w.closes_at ? formatDateDDMMYYYY(w.closes_at) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${w.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {w.is_active ? 'Active' : 'Closed'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => toggleActive(w)} className={`p-1.5 rounded-lg ${w.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`} title={w.is_active ? 'Close' : 'Reopen'}><Power size={14} /></button>
                    <button onClick={() => remove(w)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
