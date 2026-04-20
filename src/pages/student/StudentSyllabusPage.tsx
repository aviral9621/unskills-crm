import { useEffect, useState } from 'react'
import { BookOpen, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'

interface Row { id: string; title: string; description: string | null; file_url: string | null; subject: { name: string } | null }

export default function StudentSyllabusPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_syllabus')
      .select('id,title,description,file_url,subject:uce_subjects(name)')
      .eq('course_id', rec.course_id).eq('is_active', true)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]))
  }, [rec])

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Syllabus</h1>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
            <BookOpen size={24} className="mx-auto mb-2 text-gray-300" />No syllabus uploaded yet.
          </div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-3 sm:p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><BookOpen size={18} /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{r.title}</p>
              {r.subject?.name && <p className="text-xs text-gray-500 truncate">{r.subject.name}</p>}
              {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
            </div>
            {r.file_url && (
              <a href={r.file_url} target="_blank" rel="noreferrer" download className="p-2 rounded-lg hover:bg-gray-100"><Download size={16} /></a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
