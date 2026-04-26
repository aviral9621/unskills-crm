import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Mail, Phone, MapPin, FileText, Loader2, Search, Download, ChevronDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'
import { inputClass, selectClass } from '../../components/FormField'

interface AppRow {
  id: string
  job_id: string
  student_id: string | null
  applicant_name: string
  applicant_email: string | null
  applicant_phone: string
  applicant_location: string | null
  qualification: string | null
  experience_years: number | null
  cover_letter: string | null
  resume_url: string | null
  source: string | null
  status: string
  notes: string | null
  reviewed_at: string | null
  created_at: string
}

interface JobInfo {
  id: string
  title: string
  company: string | null
  branch?: { name: string } | null
  applications_count: number
}

const STATUS_OPTIONS = ['new', 'shortlisted', 'interviewed', 'rejected', 'hired']

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700',
  shortlisted: 'bg-amber-50 text-amber-700',
  interviewed: 'bg-purple-50 text-purple-700',
  rejected: 'bg-rose-50 text-rose-700',
  hired: 'bg-emerald-50 text-emerald-700',
}

export default function AdminJobApplicationsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { user } = useAuth()
  const [job, setJob] = useState<JobInfo | null>(null)
  const [rows, setRows] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    if (!jobId) return
    setLoading(true)
    const [{ data: jdata }, { data: adata }] = await Promise.all([
      supabase.from('uce_jobs').select('id, title, company, applications_count, branch:uce_branches(name)').eq('id', jobId).single(),
      supabase.from('uce_job_applications').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    ])
    setJob(jdata as unknown as JobInfo)
    setRows((adata ?? []) as AppRow[])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [jobId])

  async function setStatus(r: AppRow, status: string) {
    const { error } = await supabase.from('uce_job_applications').update({
      status, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString(),
    }).eq('id', r.id)
    if (error) return toast.error(error.message)
    toast.success('Updated')
    load()
  }

  async function saveNotes(r: AppRow, notes: string) {
    const { error } = await supabase.from('uce_job_applications').update({ notes }).eq('id', r.id)
    if (error) return toast.error(error.message)
    toast.success('Note saved')
  }

  const filtered = rows.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false
    if (search) {
      const s = search.toLowerCase()
      if (!(r.applicant_name?.toLowerCase().includes(s) ||
            r.applicant_email?.toLowerCase().includes(s) ||
            r.applicant_phone?.includes(s))) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <Link to="/admin/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={14} /> Back to jobs
      </Link>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !job ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-400">Job not found.</div>
      ) : (
        <>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold font-heading">{job.title}</h1>
                <p className="text-sm text-gray-500">{job.company || '—'} {job.branch?.name && `· ${job.branch.name}`}</p>
              </div>
              <div className="text-sm">
                <span className="px-3 py-1 rounded-lg bg-red-50 text-red-700 font-semibold">
                  {job.applications_count} application{job.applications_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl border bg-white p-3 grid gap-2 sm:grid-cols-3">
            <div className="relative sm:col-span-2">
              <Search size={14} className="absolute left-3 top-3 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name / email / phone"
                className={`${inputClass} pl-9`}
              />
            </div>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All status</option>
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
              No applications yet.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => (
                <div key={r.id} className="rounded-xl border bg-white">
                  <button
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-red-100 text-red-700 grid place-items-center text-sm font-bold shrink-0">
                        {(r.applicant_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{r.applicant_name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.applicant_phone}{r.applicant_email ? ` · ${r.applicant_email}` : ''}
                          {r.applicant_location && ` · ${r.applicant_location}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded text-xs font-semibold ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                        {r.status}
                      </span>
                      <span className="text-xs text-gray-400">{formatDateDDMMYYYY(r.created_at)}</span>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${openId === r.id ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {openId === r.id && (
                    <div className="border-t p-4 space-y-3 bg-gray-50/50">
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <InfoRow icon={<Phone size={14} />} label="Phone" value={r.applicant_phone} />
                        {r.applicant_email && <InfoRow icon={<Mail size={14} />} label="Email" value={r.applicant_email} />}
                        {r.applicant_location && <InfoRow icon={<MapPin size={14} />} label="Location" value={r.applicant_location} />}
                        {r.qualification && <InfoRow icon={<FileText size={14} />} label="Qualification" value={r.qualification} />}
                        {r.experience_years != null && <InfoRow icon={<FileText size={14} />} label="Experience" value={`${r.experience_years} yrs`} />}
                        {r.source && <InfoRow icon={<FileText size={14} />} label="Source" value={r.source} />}
                      </div>

                      {r.cover_letter && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">Cover Letter</p>
                          <p className="text-sm whitespace-pre-wrap text-gray-700">{r.cover_letter}</p>
                        </div>
                      )}

                      {r.resume_url && (
                        <a href={r.resume_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline">
                          <Download size={14} /> Download resume
                        </a>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Internal notes</p>
                        <textarea
                          rows={2} className={inputClass}
                          defaultValue={r.notes || ''}
                          onBlur={e => { if (e.target.value !== (r.notes || '')) saveNotes(r, e.target.value) }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {STATUS_OPTIONS.filter(s => s !== r.status).map(s => (
                          <button key={s} onClick={() => setStatus(r, s)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${STATUS_COLORS[s] || 'bg-gray-100 text-gray-700'} hover:opacity-80`}>
                            Mark as {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] uppercase font-semibold text-gray-500">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  )
}
