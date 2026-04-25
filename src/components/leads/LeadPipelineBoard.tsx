import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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

/* ── Card inner content (shared between draggable + overlay) ── */
function CardContent({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const isFollowUpOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date(new Date().setHours(0,0,0,0))
  const isFollowUpToday = lead.follow_up_date && !isFollowUpOverdue && (() => {
    const d = new Date(lead.follow_up_date!)
    return d.toDateString() === new Date().toDateString()
  })()

  return (
    <div className={cn(
      'bg-white rounded-lg border p-3 shadow-sm transition-all select-none',
      isDragging
        ? 'border-red-300 shadow-xl ring-2 ring-red-500/20 rotate-1 opacity-95'
        : 'border-gray-200 hover:shadow-md hover:border-gray-300'
    )}>
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
        {lead.source === 'whatsapp' && <MessageCircle size={10} className="text-green-500 shrink-0" />}
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

      {/* Assigned */}
      {lead.assigned_to && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
          <UserCircle size={10} />
          <span>Assigned</span>
        </div>
      )}
    </div>
  )
}

/* ── Draggable card ── */
function DraggableCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <CardContent lead={lead} />
    </div>
  )
}

/* ── Droppable column ── */
function DroppableColumn({
  status,
  label,
  dot,
  color,
  leads,
  onSelectLead,
  isOver,
}: {
  status: string
  label: string
  dot: string
  color: string
  leads: Lead[]
  onSelectLead: (id: string) => void
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div className={cn(
      'shrink-0 w-[230px] sm:w-[240px] flex flex-col rounded-xl border overflow-hidden transition-colors duration-150',
      isOver ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'px-3 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 transition-colors',
        isOver ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
          <span className="text-xs font-semibold text-gray-700 truncate">{label}</span>
        </div>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', color)}>
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className={cn(
        'flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors',
        isOver && leads.length === 0 ? 'bg-red-50/50' : ''
      )}>
        {leads.length === 0 ? (
          <div className={cn(
            'flex items-center justify-center h-16 text-[11px] rounded-lg border-2 border-dashed transition-colors',
            isOver ? 'border-red-300 text-red-400 bg-red-50/40' : 'border-gray-200 text-gray-400'
          )}>
            {isOver ? 'Drop here' : 'No leads'}
          </div>
        ) : (
          leads.map(lead => (
            <DraggableCard
              key={lead.id}
              lead={lead}
              onClick={() => onSelectLead(lead.id)}
            />
          ))
        )}
        {/* Drop zone at bottom when column has cards */}
        {leads.length > 0 && isOver && (
          <div className="h-2 rounded-lg bg-red-200/50 border-2 border-dashed border-red-300" />
        )}
      </div>
    </div>
  )
}

/* ── Main board ── */
interface Props {
  leads: Lead[]
  onSelect: (id: string) => void
  performedByName: string
}

const CLOSED: LeadStatus[] = ['not_interested', 'dropped', 'b2b_partner']

export default function LeadPipelineBoard({ leads, onSelect, performedByName }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  )

  const activeLead = useMemo(() => leads.find(l => l.id === activeId) ?? null, [leads, activeId])

  const columns = useMemo(() => {
    const pipeline = PIPELINE_STATUSES.map(status => ({
      status,
      label: LEAD_STATUS_CONFIG[status].label,
      dot: LEAD_STATUS_CONFIG[status].dot,
      color: LEAD_STATUS_CONFIG[status].color,
      leads: leads.filter(l => l.status === status),
    }))
    const closed = {
      status: 'closed',
      label: 'Closed',
      dot: 'bg-gray-400',
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      leads: leads.filter(l => CLOSED.includes(l.status)),
    }
    return [...pipeline, closed]
  }, [leads])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over || active.id === over.id) return

    const leadId = active.id as string
    const targetColumnId = over.id as string

    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    // Map "closed" column to a real status (default: not_interested)
    let newStatus: LeadStatus
    if (targetColumnId === 'closed') {
      newStatus = 'not_interested'
    } else if (ALL_LEAD_STATUSES.includes(targetColumnId as LeadStatus)) {
      newStatus = targetColumnId as LeadStatus
    } else {
      return
    }

    if (lead.status === newStatus) return

    const oldLabel = LEAD_STATUS_CONFIG[lead.status].label
    const newLabel = LEAD_STATUS_CONFIG[newStatus].label

    try {
      await updateLeadStatus(leadId, newStatus)
      await logActivity(leadId, 'status_changed', `${oldLabel} → ${newLabel}`, performedByName)
      toast.success(`Moved to ${newLabel}`)
    } catch {
      toast.error('Failed to move lead')
    }
  }

  function handleDragOver(event: { over: { id: string } | null }) {
    setOverId(event.over?.id ?? null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver as never}
    >
      <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1 h-full" style={{ minHeight: 0 }}>
        {columns.map(col => (
          <DroppableColumn
            key={col.status}
            status={col.status}
            label={col.label}
            dot={col.dot}
            color={col.color}
            leads={col.leads}
            onSelectLead={onSelect}
            isOver={overId === col.status}
          />
        ))}
      </div>

      {/* Drag overlay — floats under cursor/finger */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeLead ? <CardContent lead={activeLead} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
