import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, Plus, Search, Loader2, Settings, Download, Eye, Ban, Trash2, BookOpen, CheckCircle2, XCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface CertRow {
  id: string
  certificate_number: string
  student_name: string
  course_name: string | null
  template_id: string
  issue_date: string
  status: 'active' | 'revoked'
  template?: { name: string; slug: string } | null
}

const COURSE_CHIP = '__ALL__'

export default function CertificateListPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [rows, setRows] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all')
  const [courseFilter, setCourseFilter] = useState<string>(COURSE_CHIP)
  const [deleteTarget, setDeleteTarget] = useState<CertRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_certificates')
        .select('id, certificate_number, student_name, course_name, template_id, issue_date, status, template:uce_certificate_templates(name, slug)')
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      setRows((data ?? []) as unknown as CertRow[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('uce_certificates')
        .delete()
        .eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Certificate deleted')
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  // Top counts (status-aware so they update with the toggle)
  const totals = useMemo(() => {
    const total = rows.length
    const active = rows.filter(r => r.status === 'active').length
    const revoked = rows.filter(r => r.status === 'revoked').length
    return { total, active, revoked }
  }, [rows])

  // Course-wise counts (respects status filter so chips reflect the visible scope)
  const courseCounts = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return
      const key = (r.course_name && r.course_name.trim()) || 'Unspecified'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [rows, statusFilter])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (courseFilter !== COURSE_CHIP) {
        const key = (r.course_name && r.course_name.trim()) || 'Unspecified'
        if (key !== courseFilter) return false
      }
      if (!q) return true
      return (
        r.certificate_number.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        (r.course_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, statusFilter, courseFilter])

  const chipScopeTotal = useMemo(
    () => courseCounts.reduce((s, [, n]) => s + n, 0),
    [courseCounts],
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <Award size={20} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Certificates</h1>
          <p className="text-xs sm:text-sm text-gray-500">Issued certificates across all branches</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin/certificates/settings')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Settings size={14} /> Settings
            </button>
          )}
          <button
            onClick={() => navigate('/admin/certificates/issue')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus size={14} /> Issue New
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard
          icon={<Award size={16} className="text-red-600" />}
          tone="red"
          label="Total Certificates"
          value={totals.total}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <SummaryCard
          icon={<CheckCircle2 size={16} className="text-emerald-600" />}
          tone="emerald"
          label="Active"
          value={totals.active}
          active={statusFilter === 'active'}
          onClick={() => setStatusFilter('active')}
        />
        <SummaryCard
          icon={<XCircle size={16} className="text-gray-500" />}
          tone="gray"
          label="Revoked"
          value={totals.revoked}
          active={statusFilter === 'revoked'}
          onClick={() => setStatusFilter('revoked')}
        />
      </div>

      {/* Course-wise chips */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Filter by course</span>
          {courseFilter !== COURSE_CHIP && (
            <button
              onClick={() => setCourseFilter(COURSE_CHIP)}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="All courses"
            count={chipScopeTotal}
            active={courseFilter === COURSE_CHIP}
            onClick={() => setCourseFilter(COURSE_CHIP)}
          />
          {courseCounts.map(([name, n]) => (
            <Chip
              key={name}
              label={name}
              count={n}
              active={courseFilter === name}
              onClick={() => setCourseFilter(name)}
            />
          ))}
          {courseCounts.length === 0 && !loading && (
            <span className="text-xs text-gray-400">No certificates in this scope.</span>
          )}
        </div>
      </div>

      {/* Search bar (compact) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 sm:p-3 flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, cert no, course…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500 ml-auto">
          Showing <span className="font-semibold text-gray-700">{filtered.length}</span>
          {filtered.length !== totals.total && (
            <> of <span className="font-semibold text-gray-700">{totals.total}</span></>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-red-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No certificates match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Cert No.</th>
                  <th className="px-3 py-2 text-left">Student</th>
                  <th className="px-3 py-2 text-left">Course</th>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Issue Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.certificate_number}</td>
                    <td className="px-3 py-2">{r.student_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.course_name || '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.template?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{formatDateDDMMYYYY(r.issue_date)}</td>
                    <td className="px-3 py-2">
                      {r.status === 'active' ? (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 rounded-full">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => navigate(`/admin/certificates/${r.id}`)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/certificates/${r.id}?download=1`)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        {isSuperAdmin && r.status === 'active' ? (
                          <button
                            onClick={() => navigate(`/admin/certificates/${r.id}?revoke=1`)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Revoke"
                          >
                            <Ban size={14} />
                          </button>
                        ) : null}
                        {isSuperAdmin ? (
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
            <h3 className="text-lg font-semibold text-red-700">Delete certificate</h3>
            <p className="text-sm text-gray-600">
              Delete certificate <strong>{deleteTarget.certificate_number}</strong>? This permanently removes the record and cannot be undone.
              Use <strong>Revoke</strong> instead if you want to keep an audit trail.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon, label, value, tone, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'red' | 'emerald' | 'gray'
  active: boolean
  onClick: () => void
}) {
  const ring =
    tone === 'red' ? 'ring-red-500/40 bg-red-50/40'
    : tone === 'emerald' ? 'ring-emerald-500/40 bg-emerald-50/40'
    : 'ring-gray-300 bg-gray-50/60'
  return (
    <button
      onClick={onClick}
      className={[
        'text-left bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 transition',
        active ? `ring-2 ${ring}` : 'hover:border-gray-300',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">{value}</div>
    </button>
  )
}

function Chip({
  label, count, active, onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition border',
        active
          ? 'bg-red-600 text-white border-red-600 shadow-sm'
          : 'bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:text-red-700 hover:bg-red-50',
      ].join(' ')}
      title={label}
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <span
        className={[
          'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  )
}
