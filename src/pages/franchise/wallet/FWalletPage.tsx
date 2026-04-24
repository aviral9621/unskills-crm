import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Plus, ArrowDownRight, ArrowUpRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { useBranch, useBranchId } from '../../../lib/franchise'
import { formatINR, formatDateDDMMYYYY } from '../../../lib/utils'
import { downloadWalletReceipt, getHqDetailsForReceipt } from '../../../lib/pdf/wallet-receipt'

interface Txn {
  id: string; type: 'credit' | 'debit'; amount: number; balance_after: number
  description: string; created_at: string; reference_type: string | null
  reference_id?: string | null
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

  async function downloadReceipt(t: Txn) {
    if (!branch || t.type !== 'credit') return
    try {
      const hq = await getHqDetailsForReceipt()
      const b = branch as unknown as Record<string, unknown>
      await downloadWalletReceipt({
        receiptNo: `WR-${t.id.slice(0, 8).toUpperCase()}`,
        date: t.created_at,
        amount: t.amount,
        mode: t.reference_type || 'recharge',
        note: t.description,
        requestId: t.reference_id || null,
        approvedAt: t.created_at,
        branch: {
          name: branch.name,
          code: branch.code,
          b_code: (b.b_code as string | null) ?? null,
          phone: (b.director_phone as string | null) ?? null,
          address: [b.address_line1, b.village, b.block, b.district, b.state, b.pincode].filter(Boolean).join(', '),
          society_name: (b.society_name as string | null) ?? null,
          registration_number: (b.registration_number as string | null) ?? null,
          logo_url: (b.center_logo_url as string | null) ?? null,
        },
        hq,
      })
    } catch (e) { console.error(e); toast.error('Failed to generate receipt') }
  }

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_branch_wallet_transactions').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setTxns((data ?? []) as Txn[]))
    supabase.from('uce_branch_wallet_requests').select('id,amount,status,created_at,transaction_id,review_note').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setReqs((data ?? []) as Request[]))
  }, [branchId])

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white p-4 sm:p-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm opacity-90">Current Wallet Balance</p>
          <p className="text-2xl sm:text-4xl font-bold font-heading mt-1 break-words">{formatINR(branch?.wallet_balance ?? 0)}</p>
          <p className="text-xs opacity-80 mt-2 truncate">{branch?.name}</p>
        </div>
        <Wallet size={40} className="opacity-30 shrink-0 sm:w-14 sm:h-14" />
      </div>

      <div className="flex gap-3">
        <Link to="/franchise/wallet/request" className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Request Reload
        </Link>
      </div>

      {reqs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">My Reload Requests</h2>
          <div className="rounded-xl border bg-white divide-y">
            {reqs.map(r => (
              <div key={r.id} className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{formatINR(r.amount)} {r.transaction_id && <span className="ml-2 text-xs text-gray-400 font-mono break-all">{r.transaction_id}</span>}</p>
                  <p className="text-xs text-gray-500 break-words">{formatDateDDMMYYYY(r.created_at)}{r.review_note && ` · ${r.review_note}`}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Ledger</h2>
        {/* Mobile: card list */}
        <div className="md:hidden space-y-2">
          {txns.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">No transactions</div>
          ) : txns.map(t => (
            <div key={t.id} className="rounded-xl border bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 font-semibold text-xs ${t.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                  {t.type === 'credit' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {t.type.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">{formatDateDDMMYYYY(t.created_at)}</span>
              </div>
              <p className={`font-semibold mt-1 ${t.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                {t.type === 'credit' ? '+' : '-'}{formatINR(t.amount)}
              </p>
              <p className="text-xs text-gray-500 break-words mt-0.5">{t.description}</p>
              <p className="text-[10px] text-gray-400 mt-1">Balance: {formatINR(t.balance_after)}</p>
              {t.type === 'credit' && (
                <button onClick={() => downloadReceipt(t)} className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50">
                  <Download size={11} /> Receipt
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Desktop: table */}
        <div className="hidden md:block rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Balance After</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3"></th>
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
                  <td className="px-4 py-3">
                    {t.type === 'credit' && (
                      <button onClick={() => downloadReceipt(t)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50">
                        <Download size={11} /> Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {txns.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No transactions</td></tr>}
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
