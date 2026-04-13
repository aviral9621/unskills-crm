import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  GraduationCap, Plus, Search, MoreVertical, Pencil, Power,
  X, Phone, BookOpen, CreditCard, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'

interface StudentRow {
  id: string; registration_no: string; name: string; phone: string
  total_fee: number; net_fee: number; is_active: boolean; created_at: string
  course?: { name: string } | null; branch?: { name: string } | null
  paid?: number
}

const colHelper = createColumnHelper<StudentRow>()

export default function StudentListPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [toggleTarget, setToggleTarget] = useState<StudentRow | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => { const h = () => setMenuOpen(null); window.addEventListener('scroll', h, true); return () => window.removeEventListener('scroll', h, true) }, [])

  async function fetchStudents() {
    setLoading(true)
    try {
      let q = supabase.from('uce_students').select('id, registration_no, name, phone, total_fee, net_fee, is_active, created_at, course:uce_courses(name), branch:uce_branches(name)')
      if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error

      // Fetch total paid per student
      const ids = (data ?? []).map((s: { id: string }) => s.id)
      let paidMap: Record<string, number> = {}
      if (ids.length > 0) {
        const { data: payments } = await supabase.from('uce_student_fee_payments').select('student_id, amount').in('student_id', ids)
        payments?.forEach(p => { paidMap[p.student_id] = (paidMap[p.student_id] || 0) + p.amount })
      }

      setStudents((data ?? []).map((s: Record<string, unknown>) => ({ ...s, paid: paidMap[(s as { id: string }).id] || 0 })) as StudentRow[])
    } catch { toast.error('Failed to load students') }
    finally { setLoading(false) }
  }

  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id); if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  const menuStudent = useMemo(() => students.find(s => s.id === menuOpen), [students, menuOpen])

  async function handleToggle() {
    if (!toggleTarget) return; setToggling(true)
    try {
      const ns = !toggleTarget.is_active
      const { error } = await supabase.from('uce_students').update({ is_active: ns, updated_at: new Date().toISOString() }).eq('id', toggleTarget.id)
      if (error) throw error
      toast.success(`${toggleTarget.name} ${ns ? 'activated' : 'deactivated'}`)
      setStudents(p => p.map(s => s.id === toggleTarget.id ? { ...s, is_active: ns } : s))
    } catch { toast.error('Failed') }
    finally { setToggling(false); setToggleTarget(null) }
  }

  const filtered = useMemo(() => {
    let r = students
    if (statusFilter === 'active') r = r.filter(s => s.is_active)
    else if (statusFilter === 'inactive') r = r.filter(s => !s.is_active)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(s => s.name.toLowerCase().includes(q) || s.registration_no.toLowerCase().includes(q) || s.phone.includes(q)) }
    return r
  }, [students, statusFilter, search])

  const columns = useMemo(() => [
    colHelper.accessor('registration_no', { header: 'Reg No', cell: i => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{i.getValue()}</span> }),
    colHelper.accessor('name', { header: 'Name', cell: i => <span className="text-sm font-medium text-gray-900 min-w-[120px] block">{i.getValue()}</span> }),
    colHelper.display({ id: 'course', header: 'Course', cell: i => <span className="text-sm text-gray-600">{(i.row.original.course as { name: string } | null)?.name || '—'}</span> }),
    colHelper.accessor('net_fee', { header: 'Fee', cell: i => <span className="text-sm text-gray-700">{formatINR(i.getValue())}</span> }),
    colHelper.display({ id: 'paid', header: 'Paid', cell: i => <span className="text-sm text-green-600 font-medium">{formatINR(i.row.original.paid || 0)}</span> }),
    colHelper.display({ id: 'due', header: 'Due', cell: i => { const due = (i.row.original.net_fee || 0) - (i.row.original.paid || 0); return <span className={`text-sm font-semibold ${due > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatINR(Math.max(0, due))}</span> } }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <button ref={el => { if (el) menuBtnRefs.current.set(i.row.original.id, el) }} onClick={e => { e.stopPropagation(); openMenu(i.row.original.id) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
    )}),
  ], [openMenu])

  function StudentCard({ s }: { s: StudentRow }) {
    const course = s.course as { name: string } | null
    const due = Math.max(0, (s.net_fee || 0) - (s.paid || 0))
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', !s.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-red-600">{s.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
              <p className="text-xs font-mono text-gray-400">{s.registration_no}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge label={s.is_active ? 'Active' : 'Inactive'} variant={s.is_active ? 'success' : 'error'} />
            <button ref={el => { if (el) menuBtnRefs.current.set(s.id, el) }} onClick={e => { e.stopPropagation(); openMenu(s.id) }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-gray-500">
          {course && <span className="flex items-center gap-1"><BookOpen size={11} />{course.name}</span>}
          <span className="flex items-center gap-1"><Phone size={11} />{s.phone}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Fee: <span className="font-medium text-gray-700">{formatINR(s.net_fee)}</span></span>
            <span className="text-xs text-green-600">Paid: {formatINR(s.paid || 0)}</span>
            {due > 0 && <span className="text-xs font-semibold text-red-600">Due: {formatINR(due)}</span>}
          </div>
        </div>
      </div>
    )
  }

  const menuActions = menuStudent ? [
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/admin/students/register?edit=${menuStudent.id}`) },
    { label: 'ID Card', icon: CreditCard, onClick: () => navigate(`/admin/students/id-card?student=${menuStudent.id}`) },
    { label: 'Admit Card', icon: ClipboardList, onClick: () => navigate(`/admin/students/admit-card?student=${menuStudent.id}`) },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Students</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{students.length} total</p></div>
        <button onClick={() => navigate('/admin/students/register')} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Register</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, reg no, phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><GraduationCap size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No students found</p></div>
          : <div className="space-y-3">{filtered.map(s => <StudentCard key={s.id} s={s} />)}</div>}
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<GraduationCap size={36} className="text-gray-300" />} emptyMessage="No students found" />
      </div>

      {menuOpen && menuStudent && (<>
        <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setMenuOpen(null)} />
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 pb-6">
          <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">{menuStudent.name}</p>
          <div className="space-y-1">
            {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><a.icon size={16} /> {a.label}</button>)}
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setMenuOpen(null); setToggleTarget(menuStudent) }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${menuStudent.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
              <Power size={16} /> {menuStudent.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
        <div className="hidden md:block fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, left: menuPos.left }}>
          {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><a.icon size={14} /> {a.label}</button>)}
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setMenuOpen(null); setToggleTarget(menuStudent) }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${menuStudent.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
            <Power size={14} /> {menuStudent.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </>)}

      <ConfirmDialog open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate Student?' : 'Activate Student?'}
        message={toggleTarget?.is_active ? `"${toggleTarget?.name}" will lose login access.` : `"${toggleTarget?.name}" will regain access.`}
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'} variant={toggleTarget?.is_active ? 'danger' : 'info'} loading={toggling} />
    </div>
  )
}
