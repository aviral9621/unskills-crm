import { useMemo } from 'react'
import { GraduationCap, Phone, MessageCircle, Calendar, Flame, Thermometer, Snowflake, UserCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Lead, LeadStatus } from '../../types/leads'
import { LEAD_STATUS_CONFIG, TEMPERATURE_CONFIG, PIPELINE_STATUSES, ALL_LEAD_STATUSES } from '../../types/leads'
import { updateLeadStatus, logActivity } from '../../hooks/useLeads'
import { toast } from 'sonner'

function formatFollowUpDate(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function TempIcon({ t }: { t: string }) {
  if (t === 'hot')  return <Flame size={11} className="text-red-500" />
  if (t === 'warm') return <Thermometer size={11} className="text-amber-500" />
  if (t === 'cold') return <Snowflake size={11} className="text-blue-500" />
  return null
}

function PipelineCard({ lead, onClick, performedByName }: { lead: Lead; onClick: () => void; performedByName: string }) {
  const isFollowUpOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date(new Date().setHours(0,0,0,0))
  const isFollowUpToday = lead.follow_up_date && !isFollowUpOverdue && (() => {
    const now = new Date()
    const d = new Date(lead.follow_up_date!)
    return d.toDateString() === now.toDateString()
  })()

  async function handleStatusChange(e: React.MouseEvent, newStatus: LeadStatus) {
    e.stopPropagation()
    const oldLabel = LEAD_STATUS_CONFIG[lead.status].label
    const newLabel = LEAD_STATUS_CONFIG[newStatus].label
    try {
      await updateLeadStatus(lead.id, newStatus)
      await logActivity(lead.id, 'status_changed', `${oldLabel} → ${newLabel}`, performedByName)
      toast.success(`Moved to ${newLabel}`)
    } catch { toast.error('Failed to move lead') }
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-gray-300 cursor-pointer transition-all group"
    >
      {/* Name + temp */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{lead.name}</p>
        {lead.temperature && (
          <span className={cn('shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border', TEMPERATURE_CONFIG[lead.temperature].bg)}>
            <TempIcon t={lead.temperature} />
            {TEMPERATURE_CONFIG[lead.temperature].label}
          </span>
        )}
      </div>

      {/* Phone */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
        <Phone size={10} className="shrink-0" />
        <span className="truncate">{lead.phone}</span>
        {lead.source === 'whatsapp' && (
          <MessageCircle size={10} className="text-green-500 shrink-0" />
        )}
      </div>

      {/* Course interest */}
      {lead.course_interest && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
          <GraduationCap size={10} className="shrink-0" />
          <span className="truncate">{lead.course_interest}</span>
        </div>
      )}

      {/* Follow-up date */}
      {lead.follow_up_date && (
        <div className={cn(
          'flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit',
          isFollowUpOverdue ? 'bg-red-50 text-red-600 border border-red-200' :
          isFollowUpToday   ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          'bg-gray-50 text-gray-600 border border-gray-200'
        )}>
          <Calendar size={9} />
          {formatFollowUpDate(lead.follow_up_date)}
        </div>
      )}

      {/* Assigned to initial */}
      {lead.assigned_to && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
          <UserCircle size={10} />
          <span>Assigned</span>
        </div>
      )}

      {/* Quick move buttons — show on hover */}
      <div className="hidden group-hover:flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 flex-wrap">
        {ALL_LEAD_STATUSES.filter(s => s !== lead.status).slice(0, 3).map(s => (
          <button
            key={s}
            onClick={e => handleStatusChange(e, s)}
            className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-semibold transition-colors', LEAD_STATUS_CONFIG[s].color)}
          >
            → {LEAD_STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface Props {
  leads: Lead[]
  onSelect: (id: string) => void
  performedByName: string
}

export default function LeadPipelineBoard({ leads, onSelect, performedByName }: Props) {
  // Group leads into pipeline columns + a "Closed" column
  const CLOSED: LeadStatus[] = ['not_interested', 'dropped', 'b2b_partner']

  const columns = useMemo(() => {
    const pipeline = PIPELINE_STATUSES.map(status => ({
      status,
      label: LEAD_STATUS_CONFIG[status].label,
      dot: LEAD_STATUS_CONFIG[status].dot,
      color: LEAD_STATUS_CONFIG[status].color,
      leads: leads.filter(l => l.status === status),
    }))
    const closed = {
      status: 'closed' as const,
      label: 'Closed',
      dot: 'bg-gray-400',
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      leads: leads.filter(l => CLOSED.includes(l.status)),
    }
    return [...pipeline, closed]
  }, [leads])

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1 h-full" style={{ minHeight: 0 }}>
      {columns.map(col => (
        <div key={col.status} className="shrink-0 w-[230px] sm:w-[240px] flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          {/* Column header */}
          <div className="px-3 py-2.5 border-b border-gray-200 bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('w-2 h-2 rounded-full shrink-0', col.dot)} />
              <span className="text-xs font-semibold text-gray-700 truncate">{col.label}</span>
            </div>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', col.color)}>
              {col.leads.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {col.leads.length === 0 ? (
              <div className="flex items-center justify-center h-16 text-[11px] text-gray-400">No leads</div>
            ) : (
              col.leads.map(lead => (
                <PipelineCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => onSelect(lead.id)}
                  performedByName={performedByName}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
