import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, Eye, RotateCcw, IdCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'

type Status = 'submitted' | 'approved' | 'rejected' | 'resubmit'

interface Row {
  id: string
  semester: number | null
  exam_session: string | null
  status: string
  created_at: string
  details: Record<string, unknown> | null
  subject_ids: string[] | null
  review_note: string | null
  student: { id: string; name: string; registration_no: string; photo_url: string | null } | null
  course: { name: string } | null
  branch: { name: string; code: string } | null
}

interface SubjectLite { id: string; name: string; code: string | null }

export default function AdminExamFormsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<Status>('submitted')
  const [viewing, setViewing] = useState<Row | null>(null)
  const [subjects, setSubjects] = useState<SubjectLite[]>([])
  const [resubmitNote, setResubmitNote] = useState('')

  const isBranch = profile?.role === 'branch_admin' || profile?.role === 'branch_staff'
  const branchId = profile?.branch_id

  async function load() {
    let q = supabase.from('uce_exam_forms')
      .select('id,semester,exam_session,status,created_at,details,subject_ids,review_note,student:uce_students(id,name,registration_no,photo_url),course:uce_courses(name),branch:uce_branches(name,code)')
      .eq('status', tab).order('created_at', { ascending: false })
    if (isBranch && branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => { load() }, [tab])

  async function openView(r: Row) {
    setViewing(r)
    setResubmitNote('')
    if (Array.isArray(r.subject_ids) && r.subject_ids.length > 0) {
      const { data } = await supabase.from('uce_subjects').select('id, name, code').in('id', r.subject_ids)
      setSubjects((data ?? []) as SubjectLite[])
    } else {
      setSubjects([])
    }
  }

  async function review(id: string, status: 'approved' | 'rejected' | 'resubmit', note?: string) {
    const payload: Record<string, unknown> = {
      status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
    }
    if (note !== undefined) payload.review_note = note
    const { error } = await supabase.from('uce_exam_forms').update(payload).eq('id', id)
    if (error) return toast.error(error.message)

    if (status === 'approved') {
      toast.success('Approved', {
        action: {
          label: 'Generate Admit Card →',
          onClick: () => navigate(`/admin/exams/admit-cards/new?formId=${id}`),
        },
        duration: 8000,
      })
    } else {
      toast.success(status === 'resubmit' ? 'Sent back for resubmit' : 'Rejected')
    }
    setViewing(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Exam Forms</h1>
        <p className="text-sm text-gray-500">Review student-submitted exam forms{isBranch ? ' for your branch' : ''}.</p>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1 flex-wrap">
        {(['submitted', 'approved', 'rejected', 'resubmit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>{t}</button>
        ))}
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Sem</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3">{formatDateDDMMYYYY(r.created_at)}</td>
                <td className="px-4 py-3">{r.student?.name} <span className="text-xs font-mono text-gray-400">{r.student?.registration_no}</span></td>
                <td className="px-4 py-3">{r.branch?.name}</td>
                <td className="px-4 py-3">{r.course?.name}</td>
                <td className="px-4 py-3">{r.exam_session}</td>
                <td className="px-4 py-3">{r.semester ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1.5">
                    <button onClick={() => openView(r)} className="px-2 py-1 text-xs rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1">
                      <Eye size={12} /> View
                    </button>
                    {tab === 'approved' && (
                      <button onClick={() => navigate(`/admin/exams/admit-cards/new?formId=${r.id}`)} className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1">
                        <IdCard size={12} /> Admit Card
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewing(null)}>
          <div className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold">Exam Form Details</h3>
                <p className="text-xs text-gray-500">Submitted {formatDateDDMMYYYY(viewing.created_at)}</p>
              </div>
              <button onClick={() => setViewing(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                {viewing.student?.photo_url ? (
                  <img src={viewing.student.photo_url} alt="" className="h-20 w-16 object-cover rounded border" />
                ) : (
                  <div className="h-20 w-16 bg-gray-100 rounded border flex items-center justify-center text-gray-300 text-xs">No photo</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{viewing.student?.name}</p>
                  <p className="text-xs font-mono text-gray-500">{viewing.student?.registration_no}</p>
                  <p className="text-xs text-gray-500 mt-1">{viewing.course?.name} · Sem {viewing.semester} · Session {viewing.exam_session}</p>
                  <p className="text-xs text-gray-500">{viewing.branch?.name}</p>
                </div>
              </div>

              {viewing.details && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Submitted Details</p>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                    {Object.entries(viewing.details).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-gray-500 capitalize min-w-[120px]">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-gray-900">{String(v ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subjects.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Subjects ({subjects.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map(s => (
                      <span key={s.id} className="inline-flex px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                        {s.name}{s.code ? ` (${s.code})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {viewing.review_note && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Previous Review Note</p>
                  <p className="text-amber-900">{viewing.review_note}</p>
                </div>
              )}

              {viewing.status === 'submitted' && (
                <div className="space-y-3 pt-2 border-t">
                  <textarea
                    placeholder="Note (required for Reject / Resubmit)"
                    value={resubmitNote}
                    onChange={e => setResubmitNote(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => {
                        if (!resubmitNote.trim()) return toast.error('Add a note for resubmit')
                        review(viewing.id, 'resubmit', resubmitNote.trim())
                      }}
                      className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 inline-flex items-center gap-1"
                    >
                      <RotateCcw size={14} /> Ask Resubmit
                    </button>
                    <button
                      onClick={() => {
                        if (!resubmitNote.trim()) return toast.error('Add a note for reject')
                        review(viewing.id, 'rejected', resubmitNote.trim())
                      }}
                      className="px-3 py-2 rounded-lg bg-white border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 inline-flex items-center gap-1"
                    >
                      <X size={14} /> Reject
                    </button>
                    <button
                      onClick={() => review(viewing.id, 'approved')}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 inline-flex items-center gap-1"
                    >
                      <Check size={14} /> Approve
                    </button>
                  </div>
                </div>
              )}

              {viewing.status === 'approved' && (
                <div className="pt-2 border-t flex justify-end">
                  <button
                    onClick={() => navigate(`/admin/exams/admit-cards/new?formId=${viewing.id}`)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2"
                  >
                    <IdCard size={14} /> Generate Admit Card
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
