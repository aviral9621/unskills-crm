import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Download, Briefcase, IndianRupee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

interface StudentRec {
  id: string; name: string; registration_no: string; course_id: string; branch_id: string; net_fee: number
  course: { name: string } | null
  branch: { name: string; code: string } | null
}

function useStudentRecord() {
  const { user } = useAuth()
  const [rec, setRec] = useState<StudentRec | null>(null)
  useEffect(() => {
    if (!user) return
    supabase.from('uce_students').select('id,name,registration_no,course_id,branch_id,net_fee,course:uce_courses(name),branch:uce_branches(name,code)')
      .eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => setRec(data as unknown as StudentRec))
  }, [user])
  return rec
}

export function StudentDashboardPage() {
  const rec = useStudentRecord()
  if (!rec) return <p className="text-sm text-gray-500">Loading…</p>
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white p-6">
        <p className="text-sm opacity-90">Welcome back</p>
        <h1 className="text-2xl font-bold font-heading">{rec.name}</h1>
        <p className="text-sm opacity-90 mt-1">
          <span className="font-mono">{rec.registration_no}</span> · {rec.course?.name} · {rec.branch?.name}
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Link to="/student/fees" className="rounded-xl border bg-white p-5 hover:shadow-md">
          <IndianRupee className="text-red-600 mb-2" size={22} /><p className="font-semibold">Fees & Payments</p>
        </Link>
        <Link to="/student/materials" className="rounded-xl border bg-white p-5 hover:shadow-md">
          <FileText className="text-red-600 mb-2" size={22} /><p className="font-semibold">Study Material</p>
        </Link>
        <Link to="/student/jobs" className="rounded-xl border bg-white p-5 hover:shadow-md">
          <Briefcase className="text-red-600 mb-2" size={22} /><p className="font-semibold">Jobs</p>
        </Link>
      </div>
    </div>
  )
}

