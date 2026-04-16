import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, Download } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR } from '../../lib/utils'
import LineChart from '../../components/charts/LineChart'
import BarChart from '../../components/charts/BarChart'
import PieChart from '../../components/charts/PieChart'

interface FilterOption { id: string; name: string }

const PIE_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#65A30D']

export default function IncomeReportPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [branches, setBranches] = useState<FilterOption[]>([])
  const [branchF, setBranchF] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 11); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  // Data
  const [feePayments, setFeePayments] = useState<{ amount: number; payment_date: string; course_name: string; branch_name: string }[]>([])
  const [walletCredits, setWalletCredits] = useState<{ amount: number; created_at: string; branch_name: string }[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      if (isSuperAdmin) {
        const { data: br } = await supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name')
        setBranches(br ?? [])
      }

      // Fee payments with student->course join
      let fq = supabase.from('uce_student_fee_payments').select(`amount, payment_date, student:uce_students(branch_id, course:uce_courses(name), branch:uce_branches(name))`)
      if (dateFrom) fq = fq.gte('payment_date', dateFrom)
      if (dateTo) fq = fq.lte('payment_date', dateTo)
      const { data: fees, error: fErr } = await fq
      if (fErr) throw fErr

      // Wallet credits (branch recharges)
      let wq = supabase.from('uce_branch_wallet_transactions').select('amount, created_at, branch:uce_branches(name)').eq('type', 'credit')
      if (dateFrom) wq = wq.gte('created_at', dateFrom)
      if (dateTo) wq = wq.lte('created_at', dateTo)
      const { data: wallet, error: wErr } = await wq
      if (wErr) throw wErr

      const feeRows = (fees ?? []).map((f: Record<string, unknown>) => {
        const student = f.student as { branch_id: string; course: { name: string } | null; branch: { name: string } | null } | null
        return {
          amount: f.amount as number,
          payment_date: f.payment_date as string,
          course_name: student?.course?.name || 'Unknown',
          branch_name: student?.branch?.name || 'Unknown',
          branch_id: student?.branch_id || '',
        }
      }).filter(f => !branchF || f.branch_id === branchF)

      const walletRows = (wallet ?? []).map((w: Record<string, unknown>) => ({
        amount: w.amount as number,
        created_at: (w.created_at as string).split('T')[0],
        branch_name: (w.branch as { name: string } | null)?.name || 'Unknown',
      }))

      setFeePayments(feeRows)
      setWalletCredits(walletRows)
    } catch { toast.error('Failed to load income report') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (!loading) load() }, [branchF, dateFrom, dateTo])

  const totalFeeIncome = useMemo(() => feePayments.reduce((a, f) => a + f.amount, 0), [feePayments])
  const totalWalletIncome = useMemo(() => walletCredits.reduce((a, w) => a + w.amount, 0), [walletCredits])

  // Monthly trend data
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {}
    feePayments.forEach(f => {
      const m = f.payment_date.slice(0, 7) // YYYY-MM
      months[m] = (months[m] || 0) + f.amount
    })
    walletCredits.forEach(w => {
      const m = w.created_at.slice(0, 7)
      months[m] = (months[m] || 0) + w.amount
    })
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const [y, m] = k.split('-')
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      return { name: label, value: v }
    })
  }, [feePayments, walletCredits])

  // Course-wise income
  const courseData = useMemo(() => {
    const map: Record<string, number> = {}
    feePayments.forEach(f => { map[f.course_name] = (map[f.course_name] || 0) + f.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({
      name: name.length > 18 ? name.slice(0, 18) + '...' : name, value,
    }))
  }, [feePayments])

  // Branch-wise income (for super admin)
  const branchData = useMemo(() => {
    const map: Record<string, number> = {}
    feePayments.forEach(f => { map[f.branch_name] = (map[f.branch_name] || 0) + f.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({
      name: name.length > 15 ? name.slice(0, 15) + '...' : name, value, color: PIE_COLORS[i % PIE_COLORS.length],
    }))
  }, [feePayments])

  function exportCSV() {
    const h = ['Month', 'Fee Income', 'Wallet Recharges', 'Total']
    const feeByMonth: Record<string, number> = {}; const walletByMonth: Record<string, number> = {}
    feePayments.forEach(f => { const m = f.payment_date.slice(0, 7); feeByMonth[m] = (feeByMonth[m] || 0) + f.amount })
    walletCredits.forEach(w => { const m = w.created_at.slice(0, 7); walletByMonth[m] = (walletByMonth[m] || 0) + w.amount })
    const allMonths = [...new Set([...Object.keys(feeByMonth), ...Object.keys(walletByMonth)])].sort()
    const r = allMonths.map(m => [m, feeByMonth[m] || 0, walletByMonth[m] || 0, (feeByMonth[m] || 0) + (walletByMonth[m] || 0)])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `income-report-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Income Report</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Revenue from fees and registrations</p></div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Download size={16} /> Export CSV</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase font-medium">Fee Income</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{formatINR(totalFeeIncome)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase font-medium">Wallet Recharges</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{formatINR(totalWalletIncome)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 uppercase font-medium">Total Income</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatINR(totalFeeIncome + totalWalletIncome)}</p>
        </div>
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

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-80 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Monthly trend */}
          {monthlyData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Income Trend</h3>
              <LineChart data={monthlyData} height={300} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Course-wise */}
            {courseData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Income by Course (Top 10)</h3>
                <BarChart data={courseData} height={320} layout="vertical" />
              </div>
            )}

            {/* Branch-wise (super admin only) */}
            {isSuperAdmin && branchData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Income by Branch</h3>
                <PieChart data={branchData} height={320} />
              </div>
            )}
          </div>

          {/* Empty state */}
          {monthlyData.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <TrendingUp size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">No income data found for the selected period</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
