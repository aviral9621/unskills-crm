import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDateDDMMYYYY } from '../../lib/utils'
import { toast } from 'sonner'

interface Row {
  id: string; subject: string; category: string; status: string; priority: string; created_at: string
  branch: { name: string; code: string } | null
}

export default function AdminTicketsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open')

  async function load() {
    const { data } = await supabase.from('uce_support_tickets')
      .select('id,subject,category,status,priority,created_at,branch:uce_branches(name,code)')
      .eq('status', tab).order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => { load() }, [tab])

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('uce_support_tickets').update({
      status, updated_at: new Date().toISOString(),
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Status updated'); load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Support Tickets</h1>
        <p className="text-sm text-gray-500">Branch-raised tickets.</p>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {(['open', 'in_progress', 'resolved', 'closed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>{t.replace('_', ' ')}</button>
        ))}
      </div>

      <div className="rounded-xl border bg-white divide-y">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">No {tab.replace('_', ' ')} tickets.</div>
        ) : rows.map(r => (
          <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link to={`/admin/support/tickets/${r.id}`} className="flex-1 min-w-0">
              <p className="font-medium">{r.subject}</p>
              <p className="text-xs text-gray-500 capitalize">{r.category} · {r.priority} · <b>{r.branch?.name}</b> · {formatDateDDMMYYYY(r.created_at)}</p>
            </Link>
            <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} className="rounded-lg border px-2.5 py-1.5 text-xs">
              <option value="open">Open</option><option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option><option value="closed">Closed</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
