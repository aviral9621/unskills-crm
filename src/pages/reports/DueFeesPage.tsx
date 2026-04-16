import { useEffect, useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { AlertTriangle, Search, X, Download, Phone, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR } from '../../lib/utils'
import DataTable from '../../components/DataTable'

interface DueRow {
  id: string; registration_no: string; name: string; phone: string
  course_name: string; branch_name: string; branch_id: string; course_id: string
  net_fee: number; paid: number; due: number; enrollment_date: string
  months_since: number; monthly_fee: number; months_due: number
}
interface FilterOption { id: string; name: string }

const col = createColumnHelper<DueRow>()

export default function DueFeesPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [rows, setRows] = useState<DueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<FilterOption[]>([])
  const [courses, setCourses] = useState<FilterOption[]>([])
  const [search, setSearch] = useState('')
  const [branchF, setBranchF] = useState('')
  const [courseF, setCourseF] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [br, cr] = await Promise.all([
        supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('uce_courses').select('id, name, duration_months').eq('is_active', true).order('name'),
      ])
      setBranches(br.data ?? []); setCourses(cr.data ?? [])

      let sq = supabase.from('uce_students').select(`id, registration_no, name, phone, net_fee, enrollment_date, branch_id, course_id, course:uce_courses(name, duration_months), branch:uce_branches(name)`).eq('is_active', true)
      if (!isSuperAdmin && profile?.branch_id) sq = sq.eq('branch_id', profile.branch_id)
      const { data: students, error } = await sq
      if (error) throw error

      const ids = (students ?? []).map((s: { id: string }) => s.id)
      const paid: Record<string, number> = {}
      for (let i = 0; i < ids.length; i += 200) {
        const { data: p } = await supabase.from('uce_student_fee_payments').select('student_id, amount').in('student_id', ids.slice(i, i + 200))
        p?.forEach(r => { paid[r.student_id] = (paid[r.student_id] || 0) + r.amount })
      }

      const now = new Date()
      const result: DueRow[] = []
      ;(students ?? []).forEach((s: Record<string, unknown>) => {
        const netFee = (s.net_fee as number) || 0
        const totalPaid = paid[s.id as string] || 0
        const due = netFee - totalPaid
        if (due <= 0) return // No due

        const course = s.course as { name: string; duration_months: number | null } | null
        const durationMonths = course?.duration_months || 12
        const monthlyFee = durationMonths > 0 ? Math.ceil(netFee / durationMonths) : netFee

        const enrollDate = new Date(s.enrollment_date as string)
        const monthsDiff = (now.getFullYear() - enrollDate.getFullYear()) * 12 + (now.getMonth() - enrollDate.getMonth())
        const expectedPaid = Math.min(monthsDiff + 1, durationMonths) * monthlyFee
        const monthsDue = monthlyFee > 0 ? Math.max(0, Math.ceil((expectedPaid - totalPaid) / monthlyFee)) : 0

        result.push({
          id: s.id as string, registration_no: s.registration_no as string,
          name: s.name as string, phone: s.phone as string,
          course_name: course?.name || '—',
          branch_name: (s.branch as { name: string } | null)?.name || '—',
          branch_id: s.branch_id as string, course_id: s.course_id as string,
          net_fee: netFee, paid: totalPaid, due, enrollment_date: s.enrollment_date as string,
          months_since: monthsDiff, monthly_fee: monthlyFee, months_due: monthsDue,
        })
      })

      setRows(result.sort((a, b) => b.due - a.due))
    } catch { toast.error('Failed to load due fees') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (branchF) r = r.filter(s => s.branch_id === branchF)
    if (courseF) r = r.filter(s => s.course_id === courseF)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(s => s.name.toLowerCase().includes(q) || s.registration_no.toLowerCase().includes(q) || s.phone.includes(q)) }
    return r
  }, [rows, branchF, courseF, search])

  const totalDue = useMemo(() => filtered.reduce((a, r) => a + r.due, 0), [filtered])

  function exportCSV() {
    if (!filtered.length) { toast.error('No data'); return }
    const h = ['Reg No', 'Name', 'Phone', 'Course', 'Branch', 'Net Fee', 'Paid', 'Due', 'Monthly Fee', 'Months Due']
    const r = filtered.map(d => [d.registration_no, d.name, d.phone, d.course_name, d.branch_name, d.net_fee, d.paid, d.due, d.monthly_fee, d.months_due])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `due-fees-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const columns = useMemo(() => [
    col.accessor('registration_no', { header: 'Reg No', cell: i => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{i.getValue()}</span> }),
    col.accessor('name', { header: 'Name', cell: i => <span className="text-sm font-medium text-gray-900">{i.getValue()}</span> }),
    col.accessor('phone', { header: 'Contact', cell: i => <span className="text-sm text-gray-600">{i.getValue()}</span> }),
    col.accessor('course_name', { header: 'Course', cell: i => <span className="text-sm text-gray-600 max-w-[140px] truncate block">{i.getValue()}</span> }),
    ...(isSuperAdmin ? [col.accessor('branch_name', { header: 'Branch', cell: (i: { getValue: () => string }) => <span className="text-sm text-gray-600 max-w-[100px] truncate block">{i.getValue()}</span> })] : []),
    col.accessor('monthly_fee', { header: 'Monthly', cell: i => <span className="text-sm text-gray-600">{formatINR(i.getValue())}</span> }),
    col.accessor('months_due', { header: 'Months Due', cell: i => <span className={`text-sm font-semibold ${i.getValue() > 2 ? 'text-red-600' : 'text-amber-600'}`}>{i.getValue()}</span> }),
    col.accessor('paid', { header: 'Paid', cell: i => <span className="text-sm text-green-600">{formatINR(i.getValue())}</span> }),
    col.accessor('due', { header: 'Total Due', cell: i => <span className="text-sm font-bold text-red-600">{formatINR(i.getValue())}</span> }),
  ], [isSuperAdmin])

  const hasFilters = branchF || courseF || search

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Due Fees</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Students with outstanding fee payments</p></div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Download size={16} /> Export CSV</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase font-medium">Students with Dues</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Due Amount</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{formatINR(totalDue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-gray-400 uppercase font-medium">Avg Due / Student</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{formatINR(filtered.length > 0 ? totalDue / filtered.length : 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search name, reg no, phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          {isSuperAdmin && <select value={branchF} onChange={e => setBranchF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
          <select value={courseF} onChange={e => setCourseF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Courses</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          {hasFilters && <button onClick={() => { setSearch(''); setBranchF(''); setCourseF('') }} className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-2">Clear</button>}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><AlertTriangle size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No students with due fees</p></div>
          : <div className="space-y-3">{filtered.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-red-600">{s.name.charAt(0).toUpperCase()}</span></div>
                    <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p><p className="text-xs font-mono text-gray-400">{s.registration_no}</p></div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.months_due > 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{s.months_due} mo due</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><BookOpen size={11} />{s.course_name}</span>
                  <span className="flex items-center gap-1"><Phone size={11} />{s.phone}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[10px] text-gray-400 uppercase">Monthly</p><p className="text-xs font-semibold text-gray-700">{formatINR(s.monthly_fee)}</p></div>
                  <div><p className="text-[10px] text-gray-400 uppercase">Paid</p><p className="text-xs font-semibold text-green-600">{formatINR(s.paid)}</p></div>
                  <div><p className="text-[10px] text-gray-400 uppercase">Due</p><p className="text-xs font-bold text-red-600">{formatINR(s.due)}</p></div>
                </div>
              </div>
            ))}</div>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<AlertTriangle size={36} className="text-gray-300" />} emptyMessage="No students with due fees" />
      </div>
    </div>
  )
}
