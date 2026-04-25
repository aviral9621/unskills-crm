import { useEffect, useMemo, useState } from 'react'
import {
  Gift, Copy, Share2, MessageCircle, Wallet, Users, IndianRupee,
  Loader2, CheckCircle2, XCircle, Clock, RotateCcw, Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatINR, cn } from '../../lib/utils'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReferralRow {
  id: string
  level: number
  status: 'pending' | 'credited' | 'clawed_back' | 'rejected'
  commission_amount: number
  credited_at: string | null
  created_at: string
  referee_student: { name: string; registration_no: string } | null
  referee_inquiry: { full_name: string | null; phone: string | null } | null
}

interface EarningRow {
  id: string
  type: 'credit' | 'debit' | 'withdrawal' | 'reversal'
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

interface WithdrawalRow {
  id: string
  amount: number
  status: 'requested' | 'paid' | 'rejected'
  utr_or_ref: string | null
  rejection_reason: string | null
  paid_at: string | null
  created_at: string
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StudentReferEarnPage() {
  const { rec } = useStudentRecord()
  const [code, setCode] = useState<string>('')
  const [shareBaseUrl, setShareBaseUrl] = useState<string>('https://unskills-computer-education.vercel.app')
  const [minWithdrawal, setMinWithdrawal] = useState<number>(500)
  const [referrals, setReferrals] = useState<ReferralRow[]>([])
  const [earnings, setEarnings] = useState<EarningRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'referrals' | 'wallet' | 'withdrawals'>('referrals')
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  useEffect(() => {
    if (!rec) return
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.id])

  async function loadAll() {
    if (!rec) return
    setLoading(true)
    try {
      const [codeRes, settingsRes, refsRes, earnRes, wdRes] = await Promise.all([
        supabase.from('uce_referral_codes').select('code').eq('student_id', rec.id).maybeSingle(),
        supabase.from('uce_site_settings').select('key, value')
          .in('key', ['referral_share_base_url', 'referral_min_withdrawal']),
        supabase.from('uce_referrals')
          .select(`id, level, status, commission_amount, credited_at, created_at,
                   referee_student:uce_students!uce_referrals_referee_student_id_fkey(name, registration_no),
                   referee_inquiry:uce_inquiries!uce_referrals_referee_inquiry_id_fkey(full_name, phone)`)
          .eq('referrer_student_id', rec.id)
          .order('created_at', { ascending: false }),
        supabase.from('uce_referral_earnings').select('*')
          .eq('student_id', rec.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('uce_referral_withdrawals').select('*')
          .eq('student_id', rec.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      setCode((codeRes.data as { code?: string } | null)?.code ?? '')
      const settingsMap = new Map<string, string>(
        ((settingsRes.data ?? []) as { key: string; value: string }[]).map(r => [r.key, r.value])
      )
      if (settingsMap.has('referral_share_base_url')) setShareBaseUrl(settingsMap.get('referral_share_base_url')!)
      if (settingsMap.has('referral_min_withdrawal')) setMinWithdrawal(parseInt(settingsMap.get('referral_min_withdrawal')!) || 500)
      setReferrals((refsRes.data ?? []) as unknown as ReferralRow[])
      setEarnings((earnRes.data ?? []) as EarningRow[])
      setWithdrawals((wdRes.data ?? []) as WithdrawalRow[])
    } catch (e) { console.error(e); toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  const totalReferrals = referrals.length
  const totalEarned = earnings.filter(e => e.type === 'credit').reduce((s, e) => s + Number(e.amount), 0)
  const balance = useMemo(() => earnings[0]?.balance_after ?? 0, [earnings])
  const pendingWithdraw = withdrawals.filter(w => w.status === 'requested').reduce((s, w) => s + Number(w.amount), 0)
  const available = Math.max(0, Number(balance) - pendingWithdraw)
  const shareLink = code ? `${shareBaseUrl.replace(/\/+$/, '')}/student/register?ref=${code}` : ''
  const shareMessage = `Join UnSkills Computer Education using my referral code: ${code}\n${shareLink}`

  function copyText(text: string, label: string) {
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error('Copy failed')
    )
  }

  function shareViaWhatsApp() {
    if (!shareLink) return
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank', 'noopener')
  }

  async function nativeShare() {
    if (!shareLink) return
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title: 'UnSkills referral', text: shareMessage, url: shareLink }) }
      catch { /* user dismissed */ }
    } else {
      copyText(shareLink, 'Link')
    }
  }

  if (!rec) {
    return <div className="space-y-3"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-24 rounded-xl" /></div>
  }

  return (
    <div className="space-y-4 sm:space-y-5 pb-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Gift size={18} />
          <p className="text-sm opacity-90 font-semibold uppercase tracking-wider">Refer & Earn</p>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Earn ₹100 for every friend you refer</h1>
        <p className="text-xs sm:text-sm opacity-90 mt-1">Plus ₹30 indirect bonus when they refer someone too. Paid after their full course fee is paid.</p>
      </div>

      {/* Code + share */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Referral Code</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-lg sm:text-2xl text-red-600 tracking-widest text-center">
              {code || '—'}
            </code>
            <button onClick={() => copyText(code, 'Code')} disabled={!code}
              className="p-3 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
              <Copy size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3">Share Link</p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-mono break-all">
              {shareLink || '—'}
            </code>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button onClick={() => copyText(shareLink, 'Link')} disabled={!code}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <Copy size={13} /> Copy
            </button>
            <button onClick={shareViaWhatsApp} disabled={!code}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
              <MessageCircle size={13} /> WhatsApp
            </button>
            <button onClick={nativeShare} disabled={!code}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat icon={Users} label="Referrals" value={String(totalReferrals)} tone="blue" />
        <Stat icon={IndianRupee} label="Total Earned" value={formatINR(totalEarned)} tone="green" />
        <Stat icon={Wallet} label="Available" value={formatINR(available)} tone="red" />
      </div>

      {/* Withdraw button */}
      <div className="rounded-2xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Wallet Balance: <span className="text-red-600">{formatINR(available)}</span></p>
          <p className="text-xs text-gray-500 mt-0.5">Minimum withdrawal: {formatINR(minWithdrawal)}{pendingWithdraw > 0 && ` · ${formatINR(pendingWithdraw)} request pending`}</p>
        </div>
        <button
          onClick={() => setWithdrawOpen(true)}
          disabled={available < minWithdrawal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={15} /> Withdraw
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { value: 'referrals' as const, label: 'Referrals', count: referrals.length },
            { value: 'wallet' as const, label: 'Wallet History', count: earnings.length },
            { value: 'withdrawals' as const, label: 'Withdrawals', count: withdrawals.length },
          ].map(t => (
            <button key={t.value} onClick={() => setActiveTab(t.value)}
              className={cn(
                'flex-1 px-3 py-3 text-xs sm:text-sm font-semibold transition-colors border-b-2',
                activeTab === t.value
                  ? 'border-red-600 text-red-600 bg-red-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {t.label} <span className="ml-1 text-[10px] text-gray-400">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
          ) : activeTab === 'referrals' ? (
            referrals.length === 0 ? <Empty icon={Users} text="No referrals yet — share your code to start earning." /> :
            <div className="divide-y divide-gray-100">
              {referrals.map(r => {
                const refereeName = r.referee_student?.name ?? r.referee_inquiry?.full_name ?? 'New lead'
                const refereeId = r.referee_student?.registration_no ?? r.referee_inquiry?.phone ?? ''
                return (
                  <div key={r.id} className="py-3 flex items-center gap-3">
                    <ReferralStatusIcon status={r.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{refereeName}</p>
                      <p className="text-[11px] text-gray-400">
                        {refereeId && <span>{refereeId} · </span>}
                        L{r.level} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-sm font-bold',
                        r.status === 'credited' ? 'text-green-600' :
                        r.status === 'clawed_back' ? 'text-red-500 line-through' :
                        r.status === 'rejected' ? 'text-gray-400' : 'text-amber-600'
                      )}>{formatINR(r.commission_amount)}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{r.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : activeTab === 'wallet' ? (
            earnings.length === 0 ? <Empty icon={Wallet} text="No wallet activity yet." /> :
            <div className="divide-y divide-gray-100">
              {earnings.map(e => (
                <div key={e.id} className="py-3 flex items-center gap-3">
                  <LedgerIcon type={e.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{e.description ?? e.type}</p>
                    <p className="text-[11px] text-gray-400">{new Date(e.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-sm font-bold', e.type === 'credit' ? 'text-green-600' : 'text-red-500')}>
                      {e.type === 'credit' ? '+' : '−'}{formatINR(e.amount)}
                    </p>
                    <p className="text-[10px] text-gray-400">Bal: {formatINR(e.balance_after)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            withdrawals.length === 0 ? <Empty icon={Send} text="No withdrawal requests yet." /> :
            <div className="divide-y divide-gray-100">
              {withdrawals.map(w => (
                <div key={w.id} className="py-3 flex items-center gap-3">
                  <WithdrawalStatusIcon status={w.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{formatINR(w.amount)}</p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(w.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      {w.utr_or_ref && <> · UTR: {w.utr_or_ref}</>}
                      {w.rejection_reason && <> · {w.rejection_reason}</>}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    w.status === 'paid' ? 'bg-green-100 text-green-700' :
                    w.status === 'rejected' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'
                  )}>{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={available}
        minAmount={minWithdrawal}
        studentId={rec.id}
        onDone={() => { setWithdrawOpen(false); void loadAll() }}
      />
    </div>
  )
}

// ─── Withdraw modal ──────────────────────────────────────────────────────────

function WithdrawModal({
  open, onClose, available, minAmount, studentId, onDone,
}: {
  open: boolean; onClose: () => void
  available: number; minAmount: number; studentId: string
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [upi, setUpi] = useState('')
  const [acc, setAcc] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [holder, setHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) { setAmount(String(minAmount)); setUpi(''); setAcc(''); setIfsc(''); setHolder('') }
  }, [open, minAmount])

  async function submit() {
    const amt = parseFloat(amount)
    if (!amt || amt < minAmount) { toast.error(`Minimum is ₹${minAmount}`); return }
    if (amt > available) { toast.error('Exceeds available balance'); return }
    if (!upi.trim()) { toast.error('UPI ID is required'); return }
    setSubmitting(true)
    const { error } = await supabase.from('uce_referral_withdrawals').insert({
      student_id: studentId, amount: amt,
      upi_id: upi.trim(),
      bank_account_no: acc.trim() || null,
      bank_ifsc: ifsc.trim().toUpperCase() || null,
      bank_holder_name: holder.trim() || null,
    })
    setSubmitting(false)
    if (error) { toast.error(error.message || 'Failed'); return }
    toast.success('Withdrawal request submitted')
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="Request Withdrawal" size="sm">
      <div className="space-y-3">
        <div className="rounded-lg bg-gray-50 border p-3">
          <p className="text-xs text-gray-500">Available balance</p>
          <p className="text-lg font-bold text-gray-900">{formatINR(available)}</p>
        </div>
        <FormField label="Amount" required hint={`Minimum ₹${minAmount}`}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
            <input type="number" min={minAmount} max={available} value={amount}
              onChange={e => setAmount(e.target.value)} className={`${inputClass} pl-7`} />
          </div>
        </FormField>
        <FormField label="UPI ID" required>
          <input value={upi} onChange={e => setUpi(e.target.value)} className={inputClass} placeholder="yourname@upi" />
        </FormField>
        <div className="rounded-lg border-dashed border p-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bank details (optional)</p>
          <FormField label="Account number"><input value={acc} onChange={e => setAcc(e.target.value)} className={inputClass} /></FormField>
          <FormField label="IFSC"><input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} className={inputClass} placeholder="SBIN0001234" /></FormField>
          <FormField label="Account holder"><input value={holder} onChange={e => setHolder(e.target.value)} className={inputClass} /></FormField>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />} Submit Request
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: 'blue' | 'green' | 'red' }) {
  const c = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  return (
    <div className={`rounded-xl p-3 sm:p-4 ${c}`}>
      <Icon size={14} className="opacity-70" />
      <p className="text-[10px] sm:text-xs font-semibold uppercase opacity-80 mt-1">{label}</p>
      <p className="mt-0.5 font-heading text-base sm:text-lg font-bold break-words">{value}</p>
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-10 text-center">
      <Icon size={28} className="mx-auto text-gray-300 mb-2" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}

function ReferralStatusIcon({ status }: { status: ReferralRow['status'] }) {
  if (status === 'credited') return <CheckCircle2 size={16} className="text-green-600 shrink-0" />
  if (status === 'clawed_back') return <RotateCcw size={16} className="text-red-500 shrink-0" />
  if (status === 'rejected') return <XCircle size={16} className="text-gray-400 shrink-0" />
  return <Clock size={16} className="text-amber-500 shrink-0" />
}

function LedgerIcon({ type }: { type: EarningRow['type'] }) {
  if (type === 'credit') return <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center shrink-0"><IndianRupee size={13} className="text-green-700" /></div>
  return <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center shrink-0"><RotateCcw size={13} className="text-red-700" /></div>
}

function WithdrawalStatusIcon({ status }: { status: WithdrawalRow['status'] }) {
  if (status === 'paid') return <CheckCircle2 size={16} className="text-green-600 shrink-0" />
  if (status === 'rejected') return <XCircle size={16} className="text-gray-400 shrink-0" />
  return <Clock size={16} className="text-amber-500 shrink-0" />
}
