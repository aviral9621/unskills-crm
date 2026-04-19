import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, Plus, Search, Loader2, Settings, Download, Eye, Ban } from 'lucide-react'
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

export default function CertificateListPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [rows, setRows] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all')

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_certificates')
        .select('id, certificate_number, student_name, course_name, template_id, issue_date, status, template:uce_certificate_templates(name, slug)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setRows((data ?? []) as unknown as CertRow[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.certificate_number.toLowerCase().includes(q) ||
        r.student_name.toLowerCase().includes(q) ||
        (r.course_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, statusFilter])

  return (
    <div className="space-y-4">
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, certificate no, course…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'revoked')}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-red-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No certificates. Click <strong>Issue New</strong> to create one.
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
