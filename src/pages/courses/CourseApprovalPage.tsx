import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

interface Row {
  id: string; code: string; name: string; approval_status: 'approved' | 'pending' | 'rejected'
  approval_note: string | null
  total_fee: number; certification_fee: number; created_at: string
  branch: { name: string; code: string } | null
  program: { name: string } | null
}

export default function CourseApprovalPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await supabase.from('uce_courses')
      .select('id,code,name,approval_status,approval_note,total_fee,certification_fee,created_at,branch:uce_branches!created_by_branch_id(name,code),program:uce_programs(name)')
      .eq('approval_status', tab)
      .not('created_by_branch_id', 'is', null)
      .order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => { load() }, [tab])

  async function approve(r: Row) {
    setLoading(true)
    const { error } = await supabase.from('uce_courses').update({
      approval_status: 'approved', is_active: true, approved_by: user?.id, approved_at: new Date().toISOString(),
    }).eq('id', r.id)
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success(`Approved: ${r.name}`); load()
  }

  async function reject(r: Row) {
    const note = prompt('Reason?')
    if (!note) return
    setLoading(true)
    const { error } = await supabase.from('uce_courses').update({
      approval_status: 'rejected', approval_note: note, approved_by: user?.id, approved_at: new Date().toISOString(),
    }).eq('id', r.id)
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success('Rejected'); load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Course Approvals</h1>
        <p className="text-sm text-gray-500">Branch-submitted courses awaiting review.</p>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {(['pending', 'approved', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No {tab} courses.</div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{r.name}</p>
                <span className="text-xs font-mono text-gray-400">{r.code}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">By <b>{r.branch?.name}</b> ({r.branch?.code}) · {r.program?.name} · {formatDateDDMMYYYY(r.created_at)}</p>
              <p className="text-sm mt-1">Fee: <b>{formatINR(r.total_fee)}</b> · Cert: <b>{formatINR(r.certification_fee)}</b></p>
              {r.approval_note && <p className="text-xs text-red-600 mt-1">{r.approval_note}</p>}
            </div>
            {tab === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => approve(r)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"><Check size={14} /> Approve</button>
                <button onClick={() => reject(r)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50"><X size={14} /> Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
