import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, CalendarCheck, CheckCircle, XCircle, Coffee } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import type { StudentAttendanceStatus } from '../../types'

interface Batch { id: string; name: string; course?: { name: string; code: string; created_by_branch_id: string | null } | null }
interface Student { id: string; name: string; registration_no: string }
interface ExistingMark { student_id: string; status: StudentAttendanceStatus; leave_reason: string | null }

const STATUS_META: Record<StudentAttendanceStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  present: { label: 'Present', color: 'bg-green-500 text-white', icon: CheckCircle },
  absent: { label: 'Absent', color: 'bg-red-500 text-white', icon: XCircle },
  leave: { label: 'Leave', color: 'bg-amber-500 text-white', icon: Coffee },
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MarkAttendancePage() {
  const { profile } = useAuth()
  const role = profile?.role
  const isTeacher = role === 'teacher'
  const isSuperAdmin = role === 'super_admin'
  const branchId = profile?.branch_id

  const [batches, setBatches] = useState<Batch[]>([])
  const [batchId, setBatchId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<Record<string, { status: StudentAttendanceStatus; leave_reason: string }>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchBatches() }, [])
  useEffect(() => { if (batchId && date) loadStudents() }, [batchId, date])

  async function fetchBatches() {
    setLoading(true)
    if (isTeacher) {
      // Resolve teacher's employee_id, then their batch ids
      const { data: emp } = await supabase.from('uce_employees')
        .select('id').eq('auth_user_id', profile?.id).maybeSingle()
      if (!emp) { setBatches([]); setLoading(false); return }
      const { data: bt } = await supabase.from('uce_batch_teachers')
        .select('batch_id, batch:uce_batches!uce_batch_teachers_batch_id_fkey(id, name, course:uce_courses!uce_batches_course_id_fkey(name, code, created_by_branch_id))')
        .eq('employee_id', emp.id)
      const list = (bt ?? []).map((r: { batch: unknown }) => r.batch as Batch).filter(Boolean)
      setBatches(list)
    } else {
      const { data } = await supabase.from('uce_batches')
        .select('id, name, course:uce_courses!uce_batches_course_id_fkey(name, code, created_by_branch_id)')
        .eq('is_active', true).order('name')
      let rows = (data ?? []) as unknown as Batch[]
      if (!isSuperAdmin && branchId) {
        rows = rows.filter(b => !b.course?.created_by_branch_id || b.course?.created_by_branch_id === branchId)
      }
      setBatches(rows)
    }
    setLoading(false)
  }

  async function loadStudents() {
    setLoading(true)
    const { data: bs } = await supabase.from('uce_batch_students')
      .select('student:uce_students!uce_batch_students_student_id_fkey(id, name, registration_no)')
      .eq('batch_id', batchId)
      .order('enrolled_at')
    const list = ((bs ?? []) as unknown as { student: Student }[]).map(r => r.student).filter(Boolean)
    setStudents(list)

    // Load existing attendance for date
    const { data: existing } = await supabase.from('uce_student_attendance')
      .select('student_id, status, leave_reason')
      .eq('batch_id', batchId).eq('date', date)
    const m: Record<string, { status: StudentAttendanceStatus; leave_reason: string }> = {}
    list.forEach(s => { m[s.id] = { status: 'present', leave_reason: '' } })
    ;(existing ?? []).forEach((r: ExistingMark) => {
      m[r.student_id] = { status: r.status, leave_reason: r.leave_reason || '' }
    })
    setMarks(m)
    setLoading(false)
  }

  function setAll(status: StudentAttendanceStatus) {
    setMarks(prev => {
      const n = { ...prev }
      students.forEach(s => { n[s.id] = { status, leave_reason: n[s.id]?.leave_reason || '' } })
      return n
    })
  }

  async function save() {
    if (!batchId || !date) return
    setSaving(true)
    const rows = students.map(s => {
      const m = marks[s.id] || { status: 'present' as StudentAttendanceStatus, leave_reason: '' }
      return {
        student_id: s.id,
        batch_id: batchId,
        date,
        status: m.status,
        leave_reason: m.status === 'leave' ? (m.leave_reason || null) : null,
        marked_by: profile?.id || null,
      }
    })
    const { error } = await supabase.from('uce_student_attendance')
      .upsert(rows, { onConflict: 'student_id,batch_id,date' })
    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success(`Saved ${rows.length} record${rows.length > 1 ? 's' : ''}`)
    setSaving(false)
  }

  const summary = useMemo(() => {
    let p = 0, a = 0, l = 0
    Object.values(marks).forEach(m => {
      if (m.status === 'present') p++
      else if (m.status === 'absent') a++
      else if (m.status === 'leave') l++
    })
    return { p, a, l, total: students.length }
  }, [marks, students.length])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Mark Attendance</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{isTeacher ? 'Your assigned batches' : 'Daily student attendance'}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Batch</label>
          <select value={batchId} onChange={e => setBatchId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="">Choose a batch…</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.course?.code ? `[${b.course.code}] ` : ''}{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
        </div>
      </div>

      {batchId && students.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-gray-500">Total: <b className="text-gray-900">{summary.total}</b></span>
              <span className="text-green-600">Present: <b>{summary.p}</b></span>
              <span className="text-red-600">Absent: <b>{summary.a}</b></span>
              <span className="text-amber-600">Leave: <b>{summary.l}</b></span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAll('present')} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium">All Present</button>
              <button onClick={() => setAll('absent')} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium">All Absent</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="max-h-[55vh] overflow-y-auto">
              {students.map(s => {
                const m = marks[s.id] || { status: 'present' as StudentAttendanceStatus, leave_reason: '' }
                return (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 sm:w-56">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{s.registration_no}</p>
                    </div>
                    <div className="flex gap-1.5 flex-1">
                      {(Object.keys(STATUS_META) as StudentAttendanceStatus[]).map(st => {
                        const meta = STATUS_META[st]
                        const Icon = meta.icon
                        const active = m.status === st
                        return (
                          <button key={st} type="button"
                            onClick={() => setMarks(p => ({ ...p, [s.id]: { ...m, status: st } }))}
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                              active ? `${meta.color} border-transparent` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            )}>
                            <Icon size={12} /> {meta.label}
                          </button>
                        )
                      })}
                    </div>
                    {m.status === 'leave' && (
                      <input type="text" placeholder="Leave reason…" value={m.leave_reason}
                        onChange={e => setMarks(p => ({ ...p, [s.id]: { ...m, leave_reason: e.target.value } }))}
                        className="text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 w-full sm:w-52 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 focus:outline-none" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end p-3 border-t border-gray-100 bg-gray-50/50">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Attendance
              </button>
            </div>
          </div>
        </>
      )}

      {batchId && !loading && students.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <CalendarCheck size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No students enrolled in this batch yet.</p>
        </div>
      )}
    </div>
  )
}
