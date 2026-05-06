import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts'
import { ChevronLeft, ChevronRight, Loader2, CalendarCheck, Coffee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn, formatDateDDMMYYYY } from '../../lib/utils'
import type { StudentAttendanceStatus } from '../../types'

interface AttRow { date: string; status: StudentAttendanceStatus; leave_reason: string | null; batch?: { name: string } | null }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUS_COLOR: Record<StudentAttendanceStatus, string> = {
  present: 'bg-green-500 text-white',
  absent: 'bg-red-500 text-white',
  leave: 'bg-amber-500 text-white',
}

export default function StudentAttendancePage() {
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [studentId, setStudentId] = useState<string | null>(null)
  const [rows, setRows] = useState<AttRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('uce_students').select('id').eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => setStudentId(data?.id || null))
  }, [user?.id])

  useEffect(() => { if (studentId) load() }, [studentId, month, year])

  async function load() {
    if (!studentId) return
    setLoading(true)
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const { data } = await supabase.from('uce_student_attendance')
      .select('date, status, leave_reason, batch:uce_batches!uce_student_attendance_batch_id_fkey(name)')
      .eq('student_id', studentId)
      .gte('date', start).lte('date', end)
      .order('date')
    setRows((data ?? []) as unknown as AttRow[])
    setLoading(false)
  }

  const byDay = useMemo(() => {
    const m: Record<number, AttRow> = {}
    rows.forEach(r => { m[new Date(r.date + 'T00:00:00').getDate()] = r })
    return m
  }, [rows])

  const summary = useMemo(() => {
    let p = 0, a = 0, l = 0
    rows.forEach(r => {
      if (r.status === 'present') p++
      else if (r.status === 'absent') a++
      else if (r.status === 'leave') l++
    })
    const total = p + a + l
    const pct = total > 0 ? Math.round((p / total) * 100) : 0
    return { p, a, l, total, pct }
  }, [rows])

  const leaves = rows.filter(r => r.status === 'leave')
  const absences = rows.filter(r => r.status === 'absent')

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const pieData = [
    { name: 'Present', value: summary.p, color: '#10B981' },
    { name: 'Absent', value: summary.a, color: '#EF4444' },
    { name: 'Leave', value: summary.l, color: '#F59E0B' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">My Attendance</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Your daily attendance record</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard label="Total Days" value={summary.total} color="text-gray-900" />
        <KpiCard label="Present" value={summary.p} color="text-green-600" />
        <KpiCard label="Absent" value={summary.a} color="text-red-600" />
        <KpiCard label="Leave" value={summary.l} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"><ChevronLeft size={18} /></button>
            <h3 className="font-semibold text-gray-900">{MONTHS[month]} {year}</h3>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"><ChevronRight size={18} /></button>
          </div>
          <div className="p-3">
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5 text-[10px] font-semibold text-gray-400 uppercase mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: firstWeekday }, (_, i) => <div key={`b${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                    const r = byDay[d]
                    return (
                      <div key={d}
                        title={r?.leave_reason || (r?.status ? r.status : 'No record')}
                        className={cn(
                          'h-12 rounded-lg flex flex-col items-center justify-center text-xs font-medium border',
                          r ? STATUS_COLOR[r.status] + ' border-transparent' : 'bg-gray-50 border-gray-100 text-gray-400'
                        )}>
                        <span className="text-sm font-bold">{d}</span>
                        {r && <span className="text-[9px] opacity-90 uppercase">{r.status[0]}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100 text-xs">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-500" /> Present</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Absent</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500" /> Leave</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gray-100 border border-gray-200" /> No record</span>
                  {summary.pct > 0 && <span className="ml-auto font-semibold text-gray-700">Attendance: {summary.pct}%</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-3 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">This Month</h3>
          </div>
          <div className="p-3">
            {pieData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {leaves.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Coffee size={16} className="text-amber-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Leaves Taken</h3>
            <span className="ml-auto text-xs text-gray-500">{leaves.length} this month</span>
          </div>
          <div className="divide-y divide-gray-50">
            {leaves.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 grid place-items-center shrink-0">
                  <Coffee size={14} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{formatDateDDMMYYYY(r.date)}</p>
                  <p className="text-xs text-gray-600">{r.leave_reason || <span className="italic text-gray-400">No reason recorded</span>}</p>
                </div>
                {r.batch?.name && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">{r.batch.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {absences.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <CalendarCheck size={16} className="text-red-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Absences</h3>
            <span className="ml-auto text-xs text-gray-500">{absences.length} this month</span>
          </div>
          <div className="divide-y divide-gray-50">
            {absences.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="text-red-600 font-semibold">●</span>
                <span className="font-medium text-gray-900">{formatDateDDMMYYYY(r.date)}</span>
                {r.batch?.name && (
                  <span className="ml-auto text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.batch.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <p className={`text-[11px] font-medium uppercase tracking-wide ${color}`}>{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}
