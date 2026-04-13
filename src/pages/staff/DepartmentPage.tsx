import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Building, Plus, Search, MoreVertical, Pencil, Power, Trash2, X, Users, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'

interface DepartmentRow {
  id: string; name: string; is_active: boolean; created_at: string
  employee_count?: number
}

const colHelper = createColumnHelper<DepartmentRow>()

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DepartmentRow | null>(null)
  const [deptName, setDeptName] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toggle
  const [toggleTarget, setToggleTarget] = useState<DepartmentRow | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => { fetchDepartments() }, [])
  useEffect(() => { const h = () => setMenuOpen(null); window.addEventListener('scroll', h, true); return () => window.removeEventListener('scroll', h, true) }, [])

  async function fetchDepartments() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_departments').select('*').order('name')
      if (error) throw error

      // Count employees per department
      const { data: empCounts } = await supabase.from('uce_employees').select('department_id')
      const countMap: Record<string, number> = {}
      empCounts?.forEach(e => { if (e.department_id) countMap[e.department_id] = (countMap[e.department_id] || 0) + 1 })

      setDepartments((data ?? []).map(d => ({ ...d, employee_count: countMap[d.id] || 0 })))
    } catch { toast.error('Failed to load departments') }
    finally { setLoading(false) }
  }

  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id); if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  const menuDept = useMemo(() => departments.find(d => d.id === menuOpen), [departments, menuOpen])

  function openAdd() {
    setEditTarget(null)
    setDeptName('')
    setNameError('')
    setModalOpen(true)
  }

  function openEdit(d: DepartmentRow) {
    setEditTarget(d)
    setDeptName(d.name)
    setNameError('')
    setModalOpen(true)
  }

  async function handleSave() {
    const trimmed = deptName.trim()
    if (!trimmed) { setNameError('Department name is required'); return }
    if (trimmed.length < 2) { setNameError('At least 2 characters'); return }

    // Check duplicate
    const dup = departments.find(d => d.name.toLowerCase() === trimmed.toLowerCase() && d.id !== editTarget?.id)
    if (dup) { setNameError('Department already exists'); return }

    setSaving(true)
    try {
      if (editTarget) {
        const { error } = await supabase.from('uce_departments').update({ name: trimmed }).eq('id', editTarget.id)
        if (error) throw error
        toast.success('Department updated')
        setDepartments(p => p.map(d => d.id === editTarget.id ? { ...d, name: trimmed } : d))
      } else {
        const { data, error } = await supabase.from('uce_departments').insert({ name: trimmed }).select().single()
        if (error) throw error
        toast.success('Department added')
        setDepartments(p => [...p, { ...data, employee_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setModalOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed'
      if (msg.includes('duplicate') || msg.includes('unique')) setNameError('Department already exists')
      else toast.error(msg)
    }
    finally { setSaving(false) }
  }

  async function handleToggle() {
    if (!toggleTarget) return; setToggling(true)
    try {
      const ns = !toggleTarget.is_active
      const { error } = await supabase.from('uce_departments').update({ is_active: ns }).eq('id', toggleTarget.id)
      if (error) throw error
      toast.success(`${toggleTarget.name} ${ns ? 'activated' : 'deactivated'}`)
      setDepartments(p => p.map(d => d.id === toggleTarget.id ? { ...d, is_active: ns } : d))
    } catch { toast.error('Failed') }
    finally { setToggling(false); setToggleTarget(null) }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      if ((deleteTarget.employee_count || 0) > 0) {
        toast.error('Cannot delete department with employees assigned')
        setDeleting(false); setDeleteTarget(null); return
      }
      const { error } = await supabase.from('uce_departments').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Department deleted')
      setDepartments(p => p.filter(d => d.id !== deleteTarget.id))
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  const filtered = useMemo(() => {
    let r = departments
    if (statusFilter === 'active') r = r.filter(d => d.is_active)
    else if (statusFilter === 'inactive') r = r.filter(d => !d.is_active)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(d => d.name.toLowerCase().includes(q)) }
    return r
  }, [departments, statusFilter, search])

  const columns = useMemo(() => [
    colHelper.display({ id: 'sno', header: '#', cell: i => <span className="text-sm text-gray-500">{i.row.index + 1}</span> }),
    colHelper.accessor('name', { header: 'Department Name', cell: i => <span className="text-sm font-medium text-gray-900">{i.getValue()}</span> }),
    colHelper.display({ id: 'employees', header: 'Employees', cell: i => (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
        <Users size={14} /> {i.row.original.employee_count || 0}
      </span>
    )}),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <button ref={el => { if (el) menuBtnRefs.current.set(i.row.original.id, el) }} onClick={e => { e.stopPropagation(); openMenu(i.row.original.id) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
    )}),
  ], [openMenu])

  function DeptCard({ d }: { d: DepartmentRow }) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', !d.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <Building size={18} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Users size={12} /> {d.employee_count || 0} employees</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge label={d.is_active ? 'Active' : 'Inactive'} variant={d.is_active ? 'success' : 'error'} />
            <button ref={el => { if (el) menuBtnRefs.current.set(d.id, el) }} onClick={e => { e.stopPropagation(); openMenu(d.id) }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
          </div>
        </div>
      </div>
    )
  }

  const menuActions = menuDept ? [
    { label: 'Edit', icon: Pencil, onClick: () => openEdit(menuDept), color: '' },
    { label: 'Delete', icon: Trash2, onClick: () => setDeleteTarget(menuDept), color: 'text-red-600 hover:bg-red-50' },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Departments</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{departments.length} total</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <Plus size={16} /> Add Department
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search departments..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Building size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No departments found</p></div>
          : <div className="space-y-3">{filtered.map(d => <DeptCard key={d.id} d={d} />)}</div>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<Building size={36} className="text-gray-300" />} emptyMessage="No departments found" />
      </div>

      {/* Action menu */}
      {menuOpen && menuDept && (<>
        <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setMenuOpen(null)} />
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 pb-6">
          <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">{menuDept.name}</p>
          <div className="space-y-1">
            {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${a.color || 'text-gray-700 hover:bg-gray-50'}`}><a.icon size={16} /> {a.label}</button>)}
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setMenuOpen(null); setToggleTarget(menuDept) }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${menuDept.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
              <Power size={16} /> {menuDept.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
        <div className="hidden md:block fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, left: menuPos.left }}>
          {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${a.color || 'text-gray-700 hover:bg-gray-50'}`}><a.icon size={14} /> {a.label}</button>)}
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setMenuOpen(null); setToggleTarget(menuDept) }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${menuDept.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
            <Power size={14} /> {menuDept.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </>)}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Department' : 'Add Department'} size="sm">
        <div className="space-y-4">
          <FormField label="Department Name" required error={nameError}>
            <input type="text" value={deptName} onChange={e => { setDeptName(e.target.value); setNameError('') }}
              placeholder="e.g. Marketing" className={inputClass} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {saving && <Loader2 size={16} className="animate-spin" />} {editTarget ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toggle confirm */}
      <ConfirmDialog open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate Department?' : 'Activate Department?'}
        message={toggleTarget?.is_active ? `"${toggleTarget?.name}" will be deactivated.` : `"${toggleTarget?.name}" will be activated.`}
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'} variant={toggleTarget?.is_active ? 'danger' : 'info'} loading={toggling} />

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Department?" message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
