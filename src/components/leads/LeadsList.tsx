import { MessageCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Lead } from '../../types/leads'
import { LEAD_STATUS_CONFIG } from '../../types/leads'

function formatRelative(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function LeadsList({
  leads, loading, selectedId, onSelect, emptyHint,
}: {
  leads: Lead[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  emptyHint?: string
}) {
  if (loading) {
    return (
      <div className="space-y-1 p-2">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageCircle size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500 font-medium">No leads</p>
        <p className="text-xs text-gray-400 mt-1">{emptyHint ?? 'Add manually or wait for a WhatsApp message.'}</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {leads.map(l => {
        const cfg = LEAD_STATUS_CONFIG[l.status]
        const active = l.id === selectedId
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={cn(
              'w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-gray-50 transition-colors',
              active && 'bg-red-50 hover:bg-red-50'
            )}
          >
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-white font-bold text-sm flex items-center justify-center shrink-0 relative">
              {l.name.slice(0, 1).toUpperCase()}
              {l.source === 'whatsapp' && (
                <span className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 border-2 border-white">
                  <MessageCircle size={8} className="text-white" strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-sm truncate', active ? 'font-semibold text-red-700' : 'font-semibold text-gray-900')}>{l.name}</p>
                <span className="text-[10px] text-gray-400 shrink-0">{formatRelative(l.last_message_at || l.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg?.dot)} />
                <p className="text-[11px] text-gray-500 truncate">
                  {l.last_message_preview || (l.source === 'whatsapp' ? l.phone : cfg?.label)}
                </p>
              </div>
            </div>
            {l.unread_count > 0 && (
              <span className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0 self-center">
                {l.unread_count > 99 ? '99+' : l.unread_count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
