import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, IndianRupee, Download, CalendarDays } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import FormField, { inputClass } from '../../../components/FormField'
import { formatINR } from '../../../lib/utils'
import { downloadFeeReceipt } from '../../../lib/pdf/fee-receipt'

interface StudentLite {
  id: string; name: string; registration_no: string; phone: string
  net_fee: number; paid?: number
  father_name?: string
  course_id?: string
  fee_start_month?: string | null
  installment_count?: number | null
  monthly_fee?: number | null
}

interface ScheduleRow {
  id: string
  month_for: string
  expected_amount: number
  paid_amount: number // sum of payments for this schedule row
}

const MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'] as const

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default function FFeeCollectionPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [students, setStudents] = useState<StudentLite[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<StudentLite | null>(null)
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [pickedMonths, setPickedMonths] = useState<Set<string>>(new Set())
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<string>('cash')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [receipt, setReceipt] = useState('')
  const [note, setNote] = useState('')
  const [isAdj, setIsAdj] = useState(false)
  const [adjReason, setAdjReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string; type: string; upi_id: string | null; bank_name: string | null; is_default: boolean }>>([])
  const [accountId, setAccountId] = useState<string>('')

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_branch_payment_accounts').select('id,label,type,upi_id,bank_name,is_default').eq('branch_id', branchId).eq('is_active', true)
      .then(({ data }) => {
        const list = (data ?? []) as typeof accounts
        setAccounts(list)
        const def = list.find(a => a.is_default)
        if (def) setAccountId(def.id)
      })
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    const q = search.trim()
    supabase.from('uce_students').select('id,name,registration_no,phone,net_fee,father_name,course_id,fee_start_month,installment_count,monthly_fee')
      .eq('branch_id', branchId)
      .ilike('name', q ? `%${q}%` : '%')
      .limit(20)
      .then(async ({ data }) => {
        const list = (data ?? []) as StudentLite[]
        if (list.length > 0) {
          const { data: pays } = await supabase.from('uce_student_fee_payments').select('student_id,amount').in('student_id', list.map(l => l.id)).eq('is_adjustment', false)
          const map: Record<string, number> = {}
          ;(pays ?? []).forEach(p => { map[p.student_id!] = (map[p.student_id!] || 0) + Number(p.amount) })
          setStudents(list.map(l => ({ ...l, paid: map[l.id] || 0 })))
        } else setStudents([])
      })
  }, [search, branchId])

  // Load schedule + per-month paid breakdown for the selected student
  useEffect(() => {
    setSchedule([]); setPickedMonths(new Set())
    if (!selected) return
    ;(async () => {
      const { data: sched } = await supabase.from('uce_student_fee_schedule')
        .select('id,month_for,expected_amount')
        .eq('student_id', selected.id)
        .order('month_for', { ascending: true })
      const schedRows = (sched ?? []) as { id: string; month_for: string; expected_amount: number }[]
      if (schedRows.length === 0) { setSchedule([]); return }
      const { data: pays } = await supabase.from('uce_student_fee_payments')
        .select('schedule_id,amount,status,is_adjustment')
        .eq('student_id', selected.id)
        .not('schedule_id', 'is', null)
      const paidByScheduleId: Record<string, number> = {}
      ;(pays ?? []).forEach(p => {
        if (!p.schedule_id || p.is_adjustment) return
        if (p.status === 'rejected') return
        paidByScheduleId[p.schedule_id] = (paidByScheduleId[p.schedule_id] || 0) + Number(p.amount)
      })
      setSchedule(schedRows.map(r => ({
        id: r.id,
        month_for: r.month_for,
        expected_amount: Number(r.expected_amount),
        paid_amount: paidByScheduleId[r.id] || 0,
      })))
    })()
  }, [selected])

  // Auto-fill amount based on picked months
  useEffect(() => {
    if (pickedMonths.size === 0) return
    const total = schedule
      .filter(r => pickedMonths.has(r.id))
      .reduce((s, r) => s + Math.max(0, r.expected_amount - r.paid_amount), 0)
    if (total > 0) setAmount(String(total))
  }, [pickedMonths, schedule])

  function togglePick(id: string, fullyPaid: boolean) {
    if (fullyPaid) return
    setPickedMonths(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function save() {
    if (!selected) return toast.error('Select a student')
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter amount')
    if (isAdj && !adjReason.trim()) return toast.error('Adjustment reason required')
    setSaving(true)
    try {
      // Resolve receipt number (auto if blank)
      let resolvedReceipt = receipt.trim() || null
      if (!resolvedReceipt && !isAdj) {
        const { data: rcpt } = await supabase.rpc('fn_next_receipt_no', { p_branch_id: branchId })
        if (rcpt) resolvedReceipt = rcpt as unknown as string
      }

      const picks = Array.from(pickedMonths)
      if (picks.length > 1) {
        // One payment row per month picked (split by expected amount)
        const rows = picks.map(schedId => {
          const r = schedule.find(x => x.id === schedId)!
          return {
            student_id: selected.id, branch_id: branchId,
            amount: Math.max(0, r.expected_amount - r.paid_amount),
            payment_date: date, payment_mode: mode,
            receipt_no: resolvedReceipt,
            note: note || null, recorded_by: user?.id || null,
            is_adjustment: false, adjustment_reason: null,
            payment_account_id: accountId || null,
            schedule_id: r.id,
            status: 'confirmed',
          }
        }).filter(r => r.amount > 0)
        if (rows.length === 0) { toast.error('Selected months are already fully paid'); setSaving(false); return }
        const { error } = await supabase.from('uce_student_fee_payments').insert(rows)
        if (error) throw error
      } else {
        const schedId = picks[0] || null
        const { error } = await supabase.from('uce_student_fee_payments').insert({
          student_id: selected.id, branch_id: branchId,
          amount: amt, payment_date: date, payment_mode: mode,
          receipt_no: resolvedReceipt,
          note: note || null, recorded_by: user?.id || null,
          is_adjustment: isAdj, adjustment_reason: isAdj ? adjReason : null,
          payment_account_id: accountId || null,
          schedule_id: schedId,
          status: isAdj ? 'confirmed' : 'confirmed',
        })
        if (error) throw error
      }
      toast.success('Payment recorded')
      setAmount(''); setReceipt(''); setNote(''); setIsAdj(false); setAdjReason('')
      setPickedMonths(new Set())
      // Refresh schedule view
      if (selected) setSelected({ ...selected })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function downloadLastReceipt() {
    if (!selected) return
    // Fetch the latest confirmed non-adjustment payment for this student (with branch info)
    const { data: p } = await supabase.from('uce_student_fee_payments')
      .select('id,amount,payment_date,payment_mode,receipt_no,note,schedule_id')
      .eq('student_id', selected.id)
      .eq('is_adjustment', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!p) { toast.error('No payments found'); return }
    const { data: br } = await supabase.from('uce_branches')
      .select('name,code,director_phone,society_name,registration_number,center_logo_url,address_line1,village,district,state,pincode')
      .eq('id', branchId).maybeSingle()
    const { data: course } = await supabase.from('uce_courses').select('name').eq('id', selected.course_id!).maybeSingle()
    const { data: sched } = p.schedule_id
      ? await supabase.from('uce_student_fee_schedule').select('month_for').eq('id', p.schedule_id).maybeSingle()
      : { data: null }
    try {
      await downloadFeeReceipt({
        receiptNo: p.receipt_no || p.id.slice(0, 8).toUpperCase(),
        date: p.payment_date,
        amount: Number(p.amount),
        mode: p.payment_mode || 'N/A',
        note: p.note || '',
        monthsPaid: sched ? [monthLabel(sched.month_for as string)] : undefined,
        student: {
          name: selected.name, registration_no: selected.registration_no,
          father_name: selected.father_name || '',
          course: course?.name || '',
        },
        branch: {
          name: br?.name || '', code: br?.code || '', phone: br?.director_phone || '',
          address: [br?.address_line1, br?.village, br?.district, br?.state, br?.pincode].filter(Boolean).join(', '),
          society_name: br?.society_name || null,
          registration_number: br?.registration_number || null,
          logo_url: br?.center_logo_url || null,
        },
      })
    } catch (e) { toast.error((e as Error).message) }
  }

  const balance = selected ? Math.max(0, (selected.net_fee || 0) - (selected.paid || 0)) : 0
  const pickedTotalDue = schedule
    .filter(r => pickedMonths.has(r.id))
    .reduce((s, r) => s + Math.max(0, r.expected_amount - r.paid_amount), 0)

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Collect Fee</h1>
        <p className="text-sm text-gray-500">Record a fee payment from a student.</p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">Search Student</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search by name..." />
        </div>
        <div className="max-h-64 overflow-y-auto divide-y">
          {students.map(s => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={`w-full text-left py-2 px-2 hover:bg-gray-50 ${selected?.id === s.id ? 'bg-red-50' : ''}`}>
              <p className="text-sm font-medium">{s.name} <span className="text-xs text-gray-400 font-mono">{s.registration_no}</span></p>
              <p className="text-xs text-gray-500">Fee {formatINR(s.net_fee)} · Paid {formatINR(s.paid || 0)} · Due {formatINR(Math.max(0, s.net_fee - (s.paid || 0)))}</p>
            </button>
          ))}
          {students.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">No matches</p>}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-600">Selected</p>
              <p className="font-semibold">{selected.name} <span className="font-mono text-xs text-gray-500">{selected.registration_no}</span></p>
              <p className="text-sm">Balance Due: <b className="text-red-700">{formatINR(balance)}</b></p>
            </div>
            <button type="button" onClick={downloadLastReceipt}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white hover:bg-gray-50">
              <Download size={12} /> Last Receipt
            </button>
          </div>

          {schedule.length > 0 && (
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays size={14} className="text-red-600" />
                <p className="text-sm font-semibold">Monthly Plan</p>
                <span className="text-[11px] text-gray-500">Tap a month to collect it</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {schedule.map(r => {
                  const due = Math.max(0, r.expected_amount - r.paid_amount)
                  const fullyPaid = due <= 0
                  const partial = !fullyPaid && r.paid_amount > 0
                  const picked = pickedMonths.has(r.id)
                  const classes = fullyPaid
                    ? 'bg-green-50 border-green-300 text-green-700 cursor-default'
                    : picked
                      ? 'bg-red-600 border-red-600 text-white'
                      : partial
                        ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  return (
                    <button key={r.id} type="button" onClick={() => togglePick(r.id, fullyPaid)}
                      className={`text-[11px] rounded-md border px-2.5 py-1 font-medium ${classes}`}>
                      {monthLabel(r.month_for)}
                      <span className="ml-1 opacity-80">· {formatINR(fullyPaid ? r.expected_amount : due)}</span>
                    </button>
                  )
                })}
              </div>
              {pickedMonths.size > 0 && (
                <p className="text-[11px] text-gray-500 mt-2">{pickedMonths.size} month{pickedMonths.size > 1 ? 's' : ''} selected · Total due {formatINR(pickedTotalDue)}</p>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="Amount (₹)" required>
              <div className="relative">
                <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} pl-8`} />
              </div>
            </FormField>
            <FormField label="Payment Date">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
            </FormField>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="Mode">
              <select value={mode} onChange={e => setMode(e.target.value)} className={inputClass}>
                {MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </FormField>
            <FormField label="Receipt #" hint="Leave blank to auto-generate">
              <input value={receipt} onChange={e => setReceipt(e.target.value)} className={inputClass} placeholder="Auto" />
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
            <input value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="Month, installment, etc." />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isAdj} onChange={e => setIsAdj(e.target.checked)} />
            <span>This is an <b>old-student adjustment</b> (not part of fresh revenue)</span>
          </label>
          {isAdj && (
            <FormField label="Adjustment Reason" required>
              <input value={adjReason} onChange={e => setAdjReason(e.target.value)} className={inputClass} placeholder="e.g. Old pending balance from 2024" />
            </FormField>
          )}

          <div className="flex justify-end">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {saving && <Loader2 size={16} className="animate-spin" />} Record Payment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
