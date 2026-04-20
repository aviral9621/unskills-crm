import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface Row { id: string; title: string; body: string; target: string; target_id: string | null; branch_id: string | null; created_at: string }

export default function StudentAnnouncementsPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_announcements')
      .select('id,title,body,target,target_id,branch_id,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const filtered = (data ?? []).filter(a => {
          if (a.target === 'all') return true
          if (a.target === 'branch') return a.branch_id === rec.branch_id
          if (a.target === 'course') return a.target_id === rec.course_id
          if (a.target === 'student') return a.target_id === rec.id
          return false
        })
        setRows(filtered as Row[])
      })
  }, [rec])

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Announcements</h1>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
          <Megaphone size={28} className="mx-auto mb-2 text-gray-300" />No announcements.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2">
                <Megaphone size={14} className="text-red-600" />
                <p className="font-semibold flex-1 break-words">{r.title}</p>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDateDDMMYYYY(r.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
