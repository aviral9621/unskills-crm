import { LEAD_STATUS_CONFIG, type LeadStatus } from '../../types/leads'
import { cn } from '../../lib/utils'

export default function LeadStatusBadge({ status, size = 'sm' }: { status: LeadStatus; size?: 'xs' | 'sm' }) {
  const cfg = LEAD_STATUS_CONFIG[status]
  if (!cfg) return null
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
      cfg.color,
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
    )}>
      <span className={cn('rounded-full', cfg.dot, size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {cfg.label}
    </span>
  )
}
