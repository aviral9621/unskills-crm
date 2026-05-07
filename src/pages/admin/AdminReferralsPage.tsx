import { useEffect, useMemo, useState } from 'react'
import {
  Users2, BarChart3, Send, Settings as SettingsIcon, Loader2,
  CheckCircle2, XCircle, RotateCcw, Clock, IndianRupee, Save,
  TrendingUp, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, cn } from '../../lib/utils'
import FormField, { inputClass } from '../../components/FormField'
import Modal from '../../components/Modal'
import { getSiteSettings, saveSiteSettings, type SiteSettings } from '../../lib/siteSettings'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReferralRow {
  id: string
  level: number
  status: 'pending' | 'credited' | 'clawed_back' | 'rejected'
  commission_amount: number
  credited_at: string | null
  created_at: string
  referrer_student: { name: string; registration_no: string } | null
  referee_student: { name: string; registration_no: string } | null
  referee_inquiry: { full_name: string | null; phone: string | null } | null
}

interface WithdrawalRow {
  id: string
  student_id: string
  amount: number
  upi_id: string
  bank_account_no: string | null
  bank_ifsc: string | null
  bank_holder_name: string | null
  status: 'requested' | 'paid' | 'rejected'
  utr_or_ref: string | null
  rejection_reason: string | null
  paid_at: string | null
  created_at: string
  student: { name: string; registration_no: string; phone: string } | null
}

