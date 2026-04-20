import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface Row {
  id: string; semester: number | null; exam_session: string | null; status: string; created_at: string
  student: { name: string; registration_no: string } | null
  course: { name: string } | null
  branch: { name: string; code: string } | null
}

export default function AdminExamFormsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'submitted' | 'approved' | 'rejected'>('submitted')

  async function load() {
    const { data } = await supabase.from('uce_exam_forms')
      .select('id,semester,exam_session,status,created_at,student:uce_students(name,registration_no),course:uce_courses(name),branch:uce_branches(name,code)')
      .eq('status', tab).order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => { load() }, [tab])

  async function review(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase.from('uce_exam_forms').update({
      status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success(status); load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Exam Forms</h1>
        <p className="text-sm text-gray-500">Review branch-submitted exam forms.</p>
      </div>

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {(['submitted', 'approved', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-red-600' : 'text-gray-600'}`}>{t}</button>
        ))}
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Branch</th><th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Session</th><th className="px-4 py-3">Sem</th>
              {tab === 'submitted' && <th className="px-4 py-3">Action</th>}
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
                {tab === 'submitted' && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => review(r.id, 'approved')} className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"><Check size={12} /></button>
                      <button onClick={() => review(r.id, 'rejected')} className="px-2 py-1 text-xs rounded bg-white border border-red-300 text-red-600 hover:bg-red-50"><X size={12} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={tab === 'submitted' ? 7 : 6} className="px-4 py-8 text-center text-gray-400">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
