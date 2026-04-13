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

  // Add balance modal
  const [modalOpen, setModalOpen] = useState(searchParams.get('add') === 'true')
  const [addAmount, setAddAmount] = useState('')
  const [addDesc, setAddDesc] = useState('Recharge via bank transfer')
  const [addError, setAddError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) fetchData()
  }, [id])

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
    } catch (err) {
      console.error(err)
      toast.error('Failed to load wallet data')
    } finally {
      setLoading(false)
    }
  }

  /* ─── Add Balance ─── */
  async function handleAddBalance() {
    setAddError('')
    const amount = parseFloat(addAmount)
    if (isNaN(amount) || amount < 100) {
      setAddError('Minimum amount is ₹100')
      return
    }
    if (!branch || !id) return

    setSubmitting(true)
    try {
      const newBalance = (branch.wallet_balance || 0) + amount

      // Update wallet balance
      const { error: updateErr } = await supabase
        .from('uce_branches')
        .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (updateErr) throw updateErr

      // Insert transaction record
      const { error: txnErr } = await supabase.from('uce_branch_wallet_transactions').insert({
        branch_id: id,
        type: 'credit',
        amount,
        balance_after: newBalance,
        description: addDesc || 'Recharge by Admin',
        reference_type: 'recharge',
        performed_by: user?.id || null,
      })
      if (txnErr) throw txnErr

      toast.success(`Wallet balance added: + ${formatINR(amount)}`)
      setBranch({ ...branch, wallet_balance: newBalance })
      setModalOpen(false)
      setAddAmount('')
      setAddDesc('Recharge via bank transfer')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to add balance')
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── Last recharge time ─── */
  const lastRecharge = useMemo(() => {
    const credit = transactions.find((t) => t.type === 'credit')
    if (!credit) return null
    const diff = Date.now() - new Date(credit.created_at).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }, [transactions])

  /* ─── Table Columns ─── */
  const columns = useMemo(
    () => [
      colHelper.accessor('created_at', {
        header: 'Date',
        cell: (info) => (
          <span className="text-sm text-gray-600">{formatDate(info.getValue())}</span>
        ),
      }),
      colHelper.accessor('type', {
        header: 'Type',
        cell: (info) => (
          <StatusBadge
            label={info.getValue() === 'credit' ? 'Credit' : 'Debit'}
            variant={info.getValue() === 'credit' ? 'success' : 'error'}
          />
        ),
      }),
      colHelper.accessor('description', {
        header: 'Description',
        cell: (info) => (
          <span className="text-sm text-gray-700 max-w-[300px] truncate block">{info.getValue()}</span>
        ),
      }),
      colHelper.accessor('amount', {
        header: 'Amount',
        cell: (info) => {
          const type = info.row.original.type
          return (
            <span className={`text-sm font-semibold ${type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
              {type === 'credit' ? '+ ' : '- '}{formatINR(info.getValue())}
            </span>
          )
        },
      }),
      colHelper.accessor('balance_after', {
        header: 'Balance After',
        cell: (info) => (
          <span className="text-sm font-medium text-gray-700">{formatINR(info.getValue())}</span>
        ),
      }),
    ],
    []
  )

  /* ─── Balance color ─── */
  const balColor = (branch?.wallet_balance ?? 0) > 1000
    ? 'from-green-500 to-emerald-600'
    : (branch?.wallet_balance ?? 0) > 0
    ? 'from-amber-500 to-orange-600'
    : 'from-red-500 to-red-600'

  const balTextColor = (branch?.wallet_balance ?? 0) > 1000
    ? 'text-green-700'
    : (branch?.wallet_balance ?? 0) > 0
    ? 'text-amber-700'
    : 'text-red-700'

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/branches')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">
              {branch?.name} — Wallet
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{branch?.code}</p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Balance
        </button>
      </div>

      {/* Balance Card */}
      <div className={`bg-gradient-to-br ${balColor} rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden`}>
        {/* Decorative circle */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/10" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-white/80" />
              <span className="text-sm font-medium text-white/80">Current Balance</span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold font-heading">
              {formatINR(branch?.wallet_balance ?? 0)}
            </p>
            {lastRecharge && (
              <p className="text-sm text-white/70 mt-2 flex items-center gap-1.5">
                <Clock size={14} /> Last recharge: {lastRecharge}
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <div className="bg-white/15 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
              <ArrowUpCircle size={20} className="mx-auto text-white/80 mb-1" />
              <p className="text-xs text-white/70">Credits</p>
              <p className="text-sm font-bold">{transactions.filter(t => t.type === 'credit').length}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
              <ArrowDownCircle size={20} className="mx-auto text-white/80 mb-1" />
              <p className="text-xs text-white/70">Debits</p>
              <p className="text-sm font-bold">{transactions.filter(t => t.type === 'debit').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 font-heading mb-4">Transaction History</h2>
        <DataTable
          data={transactions}
          columns={columns}
          emptyIcon={<Wallet size={36} className="text-gray-300" />}
          emptyMessage="No transactions yet"
        />
      </div>

      {/* Add Balance Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setAddError('') }}
        title="Add Balance"
        description={`${branch?.name} (${branch?.code})`}
        size="sm"
      >
        <div className="space-y-4">
          {/* Current balance */}
          <div className={`rounded-xl border p-3 ${(branch?.wallet_balance ?? 0) > 1000 ? 'bg-green-50 border-green-200' : (branch?.wallet_balance ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500">Current Balance</p>
            <p className={`text-lg font-bold font-heading ${balTextColor}`}>
              {formatINR(branch?.wallet_balance ?? 0)}
            </p>
          </div>

          <FormField label="Amount" required error={addError}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => { setAddAmount(e.target.value); setAddError('') }}
                className={`${inputClass} pl-8`}
                placeholder="Enter amount (min ₹100)"
                min={100}
                step={1}
              />
            </div>
          </FormField>

          <FormField label="Description">
            <input
              type="text"
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              className={inputClass}
              placeholder="e.g., Recharge via bank transfer"
              maxLength={500}
            />
          </FormField>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setAddError('') }}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddBalance}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Adding...' : 'Add Balance'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
