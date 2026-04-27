import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Coins, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDateDDMMYYYY } from '../../lib/utils'
import {
  adminAdjustPoints,
  fetchPointBalance,
  fetchPointTransactions,
  type PointBalance,
  type PointTransaction,
} from '../../lib/rewards'
import Modal from '../../components/Modal'

interface Branch { id: string; name: string; code: string; b_code: string | null }
interface TxnRow extends PointTransaction { student?: { name: string; registration_no: string } | null }

const KIND_LABEL: Record<PointTransaction['kind'], string> = {
  reward_credit: 'Reward Credit',
  certificate_used: 'Certificate Used',
  admin_adjustment: 'Admin Adjustment',
}

export default function BranchPointWalletPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [balance, setBalance] = useState<PointBalance | null>(null)
  const [txns, setTxns] = useState<TxnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState<number>(0)
  const [adjustNote, setAdjustNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const [{ data: b, error: be }, bal, t] = await Promise.all([
        supabase.from('uce_branches').select('id,name,code,b_code').eq('id', id).maybeSingle(),
        fetchPointBalance(id),
        fetchPointTransactions(id, 500),
      ])
      if (be) throw be
      if (!b) { toast.error('Branch not found'); nav('/admin/branches'); return }
      setBranch(b as Branch)
      setBalance(bal)

      const studentIds = t.map(x => x.student_id).filter(Boolean) as string[]
      let studentMap: Record<string, { name: string; registration_no: string }> = {}
      if (studentIds.length) {
        const { data: stu } = await supabase.from('uce_students').select('id,name,registration_no').in('id', studentIds)
        for (const s of (stu ?? [])) studentMap[s.id] = { name: s.name, registration_no: s.registration_no }
      }
      setTxns(t.map(x => ({ ...x, student: x.student_id ? studentMap[x.student_id] : null })))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function submitAdjustment() {
    if (!id) return
    if (!adjustAmount || adjustAmount === 0) { toast.error('Enter a non-zero amount'); return }
    if (!adjustNote.trim()) { toast.error('Provide a reason'); return }
    setSaving(true)
    try {
      await adminAdjustPoints(id, Math.trunc(adjustAmount), adjustNote.trim())
      toast.success('Adjustment recorded')
      setShowAdjust(false)
      setAdjustAmount(0)
      setAdjustNote('')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to adjust') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => nav(-1)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 font-heading">Point Wallet — {branch?.name ?? '…'}</h1>
          <p className="text-xs text-gray-500 font-mono">{branch?.code} {branch?.b_code && `· ${branch.b_code}`}</p>
        </div>
        <button onClick={() => setShowAdjust(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm">
          <Plus size={16} /> Manual Adjustment
        </button>
      </div>

      {/* Hero balance */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-fuchsia-700 text-white p-5 sm:p-6">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs sm:text-sm opacity-90">Current Point Balance</p>
            <p className="text-3xl sm:text-5xl font-bold font-heading mt-1">{balance?.balance ?? 0}</p>
            <p className="text-xs opacity-80 mt-1">Earned {balance?.total_earned ?? 0} · Used {balance?.total_used ?? 0}</p>
          </div>
          <Coins size={48} className="opacity-30 sm:w-16 sm:h-16" />
        </div>
      </div>

      {/* Ledger */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Full Transaction Ledger</h2>
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Linked Student</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : txns.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No transactions</td></tr>
              ) : txns.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDDMMYYYY(t.created_at)}</td>
                  <td className="px-4 py-3">
                    {t.points > 0
                      ? <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowUpRight size={14} /> {KIND_LABEL[t.kind]}</span>
                      : <span className="inline-flex items-center gap-1 text-rose-700"><ArrowDownRight size={14} /> {KIND_LABEL[t.kind]}</span>}
                  </td>
                  <td className={`px-4 py-3 font-bold ${t.points > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {t.points > 0 ? '+' : ''}{t.points}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.description}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {t.student ? <><b className="text-gray-800">{t.student.name}</b><br /><span className="font-mono">{t.student.registration_no}</span></> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment modal */}
      {showAdjust && (
        <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="Manual Point Adjustment" size="sm">
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Use to credit (positive) or debit (negative) points outside the normal reward flow. A reason note is required for audit.
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Amount (signed integer)</label>
              <input
                type="number"
                value={adjustAmount === 0 ? '' : adjustAmount}
                onChange={e => setAdjustAmount(Number(e.target.value) || 0)}
                placeholder="e.g. +2 or -1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Reason *</label>
              <textarea
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
                rows={3}
                placeholder="e.g. Goodwill bonus for top performance"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAdjust(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={submitAdjustment} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Apply
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
