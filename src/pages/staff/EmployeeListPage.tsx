import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Briefcase, Plus, Search, MoreVertical, Pencil, Power, X, Phone, Building, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import type { Department } from '../../types'

interface EmployeeRow {
  id: string; employee_code: string | null; name: string; phone: string
  designation: string | null; net_salary: number; is_active: boolean; created_at: string
  department?: { name: string } | null; branch?: { name: string } | null
}

const colHelper = createColumnHelper<EmployeeRow>()

export default function EmployeeListPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [toggleTarget, setToggleTarget] = useState<EmployeeRow | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => { fetchData() }, [])
  useEffect(() => { const h = () => setMenuOpen(null); window.addEventListener('scroll', h, true); return () => window.removeEventListener('scroll', h, true) }, [])

  async function fetchData() {
    setLoading(true)
    try {
      let q = supabase.from('uce_employees').select('id, employee_code, name, phone, designation, net_salary, is_active, created_at, department:uce_departments(name), branch:uce_branches(name)')
      if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
      const [eRes, dRes] = await Promise.all([
        q.order('created_at', { ascending: false }),
        supabase.from('uce_departments').select('*').eq('is_active', true).order('name'),
      ])
      if (eRes.error) throw eRes.error
      setEmployees((eRes.data ?? []) as unknown as EmployeeRow[])
      setDepartments(dRes.data ?? [])
    } catch { toast.error('Failed to load employees') }
    finally { setLoading(false) }
  }

  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id); if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  const menuEmp = useMemo(() => employees.find(e => e.id === menuOpen), [employees, menuOpen])

  async function handleToggle() {
    if (!toggleTarget) return; setToggling(true)
    try {
      const ns = !toggleTarget.is_active
      const { error } = await supabase.from('uce_employees').update({ is_active: ns, updated_at: new Date().toISOString() }).eq('id', toggleTarget.id)
      if (error) throw error
      toast.success(`${toggleTarget.name} ${ns ? 'activated' : 'deactivated'}`)
      setEmployees(p => p.map(e => e.id === toggleTarget.id ? { ...e, is_active: ns } : e))
    } catch { toast.error('Failed') }
    finally { setToggling(false); setToggleTarget(null) }
  }

  const filtered = useMemo(() => {
    let r = employees
    if (deptFilter !== 'all') r = r.filter(e => {
      // Match by department name since we only have the joined object
      const dept = e.department as { name: string } | null
      return departments.find(d => d.name === dept?.name)?.id === deptFilter
    })
    if (statusFilter === 'active') r = r.filter(e => e.is_active)
    else if (statusFilter === 'inactive') r = r.filter(e => !e.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(e => e.name.toLowerCase().includes(q) || (e.employee_code || '').toLowerCase().includes(q) || e.phone.includes(q))
    }
    return r
  }, [employees, deptFilter, statusFilter, search, departments])

  const columns = useMemo(() => [
    colHelper.accessor('employee_code', { header: 'Code', cell: i => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{i.getValue() || '—'}</span> }),
    colHelper.accessor('name', { header: 'Name', cell: i => <span className="text-sm font-medium text-gray-900 min-w-[120px] block">{i.getValue()}</span> }),
    colHelper.display({ id: 'department', header: 'Department', cell: i => <span className="text-sm text-gray-600">{(i.row.original.department as { name: string } | null)?.name || '—'}</span> }),
    colHelper.accessor('designation', { header: 'Designation', cell: i => <span className="text-sm text-gray-600">{i.getValue() || '—'}</span> }),
    colHelper.accessor('phone', { header: 'Phone', cell: i => <span className="text-sm text-gray-600">{i.getValue()}</span> }),
    colHelper.accessor('net_salary', { header: 'Net Salary', cell: i => <span className="text-sm font-medium text-gray-700">{formatINR(i.getValue())}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <button ref={el => { if (el) menuBtnRefs.current.set(i.row.original.id, el) }} onClick={e => { e.stopPropagation(); openMenu(i.row.original.id) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
    )}),
  ], [openMenu])

  function EmpCard({ e }: { e: EmployeeRow }) {
    const dept = e.department as { name: string } | null
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', !e.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-red-600">{e.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{e.name}</p>
              <p className="text-xs font-mono text-gray-400">{e.employee_code || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge label={e.is_active ? 'Active' : 'Inactive'} variant={e.is_active ? 'success' : 'error'} />
            <button ref={el => { if (el) menuBtnRefs.current.set(e.id, el) }} onClick={ev => { ev.stopPropagation(); openMenu(e.id) }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-gray-500">
          {dept && <span className="flex items-center gap-1"><Building size={11} />{dept.name}</span>}
          {e.designation && <span className="flex items-center gap-1"><Briefcase size={11} />{e.designation}</span>}
          <span className="flex items-center gap-1"><Phone size={11} />{e.phone}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
          <span className="text-xs text-gray-500">Net Salary: <span className="font-semibold text-green-600">{formatINR(e.net_salary)}</span></span>
        </div>
      </div>
    )
  }

  const menuActions = menuEmp ? [
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/admin/staff/employees/${menuEmp.id}/edit`) },
    { label: 'ID Card', icon: CreditCard, onClick: () => navigate(`/admin/staff/id-card?employee=${menuEmp.id}`) },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Employees</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{employees.length} total</p></div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigate('/admin/staff/id-card')} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50"><CreditCard size={16} /> <span className="hidden sm:inline">ID Card</span></button>
          <button onClick={() => navigate('/admin/staff/employees/new')} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm"><Plus size={16} /> Add Employee</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, code, phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Briefcase size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No employees found</p></div>
          : <div className="space-y-3">{filtered.map(e => <EmpCard key={e.id} e={e} />)}</div>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<Briefcase size={36} className="text-gray-300" />} emptyMessage="No employees found" />
      </div>

      {/* Action menu */}
      {menuOpen && menuEmp && (<>
        <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setMenuOpen(null)} />
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 pb-6">
          <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">{menuEmp.name}</p>
          <div className="space-y-1">
            {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><a.icon size={16} /> {a.label}</button>)}
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setMenuOpen(null); setToggleTarget(menuEmp) }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${menuEmp.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
              <Power size={16} /> {menuEmp.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
        <div className="hidden md:block fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, left: menuPos.left }}>
          {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><a.icon size={14} /> {a.label}</button>)}
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setMenuOpen(null); setToggleTarget(menuEmp) }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${menuEmp.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
            <Power size={14} /> {menuEmp.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </>)}

      <ConfirmDialog open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate Employee?' : 'Activate Employee?'}
        message={toggleTarget?.is_active ? `"${toggleTarget?.name}" will be deactivated.` : `"${toggleTarget?.name}" will be activated.`}
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'} variant={toggleTarget?.is_active ? 'danger' : 'info'} loading={toggling} />
    </div>
  )
}
