import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Upload } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { uploadPublicFile } from '../../../lib/uploads'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import FormField, { inputClass } from '../../../components/FormField'

export default function FWalletRequestPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const branchId = useBranchId()
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('upi')
  const [txnId, setTxnId] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!branchId) return
    const amt = Number(amount)
    if (!amt || amt <= 0) return toast.error('Enter amount')
    setSaving(true)
    try {
      let screenshotUrl: string | null = null
      if (file) {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase()
        const path = `${branchId}/${Date.now()}.${ext}`
        screenshotUrl = await uploadPublicFile('wallet-requests', path, file)
      }

      const { error } = await supabase.from('uce_branch_wallet_requests').insert({
        branch_id: branchId, amount: amt, payment_mode: mode,
        transaction_id: txnId.trim() || null,
        screenshot_url: screenshotUrl,
        note: note || null,
        requested_by: user?.id || null,
      })
      if (error) throw error
      toast.success('Request submitted — super admin will review')
      navigate('/franchise/wallet')
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <button onClick={() => navigate('/franchise/wallet')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Wallet
      </button>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Request Wallet Reload</h1>
      <p className="text-sm text-gray-500">Already paid? Fill the details below; super admin will verify and credit your wallet.</p>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <FormField label="Amount Paid (₹)" required>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Payment Mode">
          <select value={mode} onChange={e => setMode(e.target.value)} className={inputClass}>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="neft">NEFT</option>
            <option value="imps">IMPS</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>
        </FormField>
        <FormField label="Transaction ID / UTR" hint="Optional — include if you have it">
          <input value={txnId} onChange={e => setTxnId(e.target.value)} className={inputClass} placeholder="e.g. 123456789012" />
        </FormField>
        <FormField label="Payment Screenshot" hint="Optional — upload if you want to attach proof">
          <label className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-red-400 cursor-pointer text-sm text-gray-500">
            <Upload size={16} />
            {file ? file.name : 'Click to upload image/PDF (optional)'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </FormField>
        <FormField label="Note">
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inputClass} placeholder="Anything to add" />
        </FormField>

        <button onClick={submit} disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />} Submit Request
        </button>
      </div>
    </div>
  )
}
