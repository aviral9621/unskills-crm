import { useEffect, useMemo, useState } from 'react'
import { Loader2, BarChart3, UserX, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface AttRow { student_id: string; batch_id: string; status: string; date: string }
interface BatchInfo { id: string; name: string; course?: { name: string; code: string; created_by_branch_id: string | null } | null }
interface StudentInfo { id: string; name: string; registration_no: string; batch_id: string | null; branch_id: string }

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AttendanceReportsPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [att, setAtt] = useState<AttRow[]>([])
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'batches' | 'students'>('batches')

  useEffect(() => { fetchData() }, [from, to])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: bData } = await supabase.from('uce_batches')
        .select('id, name, course:uce_courses!uce_batches_course_id_fkey(name, code, created_by_branch_id)')
        .eq('is_active', true)
      let batchRows = (bData ?? []) as unknown as BatchInfo[]
      if (!isSuperAdmin && branchId) {
        batchRows = batchRows.filter(b => !b.course?.created_by_branch_id || b.course?.created_by_branch_id === branchId)
      }
      setBatches(batchRows)
      const batchIds = batchRows.map(b => b.id)

      if (batchIds.length === 0) {
        setAtt([]); setStudents([]); setLoading(false); return
      }

      let sq = supabase.from('uce_students')
        .select('id, name, registration_no, batch_id, branch_id').eq('is_active', true)
      if (!isSuperAdmin && branchId) sq = sq.eq('branch_id', branchId)
      const { data: sData } = await sq
      setStudents((sData ?? []) as StudentInfo[])

      const { data: aData } = await supabase.from('uce_student_attendance')
        .select('student_id, batch_id, status, date')
        .in('batch_id', batchIds)
        .gte('date', from).lte('date', to)
      setAtt((aData ?? []) as AttRow[])
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }

  // Per-batch stats: present/total
  const batchStats = useMemo(() => {
    const map: Record<string, { p: number; a: number; l: number; total: number }> = {}
    batches.forEach(b => { map[b.id] = { p: 0, a: 0, l: 0, total: 0 } })
    att.forEach(r => {
      if (!map[r.batch_id]) map[r.batch_id] = { p: 0, a: 0, l: 0, total: 0 }
      map[r.batch_id].total++
      if (r.status === 'present') map[r.batch_id].p++
      else if (r.status === 'absent') map[r.batch_id].a++
      else if (r.status === 'leave') map[r.batch_id].l++
    })
    return batches.map(b => {
      const s = map[b.id]
      const rate = s.total > 0 ? Math.round((s.p / s.total) * 100) : 0
      return { ...b, ...s, rate }
    }).sort((a, b) => b.rate - a.rate)
  }, [att, batches])

  // Per-student leave/absence counts
  const studentStats = useMemo(() => {
    const studentMap = new Map(students.map(s => [s.id, s]))
    const map: Record<string, { p: number; a: number; l: number }> = {}
    att.forEach(r => {
      if (!map[r.student_id]) map[r.student_id] = { p: 0, a: 0, l: 0 }
      if (r.status === 'present') map[r.student_id].p++
      else if (r.status === 'absent') map[r.student_id].a++
      else if (r.status === 'leave') map[r.student_id].l++
    })
    return Object.entries(map)
      .map(([sid, s]) => ({ student: studentMap.get(sid), ...s }))
      .filter(r => r.student)
      .sort((a, b) => (b.l + b.a) - (a.l + a.a))
  }, [att, students])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Attendance Reports</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Batch performance and student leave patterns</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
        </div>
        <div className="flex gap-1 ml-auto rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setTab('batches')}
            className={`px-3 py-2 text-xs font-medium ${tab === 'batches' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <BarChart3 size={14} className="inline -mt-0.5 mr-1" />Batches
          </button>
          <button onClick={() => setTab('students')}
            className={`px-3 py-2 text-xs font-medium ${tab === 'students' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <UserX size={14} className="inline -mt-0.5 mr-1" />Students
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : tab === 'batches' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Batch</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Course</th>
                  <th className="text-right px-4 py-2.5 font-medium text-green-600">Present</th>
                  <th className="text-right px-4 py-2.5 font-medium text-red-600">Absent</th>
                  <th className="text-right px-4 py-2.5 font-medium text-amber-600">Leave</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Rate</th>
                </tr>
              </thead>
              <tbody>
                {batchStats.map((b, i) => (
                  <tr key={b.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-400">
                      {i === 0 && b.total > 0 ? <Trophy size={14} className="text-amber-500" /> : i + 1}
                    </td>
                    <td className="px-4 py-2 font-medium">{b.name}</td>
                    <td className="px-4 py-2 text-gray-500">{b.course?.name}</td>
                    <td className="px-4 py-2 text-right text-green-600 font-semibold">{b.p}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-semibold">{b.a}</td>
                    <td className="px-4 py-2 text-right text-amber-600 font-semibold">{b.l}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${b.rate >= 75 ? 'bg-green-100 text-green-700' : b.rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {b.total > 0 ? `${b.rate}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {batchStats.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No batches found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Student</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Reg No.</th>
                  <th className="text-right px-4 py-2.5 font-medium text-green-600">Present</th>
                  <th className="text-right px-4 py-2.5 font-medium text-red-600">Absent</th>
                  <th className="text-right px-4 py-2.5 font-medium text-amber-600">Leave</th>
                </tr>
              </thead>
              <tbody>
                {studentStats.map(s => (
                  <tr key={s.student!.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">{s.student!.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.student!.registration_no}</td>
                    <td className="px-4 py-2 text-right text-green-600 font-semibold">{s.p}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-semibold">{s.a}</td>
                    <td className="px-4 py-2 text-right text-amber-600 font-semibold">{s.l}</td>
                  </tr>
                ))}
                {studentStats.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No attendance data in selected range</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
