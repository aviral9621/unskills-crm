import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Trash2, UserPlus, Users, GraduationCap, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Batch { id: string; name: string; course_id: string; course?: { name: string; code: string; created_by_branch_id: string | null } | null }
interface Student { id: string; name: string; registration_no: string; phone: string; branch_id: string; course_id: string }
interface Employee { id: string; name: string; phone: string; designation: string | null }
interface BSRow { id: string; student_id: string; student?: Student | null }
interface BTRow { id: string; employee_id: string; employee?: Employee | null }

export default function BatchEnrollmentPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string>('')
  const [enrolled, setEnrolled] = useState<BSRow[]>([])
  const [teachers, setTeachers] = useState<BTRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add students modal
  const [addOpen, setAddOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerStudents, setPickerStudents] = useState<Student[]>([])
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())
  const [pickerLoading, setPickerLoading] = useState(false)
  const [savingPicker, setSavingPicker] = useState(false)

  // Assign teacher modal
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [availTeachers, setAvailTeachers] = useState<Employee[]>([])
  const [pickedTeacher, setPickedTeacher] = useState<string>('')
  const [savingTeacher, setSavingTeacher] = useState(false)

  // Delete confirms
  const [delEnrollment, setDelEnrollment] = useState<BSRow | null>(null)
  const [delTeacher, setDelTeacher] = useState<BTRow | null>(null)

  useEffect(() => { fetchBatches() }, [])
  useEffect(() => { if (selectedBatch) fetchBatchData() }, [selectedBatch])

  async function fetchBatches() {
    setLoading(true)
    let q = supabase.from('uce_batches')
      .select('id, name, course_id, course:uce_courses!uce_batches_course_id_fkey(name, code, created_by_branch_id)')
      .eq('is_active', true)
      .order('name')
    const { data, error } = await q
    if (error) { toast.error('Failed to load batches'); setLoading(false); return }
    let rows = (data ?? []) as unknown as Batch[]
    if (!isSuperAdmin && branchId) {
      rows = rows.filter(b => !b.course?.created_by_branch_id || b.course?.created_by_branch_id === branchId)
    }
    setBatches(rows)
    setLoading(false)
  }

  async function fetchBatchData() {
    setLoading(true)
    const [{ data: bsData }, { data: btData }] = await Promise.all([
      supabase.from('uce_batch_students')
        .select('id, student_id, student:uce_students!uce_batch_students_student_id_fkey(id, name, registration_no, phone, branch_id, course_id)')
        .eq('batch_id', selectedBatch)
        .order('enrolled_at', { ascending: false }),
      supabase.from('uce_batch_teachers')
        .select('id, employee_id, employee:uce_employees!uce_batch_teachers_employee_id_fkey(id, name, phone, designation)')
        .eq('batch_id', selectedBatch),
    ])
    setEnrolled((bsData ?? []) as unknown as BSRow[])
    setTeachers((btData ?? []) as unknown as BTRow[])
    setLoading(false)
  }

  async function openAddStudents() {
    const batch = batches.find(b => b.id === selectedBatch)
    if (!batch) return
    setAddOpen(true)
    setPickerSelected(new Set())
    setPickerSearch('')
    setPickerLoading(true)

    let q = supabase.from('uce_students')
      .select('id, name, registration_no, phone, branch_id, course_id')
      .eq('is_active', true)
      .eq('course_id', batch.course_id)
      .order('name')
      .limit(500)
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    const enrolledIds = new Set(enrolled.map(e => e.student_id))
    const filtered = ((data ?? []) as Student[]).filter(s => !enrolledIds.has(s.id))
    setPickerStudents(filtered)
    setPickerLoading(false)
  }

  async function saveAddStudents() {
    if (pickerSelected.size === 0) { toast.error('Select at least one student'); return }
    setSavingPicker(true)
    const rows = Array.from(pickerSelected).map(student_id => ({
      batch_id: selectedBatch,
      student_id,
      enrolled_by: profile?.id || null,
    }))
    const { error } = await supabase.from('uce_batch_students').insert(rows)
    if (error) { toast.error('Failed to enroll students'); setSavingPicker(false); return }
    toast.success(`Added ${rows.length} student${rows.length > 1 ? 's' : ''}`)
    setAddOpen(false)
    setSavingPicker(false)
    fetchBatchData()
  }

  async function openAssignTeacher() {
    setTeacherOpen(true)
    setPickedTeacher('')
    let q = supabase.from('uce_employees')
      .select('id, name, phone, designation')
      .eq('is_active', true)
      .order('name')
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    const assignedIds = new Set(teachers.map(t => t.employee_id))
    const list = ((data ?? []) as unknown as Employee[]).filter(e => !assignedIds.has(e.id))
    setAvailTeachers(list)
  }

  async function saveAssignTeacher() {
    if (!pickedTeacher) { toast.error('Select a teacher'); return }
    setSavingTeacher(true)
    const { error } = await supabase.from('uce_batch_teachers').insert({
      batch_id: selectedBatch,
      employee_id: pickedTeacher,
      assigned_by: profile?.id || null,
    })
    if (error) { toast.error('Failed to assign teacher'); setSavingTeacher(false); return }
    toast.success('Teacher assigned')
    setTeacherOpen(false)
    setSavingTeacher(false)
    fetchBatchData()
  }

  async function removeEnrollment(row: BSRow) {
    const { error } = await supabase.from('uce_batch_students').delete().eq('id', row.id)
    if (error) { toast.error('Failed to remove'); return }
    toast.success('Removed')
    fetchBatchData()
  }
  async function removeTeacher(row: BTRow) {
    const { error } = await supabase.from('uce_batch_teachers').delete().eq('id', row.id)
    if (error) { toast.error('Failed to remove'); return }
    toast.success('Teacher removed')
    fetchBatchData()
  }

  const enrolledFiltered = useMemo(() => {
    if (!search) return enrolled
    const q = search.toLowerCase()
    return enrolled.filter(e =>
      e.student?.name.toLowerCase().includes(q) ||
      e.student?.registration_no.toLowerCase().includes(q) ||
      e.student?.phone?.toLowerCase().includes(q)
    )
  }, [enrolled, search])

  const pickerFiltered = useMemo(() => {
    if (!pickerSearch) return pickerStudents
    const q = pickerSearch.toLowerCase()
    return pickerStudents.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.registration_no.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    )
  }, [pickerStudents, pickerSearch])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Batch Enrollment</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Add students and assign teachers to batches</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Batch</label>
        <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
          className="w-full sm:max-w-md px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
          <option value="">Choose a batch…</option>
          {batches.map(b => (
            <option key={b.id} value={b.id}>{b.course?.code ? `[${b.course.code}] ` : ''}{b.name}</option>
          ))}
        </select>
      </div>

      {selectedBatch && (
        <>
          {/* Teachers card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-red-600" />
                <h3 className="font-semibold text-gray-900">Assigned Teachers ({teachers.length})</h3>
              </div>
              <button onClick={openAssignTeacher}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                <Plus size={14} /> Assign Teacher
              </button>
            </div>
            <div className="p-4">
              {teachers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No teachers assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {teachers.map(t => (
                    <div key={t.id} className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                      <span className="font-medium text-gray-900">{t.employee?.name}</span>
                      {t.employee?.designation && <span className="text-xs text-gray-500">· {t.employee.designation}</span>}
                      <button onClick={() => setDelTeacher(t)} className="text-gray-400 hover:text-red-600">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Students card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-red-600" />
                <h3 className="font-semibold text-gray-900">Enrolled Students ({enrolled.length})</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs w-44 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 focus:outline-none" />
                </div>
                <button onClick={openAddStudents}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                  <UserPlus size={14} /> Add Students
                </button>
              </div>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : enrolledFiltered.length === 0 ? (
              <p className="p-8 text-sm text-gray-400 text-center">No students enrolled yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Reg No.</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Phone</th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledFiltered.map(e => (
                      <tr key={e.id} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-mono text-xs">{e.student?.registration_no}</td>
                        <td className="px-4 py-2 font-medium">{e.student?.name}</td>
                        <td className="px-4 py-2 text-gray-600">{e.student?.phone}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => setDelEnrollment(e)} className="text-gray-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add students modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Students to Batch" size="lg">
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search students…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div className="text-xs text-gray-500">
            {pickerSelected.size} selected · {pickerFiltered.length} eligible students
          </div>
          <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-lg">
            {pickerLoading ? (
              <div className="p-6 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : pickerFiltered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No eligible students</p>
            ) : (
              pickerFiltered.map(s => {
                const checked = pickerSelected.has(s.id)
                return (
                  <label key={s.id}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-red-50/50' : ''}`}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setPickerSelected(p => {
                        const n = new Set(p); if (checked) n.delete(s.id); else n.add(s.id); return n
                      })}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.registration_no} · {s.phone}</p>
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
          <button onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={saveAddStudents} disabled={savingPicker || pickerSelected.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {savingPicker && <Loader2 size={14} className="animate-spin" />} Add {pickerSelected.size > 0 ? `${pickerSelected.size} ` : ''}Students
          </button>
        </div>
      </Modal>

      {/* Assign teacher modal */}
      <Modal open={teacherOpen} onClose={() => setTeacherOpen(false)} title="Assign Teacher" size="md">
        <div className="space-y-3">
          {availTeachers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No available teachers in your branch</p>
          ) : (
            <select value={pickedTeacher} onChange={e => setPickedTeacher(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="">Choose an employee…</option>
              {availTeachers.map(e => (
                <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>
              ))}
            </select>
          )}
          <p className="text-xs text-gray-500">
            Tip: Add the employee's role as <span className="font-mono bg-gray-100 px-1 rounded">teacher</span> in their profile so they can mark attendance after login.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
          <button onClick={() => setTeacherOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={saveAssignTeacher} disabled={savingTeacher || !pickedTeacher}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {savingTeacher && <Loader2 size={14} className="animate-spin" />} Assign
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!delEnrollment} onClose={() => setDelEnrollment(null)}
        onConfirm={async () => { if (delEnrollment) { await removeEnrollment(delEnrollment); setDelEnrollment(null) } }}
        title="Remove from batch?" message={`Remove ${delEnrollment?.student?.name || 'student'} from this batch?`} />
      <ConfirmDialog open={!!delTeacher} onClose={() => setDelTeacher(null)}
        onConfirm={async () => { if (delTeacher) { await removeTeacher(delTeacher); setDelTeacher(null) } }}
        title="Remove teacher?" message={`Unassign ${delTeacher?.employee?.name || 'teacher'} from this batch?`} />
    </div>
  )
}
