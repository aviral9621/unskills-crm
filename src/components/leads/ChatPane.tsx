import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, Bot, User, Send, Phone, Mail, MessageCircle, Trash2, ChevronDown,
  Flame, Thermometer, Snowflake, Calendar, UserCircle, GraduationCap,
  Pencil, Check, X, Clock, MessageSquare, Activity, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDateDDMMYYYY } from '../../lib/utils'
import type { Lead, LeadStatus, LeadTemperature } from '../../types/leads'
import { ALL_LEAD_STATUSES, LEAD_STATUS_CONFIG, TEMPERATURE_CONFIG } from '../../types/leads'
import {
  useLeadMessages, useLeadActivities,
  updateLeadStatus, markLeadRead, addStaffMessage, deleteLead,
  setLeadTemperature, setLeadFollowUp, assignLead, updateLeadNotes, logActivity,
} from '../../hooks/useLeads'
import ConfirmDialog from '../ConfirmDialog'
import ConvertToStudentDialog from './ConvertToStudentDialog'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function formatDay(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  const yest = new Date(); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return formatDateDDMMYYYY(d.toISOString().slice(0, 10))
}
function formatRelativeTime(ts: string) {
  const d = new Date(ts)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TempIcon({ t }: { t: LeadTemperature }) {
  if (t === 'hot')  return <Flame size={12} className="text-red-500" />
  if (t === 'warm') return <Thermometer size={12} className="text-amber-500" />
  return <Snowflake size={12} className="text-blue-500" />
}

function activityIcon(action: string) {
  if (action === 'status_changed') return '🔄'
  if (action === 'follow_up_set')  return '📅'
  if (action === 'assigned')       return '👤'
  if (action === 'converted')      return '🎓'
  if (action === 'temperature_changed') return '🌡️'
  if (action === 'note_added')     return '📝'
  return '📌'
}

// ── Sub-components ────────────────────────────────────────────────────────────

type TabKey = 'chat' | 'details' | 'timeline'

function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'chat',     label: 'Chat',     icon: MessageSquare },
    { key: 'details',  label: 'Details',  icon: Info },
    { key: 'timeline', label: 'Timeline', icon: Activity },
  ]
  return (
    <div className="flex border-b border-gray-200 bg-white shrink-0">
      {tabs.map(t => {
        const Icon = t.icon
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px',
              active === t.key
                ? 'text-red-600 border-red-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            )}>
            <Icon size={13} />{t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Details Tab ───────────────────────────────────────────────────────────────

interface UserOpt { id: string; full_name: string; role: string; branch_id: string | null }

function DetailsTab({ lead, performedByName }: { lead: Lead; performedByName: string }) {
  const [users, setUsers] = useState<UserOpt[]>([])
  const [assignedId, setAssignedId] = useState(lead.assigned_to ?? '')
  const [assigningTo, setAssigningTo] = useState(false)
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [editNotes, setEditNotes] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [followUpDate, setFollowUpDate] = useState(
    lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().slice(0, 10) : ''
  )
  const [followUpNote, setFollowUpNote] = useState(lead.follow_up_note ?? '')
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  useEffect(() => {
    supabase.from('uce_profiles')
      .select('id, full_name, role, branch_id')
      .in('role', ['super_admin', 'branch_admin', 'branch_staff'])
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setUsers((data ?? []) as UserOpt[]))
  }, [])

  async function handleTemperature(t: LeadTemperature | null) {
    try {
      await setLeadTemperature(lead.id, t)
      await logActivity(lead.id, 'temperature_changed',
        t ? `Temperature set to ${TEMPERATURE_CONFIG[t].label}` : 'Temperature cleared', performedByName)
      toast.success(t ? `Marked as ${TEMPERATURE_CONFIG[t].label}` : 'Temperature cleared')
    } catch { toast.error('Failed to update temperature') }
  }

  async function handleAssign() {
    setAssigningTo(true)
    try {
      const user = users.find(u => u.id === assignedId) ?? null
      await assignLead(lead.id, user?.id ?? null, user?.branch_id ?? null)
      await logActivity(lead.id, 'assigned',
        user ? `Assigned to ${user.full_name}` : 'Unassigned', performedByName)
      toast.success(user ? `Assigned to ${user.full_name}` : 'Unassigned')
    } catch { toast.error('Failed to assign') }
    finally { setAssigningTo(false) }
  }

  async function handleSaveFollowUp() {
    setSavingFollowUp(true)
    try {
      const isoDate = followUpDate ? new Date(followUpDate + 'T09:00:00').toISOString() : null
      await setLeadFollowUp(lead.id, isoDate, followUpNote.trim() || null)
      await logActivity(lead.id, 'follow_up_set',
        isoDate ? `Follow-up set for ${new Date(isoDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${followUpNote ? `: ${followUpNote}` : ''}` : 'Follow-up cleared',
        performedByName)
      toast.success(isoDate ? 'Follow-up saved' : 'Follow-up cleared')
    } catch { toast.error('Failed to save follow-up') }
    finally { setSavingFollowUp(false) }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      await updateLeadNotes(lead.id, notes.trim())
      await logActivity(lead.id, 'note_added', 'Notes updated', performedByName)
      setEditNotes(false)
      toast.success('Notes saved')
    } catch { toast.error('Failed to save notes') }
    finally { setSavingNotes(false) }
  }

  const canConvert = lead.status === 'admitted' || lead.status === 'admission_pending' || lead.status === 'interested' || lead.status === 'demo_scheduled'

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-gray-50">

      {/* Convert to Student */}
      {canConvert && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900">Ready to enroll?</p>
              <p className="text-xs text-green-700">Convert this lead into a registered student</p>
            </div>
          </div>
          <button onClick={() => setConvertOpen(true)}
            className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">
            Convert
          </button>
        </div>
      )}

      {/* Lead info */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lead Info</p>
        <div className="grid grid-cols-1 gap-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Phone size={13} className="text-gray-400 shrink-0" />
            <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a>
            <a href={`https://wa.me/${lead.phone.replace(/[^\d]/g,'')}`} target="_blank" rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-[10px] bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full font-semibold hover:bg-green-100 transition-colors">
              <MessageCircle size={10} />WhatsApp
            </a>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-gray-400 shrink-0" />
              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline truncate">{lead.email}</a>
            </div>
          )}
          {lead.course_interest && (
            <div className="flex items-center gap-2">
              <GraduationCap size={13} className="text-gray-400 shrink-0" />
              <span className="text-gray-700">{lead.course_interest}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-gray-400 shrink-0" />
            <span className="text-gray-500 text-xs">Added {formatRelativeTime(lead.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Temperature */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lead Temperature</p>
        <div className="flex gap-2">
          {(['hot', 'warm', 'cold'] as LeadTemperature[]).map(t => {
            const cfg = TEMPERATURE_CONFIG[t]
            const active = lead.temperature === t
            return (
              <button key={t} onClick={() => handleTemperature(active ? null : t)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                  active ? `${cfg.bg} ring-2 ring-offset-1 ${t === 'hot' ? 'ring-red-400' : t === 'warm' ? 'ring-amber-400' : 'ring-blue-400'}` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                )}>
                <TempIcon t={t} />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Follow-up */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <Calendar size={10} /> Follow-up Reminder
        </p>
        <input
          type="date"
          value={followUpDate}
          onChange={e => setFollowUpDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
        />
        <input
          type="text"
          value={followUpNote}
          onChange={e => setFollowUpNote(e.target.value)}
          placeholder="Follow-up note (optional)"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
        />
        <button onClick={handleSaveFollowUp} disabled={savingFollowUp}
          className="w-full py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
          <Calendar size={13} />
          {savingFollowUp ? 'Saving…' : 'Save Follow-up'}
        </button>
      </div>

      {/* Assign to */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <UserCircle size={10} /> Assign To
        </p>
        <select
          value={assignedId}
          onChange={e => setAssignedId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
        >
          <option value="">Unassigned</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.role.replace('_', ' ')})</option>
          ))}
        </select>
        <button onClick={handleAssign} disabled={assigningTo}
          className="w-full py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
          <UserCircle size={13} />
          {assigningTo ? 'Saving…' : 'Update Assignment'}
        </button>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</p>
          {!editNotes && (
            <button onClick={() => setEditNotes(true)} className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5">
              <Pencil size={10} /> Edit
            </button>
          )}
        </div>
        {editNotes ? (
          <>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveNotes} disabled={savingNotes}
                className="flex-1 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1">
                <Check size={12} />{savingNotes ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setNotes(lead.notes ?? ''); setEditNotes(false) }}
                className="flex-1 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1">
                <X size={12} />Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600 whitespace-pre-wrap min-h-[2rem]">{notes || <span className="text-gray-400 italic">No notes</span>}</p>
        )}
      </div>

      <ConvertToStudentDialog
        open={convertOpen}
        lead={lead}
        performedByName={performedByName}
        onClose={() => setConvertOpen(false)}
      />
    </div>
  )
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ leadId }: { leadId: string }) {
  const { activities, loading } = useLeadActivities(leadId)

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <Activity size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 font-medium">No activity yet</p>
          <p className="text-xs text-gray-400 mt-1">Status changes, follow-ups, and assignments will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-50">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
        <div className="space-y-3">
          {activities.map(act => (
            <div key={act.id} className="flex gap-3 relative">
              <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shrink-0 z-10 text-sm">
                {activityIcon(act.action)}
              </div>
              <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
                <p className="text-xs text-gray-800">{act.detail || act.action}</p>
                <div className="flex items-center gap-2 mt-1">
                  {act.performed_by_name && (
                    <span className="text-[10px] text-gray-400">{act.performed_by_name}</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">{formatRelativeTime(act.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ChatPane ─────────────────────────────────────────────────────────────

export default function ChatPane({ lead, onBack, onDeleted }: { lead: Lead; onBack?: () => void; onDeleted?: () => void }) {
  const { profile } = useAuth()
  const { messages, loading } = useLeadMessages(lead.id)
  const [activeTab, setActiveTab] = useState<TabKey>('chat')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusAnchor, setStatusAnchor] = useState<{ top: number; right: number } | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const statusBtnRef = useRef<HTMLButtonElement>(null)
  const performedByName = profile?.full_name || 'Staff'

  function openStatusMenu() {
    const r = statusBtnRef.current?.getBoundingClientRect()
    if (r) setStatusAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right })
    setStatusOpen(true)
  }
  useEffect(() => {
    if (!statusOpen) return
    const close = () => setStatusOpen(false)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [statusOpen])

  useEffect(() => { if (lead.unread_count > 0) markLeadRead(lead.id) }, [lead.id, lead.unread_count])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])

  const grouped = useMemo(() => {
    const byDay: { day: string; msgs: typeof messages }[] = []
    messages.forEach(m => {
      const day = formatDay(m.timestamp)
      const last = byDay[byDay.length - 1]
      if (!last || last.day !== day) byDay.push({ day, msgs: [m] })
      else last.msgs.push(m)
    })
    return byDay
  }, [messages])

  async function send() {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      await addStaffMessage(lead.id, text, performedByName)
      setDraft('')
    } catch { toast.error('Failed to send') }
    finally { setSending(false) }
  }

  async function changeStatus(s: LeadStatus) {
    const oldLabel = LEAD_STATUS_CONFIG[lead.status].label
    const newLabel = LEAD_STATUS_CONFIG[s].label
    try {
      await updateLeadStatus(lead.id, s)
      await logActivity(lead.id, 'status_changed', `${oldLabel} → ${newLabel}`, performedByName)
      setStatusOpen(false)
      toast.success(`Status: ${newLabel}`)
    } catch { toast.error('Failed to update status') }
  }

  async function onDelete() {
    setDeleting(true)
    try {
      await deleteLead(lead.id)
      toast.success('Lead deleted')
      setConfirmDel(false)
      onDeleted?.()
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false) }
  }

  const waHref = `https://wa.me/${lead.phone.replace(/[^\d]/g, '')}`
  const tempCfg = lead.temperature ? TEMPERATURE_CONFIG[lead.temperature] : null

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="relative z-30 bg-[#008069] text-white px-3 py-2 flex items-center gap-2 shadow-sm shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10 lg:hidden" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
          {lead.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm truncate">{lead.name}</p>
            {tempCfg && (
              <span className={cn('hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold', tempCfg.bg, tempCfg.color)}>
                <TempIcon t={lead.temperature!} />{tempCfg.label}
              </span>
            )}
          </div>
          <p className="text-[11px] opacity-80 truncate">{lead.phone}</p>
        </div>

        {/* Status picker */}
        <button ref={statusBtnRef} onClick={() => statusOpen ? setStatusOpen(false) : openStatusMenu()}
          className="flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0">
          {LEAD_STATUS_CONFIG[lead.status]?.label}
          <ChevronDown size={12} />
        </button>

        {/* Quick actions — always visible */}
        <a href={waHref} target="_blank" rel="noreferrer" title="WhatsApp"
          className="p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center">
          <MessageCircle size={16} />
        </a>
        <a href={`tel:${lead.phone}`} title="Call"
          className="p-1.5 rounded-full hover:bg-white/10 flex items-center justify-center">
          <Phone size={16} />
        </a>
        {lead.email && (
          <a href={`mailto:${lead.email}`} title="Email"
            className="p-1.5 rounded-full hover:bg-white/10 hidden md:flex items-center justify-center">
            <Mail size={16} />
          </a>
        )}
        <button onClick={() => setConfirmDel(true)} title="Delete"
          className="p-1.5 rounded-full hover:bg-white/10">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab: Chat */}
      {activeTab === 'chat' && (
        <>
          <div className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-1 bg-[#EFEAE2]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 30m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0' fill='%23000' fill-opacity='0.04'/%3E%3C/svg%3E\")" }}>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-3/5 rounded-xl" />)}</div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="bg-white/60 backdrop-blur rounded-xl p-6 text-center max-w-sm mx-auto">
                  <MessageCircle size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-700 font-medium">No messages yet</p>
                  <p className="text-xs text-gray-500 mt-1">Messages from WhatsApp (via BotBee) or staff notes will appear here in real time.</p>
                </div>
              </div>
            ) : (
              grouped.map(g => (
                <div key={g.day}>
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] bg-white/80 backdrop-blur px-2.5 py-0.5 rounded-full text-gray-600 shadow-sm font-medium">{g.day}</span>
                  </div>
                  {g.msgs.map(m => {
                    const isCustomer = m.direction === 'incoming'
                    return (
                      <div key={m.id} className={cn('flex gap-2 mb-1.5', isCustomer ? 'justify-end' : 'justify-start')}>
                        {!isCustomer && (
                          <div className="h-7 w-7 rounded-full bg-[#128C7E] text-white flex items-center justify-center shrink-0 self-end mb-1">
                            <Bot size={14} />
                          </div>
                        )}
                        <div className={cn(
                          'max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-1.5 shadow-sm',
                          isCustomer ? 'bg-[#D9FDD3] text-gray-900 rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
                        )}>
                          <p className="text-[10px] font-semibold mb-0.5 opacity-70">{isCustomer ? lead.name : (m.sender_name || 'AI Assistant')}</p>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.message_text}</p>
                          <p className="text-[10px] text-gray-500 text-right mt-0.5">{formatTime(m.timestamp)}</p>
                        </div>
                        {isCustomer && (
                          <div className="h-7 w-7 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center shrink-0 self-end mb-1">
                            <User size={14} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="relative z-10 bg-[#F0F2F5] border-t border-gray-200 px-2 sm:px-3 py-2 flex items-end gap-2 shrink-0">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Add a staff note (not sent to customer)…"
              rows={1}
              className="flex-1 resize-none rounded-3xl bg-white border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 max-h-32"
            />
            <button onClick={send} disabled={!draft.trim() || sending}
              className="h-10 w-10 rounded-full bg-[#008069] text-white flex items-center justify-center hover:bg-[#006B58] disabled:opacity-40 shrink-0">
              <Send size={16} />
            </button>
          </div>
        </>
      )}

      {/* Tab: Details */}
      {activeTab === 'details' && (
        <DetailsTab lead={lead} performedByName={performedByName} />
      )}

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <TimelineTab leadId={lead.id} />
      )}

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={onDelete}
        title="Delete Lead?"
        message={`Permanently remove "${lead.name}" and all their messages? This cannot be undone.`}
        confirmText="Delete" variant="danger" loading={deleting} />

      {/* Status dropdown portal */}
      {statusOpen && statusAnchor && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setStatusOpen(false)} />
          <div role="menu"
            className="fixed w-52 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-[9999] max-h-[60vh] overflow-y-auto"
            style={{ top: statusAnchor.top, right: statusAnchor.right }}>
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Change status</p>
            {ALL_LEAD_STATUSES.map(s => (
              <button key={s} onClick={() => changeStatus(s)}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-50',
                  lead.status === s && 'bg-red-50 font-semibold text-red-700')}>
                <span className={cn('w-2 h-2 rounded-full shrink-0', LEAD_STATUS_CONFIG[s].dot)} />
                {LEAD_STATUS_CONFIG[s].label}
                {lead.status === s && <span className="ml-auto text-[10px] text-red-600">●</span>}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
