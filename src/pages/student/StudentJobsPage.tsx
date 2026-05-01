import { useEffect, useMemo, useState } from 'react'
import { Briefcase, MapPin, Clock, Star, Search, Loader2, CheckCircle2, IndianRupee, GraduationCap, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'
import Modal from '../../components/Modal'
import FormField, { inputClass, selectClass } from '../../components/FormField'

interface Row {
  id: string; title: string; company: string | null; location: string | null
  job_type: string | null; work_mode: string | null
  description: string | null; apply_url: string | null; contact_info: string | null
  deadline: string | null; salary_text: string | null; experience_text: string | null
  qualification: string | null; openings: number | null; is_featured: boolean
  branch_id: string | null; branch_ids: string[] | null; created_at: string; applications_count: number
  skills_required: string[] | null
  branch?: { name: string } | null
}

interface MyApp {
  id: string; job_id: string; status: string; created_at: string
  job?: { title: string; company: string | null; status: string } | null
}

const WORK_MODES = ['onsite', 'remote', 'hybrid']

export default function StudentJobsPage() {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [myApps, setMyApps] = useState<MyApp[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'browse' | 'mine'>('browse')
  const [studentBranchId, setStudentBranchId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('')

  const [studentInfo, setStudentInfo] = useState<{
    name: string; phone: string; email: string | null; village: string | null; district: string | null
  } | null>(null)

  const [applyJob, setApplyJob] = useState<Row | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', location: '',
    qualification: '', experience_years: '', cover_letter: '',
  })

  async function load() {
    setLoading(true)
    const { data: jdata } = await supabase
      .from('uce_jobs')
      .select('*, branch:uce_branches(name)')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
    setRows((jdata ?? []) as Row[])

    if (user?.id) {
      const { data: adata } = await supabase
        .from('uce_job_applications')
        .select('id, job_id, status, created_at, job:uce_jobs(title, company, status)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
      setMyApps((adata ?? []) as unknown as MyApp[])
    }

    if (user?.id) {
      const { data: sd } = await supabase.from('uce_students')
        .select('name, phone, email, village, district, branch_id')
        .eq('auth_user_id', user.id).maybeSingle()
      if (sd) {
        setStudentInfo({
          name: sd.name, phone: sd.phone, email: sd.email,
          village: sd.village, district: sd.district,
        })
        setStudentBranchId((sd as { branch_id: string | null }).branch_id || null)
      }
    }

    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [user?.id])

  const appliedJobIds = useMemo(() => new Set(myApps.map(a => a.job_id)), [myApps])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      // Branch visibility: empty branch_ids = org-wide; otherwise must include this student's branch.
      const targets = r.branch_ids && r.branch_ids.length > 0
        ? r.branch_ids
        : (r.branch_id ? [r.branch_id] : [])
      if (targets.length > 0 && (!studentBranchId || !targets.includes(studentBranchId))) return false
      if (filterMode && r.work_mode !== filterMode) return false
      if (search) {
        const s = search.toLowerCase()
        if (!(r.title?.toLowerCase().includes(s) ||
              r.company?.toLowerCase().includes(s) ||
              r.location?.toLowerCase().includes(s))) return false
      }
      return true
    })
  }, [rows, filterMode, search, studentBranchId])

  function openApply(j: Row) {
    setApplyJob(j)
    setForm({
      name: studentInfo?.name || profile?.full_name || '',
      phone: studentInfo?.phone || '',
      email: studentInfo?.email || profile?.email || '',
      location: [studentInfo?.village, studentInfo?.district].filter(Boolean).join(', '),
      qualification: '',
      experience_years: '',
      cover_letter: '',
    })
  }

  async function submitApply() {
    if (!applyJob || !user) return
    if (!form.name.trim() || !form.phone.trim()) return toast.error('Name and phone required')
    setSubmitting(true)
    const { error } = await supabase.from('uce_job_applications').insert({
      job_id: applyJob.id,
      student_id: user.id,
      applicant_name: form.name.trim(),
      applicant_email: form.email.trim() || null,
      applicant_phone: form.phone.trim(),
      applicant_location: form.location.trim() || null,
      qualification: form.qualification.trim() || null,
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      cover_letter: form.cover_letter.trim() || null,
      source: 'student_panel',
      status: 'new',
    })
    setSubmitting(false)
    if (error) return toast.error(error.message)
    toast.success('Applied successfully!')
    setApplyJob(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Jobs</h1>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button onClick={() => setTab('browse')}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${tab === 'browse' ? 'bg-red-600 text-white' : 'text-gray-600'}`}>
            Browse Jobs
          </button>
          <button onClick={() => setTab('mine')}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${tab === 'mine' ? 'bg-red-600 text-white' : 'text-gray-600'}`}>
            My Applications {myApps.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20">{myApps.length}</span>}
          </button>
        </div>
      </div>

      {tab === 'browse' && (
        <>
          <div className="rounded-xl border bg-white p-3 grid gap-2 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search title, company, location"
                className={`${inputClass} pl-9`}
              />
            </div>
            <select className={selectClass} value={filterMode} onChange={e => setFilterMode(e.target.value)}>
              <option value="">All work modes</option>
              {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading jobs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
              <Briefcase size={28} className="mx-auto mb-2 text-gray-300" />No jobs match.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map(r => {
                const applied = appliedJobIds.has(r.id)
                return (
                  <div key={r.id} className={`rounded-xl border bg-white p-4 ${r.is_featured ? 'ring-1 ring-amber-300' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {r.is_featured && <Star size={14} className="text-amber-500 fill-amber-400" />}
                          <p className="font-semibold break-words">{r.title}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {r.company || '—'}
                          {r.branch?.name && ` · ${r.branch.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-gray-600">
                      {r.job_type && <span className="px-2 py-0.5 rounded bg-gray-100">{r.job_type.replace('_', ' ')}</span>}
                      {r.work_mode && <span className="px-2 py-0.5 rounded bg-gray-100">{r.work_mode}</span>}
                      {r.location && <span className="px-2 py-0.5 rounded bg-gray-100"><MapPin size={10} className="inline -mt-0.5" /> {r.location}</span>}
                      {r.salary_text && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">₹ {r.salary_text}</span>}
                      {r.experience_text && <span className="px-2 py-0.5 rounded bg-gray-100">{r.experience_text}</span>}
                    </div>
                    {r.description && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{r.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-gray-500 flex items-center gap-1">
                        {r.deadline && <><Clock size={10} /> By {formatDateDDMMYYYY(r.deadline)}</>}
                      </span>
                      {applied ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 size={12} /> Applied</span>
                      ) : r.apply_url ? (
                        <a href={r.apply_url} target="_blank" rel="noreferrer" className="font-semibold text-red-600 hover:underline">Apply on site →</a>
                      ) : (
                        <button onClick={() => openApply(r)}
                          className="font-semibold text-red-600 hover:underline">Apply →</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'mine' && (
        <div className="space-y-2">
          {myApps.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
              You haven't applied to any jobs yet.
            </div>
          ) : myApps.map(a => (
            <div key={a.id} className="rounded-xl border bg-white p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.job?.title || 'Job'}</p>
                <p className="text-xs text-gray-500">{a.job?.company || '—'} · Applied {formatDateDDMMYYYY(a.created_at)}</p>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                a.status === 'hired' ? 'bg-emerald-50 text-emerald-700' :
                a.status === 'shortlisted' ? 'bg-amber-50 text-amber-700' :
                a.status === 'interviewed' ? 'bg-purple-50 text-purple-700' :
                a.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                'bg-blue-50 text-blue-700'
              }`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!applyJob} onClose={() => setApplyJob(null)} title={`Apply: ${applyJob?.title || ''}`} size="lg">
        {applyJob && (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600 grid sm:grid-cols-2 gap-2">
              {applyJob.salary_text && <span><IndianRupee size={11} className="inline" /> {applyJob.salary_text}</span>}
              {applyJob.location && <span><MapPin size={11} className="inline" /> {applyJob.location}</span>}
              {applyJob.qualification && <span><GraduationCap size={11} className="inline" /> {applyJob.qualification}</span>}
              {applyJob.experience_text && <span><FileText size={11} className="inline" /> {applyJob.experience_text}</span>}
            </div>

            <FormField label="Full Name" required>
              <input className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Phone" required>
                <input className={inputClass} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </FormField>
              <FormField label="Email">
                <input type="email" className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Your Location">
              <input className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Qualification">
                <input className={inputClass} value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
              </FormField>
              <FormField label="Experience (yrs)">
                <input type="number" min={0} className={inputClass} value={form.experience_years} onChange={e => setForm({ ...form, experience_years: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Cover Letter / Why you?">
              <textarea rows={3} className={inputClass} value={form.cover_letter} onChange={e => setForm({ ...form, cover_letter: e.target.value })} />
            </FormField>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setApplyJob(null)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
              <button onClick={submitApply} disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Submit Application
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