export function StudentFeesPage() {
  const rec = useStudentRecord()
  const [pays, setPays] = useState<Array<{ amount: number; payment_date: string; payment_mode: string | null; receipt_no: string | null }>>([])
  const [accounts, setAccounts] = useState<Array<{ id: string; type: string; upi_id: string | null; bank_name: string | null; account_holder: string | null; account_number: string | null; ifsc: string | null; is_default: boolean }>>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_student_fee_payments').select('amount,payment_date,payment_mode,receipt_no').eq('student_id', rec.id).eq('is_adjustment', false).order('payment_date', { ascending: false })
      .then(({ data }) => setPays((data ?? []) as typeof pays))
    supabase.from('uce_branch_payment_accounts').select('*').eq('branch_id', rec.branch_id).eq('is_active', true).order('is_default', { ascending: false })
      .then(({ data }) => setAccounts((data ?? []) as typeof accounts))
  }, [rec])

  if (!rec) return <p>Loading…</p>
  const paid = pays.reduce((s, p) => s + Number(p.amount), 0)
  const due = Math.max(0, rec.net_fee - paid)

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-5"><p className="text-xs text-gray-500">Total Fee</p><p className="text-xl font-bold">{formatINR(rec.net_fee)}</p></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs text-gray-500">Paid</p><p className="text-xl font-bold text-green-700">{formatINR(paid)}</p></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs text-gray-500">Due</p><p className="text-xl font-bold text-red-600">{formatINR(due)}</p></div>
      </div>

      {due > 0 && accounts.length > 0 && (
        <div className="rounded-xl border bg-amber-50 border-amber-200 p-5">
          <p className="font-semibold mb-2">Pay to your branch</p>
          <div className="space-y-2">
            {accounts.map(a => (
              <div key={a.id} className="text-sm bg-white rounded-lg p-3">
                <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold uppercase mr-2">{a.type}</span>
                {a.type === 'upi' ? <span className="font-mono">{a.upi_id}</span> : (
                  <span><b>{a.bank_name}</b> · {a.account_holder} · A/C {a.account_number} · IFSC {a.ifsc}</span>
                )}
                {a.is_default && <span className="ml-2 text-xs text-green-700 font-semibold">(Default)</span>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-800">After paying, please contact your branch to record the payment.</p>
        </div>
      )}

      <div>
        <p className="font-semibold mb-2">Payment History</p>
        <div className="rounded-xl border bg-white divide-y">
          {pays.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">No payments yet.</div>
            : pays.map((p, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{formatINR(p.amount)}</p>
                  <p className="text-xs text-gray-500 capitalize">{p.payment_mode?.replace('_', ' ')}{p.receipt_no && ` · ${p.receipt_no}`}</p>
                </div>
                <span className="text-sm text-gray-500">{formatDateDDMMYYYY(p.payment_date)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export function StudentMaterialsPage() {
  const rec = useStudentRecord()
  const [rows, setRows] = useState<Array<{ id: string; title: string; file_url: string; course: { name: string } | null }>>([])
  useEffect(() => {
    if (!rec) return
    supabase.from('uce_study_materials').select('id,title,file_url,uploaded_by_branch_id,course:uce_courses(name)')
      .eq('course_id', rec.course_id).eq('is_active', true)
      .then(({ data }) => {
        const list = (data ?? []).filter((m: Record<string, unknown>) => m.uploaded_by_branch_id === null || m.uploaded_by_branch_id === rec.branch_id)
        setRows(list as unknown as typeof rows)
      })
  }, [rec])

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Study Material</h1>
      <div className="grid gap-3">
        {rows.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No material yet.</div>
          : rows.map(r => (
            <div key={r.id} className="rounded-xl border bg-white p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><FileText size={18} /></div>
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{r.title}</p></div>
              <a href={r.file_url} target="_blank" rel="noreferrer" download className="p-2 rounded-lg hover:bg-gray-100"><Download size={16} /></a>
            </div>
          ))}
      </div>
    </div>
  )
}

export function StudentResultsPage() {
  const rec = useStudentRecord()
  const [rows, setRows] = useState<Array<{ id: string; percentage: number | null; grade: string | null; result: string | null; issue_date: string | null; course: { name: string } | null }>>([])
  useEffect(() => {
    if (!rec) return
    supabase.from('uce_marksheets').select('id,percentage,grade,result,issue_date,course:uce_courses(name)').eq('student_id', rec.id).eq('is_active', true)
      .then(({ data }) => setRows((data ?? []) as unknown as typeof rows))
  }, [rec])

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">My Results</h1>
      <div className="grid gap-3">
        {rows.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No results published yet.</div>
          : rows.map(r => (
            <div key={r.id} className="rounded-xl border bg-white p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{r.course?.name}</p>
                <p className="text-xs text-gray-500">{r.issue_date && formatDateDDMMYYYY(r.issue_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{r.percentage}%</p>
                <p className="text-xs"><span className={`inline-flex px-2 py-0.5 rounded ${r.result === 'PASS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{r.result}</span> · Grade {r.grade}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function StudentJobsPage() {
  const [rows, setRows] = useState<Array<{ id: string; title: string; company: string | null; location: string | null; description: string | null; apply_url: string | null; deadline: string | null }>>([])
  useEffect(() => {
    supabase.from('uce_jobs').select('id,title,company,location,description,apply_url,deadline').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as typeof rows))
  }, [])
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Jobs</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 sm:col-span-2">No jobs posted.</div>
          : rows.map(r => (
            <div key={r.id} className="rounded-xl border bg-white p-4">
              <p className="font-semibold">{r.title}</p>
              <p className="text-xs text-gray-500">{r.company} {r.location && `· ${r.location}`}</p>
              {r.description && <p className="mt-2 text-sm text-gray-600 line-clamp-3">{r.description}</p>}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-500">{r.deadline ? `By ${formatDateDDMMYYYY(r.deadline)}` : ''}</span>
                {r.apply_url && <a href={r.apply_url} target="_blank" rel="noreferrer" className="text-red-600 font-semibold hover:underline">Apply →</a>}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function StudentExamFormPage() {
  const rec = useStudentRecord()
  const [rows, setRows] = useState<Array<{ id: string; semester: number | null; exam_session: string | null; status: string; created_at: string }>>([])
  useEffect(() => {
    if (!rec) return
    supabase.from('uce_exam_forms').select('id,semester,exam_session,status,created_at').eq('student_id', rec.id).order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as typeof rows))
  }, [rec])
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">My Exam Forms</h1>
      <p className="text-sm text-gray-500">Submitted by your branch. Contact your branch if you want to add one.</p>
      <div className="rounded-xl border bg-white divide-y">
        {rows.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">No exam forms yet.</div>
          : rows.map(r => (
            <div key={r.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.exam_session} {r.semester && `· Sem ${r.semester}`}</p>
                <p className="text-xs text-gray-500">{formatDateDDMMYYYY(r.created_at)}</p>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${r.status === 'approved' ? 'bg-green-50 text-green-700' : r.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.status}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
