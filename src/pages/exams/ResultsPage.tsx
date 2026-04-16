import { useEffect, useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  BarChart3, Search, X, Download, Eye, CheckCircle, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

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

  useEffect(() => { fetchData() }, [])

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
      <Modal open={!!viewAttempt} onClose={() => setViewAttempt(null)} title="Attempt Details" size="md">
        {viewAttempt && (() => {
          const st = viewAttempt.student as { name: string; registration_no: string } | null
          const ps = viewAttempt.paper_set as { paper_name: string; total_marks: number | null; course: { name: string } | null } | null
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Student</p><p className="font-medium">{st?.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Reg No</p><p className="font-mono">{st?.registration_no || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Paper</p><p>{ps?.paper_name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Course</p><p>{ps?.course?.name || '—'}</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Status</p>
                  <div className="mt-1">{viewAttempt.is_submitted ? <CheckCircle size={20} className="mx-auto text-green-500" /> : <Clock size={20} className="mx-auto text-amber-500" />}</div>
                  <p className="text-xs font-medium mt-1">{viewAttempt.is_submitted ? 'Submitted' : 'In Progress'}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">MCQ Marks</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">{viewAttempt.mcq_marks ?? 0}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600">Manual Marks</p>
                  <p className="text-lg font-bold text-purple-700 mt-1">{viewAttempt.manual_marks ?? 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">Total</p>
                  <p className="text-lg font-bold text-green-700 mt-1">{viewAttempt.total_marks_obtained ?? 0}<span className="text-sm text-green-400">/{ps?.total_marks ?? '—'}</span></p>
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                {viewAttempt.started_at && <p>Started: {new Date(viewAttempt.started_at).toLocaleString('en-IN')}</p>}
                {viewAttempt.submitted_at && <p>Submitted: {new Date(viewAttempt.submitted_at).toLocaleString('en-IN')}</p>}
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
