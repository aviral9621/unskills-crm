import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Bell } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import { queueStudentNotification } from '../../../lib/notify'
import { formatDateDDMMYYYY } from '../../../lib/utils'

interface Marksheet {
  id: string; student_id: string; percentage: number | null; grade: string | null
  result: string | null; issue_date: string | null; is_active: boolean
  student: { name: string; registration_no: string } | null
  course: { name: string } | null
}

export default function FResultsPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Marksheet[]>([])
  const [publishing, setPublishing] = useState(false)

  async function load() {
    if (!branchId) return
    const { data } = await supabase.from('uce_marksheets')
      .select('id,student_id,percentage,grade,result,issue_date,is_active,student:uce_students!inner(name,registration_no,branch_id),course:uce_courses(name)')
      .eq('student.branch_id', branchId)
      .order('issue_date', { ascending: false })
    setRows((data ?? []) as unknown as Marksheet[])
  }
  useEffect(() => { load() }, [branchId])

  async function publishAll() {
    setPublishing(true)
    try {
      for (const r of rows.filter(r => r.is_active)) {
        if (!r.student_id) continue
        await queueStudentNotification({
          studentId: r.student_id,
          branchId: branchId,
          template: 'result_published',
          payload: { course: r.course?.name, grade: r.grade, percentage: r.percentage, result: r.result },
        })
      }
      toast.success(`Notifications queued for ${rows.filter(r => r.is_active).length} students`)
    } finally { setPublishing(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Results</h1>
          <p className="text-sm text-gray-500">Published marksheets for your students.</p>
        </div>
        <button onClick={publishAll} disabled={publishing || rows.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
          {publishing ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
          Notify All Students
        </button>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Issued</th><th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Course</th><th className="px-4 py-3">%</th>
              <th className="px-4 py-3">Grade</th><th className="px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3">{r.issue_date && formatDateDDMMYYYY(r.issue_date)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.student?.name}</p>
                  <p className="text-xs font-mono text-gray-400">{r.student?.registration_no}</p>
                </td>
                <td className="px-4 py-3">{r.course?.name}</td>
                <td className="px-4 py-3">{r.percentage ? `${r.percentage}%` : '—'}</td>
                <td className="px-4 py-3">{r.grade}</td>
                <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${r.result === 'PASS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.result}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No results yet</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        SMS/WhatsApp notifications are currently stubbed — they're logged in the <code>uce_notifications_log</code> table and will dispatch automatically once a provider is configured.
      </p>
    </div>
  )
}
