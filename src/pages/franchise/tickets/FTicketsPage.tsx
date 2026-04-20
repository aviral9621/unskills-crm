import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, LifeBuoy, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import { formatDateDDMMYYYY } from '../../../lib/utils'
import Modal from '../../../components/Modal'
import FormField, { inputClass } from '../../../components/FormField'

interface Row {
  id: string; subject: string; category: string; status: string
  priority: string; created_at: string
}

const CATEGORIES = [
  { v: 'technical', l: 'Technical Issue' },
  { v: 'payment', l: 'Payment Issue' },
  { v: 'suggestion', l: 'Suggestion' },
  { v: 'other', l: 'Other' },
]

export default function FTicketsPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'technical', priority: 'normal', description: '' })

  async function load() {
    if (!branchId) return
    const { data } = await supabase.from('uce_support_tickets').select('id,subject,category,status,priority,created_at').eq('branch_id', branchId).order('created_at', { ascending: false })
    setRows((data ?? []) as Row[])
  }
  useEffect(() => { load() }, [branchId])

  async function save() {
    if (!form.subject) return toast.error('Subject required')
    setSaving(true)
    const { error } = await supabase.from('uce_support_tickets').insert({ branch_id: branchId, created_by: user?.id || null, ...form })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Ticket raised')
    setModalOpen(false); setForm({ subject: '', category: 'technical', priority: 'normal', description: '' }); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Support Tickets</h1>
          <p className="text-sm text-gray-500">Raise issues or suggestions; head office will respond.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      <div className="rounded-xl border bg-white divide-y">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            <LifeBuoy size={28} className="mx-auto mb-2 text-gray-300" />No tickets yet.
          </div>
        ) : rows.map(r => (
          <Link key={r.id} to={`/franchise/tickets/${r.id}`} className="block px-4 py-3 hover:bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{r.subject}</p>
                <p className="text-xs text-gray-500 capitalize">{r.category} · {r.priority} · {formatDateDDMMYYYY(r.created_at)}</p>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                r.status === 'resolved' || r.status === 'closed' ? 'bg-green-50 text-green-700' :
                r.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
              }`}>{r.status.replace('_', ' ')}</span>
            </div>
          </Link>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Raise Ticket">
        <div className="space-y-3">
          <FormField label="Category">
            <select className={inputClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </FormField>
          <FormField label="Priority">
            <select className={inputClass} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="normal">Normal</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </FormField>
          <FormField label="Subject" required><input className={inputClass} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></FormField>
          <FormField label="Description"><textarea rows={4} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
