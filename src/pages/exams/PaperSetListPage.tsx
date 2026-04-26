import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  ClipboardList, Plus, Search, X, Pencil, Trash2, Power,
  Clock, HelpCircle, Award,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'

interface PaperSet {
  id: string
  course_id: string
  semester: number | null
  subject_id: string | null
  category: string | null
  paper_name: string
  total_questions: number
  marks_per_question: number | null
  total_marks: number | null
  minus_marking: boolean
  minus_marks: number | null
  time_limit_minutes: number
  available_from: string | null
  available_to: string | null
  is_mock_test: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  course?: { name: string; code: string } | null
  subject?: { name: string; code: string | null } | null
  question_count?: number
}

const colHelper = createColumnHelper<PaperSet>()

export default function PaperSetListPage() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<PaperSet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [delTarget, setDelTarget] = useState<PaperSet | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchPapers() }, [])

  async function fetchPapers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_paper_sets')
        .select('*, course:uce_courses(name, code), subject:uce_subjects(name, code)')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Get question counts per paper
      const ids = (data ?? []).map((p: { id: string }) => p.id)
      let qCounts: Record<string, number> = {}
      if (ids.length > 0) {
        const { data: qData } = await supabase
          .from('uce_questions')
          .select('paper_set_id')
          .in('paper_set_id', ids)
        if (qData) {
          qData.forEach((q: { paper_set_id: string }) => {
            qCounts[q.paper_set_id] = (qCounts[q.paper_set_id] || 0) + 1
          })
        }
      }

      setPapers((data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        question_count: qCounts[(p as { id: string }).id] || 0,
      })) as unknown as PaperSet[])
    } catch { toast.error('Failed to load paper sets') }
    finally { setLoading(false) }
  }

  async function toggleActive(p: PaperSet) {
    const ns = !p.is_active
    const { error } = await supabase.from('uce_paper_sets').update({ is_active: ns }).eq('id', p.id)
    if (error) { toast.error('Failed'); return }
    toast.success(`Paper ${ns ? 'activated' : 'deactivated'}`)
    setPapers(prev => prev.map(x => x.id === p.id ? { ...x, is_active: ns } : x))
  }

  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      // Delete questions first
      await supabase.from('uce_questions').delete().eq('paper_set_id', delTarget.id)
      const { error } = await supabase.from('uce_paper_sets').delete().eq('id', delTarget.id)
      if (error) throw error
      toast.success('Paper set deleted')
      setPapers(p => p.filter(x => x.id !== delTarget.id))
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDelTarget(null) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return papers
    const q = search.toLowerCase()
    return papers.filter(p =>
      p.paper_name.toLowerCase().includes(q) ||
      (p.course as { name: string } | null)?.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    )
  }, [papers, search])

  const columns = useMemo(() => [
    colHelper.accessor('paper_name', {
      header: 'Paper Name', cell: i => {
        const subj = (i.row.original.subject as { name: string } | null)?.name
        const sem = i.row.original.semester
        const isLegacy = !sem || !subj
        return (
          <div className="min-w-[150px]">
            <p className="text-sm font-medium text-gray-900">{i.getValue()}</p>
            <p className="text-xs text-gray-400">
              {(i.row.original.course as { name: string } | null)?.name || '—'}
              {sem ? ` · Sem ${sem}` : ''}
              {subj ? ` · ${subj}` : ''}
              {isLegacy && <span className="ml-1 text-amber-600">(Legacy)</span>}
            </p>
          </div>
        )
      },
    }),
    colHelper.accessor('category', { header: 'Category', cell: i => <span className="text-sm text-gray-600">{i.getValue() || '—'}</span> }),
    colHelper.display({
      id: 'questions', header: 'Questions', cell: i => (
        <div className="text-sm">
          <span className="font-medium text-gray-900">{i.row.original.question_count}</span>
          <span className="text-gray-400"> / {i.row.original.total_questions}</span>
        </div>
      ),
    }),
    colHelper.accessor('total_marks', { header: 'Marks', cell: i => <span className="text-sm font-medium text-gray-700">{i.getValue() || '—'}</span> }),
    colHelper.accessor('time_limit_minutes', { header: 'Duration', cell: i => <span className="text-sm text-gray-600">{i.getValue()} min</span> }),
    colHelper.display({
      id: 'type', header: 'Type', cell: i => (
        <StatusBadge label={i.row.original.is_mock_test ? 'Mock Test' : 'Exam'} variant={i.row.original.is_mock_test ? 'warning' : 'info'} />
      ),
    }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({
      id: 'actions', header: '', enableSorting: false, cell: i => (
        <div className="flex gap-1">
          <button onClick={() => navigate(`/admin/exams/paper-sets/${i.row.original.id}/questions`)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Manage Questions"><HelpCircle size={14} /></button>
          <button onClick={() => navigate(`/admin/exams/paper-sets/${i.row.original.id}/edit`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Edit"><Pencil size={14} /></button>
          <button onClick={() => toggleActive(i.row.original)} className={`p-1.5 rounded-lg ${i.row.original.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`} title={i.row.original.is_active ? 'Deactivate' : 'Activate'}><Power size={14} /></button>
          <button onClick={() => setDelTarget(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    }),
  ], [])

  function PaperCard({ p }: { p: PaperSet }) {
    const course = p.course as { name: string; code: string } | null
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', !p.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{p.paper_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {course?.name || '—'}
              {p.semester ? ` · Sem ${p.semester}` : ''}
              {(p.subject as { name: string } | null)?.name ? ` · ${(p.subject as { name: string }).name}` : ''}
              {p.category ? ` · ${p.category}` : ''}
              {(!p.semester || !p.subject_id) && <span className="ml-1 text-amber-600">(Legacy)</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge label={p.is_mock_test ? 'Mock' : 'Exam'} variant={p.is_mock_test ? 'warning' : 'info'} />
            <StatusBadge label={p.is_active ? 'Active' : 'Off'} variant={p.is_active ? 'success' : 'error'} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg p-2">
            <HelpCircle size={14} className="mx-auto text-gray-400 mb-0.5" />
            <p className="text-xs text-gray-400">Questions</p>
            <p className="text-sm font-semibold text-gray-900">{p.question_count}/{p.total_questions}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <Award size={14} className="mx-auto text-gray-400 mb-0.5" />
            <p className="text-xs text-gray-400">Marks</p>
            <p className="text-sm font-semibold text-gray-900">{p.total_marks || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <Clock size={14} className="mx-auto text-gray-400 mb-0.5" />
            <p className="text-xs text-gray-400">Duration</p>
            <p className="text-sm font-semibold text-gray-900">{p.time_limit_minutes}m</p>
          </div>
        </div>
        <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
          <button onClick={() => navigate(`/admin/exams/paper-sets/${p.id}/questions`)} className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50"><HelpCircle size={15} /></button>
          <button onClick={() => navigate(`/admin/exams/paper-sets/${p.id}/edit`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={15} /></button>
          <button onClick={() => toggleActive(p)} className={`p-1.5 rounded-lg ${p.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={15} /></button>
          <button onClick={() => setDelTarget(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Paper Sets</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{papers.length} paper sets</p>
        </div>
        <button onClick={() => navigate('/admin/exams/paper-sets/new')} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Create</span> Paper
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search papers..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-36 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><ClipboardList size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No paper sets found</p></div>
          : <div className="space-y-3">{filtered.map(p => <PaperCard key={p.id} p={p} />)}</div>}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<ClipboardList size={36} className="text-gray-300" />} emptyMessage="No paper sets found" />
      </div>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}
        title="Delete Paper Set?" message={`"${delTarget?.paper_name}" and all its questions will be permanently deleted.`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
