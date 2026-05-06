import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import {
  BookOpen, Plus, Search, X, Pencil, Power, BookText,
  IndianRupee, Clock, Trash2, AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatINR, cn } from '../../lib/utils'
import type { Course, Program } from '../../types'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'

interface CourseWithProgram extends Course { program?: { name: string } | null }
const colHelper = createColumnHelper<CourseWithProgram>()

export default function CourseListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const programParam = searchParams.get('program') || 'all'

  const [courses, setCourses] = useState<CourseWithProgram[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [progFilter, setProgFilter] = useState(programParam)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Action sheet
  const [actionCourse, setActionCourse] = useState<CourseWithProgram | null>(null)

  // Delete
  const [delTarget, setDelTarget] = useState<CourseWithProgram | null>(null)
  const [delConfirm, setDelConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchData() }, [])
  useEffect(() => { setProgFilter(programParam) }, [programParam])

  async function fetchData() {
    setLoading(true)
    try {
      const [cRes, pRes] = await Promise.all([
        supabase.from('uce_courses').select('*, program:uce_programs(name)').order('display_order').order('name'),
        supabase.from('uce_programs').select('*').eq('is_active', true).order('name'),
      ])
      if (cRes.error) throw cRes.error
      setCourses((cRes.data as unknown as CourseWithProgram[]) ?? [])
      setPrograms(pRes.data ?? [])
    } catch { toast.error('Failed to load courses') }
    finally { setLoading(false) }
  }

  async function toggleActive(c: CourseWithProgram) {
    const ns = !c.is_active
    const { error } = await supabase.from('uce_courses').update({ is_active: ns, updated_at: new Date().toISOString() }).eq('id', c.id)
    if (error) { toast.error('Failed'); return }
    toast.success(`${c.name} ${ns ? 'activated' : 'deactivated'}`)
    setCourses(p => p.map(x => x.id === c.id ? { ...x, is_active: ns } : x))
  }

  async function handleDelete() {
    if (!delTarget) return
    if (delConfirm.trim() !== delTarget.name) { toast.error('Course name does not match'); return }
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_courses').delete().eq('id', delTarget.id)
      if (error) throw error
      toast.success(`Course "${delTarget.name}" deleted`)
      setCourses(p => p.filter(c => c.id !== delTarget.id))
      setDelTarget(null); setDelConfirm('')
    } catch (err) { toast.error((err as Error).message || 'Failed to delete course') }
    finally { setDeleting(false) }
  }

  const filtered = useMemo(() => {
    let r = courses
    if (progFilter !== 'all') r = r.filter(c => c.program_id === progFilter)
    if (statusFilter === 'active') r = r.filter(c => c.is_active)
    else if (statusFilter === 'inactive') r = r.filter(c => !c.is_active)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) }
    return r
  }, [courses, progFilter, statusFilter, search])

  const activeProgramName = useMemo(() => {
    if (progFilter === 'all') return null
    return programs.find(p => p.id === progFilter)?.name || null
  }, [progFilter, programs])

  function updateProgramFilter(next: string) {
    setProgFilter(next)
    const sp = new URLSearchParams(searchParams)
    if (next === 'all') sp.delete('program')
    else sp.set('program', next)
    setSearchParams(sp, { replace: true })
  }

  const columns = useMemo(() => [
    colHelper.accessor('code', { header: 'Code', cell: i => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{i.getValue()}</span> }),
    colHelper.accessor('name', { header: 'Course Name', cell: i => <span className="text-sm font-medium text-gray-900">{i.getValue()}</span> }),
    colHelper.display({ id: 'program', header: 'Program', cell: i => <span className="text-sm text-gray-600">{(i.row.original.program as { name: string } | null)?.name || '—'}</span> }),
    colHelper.accessor('duration_months', { header: 'Duration', cell: i => <span className="text-sm text-gray-600">{i.getValue() ? `${i.getValue()} Mo` : '—'}</span> }),
    colHelper.accessor('total_fee', { header: 'Fee', cell: i => <span className="text-sm font-medium text-gray-700">{formatINR(i.getValue())}</span> }),
    colHelper.accessor('certification_fee', { header: 'Cert Fee', cell: i => <span className="text-sm text-amber-600 font-medium">{formatINR(i.getValue())}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => {
      const c = i.row.original
      return (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/admin/courses/${c.id}/edit`)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
          <button onClick={() => navigate(`/admin/courses/subjects?course=${c.id}`)} title="Subjects" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><BookText size={14} /></button>
          <button onClick={() => toggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg ${c.is_active ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={14} /></button>
          <button onClick={() => { setDelTarget(c); setDelConfirm('') }} title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      )
    }}),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate])

  function CourseCard({ course: c }: { course: CourseWithProgram }) {
    const prog = c.program as { name: string } | null
    return (
      <button
        onClick={() => setActionCourse(c)}
        className={cn(
          'w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-red-200 hover:shadow-sm active:scale-[0.99] transition-all',
          !c.is_active && 'opacity-60'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
            <p className="text-xs font-mono text-gray-400">{c.code}</p>
          </div>
          <StatusBadge label={c.is_active ? 'Active' : 'Inactive'} variant={c.is_active ? 'success' : 'error'} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-gray-500">
          {prog && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{prog.name}</span>}
          {c.duration_months && <span className="flex items-center gap-1"><Clock size={11} />{c.duration_months} Mo</span>}
        </div>
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-1"><IndianRupee size={12} />{c.total_fee.toLocaleString('en-IN')}</span>
            <span className="text-xs text-amber-600 font-medium">Cert: {formatINR(c.certification_fee)}</span>
          </div>
          <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">Actions <ChevronRight size={14} /></span>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">
            {activeProgramName ? `Courses — ${activeProgramName}` : 'Manage Courses'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {filtered.length} course{filtered.length === 1 ? '' : 's'}
            {progFilter !== 'all' && (
              <button onClick={() => updateProgramFilter('all')} className="ml-2 text-red-600 hover:underline">Clear filter</button>
            )}
          </p>
        </div>
        <button onClick={() => navigate('/admin/courses/new')} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> <span className="hidden sm:inline">Add</span> Course</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <select value={progFilter} onChange={e => updateProgramFilter(e.target.value)} className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="all">All Programs</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-36 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><BookOpen size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No courses found</p></div>
          : <div className="space-y-3">{filtered.map(c => <CourseCard key={c.id} course={c} />)}</div>}
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable
          data={filtered}
          columns={columns}
          loading={loading}
          searchValue=""
          onRowClick={(c) => setActionCourse(c)}
          emptyIcon={<BookOpen size={36} className="text-gray-300" />}
          emptyMessage="No courses found"
        />
      </div>

      {/* Action Sheet — click row to open */}
      {actionCourse && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-in fade-in duration-150" onClick={() => setActionCourse(null)}>
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl safe-bottom animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0"><BookOpen size={20} className="text-red-500" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 truncate">{actionCourse.name}</h3>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{actionCourse.code}</p>
              </div>
              <button onClick={() => setActionCourse(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <ActionBtn icon={<Pencil size={18} />} label="Edit Course" color="gray" onClick={() => { navigate(`/admin/courses/${actionCourse.id}/edit`); setActionCourse(null) }} />
              <ActionBtn icon={<BookText size={18} />} label="Subjects" color="blue" onClick={() => { navigate(`/admin/courses/subjects?course=${actionCourse.id}`); setActionCourse(null) }} />
              <ActionBtn
                icon={<Power size={18} />}
                label={actionCourse.is_active ? 'Deactivate' : 'Activate'}
                color={actionCourse.is_active ? 'amber' : 'green'}
                onClick={() => { toggleActive(actionCourse); setActionCourse(null) }}
              />
              <ActionBtn
                icon={<Trash2 size={18} />}
                label="Delete"
                color="red"
                className="col-span-2"
                onClick={() => { setDelTarget(actionCourse); setDelConfirm(''); setActionCourse(null) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Modal */}
      {delTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => !deleting && setDelTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900">Delete Course Permanently?</h3>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
              <button onClick={() => setDelTarget(null)} disabled={deleting} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                <p className="font-semibold mb-1.5">The following will be permanently deleted:</p>
                <ul className="space-y-1">
                  <li>• Course <b>{delTarget.name}</b> ({delTarget.code})</li>
                  <li>• All subjects, batches, paper sets, and syllabus for this course</li>
                  <li>• All student records, marksheets, certificates, and admit cards tied to this course</li>
                  <li>• All study materials and online classes for this course</li>
                </ul>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Type <span className="font-mono font-bold text-red-600">{delTarget.name}</span> to confirm:
                </label>
                <input
                  value={delConfirm}
                  onChange={e => setDelConfirm(e.target.value)}
                  placeholder="Course name"
                  disabled={deleting}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setDelTarget(null)} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || delConfirm.trim() !== delTarget.name}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 size={16} className="animate-spin" />}
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Action tile ─── */
function ActionBtn({ icon, label, color, onClick, className }: {
  icon: React.ReactNode; label: string; color: 'gray'|'blue'|'purple'|'amber'|'green'|'red'; onClick: () => void; className?: string
}) {
  const map: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-700 hover:bg-gray-100',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    red: 'bg-red-50 text-red-700 hover:bg-red-100',
  }
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center justify-center gap-1.5 px-3 py-4 rounded-xl text-xs font-medium transition-colors', map[color], className)}>
      {icon}
      <span>{label}</span>
    </button>
  )
}
