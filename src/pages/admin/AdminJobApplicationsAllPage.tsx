import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Briefcase, Mail, Phone, MapPin, FileText, Loader2, Search, Download,
  Users as UsersIcon, MessageCircle, X, Filter, Calendar,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'
import { inputClass, selectClass } from '../../components/FormField'
import Modal from '../../components/Modal'

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
  job?: {
    id: string
    title: string
    company: string | null
    branch_id: string | null
    branch_ids: string[] | null
    branch?: { name: string } | null
  } | null
}

interface JobOpt { id: string; title: string }

const STATUS_OPTIONS = ['new', 'shortlisted', 'interviewed', 'rejected', 'hired'] as const

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  shortlisted: 'bg-amber-50 text-amber-700 border-amber-200',
  interviewed: 'bg-purple-50 text-purple-700 border-purple-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  hired: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function digitsOnly(v: string | null | undefined): string {
  return (v || '').replace(/\D+/g, '')
}

function whatsappLink(phone: string | null | undefined, text: string): string {
  const d = digitsOnly(phone)
  if (!d) return '#'
  const withCC = d.length === 10 ? `91${d}` : d
  return `https://wa.me/${withCC}?text=${encodeURIComponent(text)}`
}

export default function AdminJobApplicationsAllPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<AppRow[]>([])
  const [jobs, setJobs] = useState<JobOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterJob, setFilterJob] = useState<string>('')
  const [filterSource, setFilterSource] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<AppRow | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [{ data: adata, error: aErr }, { data: jdata }] = await Promise.all([
        supabase
          .from('uce_job_applications')
          .select(`
            id, job_id, student_id, applicant_name, applicant_email, applicant_phone,
            applicant_location, qualification, experience_years, cover_letter, resume_url,
            source, status, notes, reviewed_at, created_at,
            job:uce_jobs(id, title, company, branch_id, branch_ids, branch:uce_branches(name))
          `)
          .order('created_at', { ascending: false }),
        supabase.from('uce_jobs').select('id, title').order('created_at', { ascending: false }),
      ])
      if (aErr) throw aErr
      setRows((adata ?? []) as unknown as AppRow[])
      setJobs((jdata ?? []) as JobOpt[])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load applications')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filterStatus && r.status !== filterStatus) return false
      if (filterJob && r.job_id !== filterJob) return false
      if (filterSource && r.source !== filterSource) return false
      if (term) {
        const hay = [
          r.applicant_name, r.applicant_email, r.applicant_phone,
          r.applicant_location, r.qualification, r.job?.title, r.job?.company,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [rows, search, filterStatus, filterJob, filterSource])

  const stats = useMemo(() => {
    const s: Record<string, number> = { new: 0, shortlisted: 0, interviewed: 0, hired: 0, rejected: 0 }
    rows.forEach(r => { if (s[r.status] != null) s[r.status]++ })
    return s
  }, [rows])

  const sources = useMemo(() => Array.from(new Set(rows.map(r => r.source).filter(Boolean) as string[])), [rows])

  async function setStatus(r: AppRow, status: string) {
    const { error } = await supabase.from('uce_job_applications').update({
      status, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString(),
    }).eq('id', r.id)
    if (error) return toast.error(error.message)
    toast.success('Status updated')
    setRows(arr => arr.map(x => x.id === r.id ? { ...x, status, reviewed_at: new Date().toISOString() } : x))
    if (selected?.id === r.id) setSelected({ ...r, status })
  }

  async function saveNotes(r: AppRow, notes: string) {
    if (notes === (r.notes || '')) return
    setSavingNotes(true)
    const { error } = await supabase.from('uce_job_applications').update({ notes }).eq('id', r.id)
    setSavingNotes(false)
    if (error) return toast.error(error.message)
    toast.success('Note saved')
    setRows(arr => arr.map(x => x.id === r.id ? { ...x, notes } : x))
  }

  function exportCSV() {
    const head = ['Date', 'Name', 'Phone', 'Email', 'Location', 'Job', 'Company', 'Source', 'Status', 'Qualification', 'Experience (yrs)', 'Resume'].join(',')
    const lines = filtered.map(r => [
      formatDateDDMMYYYY(r.created_at), r.applicant_name, r.applicant_phone,
      r.applicant_email || '', r.applicant_location || '',
      r.job?.title || '', r.job?.company || '',
      r.source || '', r.status, r.qualification || '',
      r.experience_years ?? '', r.resume_url || '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [head, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-applications-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Job Applications</h1>
          <p className="text-sm text-gray-500">All applications submitted from the website, student panel, and walk-ins.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/jobs" className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50">
            <Briefcase size={16} /> Job Postings
          </Link>
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm">
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(['new', 'shortlisted', 'interviewed', 'hired', 'rejected'] as const).map(k => (
          <button
            key={k}
            onClick={() => setFilterStatus(filterStatus === k ? '' : k)}
            className={`rounded-xl border bg-white p-3 text-left transition-colors ${filterStatus === k ? 'ring-2 ring-red-300 border-red-300' : 'hover:bg-gray-50'}`}
          >
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{k}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{stats[k] || 0}</p>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search applicant, phone, email, job, qualification…"
              className={`${inputClass} pl-9 pr-9`}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Filter size={14} /> Filters
            {(filterStatus || filterJob || filterSource) && <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[10px] font-bold">{[filterStatus, filterJob, filterSource].filter(Boolean).length}</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className="grid gap-2 sm:grid-cols-3 pt-1">
            <select className={selectClass} value={filterJob} onChange={e => setFilterJob(e.target.value)}>
              <option value="">All jobs ({rows.length})</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={selectClass} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="">All sources</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-400">
          <UsersIcon size={36} className="mx-auto text-gray-300 mb-2" />
          {rows.length === 0 ? 'No applications submitted yet.' : 'No applications match the filters.'}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left rounded-xl border bg-white p-3.5 active:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 text-red-700 grid place-items-center text-sm font-bold shrink-0">
                    {(r.applicant_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{r.applicant_name}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{r.applicant_phone}{r.applicant_email ? ` · ${r.applicant_email}` : ''}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-gray-500">
                      <Briefcase size={11} /> <span className="truncate">{r.job?.title || 'Unknown job'}</span>
                      {r.job?.branch?.name && <><span>·</span><span className="truncate">{r.job.branch.name}</span></>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 inline-flex items-center gap-1"><Calendar size={10} /> {formatDateDDMMYYYY(r.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1.6fr_1fr_1.4fr_1fr_0.8fr_0.8fr] gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span>Applicant</span>
              <span>Contact</span>
              <span>Applied for</span>
              <span>Source</span>
              <span>Date</span>
              <span>Status</span>
            </div>
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left grid grid-cols-[1.6fr_1fr_1.4fr_1fr_0.8fr_0.8fr] gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 items-center"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-red-100 text-red-700 grid place-items-center text-xs font-bold shrink-0">
                    {(r.applicant_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.applicant_name}</p>
                    {r.qualification && <p className="text-[11px] text-gray-400 truncate">{r.qualification}</p>}
                  </div>
                </div>
                <div className="text-xs text-gray-600 min-w-0">
                  <p className="truncate">{r.applicant_phone}</p>
                  {r.applicant_email && <p className="text-gray-400 truncate">{r.applicant_email}</p>}
                </div>
                <div className="text-xs text-gray-700 min-w-0">
                  <p className="truncate">{r.job?.title || '—'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{r.job?.company || ''}{r.job?.branch?.name ? ` · ${r.job.branch.name}` : ''}</p>
                </div>
                <span className="text-[11px] text-gray-500 truncate">{r.source || '—'}</span>
                <span className="text-[11px] text-gray-500">{formatDateDDMMYYYY(r.created_at)}</span>
                <span className={`justify-self-start px-2 py-0.5 rounded text-[11px] font-semibold border ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Application Details" size="lg">
        {selected && (() => {
          const r = selected
          const waText = `Hi ${r.applicant_name}, this is regarding your application for "${r.job?.title || 'our job posting'}" at Unskills Computer Education.`
          return (
            <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 grid place-items-center text-base font-bold shrink-0">
                  {(r.applicant_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">{r.applicant_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Applied for <Link to={`/admin/jobs/${r.job_id}/applications`} className="text-red-600 hover:underline">{r.job?.title || 'job'}</Link>
                    {r.job?.company && <> at <span className="text-gray-700">{r.job.company}</span></>}
                    {r.job?.branch?.name && <> · {r.job.branch.name}</>}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                    {r.source && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">via {r.source}</span>}
                    <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><Calendar size={10} /> {formatDateDDMMYYYY(r.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${digitsOnly(r.applicant_phone)}`}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100"
                >
                  <Phone size={14} /> Call
                </a>
                <a
                  href={whatsappLink(r.applicant_phone, waText)}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                {r.applicant_email ? (
                  <a
                    href={`mailto:${r.applicant_email}?subject=${encodeURIComponent('Regarding your application')}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100"
                  >
                    <Mail size={14} /> Email
                  </a>
                ) : (
                  <button disabled className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 text-gray-400 text-xs font-medium cursor-not-allowed">
                    <Mail size={14} /> No email
                  </button>
                )}
              </div>

              {/* Details grid */}
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <InfoRow icon={<Phone size={14} />} label="Phone" value={r.applicant_phone} />
                {r.applicant_email && <InfoRow icon={<Mail size={14} />} label="Email" value={r.applicant_email} />}
                {r.applicant_location && <InfoRow icon={<MapPin size={14} />} label="Location" value={r.applicant_location} />}
                {r.qualification && <InfoRow icon={<FileText size={14} />} label="Qualification" value={r.qualification} />}
                {r.experience_years != null && <InfoRow icon={<FileText size={14} />} label="Experience" value={`${r.experience_years} yrs`} />}
              </div>

              {r.cover_letter && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Cover letter</p>
                  <div className="p-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 whitespace-pre-wrap">{r.cover_letter}</div>
                </div>
              )}

              {r.resume_url && (
                <a href={r.resume_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline">
                  <Download size={14} /> Download resume
                </a>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Internal notes</p>
                <textarea
                  rows={3}
                  className={`${inputClass} resize-none`}
                  defaultValue={r.notes || ''}
                  onBlur={e => saveNotes(r, e.target.value)}
                  placeholder="Add an internal note (auto-saves on blur)…"
                />
                {savingNotes && <p className="text-[11px] text-gray-400 mt-1 inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Saving…</p>}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">Move to status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.filter(s => s !== r.status).map(s => (
                    <button key={s} onClick={() => setStatus(r, s)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border ${STATUS_COLORS[s] || 'bg-gray-100 text-gray-700 border-gray-200'} hover:opacity-80`}>
                      Mark as {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase font-semibold text-gray-500">{label}</p>
        <p className="text-sm text-gray-800 break-words">{value}</p>
      </div>
    </div>
  )
}
