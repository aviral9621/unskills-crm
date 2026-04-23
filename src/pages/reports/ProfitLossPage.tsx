import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Download, Crown, Info } from 'lucide-react'
import { toast } from 'sonner'
import { formatINR } from '../../lib/utils'
import LineChart from '../../components/charts/LineChart'
import BarChart from '../../components/charts/BarChart'
import {
  fetchSaReport, defaultDateRange, sumBy,
  type SaReportData,
} from '../../lib/reports/sa-revenue'

interface MonthRow { month: string; label: string; income: number; expense: number; profit: number }

export default function ProfitLossPage() {
  const defaults = defaultDateRange()
  const [dateFrom, setDateFrom] = useState(defaults.from!)
  const [dateTo, setDateTo] = useState(defaults.to!)
  const [data, setData] = useState<SaReportData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const d = await fetchSaReport({ from: dateFrom, to: dateTo })
      setData(d)
    } catch { toast.error('Failed to load P&L') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateFrom, dateTo])

  const monthly: MonthRow[] = useMemo(() => {
    if (!data) return []
    const incomeByMonth: Record<string, number> = {}
    const expenseByMonth: Record<string, number> = {}
    data.income.forEach(r => { const m = r.date.slice(0, 7); incomeByMonth[m] = (incomeByMonth[m] || 0) + r.amount })
    data.expenses.forEach(e => { const m = e.date.slice(0, 7); expenseByMonth[m] = (expenseByMonth[m] || 0) + e.amount })
    const months = [...new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)])].sort()
    return months.map(m => {
      const [y, mo] = m.split('-')
      const income = incomeByMonth[m] || 0
      const expense = expenseByMonth[m] || 0
      return {
        month: m,
        label: new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        income, expense, profit: income - expense,
      }
    })
  }, [data])

  const totals = useMemo(() => ({
    income: sumBy(data?.income ?? [], r => r.amount),
    expense: sumBy(data?.expenses ?? [], r => r.amount),
    hoFees: sumBy((data?.income ?? []).filter(r => r.source === 'ho_fees'), r => r.amount),
    certFees: sumBy((data?.income ?? []).filter(r => r.source === 'franchise_cert'), r => r.amount),
  }), [data])
  const profit = totals.income - totals.expense
  const margin = totals.income > 0 ? Math.round(profit / totals.income * 100) : 0

  // YTD
  const ytdFrom = `${new Date().getFullYear()}-01-01`
  const ytdIncome = useMemo(() => sumBy((data?.income ?? []).filter(r => r.date >= ytdFrom), r => r.amount), [data, ytdFrom])
  const ytdExpense = useMemo(() => sumBy((data?.expenses ?? []).filter(e => e.date >= ytdFrom), e => e.amount), [data, ytdFrom])
  const ytdProfit = ytdIncome - ytdExpense

  function exportCSV() {
    if (!monthly.length) { toast.error('No data'); return }
    const h = ['Month', 'Income', 'Expenses', 'Profit/Loss', 'Margin %']
    const r = monthly.map(m => [m.month, m.income, m.expense, m.profit, m.income > 0 ? Math.round(m.profit / m.income * 100) : 0])
    r.push(['TOTAL', totals.income, totals.expense, profit, margin])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `pnl-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Profit &amp; Loss</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            SA income (HO fees + franchise cert fees) − HO expenses
          </p>
        </div>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Download size={16} /> Export CSV</button>
      </div>

      {!loading && !data?.mainBranch && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">
            <b>No head office branch set.</b> P&amp;L will only show franchise certificate fees until one is marked.
          </div>
        </div>
      )}

      {/* YTD Summary Hero */}
      <div className={`rounded-2xl p-5 text-white shadow-lg ${ytdProfit >= 0 ? 'bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600' : 'bg-gradient-to-br from-red-600 via-rose-600 to-pink-600'}`}>
        <div className="flex items-center gap-2 mb-1">
          <Crown size={16} />
          <p className="text-[11px] uppercase font-semibold tracking-wider opacity-90">Year-to-Date · {new Date().getFullYear()}</p>
        </div>
        <p className="text-3xl sm:text-4xl font-black mt-1">{ytdProfit >= 0 ? '' : '-'}{formatINR(Math.abs(ytdProfit))}</p>
        <p className="text-sm opacity-90 mt-1">Net {ytdProfit >= 0 ? 'Profit' : 'Loss'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] opacity-80 uppercase">YTD Income</p>
            <p className="text-lg font-bold">{formatINR(ytdIncome)}</p>
          </div>
          <div>
            <p className="text-[11px] opacity-80 uppercase">YTD Expenses</p>
            <p className="text-lg font-bold">{formatINR(ytdExpense)}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards (range) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-green-500" /><p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Income</p></div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{formatINR(totals.income)}</p>
          <p className="text-[11px] text-gray-500 mt-1">HO {formatINR(totals.hoFees)} · Cert {formatINR(totals.certFees)}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown size={16} className="text-red-500" /><p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Expenses (HO)</p></div>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{formatINR(totals.expense)}</p>
          <p className="text-[11px] text-gray-500 mt-1">Head office only</p>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${profit >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Net {profit >= 0 ? 'Profit' : 'Loss'}</p>
          <p className={`text-xl sm:text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profit >= 0 ? '' : '-'}{formatINR(Math.abs(profit))}</p>
          <p className="text-[11px] text-gray-500 mt-1">in selected range</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Margin</p>
          <p className={`text-xl sm:text-2xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full ${margin >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.abs(margin))}%` }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
          <span className="text-xs font-medium text-gray-600 shrink-0">Date range:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          <span className="text-xs text-gray-400 hidden sm:inline">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          <button onClick={() => { const d = defaultDateRange(); setDateFrom(d.from!); setDateTo(d.to!) }} className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-2">Reset</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      ) : monthly.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <TrendingUp size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No financial data for the selected period</p>
        </div>
      ) : (
        <>
          {/* Income trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Income Trend</h3>
            <LineChart data={monthly.map(m => ({ name: m.label, value: m.income }))} height={280} />
          </div>

          {/* P&L bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Profit / Loss</h3>
            <BarChart data={monthly.map(m => ({ name: m.label, value: m.profit }))} height={260} color="#16A34A" />
          </div>

          {/* Breakdown table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Income</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Expenses</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Profit/Loss</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map(m => (
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
                    <td className={`px-4 py-3 text-sm text-right ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profit >= 0 ? '' : '-'}{formatINR(Math.abs(profit))}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{margin}%</td>
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
