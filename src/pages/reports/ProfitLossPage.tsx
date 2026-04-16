import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR } from '../../lib/utils'
import LineChart from '../../components/charts/LineChart'
import BarChart from '../../components/charts/BarChart'

interface FilterOption { id: string; name: string }
interface MonthData { month: string; label: string; income: number; expense: number; profit: number }

export default function ProfitLossPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [branches, setBranches] = useState<FilterOption[]>([])
  const [branchF, setBranchF] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 11); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      if (isSuperAdmin) {
        const { data: br } = await supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name')
        setBranches(br ?? [])
      }

      // INCOME: Fee payments
      let fq = supabase.from('uce_student_fee_payments').select('amount, payment_date, student:uce_students(branch_id)')
      if (dateFrom) fq = fq.gte('payment_date', dateFrom)
      if (dateTo) fq = fq.lte('payment_date', dateTo)
      const { data: fees } = await fq

      // INCOME: Wallet recharges
      let wq = supabase.from('uce_branch_wallet_transactions').select('amount, created_at, branch_id').eq('type', 'credit')
      if (dateFrom) wq = wq.gte('created_at', dateFrom)
      if (dateTo) wq = wq.lte('created_at', dateTo)
      const { data: wallets } = await wq

      // EXPENSES
      let eq = supabase.from('uce_expenses').select('amount, expense_date, branch_id')
      if (!isSuperAdmin && profile?.branch_id) eq = eq.eq('branch_id', profile.branch_id)
      else if (branchF) eq = eq.eq('branch_id', branchF)
      if (dateFrom) eq = eq.gte('expense_date', dateFrom)
      if (dateTo) eq = eq.lte('expense_date', dateTo)
      const { data: exps } = await eq

      // Aggregate by month
      const incomeByMonth: Record<string, number> = {}
      const expenseByMonth: Record<string, number> = {}

      ;(fees ?? []).forEach((f: Record<string, unknown>) => {
        const student = f.student as { branch_id: string } | null
        if (branchF && student?.branch_id !== branchF) return
        if (!isSuperAdmin && profile?.branch_id && student?.branch_id !== profile.branch_id) return
        const m = (f.payment_date as string).slice(0, 7)
        incomeByMonth[m] = (incomeByMonth[m] || 0) + (f.amount as number)
      })

      ;(wallets ?? []).forEach((w: Record<string, unknown>) => {
        if (branchF && w.branch_id !== branchF) return
        if (!isSuperAdmin && profile?.branch_id && w.branch_id !== profile.branch_id) return
        const m = (w.created_at as string).slice(0, 7)
        incomeByMonth[m] = (incomeByMonth[m] || 0) + (w.amount as number)
      })

      ;(exps ?? []).forEach((e: Record<string, unknown>) => {
        const m = (e.expense_date as string).slice(0, 7)
        expenseByMonth[m] = (expenseByMonth[m] || 0) + (e.amount as number)
      })

      const allMonths = [...new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)])].sort()
      setMonthlyData(allMonths.map(m => {
        const [y, mo] = m.split('-')
        const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        const income = incomeByMonth[m] || 0
        const expense = expenseByMonth[m] || 0
        return { month: m, label, income, expense, profit: income - expense }
      }))
    } catch { toast.error('Failed to load P&L report') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (!loading) load() }, [branchF, dateFrom, dateTo])

  const totals = useMemo(() => ({
    income: monthlyData.reduce((a, m) => a + m.income, 0),
    expense: monthlyData.reduce((a, m) => a + m.expense, 0),
    profit: monthlyData.reduce((a, m) => a + m.profit, 0),
  }), [monthlyData])

  const profitChartData = useMemo(() => monthlyData.map(m => ({ name: m.label, value: m.profit })), [monthlyData])
  const comparisonData = useMemo(() => monthlyData.map(m => ({ name: m.label, value: m.income })), [monthlyData])

  function exportCSV() {
    if (!monthlyData.length) { toast.error('No data'); return }
    const h = ['Month', 'Income', 'Expense', 'Profit/Loss']
    const r = monthlyData.map(m => [m.month, m.income, m.expense, m.profit])
    r.push(['TOTAL', totals.income, totals.expense, totals.profit])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `profit-loss-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Profit & Loss</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Income vs expenses overview</p></div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Download size={16} /> Export CSV</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-green-500" /><p className="text-xs text-gray-400 uppercase font-medium">Total Income</p></div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{formatINR(totals.income)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown size={16} className="text-red-500" /><p className="text-xs text-gray-400 uppercase font-medium">Total Expenses</p></div>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{formatINR(totals.expense)}</p>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${totals.profit >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Net {totals.profit >= 0 ? 'Profit' : 'Loss'}</p>
          <p className={`text-xl sm:text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatINR(Math.abs(totals.profit))}</p>
          {totals.income > 0 && <p className="text-xs text-gray-400 mt-1">Margin: {Math.round(totals.profit / totals.income * 100)}%</p>}
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
        <div className="space-y-4">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      ) : monthlyData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <TrendingUp size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No financial data found for the selected period</p>
        </div>
      ) : (
        <>
          {/* Profit trend chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Income Trend</h3>
            <LineChart data={comparisonData} height={300} />
          </div>

          {/* Monthly P&L bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Profit / Loss</h3>
            <BarChart data={profitChartData} height={280} color="#16A34A" />
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Income</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit/Loss</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map(m => (
                    <tr key={m.month} className="border-b border-gray-100 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.label}</td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">{formatINR(m.income)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right">{formatINR(m.expense)}</td>
                      <td className={`px-4 py-3 text-sm font-semibold text-right ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.profit >= 0 ? '' : '-'}{formatINR(Math.abs(m.profit))}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">{m.income > 0 ? Math.round(m.profit / m.income * 100) : 0}%</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-green-600 text-right">{formatINR(totals.income)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 text-right">{formatINR(totals.expense)}</td>
                    <td className={`px-4 py-3 text-sm text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totals.profit >= 0 ? '' : '-'}{formatINR(Math.abs(totals.profit))}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{totals.income > 0 ? Math.round(totals.profit / totals.income * 100) : 0}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
