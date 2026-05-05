import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { ArrowLeft, Plus, Pencil, Trash2, BookText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Subject, Course } from '../../types'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import ConfirmDialog from '../../components/ConfirmDialog'

const colHelper = createColumnHelper<Subject>()

export default function SubjectPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const courseIdParam = searchParams.get('course')

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState(courseIdParam || '')
  const [courseName, setCourseName] = useState('')
  const [courseTotalSemesters, setCourseTotalSemesters] = useState<number>(0)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<Subject | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [theoryMarks, setTheoryMarks] = useState(100)
  const [practicalMarks, setPracticalMarks] = useState(50)
  const [order, setOrder] = useState(0)
  const [semester, setSemester] = useState<number | ''>(1)

  useEffect(() => { fetchCourses() }, [])
  useEffect(() => { if (selectedCourse) fetchSubjects() }, [selectedCourse])

  async function fetchCourses() {
    const { data } = await supabase.from('uce_courses').select('id, name, code, total_semesters').eq('is_active', true).order('name')
    setCourses((data ?? []) as Course[])
    if (courseIdParam) {
      const c = data?.find((x: { id: string }) => x.id === courseIdParam)
      if (c) {
        setCourseName((c as { name: string }).name)
        setCourseTotalSemesters((c as { total_semesters: number | null }).total_semesters ?? 0)
      }
    }
    setLoading(false)
  }

  async function fetchSubjects() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_subjects').select('*').eq('course_id', selectedCourse).order('semester', { nullsFirst: false }).order('display_order').order('name')
      if (error) throw error
      setSubjects(data ?? [])
      const c = courses.find(x => x.id === selectedCourse)
      if (c) {
        setCourseName(c.name)
        setCourseTotalSemesters((c as Course).total_semesters ?? 0)
      }
    } catch { toast.error('Failed to load subjects') }
    finally { setLoading(false) }
  }

  function openAdd() { setEditing(null); setCode(''); setName(''); setTheoryMarks(100); setPracticalMarks(50); setOrder(subjects.length); setSemester(1); setModalOpen(true) }
  function openEdit(s: Subject) { setEditing(s); setCode(s.code || ''); setName(s.name); setTheoryMarks(s.theory_max_marks); setPracticalMarks(s.practical_max_marks); setOrder(s.display_order); setSemester(s.semester ?? ''); setModalOpen(true) }

  async function handleSave() {
    if (!name.trim()) { toast.error('Subject name is required'); return }
    if (!selectedCourse) { toast.error('Select a course first'); return }
    setSaving(true)
    try {
      const payload = { course_id: selectedCourse, code: code || null, name, theory_max_marks: theoryMarks, practical_max_marks: practicalMarks, display_order: order, semester: semester !== '' ? Number(semester) : null }
      if (editing) {
        const { error } = await supabase.from('uce_subjects').update(payload).eq('id', editing.id)
        if (error) throw error; toast.success('Subject updated')
      } else {
        const { error } = await supabase.from('uce_subjects').insert(payload)
        if (error) throw error; toast.success('Subject added')
      }
      setModalOpen(false); fetchSubjects()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_subjects').delete().eq('id', delTarget.id)
      if (error) throw error
      toast.success('Subject deleted')
      setSubjects(p => p.filter(x => x.id !== delTarget.id))
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDelTarget(null) }
  }

  const columns = useMemo(() => [
    colHelper.display({ id: 'num', header: '#', cell: i => <span className="text-sm text-gray-400">{i.row.index + 1}</span> }),
    colHelper.accessor('code', { header: 'Code', cell: i => <span className="text-xs font-mono text-gray-600">{i.getValue() || '—'}</span> }),
    colHelper.accessor('name', { header: 'Subject Name', cell: i => <span className="text-sm font-medium text-gray-900">{i.getValue()}</span> }),
    colHelper.accessor('semester', { header: 'Sem', cell: i => <span className="text-sm text-gray-700">{i.getValue() ?? '—'}</span> }),
    colHelper.accessor('theory_max_marks', { header: 'Theory', cell: i => <span className="text-sm text-gray-700">{i.getValue()}</span> }),
    colHelper.accessor('practical_max_marks', { header: 'Practical', cell: i => <span className="text-sm text-gray-700">{i.getValue()}</span> }),
    colHelper.accessor('total_max_marks', { header: 'Total', cell: i => <span className="text-sm font-semibold text-gray-900">{i.getValue()}</span> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
        <button onClick={() => setDelTarget(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )}),
  ], [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/courses')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0"><ArrowLeft size={18} className="text-gray-600" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading truncate">Subjects{courseName ? ` — ${courseName}` : ''}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage subjects and marks</p>
        </div>
        {selectedCourse && <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add</button>}
      </div>

      {!courseIdParam && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <FormField label="Select Course" required>
            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className={selectClass}>
              <option value="">Choose a course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </FormField>
        </div>
      )}

      {selectedCourse && (
        <>
          {/* Mobile cards */}
          <div className="md:hidden">
            {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
            : subjects.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center"><BookText size={32} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No subjects yet</p></div>
            : <div className="space-y-2">{subjects.map((s, idx) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3">
                <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    {s.code && <span className="text-[10px] font-mono text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">{s.code}</span>}
                  </div>
                  <p className="text-xs text-gray-400">
                    {s.semester ? <span className="mr-1.5">Sem {s.semester} ·</span> : null}
                    T:{s.theory_max_marks} P:{s.practical_max_marks} = <span className="font-semibold text-gray-700">{s.total_max_marks}</span>
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
                  <button onClick={() => setDelTarget(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}</div>}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <DataTable data={subjects} columns={columns} loading={loading} emptyIcon={<BookText size={36} className="text-gray-300" />} emptyMessage="No subjects yet" />
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Subject' : 'Add Subject'} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Code"><input value={code} onChange={e => setCode(e.target.value)} className={inputClass} placeholder="e.g., CF-101" /></FormField>
            <FormField label="Subject Name" required><input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Subject name" /></FormField>
          </div>
          <FormField label="Semester" hint="Which semester this subject belongs to">
            {courseTotalSemesters > 0 ? (
              <select value={semester} onChange={e => setSemester(e.target.value === '' ? '' : Number(e.target.value))} className={selectClass}>
                <option value="">Select semester</option>
                {Array.from({ length: courseTotalSemesters }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
            ) : (
              <input type="number" value={semester} onChange={e => setSemester(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} placeholder="e.g., 1" min={1} />
            )}
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Theory Max"><input type="number" value={theoryMarks} onChange={e => setTheoryMarks(Number(e.target.value))} className={inputClass} min={0} /></FormField>
            <FormField label="Practical Max"><input type="number" value={practicalMarks} onChange={e => setPracticalMarks(Number(e.target.value))} className={inputClass} min={0} /></FormField>
            <FormField label="Total"><input type="number" value={theoryMarks + practicalMarks} readOnly className={`${inputClass} bg-gray-100 font-semibold`} /></FormField>
          </div>
          <FormField label="Display Order"><input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} className={inputClass} min={0} /></FormField>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}
        title="Delete Subject?" message={`"${delTarget?.name}" will be permanently removed.`} confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
