import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface Row { id: string; semester: number | null; exam_session: string | null; status: string; created_at: string; note: string | null }

export default function StudentExamFormPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_exam_forms').select('id,semester,exam_session,status,created_at,note').eq('student_id', rec.id).order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }, [rec])

  if (!rec) return null

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">My Exam Forms</h1>
      <p className="text-sm text-gray-500">Submitted by your institute. Contact your branch to add a new one.</p>
      <div className="rounded-xl border bg-white divide-y">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            <ClipboardList size={28} className="mx-auto mb-2 text-gray-300" />No exam forms yet.
          </div>
        ) : rows.map(r => (
          <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{r.exam_session} {r.semester && `· Sem ${r.semester}`}</p>
              <p className="text-xs text-gray-500">{formatDateDDMMYYYY(r.created_at)}{r.note && ` · ${r.note}`}</p>
            </div>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize w-fit ${r.status === 'approved' ? 'bg-green-50 text-green-700' : r.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
