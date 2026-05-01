import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Clock, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'

interface Paper {
  id: string
  paper_name: string
  total_marks: number | null
  total_questions: number | null
  time_limit_minutes: number | null
  marks_per_question: number | null
}

type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'long_answer'

interface Question {
  id: string
  question_text_en: string
  question_text_hi: string | null
  question_type: QuestionType
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  image_url: string | null
  marks: number | null
  topic: string | null
}

interface Result {
  total: number
  correct: number
  marks: number
  percentage: number
  has_written?: boolean
  pending_review?: boolean
}

export default function StudentTakeTestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { rec } = useStudentRecord()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  // For MCQ / T-F we store the selected option letter; for written types, the typed text.
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [idx, setIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  // Debounced auto-save for written answers, keyed by question id
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!id || !rec) return
    ;(async () => {
      const { data: p } = await supabase.from('uce_paper_sets')
        .select('id,paper_name,total_marks,total_questions,time_limit_minutes,marks_per_question').eq('id', id).single()
      if (!p) { toast.error('Test not found'); navigate('/student/tests'); return }
      setPaper(p as Paper)

      const { data: qs } = await supabase.from('uce_questions')
        .select('id,question_text_en,question_text_hi,question_type,option_a,option_b,option_c,option_d,image_url,marks,topic')
        .eq('paper_set_id', id).order('display_order').order('created_at')
      setQuestions((qs ?? []) as Question[])

      // Find existing un-submitted attempt or create a new one.
      const { data: existing } = await supabase.from('uce_exam_attempts')
        .select('id,started_at,is_submitted').eq('student_id', rec.id).eq('paper_set_id', id).order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (existing && !existing.is_submitted) {
        setAttemptId(existing.id)
        const { data: prev } = await supabase.from('uce_exam_answers')
          .select('question_id,selected_option,answer_text').eq('attempt_id', existing.id)
        const map: Record<string, string> = {}
        ;(prev ?? []).forEach(a => {
          if (!a.question_id) return
          map[a.question_id] = a.selected_option ?? a.answer_text ?? ''
        })
        setAnswers(map)
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

  // Persist a single question's answer (upsert by delete + insert on attempt+question)
  const persistAnswer = useCallback(async (q: Question, value: string) => {
    if (!attemptId) return
    setSavingMap(s => ({ ...s, [q.id]: true }))
    try {
      const isWritten = q.question_type === 'short_answer' || q.question_type === 'long_answer'
      // Replace any existing row for this attempt+question
      await supabase.from('uce_exam_answers')
        .delete()
        .eq('attempt_id', attemptId)
        .eq('question_id', q.id)
      if (value && value.trim()) {
        await supabase.from('uce_exam_answers').insert({
          attempt_id: attemptId,
          question_id: q.id,
          selected_option: isWritten ? null : value.toUpperCase(),
          answer_text: isWritten ? value : null,
        })
      }
    } catch (e) {
      console.error('Auto-save failed', e)
    } finally {
      setSavingMap(s => ({ ...s, [q.id]: false }))
    }
  }, [attemptId])

  // Update local state immediately, debounce DB write for written answers.
  function setAnswer(q: Question, value: string) {
    setAnswers(a => ({ ...a, [q.id]: value }))
    if (q.question_type === 'short_answer' || q.question_type === 'long_answer') {
      if (saveTimers.current[q.id]) clearTimeout(saveTimers.current[q.id])
      saveTimers.current[q.id] = setTimeout(() => persistAnswer(q, value), 600)
    } else {
      // For MCQ / T-F selecting is the final action — save immediately.
      persistAnswer(q, value)
    }
  }

  const submit = useCallback(async () => {
    if (!attemptId) return
    setSubmitting(true)
    try {
      // Flush any pending debounced saves so nothing is lost.
      const pending = Object.entries(saveTimers.current)
      pending.forEach(([, t]) => clearTimeout(t))
      saveTimers.current = {}
      const flushes = pending.map(async ([qid]) => {
        const q = questions.find(x => x.id === qid)
        if (q) await persistAnswer(q, answers[qid] ?? '')
      })
      await Promise.all(flushes)

      const { data, error } = await supabase.rpc('uce_score_attempt', { p_attempt_id: attemptId })
      if (error) throw error
      setResult(data as Result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit test'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }, [attemptId, answers, questions, persistAnswer])

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
          {result.pending_review && (
            <div className="mt-4 inline-flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-left text-xs text-amber-800">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>Your written answers are with the faculty for review. Your final score will be available once they finish grading.</span>
            </div>
          )}
          <button onClick={() => navigate('/student/tests')} className="mt-5 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Back to Tests</button>
        </div>
      </div>
    )
  }

  const q = questions[idx]
  if (!q) return <div className="p-8 text-center text-sm text-gray-400">No questions.</div>

  const answerValue = answers[q.id] ?? ''
  const isMcq        = q.question_type === 'mcq'
  const isTF         = q.question_type === 'true_false'
  const isShort      = q.question_type === 'short_answer'
  const isLong       = q.question_type === 'long_answer'
  const isWritten    = isShort || isLong

  const mcqOptions = [
    { key: 'A', v: q.option_a },
    { key: 'B', v: q.option_b },
    { key: 'C', v: q.option_c },
    { key: 'D', v: q.option_d },
  ].filter(o => o.v)

  const answeredCount = Object.values(answers).filter(v => v && v.toString().trim() !== '').length

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="sticky top-0 z-10 bg-bg-page py-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold">{paper.paper_name}</p>
          <p className="text-xs text-gray-500">Question {idx + 1} of {questions.length} · Answered {answeredCount}/{questions.length}</p>
        </div>
        {secondsLeft !== null && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
            <Clock size={14} /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600 uppercase">
            {isMcq ? 'MCQ' : isTF ? 'True / False' : isShort ? 'Short Answer' : 'Long Answer'}
          </span>
          {q.marks != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-600">{q.marks} marks</span>
          )}
          {q.topic && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-50 text-indigo-600">{q.topic}</span>
          )}
          {isWritten && savingMap[q.id] && (
            <span className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Saving…</span>
          )}
        </div>

        <p className="text-sm font-medium whitespace-pre-wrap break-words">{q.question_text_en}</p>
        {q.question_text_hi && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words">{q.question_text_hi}</p>}
        {q.image_url && <img src={q.image_url} alt="" className="mt-3 max-h-48 rounded border" />}

        <div className="mt-4 space-y-2">
          {/* MCQ */}
          {isMcq && mcqOptions.map(o => {
            const selected = answerValue.toUpperCase() === o.key
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setAnswer(q, o.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${selected ? 'bg-red-50 border-red-400 text-red-800' : 'bg-white hover:bg-gray-50'}`}
              >
                <span className="font-semibold mr-2 uppercase">{o.key}.</span>{o.v}
              </button>
            )
          })}

          {/* True / False */}
          {isTF && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'A', label: 'True' },
                { key: 'B', label: 'False' },
              ].map(o => {
                const selected = answerValue.toUpperCase() === o.key
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setAnswer(q, o.key)}
                    className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-colors ${selected ? (o.key === 'A' ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800') : 'bg-white hover:bg-gray-50'}`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Short Answer */}
          {isShort && (
            <textarea
              value={answerValue}
              onChange={e => setAnswer(q, e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none resize-none text-sm"
              placeholder="Type your answer in 1–2 lines…"
            />
          )}

          {/* Long Answer */}
          {isLong && (
            <textarea
              value={answerValue}
              onChange={e => setAnswer(q, e.target.value)}
              rows={8}
              maxLength={4000}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none resize-y text-sm"
              placeholder="Write your answer in detail…"
            />
          )}

          {isWritten && (
            <p className="text-[11px] text-gray-400 mt-1">Your answer saves automatically as you type. Faculty will review written answers after submission.</p>
          )}
        </div>
      </div>

      {/* Question grid for quick navigation */}
      <div className="rounded-xl border bg-white p-3 flex flex-wrap gap-1.5">
        {questions.map((qq, i) => {
          const filled = answers[qq.id] && answers[qq.id].toString().trim() !== ''
          const current = i === idx
          return (
            <button
              key={qq.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-8 w-8 text-xs font-semibold rounded ${current ? 'bg-red-600 text-white' : filled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm disabled:opacity-40">
          <ArrowLeft size={14} /> Previous
        </button>
        <div className="flex gap-2">
          {idx < questions.length - 1 && (
            <button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm">
              Next <ArrowRight size={14} />
            </button>
          )}
          <button onClick={submit} disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submit Test
          </button>
        </div>
      </div>
    </div>
  )
}
