import { useEffect, useState } from 'react'
import { Bell, Briefcase, Megaphone, CheckCheck, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Notification {
  id: string
  channel: string
  template: string
  payload: Record<string, unknown> | null
  status: string
  created_at: string
  branch_id: string | null
  recipient_role: string | null
}

const TEMPLATE_META: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  job_alert:    { icon: Briefcase, color: 'text-red-600 bg-red-50',   label: 'Job Alert' },
  announcement: { icon: Megaphone, color: 'text-blue-600 bg-blue-50', label: 'Announcement' },
  default:      { icon: Bell,      color: 'text-gray-600 bg-gray-100', label: 'Notice' },
}

export default function AdminNotificationsPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [rows, setRows] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmAll, setConfirmAll] = useState(false)
  const [confirmSel, setConfirmSel] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('uce_notifications_log')
      .select('id, channel, template, payload, status, created_at, branch_id, recipient_role')
      .eq('channel', 'inapp')
      .in('recipient_role', ['super_admin', 'branch_admin', 'branch_staff'])
      .order('created_at', { ascending: false })
      .limit(200)
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setRows((data ?? []) as Notification[])
    setLoading(false)
    setSelected(new Set())
  }

  useEffect(() => { if (profile) load() /* eslint-disable-next-line */ }, [profile?.id])

  async function markAllRead() {
    let q = supabase.from('uce_notifications_log').update({ status: 'read' })
      .eq('channel', 'inapp').in('recipient_role', ['super_admin', 'branch_admin', 'branch_staff']).neq('status', 'read')
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    await q
    load()
  }

  async function deleteSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const { error } = await supabase.from('uce_notifications_log').delete().in('id', ids)
    if (error) { toast.error('Delete failed'); return }
    toast.success(`Deleted ${ids.length} notification${ids.length > 1 ? 's' : ''}`)
    setConfirmSel(false)
    load()
  }

  async function deleteAll() {
    let q = supabase.from('uce_notifications_log').delete()
      .eq('channel', 'inapp').in('recipient_role', ['super_admin', 'branch_admin', 'branch_staff'])
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    const { error } = await q
    if (error) { toast.error('Delete failed'); return }
    toast.success('All notifications cleared')
    setConfirmAll(false)
    load()
  }

  function toggle(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.id)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Notifications</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{isSuperAdmin ? 'All branches' : 'Your branch'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <button onClick={() => setConfirmSel(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100">
              <Trash2 size={14} /> Delete Selected ({selected.size})
            </button>
          )}
          {rows.some(r => r.status !== 'read') && (
            <button onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          {rows.length > 0 && (
            <button onClick={() => setConfirmAll(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700">
              <Trash2 size={14} /> Delete All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          <Bell size={28} className="mx-auto mb-2 text-gray-300" /> No notifications.
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-600 px-1">
            <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            Select all
          </label>
          <div className="space-y-2">
            {rows.map(n => {
              const meta = TEMPLATE_META[n.template] || TEMPLATE_META.default
              const Icon = meta.icon
              const isUnread = n.status !== 'read'
              const checked = selected.has(n.id)
              const payload = n.payload || {}
              const title = (payload as { title?: string }).title
              const message = (payload as { message?: string }).message
              return (
                <div key={n.id}
                  className={`rounded-xl border bg-white p-3 flex items-start gap-3 ${isUnread ? 'border-l-4 border-l-red-500' : ''} ${checked ? 'ring-2 ring-red-200' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(n.id)}
                    className="h-4 w-4 mt-1 rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0" />
                  <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-400">{meta.label}</span>
                      {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                    </div>
                    <p className="font-semibold text-gray-900 truncate mt-0.5">{title || message || meta.label}</p>
                    {message && title && <p className="text-sm text-gray-600 line-clamp-2">{message}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{formatDateDDMMYYYY(n.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <ConfirmDialog open={confirmSel} onClose={() => setConfirmSel(false)} onConfirm={deleteSelected}
        title="Delete selected?" message={`Delete ${selected.size} notification${selected.size > 1 ? 's' : ''}? This cannot be undone.`} />
      <ConfirmDialog open={confirmAll} onClose={() => setConfirmAll(false)} onConfirm={deleteAll}
        title="Delete all notifications?" message="This will permanently delete every notification visible here. Cannot be undone." />
    </div>
  )
}
