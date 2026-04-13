import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { BookOpen, Plus, Search, X, Pencil, Power, BookText, Layers, IndianRupee, Clock } from 'lucide-react'
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
  const [courses, setCourses] = useState<CourseWithProgram[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [progFilter, setProgFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => { fetchData() }, [])

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

  const filtered = useMemo(() => {
    let r = courses
    if (progFilter !== 'all') r = r.filter(c => c.program_id === progFilter)
    if (statusFilter === 'active') r = r.filter(c => c.is_active)
    else if (statusFilter === 'inactive') r = r.filter(c => !c.is_active)
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) }
    return r
  }, [courses, progFilter, statusFilter, search])

  const columns = useMemo(() => [
    colHelper.accessor('code', { header: 'Code', cell: i => <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">{i.getValue()}</span> }),
    colHelper.accessor('name', { header: 'Course Name', cell: i => <span className="text-sm font-medium text-gray-900 min-w-[140px] block">{i.getValue()}</span> }),
    colHelper.display({ id: 'program', header: 'Program', cell: i => <span className="text-sm text-gray-600">{(i.row.original.program as { name: string } | null)?.name || '—'}</span> }),
    colHelper.accessor('duration_months', { header: 'Duration', cell: i => <span className="text-sm text-gray-600">{i.getValue() ? `${i.getValue()} Mo` : '—'}</span> }),
    colHelper.accessor('total_fee', { header: 'Fee', cell: i => <span className="text-sm font-medium text-gray-700">{formatINR(i.getValue())}</span> }),
    colHelper.accessor('certification_fee', { header: 'Cert Fee', cell: i => <span className="text-sm text-amber-600 font-medium">{formatINR(i.getValue())}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => {
      const c = i.row.original
      return (
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/admin/courses/${c.id}/edit`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
          <button onClick={() => navigate(`/admin/courses/subjects?course=${c.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Subjects"><BookText size={14} /></button>
          <button onClick={() => navigate(`/admin/courses/batches?course=${c.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50" title="Batches"><Layers size={14} /></button>
          <button onClick={() => toggleActive(c)} className={`p-1.5 rounded-lg ${c.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={14} /></button>
        </div>
      )
    }}),
  ], [navigate])

  function CourseCard({ course: c }: { course: CourseWithProgram }) {
    const prog = c.program as { name: string } | null
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', !c.is_active && 'opacity-60')}>
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
          <div className="flex gap-1">
            <button onClick={() => navigate(`/admin/courses/${c.id}/edit`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
            <button onClick={() => navigate(`/admin/courses/subjects?course=${c.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><BookText size={14} /></button>
            <button onClick={() => navigate(`/admin/courses/batches?course=${c.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50"><Layers size={14} /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Manage Courses</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{courses.length} total courses</p></div>
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
            <select value={progFilter} onChange={e => setProgFilter(e.target.value)} className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
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
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<BookOpen size={36} className="text-gray-300" />} emptyMessage="No courses found" />
      </div>
    </div>
  )
}
