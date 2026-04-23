import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, CheckCheck, UserPlus, Wallet, Video, MessageCircle,
  MessageSquare, LifeBuoy, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
  fetchActivityFeed, formatRelativeTime, getLastReadAt, setLastReadAt,
  type Activity, type ActivityType, type ActivitySeverity,
} from '../lib/activity-feed'

const TYPE_ICONS: Record<ActivityType, typeof UserPlus> = {
  student_added: UserPlus,
  low_wallet: Wallet,
  upcoming_class: Video,
  new_lead: MessageCircle,
  new_inquiry: MessageSquare,
  wallet_request: RefreshCw,
  new_ticket: LifeBuoy,
}

const SEVERITY_STYLES: Record<ActivitySeverity, { icon: string; dot: string }> = {
  info: { icon: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' },
  success: { icon: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
  warning: { icon: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  danger: { icon: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
}

type Tab = 'all' | ActivityType

export default function NotificationCenter({
  open, onClose, anchor, onUnreadChange,
}: {
  open: boolean
  onClose: () => void
  anchor: { top: number; right: number } | null
  onUnreadChange?: (count: number) => void
}) {
  const navigate = useNavigate()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [lastReadTs, setLastReadTs] = useState<number>(() => getLastReadAt())
  const [tab, setTab] = useState<Tab>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await fetchActivityFeed()) }
    finally { setLoading(false) }
  }, [])

  // Initial load + refresh when opened
  useEffect(() => { if (open) load() }, [open, load])

  // Background refresh every 60s regardless of open state, so the bell count
  // stays fresh for the super admin.
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const unread = useMemo(
    () => items.filter(a => new Date(a.timestamp).getTime() > lastReadTs).length,
    [items, lastReadTs],
  )

  useEffect(() => { onUnreadChange?.(unread) }, [unread, onUnreadChange])

  const filtered = useMemo(() => tab === 'all' ? items : items.filter(a => a.type === tab), [items, tab])

  function markAllRead() {
    const now = Date.now()
    setLastReadAt(now)
    setLastReadTs(now)
  }

  function handleClick(a: Activity) {
    if (a.link) navigate(a.link)
    markAllRead()
    onClose()
  }

  if (!open || !anchor) return null

  const tabDefs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'student_added', label: 'Students' },
    { key: 'low_wallet', label: 'Wallets' },
    { key: 'upcoming_class', label: 'Classes' },
    { key: 'new_lead', label: 'Leads' },
    { key: 'new_inquiry', label: 'Inquiries' },
    { key: 'wallet_request', label: 'Requests' },
    { key: 'new_ticket', label: 'Tickets' },
  ]

  return createPortal(
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Popover — responsive: anchored on desktop, bottom sheet on mobile */}
      <div
        className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 w-[calc(100vw-24px)] sm:w-[380px] md:w-[420px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: anchor.top,
          right: Math.max(12, anchor.right),
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-br from-red-600 to-red-700 text-white">
          <Bell size={16} />
          <p className="text-sm font-bold flex-1">Notifications</p>
          {unread > 0 && (
            <span className="bg-white/20 text-white text-[10px] font-bold rounded-full px-2 py-0.5">
              {unread} new
            </span>
          )}
          <button
            onClick={load}
            title="Refresh"
            className="p-1 rounded-full hover:bg-white/15 transition-colors"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/15 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 overflow-x-auto scrollbar-none">
          {tabDefs.map(t => {
            const count = t.key === 'all' ? items.length : items.filter(i => i.type === t.key).length
            if (t.key !== 'all' && count === 0) return null
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-colors',
                  tab === t.key ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {t.label} {count > 0 && <span className={cn('opacity-70', tab === t.key && 'opacity-90')}>({count})</span>}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Bell size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-500 font-medium">You're all caught up</p>
              <p className="text-[11px] text-gray-400 mt-1">New activity will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(a => {
                const Icon = TYPE_ICONS[a.type] || Bell
                const styles = SEVERITY_STYLES[a.severity]
                const isUnread = new Date(a.timestamp).getTime() > lastReadTs
                return (
                  <button
                    key={a.id}
                    onClick={() => handleClick(a)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors relative',
                      isUnread && 'bg-red-50/40'
                    )}
                  >
                    {isUnread && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-red-500" />
                    )}
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', styles.icon)}>
                      {a.severity === 'danger' ? <AlertTriangle size={15} /> : <Icon size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{a.title}</p>
                        <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{formatRelativeTime(a.timestamp)}</span>
                      </div>
                      <p className="text-[12px] text-gray-600 line-clamp-2 mt-0.5">{a.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between bg-gray-50">
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:text-gray-400 flex items-center gap-1"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
            <span className="text-[10px] text-gray-400">{items.length} items · last 7 days</span>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

/**
 * Lightweight hook to compute only the unread count without opening the dropdown.
 * Used by TopBar to render the red dot.
 */
export function useUnreadCount(): number {
  const [count, setCount] = useState(0)
  const [lastRead, setLastRead] = useState<number>(() => getLastReadAt())

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const items = await fetchActivityFeed()
        if (!cancelled) setCount(items.filter(a => new Date(a.timestamp).getTime() > lastRead).length)
      } catch { /* ignore */ }
    }
    poll()
    const t = setInterval(poll, 60_000)
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('uce_notif_last_read')) setLastRead(getLastReadAt())
    }
    window.addEventListener('storage', onStorage)
    return () => { cancelled = true; clearInterval(t); window.removeEventListener('storage', onStorage) }
  }, [lastRead])

  return count
}
