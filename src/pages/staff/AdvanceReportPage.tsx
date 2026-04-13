import { useEffect, useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Banknote, Plus, Search, X, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDate } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField, { inputClass, selectClass } from '../../components/FormField'

interface AdvanceRow {
  id: string; employee_id: string; amount: number; advance_date: string
  remaining_salary: number | null; salary_due_date: string | null; note: string | null
  created_at: string
  employee?: { name: string; employee_code: string | null } | null
}

interface EmpOption { id: string; name: string; employee_code: string | null }

const colHelper = createColumnHelper<AdvanceRow>()

export default function AdvanceReportPage() {
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [advances, setAdvances] = useState<AdvanceRow[]>([])
  const [employees, setEmployees] = useState<EmpOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ employee_id: '', amount: '', advance_date: '', note: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      let aq = supabase.from('uce_salary_advances').select('*, employee:uce_employees(name, employee_code)')
      if (!isSuperAdmin && branchId) {
        // Filter through employees in the branch
        const { data: empIds } = await supabase.from('uce_employees').select('id').eq('branch_id', branchId)
        const ids = (empIds ?? []).map(e => e.id)
        if (ids.length > 0) aq = aq.in('employee_id', ids)
        else { setAdvances([]); setLoading(false); return }
      }

      let eq = supabase.from('uce_employees').select('id, name, employee_code').eq('is_active', true)
      if (!isSuperAdmin && branchId) eq = eq.eq('branch_id', branchId)

      const [aRes, eRes] = await Promise.all([
        aq.order('advance_date', { ascending: false }),
        eq.order('name'),
      ])
      if (aRes.error) throw aRes.error
      setAdvances((aRes.data ?? []) as unknown as AdvanceRow[])
      setEmployees((eRes.data ?? []) as EmpOption[])
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  function openAdd() {
    setForm({ employee_id: '', amount: '', advance_date: new Date().toISOString().split('T')[0], note: '' })
    setFormErrors({})
    setModalOpen(true)
  }

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!form.employee_id) errs.employee_id = 'Select an employee'
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Valid amount required'
    if (!form.advance_date) errs.advance_date = 'Date required'
    if (Object.keys(errs).length) { setFormErrors(errs); return }

    setSaving(true)
    try {
      const { error } = await supabase.from('uce_salary_advances').insert({
        employee_id: form.employee_id,
        amount: Number(form.amount),
        advance_date: form.advance_date,
        note: form.note || null,
        recorded_by: user?.id || null,
      })
      if (error) throw error
      toast.success('Advance recorded')
      setModalOpen(false)
      fetchData()
    } catch { toast.error('Failed to save advance') }
    finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return advances
    const q = search.toLowerCase()
    return advances.filter(a => {
      const emp = a.employee as { name: string; employee_code: string | null } | null
      return emp?.name.toLowerCase().includes(q) || (emp?.employee_code || '').toLowerCase().includes(q)
    })
  }, [advances, search])

  const columns = useMemo(() => [
    colHelper.display({ id: 'employee', header: 'Employee', cell: i => {
      const emp = i.row.original.employee as { name: string; employee_code: string | null } | null
      return (
        <div>
          <p className="text-sm font-medium text-gray-900">{emp?.name || '—'}</p>
          {emp?.employee_code && <p className="text-xs font-mono text-gray-400">{emp.employee_code}</p>}
        </div>
      )
    }}),
    colHelper.accessor('amount', { header: 'Amount', cell: i => <span className="text-sm font-semibold text-red-600">{formatINR(i.getValue())}</span> }),
    colHelper.accessor('advance_date', { header: 'Advance Date', cell: i => <span className="text-sm text-gray-600">{formatDate(i.getValue())}</span> }),
    colHelper.accessor('remaining_salary', { header: 'Remaining Salary', cell: i => <span className="text-sm text-gray-600">{i.getValue() != null ? formatINR(i.getValue()!) : '—'}</span> }),
    colHelper.accessor('salary_due_date', { header: 'Due Date', cell: i => <span className="text-sm text-gray-600">{i.getValue() ? formatDate(i.getValue()!) : '—'}</span> }),
    colHelper.accessor('note', { header: 'Note', cell: i => <span className="text-sm text-gray-500 max-w-[200px] truncate block">{i.getValue() || '—'}</span> }),
  ], [])

  function AdvanceCard({ a }: { a: AdvanceRow }) {
    const emp = a.employee as { name: string; employee_code: string | null } | null
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <Banknote size={18} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{emp?.name || '—'}</p>
              <p className="text-xs text-gray-400">{formatDate(a.advance_date)}</p>
            </div>
          </div>
          <span className="text-sm font-bold text-red-600 shrink-0">{formatINR(a.amount)}</span>
        </div>
        {a.note && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{a.note}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Advance Report</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{advances.length} records</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <Plus size={16} /> Add Advance
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by employee name or code..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Banknote size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No advance records</p></div>
          : <div className="space-y-3">{filtered.map(a => <AdvanceCard key={a.id} a={a} />)}</div>}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<Banknote size={36} className="text-gray-300" />} emptyMessage="No advance records" />
      </div>

      {/* Add Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Salary Advance" size="md">
        <div className="space-y-4">
          <FormField label="Employee" required error={formErrors.employee_id}>
            <select value={form.employee_id} onChange={e => { setForm(p => ({ ...p, employee_id: e.target.value })); setFormErrors(p => ({ ...p, employee_id: '' })) }} className={selectClass}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.employee_code ? `(${e.employee_code})` : ''}</option>)}
            </select>
          </FormField>
          <FormField label="Amount" required error={formErrors.amount}>
            <input type="number" value={form.amount} onChange={e => { setForm(p => ({ ...p, amount: e.target.value })); setFormErrors(p => ({ ...p, amount: '' })) }}
              placeholder="0" className={inputClass} min={0} />
          </FormField>
          <FormField label="Advance Date" required error={formErrors.advance_date}>
            <input type="date" value={form.advance_date} onChange={e => { setForm(p => ({ ...p, advance_date: e.target.value })); setFormErrors(p => ({ ...p, advance_date: '' })) }}
              className={inputClass} />
          </FormField>
          <FormField label="Note">
            <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              rows={2} placeholder="Optional note..." className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {saving && <Loader2 size={16} className="animate-spin" />} Save Advance
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
