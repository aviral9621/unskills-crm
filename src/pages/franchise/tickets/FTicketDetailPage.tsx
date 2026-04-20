import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../../lib/utils'

interface Ticket {
  id: string; subject: string; category: string; status: string; priority: string
  description: string | null; created_at: string
}
interface Msg {
  id: string; sender_role: string | null; message: string; created_at: string
  sender: { full_name: string } | null
}

export default function FTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  async function load() {
    if (!id) return
    const [t, m] = await Promise.all([
      supabase.from('uce_support_tickets').select('*').eq('id', id).single(),
      supabase.from('uce_support_ticket_messages').select('id,sender_role,message,created_at,sender:uce_profiles(full_name)').eq('ticket_id', id).order('created_at'),
    ])
    setTicket(t.data as Ticket)
    setMsgs((m.data ?? []) as unknown as Msg[])
  }
  useEffect(() => { load() }, [id])
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [msgs])

  async function send() {
    if (!id || !newMsg.trim()) return
    setSending(true)
    const { error } = await supabase.from('uce_support_ticket_messages').insert({
      ticket_id: id, sender_id: user?.id, sender_role: profile?.role, message: newMsg.trim(),
    })
    setSending(false)
    if (error) return toast.error(error.message)
    setNewMsg(''); load()
  }

  if (!ticket) return <div className="text-center text-gray-400 py-10">Loading...</div>

  const basePath = window.location.pathname.startsWith('/admin') ? '/admin/support/tickets' : '/franchise/tickets'

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate(basePath)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Tickets
      </button>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 font-heading">{ticket.subject}</h1>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
            ticket.status === 'resolved' || ticket.status === 'closed' ? 'bg-green-50 text-green-700' :
            ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
          }`}>{ticket.status.replace('_', ' ')}</span>
        </div>
        <p className="text-xs text-gray-500 capitalize">{ticket.category} · {ticket.priority} · {formatDateDDMMYYYY(ticket.created_at)}</p>
        {ticket.description && <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>}
      </div>

      <div ref={scrollRef} className="rounded-xl border bg-white p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {msgs.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No replies yet.</p>}
        {msgs.map(m => {
          const isMine = m.sender_role === profile?.role
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3.5 py-2 ${isMine ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                <p className="text-xs opacity-75 mb-0.5">{m.sender?.full_name} · <span className="capitalize">{m.sender_role?.replace('_', ' ')}</span></p>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} rows={2}
          className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Type a reply..." />
        <button onClick={send} disabled={sending || !newMsg.trim()}
          className="self-end inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
        </button>
      </div>
    </div>
  )
}
