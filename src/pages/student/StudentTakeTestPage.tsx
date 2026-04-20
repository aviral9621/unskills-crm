import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Clock, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'

interface Paper {
  id: string; paper_name: string; total_marks: number | null
  total_questions: number | null; time_limit_minutes: number | null
  marks_per_question: number | null
}
interface Question {
  id: string; question_text_en: string; question_text_hi: string | null
  option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null
  image_url: string | null; marks: number | null
}

export default function StudentTakeTestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { rec } = useStudentRecord()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [idx, setIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ total: number; correct: number; marks: number; percentage: number } | null>(null)

  useEffect(() => {
    if (!id || !rec) return
    ;(async () => {
      const { data: p } = await supabase.from('uce_paper_sets')
        .select('id,paper_name,total_marks,total_questions,time_limit_minutes,marks_per_question').eq('id', id).single()
      if (!p) { toast.error('Test not found'); navigate('/student/tests'); return }
      setPaper(p as Paper)

      const { data: qs } = await supabase.from('uce_questions')
        .select('id,question_text_en,question_text_hi,option_a,option_b,option_c,option_d,image_url,marks')
        .eq('paper_set_id', id).order('display_order').order('created_at')
      setQuestions((qs ?? []) as Question[])

      // Find existing un-submitted attempt or create a new one.
      const { data: existing } = await supabase.from('uce_exam_attempts')
        .select('id,started_at,is_submitted').eq('student_id', rec.id).eq('paper_set_id', id).order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (existing && !existing.is_submitted) {
        setAttemptId(existing.id)
        // Resume: load existing answers
        const { data: prev } = await supabase.from('uce_exam_answers').select('question_id,selected_option').eq('attempt_id', existing.id)
        const map: Record<string, string> = {}
        ;(prev ?? []).forEach(a => { if (a.question_id && a.selected_option) map[a.question_id] = a.selected_option })
        setAnswers(map)
        // Timer from started_at
        if (p.time_limit_minutes) {
          const elapsed = Math.floor((Date.now() - new Date(existing.started_at).getTime()) / 1000)
          setSecondsLeft(Math.max(0, p.time_limit_minutes * 60 - elapsed))
        }
      } else {
        const { data: newA } = await supabase.from('uce_exam_attempts').insert({
          student_id: rec.id, paper_set_id: id, started_at: new Date().toISOString(),
          is_submitted: false, total_marks_obtained: 0, mcq_marks: 0, manual_marks: 0, is_graded: false,
        }).select('id').single()
        if (newA) {
          setAttemptId(newA.id)
          if (p.time_limit_minutes) setSecondsLeft(p.time_limit_minutes * 60)
        }
      }
    })()
  }, [id, rec, navigate])

  const submit = useCallback(async () => {
    if (!attemptId) return
    setSubmitting(true)
    const rows = Object.entries(answers).map(([question_id, selected_option]) => ({ attempt_id: attemptId, question_id, selected_option }))
    if (rows.length > 0) {
      await supabase.from('uce_exam_answers').delete().eq('attempt_id', attemptId)
      await supabase.from('uce_exam_answers').insert(rows)
    }
    const { data, error } = await supabase.rpc('uce_score_attempt', { p_attempt_id: attemptId })
    setSubmitting(false)
    if (error) return toast.error(error.message)
    setResult(data as typeof result)
  }, [attemptId, answers])

  useEffect(() => {
    if (secondsLeft === null || result) return
    if (secondsLeft <= 0) { submit(); return }
    const t = setInterval(() => setSecondsLeft(s => (s == null ? s : Math.max(0, s - 1))), 1000)
    return () => clearInterval(t)
  }, [secondsLeft, result, submit])

  if (!paper) return <div className="p-8 text-center text-sm text-gray-400"><Loader2 size={20} className="mx-auto animate-spin" /> Loading…</div>

  if (result) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl border bg-white p-6 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-600 mb-3" />
          <h1 className="font-heading text-2xl font-bold">Test Submitted</h1>
          <p className="text-sm text-gray-500 mt-1">{paper.paper_name}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Correct</p><p className="text-xl font-bold text-green-700">{result.correct}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Marks</p><p className="text-xl font-bold">{result.marks}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Percentage</p><p className="text-xl font-bold text-red-600">{result.percentage}%</p></div>
          </div>
          <button onClick={() => navigate('/student/tests')} className="mt-5 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Back to Tests</button>
        </div>
      </div>
    )
  }

  const q = questions[idx]
  if (!q) return <div className="p-8 text-center text-sm text-gray-400">No questions.</div>
  const opts = [
    { key: 'a', v: q.option_a }, { key: 'b', v: q.option_b },
    { key: 'c', v: q.option_c }, { key: 'd', v: q.option_d },
  ].filter(o => o.v)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="sticky top-0 z-10 bg-bg-page py-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold">{paper.paper_name}</p>
          <p className="text-xs text-gray-500">Question {idx + 1} of {questions.length} · Answered {Object.keys(answers).length}/{questions.length}</p>
        </div>
        {secondsLeft !== null && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
            <Clock size={14} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 sm:p-5">
        <p className="text-sm font-medium whitespace-pre-wrap break-words">{q.question_text_en}</p>
        {q.question_text_hi && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words">{q.question_text_hi}</p>}
        {q.image_url && <img src={q.image_url} alt="" className="mt-3 max-h-48 rounded border" />}
        <div className="mt-4 space-y-2">
          {opts.map(o => (
            <button key={o.key} onClick={() => setAnswers(a => ({ ...a, [q.id]: o.key }))}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${answers[q.id] === o.key ? 'bg-red-50 border-red-400 text-red-800' : 'bg-white hover:bg-gray-50'}`}>
              <span className="font-semibold mr-2 uppercase">{o.key}.</span>{o.v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm disabled:opacity-40">
          <ArrowLeft size={14} /> Previous
        </button>
        <div className="flex gap-2">
          {idx < questions.length - 1 ? (
            <button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm">
              Next <ArrowRight size={14} />
            </button>
          ) : null}
          <button onClick={submit} disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submit Test
          </button>
        </div>
      </div>
    </div>
  )
}
