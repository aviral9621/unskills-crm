import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, CalendarCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import type { StudentAttendanceStatus } from '../../types'

interface AttRow { date: string; status: StudentAttendanceStatus; leave_reason: string | null }

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
      .select('date, status, leave_reason')
      .eq('student_id', studentId)
      .gte('date', start).lte('date', end)
      .order('date')
    setRows((data ?? []) as AttRow[])
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

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">My Attendance</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Your daily attendance record</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white rounded-xl border p-3">
          <p className="text-[11px] text-gray-500">Total Days</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-[11px] text-green-600">Present</p>
          <p className="text-2xl font-bold text-green-600 mt-0.5">{summary.p}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-[11px] text-red-600">Absent</p>
          <p className="text-2xl font-bold text-red-600 mt-0.5">{summary.a}</p>
        </div>
        <div className="bg-white rounded-xl border p-3">
          <p className="text-[11px] text-amber-600">Leave</p>
          <p className="text-2xl font-bold text-amber-600 mt-0.5">{summary.l}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
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

      {!loading && rows.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <CalendarCheck size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No attendance recorded for this month.</p>
        </div>
      )}
    </div>
  )
}
