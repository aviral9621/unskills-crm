import { useEffect, useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Users, Search, X, Download, Phone, BookOpen, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDate } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'

interface StudentRow {
  id: string; registration_no: string; name: string; phone: string
  total_fee: number; net_fee: number; discount: number; is_active: boolean
  enrollment_date: string; course_name: string; branch_name: string
  branch_id: string; course_id: string; paid: number
}
interface FilterOption { id: string; name: string }

const col = createColumnHelper<StudentRow>()

export default function StudentReportPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [rows, setRows] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<FilterOption[]>([])
  const [courses, setCourses] = useState<FilterOption[]>([])
  const [search, setSearch] = useState('')
  const [branchF, setBranchF] = useState('')
  const [courseF, setCourseF] = useState('')
  const [statusF, setStatusF] = useState<'all' | 'active' | 'inactive'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [br, cr] = await Promise.all([
        supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name'),
        supabase.from('uce_courses').select('id, name').eq('is_active', true).order('name'),
      ])
      setBranches(br.data ?? []); setCourses(cr.data ?? [])

      let q = supabase.from('uce_students').select(`id, registration_no, name, phone, total_fee, net_fee, discount, is_active, enrollment_date, branch_id, course_id, course:uce_courses(name), branch:uce_branches(name)`)
      if (!isSuperAdmin && profile?.branch_id) q = q.eq('branch_id', profile.branch_id)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error

      const ids = (data ?? []).map((s: { id: string }) => s.id)
      const paid: Record<string, number> = {}
      for (let i = 0; i < ids.length; i += 200) {
        const { data: p } = await supabase.from('uce_student_fee_payments').select('student_id, amount').in('student_id', ids.slice(i, i + 200))
        p?.forEach(r => { paid[r.student_id] = (paid[r.student_id] || 0) + r.amount })
      }

      setRows((data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string, registration_no: s.registration_no as string, name: s.name as string,
        phone: s.phone as string, total_fee: s.total_fee as number, net_fee: s.net_fee as number,
        discount: s.discount as number, is_active: s.is_active as boolean,
        enrollment_date: s.enrollment_date as string, branch_id: s.branch_id as string,
        course_id: s.course_id as string,
        course_name: (s.course as { name: string } | null)?.name || '—',
        branch_name: (s.branch as { name: string } | null)?.name || '—',
        paid: paid[s.id as string] || 0,
      })))
    } catch { toast.error('Failed to load student report') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (branchF) r = r.filter(s => s.branch_id === branchF)
    if (courseF) r = r.filter(s => s.course_id === courseF)
    if (statusF === 'active') r = r.filter(s => s.is_active)
    else if (statusF === 'inactive') r = r.filter(s => !s.is_active)
    if (dateFrom) r = r.filter(s => s.enrollment_date >= dateFrom)
    if (dateTo) r = r.filter(s => s.enrollment_date <= dateTo)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(s => s.name.toLowerCase().includes(q) || s.registration_no.toLowerCase().includes(q) || s.phone.includes(q)) }
    return r
  }, [rows, branchF, courseF, statusF, dateFrom, dateTo, search])

  const stats = useMemo(() => {
    const totalFee = filtered.reduce((a, s) => a + (s.net_fee || 0), 0)
    const totalPaid = filtered.reduce((a, s) => a + s.paid, 0)
    return { count: filtered.length, totalFee, totalPaid, totalDue: Math.max(0, totalFee - totalPaid) }
  }, [filtered])

  function exportCSV() {
    if (!filtered.length) { toast.error('No data to export'); return }
    const h = ['Reg No', 'Name', 'Phone', 'Course', 'Branch', 'Total Fee', 'Discount', 'Net Fee', 'Paid', 'Due', 'Status', 'Enrollment Date']
    const r = filtered.map(s => [s.registration_no, s.name, s.phone, s.course_name, s.branch_name, s.total_fee, s.discount, s.net_fee, s.paid, Math.max(0, s.net_fee - s.paid), s.is_active ? 'Active' : 'Inactive', s.enrollment_date])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `student-report-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const columns = useMemo(() => [
    col.accessor('registration_no', { header: 'Reg No', cell: i => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{i.getValue()}</span> }),
    col.accessor('name', { header: 'Name', cell: i => <span className="text-sm font-medium text-gray-900 min-w-[120px] block">{i.getValue()}</span> }),
    col.accessor('phone', { header: 'Contact', cell: i => <span className="text-sm text-gray-600">{i.getValue()}</span> }),
    col.accessor('course_name', { header: 'Course', cell: i => <span className="text-sm text-gray-600 max-w-[140px] truncate block">{i.getValue()}</span> }),
    ...(isSuperAdmin ? [col.accessor('branch_name', { header: 'Branch', cell: (i: { getValue: () => string }) => <span className="text-sm text-gray-600 max-w-[120px] truncate block">{i.getValue()}</span> })] : []),
    col.accessor('net_fee', { header: 'Net Fee', cell: i => <span className="text-sm text-gray-700">{formatINR(i.getValue())}</span> }),
    col.display({ id: 'paid', header: 'Paid', cell: i => <span className="text-sm font-medium text-green-600">{formatINR(i.row.original.paid)}</span> }),
    col.display({ id: 'due', header: 'Due', cell: i => { const d = Math.max(0, (i.row.original.net_fee || 0) - i.row.original.paid); return <span className={`text-sm font-semibold ${d > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatINR(d)}</span> } }),
    col.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    col.accessor('enrollment_date', { header: 'Enrolled', cell: i => <span className="text-xs text-gray-500">{i.getValue() ? formatDate(i.getValue()) : '—'}</span> }),
  ], [isSuperAdmin])

  const hasFilters = branchF || courseF || statusF !== 'all' || dateFrom || dateTo || search

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Student Report</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Fee collection and enrollment overview</p></div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Download size={16} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Students', value: stats.count, color: 'text-gray-900' },
          { label: 'Total Fee', value: formatINR(stats.totalFee), color: 'text-gray-900' },
          { label: 'Collected', value: formatINR(stats.totalPaid), color: 'text-green-600' },
          { label: 'Pending', value: formatINR(stats.totalDue), color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase font-medium">{s.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div className="relative sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search name, reg no, phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          {isSuperAdmin && <select value={branchF} onChange={e => setBranchF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
          <select value={courseF} onChange={e => setCourseF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Courses</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={statusF} onChange={e => setStatusF(e.target.value as 'all' | 'active' | 'inactive')} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
        </div>
        {hasFilters && <button onClick={() => { setSearch(''); setBranchF(''); setCourseF(''); setStatusF('all'); setDateFrom(''); setDateTo('') }} className="mt-2.5 text-xs text-red-600 hover:text-red-700 font-medium">Clear all filters</button>}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Users size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No students found</p></div>
          : <div className="space-y-3">{filtered.map(s => {
              const due = Math.max(0, (s.net_fee || 0) - s.paid)
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-red-600">{s.name.charAt(0).toUpperCase()}</span></div>
                      <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p><p className="text-xs font-mono text-gray-400">{s.registration_no}</p></div>
                    </div>
                    <StatusBadge label={s.is_active ? 'Active' : 'Inactive'} variant={s.is_active ? 'success' : 'error'} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><BookOpen size={11} />{s.course_name}</span>
                    <span className="flex items-center gap-1"><Phone size={11} />{s.phone}</span>
                    {s.enrollment_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(s.enrollment_date)}</span>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] text-gray-400 uppercase">Net Fee</p><p className="text-xs font-semibold text-gray-700">{formatINR(s.net_fee)}</p></div>
                    <div><p className="text-[10px] text-gray-400 uppercase">Paid</p><p className="text-xs font-semibold text-green-600">{formatINR(s.paid)}</p></div>
                    <div><p className="text-[10px] text-gray-400 uppercase">Due</p><p className={`text-xs font-semibold ${due > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatINR(due)}</p></div>
                  </div>
                </div>
              )
            })}</div>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<Users size={36} className="text-gray-300" />} emptyMessage="No students found" />
      </div>
    </div>
  )
}
