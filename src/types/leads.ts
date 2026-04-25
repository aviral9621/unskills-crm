export type LeadStatus =
  | 'new' | 'contacted' | 'interested' | 'not_interested'
  | 'follow_up' | 'demo_scheduled' | 'admission_pending'
  | 'admitted' | 'dropped' | 'b2b_partner'

export type LeadTemperature = 'hot' | 'warm' | 'cold'

export interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  status: LeadStatus
  source: string | null
  assigned_to: string | null
  branch_id: string | null
  course_interest: string | null
  notes: string | null
  temperature: LeadTemperature | null
  follow_up_date: string | null
  follow_up_note: string | null
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LeadMessage {
  id: string
  lead_id: string
  direction: 'incoming' | 'outgoing'
  message_text: string
  sender_name: string | null
  timestamp: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface LeadRemark {
  id: string
  lead_id: string
  user_id: string
  remark: string
  created_at: string
}

export interface LeadActivity {
  id: string
  lead_id: string
  action: string
  detail: string | null
  performed_by_name: string | null
  created_at: string
}

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; dot: string; pipeline: number }> = {
  new:               { label: 'New',               color: 'bg-blue-50 text-blue-700 border-blue-200',           dot: 'bg-blue-500',    pipeline: 0 },
  contacted:         { label: 'Contacted',          color: 'bg-slate-50 text-slate-700 border-slate-200',        dot: 'bg-slate-500',   pipeline: 1 },
  interested:        { label: 'Interested',          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500', pipeline: 2 },
  follow_up:         { label: 'Follow Up',           color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-500',   pipeline: 3 },
  demo_scheduled:    { label: 'Demo Scheduled',      color: 'bg-violet-50 text-violet-700 border-violet-200',     dot: 'bg-violet-500',  pipeline: 4 },
  admission_pending: { label: 'Admission Pending',   color: 'bg-cyan-50 text-cyan-700 border-cyan-200',           dot: 'bg-cyan-500',    pipeline: 5 },
  admitted:          { label: 'Admitted',            color: 'bg-green-100 text-green-800 border-green-300',       dot: 'bg-green-600',   pipeline: 6 },
  not_interested:    { label: 'Not Interested',      color: 'bg-rose-50 text-rose-700 border-rose-200',           dot: 'bg-rose-500',    pipeline: 7 },
  dropped:           { label: 'Dropped',             color: 'bg-gray-100 text-gray-700 border-gray-300',          dot: 'bg-gray-500',    pipeline: 7 },
  b2b_partner:       { label: 'B2B Partner',         color: 'bg-indigo-50 text-indigo-700 border-indigo-200',     dot: 'bg-indigo-500',  pipeline: 8 },
}

export const TEMPERATURE_CONFIG: Record<LeadTemperature, { label: string; emoji: string; color: string; bg: string }> = {
  hot:  { label: 'Hot',  emoji: '🔥', color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  warm: { label: 'Warm', emoji: '🌡️', color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  cold: { label: 'Cold', emoji: '❄️', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
}

// Pipeline display order (excludes dropped/not_interested — shown in separate "Closed" column)
export const PIPELINE_STATUSES: LeadStatus[] = [
  'new', 'contacted', 'interested', 'follow_up',
  'demo_scheduled', 'admission_pending', 'admitted',
]

export const ALL_LEAD_STATUSES: LeadStatus[] = [
  'new', 'contacted', 'interested', 'follow_up', 'demo_scheduled',
  'admission_pending', 'admitted', 'not_interested', 'dropped', 'b2b_partner',
]
