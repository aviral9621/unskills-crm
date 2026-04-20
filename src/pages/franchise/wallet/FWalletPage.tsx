import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Plus, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useBranch, useBranchId } from '../../../lib/franchise'
import { formatINR, formatDateDDMMYYYY } from '../../../lib/utils'

interface Txn {
  id: string; type: 'credit' | 'debit'; amount: number; balance_after: number
  description: string; created_at: string; reference_type: string | null
}

interface Request {
  id: string; amount: number; status: 'pending' | 'approved' | 'rejected'; created_at: string
  transaction_id: string | null; review_note: string | null
}

export default function FWalletPage() {
  const branch = useBranch()
  const branchId = useBranchId()
  const [txns, setTxns] = useState<Txn[]>([])
  const [reqs, setReqs] = useState<Request[]>([])

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_branch_wallet_transactions').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setTxns((data ?? []) as Txn[]))
    supabase.from('uce_branch_wallet_requests').select('id,amount,status,created_at,transaction_id,review_note').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setReqs((data ?? []) as Request[]))
  }, [branchId])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white p-6 flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">Current Wallet Balance</p>
          <p className="text-4xl font-bold font-heading mt-1">{formatINR(branch?.wallet_balance ?? 0)}</p>
          <p className="text-xs opacity-80 mt-2">{branch?.name}</p>
        </div>
        <Wallet size={56} className="opacity-30" />
      </div>

      <div className="flex gap-3">
        <Link to="/franchise/wallet/request" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Request Reload
        </Link>
      </div>

      {reqs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">My Reload Requests</h2>
          <div className="rounded-xl border bg-white divide-y">
            {reqs.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{formatINR(r.amount)} <span className="ml-2 text-xs text-gray-400 font-mono">{r.transaction_id}</span></p>
                  <p className="text-xs text-gray-500">{formatDateDDMMYYYY(r.created_at)}{r.review_note && ` · ${r.review_note}`}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Ledger</h2>
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Balance After</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {txns.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDDMMYYYY(t.created_at)}</td>
                  <td className="px-4 py-3">
                    {t.type === 'credit'
                      ? <span className="inline-flex items-center gap-1 text-green-700"><ArrowUpRight size={14} /> Credit</span>
                      : <span className="inline-flex items-center gap-1 text-red-700"><ArrowDownRight size={14} /> Debit</span>}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${t.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                    {t.type === 'credit' ? '+' : '-'}{formatINR(t.amount)}
                  </td>
                  <td className="px-4 py-3">{formatINR(t.balance_after)}</td>
                  <td className="px-4 py-3 text-gray-500">{t.description}</td>
                </tr>
              ))}
              {txns.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No transactions</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: Request['status'] }) {
  const map = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-700',
  }
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[status]}`}>{status}</span>
}
