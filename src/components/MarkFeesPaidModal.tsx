import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, IndianRupee, CalendarDays, CheckCircle2, AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import FormField, { inputClass } from './FormField'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatINR } from '../lib/utils'

interface Sched { id: string; month_for: string; expected_amount: number; paid: number }

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  student: {
    id: string
    name: string
    registration_no: string
    branch_id: string
    monthly_fee?: number | null
  } | null
}

const MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'] as const

function chipLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MarkFeesPaidModal({ open, onClose, onSaved, student }: Props) {
  const { user } = useAuth()
  const [sched, setSched] = useState<Sched[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<string>('cash')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open || !student) return
    setPickedId(null); setAmount(''); setNote(''); setDate(new Date().toISOString().slice(0, 10)); setMode('cash')
    setLoading(true)
    ;(async () => {
      const [{ data: schedRows }, { data: payRows }] = await Promise.all([
        supabase.from('uce_student_fee_schedule')
          .select('id, month_for, expected_amount').eq('student_id', student.id).order('month_for'),
        supabase.from('uce_student_fee_payments')
          .select('schedule_id, amount, status, is_adjustment').eq('student_id', student.id),
      ])
      const paidBySched: Record<string, number> = {}
      ;(payRows ?? []).forEach(p => {
        if (p.is_adjustment || p.status === 'rejected' || !p.schedule_id) return
        paidBySched[p.schedule_id] = (paidBySched[p.schedule_id] || 0) + Number(p.amount || 0)
      })
      const list: Sched[] = (schedRows ?? []).map(r => ({
        id: r.id as string,
        month_for: r.month_for as string,
        expected_amount: Number(r.expected_amount || 0),
        paid: paidBySched[r.id as string] || 0,
      }))
      setSched(list)
      // Auto-pick the first unpaid month
      const today = new Date().toISOString().slice(0, 10)
      const firstDue =
        list.find(r => r.expected_amount > r.paid && r.month_for <= today) ||
        list.find(r => r.expected_amount > r.paid)
      if (firstDue) {
        setPickedId(firstDue.id)
        const due = Math.max(0, firstDue.expected_amount - firstDue.paid)
        setAmount(String(due))
      } else if (student.monthly_fee) {
        setAmount(String(student.monthly_fee))
      }
      setLoading(false)
    })()
  }, [open, student])

  function pickMonth(r: Sched) {
    const due = Math.max(0, r.expected_amount - r.paid)
    if (due <= 0) return
    setPickedId(r.id)
    setAmount(String(due))
  }

  async function save() {
    if (!student) return
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter amount')
    setSaving(true)
    try {
      let receipt: string | null = null
      const { data: rcpt } = await supabase.rpc('fn_next_receipt_no', { p_branch_id: student.branch_id })
      if (rcpt) receipt = rcpt as unknown as string
      const { error } = await supabase.from('uce_student_fee_payments').insert({
        student_id: student.id,
        branch_id: student.branch_id,
        amount: amt,
        payment_date: date,
        payment_mode: mode,
        receipt_no: receipt,
        note: note || null,
        recorded_by: user?.id || null,
        is_adjustment: false,
        adjustment_reason: null,
        schedule_id: pickedId,
        status: 'confirmed',
      })
      if (error) throw error
      toast.success('Fees marked as paid')
      onSaved?.()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <Modal open={open} onClose={() => { if (!saving) onClose() }} title="Mark Fees Paid" size="md">
      {!student ? null : (
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-gray-600">Student</p>
            <p className="font-semibold">{student.name} <span className="font-mono text-xs text-gray-500">{student.registration_no}</span></p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays size={14} className="text-red-600" />
              <p className="text-sm font-semibold">Pick the month being paid for</p>
            </div>
            {loading ? (
              <p className="text-xs text-gray-400 py-3">Loading schedule…</p>
            ) : sched.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                No fee plan set yet. Set a Start Date + Installments first from the fee detail page.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {sched.map(r => {
                  const due = Math.max(0, r.expected_amount - r.paid)
                  const fullyPaid = due <= 0
                  const partial = !fullyPaid && r.paid > 0
                  const overdue = !fullyPaid && r.month_for <= todayIso
                  const picked = pickedId === r.id
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
                    <button key={r.id} type="button" onClick={() => pickMonth(r)}
                      className={`text-[11px] rounded-md border px-2.5 py-1 font-medium ${classes}`}>
                      {chipLabel(r.month_for)} · {formatINR(fullyPaid ? r.expected_amount : due)}
                      {fullyPaid && <CheckCircle2 size={10} className="inline ml-1" />}
                      {overdue && !fullyPaid && !picked && <AlertTriangle size={10} className="inline ml-1" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

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
            <FormField label="Mode">
              <select value={mode} onChange={e => setMode(e.target.value)} className={inputClass}>
                {MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </FormField>
            <FormField label="Note">
              <input value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="Optional" />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { if (!saving) onClose() }} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={save} disabled={saving || !amount}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Confirm Paid
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
