import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, IndianRupee } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import FormField, { inputClass } from '../../../components/FormField'
import { formatINR } from '../../../lib/utils'

interface StudentLite {
  id: string; name: string; registration_no: string; phone: string
  net_fee: number; paid?: number
}

const MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'other'] as const

export default function FFeeCollectionPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [students, setStudents] = useState<StudentLite[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<StudentLite | null>(null)
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
    supabase.from('uce_students').select('id,name,registration_no,phone,net_fee')
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

  async function save() {
    if (!selected) return toast.error('Select a student')
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter amount')
    if (isAdj && !adjReason.trim()) return toast.error('Adjustment reason required')
    setSaving(true)
    const { error } = await supabase.from('uce_student_fee_payments').insert({
      student_id: selected.id, branch_id: branchId,
      amount: amt, payment_date: date, payment_mode: mode, receipt_no: receipt || null,
      note: note || null, recorded_by: user?.id || null,
      is_adjustment: isAdj, adjustment_reason: isAdj ? adjReason : null,
      payment_account_id: accountId || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Payment recorded')
    setAmount(''); setReceipt(''); setNote(''); setIsAdj(false); setAdjReason('')
  }

  const balance = selected ? Math.max(0, (selected.net_fee || 0) - (selected.paid || 0)) : 0

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
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-gray-600">Selected</p>
            <p className="font-semibold">{selected.name} <span className="font-mono text-xs text-gray-500">{selected.registration_no}</span></p>
            <p className="text-sm">Balance Due: <b className="text-red-700">{formatINR(balance)}</b></p>
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
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="Mode">
              <select value={mode} onChange={e => setMode(e.target.value)} className={inputClass}>
                {MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </FormField>
            <FormField label="Receipt #">
              <input value={receipt} onChange={e => setReceipt(e.target.value)} className={inputClass} placeholder="Optional" />
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
