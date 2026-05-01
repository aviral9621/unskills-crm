import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, Briefcase, Loader2, Trash2, Pencil, Star, Eye, Users as UsersIcon,
  Search, MapPin, Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'
import Modal from '../../components/Modal'
import FormField, { inputClass, selectClass } from '../../components/FormField'

const JOB_TYPES = ['full_time', 'part_time', 'internship', 'contract', 'freelance']
const WORK_MODES = ['onsite', 'remote', 'hybrid']
const STATUS_OPTIONS = ['open', 'closed', 'draft']

interface JobRow {
  id: string
  title: string
  company: string | null
  location: string | null
  job_type: string | null
  work_mode: string | null
  description: string | null
  apply_url: string | null
  contact_info: string | null
  deadline: string | null
  is_active: boolean
  branch_id: string | null
  branch_ids: string[] | null
  posted_by: string | null
  created_at: string
  salary_min: number | null
  salary_max: number | null
  salary_text: string | null
  experience_min: number | null
  experience_max: number | null
  experience_text: string | null
  qualification: string | null
  skills_required: string[] | null
  related_course_ids: string[] | null
  status: string
  approval_status: string
  is_featured: boolean
  openings: number | null
  applications_count: number
  views_count: number
  branch?: { name: string } | null
}

interface BranchOpt { id: string; name: string }
interface CourseOpt { id: string; code: string; name: string }

const EMPTY_FORM = {
  title: '', company: '', location: '', job_type: 'full_time', work_mode: 'onsite',
  description: '', apply_url: '', contact_info: '', deadline: '',
  salary_min: '', salary_max: '', salary_text: '',
  experience_min: '', experience_max: '', experience_text: '',
  qualification: '',
  skills_required_text: '',
  related_course_ids: [] as string[],
  openings: '',
  status: 'open',
  is_featured: false,
  // Empty array = visible to ALL branches (org-wide).
  // Non-empty = visible only to applicants from those branches.
  branch_ids: [] as string[],
}

