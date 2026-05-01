import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ClipboardList, Loader2, CheckCircle2, AlertCircle, Phone, Mail, Save,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass } from '../../components/FormField'
import Modal from '../../components/Modal'

interface PendingAttempt {
  id: string
  name: string
  phone: string
  email: string | null
  score: number
  total_marks: number
  submitted_at: string
  grading_status: string
  paper: { id: string; paper_name: string } | null
}

interface ReviewRow {
  question_id: string
  display_order: number
  question_text_en: string
  question_text_hi: string | null
  question_type: string
  topic: string | null
  difficulty: string | null
  marks: number
  expected_answer: string | null
  student_answer: string | null
  marks_awarded: number | null
  feedback: string | null
  graded_status: string
}

export default function FreeTestGradingPage() {
  const navigate = useNavigate()

  const [attempts, setAttempts] = useState<PendingAttempt[]>([])
  const [loading, setLoading] = useState(true)

  const [opening, setOpening] = useState<string | null>(null)
  const [selectedAttempt, setSelectedAttempt] = useState<PendingAttempt | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { marks: string; feedback: string; saving: boolean }>>({})
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { fetchAttempts() }, [])

  async function fetchAttempts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_free_test_attempts')
        .select('id, name, phone, email, score, total_marks, submitted_at, grading_status, paper:uce_paper_sets(id, paper_name)')
        .eq('grading_status', 'pending_manual_review')
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      setAttempts((data ?? []) as unknown as PendingAttempt[])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load pending attempts')
    } finally { setLoading(false) }
  }

  async function openAttempt(a: PendingAttempt) {
    setOpening(a.id)
    try {
      const { data, error } = await supabase.rpc('get_free_test_attempt_review', {
        p_attempt_id: a.id,
        p_phone: a.phone,
      })
      if (error) throw error
      const written = ((data ?? []) as ReviewRow[]).filter(r =>
        r.question_type === 'short_answer' || r.question_type === 'long_answer'
      )
      setRows(written)
      const initial: typeof drafts = {}
      for (const r of written) {
        initial[r.question_id] = {
          marks: r.marks_awarded != null ? String(r.marks_awarded) : '',
          feedback: r.feedback || '',
          saving: false,
        }
      }
      setDrafts(initial)
      setSelectedAttempt(a)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load attempt')
    } finally { setOpening(null) }
  }

  async function saveGrade(qid: string) {
    if (!selectedAttempt) return
    const d = drafts[qid]
    if (!d) return
    const r = rows.find(x => x.question_id === qid)
    if (!r) return

    const marks = Number(d.marks)
    if (Number.isNaN(marks) || marks < 0 || marks > Number(r.marks)) {
      toast.error(`Marks must be between 0 and ${r.marks}`)
      return
    }

    setDrafts(s => ({ ...s, [qid]: { ...s[qid], saving: true } }))
    try {
      const { data, error } = await supabase.rpc('grade_free_test_answer', {
        p_attempt_id: selectedAttempt.id,
        p_question_id: qid,
        p_marks_awarded: marks,
        p_feedback: d.feedback.trim() || null,
      })
      if (error) throw error

      const result = data as { score: number; grading_status: string; pending_count: number }
      toast.success(`Saved · score now ${result.score} · ${result.pending_count} pending`)

      // Refresh review for this attempt + sync local state
      setRows(rs => rs.map(x => x.question_id === qid
        ? { ...x, marks_awarded: marks, feedback: d.feedback.trim() || null, graded_status: 'graded' }
        : x))

      if (result.grading_status === 'fully_graded') {
        // remove from queue, close panel
        setAttempts(arr => arr.filter(a => a.id !== selectedAttempt.id))
        setSelectedAttempt(null)
        toast.success('All answers graded — attempt fully graded')
      } else {
        // update score on selected card
        setSelectedAttempt(a => a ? { ...a, score: result.score } : a)
      }
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : 'Failed to save grade'
      toast.error(msg)
    } finally {
      setDrafts(s => ({ ...s, [qid]: { ...s[qid], saving: false } }))
    }
  }

  const visibleRows = useMemo(() => showAll ? rows : rows.filter(r => r.graded_status !== 'graded'), [rows, showAll])

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading">Pending Grading</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Free-test attempts with written answers awaiting faculty review</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-green-300 mb-3" />
          <p className="text-sm text-gray-500">All caught up — nothing pending review.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1.2fr_0.8fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <span>Student</span>
            <span>Phone</span>
            <span>Paper</span>
            <span>Auto-score</span>
            <span>Submitted</span>
            <span></span>
          </div>
          {attempts.map(a => (
            <div key={a.id} className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1.2fr_0.8fr_1fr_auto] gap-2 sm:gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0 items-center hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                {a.email && (
                  <p className="text-[11px] text-gray-400 truncate inline-flex items-center gap-1"><Mail size={10} /> {a.email}</p>
                )}
              </div>
              <p className="text-xs text-gray-600 inline-flex items-center gap-1"><Phone size={11} /> {a.phone}</p>
              <p className="text-xs text-gray-700 truncate">{a.paper?.paper_name || '—'}</p>
              <p className="text-xs text-gray-700">{a.score}/{a.total_marks}</p>
              <p className="text-xs text-gray-500">{new Date(a.submitted_at).toLocaleString()}</p>
              <button
                onClick={() => openAttempt(a)}
                disabled={opening === a.id}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5 justify-self-start sm:justify-self-end"
              >
                {opening === a.id ? <Loader2 size={12} className="animate-spin" /> : <ClipboardList size={12} />} Grade
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedAttempt && (
        <Modal
          open={!!selectedAttempt}
          onClose={() => setSelectedAttempt(null)}
          title={`Grade · ${selectedAttempt.name}`}
          size="lg"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><p className="text-gray-400">Phone</p><p className="text-gray-800 font-medium">{selectedAttempt.phone}</p></div>
              <div><p className="text-gray-400">Paper</p><p className="text-gray-800 font-medium truncate">{selectedAttempt.paper?.paper_name || '—'}</p></div>
              <div><p className="text-gray-400">Auto-score</p><p className="text-gray-800 font-medium">{selectedAttempt.score}/{selectedAttempt.total_marks}</p></div>
              <div><p className="text-gray-400">Status</p><p className="text-amber-600 font-medium">{selectedAttempt.grading_status.replace(/_/g, ' ')}</p></div>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              Show already graded answers
            </label>

            {visibleRows.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
                <p className="text-sm text-green-800 font-medium">Every written answer has been graded.</p>
              </div>
            ) : visibleRows.map((r, idx) => {
              const d = drafts[r.question_id] || { marks: '', feedback: '', saving: false }
              const graded = r.graded_status === 'graded'
              return (
                <div key={r.question_id} className={`rounded-xl border p-4 space-y-3 ${graded ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
                  <div className="flex items-start gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-50 text-red-600 text-xs font-bold shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{r.question_text_en}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-medium uppercase">{r.question_type === 'short_answer' ? 'Short' : 'Long'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">{r.marks} marks</span>
                        {r.topic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{r.topic}</span>}
                        {graded && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium inline-flex items-center gap-1"><CheckCircle2 size={10} /> graded</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Student's answer</p>
                      <div className={`p-3 rounded-lg border text-sm whitespace-pre-wrap min-h-[80px] ${r.student_answer ? 'border-gray-200 bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400 italic'}`}>
                        {r.student_answer || '— No answer submitted —'}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Expected / model answer</p>
                      <div className="p-3 rounded-lg border border-green-200 bg-green-50/60 text-sm whitespace-pre-wrap min-h-[80px] text-green-900">
                        {r.expected_answer || <span className="text-amber-700 inline-flex items-center gap-1"><AlertCircle size={12} /> No expected answer recorded — please update the question.</span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-2 items-end">
                    <FormField label={`Marks (0–${r.marks})`} required>
                      <input
                        type="number"
                        value={d.marks}
                        onChange={e => setDrafts(s => ({ ...s, [r.question_id]: { ...s[r.question_id], marks: e.target.value, saving: false } }))}
                        className={inputClass}
                        min={0}
                        max={Number(r.marks)}
                        step="0.5"
                      />
                    </FormField>
                    <FormField label="Feedback" hint="Optional — shown to the student">
                      <textarea
                        value={d.feedback}
                        onChange={e => setDrafts(s => ({ ...s, [r.question_id]: { ...s[r.question_id], feedback: e.target.value, saving: false } }))}
                        rows={2}
                        className={`${inputClass} resize-none`}
                        placeholder="Add a short note for the student"
                      />
                    </FormField>
                    <button
                      onClick={() => saveGrade(r.question_id)}
                      disabled={d.saving}
                      className="px-3 py-2.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {d.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
