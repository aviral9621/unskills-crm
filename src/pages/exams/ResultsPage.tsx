import { useEffect, useState, useMemo, useCallback } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  BarChart3, Search, X, Download, Eye, CheckCircle, Clock, Loader2, Save, AlertCircle, CheckCircle2 as CheckCircle2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'

interface ResultRow {
  id: string
  student_id: string
  paper_set_id: string
  attempt_id: string | null
  total_marks: number | null
  obtained_marks: number | null
  percentage: number | null
  grade: string | null
  status: string | null
  is_declared: boolean
  declared_at: string | null
  created_at: string
  student?: { name: string; registration_no: string; branch_id: string } | null
  paper_set?: { paper_name: string; course_id: string; total_marks: number | null } | null
}

interface AttemptRow {
  id: string
  student_id: string
  paper_set_id: string
  started_at: string | null
  submitted_at: string | null
  is_submitted: boolean
  total_marks_obtained: number | null
  mcq_marks: number | null
  manual_marks: number | null
  is_graded: boolean
  student?: { name: string; registration_no: string } | null
  paper_set?: { paper_name: string; total_marks: number | null; course: { name: string } | null } | null
}

interface ReviewRow {
  question_id: string
  display_order: number
  question_type: string
  question_text_en: string
  question_text_hi: string | null
  topic: string | null
  difficulty: string | null
  marks: number
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: string | null
  expected_answer: string | null
  explanation: string | null
  selected_option: string | null
  answer_text: string | null
  is_correct: boolean | null
  marks_obtained: number | null
  graded_at: string | null
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms <= 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const colHelper = createColumnHelper<ResultRow>()
const attemptColHelper = createColumnHelper<AttemptRow>()

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState<'results' | 'attempts'>('results')
  const [results, setResults] = useState<ResultRow[]>([])
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // View attempt details
  const [viewAttempt, setViewAttempt] = useState<AttemptRow | null>(null)
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null)
  const [loadingReview, setLoadingReview] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { marks: string; saving: boolean }>>({})

  useEffect(() => { fetchData() }, [])

  const loadReview = useCallback(async (attemptId: string) => {
    setLoadingReview(true)
    setReviewRows(null)
    try {
      const { data, error } = await supabase.rpc('get_exam_attempt_review', { p_attempt_id: attemptId })
      if (error) throw error
      const rows = (data ?? []) as ReviewRow[]
      setReviewRows(rows)
      const seed: Record<string, { marks: string; saving: boolean }> = {}
      rows.forEach(r => {
        if (r.question_type === 'short_answer' || r.question_type === 'long_answer') {
          seed[r.question_id] = { marks: r.marks_obtained != null ? String(r.marks_obtained) : '', saving: false }
        }
      })
      setDrafts(seed)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load attempt review')
    } finally { setLoadingReview(false) }
  }, [])

  useEffect(() => {
    if (viewAttempt) loadReview(viewAttempt.id)
    else { setReviewRows(null); setDrafts({}) }
  }, [viewAttempt, loadReview])

  async function saveGrade(qid: string, maxMarks: number) {
    if (!viewAttempt) return
    const d = drafts[qid]
    if (!d) return
    const marks = Number(d.marks)
    if (Number.isNaN(marks) || marks < 0 || marks > maxMarks) {
      toast.error(`Marks must be between 0 and ${maxMarks}`)
      return
    }
    setDrafts(s => ({ ...s, [qid]: { ...s[qid], saving: true } }))
    try {
      const { data, error } = await supabase.rpc('grade_exam_answer', {
        p_attempt_id: viewAttempt.id,
        p_question_id: qid,
        p_marks_awarded: marks,
      })
      if (error) throw error
      const r = data as { mcq_marks: number; manual_marks: number; total_marks: number; pending_written: number; is_graded: boolean }
      toast.success(`Saved · total ${r.total_marks} · ${r.pending_written} pending`)
      // Sync local state
      setReviewRows(rows => rows ? rows.map(x => x.question_id === qid ? { ...x, marks_obtained: marks, is_correct: marks > 0 } : x) : rows)
      setAttempts(arr => arr.map(a => a.id === viewAttempt.id
        ? { ...a, mcq_marks: r.mcq_marks, manual_marks: r.manual_marks, total_marks_obtained: r.total_marks, is_graded: r.is_graded }
        : a))
      setViewAttempt(a => a ? { ...a, mcq_marks: r.mcq_marks, manual_marks: r.manual_marks, total_marks_obtained: r.total_marks, is_graded: r.is_graded } : a)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save grade'
      toast.error(msg)
    } finally {
      setDrafts(s => ({ ...s, [qid]: { ...s[qid], saving: false } }))
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      const [rRes, aRes] = await Promise.all([
        supabase.from('uce_exam_results')
          .select('*, student:uce_students(name, registration_no, branch_id), paper_set:uce_paper_sets(paper_name, course_id, total_marks)')
          .order('created_at', { ascending: false }),
        supabase.from('uce_exam_attempts')
          .select('*, student:uce_students(name, registration_no), paper_set:uce_paper_sets(paper_name, total_marks, course:uce_courses(name))')
          .order('created_at', { ascending: false }),
      ])
      if (rRes.error) throw rRes.error
      if (aRes.error) throw aRes.error
      setResults((rRes.data ?? []) as unknown as ResultRow[])
      setAttempts((aRes.data ?? []) as unknown as AttemptRow[])
    } catch { toast.error('Failed to load exam data') }
    finally { setLoading(false) }
  }

  const filteredResults = useMemo(() => {
    if (!search.trim()) return results
    const q = search.toLowerCase()
    return results.filter(r => {
      const st = r.student as { name: string; registration_no: string } | null
      const ps = r.paper_set as { paper_name: string } | null
      return st?.name.toLowerCase().includes(q) || st?.registration_no.toLowerCase().includes(q) || ps?.paper_name.toLowerCase().includes(q)
    })
  }, [results, search])

  const filteredAttempts = useMemo(() => {
    if (!search.trim()) return attempts
    const q = search.toLowerCase()
    return attempts.filter(a => {
      const st = a.student as { name: string; registration_no: string } | null
      const ps = a.paper_set as { paper_name: string } | null
      return st?.name.toLowerCase().includes(q) || st?.registration_no.toLowerCase().includes(q) || ps?.paper_name.toLowerCase().includes(q)
    })
  }, [attempts, search])

  function getGradeColor(grade: string | null) {
    if (!grade) return 'neutral'
    const g = grade.toUpperCase()
    if (g === 'A+' || g === 'A') return 'success'
    if (g === 'B+' || g === 'B') return 'info'
    if (g === 'C') return 'warning'
    return 'error'
  }

  const resultColumns = useMemo(() => [
    colHelper.display({
      id: 'student', header: 'Student', cell: i => {
        const st = i.row.original.student as { name: string; registration_no: string } | null
        return (
          <div className="min-w-[130px]">
            <p className="text-sm font-medium text-gray-900">{st?.name || '—'}</p>
            <p className="text-xs font-mono text-gray-400">{st?.registration_no || ''}</p>
          </div>
        )
      },
    }),
    colHelper.display({
      id: 'paper', header: 'Paper', cell: i => {
        const ps = i.row.original.paper_set as { paper_name: string } | null
        return <span className="text-sm text-gray-600">{ps?.paper_name || '—'}</span>
      },
    }),
    colHelper.accessor('obtained_marks', {
      header: 'Marks', cell: i => (
        <span className="text-sm font-medium text-gray-900">
          {i.getValue() ?? '—'}<span className="text-gray-400">/{i.row.original.total_marks ?? '—'}</span>
        </span>
      ),
    }),
    colHelper.accessor('percentage', { header: '%', cell: i => <span className="text-sm font-medium text-gray-700">{i.getValue() != null ? `${i.getValue()}%` : '—'}</span> }),
    colHelper.accessor('grade', {
      header: 'Grade', cell: i => i.getValue() ? <StatusBadge label={i.getValue()!} variant={getGradeColor(i.getValue()) as 'success' | 'error' | 'warning' | 'info' | 'neutral'} /> : <span className="text-gray-400">—</span>,
    }),
    colHelper.accessor('status', {
      header: 'Status', cell: i => (
        <StatusBadge label={i.getValue() || 'Pending'} variant={i.getValue() === 'pass' ? 'success' : i.getValue() === 'fail' ? 'error' : 'neutral'} />
      ),
    }),
    colHelper.accessor('is_declared', {
      header: 'Declared', cell: i => (
        <StatusBadge label={i.getValue() ? 'Yes' : 'No'} variant={i.getValue() ? 'success' : 'warning'} />
      ),
    }),
  ], [])

  const attemptColumns = useMemo(() => [
    attemptColHelper.display({
      id: 'student', header: 'Student', cell: i => {
        const st = i.row.original.student as { name: string; registration_no: string } | null
        return (
          <div className="min-w-[130px]">
            <p className="text-sm font-medium text-gray-900">{st?.name || '—'}</p>
            <p className="text-xs font-mono text-gray-400">{st?.registration_no || ''}</p>
          </div>
        )
      },
    }),
    attemptColHelper.display({
      id: 'paper', header: 'Paper', cell: i => {
        const ps = i.row.original.paper_set as { paper_name: string; course: { name: string } | null } | null
        return (
          <div>
            <p className="text-sm text-gray-700">{ps?.paper_name || '—'}</p>
            <p className="text-xs text-gray-400">{ps?.course?.name || ''}</p>
          </div>
        )
      },
    }),
    attemptColHelper.accessor('is_submitted', {
      header: 'Status', cell: i => (
        <StatusBadge
          label={i.getValue() ? 'Submitted' : 'In Progress'}
          variant={i.getValue() ? 'success' : 'warning'}
        />
      ),
    }),
    attemptColHelper.accessor('total_marks_obtained', {
      header: 'Marks', cell: i => {
        const ps = i.row.original.paper_set as { total_marks: number | null } | null
        return (
          <span className="text-sm font-medium text-gray-900">
            {i.getValue() ?? '—'}<span className="text-gray-400">/{ps?.total_marks ?? '—'}</span>
          </span>
        )
      },
    }),
    attemptColHelper.accessor('is_graded', {
      header: 'Graded', cell: i => (
        <StatusBadge label={i.getValue() ? 'Graded' : 'Pending'} variant={i.getValue() ? 'success' : 'neutral'} />
      ),
    }),
    attemptColHelper.accessor('started_at', {
      header: 'Date', cell: i => <span className="text-sm text-gray-600">{i.getValue() ? formatDate(i.getValue()!) : '—'}</span>,
    }),
    attemptColHelper.display({
      id: 'duration', header: 'Time', cell: i => (
        <span className="text-xs text-gray-600">{fmtDuration(i.row.original.started_at, i.row.original.submitted_at)}</span>
      ),
    }),
    attemptColHelper.display({
      id: 'actions', header: '', enableSorting: false, cell: i => (
        <button onClick={() => setViewAttempt(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="View Details"><Eye size={14} /></button>
      ),
    }),
  ], [])

  function exportCSV() {
    const rows = filteredResults.map(r => {
      const st = r.student as { name: string; registration_no: string } | null
      const ps = r.paper_set as { paper_name: string } | null
      return [st?.registration_no, st?.name, ps?.paper_name, r.total_marks, r.obtained_marks, r.percentage, r.grade, r.status, r.is_declared ? 'Yes' : 'No']
    })
    const csv = [['Reg No', 'Student', 'Paper', 'Total Marks', 'Obtained', '%', 'Grade', 'Status', 'Declared'].join(','),
      ...rows.map(r => r.map(c => `"${c || ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `exam-results-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Exam Results & Attempts</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{results.length} results · {attempts.length} attempts</p>
        </div>
        {activeTab === 'results' && results.length > 0 && (
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setActiveTab('results')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'results' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Results ({results.length})
        </button>
        <button onClick={() => setActiveTab('attempts')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'attempts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Attempts ({attempts.length})
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by student or paper..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'results' ? (
        <>
          {/* Mobile results */}
          <div className="md:hidden">
            {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
              : filteredResults.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><BarChart3 size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No results yet</p></div>
              : <div className="space-y-3">{filteredResults.map(r => {
                  const st = r.student as { name: string; registration_no: string } | null
                  const ps = r.paper_set as { paper_name: string } | null
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{st?.name || '—'}</p>
                          <p className="text-xs text-gray-400">{ps?.paper_name || '—'}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {r.grade && <StatusBadge label={r.grade} variant={getGradeColor(r.grade) as 'success' | 'error' | 'warning' | 'info' | 'neutral'} />}
                          <StatusBadge label={r.status || 'Pending'} variant={r.status === 'pass' ? 'success' : r.status === 'fail' ? 'error' : 'neutral'} />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2"><p className="text-[10px] text-gray-400">Marks</p><p className="text-sm font-bold">{r.obtained_marks ?? '—'}/{r.total_marks ?? '—'}</p></div>
                        <div className="bg-gray-50 rounded-lg p-2"><p className="text-[10px] text-gray-400">Percentage</p><p className="text-sm font-bold">{r.percentage != null ? `${r.percentage}%` : '—'}</p></div>
                        <div className="bg-gray-50 rounded-lg p-2"><p className="text-[10px] text-gray-400">Declared</p><p className="text-sm font-bold">{r.is_declared ? 'Yes' : 'No'}</p></div>
                      </div>
                    </div>
                  )
                })}</div>}
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <DataTable data={filteredResults} columns={resultColumns} loading={loading} searchValue="" emptyIcon={<BarChart3 size={36} className="text-gray-300" />} emptyMessage="No results yet" />
          </div>
        </>
      ) : (
        <>
          {/* Mobile attempts */}
          <div className="md:hidden">
            {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
              : filteredAttempts.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Clock size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No attempts yet</p></div>
              : <div className="space-y-3">{filteredAttempts.map(a => {
                  const st = a.student as { name: string; registration_no: string } | null
                  const ps = a.paper_set as { paper_name: string; total_marks: number | null } | null
                  return (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4" onClick={() => setViewAttempt(a)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{st?.name || '—'}</p>
                          <p className="text-xs text-gray-400">{ps?.paper_name || '—'}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <StatusBadge label={a.is_submitted ? 'Submitted' : 'In Progress'} variant={a.is_submitted ? 'success' : 'warning'} />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                        <span>Marks: <b className="text-gray-700">{a.total_marks_obtained ?? '—'}/{ps?.total_marks ?? '—'}</b></span>
                        <span>Graded: <b className={a.is_graded ? 'text-green-600' : 'text-gray-400'}>{a.is_graded ? 'Yes' : 'No'}</b></span>
                      </div>
                    </div>
                  )
                })}</div>}
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <DataTable data={filteredAttempts} columns={attemptColumns} loading={loading} searchValue="" emptyIcon={<Clock size={36} className="text-gray-300" />} emptyMessage="No attempts yet" />
          </div>
        </>
      )}

      {/* View Attempt Modal */}
      <Modal open={!!viewAttempt} onClose={() => setViewAttempt(null)} title="Attempt Review & Grading" size="lg">
        {viewAttempt && (() => {
          const st = viewAttempt.student as { name: string; registration_no: string } | null
          const ps = viewAttempt.paper_set as { paper_name: string; total_marks: number | null; course: { name: string } | null } | null
          const duration = fmtDuration(viewAttempt.started_at, viewAttempt.submitted_at)
          return (
            <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-gray-50 rounded-xl p-3">
                <div><p className="text-xs text-gray-400">Student</p><p className="font-medium truncate">{st?.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Reg No</p><p className="font-mono">{st?.registration_no || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Paper</p><p className="truncate">{ps?.paper_name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Course</p><p className="truncate">{ps?.course?.name || '—'}</p></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">Status</p>
                  <div className="mt-0.5">{viewAttempt.is_submitted ? <CheckCircle size={16} className="mx-auto text-green-500" /> : <Clock size={16} className="mx-auto text-amber-500" />}</div>
                  <p className="text-xs font-medium mt-0.5">{viewAttempt.is_submitted ? 'Submitted' : 'In Progress'}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2">
                  <p className="text-[10px] text-amber-600">Time taken</p>
                  <p className="text-sm font-bold text-amber-700 mt-0.5">{duration}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-[10px] text-blue-600">MCQ marks</p>
                  <p className="text-sm font-bold text-blue-700 mt-0.5">{viewAttempt.mcq_marks ?? 0}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-[10px] text-purple-600">Manual marks</p>
                  <p className="text-sm font-bold text-purple-700 mt-0.5">{viewAttempt.manual_marks ?? 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-[10px] text-green-600">Total</p>
                  <p className="text-sm font-bold text-green-700 mt-0.5">{viewAttempt.total_marks_obtained ?? 0}<span className="text-[10px] text-green-400">/{ps?.total_marks ?? '—'}</span></p>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-0.5">
                {viewAttempt.started_at && <p>Started: {new Date(viewAttempt.started_at).toLocaleString('en-IN')}</p>}
                {viewAttempt.submitted_at && <p>Submitted: {new Date(viewAttempt.submitted_at).toLocaleString('en-IN')}</p>}
                <p>Grading: <span className={viewAttempt.is_graded ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold'}>{viewAttempt.is_graded ? 'Fully graded' : 'Pending review'}</span></p>
              </div>

              {loadingReview ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
              ) : !reviewRows || reviewRows.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">No questions on this paper yet.</div>
              ) : (
                <div className="space-y-3">
                  {reviewRows.map((r, idx) => {
                    const isMcq = r.question_type === 'mcq'
                    const isTF  = r.question_type === 'true_false'
                    const isWritten = r.question_type === 'short_answer' || r.question_type === 'long_answer'
                    const studentLetter = (r.selected_option || '').toUpperCase()
                    const isCorrect = r.is_correct === true
                    const isWrong   = r.is_correct === false
                    const d = drafts[r.question_id] || { marks: '', saving: false }

                    return (
                      <div key={r.question_id} className={`rounded-xl border p-4 space-y-3 ${
                        isWritten ? (r.marks_obtained != null ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30')
                                  : isCorrect ? 'border-green-200 bg-green-50/30'
                                  : isWrong   ? 'border-red-200 bg-red-50/30'
                                  : 'border-gray-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-red-50 text-red-600 text-xs font-bold shrink-0">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{r.question_text_en}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium uppercase">{r.question_type.replace('_',' ')}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">{r.marks} marks</span>
                              {r.topic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{r.topic}</span>}
                              {!isWritten && r.is_correct === true && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium inline-flex items-center gap-1"><CheckCircle2Icon size={10} /> correct</span>}
                              {!isWritten && r.is_correct === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-medium">incorrect</span>}
                              {isWritten && r.marks_obtained != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium inline-flex items-center gap-1"><CheckCircle2Icon size={10} /> graded · {r.marks_obtained}/{r.marks}</span>}
                              {isWritten && r.marks_obtained == null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">pending</span>}
                            </div>
                          </div>
                        </div>

                        {(isMcq || isTF) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {[
                              { key: 'A', val: r.option_a },
                              { key: 'B', val: r.option_b },
                              { key: 'C', val: r.option_c },
                              { key: 'D', val: r.option_d },
                            ].filter(o => o.val).map(o => {
                              const isStudentPick = studentLetter === o.key
                              const isAnswer = (r.correct_answer || '').toUpperCase() === o.key
                              return (
                                <div
                                  key={o.key}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm ${
                                    isAnswer ? 'border-green-300 bg-green-50' :
                                    isStudentPick ? 'border-red-300 bg-red-50' :
                                    'border-gray-200 bg-white'
                                  }`}
                                >
                                  <span className="text-xs font-bold text-gray-400">{o.key}.</span>
                                  <span className="flex-1">{o.val}</span>
                                  {isAnswer && <span className="text-[10px] px-1 py-0.5 rounded bg-green-200 text-green-900 font-semibold">answer</span>}
                                  {isStudentPick && !isAnswer && <span className="text-[10px] px-1 py-0.5 rounded bg-red-200 text-red-900 font-semibold">student</span>}
                                  {isStudentPick && isAnswer && <span className="text-[10px] px-1 py-0.5 rounded bg-green-200 text-green-900 font-semibold">student</span>}
                                </div>
                              )
                            })}
                            {!r.selected_option && (
                              <p className="text-xs text-gray-400 italic">Student did not answer</p>
                            )}
                          </div>
                        )}

                        {isWritten && (
                          <div className="space-y-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Student's answer</p>
                              <div className={`p-3 rounded-lg border text-sm whitespace-pre-wrap min-h-[60px] ${r.answer_text ? 'border-gray-200 bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400 italic'}`}>
                                {r.answer_text || '— No answer submitted —'}
                              </div>
                            </div>
                            {r.expected_answer && (
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Expected / model answer</p>
                                <div className="p-3 rounded-lg border border-green-200 bg-green-50/60 text-sm whitespace-pre-wrap text-green-900">
                                  {r.expected_answer}
                                </div>
                              </div>
                            )}
                            {!r.expected_answer && (
                              <div className="text-xs text-amber-700 inline-flex items-center gap-1"><AlertCircle size={12} /> No expected answer recorded for this question — please update the question bank.</div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-[140px_auto] gap-2 items-end">
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
                              <button
                                onClick={() => saveGrade(r.question_id, Number(r.marks))}
                                disabled={d.saving}
                                className="px-3 py-2.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5 justify-self-start"
                              >
                                {d.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save grade
                              </button>
                            </div>
                          </div>
                        )}

                        {r.explanation && (
                          <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 text-xs text-blue-900 whitespace-pre-wrap">
                            <span className="font-semibold">Explanation: </span>{r.explanation}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
