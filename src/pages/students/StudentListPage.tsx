import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  GraduationCap, Plus, Search, MoreVertical, Pencil,
  X, Phone, BookOpen, CreditCard, ClipboardList, UserMinus, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import Modal from '../../components/Modal'
import { lockedStudentIds } from '../../lib/studentLock'
import { Lock } from 'lucide-react'

interface StudentRow {
  id: string; registration_no: string; name: string; phone: string
  total_fee: number; net_fee: number; is_active: boolean; created_at: string
  course?: { name: string; program?: { slug: string; name: string } | null } | null
  branch?: { name: string } | null
  paid?: number; locked?: boolean
  completed?: boolean
  certificate_number?: string | null
  issue_date?: string | null
}

interface ProgramRow { slug: string; name: string }

const colHelper = createColumnHelper<StudentRow>()

export default function StudentListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const base = location.pathname.startsWith('/franchise') ? '/franchise' : '/admin'
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const initialStatus = (() => {
    const p = new URLSearchParams(location.search).get('filter')
    if (p === 'completed') return 'completed'
    if (p === 'dropped') return 'inactive'
    return 'active'
  })() as 'all' | 'active' | 'inactive' | 'completed'
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'completed'>(initialStatus)
  const [programFilter, setProgramFilter] = useState<string>('all')
  const [programs, setPrograms] = useState<ProgramRow[]>([])

  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [reactivateTarget, setReactivateTarget] = useState<StudentRow | null>(null)
  const [toggling, setToggling] = useState(false)
  const [dropTarget, setDropTarget] = useState<StudentRow | null>(null)
  const [dropReason, setDropReason] = useState('')
  const [dropping, setDropping] = useState(false)

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => {
    supabase.from('uce_programs').select('slug, name').order('display_order')
      .then(({ data }) => setPrograms((data ?? []) as ProgramRow[]))
  }, [])
  useEffect(() => { const h = () => setMenuOpen(null); window.addEventListener('scroll', h, true); return () => window.removeEventListener('scroll', h, true) }, [])

  async function fetchStudents() {
    setLoading(true)
    try {
      let q = supabase.from('uce_students').select('id, registration_no, name, phone, total_fee, net_fee, is_active, created_at, course:uce_courses(name, program:uce_programs(slug, name)), branch:uce_branches!uce_students_branch_id_fkey(name)')
      if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) throw error

      const ids = (data ?? []).map((s: { id: string }) => s.id)
      // Chunk .in() lookups — for large datasets (super_admin sees all 1000+ students)
      // a single .in() with all UUIDs blows past PostgREST/Vercel URL length limits.
      const CHUNK = 200
      const idChunks: string[][] = []
      for (let i = 0; i < ids.length; i += CHUNK) idChunks.push(ids.slice(i, i + CHUNK))

      // Fetch total paid per student
      let paidMap: Record<string, number> = {}
      if (ids.length > 0) {
        const paymentResults = await Promise.all(idChunks.map(c =>
          supabase.from('uce_student_fee_payments').select('student_id, amount').in('student_id', c)
        ))
        paymentResults.forEach(({ data: payments }) => {
          payments?.forEach(p => { paidMap[p.student_id] = (paidMap[p.student_id] || 0) + p.amount })
        })
      }

      const lockedSet = await lockedStudentIds(ids)

      // Certificate lookup — a student is "completed" if they have an active certificate.
      let certMap: Record<string, { certificate_number: string; issue_date: string | null }> = {}
      if (ids.length > 0) {
        const certResults = await Promise.all(idChunks.map(c =>
          supabase
            .from('uce_certificates')
            .select('student_id, certificate_number, issue_date, status')
            .in('student_id', c)
            .eq('status', 'active')
        ))
        certResults.forEach(({ data: certs }) => {
          certs?.forEach((c: { student_id: string; certificate_number: string; issue_date: string | null }) => {
            if (!certMap[c.student_id]) certMap[c.student_id] = { certificate_number: c.certificate_number, issue_date: c.issue_date }
          })
        })
      }

      setStudents((data ?? []).map((s: Record<string, unknown>) => {
        const id = (s as { id: string }).id
        const cert = certMap[id]
        return {
          ...s,
          paid: paidMap[id] || 0,
          locked: lockedSet.has(id),
          completed: !!cert,
          certificate_number: cert?.certificate_number ?? null,
          issue_date: cert?.issue_date ?? null,
        }
      }) as StudentRow[])
    } catch (e) {
      console.error('[StudentListPage] fetchStudents failed:', e)
      toast.error('Failed to load students')
    }
    finally { setLoading(false) }
  }

  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id); if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  const menuStudent = useMemo(() => students.find(s => s.id === menuOpen), [students, menuOpen])

  async function handleReactivate() {
    if (!reactivateTarget) return; setToggling(true)
    try {
      const { error } = await supabase.from('uce_students').update({
        is_active: true,
        dropped_reason: null,
        dropped_at: null,
        updated_at: new Date().toISOString(),
      }).eq('id', reactivateTarget.id)
      if (error) throw error
      toast.success(`${reactivateTarget.name} reactivated`)
      setStudents(p => p.map(s => s.id === reactivateTarget.id ? { ...s, is_active: true } : s))
    } catch { toast.error('Failed') }
    finally { setToggling(false); setReactivateTarget(null) }
  }

  async function handleDrop() {
    if (!dropTarget) return
    if (!dropReason.trim()) { toast.error('Please enter a reason for dropping the student'); return }
    setDropping(true)
    try {
      const { error } = await supabase.from('uce_students').update({
        is_active: false,
        dropped_reason: dropReason.trim(),
        dropped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', dropTarget.id)
      if (error) throw error
      toast.success(`${dropTarget.name} marked as dropped`)
      // Remove from current list view (user explicitly asked: "should be removed from the student list")
      setStudents(p => p.filter(s => s.id !== dropTarget.id))
    } catch { toast.error('Failed to mark as dropped') }
    finally { setDropping(false); setDropTarget(null); setDropReason('') }
  }

  const filtered = useMemo(() => {
    let r = students
    if (statusFilter === 'active') r = r.filter(s => s.is_active)
    else if (statusFilter === 'inactive') r = r.filter(s => !s.is_active)
    else if (statusFilter === 'completed') r = r.filter(s => s.completed)
    if (programFilter !== 'all') r = r.filter(s => s.course?.program?.slug === programFilter)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(s => s.name.toLowerCase().includes(q) || s.registration_no.toLowerCase().includes(q) || s.phone.includes(q)) }
    return r
  }, [students, statusFilter, programFilter, search])

  const columns = useMemo(() => [
    colHelper.accessor('registration_no', { header: 'Reg No', cell: i => {
      const regNo = i.getValue()
      const studentId = i.row.original.id
      if (isSuperAdmin) {
        return (
          <button
            onClick={e => { e.stopPropagation(); window.open(`/admin/view-as/${studentId}/dashboard`, '_blank') }}
            title="Open student dashboard view in new tab"
            className="text-xs font-mono font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded cursor-pointer transition-colors"
          >
            {regNo}
          </button>
        )
      }
      return <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{regNo}</span>
    } }),
    colHelper.accessor('name', { header: 'Name', cell: i => <span className="text-sm font-medium text-gray-900 min-w-[120px] block">{i.getValue()}</span> }),
    colHelper.display({ id: 'course', header: 'Course', cell: i => <span className="text-sm text-gray-600">{(i.row.original.course as { name: string } | null)?.name || '—'}</span> }),
    colHelper.accessor('net_fee', { header: 'Fee', cell: i => <span className="text-sm text-gray-700">{formatINR(i.getValue())}</span> }),
    colHelper.display({ id: 'paid', header: 'Paid', cell: i => <span className="text-sm text-green-600 font-medium">{formatINR(i.row.original.paid || 0)}</span> }),
    colHelper.display({ id: 'due', header: 'Due', cell: i => { const due = (i.row.original.net_fee || 0) - (i.row.original.paid || 0); return <span className={`text-sm font-semibold ${due > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatINR(Math.max(0, due))}</span> } }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => (
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusBadge label={i.getValue() ? 'Active' : 'Dropped'} variant={i.getValue() ? 'success' : 'error'} />
        {i.row.original.completed && <span title="Course completed — certificate issued" className="inline-flex items-center gap-1 rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[10px] font-semibold"><GraduationCap size={10} /> COMPLETED</span>}
        {i.row.original.locked && <span title="Locked — certificate/result issued" className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold"><Lock size={10} /> LOCKED</span>}
      </div>
    ) }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <button ref={el => { if (el) menuBtnRefs.current.set(i.row.original.id, el) }} onClick={e => { e.stopPropagation(); openMenu(i.row.original.id) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
    )}),
  ], [openMenu, isSuperAdmin])

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
            <StatusBadge label={s.is_active ? 'Active' : 'Dropped'} variant={s.is_active ? 'success' : 'error'} />
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
    {
      label: menuStudent.locked ? 'Edit (Locked)' : 'Edit', icon: menuStudent.locked ? Lock : Pencil,
      onClick: () => {
        if (menuStudent.locked) { toast.error('Student is locked — certificate or result already issued'); return }
        navigate(`${base}/students/register?edit=${menuStudent.id}`)
      },
    },
    { label: 'ID Card', icon: CreditCard, onClick: () => navigate(`${base}/students/id-card?student=${menuStudent.id}`) },
    ...(base === '/admin' ? [{ label: 'Admit Card', icon: ClipboardList, onClick: () => navigate(`/admin/students/admit-card?student=${menuStudent.id}`) }] : []),
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Students</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{students.length} total</p></div>
        <button onClick={() => navigate(`${base}/students/register`)} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Register</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 sm:flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, reg no, phone..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <select value={programFilter} onChange={e => setProgramFilter(e.target.value)}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="all">All Programs</option>
            {programs.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'completed')}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
            <option value="active">Active</option>
            <option value="inactive">Dropped</option>
            <option value="completed">Completed (Cert Issued)</option>
            <option value="all">All (incl. dropped)</option>
          </select>
          {statusFilter === 'completed' && (
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded flex items-center gap-1"><GraduationCap size={12} /> Showing {filtered.length} completed</span>
          )}
          {(programFilter !== 'all' || statusFilter !== 'active' || search) && (
            <button onClick={() => { setProgramFilter('all'); setStatusFilter('active'); setSearch('') }}
              className="text-xs text-gray-500 hover:text-red-600 underline underline-offset-2 sm:ml-auto">
              Clear filters
            </button>
          )}
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
            {menuStudent.is_active ? (
              <button onClick={() => { setMenuOpen(null); setDropTarget(menuStudent); setDropReason('') }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50">
                <UserMinus size={16} /> Mark as Dropped</button>
            ) : (
              <button onClick={() => { setMenuOpen(null); setReactivateTarget(menuStudent) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-green-600 hover:bg-green-50">
                <RotateCcw size={16} /> Reactivate</button>
            )}
          </div>
        </div>
        <div className="hidden md:block fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, left: menuPos.left }}>
          {menuActions.map(a => <button key={a.label} onClick={() => { setMenuOpen(null); a.onClick() }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><a.icon size={14} /> {a.label}</button>)}
          <div className="border-t border-gray-100 my-1" />
          {menuStudent.is_active ? (
            <button onClick={() => { setMenuOpen(null); setDropTarget(menuStudent); setDropReason('') }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50">
              <UserMinus size={14} /> Mark as Dropped</button>
          ) : (
            <button onClick={() => { setMenuOpen(null); setReactivateTarget(menuStudent) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-green-600 hover:bg-green-50">
              <RotateCcw size={14} /> Reactivate</button>
          )}
        </div>
      </>)}

      <Modal open={!!dropTarget} onClose={() => { if (!dropping) { setDropTarget(null); setDropReason('') } }} title="Mark Student as Dropped" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <UserMinus size={18} className="text-red-600 mt-0.5 shrink-0" />
            <div className="text-xs text-red-800">
              <p className="font-semibold">{dropTarget?.name} ({dropTarget?.registration_no})</p>
              <p className="mt-0.5">This student will be removed from the active list and shown as <b>DROPPED</b> on public verification. Login access will be revoked.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for dropping <span className="text-red-500">*</span></label>
            <textarea
              value={dropReason}
              onChange={e => setDropReason(e.target.value)}
              rows={3}
              placeholder="e.g. Joined another institute, financial issues, relocated, lost interest…"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setDropTarget(null); setDropReason('') }} disabled={dropping} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleDrop} disabled={dropping || !dropReason.trim()} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{dropping ? 'Saving...' : 'Confirm Drop'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!reactivateTarget} onClose={() => setReactivateTarget(null)} onConfirm={handleReactivate}
        title="Reactivate Student?"
        message={`"${reactivateTarget?.name}" will be restored to the active list. Public verification will no longer show DROPPED.`}
        confirmText="Reactivate" variant="info" loading={toggling} />
    </div>
  )
}
