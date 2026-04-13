import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  ArrowLeft, Wallet, Plus, ArrowDownCircle,
  ArrowUpCircle, Loader2, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDate } from '../../lib/utils'
import type { Branch, WalletTransaction } from '../../types'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'

const colHelper = createColumnHelper<WalletTransaction>()

export default function BranchWalletPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(searchParams.get('add') === 'true')
  const [addAmount, setAddAmount] = useState('')
  const [addDesc, setAddDesc] = useState('Recharge via bank transfer')
  const [addError, setAddError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (id) fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    try {
      const [branchRes, txnRes] = await Promise.all([
        supabase.from('uce_branches').select('*').eq('id', id).single(),
        supabase.from('uce_branch_wallet_transactions').select('*').eq('branch_id', id).order('created_at', { ascending: false }),
      ])
      if (branchRes.error) throw branchRes.error
      if (!branchRes.data) { toast.error('Branch not found'); navigate('/admin/branches'); return }
      setBranch(branchRes.data)
      setTransactions(txnRes.data ?? [])
    } catch { toast.error('Failed to load wallet data') }
    finally { setLoading(false) }
  }

  async function handleAddBalance() {
    setAddError('')
    const amount = parseFloat(addAmount)
    if (isNaN(amount) || amount < 100) { setAddError('Minimum amount is ₹100'); return }
    if (!branch || !id) return
    setSubmitting(true)
    try {
      const nb = (branch.wallet_balance || 0) + amount
      const { error: ue } = await supabase.from('uce_branches').update({ wallet_balance: nb, updated_at: new Date().toISOString() }).eq('id', id)
      if (ue) throw ue
      const { error: te } = await supabase.from('uce_branch_wallet_transactions').insert({
        branch_id: id, type: 'credit', amount, balance_after: nb,
        description: addDesc || 'Recharge by Admin', reference_type: 'recharge', performed_by: user?.id || null,
      })
      if (te) throw te
      toast.success(`Wallet balance added: + ${formatINR(amount)}`)
      setBranch({ ...branch, wallet_balance: nb })
      setModalOpen(false); setAddAmount(''); setAddDesc('Recharge via bank transfer')
      fetchData()
    } catch { toast.error('Failed to add balance') }
    finally { setSubmitting(false) }
  }

  const lastRecharge = useMemo(() => {
    const c = transactions.find(t => t.type === 'credit')
    if (!c) return null
    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
    return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`
  }, [transactions])

  /* ─── Desktop columns ─── */
  const columns = useMemo(() => [
    colHelper.accessor('created_at', { header: 'Date', cell: info => <span className="text-sm text-gray-600">{formatDate(info.getValue())}</span> }),
    colHelper.accessor('type', { header: 'Type', cell: info => <StatusBadge label={info.getValue() === 'credit' ? 'Credit' : 'Debit'} variant={info.getValue() === 'credit' ? 'success' : 'error'} /> }),
    colHelper.accessor('description', { header: 'Description', cell: info => <span className="text-sm text-gray-700 max-w-[300px] truncate block">{info.getValue()}</span> }),
    colHelper.accessor('amount', { header: 'Amount', cell: info => { const t = info.row.original.type; return <span className={`text-sm font-semibold ${t === 'credit' ? 'text-green-600' : 'text-red-600'}`}>{t === 'credit' ? '+ ' : '- '}{formatINR(info.getValue())}</span> } }),
    colHelper.accessor('balance_after', { header: 'Balance', cell: info => <span className="text-sm font-medium text-gray-700">{formatINR(info.getValue())}</span> }),
  ], [])

  const balColor = (branch?.wallet_balance ?? 0) > 1000 ? 'from-green-500 to-emerald-600' : (branch?.wallet_balance ?? 0) > 0 ? 'from-amber-500 to-orange-600' : 'from-red-500 to-red-600'
  const balTextColor = (branch?.wallet_balance ?? 0) > 1000 ? 'text-green-700' : (branch?.wallet_balance ?? 0) > 0 ? 'text-amber-700' : 'text-red-700'

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-32 sm:h-40 rounded-2xl" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => navigate('/admin/branches')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading truncate">{branch?.name}</h1>
            <p className="text-xs sm:text-sm text-gray-500">{branch?.code} &middot; Wallet</p>
          </div>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Add</span> Balance
        </button>
      </div>

      {/* ─── Balance Card ─── */}
      <div className={`bg-gradient-to-br ${balColor} rounded-2xl p-5 sm:p-8 text-white shadow-lg relative overflow-hidden`}>
        <div className="absolute -top-10 -right-10 w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-6 w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-white/10" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet size={18} className="text-white/80" />
            <span className="text-xs sm:text-sm font-medium text-white/80">Current Balance</span>
          </div>
          <p className="text-2xl sm:text-4xl font-bold font-heading">{formatINR(branch?.wallet_balance ?? 0)}</p>
          {lastRecharge && (
            <p className="text-xs sm:text-sm text-white/70 mt-1.5 flex items-center gap-1.5">
              <Clock size={12} /> Last recharge: {lastRecharge}
            </p>
          )}

          <div className="flex gap-3 mt-4">
            <div className="bg-white/15 rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-center backdrop-blur-sm flex-1 sm:flex-none">
              <ArrowUpCircle size={18} className="mx-auto text-white/80 mb-0.5" />
              <p className="text-[10px] sm:text-xs text-white/70">Credits</p>
              <p className="text-sm font-bold">{transactions.filter(t => t.type === 'credit').length}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-center backdrop-blur-sm flex-1 sm:flex-none">
              <ArrowDownCircle size={18} className="mx-auto text-white/80 mb-0.5" />
              <p className="text-[10px] sm:text-xs text-white/70">Debits</p>
              <p className="text-sm font-bold">{transactions.filter(t => t.type === 'debit').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Transaction History ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-sm sm:text-base font-semibold text-gray-900 font-heading mb-3 sm:mb-4">Transaction History</h2>

        {/* Mobile Cards */}
        <div className="md:hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-10">
              <Wallet size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map(txn => (
                <div key={txn.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${txn.type === 'credit' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {txn.type === 'credit' ? <ArrowUpCircle size={18} className="text-green-500" /> : <ArrowDownCircle size={18} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{txn.description}</p>
                    <p className="text-[11px] text-gray-400">{formatDate(txn.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'credit' ? '+' : '-'} {formatINR(txn.amount)}
                    </p>
                    <p className="text-[10px] text-gray-400">Bal: {formatINR(txn.balance_after)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <DataTable data={transactions} columns={columns} emptyIcon={<Wallet size={36} className="text-gray-300" />} emptyMessage="No transactions yet" />
        </div>
      </div>

      {/* ─── Add Balance Modal ─── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setAddError('') }} title="Add Balance" description={`${branch?.name} (${branch?.code})`} size="sm">
        <div className="space-y-4">
          <div className={`rounded-xl border p-3 ${(branch?.wallet_balance ?? 0) > 1000 ? 'bg-green-50 border-green-200' : (branch?.wallet_balance ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500">Current Balance</p>
            <p className={`text-lg font-bold font-heading ${balTextColor}`}>{formatINR(branch?.wallet_balance ?? 0)}</p>
          </div>
          <FormField label="Amount" required error={addError}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
              <input type="number" value={addAmount} onChange={e => { setAddAmount(e.target.value); setAddError('') }}
                className={`${inputClass} pl-8`} placeholder="Enter amount (min ₹100)" min={100} step={1} />
            </div>
          </FormField>
          <FormField label="Description">
            <input type="text" value={addDesc} onChange={e => setAddDesc(e.target.value)} className={inputClass}
              placeholder="e.g., Recharge via bank transfer" maxLength={500} />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setAddError('') }}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="button" onClick={handleAddBalance} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Adding...' : 'Add Balance'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
