import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, AlertTriangle, IndianRupee, Download, CalendarDays, Plus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { formatINR, formatDateDDMMYYYY } from '../../../lib/utils'
import FormField, { inputClass } from '../../../components/FormField'
import { downloadFeeReceipt } from '../../../lib/pdf/fee-receipt'

interface StudentDetail {
  id: string; name: string; registration_no: string; father_name: string
  net_fee: number; fee_start_month: string | null; installment_count: number | null; monthly_fee: number | null
  branch_id: string
  course: { name: string } | null
  branch: { name: string; code: string; director_phone: string; society_name: string | null; registration_number: string | null; center_logo_url: string | null; address_line1: string | null; village: string | null; district: string; state: string; pincode: string | null } | null
}

interface Sched { id: string; month_for: string; expected_amount: number; paid: number }
interface Pay { id: string; amount: number; payment_date: string; payment_mode: string | null; receipt_no: string | null; note: string | null; is_adjustment: boolean; status: string; schedule_id: string | null }

const MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'] as const

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminStudentFeePlanPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user } = useAuth()
  const [rec, setRec] = useState<StudentDetail | null>(null)
  const [sched, setSched] = useState<Sched[]>([])
  const [pays, setPays] = useState<Pay[]>([])
  const [saving, setSaving] = useState(false)
  // Plan: full ISO date (YYYY-MM-DD) — start day-of-month is now configurable
  const [startDate, setStartDate] = useState('')
  const [installments, setInstallments] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  // Collect Fee state
  const [pickedMonths, setPickedMonths] = useState<Set<string>>(new Set())
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState<string>('cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payReceipt, setPayReceipt] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payIsAdj, setPayIsAdj] = useState(false)
  const [payAdjReason, setPayAdjReason] = useState('')
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string; type: string; upi_id: string | null; bank_name: string | null; is_default: boolean }>>([])
  const [accountId, setAccountId] = useState<string>('')
  const [collecting, setCollecting] = useState(false)

  const load = useCallback(async () => {
    if (!studentId) return
    const { data: st } = await supabase.from('uce_students')
      .select('id,name,registration_no,father_name,net_fee,fee_start_month,installment_count,monthly_fee,branch_id,course:uce_courses(name),branch:uce_branches!uce_students_branch_id_fkey(name,code,director_phone,society_name,registration_number,center_logo_url,address_line1,village,district,state,pincode)')
      .eq('id', studentId).maybeSingle()
    setRec(st as unknown as StudentDetail | null)
    if (st) {
      setStartDate(st.fee_start_month ? String(st.fee_start_month).slice(0, 10) : '')
      setInstallments(st.installment_count ? String(st.installment_count) : '')
      setMonthlyFee(st.monthly_fee ? String(st.monthly_fee) : '')
    }
    const [schedRes, payRes] = await Promise.all([
      supabase.from('uce_student_fee_schedule').select('id,month_for,expected_amount').eq('student_id', studentId).order('month_for'),
      supabase.from('uce_student_fee_payments').select('id,amount,payment_date,payment_mode,receipt_no,note,is_adjustment,status,schedule_id').eq('student_id', studentId).order('payment_date', { ascending: false }),
    ])
    const paysList = (payRes.data ?? []) as Pay[]
    const paidBySched: Record<string, number> = {}
    paysList.forEach(p => {
      if (p.is_adjustment || p.status === 'rejected') return
      if (p.schedule_id) paidBySched[p.schedule_id] = (paidBySched[p.schedule_id] || 0) + Number(p.amount)
    })
    setSched((schedRes.data ?? []).map(r => ({
      id: r.id as string,
      month_for: r.month_for as string,
      expected_amount: Number(r.expected_amount),
      paid: paidBySched[r.id as string] || 0,
    })))
    setPays(paysList)
  }, [studentId])

  useEffect(() => { void load() }, [load])

  // Load branch payment accounts (for default deposit account in collect)
  useEffect(() => {
    if (!rec?.branch_id) return
    supabase.from('uce_branch_payment_accounts').select('id,label,type,upi_id,bank_name,is_default')
      .eq('branch_id', rec.branch_id).eq('is_active', true)
      .then(({ data }) => {
        const list = (data ?? []) as typeof accounts
        setAccounts(list)
        const def = list.find(a => a.is_default)
        if (def) setAccountId(def.id)
      })
  }, [rec?.branch_id])

  // Auto-fill amount from picked months
  useEffect(() => {
    if (pickedMonths.size === 0) return
    const total = sched
      .filter(r => pickedMonths.has(r.id))
      .reduce((s, r) => s + Math.max(0, r.expected_amount - r.paid), 0)
    if (total > 0) setPayAmount(String(total))
  }, [pickedMonths, sched])

  function togglePick(id: string, fullyPaid: boolean) {
    if (fullyPaid) return
    setPickedMonths(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function savePlan() {
    if (!rec) return
    setSaving(true)
    const payload = {
      // Save full ISO date — schedule RPC now anchors on this exact day-of-month
      fee_start_month: startDate || null,
      installment_count: installments && Number(installments) > 0 ? Number(installments) : null,
      monthly_fee: monthlyFee && Number(monthlyFee) > 0 ? Number(monthlyFee) : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('uce_students').update(payload).eq('id', rec.id)
    if (error) { setSaving(false); toast.error(error.message); return }
    await supabase.rpc('fn_generate_fee_schedule', { p_student_id: rec.id })
    await load()
    setSaving(false)
    toast.success('Plan saved & schedule regenerated')
  }

  async function collectFee() {
    if (!rec) return
    const amt = Number(payAmount)
    if (!amt || amt <= 0) return toast.error('Enter amount')
    if (payIsAdj && !payAdjReason.trim()) return toast.error('Adjustment reason required')
    setCollecting(true)
    try {
      let resolvedReceipt = payReceipt.trim() || null
      if (!resolvedReceipt && !payIsAdj) {
        const { data: rcpt } = await supabase.rpc('fn_next_receipt_no', { p_branch_id: rec.branch_id })
        if (rcpt) resolvedReceipt = rcpt as unknown as string
      }
      const picks = Array.from(pickedMonths)
      if (picks.length > 1) {
        const rows = picks.map(schedId => {
          const r = sched.find(x => x.id === schedId)!
          return {
            student_id: rec.id, branch_id: rec.branch_id,
            amount: Math.max(0, r.expected_amount - r.paid),
            payment_date: payDate, payment_mode: payMode,
            receipt_no: resolvedReceipt,
            note: payNote || null, recorded_by: user?.id || null,
            is_adjustment: false, adjustment_reason: null,
            payment_account_id: accountId || null,
            schedule_id: r.id, status: 'confirmed',
          }
        }).filter(r => r.amount > 0)
        if (rows.length === 0) { toast.error('Selected months are already fully paid'); setCollecting(false); return }
        const { error } = await supabase.from('uce_student_fee_payments').insert(rows)
        if (error) throw error
      } else {
        const schedId = picks[0] || null
        const { error } = await supabase.from('uce_student_fee_payments').insert({
          student_id: rec.id, branch_id: rec.branch_id,
          amount: amt, payment_date: payDate, payment_mode: payMode,
          receipt_no: resolvedReceipt,
          note: payNote || null, recorded_by: user?.id || null,
          is_adjustment: payIsAdj, adjustment_reason: payIsAdj ? payAdjReason : null,
          payment_account_id: accountId || null,
          schedule_id: schedId, status: 'confirmed',
        })
        if (error) throw error
      }
      toast.success('Payment recorded')
      setPayAmount(''); setPayReceipt(''); setPayNote(''); setPayIsAdj(false); setPayAdjReason('')
      setPickedMonths(new Set())
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCollecting(false)
    }
  }

  async function downloadReceipt(p: Pay) {
    if (!rec || p.is_adjustment) return
    setDownloading(p.id)
    try {
      const monthIso = p.schedule_id ? sched.find(s => s.id === p.schedule_id)?.month_for : undefined
      await downloadFeeReceipt({
        receiptNo: p.receipt_no || p.id.slice(0, 8).toUpperCase(),
        date: p.payment_date, amount: Number(p.amount),
        mode: p.payment_mode || 'N/A', note: p.note || '',
        monthsPaid: monthIso ? [monthLabel(monthIso)] : undefined,
        student: { name: rec.name, registration_no: rec.registration_no, father_name: rec.father_name, course: rec.course?.name || '' },
        branch: {
          name: rec.branch?.name || '', code: rec.branch?.code || '', phone: rec.branch?.director_phone || '',
          address: [rec.branch?.address_line1, rec.branch?.village, rec.branch?.district, rec.branch?.state, rec.branch?.pincode].filter(Boolean).join(', '),
          society_name: rec.branch?.society_name || null,
          registration_number: rec.branch?.registration_number || null,
          logo_url: rec.branch?.center_logo_url || null,
        },
      })
    } catch (e) { toast.error((e as Error).message) }
    finally { setDownloading(null) }
  }

  if (!rec) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  const totalPaid = pays.filter(p => !p.is_adjustment && p.status !== 'rejected').reduce((s, p) => s + Number(p.amount), 0)
  const due = Math.max(0, Number(rec.net_fee) - totalPaid)
  const pickedTotalDue = sched
    .filter(r => pickedMonths.has(r.id))
    .reduce((s, r) => s + Math.max(0, r.expected_amount - r.paid), 0)

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/admin/fees" className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">{rec.name}</h1>
          <p className="text-xs text-gray-500 font-mono">{rec.registration_no} · {rec.branch?.name} · {rec.course?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Net Fee" value={formatINR(rec.net_fee)} tone="blue" />
        <Stat label="Paid" value={formatINR(totalPaid)} tone="green" />
        <Stat label="Due" value={formatINR(due)} tone="red" />
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center gap-2"><IndianRupee size={16} className="text-red-600" /><p className="font-semibold">Fee Plan</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Start Date" hint="Pick the exact billing day, e.g. 16 May">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Installments">
            <input type="number" min={0} value={installments} onChange={e => setInstallments(e.target.value)} className={inputClass} placeholder="e.g. 12" />
          </FormField>
          <FormField label="Monthly Fee (₹)" hint="Leave blank to auto-split">
            <input type="number" min={0} value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className={inputClass} placeholder="auto" />
          </FormField>
        </div>
        <div className="flex justify-end">
          <button onClick={savePlan} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Save & Regenerate Schedule
          </button>
        </div>
      </div>

      {sched.length > 0 && (
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center gap-2"><CalendarDays size={16} className="text-red-600" /><p className="font-semibold">Monthly Schedule</p>
            <span className="text-[11px] text-gray-500 ml-auto">Tap a month to collect it</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sched.map(r => {
              const dueAmt = Math.max(0, r.expected_amount - r.paid)
              const fullyPaid = dueAmt <= 0
              const partial = !fullyPaid && r.paid > 0
              const overdue = !fullyPaid && r.month_for <= new Date().toISOString().slice(0, 10)
              const picked = pickedMonths.has(r.id)
              const classes = fullyPaid
                ? 'bg-green-50 border-green-300 text-green-700 cursor-default'
                : picked
                  ? 'bg-red-600 border-red-600 text-white'
                  : overdue
                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                    : partial
                      ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
              return (
                <button key={r.id} type="button" onClick={() => togglePick(r.id, fullyPaid)}
                  className={`text-[11px] rounded-md border px-2.5 py-1 font-medium ${classes}`}>
                  {monthLabel(r.month_for)} · {formatINR(fullyPaid ? r.expected_amount : dueAmt)}
                  {fullyPaid && <CheckCircle2 size={10} className="inline ml-1" />}
                  {overdue && !fullyPaid && !picked && <AlertTriangle size={10} className="inline ml-1" />}
                </button>
              )
            })}
          </div>
          {pickedMonths.size > 0 && (
            <p className="text-[11px] text-gray-500">{pickedMonths.size} month{pickedMonths.size > 1 ? 's' : ''} selected · Total due {formatINR(pickedTotalDue)}</p>
          )}
        </div>
      )}

      {/* Collect Fee */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center gap-2"><Plus size={16} className="text-red-600" /><p className="font-semibold">Collect Fee / Mark as Paid</p></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="Amount (₹)" required>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={`${inputClass} pl-8`} />
            </div>
          </FormField>
          <FormField label="Payment Date">
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Mode">
            <select value={payMode} onChange={e => setPayMode(e.target.value)} className={inputClass}>
              {MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </FormField>
          <FormField label="Receipt #" hint="Leave blank to auto-generate">
            <input value={payReceipt} onChange={e => setPayReceipt(e.target.value)} className={inputClass} placeholder="Auto" />
          </FormField>
        </div>
        {accounts.length > 0 && (
          <FormField label="Deposit into account">
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.type.toUpperCase()} — {a.label || a.upi_id || a.bank_name}</option>)}
            </select>
          </FormField>
        )}
        <FormField label="Note">
          <input value={payNote} onChange={e => setPayNote(e.target.value)} className={inputClass} placeholder="Month, installment, etc." />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={payIsAdj} onChange={e => setPayIsAdj(e.target.checked)} />
          <span>This is an <b>old-student adjustment</b> (not part of fresh revenue)</span>
        </label>
        {payIsAdj && (
          <FormField label="Adjustment Reason" required>
            <input value={payAdjReason} onChange={e => setPayAdjReason(e.target.value)} className={inputClass} placeholder="e.g. Old pending balance from 2024" />
          </FormField>
        )}
        <div className="flex justify-end">
          <button onClick={collectFee} disabled={collecting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {collecting && <Loader2 size={16} className="animate-spin" />} Record Payment
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <p className="font-semibold text-sm px-4 pt-4">Payment History</p>
        <div className="divide-y mt-2">
          {pays.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No payments yet.</div>
          ) : pays.map(p => (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold">{formatINR(p.amount)} <span className="text-xs font-normal text-gray-500 capitalize">· {p.payment_mode?.replace('_', ' ')}</span>
                  {p.status === 'pending_confirmation' && <span className="ml-2 text-[10px] uppercase font-bold text-amber-600">Pending</span>}
                  {p.status === 'rejected' && <span className="ml-2 text-[10px] uppercase font-bold text-red-600">Rejected</span>}
                </p>
                <p className="text-xs text-gray-500">{formatDateDDMMYYYY(p.payment_date)}{p.receipt_no && ` · ${p.receipt_no}`}{p.note && ` · ${p.note}`}</p>
              </div>
              {!p.is_adjustment && p.status === 'confirmed' && (
                <button onClick={() => downloadReceipt(p)} disabled={downloading === p.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
                  <Download size={12} /> {downloading === p.id ? '…' : 'Receipt'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'red' }) {
  const c = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  return (
    <div className={`rounded-xl p-3 sm:p-4 ${c}`}>
      <p className="text-[10px] sm:text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 font-heading text-base sm:text-lg font-bold break-words">{value}</p>
    </div>
  )
}
