import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { Loader2, Trophy, Users, CalendarCheck, AlertTriangle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface AttRow { student_id: string; batch_id: string; status: string; date: string }
interface BatchInfo { id: string; name: string; teacher: { name: string } | null; branch_id: string | null }
interface StudentInfo { id: string; name: string; registration_no: string; batch_id: string | null; branch_id: string }

const PRESENT = '#10B981'
const ABSENT = '#EF4444'
const LEAVE = '#F59E0B'

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
  const isTeacher = profile?.role === 'teacher'
  const branchId = profile?.branch_id

  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(todayStr())
  const [att, setAtt] = useState<AttRow[]>([])
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [from, to])

  async function fetchData() {
    setLoading(true)
    try {
      let bq = supabase.from('uce_batches')
        .select('id, name, branch_id, teacher_id, teacher:uce_employees!uce_batches_teacher_id_fkey(name)')
        .eq('is_active', true)

      if (isTeacher) {
        const { data: emp } = await supabase.from('uce_employees')
          .select('id').eq('auth_user_id', profile?.id).maybeSingle()
        if (emp) bq = bq.eq('teacher_id', emp.id)
        else { setBatches([]); setAtt([]); setStudents([]); setLoading(false); return }
      } else if (!isSuperAdmin && branchId) {
        bq = bq.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }
      const { data: bData } = await bq
      const batchRows = (bData ?? []) as unknown as BatchInfo[]
      setBatches(batchRows)
      const batchIds = batchRows.map(b => b.id)

      if (batchIds.length === 0) {
        setAtt([]); setStudents([]); setLoading(false); return
      }

      let sq = supabase.from('uce_students')
        .select('id, name, registration_no, batch_id, branch_id')
        .in('batch_id', batchIds).eq('is_active', true)
      if (!isSuperAdmin && branchId && !isTeacher) sq = sq.eq('branch_id', branchId)
      const { data: sData } = await sq
      setStudents((sData ?? []) as StudentInfo[])

      const { data: aData } = await supabase.from('uce_student_attendance')
        .select('student_id, batch_id, status, date')
        .in('batch_id', batchIds).gte('date', from).lte('date', to)
      setAtt((aData ?? []) as AttRow[])
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }

  // Summary totals
  const totals = useMemo(() => {
    let p = 0, a = 0, l = 0
    att.forEach(r => {
      if (r.status === 'present') p++
      else if (r.status === 'absent') a++
      else if (r.status === 'leave') l++
    })
    const total = p + a + l
    const rate = total > 0 ? Math.round((p / total) * 100) : 0
    return { p, a, l, total, rate }
  }, [att])

  // Per-batch stats sorted by attendance rate
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

  // Daily trend data (date -> %)
  const trend = useMemo(() => {
    const byDate: Record<string, { p: number; total: number }> = {}
    att.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { p: 0, total: 0 }
      byDate[r.date].total++
      if (r.status === 'present') byDate[r.date].p++
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, s]) => ({
        date: date.slice(5), // "MM-DD"
        rate: s.total > 0 ? Math.round((s.p / s.total) * 100) : 0,
      }))
  }, [att])

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

  const pieData = [
    { name: 'Present', value: totals.p, color: PRESENT },
    { name: 'Absent', value: totals.a, color: ABSENT },
    { name: 'Leave', value: totals.l, color: LEAVE },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Attendance Reports</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Performance analytics and trends</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={<TrendingUp size={18} />} label="Overall Rate" value={`${totals.rate}%`} color="text-red-600" />
            <KpiCard icon={<CalendarCheck size={18} />} label="Present" value={totals.p} color="text-green-600" />
            <KpiCard icon={<AlertTriangle size={18} />} label="Absent" value={totals.a} color="text-red-600" />
            <KpiCard icon={<Users size={18} />} label="On Leave" value={totals.l} color="text-amber-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Pie distribution */}
            <ChartCard title="Attendance Distribution">
              {totals.total === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Daily trend */}
            <ChartCard title="Daily Attendance %">
              {trend.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="rate" stroke={PRESENT} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Batch ranking bar */}
          <ChartCard title="Batch-Wise Attendance Rate">
            {batchStats.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, batchStats.length * 38)}>
                <BarChart data={batchStats} layout="vertical" margin={{ top: 10, right: 30, left: 90, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="rate" fill={PRESENT} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Batch table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Batch Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-12">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Batch</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Teacher</th>
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
                      <td className="px-4 py-2 text-gray-500">{b.teacher?.name || '—'}</td>
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
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student leaves table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Student Leave & Absence Tracker</h3>
              <p className="text-xs text-gray-500 mt-0.5">Sorted by total absences + leaves</p>
            </div>
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
                  {studentStats.slice(0, 50).map(s => (
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
        </>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className={`inline-flex items-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
      No data in selected range
    </div>
  )
}
