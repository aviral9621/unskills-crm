import { useEffect, useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'

interface Row { id: string; title: string; file_url: string; uploaded_by_branch_id: string | null; subject: { name: string } | null }

export default function StudentMaterialsPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_study_materials')
      .select('id,title,file_url,uploaded_by_branch_id,subject:uce_subjects(name)')
      .eq('course_id', rec.course_id).eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []).filter((m: Record<string, unknown>) =>
          m.uploaded_by_branch_id === null || m.uploaded_by_branch_id === rec.branch_id,
        )
        setRows(list as unknown as Row[])
      })
  }, [rec])

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Study Material</h1>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No material yet.</div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-3 sm:p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0"><FileText size={18} /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{r.title}</p>
              {r.subject?.name && <p className="text-xs text-gray-500 truncate">{r.subject.name}</p>}
            </div>
            <a href={r.file_url} target="_blank" rel="noreferrer" download className="p-2 rounded-lg hover:bg-gray-100"><Download size={16} /></a>
          </div>
        ))}
      </div>
    </div>
  )
}
