import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Building2, Plus, Search, MoreHorizontal,
  Pencil, Wallet, PlusCircle, Power, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR } from '../../lib/utils'
import type { Branch, BranchCategory } from '../../types'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'

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

  // Dropdown menu — portal approach
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<Branch | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetchBranches()
  }, [])

  // Close menu on scroll
  useEffect(() => {
    function handleScroll() { setMenuOpen(null) }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [])

  async function fetchBranches() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_branches')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setBranches(data ?? [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  const openMenu = useCallback((branchId: string) => {
    const btn = menuBtnRefs.current.get(branchId)
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 }) // 176 = w-44
    setMenuOpen(branchId)
  }, [])

  const menuBranch = useMemo(() => branches.find(b => b.id === menuOpen), [branches, menuOpen])

  /* ─── Toggle Active ─── */
  async function handleToggle() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const newStatus = !toggleTarget.is_active
      const { error } = await supabase
        .from('uce_branches')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', toggleTarget.id)
      if (error) throw error
      toast.success(`Branch ${toggleTarget.name} ${newStatus ? 'activated' : 'deactivated'}`)
      setBranches((prev) =>
        prev.map((b) => b.id === toggleTarget.id ? { ...b, is_active: newStatus } : b)
      )
    } catch (err) {
      console.error(err)
      toast.error('Failed to update branch status')
    } finally {
      setToggling(false)
      setToggleTarget(null)
    }
  }

  /* ─── Filtered data ─── */
  const filteredData = useMemo(() => {
    let result = branches
    if (statusFilter === 'active') result = result.filter((b) => b.is_active)
    else if (statusFilter === 'inactive') result = result.filter((b) => !b.is_active)
    if (categoryFilter !== 'all') result = result.filter((b) => b.category === categoryFilter)
    return result
  }, [branches, statusFilter, categoryFilter])

  /* ─── Table Columns ─── */
  const columns = useMemo(
    () => [
      colHelper.accessor('code', {
        header: 'Code',
        cell: (info) => (
          <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
            {info.getValue()}
          </span>
        ),
      }),
      colHelper.accessor('name', {
        header: 'Branch Name',
        cell: (info) => (
          <div className="flex items-center gap-2.5 min-w-[160px]">
            {info.row.original.center_logo_url ? (
              <img src={info.row.original.center_logo_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-gray-200" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <Building2 size={16} className="text-red-500" />
              </div>
            )}
            <span className="text-sm font-medium text-gray-900">{info.getValue()}</span>
          </div>
        ),
      }),
      colHelper.accessor('director_name', {
        header: 'Director',
        cell: (info) => (
          <div>
            <p className="text-sm text-gray-900">{info.getValue()}</p>
            <p className="text-xs text-gray-400">{info.row.original.director_phone}</p>
          </div>
        ),
      }),
      colHelper.accessor('district', {
        header: 'District',
        cell: (info) => <span className="text-sm text-gray-600">{info.getValue()}</span>,
      }),
      colHelper.accessor('state', {
        header: 'State',
        cell: (info) => <span className="text-sm text-gray-600">{info.getValue()}</span>,
      }),
      colHelper.accessor('category', {
        header: 'Category',
        cell: (info) => {
          const v = info.getValue()
          const map: Record<string, 'info' | 'success' | 'warning'> = {
            computer: 'info', beautician: 'warning', both: 'success',
          }
          return <StatusBadge label={v.charAt(0).toUpperCase() + v.slice(1)} variant={map[v] ?? 'neutral'} />
        },
      }),
      colHelper.accessor('wallet_balance', {
        header: 'Wallet',
        cell: (info) => {
          const bal = info.getValue()
          const color = bal > 1000 ? 'text-green-600' : bal > 0 ? 'text-amber-600' : 'text-red-600'
          return <span className={`text-sm font-semibold ${color}`}>{formatINR(bal)}</span>
        },
      }),
      colHelper.accessor('is_active', {
        header: 'Status',
        cell: (info) => (
          <StatusBadge
            label={info.getValue() ? 'Active' : 'Inactive'}
            variant={info.getValue() ? 'success' : 'error'}
          />
        ),
      }),
      colHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: (info) => {
          const branch = info.row.original
          return (
            <button
              ref={(el) => { if (el) menuBtnRefs.current.set(branch.id, el) }}
              onClick={(e) => { e.stopPropagation(); openMenu(branch.id) }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
          )
        },
      }),
    ],
    [openMenu]
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Manage Branches</h1>
          <p className="text-sm text-gray-500 mt-0.5">{branches.length} total branches</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => navigate('/admin/branches/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Add New Branch
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white"
          >
            <option value="all">All Categories</option>
            <option value="computer">Computer</option>
            <option value="beautician">Beautician</option>
            <option value="both">Both</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <DataTable
          data={filteredData}
          columns={columns}
          loading={loading}
          searchValue={search}
          emptyIcon={<Building2 size={36} className="text-gray-300" />}
          emptyMessage="No branches found"
        />
      </div>

      {/* ═══ Portal Dropdown Menu ═══ */}
      {menuOpen && menuBranch && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div
            className="fixed z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/edit`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} /> Edit Branch
            </button>
            <button
              onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/wallet`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Wallet size={14} /> View Wallet
            </button>
            <button
              onClick={() => { setMenuOpen(null); navigate(`/admin/branches/${menuBranch.id}/wallet?add=true`) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <PlusCircle size={14} /> Add Balance
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { setMenuOpen(null); setToggleTarget(menuBranch) }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${menuBranch.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
            >
              <Power size={14} /> {menuBranch.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </>
      )}

      {/* Toggle Confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate Branch?' : 'Activate Branch?'}
        message={
          toggleTarget?.is_active
            ? `This will deactivate "${toggleTarget?.name}". Branch users will lose access.`
            : `This will activate "${toggleTarget?.name}". Branch users will regain access.`
        }
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.is_active ? 'danger' : 'info'}
        loading={toggling}
      />
    </div>
  )
}
