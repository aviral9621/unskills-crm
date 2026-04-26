import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { Wallet, Plus, Search, X, Download, Pencil, Trash2, Calendar, Tag, Crown, Store, Info, TrendingDown, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDate, cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import BarChart from '../../components/charts/BarChart'
import PieChart from '../../components/charts/PieChart'

interface ExpenseRow {
  id: string; amount: number; expense_date: string; description: string | null
  receipt_url: string | null; is_salary: boolean; category_name: string
  category_id: string | null; branch_name: string; branch_id: string | null
  branch_is_main: boolean
}
interface Category { id: string; name: string; is_active: boolean }
interface BranchOpt { id: string; name: string; is_main: boolean }

const col = createColumnHelper<ExpenseRow>()
const PIE_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#EC4899', '#0891B2', '#65A30D', '#EA580C', '#94A3B8']

type Tab = 'ho' | 'all'

export default function ExpensesPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<BranchOpt[]>([])
  const [mainBranch, setMainBranch] = useState<BranchOpt | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('ho')

  const [search, setSearch] = useState('')
  const [branchF, setBranchF] = useState('')
  const [categoryF, setCategoryF] = useState('')
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ category_id: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '', receipt_url: '' })
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  useEffect(() => { if (!loading) load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateFrom, dateTo])

  async function load() {
    setLoading(true)
    try {
      const [catRes, brRes] = await Promise.all([
        supabase.from('uce_expense_categories').select('id, name, is_active').order('name'),
        supabase.from('uce_branches').select('id, name, is_main').eq('is_active', true).order('name'),
      ])
      setCategories(catRes.data ?? [])
      const brs = (brRes.data ?? []) as BranchOpt[]
      setBranches(brs)
      setMainBranch(brs.find(b => b.is_main) ?? null)

      let eq = supabase.from('uce_expenses').select(`id, amount, expense_date, description, receipt_url, is_salary, category_id, branch_id, category:uce_expense_categories(name), branch:uce_branches(name, is_main)`)
      if (!isSuperAdmin && profile?.branch_id) eq = eq.eq('branch_id', profile.branch_id)
      if (dateFrom) eq = eq.gte('expense_date', dateFrom)
      if (dateTo) eq = eq.lte('expense_date', dateTo)
      const { data, error } = await eq.order('expense_date', { ascending: false })
      if (error) throw error

      setExpenses((data ?? []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        amount: Number(e.amount || 0),
        expense_date: e.expense_date as string,
        description: e.description as string | null,
        receipt_url: e.receipt_url as string | null,
        is_salary: e.is_salary as boolean,
        category_name: (e.category as { name: string } | null)?.name || 'Uncategorized',
        category_id: e.category_id as string | null,
        branch_name: (e.branch as { name: string } | null)?.name || '—',
        branch_id: e.branch_id as string | null,
        branch_is_main: !!(e.branch as { is_main?: boolean } | null)?.is_main,
      })))
    } catch { toast.error('Failed to load expenses') }
    finally { setLoading(false) }
  }

  const scoped = useMemo(() => {
    if (!isSuperAdmin) return expenses
    return tab === 'ho' ? expenses.filter(e => e.branch_is_main) : expenses
  }, [expenses, tab, isSuperAdmin])

  const filtered = useMemo(() => {
    let r = scoped
    if (branchF) r = r.filter(e => e.branch_id === branchF)
    if (categoryF) r = r.filter(e => e.category_id === categoryF)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(e => (e.description || '').toLowerCase().includes(q) || e.category_name.toLowerCase().includes(q))
    }
    return r
  }, [scoped, branchF, categoryF, search])

  const totalExpense = useMemo(() => filtered.reduce((a, e) => a + e.amount, 0), [filtered])
  const hoOnlyTotal = useMemo(() => expenses.filter(e => e.branch_is_main).reduce((a, e) => a + e.amount, 0), [expenses])
  const allTotal = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses])

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => { map[e.category_name] = (map[e.category_name] || 0) + e.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({
      name: name.length > 18 ? name.slice(0, 18) + '…' : name, value, color: PIE_COLORS[i % PIE_COLORS.length],
    }))
  }, [filtered])

  const monthlyChartData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => { const m = e.expense_date.slice(0, 7); map[m] = (map[m] || 0) + e.amount })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const [y, m] = k.split('-')
      return { name: new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), value: v }
    })
  }, [filtered])

  const top5Categories = useMemo(() => categoryChartData.slice(0, 5), [categoryChartData])

  async function handleSave() {
    if (!form.category_id || !form.amount || !form.expense_date) { toast.error('Fill required fields'); return }
    setSaving(true)
    try {
      const targetBranchId = isSuperAdmin && tab === 'ho'
        ? (mainBranch?.id || profile?.branch_id || null)
        : (profile?.branch_id || null)
      const payload = {
        category_id: form.category_id,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        description: form.description || null,
        receipt_url: form.receipt_url || null,
        branch_id: targetBranchId,
        recorded_by: user?.id || null,
      }
      if (editId) {
        const { error } = await supabase.from('uce_expenses').update(payload).eq('id', editId); if (error) throw error
        toast.success('Expense updated')
      } else {
        const { error } = await supabase.from('uce_expenses').insert(payload); if (error) throw error
        toast.success('Expense added')
      }
      setShowModal(false); setEditId(null)
      setForm({ category_id: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '', receipt_url: '' })
      load()
    } catch { toast.error('Failed to save expense') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_expenses').delete().eq('id', deleteTarget.id); if (error) throw error
      toast.success('Expense deleted')
      setExpenses(p => p.filter(e => e.id !== deleteTarget.id))
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  function openEdit(e: ExpenseRow) {
    setEditId(e.id)
    setForm({ category_id: e.category_id || '', amount: String(e.amount), expense_date: e.expense_date, description: e.description || '', receipt_url: e.receipt_url || '' })
    setShowModal(true)
  }

  function exportCSV() {
    if (!filtered.length) { toast.error('No data'); return }
    const h = ['Date', 'Category', 'Amount', 'Description', 'Branch', 'Type']
    const r = filtered.map(e => [e.expense_date, e.category_name, e.amount, e.description || '', e.branch_name, e.is_salary ? 'Salary' : 'Manual'])
    const csv = [h.join(','), ...r.map(v => v.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `expenses-${tab}-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const columns = useMemo(() => [
    col.accessor('expense_date', { header: 'Date', cell: i => <span className="text-sm text-gray-700">{formatDate(i.getValue())}</span> }),
    col.accessor('category_name', { header: 'Category', cell: i => <span className="text-sm font-medium text-gray-900">{i.getValue()}</span> }),
    col.accessor('amount', { header: 'Amount', cell: i => <span className="text-sm font-semibold text-red-600">{formatINR(i.getValue())}</span> }),
    col.accessor('description', { header: 'Description', cell: i => <span className="text-sm text-gray-600 max-w-[200px] truncate block">{i.getValue() || '—'}</span> }),
    ...(isSuperAdmin ? [col.accessor('branch_name', {
      header: 'Branch',
      cell: (i: { getValue: () => string; row: { original: ExpenseRow } }) => (
        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
          {i.row.original.branch_is_main && <Crown size={11} className="text-amber-500" />}
          {i.getValue()}
        </span>
      ),
    })] : []),
    col.display({ id: 'type', header: 'Type', cell: i => <span className={`text-xs px-2 py-1 rounded-full ${i.row.original.is_salary ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{i.row.original.is_salary ? 'Salary' : 'Manual'}</span> }),
    col.display({ id: 'actions', header: '', cell: i => i.row.original.is_salary ? null : (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); openEdit(i.row.original) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
        <button onClick={e => { e.stopPropagation(); setDeleteTarget(i.row.original) }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )}),
  ], [isSuperAdmin])

  const hasFilters = branchF || categoryF || search

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Expenses</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Operating costs · head office expenses hit SA P&L</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button onClick={() => navigate('/admin/reports/expenses/categories')}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 shrink-0">
              <Settings size={16} /> Categories
            </button>
          )}
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 shrink-0"><Download size={16} /> Export</button>
          <button onClick={() => { setEditId(null); setForm({ category_id: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '', receipt_url: '' }); setShowModal(true) }}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Expense</button>
        </div>
      </div>

      {/* Tabs (super admin only) */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-1.5 inline-flex gap-1 w-full sm:w-auto shadow-sm">
          <button onClick={() => setTab('ho')} className={cn('flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5',
            tab === 'ho' ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-50')}>
            <Crown size={14} /> Head Office
          </button>
          <button onClick={() => setTab('all')} className={cn('flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5',
            tab === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50')}>
            <Store size={14} /> All Branches
          </button>
        </div>
      )}

      {isSuperAdmin && tab === 'ho' && !mainBranch && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">No head office branch set. Mark one from <b>Branches → Mark as Head Office</b> to view SA-level expenses.</div>
        </div>
      )}

      {isSuperAdmin && tab === 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800">All-branches view is <b>informational</b>. Only Head Office expenses count toward SA profit/loss.</div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={cn('rounded-xl p-4 text-white shadow-sm',
          tab === 'ho' ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-gradient-to-br from-red-600 to-red-700')}>
          <div className="flex items-center gap-1.5 mb-1"><TrendingDown size={14} /><p className="text-[11px] uppercase font-semibold tracking-wider opacity-90">{tab === 'ho' ? 'HO Expenses' : 'All Expenses'}</p></div>
          <p className="text-xl sm:text-2xl font-bold mt-1">{formatINR(totalExpense)}</p>
          <p className="text-[11px] opacity-80 mt-1">{filtered.length} entries</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">HO Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatINR(hoOnlyTotal)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Affects SA P&L</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">All-Branch Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatINR(allTotal)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Informational</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Categories</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{categoryChartData.length}</p>
          <p className="text-[11px] text-gray-400 mt-1">in selection</p>
        </div>
      </div>

      {/* Top-5 categories */}
      {!loading && top5Categories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Spending Categories</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {top5Categories.map((c, i) => (
              <div key={c.name} className="rounded-lg bg-gray-50 p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1" style={{ background: c.color }} />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">#{i + 1}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <p className="text-sm font-bold text-red-600 mt-0.5">{formatINR(c.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search description..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          {isSuperAdmin && tab === 'all' && <select value={branchF} onChange={e => setBranchF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.is_main ? ' (HO)' : ''}</option>)}</select>}
          <select value={categoryF} onChange={e => setCategoryF(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"><option value="">All Categories</option>{categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          {hasFilters && <button onClick={() => { setSearch(''); setBranchF(''); setCategoryF('') }} className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-2">Clear</button>}
        </div>
      </div>

      {/* Charts */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Trend</h3>
            <BarChart data={monthlyChartData} height={280} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">By Category</h3>
            <PieChart data={categoryChartData} height={280} />
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Wallet size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No expenses found</p></div>
          : <div className="space-y-3">{filtered.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{e.category_name}</p>
                      {e.branch_is_main && <Crown size={12} className="text-amber-500 shrink-0" />}
                    </div>
                    {e.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{e.description}</p>}
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0">{formatINR(e.amount)}</p>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(e.expense_date)}</span>
                    <span className="flex items-center gap-1"><Tag size={11} />{e.branch_name}</span>
                  </div>
                  {!e.is_salary && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}</div>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<Wallet size={36} className="text-gray-300" />} emptyMessage="No expenses found" />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Expense' : 'Add Expense'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="">Select category</option>
              {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Optional description..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none resize-none" />
          </div>
          {isSuperAdmin && tab === 'ho' && mainBranch && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 flex items-center gap-1.5">
              <Crown size={12} /> Will be recorded against <b>{mainBranch.name}</b> (HO)
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Add Expense'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Expense?" message={`Delete expense of ${formatINR(deleteTarget?.amount || 0)} from ${deleteTarget?.category_name || ''}?`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
