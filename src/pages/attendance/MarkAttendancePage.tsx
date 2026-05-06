import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, ArrowLeft, CheckCircle, XCircle, Coffee, Users, Clock, Calendar, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import Modal from '../../components/Modal'
import type { StudentAttendanceStatus } from '../../types'

interface BatchCard {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
  start_date: string | null
  end_date: string | null
  max_students: number | null
  teacher: { id: string; name: string } | null
  enrolled: number
}
interface Student { id: string; name: string; registration_no: string; photo_url: string | null }

const STATUS_META: Record<StudentAttendanceStatus, { label: string; color: string; icon: typeof CheckCircle; light: string }> = {
  present: { label: 'Present', color: 'bg-green-500 text-white', light: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  absent:  { label: 'Absent',  color: 'bg-red-500 text-white',   light: 'bg-red-50 text-red-700 border-red-200',     icon: XCircle },
  leave:   { label: 'Leave',   color: 'bg-amber-500 text-white', light: 'bg-amber-50 text-amber-700 border-amber-200', icon: Coffee },
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ap = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ap}`
}

export default function MarkAttendancePage() {
  const { profile } = useAuth()
  const role = profile?.role
  const isTeacher = role === 'teacher'
  const isSuperAdmin = role === 'super_admin'
  const branchId = profile?.branch_id

  const [batches, setBatches] = useState<BatchCard[]>([])
  const [loadingBatches, setLoadingBatches] = useState(true)

  // Step 2 state
  const [selectedBatch, setSelectedBatch] = useState<BatchCard | null>(null)
  const [date, setDate] = useState(todayStr())
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<Record<string, { status: StudentAttendanceStatus; leave_reason: string }>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)

  // Leave reason modal
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveStudent, setLeaveStudent] = useState<Student | null>(null)
  const [leaveReason, setLeaveReason] = useState('')

  useEffect(() => { loadBatches() }, [])
  useEffect(() => { if (selectedBatch && date) loadStudents() }, [selectedBatch?.id, date])

  async function loadBatches() {
    setLoadingBatches(true)
    let bq = supabase.from('uce_batches')
      .select('id, name, start_time, end_time, start_date, end_date, max_students, branch_id, teacher_id, teacher:uce_employees!uce_batches_teacher_id_fkey(id, name)')
      .eq('is_active', true)
      .order('name')

    if (isTeacher) {
      const { data: emp } = await supabase.from('uce_employees')
        .select('id').eq('auth_user_id', profile?.id).maybeSingle()
      if (!emp) { setBatches([]); setLoadingBatches(false); return }
      bq = bq.eq('teacher_id', emp.id)
    } else if (!isSuperAdmin && branchId) {
      bq = bq.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const [bRes, cntRes] = await Promise.all([
      bq,
      supabase.from('uce_students').select('batch_id').not('batch_id', 'is', null),
    ])
    const counts: Record<string, number> = {}
    ;(cntRes.data ?? []).forEach((r: { batch_id: string | null }) => {
      if (r.batch_id) counts[r.batch_id] = (counts[r.batch_id] || 0) + 1
    })
    type RawBatch = Omit<BatchCard, 'enrolled'>
    const list: BatchCard[] = ((bRes.data ?? []) as unknown as RawBatch[]).map(b => ({
      ...b,
      enrolled: counts[b.id] || 0,
    }))
    setBatches(list)
    setLoadingBatches(false)
  }

  async function loadStudents() {
    if (!selectedBatch) return
    setLoadingStudents(true)
    setPicked(new Set())
    const { data: sData } = await supabase.from('uce_students')
      .select('id, name, registration_no, photo_url')
      .eq('batch_id', selectedBatch.id)
      .eq('is_active', true)
      .order('name')
    const list = (sData ?? []) as Student[]
    setStudents(list)

    const { data: existing } = await supabase.from('uce_student_attendance')
      .select('student_id, status, leave_reason')
      .eq('batch_id', selectedBatch.id).eq('date', date)
    const m: Record<string, { status: StudentAttendanceStatus; leave_reason: string }> = {}
    list.forEach(s => { m[s.id] = { status: 'present', leave_reason: '' } })
    ;(existing ?? []).forEach((r: { student_id: string; status: StudentAttendanceStatus; leave_reason: string | null }) => {
      m[r.student_id] = { status: r.status, leave_reason: r.leave_reason || '' }
    })
    setMarks(m)
    setLoadingStudents(false)
  }

  function togglePick(id: string) {
    setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function pickAll() {
    if (picked.size === students.length) setPicked(new Set())
    else setPicked(new Set(students.map(s => s.id)))
  }

  function bulkMark(status: 'present' | 'absent') {
    const ids = picked.size > 0 ? Array.from(picked) : students.map(s => s.id)
    setMarks(prev => {
      const n = { ...prev }
      ids.forEach(id => { n[id] = { status, leave_reason: '' } })
      return n
    })
    setPicked(new Set())
  }

  function openLeaveFor(s: Student) {
    setLeaveStudent(s)
    setLeaveReason(marks[s.id]?.leave_reason || '')
    setLeaveOpen(true)
  }

  function saveLeave() {
    if (!leaveStudent) return
    if (!leaveReason.trim()) { toast.error('Please enter a leave reason'); return }
    setMarks(prev => ({ ...prev, [leaveStudent.id]: { status: 'leave', leave_reason: leaveReason.trim() } }))
    setLeaveOpen(false)
    setLeaveStudent(null)
    setLeaveReason('')
  }

  async function save() {
    if (!selectedBatch) return
    setSaving(true)
    const rows = students.map(s => {
      const m = marks[s.id] || { status: 'present' as StudentAttendanceStatus, leave_reason: '' }
      return {
        student_id: s.id,
        batch_id: selectedBatch.id,
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
    return { p, a, l }
  }, [marks])

  // Step 1: pick a batch
  if (!selectedBatch) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Student Attendance</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Pick a batch to mark today's attendance</p>
        </div>

        {loadingBatches ? (
          <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading batches…
          </div>
        ) : batches.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Users size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">{isTeacher ? 'No batches assigned to you yet.' : 'No active batches found.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {batches.map(b => {
              const cap = b.max_students || 0
              const full = cap > 0 && b.enrolled >= cap
              return (
                <button key={b.id} onClick={() => setSelectedBatch(b)}
                  className="text-left bg-white rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-md transition-all p-4 group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-gray-900 group-hover:text-red-600 truncate">{b.name}</h3>
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap',
                      full ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    )}>
                      {b.enrolled}{cap > 0 ? `/${cap}` : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    {b.teacher && (
                      <div className="flex items-center gap-1.5"><GraduationCap size={12} className="text-red-500" /> {b.teacher.name}</div>
                    )}
                    {(b.start_time || b.end_time) && (
                      <div className="flex items-center gap-1.5"><Clock size={12} /> {fmtTime(b.start_time)} – {fmtTime(b.end_time)}</div>
                    )}
                    {(b.start_date || b.end_date) && (
                      <div className="flex items-center gap-1.5"><Calendar size={12} /> {b.start_date || '—'} → {b.end_date || 'ongoing'}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Step 2: mark attendance
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedBatch(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">{selectedBatch.name}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {selectedBatch.teacher?.name && <>Teacher: {selectedBatch.teacher.name} · </>}
            {students.length} students
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Date:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/20 focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <span className="text-xs text-gray-500">
            <b className="text-green-600">{summary.p}P</b> · <b className="text-red-600">{summary.a}A</b> · <b className="text-amber-600">{summary.l}L</b>
          </span>
        </div>
      </div>

      {students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-700 font-medium">
            <input type="checkbox" checked={picked.size === students.length} onChange={pickAll}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            {picked.size === 0 ? 'Select students' : `${picked.size} selected`}
          </label>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkMark('present')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700">
              <CheckCircle size={12} /> Mark {picked.size > 0 ? `Selected (${picked.size})` : 'All'} Present
            </button>
            <button onClick={() => bulkMark('absent')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700">
              <XCircle size={12} /> Mark {picked.size > 0 ? 'Selected' : 'All'} Absent
            </button>
          </div>
        </div>
      )}

      {loadingStudents ? (
        <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading students…
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Users size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No students in this batch yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {students.map(s => {
            const m = marks[s.id] || { status: 'present' as StudentAttendanceStatus, leave_reason: '' }
            const meta = STATUS_META[m.status]
            const isPicked = picked.has(s.id)
            return (
              <div key={s.id} className={cn(
                'flex items-center gap-3 p-3 border-b border-gray-50 last:border-0',
                isPicked ? 'bg-red-50/50' : ''
              )}>
                <input type="checkbox" checked={isPicked} onChange={() => togglePick(s.id)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0" />
                {s.photo_url ? (
                  <img src={s.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-100 shrink-0 grid place-items-center text-xs font-bold text-gray-500">
                    {s.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                  <p className="text-[11px] text-gray-500 font-mono">{s.registration_no}</p>
                  {m.status === 'leave' && m.leave_reason && (
                    <p className="text-[11px] text-amber-600 truncate mt-0.5"><Coffee size={10} className="inline" /> {m.leave_reason}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {(['present', 'absent'] as const).map(st => {
                    const mt = STATUS_META[st]
                    const Icon = mt.icon
                    const active = m.status === st
                    return (
                      <button key={st} type="button"
                        onClick={() => setMarks(p => ({ ...p, [s.id]: { status: st, leave_reason: '' } }))}
                        title={mt.label}
                        className={cn('inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
                          active ? `${mt.color} border-transparent` : 'bg-white border-gray-200 text-gray-400 hover:text-gray-700')}>
                        <Icon size={14} />
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => openLeaveFor(s)} title="Leave"
                    className={cn('inline-flex items-center justify-center h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors',
                      m.status === 'leave' ? `${meta.color} border-transparent` : 'bg-white border-gray-200 text-gray-400 hover:text-gray-700')}>
                    <Coffee size={12} className="mr-1" /> Leave
                  </button>
                </div>
              </div>
            )
          })}
          <div className="flex justify-end p-3 border-t border-gray-100 bg-gray-50/50">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Attendance
            </button>
          </div>
        </div>
      )}

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Mark Leave" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Marking <b>{leaveStudent?.name}</b> on leave for {date}.</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason for leave *</label>
            <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
              rows={3} placeholder="e.g. Medical appointment, family function…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
          <button onClick={() => setLeaveOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={saveLeave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700">
            <Coffee size={14} /> Mark Leave
          </button>
        </div>
      </Modal>
    </div>
  )
}
