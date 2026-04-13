import { useEffect, useState, useMemo } from 'react'
import {
  CalendarCheck, Loader2, Check, Table2, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import Modal from '../../components/Modal'

interface EmpRow {
  id: string; name: string; department?: { name: string } | null
}

interface AttendanceRecord {
  id: string; employee_id: string; date: string; status: string; note: string | null
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS = Array.from({ length: 10 }, (_, i) => 2024 + i)
const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-500 text-white',
  absent: 'bg-red-500 text-white',
  half_day: 'bg-amber-400 text-white',
  leave: 'bg-blue-500 text-white',
}
const STATUS_SHORT: Record<string, string> = { present: 'P', absent: 'A', half_day: 'H', leave: 'L' }

export default function AttendancePage() {
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')

  const [employees, setEmployees] = useState<EmpRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Mark modal
  const [markOpen, setMarkOpen] = useState(false)
  const [markDate, setMarkDate] = useState('')
  const [markData, setMarkData] = useState<Record<string, { status: string; note: string }>>({})
  const [saving, setSaving] = useState(false)

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => { fetchData() }, [month, year])

  async function fetchData() {
    setLoading(true)
    try {
      let eq = supabase.from('uce_employees').select('id, name, department:uce_departments(name)').eq('is_active', true)
      if (!isSuperAdmin && branchId) eq = eq.eq('branch_id', branchId)
      const { data: empData, error: empErr } = await eq.order('name')
      if (empErr) throw empErr

      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      const empIds = (empData ?? []).map(e => e.id)

      let attData: AttendanceRecord[] = []
      if (empIds.length > 0) {
        const { data, error } = await supabase.from('uce_attendance').select('*').in('employee_id', empIds).gte('date', startDate).lte('date', endDate)
        if (error) throw error
        attData = data ?? []
      }

      setEmployees((empData ?? []) as unknown as EmpRow[])
      setAttendance(attData)
    } catch { toast.error('Failed to load attendance data') }
    finally { setLoading(false) }
  }

  // Build lookup: employee_id -> day -> record
  const attMap = useMemo(() => {
    const m: Record<string, Record<number, AttendanceRecord>> = {}
    attendance.forEach(a => {
      const day = new Date(a.date).getDate()
      if (!m[a.employee_id]) m[a.employee_id] = {}
      m[a.employee_id][day] = a
    })
    return m
  }, [attendance])

  function openMarkAttendance() {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setMarkDate(dateStr)

    // Pre-fill with existing data for today
    const day = today.getDate()
    const prefill: Record<string, { status: string; note: string }> = {}
    employees.forEach(e => {
      const existing = attMap[e.id]?.[day]
      prefill[e.id] = { status: existing?.status || 'present', note: existing?.note || '' }
    })
    setMarkData(prefill)
    setMarkOpen(true)
  }

  function openMarkForDate(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setMarkDate(dateStr)

    const prefill: Record<string, { status: string; note: string }> = {}
    employees.forEach(e => {
      const existing = attMap[e.id]?.[day]
      prefill[e.id] = { status: existing?.status || 'present', note: existing?.note || '' }
    })
    setMarkData(prefill)
    setMarkOpen(true)
  }

  async function handleSaveAttendance() {
    setSaving(true)
    try {
      const upserts = Object.entries(markData).map(([empId, { status, note }]) => ({
        employee_id: empId,
        date: markDate,
        status,
        note: note || null,
        marked_by: user?.id || null,
      }))

      const { error } = await supabase.from('uce_attendance').upsert(upserts, { onConflict: 'employee_id,date' })
      if (error) throw error
      toast.success('Attendance saved')
      setMarkOpen(false)
      fetchData()
    } catch { toast.error('Failed to save attendance') }
    finally { setSaving(false) }
  }

  // Summary per employee
  function getSummary(empId: string) {
    const days = attMap[empId] || {}
    let p = 0, a = 0, h = 0, l = 0
    Object.values(days).forEach(r => {
      if (r.status === 'present') p++
      else if (r.status === 'absent') a++
      else if (r.status === 'half_day') h++
      else if (r.status === 'leave') l++
    })
    return { p, a, h, l }
  }

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const formattedMarkDate = markDate ? new Date(markDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Attendance</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{employees.length} employees</p>
        </div>
        <button onClick={openMarkAttendance} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <CalendarCheck size={16} /> Mark Attendance for Today
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden ml-auto">
            <button onClick={() => setViewMode('table')} className={cn('px-3 py-2 text-xs font-medium flex items-center gap-1.5', viewMode === 'table' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              <Table2 size={14} /> Table
            </button>
            <button onClick={() => setViewMode('calendar')} className={cn('px-3 py-2 text-xs font-medium flex items-center gap-1.5', viewMode === 'calendar' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              <CalendarDays size={14} /> Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-500" /> Present</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Absent</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-400" /> Half Day</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-500" /> Leave</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-400 mt-2">Loading...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <CalendarCheck size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No active employees found</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2.5 font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[140px]">Employee</th>
                  {dayHeaders.map(d => (
                    <th key={d} className="text-center px-0.5 py-2.5 font-medium text-gray-500 min-w-[28px] cursor-pointer hover:bg-gray-100" onClick={() => openMarkForDate(d)}>{d}</th>
                  ))}
                  <th className="text-center px-2 py-2.5 font-medium text-green-600 min-w-[28px]">P</th>
                  <th className="text-center px-2 py-2.5 font-medium text-red-600 min-w-[28px]">A</th>
                  <th className="text-center px-2 py-2.5 font-medium text-amber-600 min-w-[28px]">H</th>
                  <th className="text-center px-2 py-2.5 font-medium text-blue-600 min-w-[28px]">L</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const days = attMap[emp.id] || {}
                  const summary = getSummary(emp.id)
                  return (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2 sticky left-0 bg-white z-10">
                        <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-[10px] text-gray-400">{(emp.department as { name: string } | null)?.name || ''}</p>
                      </td>
                      {dayHeaders.map(d => {
                        const rec = days[d]
                        return (
                          <td key={d} className="text-center px-0.5 py-2">
                            {rec ? (
                              <span className={cn('inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold', STATUS_COLORS[rec.status] || 'bg-gray-200')}>
                                {STATUS_SHORT[rec.status] || '?'}
                              </span>
                            ) : <span className="text-gray-200">·</span>}
                          </td>
                        )
                      })}
                      <td className="text-center px-2 py-2 font-semibold text-green-600">{summary.p || '—'}</td>
                      <td className="text-center px-2 py-2 font-semibold text-red-600">{summary.a || '—'}</td>
                      <td className="text-center px-2 py-2 font-semibold text-amber-600">{summary.h || '—'}</td>
                      <td className="text-center px-2 py-2 font-semibold text-blue-600">{summary.l || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── CALENDAR VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => {
            const days = attMap[emp.id] || {}
            const summary = getSummary(emp.id)
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-400">{(emp.department as { name: string } | null)?.name || ''}</p>
                  </div>
                  <div className="flex gap-1.5 text-[10px] font-bold">
                    <span className="text-green-600">{summary.p}P</span>
                    <span className="text-red-600">{summary.a}A</span>
                    <span className="text-amber-600">{summary.h}H</span>
                    <span className="text-blue-600">{summary.l}L</span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {dayHeaders.map(d => {
                    const rec = days[d]
                    return (
                      <div key={d} className={cn('h-7 w-full rounded flex items-center justify-center text-[10px] font-bold', rec ? STATUS_COLORS[rec.status] : 'bg-gray-100 text-gray-400')}>
                        {d}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mark Attendance Modal */}
      <Modal open={markOpen} onClose={() => setMarkOpen(false)} title={`Mark Attendance — ${formattedMarkDate}`} size="lg">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {employees.map(emp => {
            const data = markData[emp.id] || { status: 'present', note: '' }
            return (
              <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="min-w-[140px]">
                  <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                  <p className="text-xs text-gray-400">{(emp.department as { name: string } | null)?.name || ''}</p>
                </div>
                <div className="flex gap-1.5 flex-1">
                  {(['present', 'absent', 'half_day', 'leave'] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => setMarkData(p => ({ ...p, [emp.id]: { ...p[emp.id], status: s } }))}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        data.status === s ? STATUS_COLORS[s] + ' border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                      )}>
                      {STATUS_SHORT[s]}
                    </button>
                  ))}
                </div>
                {(data.status === 'absent' || data.status === 'leave') && (
                  <input type="text" placeholder="Note..." value={data.note}
                    onChange={e => setMarkData(p => ({ ...p, [emp.id]: { ...p[emp.id], note: e.target.value } }))}
                    className="text-xs rounded-lg border border-gray-200 px-2.5 py-1.5 w-full sm:w-40 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 focus:outline-none" />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
          <button onClick={() => setMarkOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSaveAttendance} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Attendance
          </button>
        </div>
      </Modal>
    </div>
  )
}
