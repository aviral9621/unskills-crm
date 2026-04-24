import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, IndianRupee, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatINR } from '../../../lib/utils'
import { inputClass } from '../../../components/FormField'

interface Row {
  id: string
  name: string
  registration_no: string
  net_fee: number
  fee_start_month: string | null
  installment_count: number | null
  monthly_fee: number | null
  branch: { id: string; name: string; code: string } | null
  course: { id: string; name: string } | null
  paid: number
  overdue_count: number
  next_due: { month_for: string; expected_amount: number } | null
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default function AdminFeesOverviewPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([])

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    const [stRes, brRes] = await Promise.all([
      supabase.from('uce_students')
        .select('id,name,registration_no,net_fee,fee_start_month,installment_count,monthly_fee,branch:uce_branches(id,name,code),course:uce_courses(id,name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('uce_branches').select('id,name,code').eq('is_active', true).order('name'),
    ])
    const students = (stRes.data ?? []) as unknown as Row[]
    setBranches((brRes.data ?? []) as { id: string; name: string; code: string }[])
    if (students.length === 0) { setRows([]); setLoading(false); return }

    const ids = students.map(s => s.id)
    const [paysRes, schedRes] = await Promise.all([
      supabase.from('uce_student_fee_payments')
        .select('student_id,amount,schedule_id,is_adjustment,status')
        .in('student_id', ids),
      supabase.from('uce_student_fee_schedule')
        .select('id,student_id,month_for,expected_amount')
        .in('student_id', ids)
        .order('month_for', { ascending: true }),
    ])

    const paidByStudent: Record<string, number> = {}
    const paidBySchedule: Record<string, number> = {}
    ;(paysRes.data ?? []).forEach(p => {
      if (p.is_adjustment || p.status === 'rejected') return
      paidByStudent[p.student_id!] = (paidByStudent[p.student_id!] || 0) + Number(p.amount)
      if (p.schedule_id) paidBySchedule[p.schedule_id] = (paidBySchedule[p.schedule_id] || 0) + Number(p.amount)
    })

    const schedByStudent: Record<string, { id: string; month_for: string; expected_amount: number }[]> = {}
    ;(schedRes.data ?? []).forEach(r => {
      const list = schedByStudent[r.student_id!] || (schedByStudent[r.student_id!] = [])
      list.push({ id: r.id, month_for: r.month_for as string, expected_amount: Number(r.expected_amount) })
    })

    const today = new Date().toISOString().slice(0, 10)
    const enriched = students.map(s => {
      const sched = schedByStudent[s.id] || []
      let overdue = 0
      let nextDue: Row['next_due'] = null
      for (const r of sched) {
        const paid = paidBySchedule[r.id] || 0
        if (paid >= r.expected_amount) continue
        if (r.month_for <= today) overdue += 1
        if (!nextDue || r.month_for < nextDue.month_for) nextDue = { month_for: r.month_for, expected_amount: r.expected_amount - paid }
      }
      return { ...s, paid: paidByStudent[s.id] || 0, overdue_count: overdue, next_due: nextDue }
    })
    setRows(enriched)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let list = rows
    if (branchFilter) list = list.filter(r => r.branch?.id === branchFilter)
    if (overdueOnly) list = list.filter(r => r.overdue_count > 0)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(r =>
      r.name.toLowerCase().includes(q) || r.registration_no.toLowerCase().includes(q),
    )
    return list
  }, [rows, branchFilter, overdueOnly, search])

  const totals = useMemo(() => {
    const expected = filtered.reduce((s, r) => s + Number(r.net_fee || 0), 0)
    const paid = filtered.reduce((s, r) => s + r.paid, 0)
    const overdueStudents = filtered.filter(r => r.overdue_count > 0).length
    return { expected, paid, due: Math.max(0, expected - paid), overdueStudents }
  }, [filtered])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-heading flex items-center gap-2"><IndianRupee size={22} className="text-red-600" /> Fees Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitor fee plans and collections across all branches.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Students" value={String(filtered.length)} tone="blue" />
        <Stat label="Expected" value={formatINR(totals.expected)} tone="blue" />
        <Stat label="Paid" value={formatINR(totals.paid)} tone="green" />
        <Stat label="Overdue" value={String(totals.overdueStudents)} tone="red" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search student name or reg no…" />
        </div>
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className={`${inputClass} sm:w-56`}>
          <option value="">All branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
        </select>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
          <AlertTriangle size={14} className="text-amber-600" /> Overdue only
        </label>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Paid / Net</th>
              <th className="px-4 py-3">Next Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No students match your filters.</td></tr>
            )}
            {!loading && filtered.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{r.registration_no}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.branch?.name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.course?.name || '—'}</td>
                <td className="px-4 py-3">
                  {r.installment_count && r.installment_count > 0
                    ? <span className="text-xs text-gray-700">{r.installment_count} × {formatINR(Number(r.monthly_fee) || (Number(r.net_fee) / r.installment_count))}<br/><span className="text-gray-400">from {r.fee_start_month ? monthLabel(r.fee_start_month) : '—'}</span></span>
                    : <span className="text-xs text-gray-400 italic">No plan</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-green-700 font-semibold">{formatINR(r.paid)}</span>
                  <span className="text-gray-400"> / {formatINR(r.net_fee)}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.next_due
                    ? <span>{monthLabel(r.next_due.month_for)} · <b>{formatINR(r.next_due.expected_amount)}</b></span>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  {r.overdue_count > 0
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-semibold"><AlertTriangle size={10} /> {r.overdue_count} OVERDUE</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-semibold"><CheckCircle2 size={10} /> ON TRACK</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/fees/${r.id}`} className="text-xs font-semibold text-red-600 hover:underline">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'red' }) {
  const c = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  return (
    <div className={`rounded-xl p-3 sm:p-4 ${c}`}>
      <p className="text-[10px] sm:text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 font-heading text-base sm:text-lg font-bold break-words">{value}</p>
    </div>
  )
}
