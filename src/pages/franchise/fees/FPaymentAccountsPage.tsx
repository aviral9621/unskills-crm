import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import Modal from '../../../components/Modal'
import FormField, { inputClass } from '../../../components/FormField'

interface Account {
  id: string; branch_id: string; type: 'upi' | 'bank'; label: string | null
  upi_id: string | null; bank_name: string | null; account_holder: string | null
  account_number: string | null; ifsc: string | null; is_default: boolean; is_active: boolean
}

export default function FPaymentAccountsPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Account[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [type, setType] = useState<'upi' | 'bank'>('upi')
  const [form, setForm] = useState({ label: '', upi_id: '', bank_name: '', account_holder: '', account_number: '', ifsc: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!branchId) return
    const { data } = await supabase.from('uce_branch_payment_accounts').select('*').eq('branch_id', branchId).order('created_at', { ascending: false })
    setRows((data ?? []) as Account[])
  }
  useEffect(() => { load() }, [branchId])

  async function save() {
    if (!branchId) return
    if (type === 'upi' && !form.upi_id) return toast.error('UPI ID required')
    if (type === 'bank' && (!form.account_number || !form.ifsc)) return toast.error('Account number and IFSC required')
    setSaving(true)
    const { error } = await supabase.from('uce_branch_payment_accounts').insert({
      branch_id: branchId, type, ...form,
      label: form.label || null,
      upi_id: type === 'upi' ? form.upi_id : null,
      bank_name: type === 'bank' ? form.bank_name : null,
      account_holder: type === 'bank' ? form.account_holder : null,
      account_number: type === 'bank' ? form.account_number : null,
      ifsc: type === 'bank' ? form.ifsc : null,
      is_default: rows.length === 0,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Payment account added')
    setModalOpen(false)
    setForm({ label: '', upi_id: '', bank_name: '', account_holder: '', account_number: '', ifsc: '' })
    load()
  }

  async function setDefault(id: string) {
    if (!branchId) return
    await supabase.from('uce_branch_payment_accounts').update({ is_default: false }).eq('branch_id', branchId)
    await supabase.from('uce_branch_payment_accounts').update({ is_default: true }).eq('id', id)
    toast.success('Default account updated')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this payment account?')) return
    await supabase.from('uce_branch_payment_accounts').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Payment Accounts</h1>
          <p className="text-sm text-gray-500">UPI / bank details shown to students for direct fee payment</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Add Account
        </button>
      </div>

      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
            No payment accounts yet. Students won't see any payment details — add at least one.
          </div>
        ) : rows.map(a => (
          <div key={a.id} className="rounded-xl border bg-white p-4 flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold uppercase">{a.type}</span>
                {a.is_default && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-semibold"><CheckCircle2 size={11} /> Default</span>}
                {a.label && <span className="text-sm text-gray-600">{a.label}</span>}
              </div>
              {a.type === 'upi' ? (
                <p className="mt-1 font-mono text-sm">{a.upi_id}</p>
              ) : (
                <div className="mt-1 text-sm">
                  <p><b>{a.bank_name}</b> — {a.account_holder}</p>
                  <p className="font-mono text-xs text-gray-500">A/C {a.account_number} · IFSC {a.ifsc}</p>
                </div>
              )}
            </div>
            {!a.is_default && (
              <button onClick={() => setDefault(a.id)} className="text-xs text-red-600 hover:underline">Set default</button>
            )}
            <button onClick={() => remove(a.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Payment Account">
        <div className="space-y-4">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            {(['upi', 'bank'] as const).map(t => (
              <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${type === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <FormField label="Label (optional)">
            <input className={inputClass} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Main branch UPI" />
          </FormField>
          {type === 'upi' ? (
            <FormField label="UPI ID" required>
              <input className={inputClass} value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="name@bank" />
            </FormField>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Bank Name" required><input className={inputClass} value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></FormField>
                <FormField label="Account Holder" required><input className={inputClass} value={form.account_holder} onChange={e => setForm({ ...form, account_holder: e.target.value })} /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Account Number" required><input className={inputClass} value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></FormField>
                <FormField label="IFSC" required><input className={inputClass} value={form.ifsc} onChange={e => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} /></FormField>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
