import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, Briefcase, Loader2, Trash2, Pencil, Star, MapPin, Clock, Users as UsersIcon,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import { formatDateDDMMYYYY } from '../../../lib/utils'
import Modal from '../../../components/Modal'
import FormField, { inputClass, selectClass } from '../../../components/FormField'

const JOB_TYPES = ['full_time', 'part_time', 'internship', 'contract', 'freelance']
const WORK_MODES = ['onsite', 'remote', 'hybrid']
const STATUS_OPTIONS = ['open', 'closed', 'draft']

interface Row {
  id: string; title: string; company: string | null; location: string | null
  job_type: string | null; work_mode: string | null
  description: string | null; apply_url: string | null; contact_info: string | null
  deadline: string | null
  is_active: boolean; branch_id: string | null; created_at: string
  salary_text: string | null; experience_text: string | null
  qualification: string | null; openings: number | null
  status: string; approval_status: string; is_featured: boolean
  applications_count: number
  related_course_ids: string[] | null
  skills_required: string[] | null
}

interface CourseOpt { id: string; code: string; name: string }

const EMPTY_FORM = {
  title: '', company: '', location: '', job_type: 'full_time', work_mode: 'onsite',
  description: '', apply_url: '', contact_info: '', deadline: '',
  salary_text: '', experience_text: '', qualification: '',
  skills_required_text: '',
  related_course_ids: [] as string[],
  openings: '',
  status: 'open',
}

export default function FJobsPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  async function load() {
    const { data } = await supabase
      .from('uce_jobs')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
    setRows((data ?? []) as Row[])
  }
  useEffect(() => {
    load()
    supabase.from('uce_courses').select('id, code, name').order('name')
      .then(({ data }) => setCourses((data ?? []) as CourseOpt[]))
  }, [])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }
  function openEdit(r: Row) {
    setEditing(r)
    setForm({
      title: r.title || '', company: r.company || '', location: r.location || '',
      job_type: r.job_type || 'full_time', work_mode: r.work_mode || 'onsite',
      description: r.description || '', apply_url: r.apply_url || '', contact_info: r.contact_info || '',
      deadline: r.deadline || '',
      salary_text: r.salary_text || '', experience_text: r.experience_text || '',
      qualification: r.qualification || '',
      skills_required_text: (r.skills_required ?? []).join(', '),
      related_course_ids: r.related_course_ids ?? [],
      openings: r.openings?.toString() || '',
      status: r.status || 'open',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.title) return toast.error('Title required')
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
      salary_text: form.salary_text.trim() || null,
      experience_text: form.experience_text.trim() || null,
      qualification: form.qualification.trim() || null,
      openings: form.openings ? Number(form.openings) : null,
      skills_required: form.skills_required_text
        ? form.skills_required_text.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      related_course_ids: form.related_course_ids,
      status: form.status,
      is_active: form.status === 'open',
    }
    let err: { message: string } | null = null
    if (editing) {
      const { error } = await supabase.from('uce_jobs').update(payload).eq('id', editing.id)
      err = error
    } else {
      const { error } = await supabase.from('uce_jobs').insert({
        ...payload, branch_id: branchId, posted_by: user?.id || null,
        approval_status: 'pending', // Branch posts go pending until super-admin approves
      })
      err = error
    }
    setSaving(false)
    if (err) return toast.error(err.message)
    toast.success(editing ? 'Updated' : 'Submitted for approval')
    setModalOpen(false)
    setForm({ ...EMPTY_FORM })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this job?')) return
    const { error } = await supabase.from('uce_jobs').delete().eq('id', id)
    if (error) return toast.error(error.message)
    load()
  }

  const myJobs = useMemo(() => rows.filter(r => r.branch_id === branchId), [rows, branchId])
  const otherJobs = useMemo(() => rows.filter(r => r.branch_id !== branchId), [rows, branchId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Jobs</h1>
          <p className="text-sm text-gray-500">Post opportunities for your branch. Students see them in their panel + on the website careers page.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Post Job
        </button>
      </div>

      {/* My branch jobs */}
      <div>
        <p className="text-xs font-semibold uppercase text-gray-500 mb-2">My Branch</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {myJobs.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 sm:col-span-2">
              <Briefcase size={28} className="mx-auto mb-2 text-gray-300" />No jobs posted yet.
            </div>
          ) : myJobs.map(r => (
            <JobCard key={r.id} r={r} onEdit={openEdit} onRemove={remove} mine />
          ))}
        </div>
      </div>

      {/* Other branches (informational) */}
      {otherJobs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Other Branches</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherJobs.map(r => <JobCard key={r.id} r={r} mine={false} />)}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Job' : 'Post a Job'} size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <FormField label="Title" required>
            <input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Company"><input className={inputClass} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></FormField>
            <FormField label="Location"><input className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></FormField>
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
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Salary"><input className={inputClass} value={form.salary_text} onChange={e => setForm({ ...form, salary_text: e.target.value })} placeholder="₹15K–25K / month" /></FormField>
            <FormField label="Experience"><input className={inputClass} value={form.experience_text} onChange={e => setForm({ ...form, experience_text: e.target.value })} placeholder="0–2 yrs / Freshers" /></FormField>
          </div>
          <FormField label="Qualification"><input className={inputClass} value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="12th pass, Graduate, etc." /></FormField>
          <FormField label="Skills" hint="Comma-separated"><input className={inputClass} value={form.skills_required_text} onChange={e => setForm({ ...form, skills_required_text: e.target.value })} /></FormField>
          <FormField label="Related Courses">
            <select multiple className={`${inputClass} h-32`}
              value={form.related_course_ids}
              onChange={e => setForm({ ...form, related_course_ids: Array.from(e.target.selectedOptions).map(o => o.value) })}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Description"><textarea rows={3} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Apply URL"><input className={inputClass} value={form.apply_url} onChange={e => setForm({ ...form, apply_url: e.target.value })} placeholder="https://..." /></FormField>
            <FormField label="Contact"><input className={inputClass} value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} placeholder="Phone / email" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Deadline"><input type="date" className={inputClass} value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></FormField>
            <FormField label="Status">
              <select className={selectClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Save' : 'Post'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function JobCard({ r, mine, onEdit, onRemove }: {
  r: Row; mine: boolean
  onEdit?: (r: Row) => void
  onRemove?: (id: string) => void
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${r.is_featured ? 'ring-1 ring-amber-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {r.is_featured && <Star size={14} className="text-amber-500 fill-amber-400" />}
            <p className="font-semibold truncate">{r.title}</p>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {r.company || '—'}{r.location && <> · <MapPin size={11} className="inline" /> {r.location}</>}
          </p>
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
        {r.salary_text && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">₹ {r.salary_text}</span>}
      </div>
      {r.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{r.description}</p>}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Clock size={11} /> {formatDateDDMMYYYY(r.created_at)}</span>
          {r.deadline && <span>By {formatDateDDMMYYYY(r.deadline)}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {mine && (
            <Link to={`/franchise/jobs/${r.id}/applications`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-medium">
              <UsersIcon size={11} /> {r.applications_count}
            </Link>
          )}
          {mine && onEdit && (
            <button onClick={() => onEdit(r)} className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
          )}
          {mine && onRemove && (
            <button onClick={() => onRemove(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
          )}
        </div>
      </div>
    </div>
  )
}
