import { useEffect, useState } from 'react'
import { IdCard, ClipboardList, ScrollText, Award, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY, cn } from '../../lib/utils'
import { toast } from 'sonner'

type Tab = 'idcard' | 'admit' | 'marksheet' | 'certificate'

export default function StudentDocumentsPage() {
  const { rec } = useStudentRecord()
  const [tab, setTab] = useState<Tab>('idcard')
  const [admitCards, setAdmitCards] = useState<Array<{ id: string; title: string | null; exam_session: string | null; created_at: string }>>([])
  const [marksheets, setMarksheets] = useState<Array<{ id: string; issue_date: string | null; percentage: number | null; grade: string | null; result: string | null; course: { name: string } | null }>>([])
  const [certificates, setCertificates] = useState<Array<{ id: string; certificate_number: string; course_name: string | null; issue_date: string | null; grade: string | null; status: string | null }>>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_admit_cards').select('id,title,exam_session,created_at').eq('student_id', rec.id).order('created_at', { ascending: false })
      .then(({ data }) => setAdmitCards((data ?? []) as typeof admitCards))
    supabase.from('uce_marksheets').select('id,issue_date,percentage,grade,result,course:uce_courses(name)').eq('student_id', rec.id).eq('is_active', true).order('issue_date', { ascending: false })
      .then(({ data }) => setMarksheets((data ?? []) as unknown as typeof marksheets))
    supabase.from('uce_certificates').select('id,certificate_number,course_name,issue_date,grade,status').eq('student_id', rec.id).order('issue_date', { ascending: false })
      .then(({ data }) => setCertificates((data ?? []) as typeof certificates))
  }, [rec])

  if (!rec) return null

  async function downloadMarksheet(id: string) {
    toast.info('Marksheet download available from Results page')
    void id
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType; count: number }> = [
    { id: 'idcard', label: 'ID Card', icon: IdCard, count: 1 },
    { id: 'admit', label: 'Admit Card', icon: ClipboardList, count: admitCards.length },
    { id: 'marksheet', label: 'Marksheet', icon: ScrollText, count: marksheets.length },
    { id: 'certificate', label: 'Certificate', icon: Award, count: certificates.length },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">My Documents</h1>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors',
                tab === t.id ? 'bg-red-600 text-white shadow-sm' : 'bg-white border text-gray-600 hover:bg-gray-50',
              )}>
              <Icon size={14} /> {t.label}
              {t.count > 0 && <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-semibold', tab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>{t.count}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'idcard' && (
        <div className="rounded-xl border bg-white p-4 sm:p-5">
          <div className="flex items-start gap-4 flex-col sm:flex-row">
            {rec.photo_url && <img src={rec.photo_url} alt="" className="h-28 w-24 object-cover rounded-lg border shrink-0" />}
            <div className="flex-1">
              <p className="text-xs uppercase text-gray-400">Student ID Card</p>
              <p className="font-heading text-lg font-bold">{rec.name}</p>
              <p className="font-mono text-xs text-gray-500">{rec.registration_no}</p>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <InfoLine k="Father" v={rec.father_name} />
                <InfoLine k="Course" v={rec.course?.name ?? '—'} />
                <InfoLine k="Phone" v={rec.phone} />
                <InfoLine k="Institute" v={rec.branch?.name ?? '—'} />
                <InfoLine k="Session" v={rec.session ?? '—'} />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">This is a view-only digital ID card. Contact your institute to request a printed card.</p>
        </div>
      )}

      {tab === 'admit' && (
        <div className="space-y-3">
          {admitCards.length === 0 ? (
            <Empty icon={ClipboardList} label="No admit cards issued yet." />
          ) : admitCards.map(a => (
            <div key={a.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold break-words">{a.title || 'Admit Card'}</p>
                <p className="text-xs text-gray-500">{a.exam_session} · {formatDateDDMMYYYY(a.created_at)}</p>
              </div>
              <Link to={`/student/documents/admit/${a.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-50">
                <Download size={12} /> View
              </Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'marksheet' && (
        <div className="space-y-3">
          {marksheets.length === 0 ? (
            <Empty icon={ScrollText} label="No marksheets issued yet." />
          ) : marksheets.map(m => (
            <div key={m.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold break-words">{m.course?.name}</p>
                <p className="text-xs text-gray-500">{m.issue_date && formatDateDDMMYYYY(m.issue_date)} · Grade {m.grade} · {m.result}</p>
              </div>
              <p className="text-red-600 font-bold">{m.percentage ? `${m.percentage}%` : '—'}</p>
              <button onClick={() => downloadMarksheet(m.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-50">
                <Download size={12} /> View
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'certificate' && (
        <div className="space-y-3">
          {certificates.length === 0 ? (
            <Empty icon={Award} label="No certificates issued yet." />
          ) : certificates.map(c => (
            <div key={c.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold break-words">{c.course_name}</p>
                <p className="text-xs text-gray-500">{c.certificate_number} · {c.issue_date && formatDateDDMMYYYY(c.issue_date)} · Grade {c.grade}</p>
              </div>
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-semibold capitalize',
                c.status === 'active' || c.status === 'issued' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                {c.status}
              </span>
              <Link to={`/student/documents/certificate/${c.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-50">
                <Download size={12} /> View
              </Link>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">All documents here are view-only. Hard-copy prints are issued by your institute.</p>
    </div>
  )
}

function InfoLine({ k, v }: { k: string; v: string }) {
  return (<div><p className="text-gray-400 uppercase text-[10px]">{k}</p><p className="font-medium break-words">{v}</p></div>)
}
function Empty({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (<div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400"><Icon size={28} className="mx-auto mb-2 text-gray-300" />{label}</div>)
}
