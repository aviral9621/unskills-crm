import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Building2, Plus, Search, MoreVertical,
  Pencil, Wallet, PlusCircle, Power, X, Trash2, Loader2, AlertTriangle,
  MapPin, Phone, ChevronRight, FileText, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, cn } from '../../lib/utils'
import type { Branch, BranchCategory } from '../../types'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import { viewAtcCertificate, downloadAtcCertificate } from '../../lib/atcCertificate'

const colHelper = createColumnHelper<Branch>()
type StatusFilter = 'all' | 'active' | 'inactive'
type CategoryFilter = 'all' | BranchCategory

export default function BranchListPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  // Portal dropdown
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<Branch | null>(null)
  const [toggling, setToggling] = useState(false)

  // ATC certificate action state (shared loading flag so the spinner shows
  // on the clicked row while the PDF is being generated in the background).
  const [atcBusyId, setAtcBusyId] = useState<string | null>(null)

  // Delete confirm (super admin only)
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)
  const [deleteCounts, setDeleteCounts] = useState<{ users: number; students: number; employees: number; expenses: number; wallet: number } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchBranches() }, [])
  useEffect(() => {
    const h = () => setMenuOpen(null)
    window.addEventListener('scroll', h, true)
    return () => window.removeEventListener('scroll', h, true)
  }, [])

  async function fetchBranches() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_branches').select('*').order('code', { ascending: true })
      if (error) throw error
      setBranches(data ?? [])
    } catch { toast.error('Failed to load branches') }
    finally { setLoading(false) }
  }

  const openMenu = useCallback((branchId: string) => {
    const btn = menuBtnRefs.current.get(branchId)
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuW = 224      // w-56
    const menuH = 330      // ~7 items + dividers; flips up if not enough room below
    const vh = window.innerHeight
    const vw = window.innerWidth
    // Vertical: prefer below, flip above if it would overflow
    const spaceBelow = vh - rect.bottom
    const top = spaceBelow >= menuH + 8
      ? rect.bottom + 4
      : Math.max(8, rect.top - menuH - 4)
    // Horizontal: right-align to button, clamp inside viewport
    const rawLeft = rect.right - menuW
    const left = Math.max(8, Math.min(rawLeft, vw - menuW - 8))
    setMenuPos({ top, left })
    setMenuOpen(branchId)
  }, [])

  const menuBranch = useMemo(() => branches.find(b => b.id === menuOpen), [branches, menuOpen])

  async function openDeleteFlow(branch: Branch) {
    setDeleteTarget(branch)
    setDeleteConfirmText('')
    setDeleteCounts(null)
    // Fetch counts in parallel
    const [u, s, e, ex, w] = await Promise.all([
      supabase.from('uce_profiles').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
      supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
      supabase.from('uce_employees').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
      supabase.from('uce_expenses').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
      supabase.from('uce_branch_wallet_transactions').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
    ])
    setDeleteCounts({
      users: u.count ?? 0,
      students: s.count ?? 0,
      employees: e.count ?? 0,
      expenses: ex.count ?? 0,
      wallet: w.count ?? 0,
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (deleteConfirmText.trim() !== deleteTarget.name) {
      toast.error('Branch name does not match')
      return
    }
    setDeleting(true)
    try {
      // Explicitly attach the user's access token as Bearer Authorization.
      // invoke() injects the apikey (required by the gateway); we override
      // Authorization so the edge function can resolve the caller to a user.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Session expired — please log in again'); return }
      const { data: json, error: fnErr } = await supabase.functions.invoke<{
        ok?: boolean; users_deleted?: number; error?: string
      }>('admin-delete-branch', {
        body: { branch_id: deleteTarget.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (fnErr) throw new Error(json?.error || fnErr.message || 'Failed to delete')
      if (json?.error) throw new Error(json.error)
      // Resequence all remaining branch codes so there are no gaps
      // (UCE-BR-001, 002, ... by creation order).
      const { error: resErr } = await supabase.rpc('resequence_branch_codes')
      if (resErr) console.warn('resequence failed', resErr)
      toast.success(`Branch "${deleteTarget.name}" and ${json?.users_deleted ?? 0} users deleted`)
      setDeleteTarget(null)
      // Refetch so the UI reflects the new codes
      await fetchBranches()
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete branch')
    } finally {
      setDeleting(false)
    }
  }

  async function handleViewAtc(branch: Branch) {
    setAtcBusyId(branch.id)
    try {
      await viewAtcCertificate(branch.id)
    } catch (err) {
      toast.error((err as Error).message || 'Failed to open certificate')
    } finally {
      setAtcBusyId(null)
    }
  }

  async function handleDownloadAtc(branch: Branch) {
    setAtcBusyId(branch.id)
    try {
      await downloadAtcCertificate(branch.id, branch.name)
      toast.success('Certificate downloaded')
    } catch (err) {
      toast.error((err as Error).message || 'Failed to download certificate')
    } finally {
      setAtcBusyId(null)
    }
  }

  async function handleToggle() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const ns = !toggleTarget.is_active
      const { error } = await supabase.from('uce_branches').update({ is_active: ns, updated_at: new Date().toISOString() }).eq('id', toggleTarget.id)
      if (error) throw error
      toast.success(`Branch ${toggleTarget.name} ${ns ? 'activated' : 'deactivated'}`)
      setBranches(p => p.map(b => b.id === toggleTarget.id ? { ...b, is_active: ns } : b))
    } catch { toast.error('Failed to update status') }
    finally { setToggling(false); setToggleTarget(null) }
  }

  /* ─── Filtered + searched ─── */
  const filteredData = useMemo(() => {
    let r = branches
    if (statusFilter === 'active') r = r.filter(b => b.is_active)
    else if (statusFilter === 'inactive') r = r.filter(b => !b.is_active)
    if (categoryFilter !== 'all') r = r.filter(b => b.category === categoryFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(b => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q))
    }
    return r
  }, [branches, statusFilter, categoryFilter, search])

  /* ─── Desktop Table Columns ─── */
  const columns = useMemo(() => [
    colHelper.accessor('code', {
      header: 'Code',
      cell: (info) => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{info.getValue()}</span>,
    }),
    colHelper.accessor('name', {
      header: 'Branch Name',
      cell: (info) => (
        <div className="flex items-center gap-2.5 min-w-[160px]">
          {info.row.original.center_logo_url ? (
            <img src={info.row.original.center_logo_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-gray-200" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><Building2 size={16} className="text-red-500" /></div>
          )}
          <span className="text-sm font-medium text-gray-900">{info.getValue()}</span>
        </div>
      ),
    }),
    colHelper.accessor('director_name', {
      header: 'Director',
      cell: (info) => (
        <div><p className="text-sm text-gray-900">{info.getValue()}</p><p className="text-xs text-gray-400">{info.row.original.director_phone}</p></div>
      ),
    }),
    colHelper.accessor('district', { header: 'District', cell: (info) => <span className="text-sm text-gray-600">{info.getValue()}</span> }),
    colHelper.accessor('state', { header: 'State', cell: (info) => <span className="text-sm text-gray-600">{info.getValue()}</span> }),
    colHelper.accessor('category', {
      header: 'Category',
      cell: (info) => {
        const v = info.getValue()
        const m: Record<string, 'info' | 'success' | 'warning'> = { computer: 'info', beautician: 'warning', both: 'success' }
        return <StatusBadge label={v.charAt(0).toUpperCase() + v.slice(1)} variant={m[v] ?? 'neutral'} />
      },
    }),
    colHelper.accessor('wallet_balance', {
      header: 'Wallet',
      cell: (info) => {
        const b = info.getValue()
        return <span className={`text-sm font-semibold ${b > 1000 ? 'text-green-600' : b > 0 ? 'text-amber-600' : 'text-red-600'}`}>{formatINR(b)}</span>
      },
    }),
    colHelper.accessor('is_active', {
      header: 'Status',
      cell: (info) => <StatusBadge label={info.getValue() ? 'Active' : 'Inactive'} variant={info.getValue() ? 'success' : 'error'} />,
    }),
    colHelper.display({
      id: 'actions', header: '', enableSorting: false,
      cell: (info) => (
        <button
          ref={el => { if (el) menuBtnRefs.current.set(info.row.original.id, el) }}
          onClick={e => { e.stopPropagation(); openMenu(info.row.original.id) }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        ><MoreVertical size={16} /></button>
      ),
    }),
  ], [openMenu])

  /* ─── Mobile Card ─── */
  function BranchCard({ branch }: { branch: Branch }) {
    const bal = branch.wallet_balance
    const catMap: Record<string, 'info' | 'success' | 'warning'> = { computer: 'info', beautician: 'warning', both: 'success' }
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4 transition-all', !branch.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {branch.center_logo_url ? (
              <img src={branch.center_logo_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-gray-200 shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><Building2 size={18} className="text-red-500" /></div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{branch.name}</p>
              <p className="text-xs font-mono text-gray-400">{branch.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge label={branch.is_active ? 'Active' : 'Inactive'} variant={branch.is_active ? 'success' : 'error'} />
            <button
              ref={el => { if (el) menuBtnRefs.current.set(branch.id, el) }}
              onClick={e => { e.stopPropagation(); openMenu(branch.id) }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            ><MoreVertical size={16} /></button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Phone size={12} className="shrink-0" />
            <span className="truncate">{branch.director_name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{branch.district}, {branch.state}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <StatusBadge label={branch.category.charAt(0).toUpperCase() + branch.category.slice(1)} variant={catMap[branch.category] ?? 'neutral'} />
            <span className={`text-sm font-bold ${bal > 1000 ? 'text-green-600' : bal > 0 ? 'text-amber-600' : 'text-red-600'}`}>
              {formatINR(bal)}
            </span>
          </div>
          <button onClick={() => navigate(`/admin/branches/${branch.id}/wallet`)} className="text-xs text-red-600 font-medium flex items-center gap-0.5">
            Wallet <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  /* ─── Skeleton Cards ─── */
  function SkeletonCards() {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-3 w-1/3 rounded" /></div>
            </div>
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-8 w-full rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Manage Branches</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{branches.length} total branches</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => navigate('/admin/branches/new')}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm shrink-0"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Add New</span> Branch
          </button>
        )}
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white">
              <option value="all">All Categories</option>
              <option value="computer">Computer</option>
              <option value="beautician">Beautician</option>
              <option value="both">Both</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Mobile Card List (< md) ─── */}
      <div className="md:hidden">
        {loading ? <SkeletonCards /> : filteredData.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No branches found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredData.map(b => <BranchCard key={b.id} branch={b} />)}
          </div>
        )}
      </div>

      {/* ─── Desktop Table (md+) ─── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filteredData} columns={columns} loading={loading} searchValue="" emptyIcon={<Building2 size={36} className="text-gray-300" />} emptyMessage="No branches found" />
      </div>

      {/* ─── Action Menu ─── */}
      {menuOpen && menuBranch && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setMenuOpen(null)} />

          {/* Mobile: bottom sheet */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 pb-6 safe-bottom animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">{menuBranch.name}</p>
            <div className="space-y-1">
              <button onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/edit`) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><Pencil size={16} /> Edit Branch</button>
              <button onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/wallet`) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><Wallet size={16} /> View Wallet</button>
              <button onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/wallet?add=true`) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><PlusCircle size={16} /> Add Balance</button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { setMenuOpen(null); handleViewAtc(menuBranch) }} disabled={atcBusyId === menuBranch.id}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60">
                {atcBusyId === menuBranch.id ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} View Certificate
              </button>
              <button onClick={() => { setMenuOpen(null); handleDownloadAtc(menuBranch) }} disabled={atcBusyId === menuBranch.id}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60">
                {atcBusyId === menuBranch.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download Certificate
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { setMenuOpen(null); setToggleTarget(menuBranch) }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${menuBranch.is_active ? 'text-amber-600 hover:bg-amber-50 active:bg-amber-100' : 'text-green-600 hover:bg-green-50 active:bg-green-100'}`}>
                <Power size={16} /> {menuBranch.is_active ? 'Deactivate' : 'Activate'}
              </button>
              {isSuperAdmin && (
                <button onClick={() => { setMenuOpen(null); openDeleteFlow(menuBranch) }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100">
                  <Trash2 size={16} /> Delete Permanently
                </button>
              )}
            </div>
          </div>

          {/* Desktop: floating dropdown (widened so "Download Certificate" fits on one line) */}
          <div className="hidden md:block fixed z-50 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, left: menuPos.left }}>
            <button onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/edit`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Pencil size={14} /> Edit Branch</button>
            <button onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/wallet`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Wallet size={14} /> View Wallet</button>
            <button onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/wallet?add=true`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><PlusCircle size={14} /> Add Balance</button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setMenuOpen(null); handleViewAtc(menuBranch) }} disabled={atcBusyId === menuBranch.id}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              {atcBusyId === menuBranch.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} View Certificate
            </button>
            <button onClick={() => { setMenuOpen(null); handleDownloadAtc(menuBranch) }} disabled={atcBusyId === menuBranch.id}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              {atcBusyId === menuBranch.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download Certificate
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setMenuOpen(null); setToggleTarget(menuBranch) }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${menuBranch.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}>
              <Power size={14} /> {menuBranch.is_active ? 'Deactivate' : 'Activate'}
            </button>
            {isSuperAdmin && (
              <button onClick={() => { setMenuOpen(null); openDeleteFlow(menuBranch) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Delete Permanently
              </button>
            )}
          </div>
        </>
      )}

      {/* ─── Delete Branch Modal (Super Admin) ─── */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => !deleting && setDeleteTarget(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-gray-100 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900">Delete Branch Permanently?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
                </div>
                <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                  <p className="font-semibold mb-1.5">The following will be permanently deleted:</p>
                  {deleteCounts ? (
                    <ul className="space-y-1">
                      <li>• Branch <b>{deleteTarget.name}</b> ({deleteTarget.code})</li>
                      <li>• <b>{deleteCounts.users}</b> user{deleteCounts.users !== 1 ? 's' : ''} (login accounts)</li>
                      <li>• <b>{deleteCounts.students}</b> student record{deleteCounts.students !== 1 ? 's' : ''}</li>
                      <li>• <b>{deleteCounts.employees}</b> employee record{deleteCounts.employees !== 1 ? 's' : ''}</li>
                      <li>• <b>{deleteCounts.expenses}</b> expense record{deleteCounts.expenses !== 1 ? 's' : ''}</li>
                      <li>• <b>{deleteCounts.wallet}</b> wallet transaction{deleteCounts.wallet !== 1 ? 's' : ''}</li>
                      <li>• All linked marksheets, certificates, attendance, salary slips, etc.</li>
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading impact…</div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Type <span className="font-mono font-bold text-red-600">{deleteTarget.name}</span> to confirm:
                  </label>
                  <input
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="Branch name"
                    disabled={deleting}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || !deleteCounts || deleteConfirmText.trim() !== deleteTarget.name}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {deleting && <Loader2 size={16} className="animate-spin" />}
                    {deleting ? 'Deleting…' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate Branch?' : 'Activate Branch?'}
        message={toggleTarget?.is_active ? `This will deactivate "${toggleTarget?.name}". Branch users will lose access.` : `This will activate "${toggleTarget?.name}". Branch users will regain access.`}
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'} variant={toggleTarget?.is_active ? 'danger' : 'info'} loading={toggling} />
    </div>
  )
}
