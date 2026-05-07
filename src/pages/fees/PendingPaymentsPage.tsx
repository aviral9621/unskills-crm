import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, Eye, Loader2, IndianRupee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

interface Row {
  id: string
  amount: number
  payment_date: string
  payment_mode: string | null
  student_reference: string | null
  note: string | null
  status: string
  created_at: string
  proof_path: string | null
  branch_id: string | null
  student: { id: string; name: string; registration_no: string } | null
  branch: { name: string; code: string } | null
}

export default function PendingPaymentsPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    let q = supabase
      .from('uce_student_fee_payments')
      .select('id, amount, payment_date, payment_mode, student_reference, note, status, created_at, proof_path, branch_id, student:uce_students(id, name, registration_no), branch:uce_branches(name, code)')
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false })
    if (!isSuperAdmin && branchId) {
      // Branch admin: only their own branch's pending submissions
      q = q.eq('branch_id', branchId)
    } else if (isSuperAdmin) {
      // Super admin: only the main (headquarter) branch's submissions —
      // each branch-admin reviews their own students' submissions in their
      // own panel, so super-admin shouldn't second-review them.
      const { data: mainBranches } = await supabase
        .from('uce_branches').select('id').eq('is_main', true)
      const mainIds = (mainBranches ?? []).map(b => b.id as string)
      if (mainIds.length === 0) {
        setRows([]); setLoading(false); return
      }
      q = q.in('branch_id', mainIds)
    }
    const { data } = await q
    setRows((data ?? []) as unknown as Row[])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  async function viewProof(path: string) {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60)
    if (error) return toast.error('Could not load proof')
    setProofUrl(data.signedUrl)
  }

  async function decide(row: Row, status: 'confirmed' | 'rejected') {
    setWorking(row.id)
    try {
      const { error: uErr } = await supabase
        .from('uce_student_fee_payments')
        .update({ status, proof_path: null })
        .eq('id', row.id)
      if (uErr) throw new Error(uErr.message)
      // Auto-delete the proof file from storage on approve OR reject.
      if (row.proof_path) {
        const { error: dErr } = await supabase.storage.from('payment-proofs').remove([row.proof_path])
        if (dErr) console.warn('Storage delete failed:', dErr.message)
      }
      toast.success(status === 'confirmed' ? 'Payment confirmed' : 'Payment rejected')
      setRows(prev => prev.filter(r => r.id !== row.id))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Pending Payments</h1>
        <p className="text-sm text-gray-500">
          Student-submitted payments awaiting confirmation{isSuperAdmin ? ' for the headquarter branch' : ' for your branch'}.
          Approving auto-deletes the uploaded proof.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-600" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          <IndianRupee size={28} className="mx-auto mb-2 text-gray-300" />
          No pending payments.
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student</th>
                {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs">{formatDateDDMMYYYY(r.payment_date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.student?.name ?? '—'}</p>
                    <p className="text-xs font-mono text-gray-400">{r.student?.registration_no ?? ''}</p>
                  </td>
                  {isSuperAdmin && <td className="px-4 py-3 text-xs">{r.branch?.name ?? '—'}</td>}
                  <td className="px-4 py-3 text-right font-semibold">{formatINR(r.amount)}</td>
                  <td className="px-4 py-3 text-xs uppercase">{r.payment_mode ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono">{r.student_reference ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.proof_path ? (
                      <button onClick={() => viewProof(r.proof_path!)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Eye size={12} /> View
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        disabled={working === r.id}
                        onClick={() => decide(r, 'confirmed')}
                        className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {working === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Approve
                      </button>
                      <button
                        disabled={working === r.id}
                        onClick={() => decide(r, 'rejected')}
                        className="px-2 py-1 text-xs rounded bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proofUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setProofUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Payment Proof</p>
              <button onClick={() => setProofUrl(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-3 overflow-auto flex items-center justify-center bg-gray-50">
              {/\.pdf(\?|$)/i.test(proofUrl)
                ? <iframe src={proofUrl} className="w-full h-[70vh] border-0" />
                : <img src={proofUrl} alt="Proof" className="max-h-[80vh] object-contain" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
