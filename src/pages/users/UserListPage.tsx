import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Users, Plus, Search, MoreVertical, Pencil, ShieldCheck,
  Power, X, Mail, Phone, Building2, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import type { Profile, UserRole } from '../../types'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'

interface UserWithBranch extends Profile {
  branch?: { name: string } | null
}

const colHelper = createColumnHelper<UserWithBranch>()
type RoleFilter = 'all' | UserRole
type StatusFilter = 'all' | 'active' | 'inactive'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', branch_admin: 'Branch Admin', branch_staff: 'Branch Staff', student: 'Student',
}
const ROLE_VARIANTS: Record<string, 'error' | 'info' | 'warning' | 'neutral'> = {
  super_admin: 'error', branch_admin: 'info', branch_staff: 'warning', student: 'neutral',
}

export default function UserListPage() {
  const navigate = useNavigate()
  const { profile: me } = useAuth()
  const isSuperAdmin = me?.role === 'super_admin'

  const [users, setUsers] = useState<UserWithBranch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [toggleTarget, setToggleTarget] = useState<UserWithBranch | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => {
    const h = () => setMenuOpen(null)
    window.addEventListener('scroll', h, true)
    return () => window.removeEventListener('scroll', h, true)
  }, [])

  async function fetchUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_profiles')
        .select('*, branch:uce_branches(name)')
        .neq('role', 'student')
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers((data as unknown as UserWithBranch[]) ?? [])
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }

  const openMenu = useCallback((uid: string) => {
    const btn = menuBtnRefs.current.get(uid)
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(uid)
  }, [])

  const menuUser = useMemo(() => users.find(u => u.id === menuOpen), [users, menuOpen])

  async function handleToggle() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const ns = !toggleTarget.is_active
      const { error } = await supabase.from('uce_profiles').update({ is_active: ns, updated_at: new Date().toISOString() }).eq('id', toggleTarget.id)
      if (error) throw error
      toast.success(`User ${toggleTarget.full_name} ${ns ? 'activated' : 'deactivated'}`)
      setUsers(p => p.map(u => u.id === toggleTarget.id ? { ...u, is_active: ns } : u))
    } catch { toast.error('Failed to update user status') }
    finally { setToggling(false); setToggleTarget(null) }
  }

  const filteredData = useMemo(() => {
    let r = users
    if (roleFilter !== 'all') r = r.filter(u => u.role === roleFilter)
    if (statusFilter === 'active') r = r.filter(u => u.is_active)
    else if (statusFilter === 'inactive') r = r.filter(u => !u.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(u => u.full_name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    }
    return r
  }, [users, roleFilter, statusFilter, search])

  const columns = useMemo(() => [
    colHelper.accessor('full_name', {
      header: 'Name', cell: info => (
        <div className="flex items-center gap-2.5 min-w-[150px]">
          <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-red-600">{info.getValue().charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium text-gray-900">{info.getValue()}</span>
        </div>),
    }),
    colHelper.accessor('email', { header: 'Email', cell: info => <span className="text-sm text-gray-600">{info.getValue() || '—'}</span> }),
    colHelper.accessor('role', { header: 'Role', cell: info => <StatusBadge label={ROLE_LABELS[info.getValue()] || info.getValue()} variant={ROLE_VARIANTS[info.getValue()] || 'neutral'} /> }),
    colHelper.display({ id: 'branch', header: 'Branch', cell: info => <span className="text-sm text-gray-600">{(info.row.original.branch as { name: string } | null)?.name || 'All'}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: info => <StatusBadge label={info.getValue() ? 'Active' : 'Inactive'} variant={info.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({
      id: 'actions', header: '', enableSorting: false,
      cell: info => {
        const u = info.row.original
        if (u.role === 'super_admin') return null
        return (<button ref={el => { if (el) menuBtnRefs.current.set(u.id, el) }} onClick={e => { e.stopPropagation(); openMenu(u.id) }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>)
      },
    }),
  ], [openMenu])

  function UserCard({ user }: { user: UserWithBranch }) {
    const branch = user.branch as { name: string } | null
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', !user.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-red-600">{user.full_name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
              <StatusBadge label={ROLE_LABELS[user.role] || user.role} variant={ROLE_VARIANTS[user.role] || 'neutral'} className="mt-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge label={user.is_active ? 'Active' : 'Inactive'} variant={user.is_active ? 'success' : 'error'} />
            {user.role !== 'super_admin' && (
              <button ref={el => { if (el) menuBtnRefs.current.set(user.id, el) }} onClick={e => { e.stopPropagation(); openMenu(user.id) }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><MoreVertical size={16} /></button>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {user.email && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={12} className="shrink-0" /><span className="truncate">{user.email}</span></div>}
          {user.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} className="shrink-0" /><span>{user.phone}</span></div>}
          <div className="flex items-center gap-1.5 text-xs text-gray-500"><Building2 size={12} className="shrink-0" /><span>{branch?.name || 'All Branches'}</span></div>
        </div>
        {user.role !== 'super_admin' && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
            <button onClick={() => navigate(`/admin/users/${user.id}/permissions`)} className="text-xs text-red-600 font-medium flex items-center gap-0.5">Permissions <ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Manage Users</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{users.length} total users</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => navigate('/admin/users/new')} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm shrink-0">
            <Plus size={16} /> <span className="hidden sm:inline">Add New</span> User
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)}
              className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="all">All Roles</option><option value="super_admin">Super Admin</option><option value="branch_admin">Branch Admin</option><option value="branch_staff">Branch Staff</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl border p-4 space-y-3"><div className="flex gap-3"><div className="skeleton h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" /></div></div><div className="skeleton h-3 w-full" /></div>)}</div>
          : filteredData.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Users size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No users found</p></div>
          : <div className="space-y-3">{filteredData.map(u => <UserCard key={u.id} user={u} />)}</div>}
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filteredData} columns={columns} loading={loading} searchValue="" emptyIcon={<Users size={36} className="text-gray-300" />} emptyMessage="No users found" />
      </div>

      {menuOpen && menuUser && (<>
        <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setMenuOpen(null)} />
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 pb-6">
          <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">{menuUser.full_name}</p>
          <div className="space-y-1">
            <button onClick={() => { setMenuOpen(null); navigate(`/admin/users/${menuUser.id}/edit`) }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><Pencil size={16} /> Edit User</button>
            <button onClick={() => { setMenuOpen(null); navigate(`/admin/users/${menuUser.id}/permissions`) }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"><ShieldCheck size={16} /> Manage Permissions</button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setMenuOpen(null); setToggleTarget(menuUser) }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${menuUser.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
              <Power size={16} /> {menuUser.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
        <div className="hidden md:block fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, left: menuPos.left }}>
          <button onClick={() => { setMenuOpen(null); navigate(`/admin/users/${menuUser.id}/edit`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Pencil size={14} /> Edit User</button>
          <button onClick={() => { setMenuOpen(null); navigate(`/admin/users/${menuUser.id}/permissions`) }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><ShieldCheck size={14} /> Permissions</button>
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setMenuOpen(null); setToggleTarget(menuUser) }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${menuUser.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
            <Power size={14} /> {menuUser.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </>)}

      <ConfirmDialog open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Deactivate User?' : 'Activate User?'}
        message={toggleTarget?.is_active ? `"${toggleTarget?.full_name}" will lose CRM access.` : `"${toggleTarget?.full_name}" will regain access.`}
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'} variant={toggleTarget?.is_active ? 'danger' : 'info'} loading={toggling} />
    </div>
  )
}
