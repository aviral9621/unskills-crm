import { useEffect, useState } from 'react'
import { Download, Award } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY } from '../../lib/utils'
import { toast } from 'sonner'

interface Marksheet {
  id: string; percentage: number | null; grade: string | null; result: string | null
  issue_date: string | null; marks_data: Record<string, unknown>; total_obtained: number | null
  total_max: number | null
  course: { name: string; code: string } | null
}

export default function StudentResultsPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Marksheet[]>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_marksheets')
      .select('id,percentage,grade,result,issue_date,marks_data,total_obtained,total_max,course:uce_courses(name,code)')
      .eq('student_id', rec.id).eq('is_active', true)
      .order('issue_date', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Marksheet[]))
  }, [rec])

  function download(m: Marksheet) {
    void m
    toast.info('Contact your institute to request a printed marksheet.')
  }

  if (!rec) return null
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">My Results</h1>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
            <Award size={28} className="mx-auto mb-2 text-gray-300" />No results published yet.
          </div>
        ) : rows.map(m => (
          <div key={m.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold break-words">{m.course?.name}</p>
              <p className="text-xs text-gray-500">{m.issue_date && formatDateDDMMYYYY(m.issue_date)}</p>
              <p className="text-sm mt-2">
                <b>{m.total_obtained}</b> / {m.total_max} &middot;
                <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-semibold ${m.result === 'PASS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{m.result}</span>
                <span className="ml-2 text-xs text-gray-500">Grade {m.grade}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-heading text-red-600">{m.percentage ? `${Number(m.percentage).toFixed(2)}%` : '—'}</p>
            </div>
            <button onClick={() => download(m)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-50">
              <Download size={12} /> Marksheet
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
