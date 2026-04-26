import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Download, Crown, Store, ArrowUpRight, ArrowDownRight, Info, Plus, Settings, Tag, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDate } from '../../lib/utils'
import LineChart from '../../components/charts/LineChart'
import BarChart from '../../components/charts/BarChart'
import PieChart from '../../components/charts/PieChart'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import {
  fetchSaReport, defaultDateRange, sumBy,
  type SaReportData, type SaIncomeRow,
} from '../../lib/reports/sa-revenue'

interface IncomeCat { id: string; name: string; is_active: boolean }
interface ManualIncomeRow {
  id: string
  amount: number
  income_date: string
  description: string | null
  category_id: string | null
  category_name: string
  branch_id: string | null
  branch_name: string
}

const PIE_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#65A30D']

export default function IncomeReportPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const defaults = defaultDateRange()
  const [dateFrom, setDateFrom] = useState(defaults.from!)
  const [dateTo, setDateTo] = useState(defaults.to!)
  const [data, setData] = useState<SaReportData | null>(null)
  const [loading, setLoading] = useState(true)

  // Manual income state
  const [incomeCats, setIncomeCats] = useState<IncomeCat[]>([])
  const [manualIncomes, setManualIncomes] = useState<ManualIncomeRow[]>([])
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null)
  const [incomeForm, setIncomeForm] = useState({
    category_id: '',
    amount: '',
    income_date: new Date().toISOString().split('T')[0],
    description: '',
  })
  const [savingIncome, setSavingIncome] = useState(false)
  const [delIncome, setDelIncome] = useState<ManualIncomeRow | null>(null)
  const [delLoading, setDelLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [d, catRes, miRes] = await Promise.all([
        fetchSaReport({ from: dateFrom, to: dateTo }),
        supabase.from('uce_income_categories').select('id, name, is_active').order('name'),
        supabase
          .from('uce_incomes')
          .select('id, amount, income_date, description, category_id, branch_id, category:uce_income_categories(name), branch:uce_branches(name)')
          .gte('income_date', dateFrom)
          .lte('income_date', dateTo)
          .order('income_date', { ascending: false }),
      ])
      setData(d)
      setIncomeCats((catRes.data ?? []) as IncomeCat[])
      setManualIncomes(((miRes.data ?? []) as Record<string, unknown>[]).map(r => ({
        id: r.id as string,
        amount: Number(r.amount || 0),
        income_date: r.income_date as string,
        description: r.description as string | null,
        category_id: r.category_id as string | null,
        category_name: (r.category as { name: string } | null)?.name || 'Uncategorized',
        branch_id: r.branch_id as string | null,
        branch_name: (r.branch as { name: string } | null)?.name || '—',
      })))
    } catch { toast.error('Failed to load income report') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateFrom, dateTo])

  function openAddIncome() {
    setEditIncomeId(null)
    setIncomeForm({ category_id: '', amount: '', income_date: new Date().toISOString().split('T')[0], description: '' })
    setShowAddIncome(true)
  }
  function openEditIncome(r: ManualIncomeRow) {
    setEditIncomeId(r.id)
    setIncomeForm({
      category_id: r.category_id || '',
      amount: String(r.amount),
      income_date: r.income_date,
      description: r.description || '',
    })
    setShowAddIncome(true)
  }

  async function saveIncome() {
    if (!incomeForm.category_id || !incomeForm.amount || !incomeForm.income_date) {
      toast.error('Fill required fields'); return
    }
    setSavingIncome(true)
    try {
      const targetBranchId = isSuperAdmin
        ? (data?.mainBranch?.id || profile?.branch_id || null)
        : (profile?.branch_id || null)
      const payload = {
        category_id: incomeForm.category_id,
        amount: parseFloat(incomeForm.amount),
        income_date: incomeForm.income_date,
        description: incomeForm.description || null,
        branch_id: targetBranchId,
        recorded_by: user?.id || null,
      }
      if (editIncomeId) {
        const { error } = await supabase.from('uce_incomes').update(payload).eq('id', editIncomeId)
        if (error) throw error
        toast.success('Income updated')
      } else {
        const { error } = await supabase.from('uce_incomes').insert(payload)
        if (error) throw error
        toast.success('Income added')
      }
      setShowAddIncome(false); setEditIncomeId(null)
      load()
    } catch { toast.error('Failed to save income') }
    finally { setSavingIncome(false) }
  }

  async function deleteIncome() {
    if (!delIncome) return
    setDelLoading(true)
    try {
      const { error } = await supabase.from('uce_incomes').delete().eq('id', delIncome.id)
      if (error) throw error
      toast.success('Income deleted')
      setManualIncomes(p => p.filter(x => x.id !== delIncome.id))
    } catch { toast.error('Failed to delete') }
    finally { setDelLoading(false); setDelIncome(null) }
  }

  const income = data?.income ?? []
  const hoFees = useMemo(() => income.filter(r => r.source === 'ho_fees'), [income])
  const certFees = useMemo(() => income.filter(r => r.source === 'franchise_cert'), [income])

  const totalHo = useMemo(() => sumBy(hoFees, r => r.amount), [hoFees])
  const totalCert = useMemo(() => sumBy(certFees, r => r.amount), [certFees])
  const totalManual = useMemo(() => manualIncomes.reduce((a, r) => a + r.amount, 0), [manualIncomes])
  const total = totalHo + totalCert + totalManual

  // Month-over-month (this vs last)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const lastMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()
  const thisMonthIncome = useMemo(() => sumBy(income.filter(r => r.date.startsWith(thisMonth)), r => r.amount), [income, thisMonth])
  const lastMonthIncome = useMemo(() => sumBy(income.filter(r => r.date.startsWith(lastMonth)), r => r.amount), [income, lastMonth])
  const momPct = lastMonthIncome > 0 ? Math.round((thisMonthIncome - lastMonthIncome) / lastMonthIncome * 100) : null

  // Stacked monthly data — HO vs Cert
  const monthly = useMemo(() => {
    const hoByMonth: Record<string, number> = {}
    const certByMonth: Record<string, number> = {}
    hoFees.forEach(r => { const m = r.date.slice(0, 7); hoByMonth[m] = (hoByMonth[m] || 0) + r.amount })
    certFees.forEach(r => { const m = r.date.slice(0, 7); certByMonth[m] = (certByMonth[m] || 0) + r.amount })
    const allMonths = [...new Set([...Object.keys(hoByMonth), ...Object.keys(certByMonth)])].sort()
    return allMonths.map(m => {
      const [y, mo] = m.split('-')
      return {
        name: new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        value: (hoByMonth[m] || 0) + (certByMonth[m] || 0),
        ho: hoByMonth[m] || 0,
        cert: certByMonth[m] || 0,
      }
    })
  }, [hoFees, certFees])

  // Per-course breakdown (cert-fee income × non-main registrations)
  const perCourse = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {}
    certFees.forEach(r => {
      const c = r.course_name || 'Unknown'
      if (!map[c]) map[c] = { count: 0, amount: 0 }
      map[c].count += 1
      map[c].amount += r.amount
    })
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount).map(([name, v]) => ({ name, ...v }))
  }, [certFees])

  // Per-branch breakdown (non-main)
  const perBranch = useMemo(() => {
    const map: Record<string, number> = {}
    certFees.forEach(r => { map[r.branch_name] = (map[r.branch_name] || 0) + r.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({
      name: name.length > 18 ? name.slice(0, 18) + '…' : name, value, color: PIE_COLORS[i % PIE_COLORS.length],
    }))
  }, [certFees])

  function exportCSV() {
    const rows: (string | number)[][] = [['Date', 'Source', 'Branch', 'Course', 'Amount']]
    income.forEach((r: SaIncomeRow) => rows.push([r.date, r.source === 'ho_fees' ? 'Head Office' : 'Certificate Fee', r.branch_name, r.course_name || '', r.amount]))
    const csv = rows.map(v => v.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sa-income-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Income Report</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Super admin revenue across all branches</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button onClick={() => navigate('/admin/reports/income/categories')}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 shrink-0">
              <Settings size={16} /> Categories
            </button>
          )}
          <button onClick={openAddIncome}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 shadow-sm shrink-0">
            <Plus size={16} /> Add Income
          </button>
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 shrink-0">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Info banner */}
      {!loading && !data?.mainBranch && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">
            <b>No head office branch set.</b> Go to Branches → mark one as <b>Head Office</b> so its fees and expenses count toward SA P&L.
          </div>
        </div>
      )}

      {/* Summary cards — 4 top-level */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-white shadow-sm">
          <p className="text-[11px] uppercase font-semibold tracking-wider opacity-90">Total SA Income</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">{formatINR(total)}</p>
          <p className="text-[11px] opacity-80 mt-1">{loading ? '...' : `${income.length} entries`}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-1.5 mb-1"><Crown size={14} className="text-amber-500" /><p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Head Office Fees</p></div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatINR(totalHo)}</p>
          <p className="text-[11px] text-gray-400 mt-1 truncate">{data?.mainBranch?.name || 'Not set'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-1.5 mb-1"><Store size={14} className="text-blue-500" /><p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Franchise Cert Fees</p></div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatINR(totalCert)}</p>
          <p className="text-[11px] text-gray-400 mt-1">{certFees.length} registrations</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">This Month</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatINR(thisMonthIncome)}</p>
          {momPct !== null && (
            <p className={`text-[11px] mt-1 flex items-center gap-0.5 ${momPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {momPct >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(momPct)}% vs last month
            </p>
          )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="skeleton h-80 rounded-xl" />
            <div className="skeleton h-80 rounded-xl" />
          </div>
        </div>
      ) : total === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <TrendingUp size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No income recorded in the selected period</p>
        </div>
      ) : (
        <>
          {/* Monthly trend */}
          {monthly.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
              <div className="flex items-center justify-between mb-4 gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Monthly Income Trend</h3>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-600" />Total</span>
                </div>
              </div>
              <LineChart data={monthly.map(m => ({ name: m.name, value: m.value }))} height={280} />
              {/* Mini breakdown cards per month */}
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {monthly.slice(-6).map(m => (
                  <div key={m.name} className="rounded-lg bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{m.name}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">HO {formatINR(m.ho)}</p>
                    <p className="text-[11px] text-blue-700">Cert {formatINR(m.cert)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {perCourse.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Franchise Cert Fees by Course</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500">
                        <th className="py-2 text-left font-semibold">Course</th>
                        <th className="py-2 text-right font-semibold">Regs</th>
                        <th className="py-2 text-right font-semibold">SA Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perCourse.slice(0, 12).map(c => (
                        <tr key={c.name} className="border-b border-gray-50 hover:bg-gray-50/60">
                          <td className="py-2 text-gray-900 truncate max-w-[200px]">{c.name}</td>
                          <td className="py-2 text-gray-600 text-right">{c.count}</td>
                          <td className="py-2 text-gray-900 text-right font-semibold">{formatINR(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {perBranch.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Cert Fees by Franchise Branch</h3>
                <PieChart data={perBranch} height={280} />
              </div>
            )}
          </div>

          {/* Split bar */}
          {(totalHo > 0 || totalCert > 0 || totalManual > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Split</h3>
              <BarChart data={[
                { name: 'Head Office Fees', value: totalHo },
                { name: 'Franchise Cert Fees', value: totalCert },
                { name: 'Other Income', value: totalManual },
              ]} height={220} color="#DC2626" />
            </div>
          )}
        </>
      )}

      {/* Manual income entries */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Other Income (Manual Entries)</h3>
            <p className="text-xs text-gray-400 mt-0.5">{manualIncomes.length} entries · {formatINR(totalManual)} total</p>
          </div>
          <button onClick={openAddIncome} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg">
            <Plus size={14} /> Add
          </button>
        </div>
        {manualIncomes.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <Tag size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No manual income entries in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="py-2 text-left font-semibold">Date</th>
                  <th className="py-2 text-left font-semibold">Category</th>
                  <th className="py-2 text-left font-semibold">Description</th>
                  <th className="py-2 text-left font-semibold">Branch</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {manualIncomes.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2 text-gray-700">{formatDate(r.income_date)}</td>
                    <td className="py-2 text-gray-900 font-medium">{r.category_name}</td>
                    <td className="py-2 text-gray-600 max-w-[260px] truncate">{r.description || '—'}</td>
                    <td className="py-2 text-gray-600">{r.branch_name}</td>
                    <td className="py-2 text-green-700 text-right font-semibold">{formatINR(r.amount)}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => openEditIncome(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
                        <button onClick={() => setDelIncome(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAddIncome} onClose={() => setShowAddIncome(false)} title={editIncomeId ? 'Edit Income' : 'Add Income'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select
              value={incomeForm.category_id}
              onChange={e => setIncomeForm(p => ({ ...p, category_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            >
              <option value="">Select category</option>
              {incomeCats.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isSuperAdmin && (
              <button type="button" onClick={() => navigate('/admin/reports/income/categories')} className="mt-1.5 text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1">
                <Settings size={11} /> Manage categories
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
            <input type="number" min={0} value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
            <input type="date" value={incomeForm.income_date} onChange={e => setIncomeForm(p => ({ ...p, income_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} value={incomeForm.description} onChange={e => setIncomeForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional…" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm resize-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowAddIncome(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={saveIncome} disabled={savingIncome} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">{savingIncome ? 'Saving…' : (editIncomeId ? 'Update' : 'Add Income')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delIncome} onClose={() => setDelIncome(null)} onConfirm={deleteIncome}
        title="Delete Income?" message={`Delete income of ${formatINR(delIncome?.amount || 0)} from ${delIncome?.category_name || ''}?`}
        confirmText="Delete" variant="danger" loading={delLoading} />
    </div>
  )
}

