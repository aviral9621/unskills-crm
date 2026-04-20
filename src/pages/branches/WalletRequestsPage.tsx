import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, X, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

interface Row {
  id: string; amount: number; transaction_id: string | null; payment_mode: string
  screenshot_url: string | null; note: string | null; status: 'pending' | 'approved' | 'rejected'
  review_note: string | null; created_at: string
  branch: { name: string; code: string; wallet_balance: number } | null
}

export default function WalletRequestsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')

  async function load() {
    const { data } = await supabase.from('uce_branch_wallet_requests')
      .select('id,amount,transaction_id,payment_mode,screenshot_url,note,status,review_note,created_at,branch:uce_branches(name,code,wallet_balance)')
      .eq('status', tab).order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => { load() }, [tab])

  async function approve(r: Row) {
    setLoading(true)
    const { error } = await supabase.rpc('uce_approve_wallet_request', { p_request_id: r.id, p_note: null })
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success(`Approved — ${formatINR(r.amount)} credited`); load()
  }

  async function reject(r: Row) {
    const note = prompt('Reason for rejection?')
    if (!note) return
    setLoading(true)
    const { error } = await supabase.rpc('uce_reject_wallet_request', { p_request_id: r.id, p_note: note })
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success('Rejected'); load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Wallet Reload Requests</h1>
        <p className="text-sm text-gray-500">Review branch reload requests with payment proof.</p>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {(['pending', 'approved', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No {tab} requests.</div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-3 sm:p-4 grid sm:grid-cols-[1fr_auto] gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="font-semibold break-words">{r.branch?.name}</p>
                <span className="text-xs font-mono text-gray-400">{r.branch?.code}</span>
                <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{formatDateDDMMYYYY(r.created_at)}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{formatINR(r.amount)}</p>
              <div className="mt-1 text-sm text-gray-600 break-words">
                {r.transaction_id && <span className="font-mono break-all">{r.transaction_id}</span>}
                {r.transaction_id && ' · '}
                <span className="capitalize">{r.payment_mode.replace('_', ' ')}</span>
              </div>
              {r.note && <p className="text-xs text-gray-500 mt-1">{r.note}</p>}
              {r.review_note && <p className="text-xs text-red-600 mt-1">Review: {r.review_note}</p>}
              {r.screenshot_url && (
                <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-red-600 hover:underline">
                  <ExternalLink size={12} /> View payment proof
                </a>
              )}
            </div>
            {tab === 'pending' && (
              <div className="flex sm:flex-col gap-2">
                <button onClick={() => approve(r)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  <Check size={14} /> Approve
                </button>
                <button onClick={() => reject(r)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50">
                  <X size={14} /> Reject
                </button>
              </div>
            )}
            {loading && <Loader2 size={16} className="animate-spin text-gray-400 self-center" />}
          </div>
        ))}
      </div>
    </div>
  )
}
