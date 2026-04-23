import { useEffect, useRef, useState, useMemo } from 'react'
import { ArrowLeft, Bot, User, Send, Phone, Mail, MessageCircle, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDateDDMMYYYY } from '../../lib/utils'
import type { Lead, LeadStatus } from '../../types/leads'
import { ALL_LEAD_STATUSES, LEAD_STATUS_CONFIG } from '../../types/leads'
import { useLeadMessages, updateLeadStatus, markLeadRead, addStaffMessage, deleteLead } from '../../hooks/useLeads'
import ConfirmDialog from '../ConfirmDialog'
import { useAuth } from '../../contexts/AuthContext'

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function formatDay(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yest = new Date(); yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return formatDateDDMMYYYY(d.toISOString().slice(0, 10))
}

export default function ChatPane({ lead, onBack, onDeleted }: { lead: Lead; onBack?: () => void; onDeleted?: () => void }) {
  const { profile } = useAuth()
  const { messages, loading } = useLeadMessages(lead.id)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Mark read when opened
  useEffect(() => {
    if (lead.unread_count > 0) markLeadRead(lead.id)
  }, [lead.id, lead.unread_count])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

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
      await addStaffMessage(lead.id, text, profile?.full_name || 'Staff')
      setDraft('')
    } catch { toast.error('Failed to send') }
    finally { setSending(false) }
  }

  async function changeStatus(s: LeadStatus) {
    try {
      await updateLeadStatus(lead.id, s)
      setStatusOpen(false)
      toast.success(`Status: ${LEAD_STATUS_CONFIG[s].label}`)
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

  return (
    <div className="flex flex-col h-full bg-[#EFEAE2] relative">
      {/* WhatsApp-style backdrop pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M30 30m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0' fill='%23000'/%3E%3C/svg%3E\")" }} />

      {/* Header */}
      <div className="relative z-10 bg-[#008069] text-white px-3 py-2.5 flex items-center gap-2 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10 lg:hidden" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
          {lead.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{lead.name}</p>
          <p className="text-[11px] opacity-80 truncate">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setStatusOpen(v => !v)} className="flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors">
            {LEAD_STATUS_CONFIG[lead.status]?.label}
            <ChevronDown size={12} />
          </button>
          {statusOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto">
                {ALL_LEAD_STATUSES.map(s => (
                  <button key={s} onClick={() => changeStatus(s)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-50',
                      lead.status === s && 'bg-gray-50 font-semibold')}>
                    <span className={cn('w-2 h-2 rounded-full', LEAD_STATUS_CONFIG[s].dot)} />
                    {LEAD_STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <a href={waHref} target="_blank" rel="noreferrer" title="Open in WhatsApp"
          className="p-1.5 rounded-full hover:bg-white/10 hidden sm:inline-flex"><MessageCircle size={16} /></a>
        <a href={`tel:${lead.phone}`} title="Call" className="p-1.5 rounded-full hover:bg-white/10 hidden sm:inline-flex"><Phone size={16} /></a>
        {lead.email && <a href={`mailto:${lead.email}`} title="Email" className="p-1.5 rounded-full hover:bg-white/10 hidden md:inline-flex"><Mail size={16} /></a>}
        <button onClick={() => setConfirmDel(true)} title="Delete" className="p-1.5 rounded-full hover:bg-white/10"><Trash2 size={16} /></button>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-1">
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

      {/* Composer — "staff note" (shown in chat, marked as outgoing) */}
      <div className="relative z-10 bg-[#F0F2F5] border-t border-gray-200 px-2 sm:px-3 py-2 flex items-end gap-2">
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

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={onDelete}
        title="Delete Lead?"
        message={`Permanently remove "${lead.name}" and all their messages? This cannot be undone.`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
