import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Download, IndianRupee, Loader2, Send, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'
import { downloadFeeReceipt } from '../../lib/pdf/fee-receipt'

interface Payment {
  id: string; amount: number; payment_date: string; payment_mode: string | null
  receipt_no: string | null; note: string | null; status: string
  student_reference: string | null
  is_adjustment: boolean
}
interface Account {
  id: string; type: string; upi_id: string | null; bank_name: string | null
  account_holder: string | null; account_number: string | null; ifsc: string | null
  is_default: boolean
}

export default function StudentFeesPage() {
  const { rec } = useStudentRecord()
  const [pays, setPays] = useState<Payment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [mode, setMode] = useState('upi')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!rec) return
    const { data: p } = await supabase.from('uce_student_fee_payments')
      .select('id,amount,payment_date,payment_mode,receipt_no,note,status,student_reference,is_adjustment')
      .eq('student_id', rec.id)
      .order('payment_date', { ascending: false })
    setPays((p ?? []) as Payment[])
    const { data: a } = await supabase.from('uce_branch_payment_accounts')
      .select('id,type,upi_id,bank_name,account_holder,account_number,ifsc,is_default')
      .eq('branch_id', rec.branch_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
    setAccounts((a ?? []) as Account[])
  }, [rec])

  useEffect(() => { load() }, [load])

  if (!rec) return null
  const paid = pays.filter(p => !p.is_adjustment && p.status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0)
  const pending = pays.filter(p => p.status === 'pending_confirmation').reduce((s, p) => s + Number(p.amount), 0)
  const due = Math.max(0, rec.net_fee - paid)

  async function submitPayment() {
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter amount')
    setSaving(true)
    const { error } = await supabase.from('uce_student_fee_payments').insert({
      student_id: rec!.id, branch_id: rec!.branch_id, amount: amt,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_mode: mode, student_reference: ref.trim() || null, note: note.trim() || null,
      status: 'pending_confirmation',
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Submitted — your institute will confirm the payment')
    setModalOpen(false)
    setAmount(''); setRef(''); setNote('')
    load()
  }

  async function download(p: Payment) {
    if (!rec) return
    const { data: r } = await supabase.from('uce_fee_receipts').select('receipt_no').eq('payment_id', p.id).maybeSingle()
    const receiptNo = r?.receipt_no || p.receipt_no || p.id.slice(0, 8).toUpperCase()
    try {
      await downloadFeeReceipt({
        receiptNo,
        date: p.payment_date,
        amount: Number(p.amount),
        mode: p.payment_mode || 'N/A',
        note: p.note || '',
        student: { name: rec.name, registration_no: rec.registration_no, father_name: rec.father_name, course: rec.course?.name ?? '' },
        branch: { name: rec.branch?.name ?? '', code: rec.branch?.code ?? '', phone: rec.branch?.director_phone ?? '' },
      })
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Total Fee" value={formatINR(rec.net_fee)} tone="blue" />
        <Stat label="Paid" value={formatINR(paid)} tone="green" />
        <Stat label="Due" value={formatINR(due)} tone="red" />
      </div>
      {pending > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {formatINR(pending)} is awaiting confirmation by your institute.
        </div>
      )}

      {due > 0 && (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">Pay Online</p>
              <p className="text-xs text-gray-500">Pay via UPI / bank then enter your reference below.</p>
            </div>
            <button onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
              <Send size={14} /> I've Paid
            </button>
          </div>
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map(a => (
                <div key={a.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                  <span className="inline-flex px-2 py-0.5 rounded bg-white border text-xs font-semibold uppercase mr-2">{a.type}</span>
                  {a.type === 'upi' ? <span className="font-mono break-all">{a.upi_id}</span> : (
                    <span className="break-words"><b>{a.bank_name}</b> · {a.account_holder} · A/C {a.account_number} · IFSC {a.ifsc}</span>
                  )}
                  {a.is_default && <span className="ml-2 text-xs text-green-700 font-semibold">(Default)</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Your institute hasn't set up payment details yet.</p>
          )}
        </div>
      )}

      <div>
        <p className="font-semibold mb-2 text-sm">Payment History</p>
        <div className="rounded-xl border bg-white divide-y">
          {pays.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No payments yet.</div>
          ) : pays.map(p => (
            <div key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{formatINR(p.amount)}</span>
                  <StatusPill status={p.status} />
                  {p.is_adjustment && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">adj</span>}
                </div>
                <p className="text-xs text-gray-500 capitalize">{p.payment_mode?.replace('_', ' ')} · {formatDateDDMMYYYY(p.payment_date)}{p.student_reference && ` · ref ${p.student_reference}`}</p>
              </div>
              {p.status === 'confirmed' && !p.is_adjustment && (
                <button onClick={() => download(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-gray-50">
                  <Download size={12} /> Receipt
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit Payment">
        <div className="space-y-3">
          <FormField label="Amount Paid" required>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputClass} pl-8`} />
            </div>
          </FormField>
          <FormField label="Payment Mode">
            <select value={mode} onChange={e => setMode(e.target.value)} className={inputClass}>
              <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
              <option value="neft">NEFT</option><option value="imps">IMPS</option>
              <option value="cash">Cash</option><option value="other">Other</option>
            </select>
          </FormField>
          <FormField label="Transaction ID / UTR" hint="Optional — enter if you have it">
            <input value={ref} onChange={e => setRef(e.target.value)} className={inputClass} placeholder="Optional" />
          </FormField>
          <FormField label="Note">
            <input value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="Optional" />
          </FormField>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={submitPayment} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit
            </button>
          </div>
        </div>
      </Modal>
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

function StatusPill({ status }: { status: string }) {
  if (status === 'confirmed') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-semibold"><CheckCircle2 size={10} /> CONFIRMED</span>
  if (status === 'pending_confirmation') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold"><Clock size={10} /> PENDING</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-semibold"><XCircle size={10} /> REJECTED</span>
}
