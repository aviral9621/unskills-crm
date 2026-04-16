import { useEffect, useState, useMemo } from 'react'
import { IndianRupee, Download } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR } from '../../lib/utils'
import BarChart from '../../components/charts/BarChart'
import PieChart from '../../components/charts/PieChart'

interface CourseRow {
  course_id: string; course_name: string; students: number
  total_fee: number; collected: number; pending: number
}
interface FilterOption { id: string; name: string }

const PIE_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#65A30D', '#EA580C']

export default function FeesReportPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [data, setData] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<FilterOption[]>([])
  const [branchF, setBranchF] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      if (isSuperAdmin) {
        const { data: br } = await supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name')
        setBranches(br ?? [])
      }

      let sq = supabase.from('uce_students').select('id, course_id, net_fee, enrollment_date, course:uce_courses(name)')
      if (!isSuperAdmin && profile?.branch_id) sq = sq.eq('branch_id', profile.branch_id)
      else if (branchF) sq = sq.eq('branch_id', branchF)
      const { data: students, error } = await sq
      if (error) throw error

      const ids = (students ?? []).map((s: { id: string }) => s.id)
      const paid: Record<string, number> = {}
      for (let i = 0; i < ids.length; i += 200) {
        let pq = supabase.from('uce_student_fee_payments').select('student_id, amount, payment_date').in('student_id', ids.slice(i, i + 200))
        if (dateFrom) pq = pq.gte('payment_date', dateFrom)
        if (dateTo) pq = pq.lte('payment_date', dateTo)
        const { data: p } = await pq
        p?.forEach(r => { paid[r.student_id] = (paid[r.student_id] || 0) + r.amount })
      }

      const courseMap: Record<string, CourseRow> = {}
      ;(students ?? []).forEach((s: Record<string, unknown>) => {
        const cid = s.course_id as string
        const cname = (s.course as { name: string } | null)?.name || 'Unknown'
        if (!courseMap[cid]) courseMap[cid] = { course_id: cid, course_name: cname, students: 0, total_fee: 0, collected: 0, pending: 0 }
        courseMap[cid].students++
        const netFee = (s.net_fee as number) || 0
        const studentPaid = paid[s.id as string] || 0
        courseMap[cid].total_fee += netFee
        courseMap[cid].collected += studentPaid
        courseMap[cid].pending += Math.max(0, netFee - studentPaid)
      })

      setData(Object.values(courseMap).sort((a, b) => b.total_fee - a.total_fee))
    } catch { toast.error('Failed to load fees report') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (!loading) load() }, [branchF, dateFrom, dateTo])

  const totals = useMemo(() => ({
    students: data.reduce((a, r) => a + r.students, 0),
    fee: data.reduce((a, r) => a + r.total_fee, 0),
    collected: data.reduce((a, r) => a + r.collected, 0),
    pending: data.reduce((a, r) => a + r.pending, 0),
  }), [data])

  const barData = useMemo(() => data.slice(0, 10).map(r => ({ name: r.course_name.length > 15 ? r.course_name.slice(0, 15) + '...' : r.course_name, value: r.collected })), [data])

  const pieData = useMemo(() => {
    const top = data.slice(0, 8)
    const rest = data.slice(8)
    const items = top.map((r, i) => ({ name: r.course_name, value: r.total_fee, color: PIE_COLORS[i % PIE_COLORS.length] }))
    if (rest.length) items.push({ name: `Others (${rest.length})`, value: rest.reduce((a, r) => a + r.total_fee, 0), color: '#94A3B8' })
    return items
  }, [data])

  function exportCSV() {
    if (!data.length) { toast.error('No data to export'); return }
    const h = ['Course', 'Students', 'Total Fee', 'Collected', 'Pending']
    const r = data.map(d => [d.course_name, d.students, d.total_fee, d.collected, d.pending])
    r.push(['TOTAL', totals.students, totals.fee, totals.collected, totals.pending])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `fees-report-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Fees Report</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Course-wise fee collection breakdown</p></div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Download size={16} /> Export CSV</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: totals.students, color: 'text-gray-900' },
          { label: 'Total Fee', value: formatINR(totals.fee), color: 'text-gray-900' },
          { label: 'Collected', value: formatINR(totals.collected), color: 'text-green-600' },
          { label: 'Pending', value: formatINR(totals.pending), color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase font-medium">{s.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {isSuperAdmin && <select value={branchF} onChange={e => setBranchF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          {(branchF || dateFrom || dateTo) && <button onClick={() => { setBranchF(''); setDateFrom(''); setDateTo('') }} className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-2">Clear</button>}
        </div>
      </div>

      {/* Charts */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Collection by Course (Top 10)</h3>
            <BarChart data={barData} height={320} layout="vertical" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Fee Distribution</h3>
            <PieChart data={pieData} height={320} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Course</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Students</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Fee</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">%</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100"><td colSpan={6} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td></tr>
              )) : data.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center"><IndianRupee size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No fee data found</p></td></tr>
              ) : <>
                {data.map(r => (
                  <tr key={r.course_id} className="border-b border-gray-100 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{r.course_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{r.students}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatINR(r.total_fee)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">{formatINR(r.collected)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">{formatINR(r.pending)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${r.total_fee > 0 ? (r.collected / r.total_fee * 100) : 0}%` }} /></div>
                        <span className="text-xs text-gray-500">{r.total_fee > 0 ? Math.round(r.collected / r.total_fee * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{totals.students}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatINR(totals.fee)}</td>
                  <td className="px-4 py-3 text-sm text-green-600 text-right">{formatINR(totals.collected)}</td>
                  <td className="px-4 py-3 text-sm text-red-600 text-right">{formatINR(totals.pending)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{totals.fee > 0 ? Math.round(totals.collected / totals.fee * 100) : 0}%</td>
                </tr>
              </>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