type Tab = 'dashboard' | 'referrals' | 'withdrawals' | 'settings'

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminReferralsPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [tab, setTab] = useState<Tab>('dashboard')

  if (profile && !isSuperAdmin) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-gray-600">Only super admins can manage referrals.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Users2 size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Referrals</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Track student-to-student referrals, commissions, and withdrawals</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { value: 'dashboard' as const,   label: 'Dashboard',   icon: BarChart3 },
            { value: 'referrals' as const,   label: 'All Referrals', icon: Users2 },
            { value: 'withdrawals' as const, label: 'Withdrawals', icon: Send },
            { value: 'settings' as const,    label: 'Settings',    icon: SettingsIcon },
          ].map(t => {
            const Icon = t.icon
            return (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0',
                  tab === t.value ? 'border-red-600 text-red-600 bg-red-50/40' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>
        <div className="p-3 sm:p-5">
          {tab === 'dashboard'   && <DashboardTab />}
          {tab === 'referrals'   && <ReferralsTab />}
          {tab === 'withdrawals' && <WithdrawalsTab />}
          {tab === 'settings'    && <SettingsTab />}
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard tab ───────────────────────────────────────────────────────────

function DashboardTab() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0, credited: 0, pending: 0, clawedBack: 0,
    totalPaid: 0, pendingWithdrawals: 0, totalEarnings: 0,
  })
  const [topRefs, setTopRefs] = useState<{ student_id: string; name: string; reg: string; count: number; earned: number }[]>([])

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [refsRes, earnRes, wdRes] = await Promise.all([
        supabase.from('uce_referrals').select('id, status, commission_amount, referrer_student_id, referrer_student:uce_students!uce_referrals_referrer_student_id_fkey(id, name, registration_no)'),
        supabase.from('uce_referral_earnings').select('amount, type'),
        supabase.from('uce_referral_withdrawals').select('amount, status'),
      ])
      const refs = (refsRes.data ?? []) as unknown as Array<{ id: string; status: string; commission_amount: number; referrer_student_id: string; referrer_student: { id: string; name: string; registration_no: string } | null }>

      const total = refs.length
      const credited = refs.filter(r => r.status === 'credited').length
      const pending = refs.filter(r => r.status === 'pending').length
      const clawedBack = refs.filter(r => r.status === 'clawed_back').length
      const totalPaid = refs.filter(r => r.status === 'credited').reduce((s, r) => s + Number(r.commission_amount || 0), 0)
      const pendingWithdrawals = ((wdRes.data ?? []) as { amount: number; status: string }[]).filter(w => w.status === 'requested').reduce((s, w) => s + Number(w.amount), 0)
      const totalEarnings = ((earnRes.data ?? []) as { amount: number; type: string }[]).filter(e => e.type === 'credit').reduce((s, e) => s + Number(e.amount), 0)
      setStats({ total, credited, pending, clawedBack, totalPaid, pendingWithdrawals, totalEarnings })

      // Top referrers
      const groupMap = new Map<string, { name: string; reg: string; count: number; earned: number }>()
      for (const r of refs) {
        if (r.status !== 'credited' || !r.referrer_student) continue
        const k = r.referrer_student.id
        const cur = groupMap.get(k) ?? { name: r.referrer_student.name, reg: r.referrer_student.registration_no, count: 0, earned: 0 }
        cur.count += 1
        cur.earned += Number(r.commission_amount || 0)
        groupMap.set(k, cur)
      }
      setTopRefs(Array.from(groupMap.entries())
        .map(([student_id, v]) => ({ student_id, ...v }))
        .sort((a, b) => b.earned - a.earned)
        .slice(0, 5))
    } catch (e) { console.error(e); toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI icon={Users2}      label="Total Referrals"    value={String(stats.total)}     tone="blue" />
        <KPI icon={CheckCircle2} label="Credited"           value={String(stats.credited)} tone="green" />
        <KPI icon={Clock}        label="Pending"            value={String(stats.pending)}  tone="amber" />
        <KPI icon={RotateCcw}    label="Clawed Back"        value={String(stats.clawedBack)} tone="red" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI icon={IndianRupee} label="Total Commissions Paid" value={formatINR(stats.totalPaid)} tone="green" />
        <KPI icon={IndianRupee} label="Total Wallet Earnings"  value={formatINR(stats.totalEarnings)} tone="blue" />
        <KPI icon={Send}        label="Pending Withdrawals"    value={formatINR(stats.pendingWithdrawals)} tone="amber" />
      </div>

      <div className="rounded-xl border bg-white">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-500" />
          <p className="text-sm font-semibold text-gray-800">Top Referrers</p>
        </div>
        {topRefs.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">No credited referrals yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {topRefs.map((r, i) => (
              <div key={r.student_id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-7 w-7 rounded-full bg-red-50 text-red-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{r.reg}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-green-600">{formatINR(r.earned)}</p>
                  <p className="text-[11px] text-gray-400">{r.count} {r.count === 1 ? 'referral' : 'referrals'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── All Referrals tab ───────────────────────────────────────────────────────

function ReferralsTab() {
  const { user } = useAuth()
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralRow['status']>('all')
  const [levelFilter, setLevelFilter] = useState<'all' | 1 | 2>('all')
  const [reverseTarget, setReverseTarget] = useState<ReferralRow | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)
  const [clawbackWindowDays, setClawbackWindowDays] = useState(7)

  useEffect(() => {
    void load()
    void supabase.from('uce_site_settings').select('value').eq('key', 'referral_clawback_window_days').maybeSingle()
      .then(r => { if (r.data) setClawbackWindowDays(parseInt((r.data as { value: string }).value) || 7) })
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('uce_referrals')
      .select(`id, level, status, commission_amount, credited_at, created_at,
        referrer_student:uce_students!uce_referrals_referrer_student_id_fkey(name, registration_no),
        referee_student:uce_students!uce_referrals_referee_student_id_fkey(name, registration_no),
        referee_inquiry:uce_inquiries!uce_referrals_referee_inquiry_id_fkey(full_name, phone)`)
      .order('created_at', { ascending: false })
      .limit(500)
    setRows((data ?? []) as unknown as ReferralRow[])
    setLoading(false)
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (levelFilter !== 'all' && r.level !== levelFilter) return false
    return true
  }), [rows, statusFilter, levelFilter])

  function isWithinClawback(r: ReferralRow): boolean {
    if (r.status !== 'credited' || !r.credited_at) return false
    const ageMs = Date.now() - new Date(r.credited_at).getTime()
    return ageMs <= clawbackWindowDays * 24 * 60 * 60 * 1000
  }

  async function reverse() {
    if (!reverseTarget) return
    setReverseLoading(true)
    const { error } = await supabase.from('uce_referrals').update({
      status: 'clawed_back',
      reversed_at: new Date().toISOString(),
      reversal_reason: reverseReason.trim() || null,
      reversed_by: user?.id ?? null,
    }).eq('id', reverseTarget.id)
    setReverseLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Referral reversed; commission clawed back')
    setReverseTarget(null); setReverseReason('')
    void load()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-500 mr-1">Status:</span>
        {(['all','pending','credited','clawed_back','rejected'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border',
              statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
        <span className="text-xs font-semibold text-gray-500 ml-2 mr-1">Level:</span>
        {(['all', 1, 2] as const).map(l => (
          <button key={l} onClick={() => setLevelFilter(l)}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border',
              levelFilter === l ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}>{l === 'all' ? 'All' : `L${l}`}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No referrals match.</p>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filtered.map(r => {
              const refereeName = r.referee_student?.name ?? r.referee_inquiry?.full_name ?? '(lead)'
              const refereeReg  = r.referee_student?.registration_no ?? r.referee_inquiry?.phone ?? ''
              const canReverse  = isWithinClawback(r)
              return (
                <div key={r.id} className="px-3 py-3 flex items-center gap-3">
                  <StatusPill status={r.status} />
                  <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider">Referrer (L{r.level})</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{r.referrer_student?.name ?? '—'}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{r.referrer_student?.registration_no ?? ''}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider">Referee</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{refereeName}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{refereeReg}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-sm font-bold',
                      r.status === 'credited' ? 'text-green-600' :
                      r.status === 'clawed_back' ? 'text-red-500 line-through' : 'text-gray-700')}>
                      {formatINR(r.commission_amount)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  {canReverse && (
                    <button onClick={() => setReverseTarget(r)} title="Reverse (within clawback window)"
                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 shrink-0">
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal open={!!reverseTarget} onClose={() => setReverseTarget(null)} title="Reverse Commission" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            This will mark the referral as <strong>clawed back</strong> and post a reversal entry to the referrer's wallet
            (–{formatINR(reverseTarget?.commission_amount ?? 0)}).
          </p>
          <FormField label="Reason (recorded for audit)">
            <textarea value={reverseReason} onChange={e => setReverseReason(e.target.value)}
              rows={2} className={`${inputClass} resize-none`} placeholder="e.g. Fake fee receipt detected" />
          </FormField>
          <div className="flex gap-2">
            <button onClick={() => setReverseTarget(null)} className="flex-1 px-3 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={reverse} disabled={reverseLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {reverseLoading && <Loader2 size={13} className="animate-spin" />} Reverse
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Withdrawals tab ─────────────────────────────────────────────────────────

function WithdrawalsTab() {
  const { user } = useAuth()
  const [rows, setRows] = useState<WithdrawalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | WithdrawalRow['status']>('requested')

  const [payTarget, setPayTarget] = useState<WithdrawalRow | null>(null)
  const [utr, setUtr] = useState('')
  const [paying, setPaying] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('uce_referral_withdrawals')
      .select(`*, student:uce_students!uce_referral_withdrawals_student_id_fkey(name, registration_no, phone)`)
      .order('created_at', { ascending: false })
      .limit(200)
    setRows((data ?? []) as unknown as WithdrawalRow[])
    setLoading(false)
  }

  const filtered = useMemo(() => rows.filter(r => statusFilter === 'all' ? true : r.status === statusFilter), [rows, statusFilter])

  async function markPaid() {
    if (!payTarget) return
    if (!utr.trim()) { toast.error('UTR/transaction ref is required'); return }
    setPaying(true)
    const { error } = await supabase.from('uce_referral_withdrawals').update({
      status: 'paid', utr_or_ref: utr.trim(), paid_at: new Date().toISOString(), paid_by: user?.id ?? null,
    }).eq('id', payTarget.id)
    setPaying(false)
    if (error) { toast.error(error.message); return }
    toast.success('Marked as paid')
    setPayTarget(null); setUtr('')
    void load()
  }

  async function reject() {
    if (!rejectTarget) return
    setRejecting(true)
    const { error } = await supabase.from('uce_referral_withdrawals').update({
      status: 'rejected', rejection_reason: rejectReason.trim() || null,
    }).eq('id', rejectTarget.id)
    setRejecting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Request rejected')
    setRejectTarget(null); setRejectReason('')
    void load()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-500 mr-1">Status:</span>
        {(['requested', 'paid', 'rejected', 'all'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border capitalize',
              statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">No withdrawals.</p>
      ) : (
        <div className="rounded-xl border divide-y divide-gray-100">
          {filtered.map(r => (
            <div key={r.id} className="px-3 py-3 flex items-center gap-3">
              <WithdrawalStatusPill status={r.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.student?.name ?? '—'}</p>
                  <span className="text-[10px] text-gray-400 font-mono">{r.student?.registration_no}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  UPI: <span className="font-mono">{r.upi_id}</span>
                  {r.bank_account_no && <> · A/c {r.bank_account_no} ({r.bank_ifsc})</>}
                </p>
                {r.utr_or_ref && <p className="text-[11px] text-gray-400">UTR: {r.utr_or_ref}</p>}
                {r.rejection_reason && <p className="text-[11px] text-red-500">Reason: {r.rejection_reason}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">{formatINR(r.amount)}</p>
                <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
              </div>
              {r.status === 'requested' && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setPayTarget(r)} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Mark Paid">
                    <CheckCircle2 size={15} />
                  </button>
                  <button onClick={() => setRejectTarget(r)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Reject">
                    <XCircle size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title="Mark Withdrawal Paid" size="sm">
        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 border">
            <p className="text-xs text-gray-500">Amount</p>
            <p className="text-lg font-bold">{formatINR(payTarget?.amount ?? 0)}</p>
            <p className="text-[11px] text-gray-500 mt-1">UPI: <span className="font-mono">{payTarget?.upi_id}</span></p>
          </div>
          <FormField label="UTR / Transaction reference" required>
            <input value={utr} onChange={e => setUtr(e.target.value)} className={inputClass} placeholder="UTR123456789" />
          </FormField>
          <div className="flex gap-2">
            <button onClick={() => setPayTarget(null)} className="flex-1 px-3 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={markPaid} disabled={paying}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {paying && <Loader2 size={13} className="animate-spin" />} Mark Paid
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Withdrawal?" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">This rejects the withdrawal request without debiting the wallet. Student can request again.</p>
          <FormField label="Reason (optional)">
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={2} className={`${inputClass} resize-none`} placeholder="e.g. UPI ID looks invalid" />
          </FormField>
          <div className="flex gap-2">
            <button onClick={() => setRejectTarget(null)} className="flex-1 px-3 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={reject} disabled={rejecting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {rejecting && <Loader2 size={13} className="animate-spin" />} Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Settings tab ────────────────────────────────────────────────────────────

function SettingsTab() {
  const [s, setS] = useState<SiteSettings | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { void getSiteSettings().then(setS).catch(() => toast.error('Failed to load')) }, [])

  function up<K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) {
    setS(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function save() {
    if (!s) return
    setSaving(true)
    try { await saveSiteSettings(s); toast.success('Settings saved') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (!s) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        These settings control how the referral system behaves. Changes take effect immediately.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="L1 Commission (₹)" hint="Direct referral">
          <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
            <input type="number" min={0} value={s.referral_l1_amount} onChange={e => up('referral_l1_amount', e.target.value)} className={`${inputClass} pl-7`} /></div>
        </FormField>
        <FormField label="L2 Commission (₹)" hint="Indirect (grand-referrer)">
          <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
            <input type="number" min={0} value={s.referral_l2_amount} onChange={e => up('referral_l2_amount', e.target.value)} className={`${inputClass} pl-7`} /></div>
        </FormField>
      </div>
      <FormField label="Minimum Withdrawal (₹)">
        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
          <input type="number" min={0} value={s.referral_min_withdrawal} onChange={e => up('referral_min_withdrawal', e.target.value)} className={`${inputClass} pl-7 w-48`} /></div>
      </FormField>
      <FormField label="Clawback Window (days)" hint="How long after credit can the admin reverse">
        <input type="number" min={0} value={s.referral_clawback_window_days} onChange={e => up('referral_clawback_window_days', e.target.value)} className={`${inputClass} w-48`} />
      </FormField>
      <FormField label="Public Share Base URL" hint="Used for the share link in student panel">
        <input value={s.referral_share_base_url} onChange={e => up('referral_share_base_url', e.target.value)} className={inputClass} placeholder="https://unskillseducation.org" />
      </FormField>
      <div className="flex gap-3 pt-1">
        <Toggle checked={s.referral_enabled === 'true'} onChange={v => up('referral_enabled', v ? 'true' : 'false')} label="Referral system enabled" />
        <Toggle checked={s.referral_l2_enabled === 'true'} onChange={v => up('referral_l2_enabled', v ? 'true' : 'false')} label="Level 2 commission enabled" />
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function KPI({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'red' }) {
  const toneCls =
    tone === 'blue'  ? 'bg-blue-50 text-blue-700 border-blue-200' :
    tone === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
    tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                       'bg-red-50 text-red-700 border-red-200'
  return (
    <div className={`rounded-xl border ${toneCls} p-3 sm:p-4`}>
      <div className="flex items-center gap-1.5 opacity-80">
        <Icon size={14} />
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1 font-heading text-base sm:text-xl font-bold">{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: ReferralRow['status'] }) {
  const map = {
    pending:     { Icon: Clock,       cls: 'bg-amber-50 text-amber-700' },
    credited:    { Icon: CheckCircle2, cls: 'bg-green-50 text-green-700' },
    clawed_back: { Icon: RotateCcw,    cls: 'bg-red-50 text-red-600' },
    rejected:    { Icon: XCircle,      cls: 'bg-gray-50 text-gray-500' },
  }[status]
  const Icon = map.Icon
  return <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0', map.cls)}><Icon size={13} /></div>
}

function WithdrawalStatusPill({ status }: { status: WithdrawalRow['status'] }) {
  const map = {
    requested: { Icon: Clock,        cls: 'bg-amber-50 text-amber-700' },
    paid:      { Icon: CheckCircle2, cls: 'bg-green-50 text-green-700' },
    rejected:  { Icon: XCircle,      cls: 'bg-gray-50 text-gray-500' },
  }[status]
  const Icon = map.Icon
  return <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0', map.cls)}><Icon size={13} /></div>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
      <span className={cn('w-9 h-5 rounded-full relative transition-colors', checked ? 'bg-red-600' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="hidden" />
      <span className="font-medium text-gray-700">{label}</span>
    </label>
  )
}