export default function AdminJobsPage() {
  const { user, profile } = useAuth()
  const isSuper = profile?.role === 'super_admin'

  const [rows, setRows] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<BranchOpt[]>([])
  const [courses, setCourses] = useState<CourseOpt[]>([])

  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterBranch, setFilterBranch] = useState<string>('')
  const [filterMode, setFilterMode] = useState<string>('')
  const [filterFeatured, setFilterFeatured] = useState<boolean>(false)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<JobRow | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('uce_jobs')
      .select('*, branch:uce_branches(name)')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
    setRows((data ?? []) as JobRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase.from('uce_branches').select('id, name').order('name')
      .then(({ data }) => setBranches((data ?? []) as BranchOpt[]))
    supabase.from('uce_courses').select('id, code, name').order('name')
      .then(({ data }) => setCourses((data ?? []) as CourseOpt[]))
  }, [])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false
      if (filterBranch) {
        const list = r.branch_ids && r.branch_ids.length > 0 ? r.branch_ids : (r.branch_id ? [r.branch_id] : [])
        // Empty list = org-wide (always matches), otherwise must include the filter branch
        if (list.length > 0 && !list.includes(filterBranch)) return false
      }
      if (filterMode && r.work_mode !== filterMode) return false
      if (filterFeatured && !r.is_featured) return false
      if (search) {
        const s = search.toLowerCase()
        if (!(r.title?.toLowerCase().includes(s) || r.company?.toLowerCase().includes(s) || r.location?.toLowerCase().includes(s))) {
          return false
        }
      }
      return true
    })
  }, [rows, filterStatus, filterBranch, filterMode, filterFeatured, search])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  function openEdit(r: JobRow) {
    setEditing(r)
    const initialBranchIds = r.branch_ids && r.branch_ids.length > 0
      ? r.branch_ids
      : (r.branch_id ? [r.branch_id] : [])
    setForm({
      title: r.title || '', company: r.company || '', location: r.location || '',
      job_type: r.job_type || 'full_time', work_mode: r.work_mode || 'onsite',
      description: r.description || '', apply_url: r.apply_url || '', contact_info: r.contact_info || '',
      deadline: r.deadline || '',
      salary_min: r.salary_min?.toString() || '', salary_max: r.salary_max?.toString() || '',
      salary_text: r.salary_text || '',
      experience_min: r.experience_min?.toString() || '', experience_max: r.experience_max?.toString() || '',
      experience_text: r.experience_text || '',
      qualification: r.qualification || '',
      skills_required_text: (r.skills_required ?? []).join(', '),
      related_course_ids: r.related_course_ids ?? [],
      openings: r.openings?.toString() || '',
      status: r.status || 'open',
      is_featured: r.is_featured,
      branch_ids: initialBranchIds,
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.title.trim()) return toast.error('Title required')
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      company: form.company.trim() || null,
      location: form.location.trim() || null,
      job_type: form.job_type || null,
      work_mode: form.work_mode || null,
      description: form.description.trim() || null,
      apply_url: form.apply_url.trim() || null,
      contact_info: form.contact_info.trim() || null,
      deadline: form.deadline || null,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      salary_text: form.salary_text.trim() || null,
      experience_min: form.experience_min ? Number(form.experience_min) : null,
      experience_max: form.experience_max ? Number(form.experience_max) : null,
      experience_text: form.experience_text.trim() || null,
      qualification: form.qualification.trim() || null,
      skills_required: form.skills_required_text
        ? form.skills_required_text.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      related_course_ids: form.related_course_ids,
      openings: form.openings ? Number(form.openings) : null,
      status: form.status,
      is_featured: form.is_featured,
      branch_ids: form.branch_ids,
      // Keep legacy branch_id in sync for any older path that still reads it.
      branch_id: form.branch_ids.length === 1 ? form.branch_ids[0] : null,
      // Super admin posts auto-approved; branch posts go pending
      approval_status: isSuper ? 'approved' : 'pending',
      is_active: form.status === 'open',
    }

    let err: { message: string } | null = null
    let newJobId: string | null = null
    if (editing) {
      const { error } = await supabase.from('uce_jobs').update(payload).eq('id', editing.id)
      err = error
      newJobId = editing.id
    } else {
      const { data, error } = await supabase.from('uce_jobs')
        .insert({ ...payload, posted_by: user?.id || null })
        .select('id')
        .single()
      err = error
      newJobId = data?.id ?? null
    }

    if (err) {
      setSaving(false)
      return toast.error(err.message)
    }

    // Notify matching students (best-effort, non-blocking)
    if (!editing && newJobId && form.related_course_ids.length > 0 && form.status === 'open') {
      void notifyMatchingStudents(newJobId, form.related_course_ids, form.title.trim(), form.branch_ids)
    }

    setSaving(false)
    setModalOpen(false)
    toast.success(editing ? 'Job updated' : 'Job posted')
    load()
  }

  async function notifyMatchingStudents(
    jobId: string,
    courseIds: string[],
    title: string,
    branchIds: string[],
  ) {
    let q = supabase.from('uce_students').select('auth_user_id, branch_id').in('course_id', courseIds)
    if (branchIds.length > 0) q = q.in('branch_id', branchIds)
    const { data } = await q
    if (!data?.length) return
    const rows = data
      .filter((s: { auth_user_id: string | null }) => s.auth_user_id)
      .map((s: { auth_user_id: string | null; branch_id: string | null }) => ({
        student_id: s.auth_user_id,
        branch_id: s.branch_id,
        channel: 'inapp',
        template: 'job_alert',
        payload: { job_id: jobId, title, message: `New job posted: ${title}` },
        status: 'queued',
      }))
    if (rows.length) {
      await supabase.from('uce_notifications_log').insert(rows)
    }
  }

  async function toggleFeatured(r: JobRow) {
    await supabase.from('uce_jobs').update({ is_featured: !r.is_featured }).eq('id', r.id)
    load()
  }

  async function setStatus(r: JobRow, status: string) {
    await supabase.from('uce_jobs').update({ status, is_active: status === 'open' }).eq('id', r.id)
    load()
  }

  async function approve(r: JobRow, approve: boolean) {
    await supabase.from('uce_jobs').update({
      approval_status: approve ? 'approved' : 'rejected',
      approved_by: user?.id || null,
      approved_at: new Date().toISOString(),
    }).eq('id', r.id)
    load()
  }

  async function remove(r: JobRow) {
    if (!confirm(`Permanently delete "${r.title}"?`)) return
    const { error } = await supabase.from('uce_jobs').delete().eq('id', r.id)
    if (error) return toast.error(error.message)
    toast.success('Deleted')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Job Posting</h1>
          <p className="text-sm text-gray-500">
            Manage all jobs across branches. Public jobs appear on the website careers page and student panel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/job-applications"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            <UsersIcon size={16} /> All Applications
          </Link>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
          >
            <Plus size={16} /> Post Job
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title / company / location"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className={selectClass} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
          <option value="">All work modes</option>
          {WORK_MODES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className={selectClass} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="">All branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700">
          <input type="checkbox" checked={filterFeatured} onChange={e => setFilterFeatured(e.target.checked)} className="h-4 w-4" />
          Featured only
        </label>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          <Briefcase size={28} className="mx-auto mb-2 text-gray-300" />
          No jobs match the current filters.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map(r => (
            <div key={r.id} className={`rounded-xl border bg-white p-4 ${r.is_featured ? 'ring-1 ring-amber-300' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {r.is_featured && <Star size={14} className="text-amber-500 fill-amber-400" />}
                    <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {r.company || '—'}
                    {r.location && (<> · <MapPin size={11} className="inline" /> {r.location}</>)}
                  </p>
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {(() => {
                      const ids = r.branch_ids && r.branch_ids.length > 0 ? r.branch_ids : (r.branch_id ? [r.branch_id] : [])
                      if (ids.length === 0) {
                        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">All branches</span>
                      }
                      const names = ids.map(id => branches.find(b => b.id === id)?.name).filter(Boolean) as string[]
                      const visible = names.slice(0, 3)
                      const extra = names.length - visible.length
                      return (
                        <>
                          {visible.map(n => (
                            <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">{n}</span>
                          ))}
                          {extra > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">+{extra} more</span>}
                        </>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    r.status === 'open' ? 'bg-emerald-50 text-emerald-700' :
                    r.status === 'closed' ? 'bg-gray-100 text-gray-500' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>{r.status}</span>
                  {r.approval_status !== 'approved' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700">{r.approval_status}</span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-gray-600">
                {r.job_type && <span className="px-2 py-0.5 rounded bg-gray-100">{r.job_type.replace('_', ' ')}</span>}
                {r.work_mode && <span className="px-2 py-0.5 rounded bg-gray-100">{r.work_mode}</span>}
                {(r.salary_text || r.salary_min) && (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    ₹ {r.salary_text || `${r.salary_min ?? ''}${r.salary_max ? `–${r.salary_max}` : ''}`}
                  </span>
                )}
                {r.qualification && <span className="px-2 py-0.5 rounded bg-gray-100">{r.qualification}</span>}
                {r.openings && <span className="px-2 py-0.5 rounded bg-gray-100">{r.openings} opening{r.openings > 1 ? 's' : ''}</span>}
              </div>

              {r.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{r.description}</p>}

              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-gray-500 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Clock size={11} /> {formatDateDDMMYYYY(r.created_at)}</span>
                  {r.deadline && <span>By {formatDateDDMMYYYY(r.deadline)}</span>}
                  <span className="flex items-center gap-1"><Eye size={11} />{r.views_count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/admin/jobs/${r.id}/applications`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                  >
                    <UsersIcon size={12} /> {r.applications_count}
                  </Link>
                  <button title="Toggle featured" onClick={() => toggleFeatured(r)}
                    className={`p-1.5 rounded-lg hover:bg-amber-50 ${r.is_featured ? 'text-amber-500' : 'text-gray-400'}`}>
                    <Star size={14} className={r.is_featured ? 'fill-amber-400' : ''} />
                  </button>
                  <button title="Edit" onClick={() => openEdit(r)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                    <Pencil size={14} />
                  </button>
                  <button title="Delete" onClick={() => remove(r)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.status !== 'open' && (
                  <button onClick={() => setStatus(r, 'open')} className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                    Open
                  </button>
                )}
                {r.status !== 'closed' && (
                  <button onClick={() => setStatus(r, 'closed')} className="text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                    Close
                  </button>
                )}
                {isSuper && r.approval_status === 'pending' && (
                  <>
                    <button onClick={() => approve(r, true)} className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Approve</button>
                    <button onClick={() => approve(r, false)} className="text-[11px] px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100">Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Job' : 'Post a Job'} size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <FormField label="Title" required>
            <input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Company / Hiring Org">
              <input className={inputClass} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            </FormField>
            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="City, State" />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Job Type">
              <select className={selectClass} value={form.job_type} onChange={e => setForm({ ...form, job_type: e.target.value })}>
                {JOB_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </FormField>
            <FormField label="Work Mode">
              <select className={selectClass} value={form.work_mode} onChange={e => setForm({ ...form, work_mode: e.target.value })}>
                {WORK_MODES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Openings">
              <input type="number" min={1} className={inputClass} value={form.openings} onChange={e => setForm({ ...form, openings: e.target.value })} />
            </FormField>
          </div>

          <FormField
            label="Visible to branches"
            hint={form.branch_ids.length === 0
              ? 'No branches selected — visible to applicants of ALL branches (org-wide).'
              : `Visible only to applicants of ${form.branch_ids.length} selected branch${form.branch_ids.length === 1 ? '' : 'es'}.`}
          >
            <div className="rounded-lg border border-gray-300 bg-white p-2 space-y-2">
              {form.branch_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.branch_ids.map(id => {
                    const b = branches.find(x => x.id === id)
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                        {b?.name || id.slice(0, 6)}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, branch_ids: f.branch_ids.filter(x => x !== id) }))}
                          className="hover:text-red-900"
                          aria-label="Remove branch"
                        >×</button>
                      </span>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, branch_ids: [] }))}
                    className="text-xs text-gray-500 hover:text-gray-800 underline"
                  >Clear all</button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, branch_ids: branches.map(b => b.id) }))}
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                >Select all branches</button>
                <span className="text-gray-400">{form.branch_ids.length}/{branches.length} selected</span>
              </div>
              <div className="max-h-48 overflow-y-auto border-t border-gray-100 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {branches.map(b => {
                  const checked = form.branch_ids.includes(b.id)
                  return (
                    <label key={b.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${checked ? 'bg-red-50 text-red-800' : 'hover:bg-gray-50 text-gray-700'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setForm(f => ({
                          ...f,
                          branch_ids: e.target.checked
                            ? [...f.branch_ids, b.id]
                            : f.branch_ids.filter(x => x !== b.id),
                        }))}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="truncate">{b.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </FormField>

          <FormField label="Salary (text, e.g. '₹15K–25K / month')">
            <input className={inputClass} value={form.salary_text} onChange={e => setForm({ ...form, salary_text: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Salary min (₹/month)">
              <input type="number" min={0} className={inputClass} value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} />
            </FormField>
            <FormField label="Salary max (₹/month)">
              <input type="number" min={0} className={inputClass} value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Experience min (yrs)">
              <input type="number" min={0} className={inputClass} value={form.experience_min} onChange={e => setForm({ ...form, experience_min: e.target.value })} />
            </FormField>
            <FormField label="Experience max (yrs)">
              <input type="number" min={0} className={inputClass} value={form.experience_max} onChange={e => setForm({ ...form, experience_max: e.target.value })} />
            </FormField>
            <FormField label="Experience note">
              <input className={inputClass} value={form.experience_text} onChange={e => setForm({ ...form, experience_text: e.target.value })}
                placeholder="e.g. Freshers welcome" />
            </FormField>
          </div>

          <FormField label="Qualification">
            <input className={inputClass} value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })}
              placeholder="e.g. 12th pass, Graduate, Diploma in CS" />
          </FormField>

          <FormField label="Skills Required" hint="Comma-separated (e.g. MS Word, Tally, Communication)">
            <input className={inputClass} value={form.skills_required_text}
              onChange={e => setForm({ ...form, skills_required_text: e.target.value })} />
          </FormField>

          <FormField label="Related Courses (we recommend students with these)">
            <select multiple className={`${inputClass} h-32`}
              value={form.related_course_ids}
              onChange={e => setForm({ ...form, related_course_ids: Array.from(e.target.selectedOptions).map(o => o.value) })}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>)}
            </select>
          </FormField>

          <FormField label="Description">
            <textarea rows={4} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="External Apply URL (optional)">
              <input className={inputClass} value={form.apply_url} onChange={e => setForm({ ...form, apply_url: e.target.value })} placeholder="https://..." />
            </FormField>
            <FormField label="Contact (phone/email)">
              <input className={inputClass} value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Deadline">
              <input type="date" className={inputClass} value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select className={selectClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
            <FormField label="Featured">
              <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-300 bg-white">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} />
                <span className="text-sm text-gray-700">Pin to top</span>
              </label>
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editing ? 'Save changes' : 'Post'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
