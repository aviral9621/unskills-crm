import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Clock, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'

interface PaperSet {
  id: string; paper_name: string; category: string | null
  total_questions: number | null; total_marks: number | null
  time_limit_minutes: number | null; is_mock_test: boolean | null
  available_from: string | null; available_to: string | null
}

interface Attempt {
  id: string; paper_set_id: string; total_marks_obtained: number | null
  submitted_at: string | null; is_submitted: boolean
}

export default function StudentTestsPage() {
  const { rec } = useStudentRecord()
  const [papers, setPapers] = useState<PaperSet[]>([])
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({})

  useEffect(() => {
    if (!rec) return
    ;(async () => {
      const { data: ps } = await supabase.from('uce_paper_sets')
        .select('id,paper_name,category,total_questions,total_marks,time_limit_minutes,is_mock_test,available_from,available_to')
        .eq('course_id', rec.course_id).eq('is_active', true)
        .order('created_at', { ascending: false })
      setPapers((ps ?? []) as PaperSet[])

      const { data: att } = await supabase.from('uce_exam_attempts')
        .select('id,paper_set_id,total_marks_obtained,submitted_at,is_submitted')
        .eq('student_id', rec.id)
        .order('started_at', { ascending: false })
      const map: Record<string, Attempt> = {}
      ;(att ?? []).forEach(a => { if (!map[a.paper_set_id]) map[a.paper_set_id] = a as Attempt })
      setAttempts(map)
    })()
  }, [rec])

  if (!rec) return null

  const now = new Date()
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Online Tests</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {papers.length === 0 ? (
          <div className="sm:col-span-2 rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
            <ClipboardList size={28} className="mx-auto mb-2 text-gray-300" />No tests available.
          </div>
        ) : papers.map(p => {
          const a = attempts[p.id]
          const isOpen = (!p.available_from || new Date(p.available_from) <= now) && (!p.available_to || new Date(p.available_to) >= now)
          return (
            <div key={p.id} className="rounded-xl border bg-white p-4">
              <p className="font-semibold break-words">{p.paper_name}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{p.category}{p.is_mock_test && ' · Mock'}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                <span>{p.total_questions ?? '?'} Qs</span>
                <span>{p.total_marks ?? '?'} marks</span>
                {p.time_limit_minutes && <span className="flex items-center gap-1"><Clock size={11} />{p.time_limit_minutes}m</span>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                {a?.is_submitted ? (
                  <span className="text-xs font-semibold text-green-700 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Submitted: {a.total_marks_obtained ?? 0} / {p.total_marks ?? '?'}
                  </span>
                ) : !isOpen ? (
                  <span className="text-xs text-gray-400">Not available yet</span>
                ) : (
                  <Link to={`/student/tests/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
                    Start Test →
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
