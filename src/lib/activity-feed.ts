import { supabase } from './supabase'

/**
 * Unified activity feed for the super-admin notification center.
 * Pulls recent events from multiple source tables and normalizes them.
 * No dedicated notifications table required — it's computed on-demand.
 */

export type ActivityType =
  | 'student_added'      // new student registration
  | 'low_wallet'         // branch wallet balance below threshold
  | 'upcoming_class'     // live class starting soon
  | 'new_lead'           // new WhatsApp / manual lead
  | 'new_inquiry'        // new inquiry from website
  | 'wallet_request'     // pending wallet recharge request
  | 'new_ticket'         // new support ticket

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'danger'

export interface Activity {
  id: string
  type: ActivityType
  severity: ActivitySeverity
  title: string
  description: string
  timestamp: string           // ISO
  link?: string               // admin path
  meta?: Record<string, unknown>
}

const LOW_WALLET_THRESHOLD = 500
const LOOKBACK_DAYS = 7

export async function fetchActivityFeed(): Promise<Activity[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString()
  const nowDate = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [stuRes, brRes, clsRes, leadRes, inqRes, walRes, tktRes] = await Promise.all([
    supabase.from('uce_students')
      .select('id, name, registration_no, created_at, branch:uce_branches(name)')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(15),
    supabase.from('uce_branches')
      .select('id, name, code, wallet_balance, is_active')
      .eq('is_active', true).lt('wallet_balance', LOW_WALLET_THRESHOLD).order('wallet_balance', { ascending: true }).limit(10),
    supabase.from('uce_online_classes')
      .select('id, class_name, schedule_date, schedule_time, platform, course:uce_courses(name), is_recording, is_active')
      .eq('is_active', true).eq('is_recording', false)
      .gte('schedule_date', nowDate).lte('schedule_date', tomorrow).order('schedule_date').limit(10),
    supabase.from('uce_leads')
      .select('id, name, phone, source, created_at, last_message_at, unread_count')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
    supabase.from('uce_inquiries')
      .select('id, name, type, phone, created_at, status')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
    supabase.from('uce_branch_wallet_requests')
      .select('id, amount, created_at, status, branch:uce_branches(name)')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    supabase.from('uce_support_tickets')
      .select('id, subject, created_at, status, branch:uce_branches(name)')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(10),
  ])

  const out: Activity[] = []

  ;(stuRes.data ?? []).forEach((s: Record<string, unknown>) => {
    out.push({
      id: `student_${s.id}`,
      type: 'student_added',
      severity: 'success',
      title: `New student: ${s.name}`,
      description: `${(s.registration_no as string) || 'Unassigned'} · ${(s.branch as { name: string } | null)?.name || 'Unknown branch'}`,
      timestamp: s.created_at as string,
      link: '/admin/students',
      meta: { student_id: s.id, reg_no: s.registration_no },
    })
  })

  ;(brRes.data ?? []).forEach((b: Record<string, unknown>) => {
    const bal = Number(b.wallet_balance || 0)
    out.push({
      id: `wallet_${b.id}`,
      type: 'low_wallet',
      severity: bal <= 0 ? 'danger' : 'warning',
      title: `Low wallet: ${b.name}`,
      description: `Balance is ₹${bal.toLocaleString('en-IN')} — registrations will be blocked at ₹0`,
      // Low-wallet events should sort after hot events; use balance-derived
      // pseudo timestamp so they don't steal the top spot on quiet days.
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      link: `/admin/branches/${b.id}/wallet`,
      meta: { branch_id: b.id, balance: bal },
    })
  })

  ;(clsRes.data ?? []).forEach((c: Record<string, unknown>) => {
    const date = c.schedule_date as string
    const time = (c.schedule_time as string | null) || ''
    const courseName = (c.course as { name: string } | null)?.name || ''
    out.push({
      id: `class_${c.id}`,
      type: 'upcoming_class',
      severity: date === nowDate ? 'info' : 'info',
      title: `Upcoming class: ${c.class_name}`,
      description: `${courseName} · ${date === nowDate ? 'Today' : 'Tomorrow'}${time ? ' at ' + time.slice(0, 5) : ''}`,
      timestamp: `${date}T${time || '00:00:00'}`,
      link: '/admin/online-classes',
      meta: { class_id: c.id },
    })
  })

  ;(leadRes.data ?? []).forEach((l: Record<string, unknown>) => {
    const isWa = l.source === 'whatsapp' || l.source === 'botbee'
    out.push({
      id: `lead_${l.id}`,
      type: 'new_lead',
      severity: isWa ? 'info' : 'info',
      title: `${isWa ? 'WhatsApp lead' : 'New lead'}: ${l.name}`,
      description: `${l.phone}${(l.unread_count as number) > 0 ? ` · ${l.unread_count} unread` : ''}`,
      timestamp: (l.last_message_at as string) || (l.created_at as string),
      link: '/admin/leads',
      meta: { lead_id: l.id },
    })
  })

  ;(inqRes.data ?? []).forEach((i: Record<string, unknown>) => {
    out.push({
      id: `inq_${i.id}`,
      type: 'new_inquiry',
      severity: 'info',
      title: `New inquiry: ${i.name}`,
      description: `${i.type} · ${i.phone} · ${i.status}`,
      timestamp: i.created_at as string,
      link: '/admin/inquiries',
      meta: { inquiry_id: i.id },
    })
  })

  ;(walRes.data ?? []).forEach((w: Record<string, unknown>) => {
    out.push({
      id: `walreq_${w.id}`,
      type: 'wallet_request',
      severity: 'warning',
      title: `Wallet recharge request: ₹${Number(w.amount || 0).toLocaleString('en-IN')}`,
      description: `${(w.branch as { name: string } | null)?.name || 'Branch'} · awaiting approval`,
      timestamp: w.created_at as string,
      link: '/admin/branches/wallet-requests',
      meta: { request_id: w.id },
    })
  })

  ;(tktRes.data ?? []).forEach((t: Record<string, unknown>) => {
    out.push({
      id: `tkt_${t.id}`,
      type: 'new_ticket',
      severity: (t.status === 'open' ? 'warning' : 'info'),
      title: `Support ticket: ${t.subject}`,
      description: `${(t.branch as { name: string } | null)?.name || ''} · ${t.status}`,
      timestamp: t.created_at as string,
      link: `/admin/support/tickets/${t.id}`,
      meta: { ticket_id: t.id },
    })
  })

  // Sort newest first, cap to 50
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50)
}

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const diff = Math.max(0, Date.now() - d)
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const STORAGE_KEY = 'uce_notif_last_read_v1'
export function getLastReadAt(): number {
  try { return Number(localStorage.getItem(STORAGE_KEY) || '0') } catch { return 0 }
}
export function setLastReadAt(ts: number): void {
  try { localStorage.setItem(STORAGE_KEY, String(ts)) } catch { /* ignore */ }
}
