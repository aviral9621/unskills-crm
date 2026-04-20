import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import { formatINR } from '../../../lib/utils'

interface Row {
  id: string; code: string; name: string; duration_label: string | null
  total_fee: number; certification_fee: number; is_active: boolean
  approval_status: 'approved' | 'pending' | 'rejected'
  approval_note: string | null
  created_by_branch_id: string | null
}

export default function FCourseListPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'global' | 'mine'>('global')

  useEffect(() => {
    (async () => {
      const base = supabase.from('uce_courses').select('id,code,name,duration_label,total_fee,certification_fee,is_active,approval_status,approval_note,created_by_branch_id').order('name')
      const { data } = await base
      setRows((data ?? []) as Row[])
    })()
  }, [])

  const visible = rows.filter(r => {
    if (tab === 'global') return r.approval_status === 'approved' && r.created_by_branch_id === null
    return r.created_by_branch_id === branchId
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Courses</h1>
          <p className="text-sm text-gray-500">Global courses + courses you create (need admin approval)</p>
        </div>
        <Link to="/franchise/courses/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-sm">
          <Plus size={16} /> Add Course
        </Link>
      </div>

      <div className="inline-flex gap-1 rounded-xl bg-gray-100 p-1">
        {(['global', 'mine'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>
            {t === 'global' ? 'Global (Approved)' : 'My Courses'}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {visible.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
            <BookOpen size={28} className="mx-auto mb-2 text-gray-300" />
            No courses here yet.
          </div>
        ) : visible.map(r => (
          <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                <span className="text-xs font-mono text-gray-400">({r.code})</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                {r.duration_label && <span className="flex items-center gap-1"><Clock size={11} /> {r.duration_label}</span>}
                <span>Fee: <b>{formatINR(r.total_fee)}</b></span>
                <span>Cert: <b>{formatINR(r.certification_fee)}</b></span>
              </div>
            </div>
            <StatusPill status={r.approval_status} />
            {r.approval_status === 'rejected' && r.approval_note && (
              <p className="text-xs text-red-600">Note: {r.approval_note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: Row['approval_status'] }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 px-2.5 py-1 text-xs font-semibold"><CheckCircle2 size={12} /> Approved</span>
  if (status === 'pending') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-semibold"><Clock size={12} /> Pending</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 px-2.5 py-1 text-xs font-semibold"><XCircle size={12} /> Rejected</span>
}
