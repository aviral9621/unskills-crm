import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ArrowRight, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { useImpersonation } from '../../contexts/ImpersonationContext'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface Submission {
  id: string
  window_id: string | null
  semester: number | null
  exam_session: string | null
  status: string
  created_at: string
  review_note: string | null
}

interface Window {
  id: string
  semester: number
  exam_session: string
  opens_at: string | null
  closes_at: string | null
  instructions: string | null
}

export default function StudentExamFormPage() {
  const { rec } = useStudentRecord()
  const { isImpersonating } = useImpersonation()
  const [windows, setWindows] = useState<Window[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])

  useEffect(() => {
    if (!rec) return
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data: ws } = await supabase
        .from('uce_exam_form_windows')
        .select('id, semester, exam_session, opens_at, closes_at, instructions')
        .eq('course_id', rec.course_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      const open = (ws ?? []).filter(w => {
        if (w.opens_at && w.opens_at > today) return false
        if (w.closes_at && w.closes_at < today) return false
        return true
      })
      setWindows(open as Window[])

      const { data: subs } = await supabase
        .from('uce_exam_forms')
        .select('id, window_id, semester, exam_session, status, created_at, review_note')
        .eq('student_id', rec.id)
        .order('created_at', { ascending: false })
      setSubmissions((subs ?? []) as Submission[])
    })()
  }, [rec])

  if (!rec) return null

  // A window is "open to fill" if there's no submission OR latest submission is rejected/resubmit
  function statusForWindow(w: Window): 'fill' | 'submitted' | 'approved' | 'resubmit' | 'rejected' {
    const sub = submissions.find(s => s.window_id === w.id)
    if (!sub) return 'fill'
    if (sub.status === 'submitted') return 'submitted'
    if (sub.status === 'approved') return 'approved'
    if (sub.status === 'resubmit') return 'resubmit'
    if (sub.status === 'rejected') return 'rejected'
    return 'fill'
  }

  const fillBase = isImpersonating ? null : '/student/exam-forms'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Exam Forms</h1>
        <p className="text-sm text-gray-500">Fill the exam form to receive your admit card.</p>
      </div>

      {windows.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase">Active Forms</p>
          {windows.map(w => {
            const st = statusForWindow(w)
            const sub = submissions.find(s => s.window_id === w.id)
            return (
              <div key={w.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold">Sem {w.semester} · Session {w.exam_session}</p>
                    {w.closes_at && <p className="text-xs text-gray-500 mt-0.5">Closes on {formatDateDDMMYYYY(w.closes_at)}</p>}
                    {w.instructions && <p className="text-xs text-gray-600 mt-1.5">{w.instructions}</p>}
                  </div>
                  {st === 'fill' && fillBase && (
                    <Link to={`${fillBase}/${w.id}/fill`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 shrink-0">
                      Fill Now <ArrowRight size={12} />
                    </Link>
                  )}
                  {st === 'submitted' && (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">Submitted · Awaiting review</span>
                  )}
                  {st === 'approved' && (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">Approved</span>
                  )}
                  {st === 'resubmit' && fillBase && (
                    <Link to={`${fillBase}/${w.id}/fill`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shrink-0">
                      Resubmit <ArrowRight size={12} />
                    </Link>
                  )}
                  {st === 'rejected' && (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">Rejected</span>
                  )}
                </div>
                {sub?.review_note && (st === 'resubmit' || st === 'rejected') && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2">
                    <AlertCircle size={14} className="text-amber-700 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-900"><strong>Reviewer note:</strong> {sub.review_note}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">My Submissions</p>
        <div className="rounded-xl border bg-white divide-y">
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              <ClipboardList size={28} className="mx-auto mb-2 text-gray-300" />No exam forms yet.
            </div>
          ) : submissions.map(r => (
            <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{r.exam_session} {r.semester && `· Sem ${r.semester}`}</p>
                <p className="text-xs text-gray-500">{formatDateDDMMYYYY(r.created_at)}{r.review_note && ` · ${r.review_note}`}</p>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize w-fit ${
                r.status === 'approved' ? 'bg-green-50 text-green-700'
                : r.status === 'rejected' ? 'bg-red-50 text-red-700'
                : r.status === 'resubmit' ? 'bg-amber-50 text-amber-700'
                : 'bg-amber-50 text-amber-700'
              }`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
