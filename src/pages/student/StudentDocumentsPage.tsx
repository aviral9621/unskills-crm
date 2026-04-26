import { useEffect, useState } from 'react'
import { IdCard, ClipboardList, ScrollText, Award, Download, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY, cn } from '../../lib/utils'
import { toast } from 'sonner'
import {
  buildAdmitCardPdfBlob,
  toDataUrl,
  type AdmitCardSchedule,
} from '../../lib/pdf/admit-card'
import { getAdmitCardSettings } from '../../lib/admitCardSettings'
import { buildIdCardPdfBlob } from '../../lib/pdf/id-card'
import { getCardSettings, idCardVerifyUrl } from '../../lib/cardSettings'

type Tab = 'idcard' | 'admit' | 'marksheet' | 'certificate'

interface AdmitCardRow {
  id: string
  semester: number | null
  exam_session: string | null
  created_at: string
  exam_center_name: string | null
  exam_center_code: string | null
  exam_center_address: string | null
  schedule: AdmitCardSchedule[] | null
  is_active: boolean | null
  student_visible: boolean | null
}

export default function StudentDocumentsPage() {
  const { rec } = useStudentRecord()
  const [tab, setTab] = useState<Tab>('idcard')
  const [admitCards, setAdmitCards] = useState<AdmitCardRow[]>([])
  const [marksheets, setMarksheets] = useState<Array<{ id: string; issue_date: string | null; percentage: number | null; grade: string | null; result: string | null; course: { name: string } | null }>>([])
  const [certificates, setCertificates] = useState<Array<{ id: string; certificate_number: string; course_name: string | null; issue_date: string | null; grade: string | null; status: string | null }>>([])
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!rec) return
    supabase
      .from('uce_admit_cards')
      .select('id, semester, exam_session, created_at, exam_center_name, exam_center_code, exam_center_address, schedule, is_active, student_visible')
      .eq('student_id', rec.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const visible = ((data ?? []) as AdmitCardRow[]).filter(c => (c.is_active ?? true) && (c.student_visible ?? true))
        setAdmitCards(visible)
      })
    supabase.from('uce_marksheets').select('id,issue_date,percentage,grade,result,course:uce_courses(name)').eq('student_id', rec.id).eq('is_active', true).order('issue_date', { ascending: false })
      .then(({ data }) => setMarksheets((data ?? []) as unknown as typeof marksheets))
    supabase.from('uce_certificates').select('id,certificate_number,course_name,issue_date,grade,status').eq('student_id', rec.id).order('issue_date', { ascending: false })
      .then(({ data }) => setCertificates((data ?? []) as typeof certificates))
  }, [rec])

  if (!rec) return null

  async function downloadIdCard() {
    if (!rec) return
    setDownloading('idcard')
    try {
      const [settings, masterLogo] = await Promise.all([
        getCardSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      ])
      // Branch info & main branch (first branch is treated as head office for footer)
      const { data: branch } = await supabase
        .from('uce_branches')
        .select('name, center_logo_url, address_line1, village, block, district, state, pincode, director_phone, director_email')
        .eq('id', rec.branch_id)
        .maybeSingle()
      const { data: mainBranchData } = await supabase
        .from('uce_branches')
        .select('name, center_logo_url, address_line1, village, block, district, state, pincode, director_phone, director_email')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const photoDataUrl = rec.photo_url ? await toDataUrl(rec.photo_url).catch(() => '') : ''
      const branchLogoDataUrl = branch?.center_logo_url ? await toDataUrl(branch.center_logo_url).catch(() => '') : ''
      const logoDataUrl = branchLogoDataUrl || masterLogo

      const verifyUrl = idCardVerifyUrl(settings.verify_base_url, rec.registration_no)
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' } })

      const { data: student } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, course:uce_courses(name)')
        .eq('id', rec.id)
        .maybeSingle()
      if (!student) { toast.error('Student record not found'); return }

      const blob = await buildIdCardPdfBlob([{
        student: { ...(student as unknown as { id: string; registration_no: string; name: string; father_name: string; dob: string | null; course: { name: string } | null }), branch: branch ?? null },
        qrDataUrl, photoDataUrl, logoDataUrl,
        title: branch?.name || settings.header_title,
        settings, mainBranch: mainBranchData ?? null,
      }])
      if (!blob) { toast.error('Failed to build PDF'); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ID-Card-${rec.registration_no.replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('ID Card downloaded')
    } catch (err) { console.error(err); toast.error('Failed to generate ID Card') }
    finally { setDownloading(null) }
  }

  async function downloadAdmitCard(card: AdmitCardRow) {
    if (!rec) return
    setDownloading(card.id)
    try {
      const { data: sd } = await supabase
        .from('uce_students')
        .select('id, registration_no, name, father_name, dob, gender, photo_url, session, enrollment_date, course:uce_courses(name, code)')
        .eq('id', rec.id)
        .maybeSingle()
      if (!sd) { toast.error('Student not found'); return }
      const s = sd as typeof sd & { course?: { name: string; code: string } | null }

      const [settings, logoDataUrl, isoLogoDataUrl] = await Promise.all([
        getAdmitCardSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
        toDataUrl(encodeURI('/ISO LOGOs.png')).catch(() => ''),
      ])
      const photoDataUrl = s.photo_url ? await toDataUrl(s.photo_url).catch(() => '') : ''

      const blob = await buildAdmitCardPdfBlob({
        student: {
          id: s.id, registration_no: s.registration_no, name: s.name, father_name: s.father_name,
          dob: s.dob, gender: s.gender, photo_url: s.photo_url,
          course_name: s.course ? `${s.course.name} (${s.course.code})` : '—',
          session: s.session, enrollment_date: s.enrollment_date,
        },
        center: {
          name: card.exam_center_name || '',
          code: card.exam_center_code || '',
          address: card.exam_center_address || '',
          semester: card.semester != null ? `Semester ${card.semester}` : null,
        },
        schedule: card.schedule ?? [],
        settings, logoDataUrl, isoLogoDataUrl, photoDataUrl,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Admit-Card-${s.registration_no.replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Admit Card downloaded')
    } catch (err) { console.error(err); toast.error('Failed to generate PDF') }
    finally { setDownloading(null) }
  }

  function downloadMarksheet(id: string) {
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
            {rec.photo_url ? (
              <img src={rec.photo_url} alt="" className="h-28 w-24 object-cover rounded-lg border shrink-0" />
            ) : (
              <div className="h-28 w-24 rounded-lg border shrink-0 bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-3xl">
                {rec.name.charAt(0).toUpperCase()}
              </div>
            )}
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
          <div className="mt-4 flex justify-end">
            <button
              onClick={downloadIdCard}
              disabled={downloading === 'idcard'}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {downloading === 'idcard' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading === 'idcard' ? 'Generating...' : 'Download ID Card'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">Hard-copy prints are issued by your institute.</p>
        </div>
      )}

      {tab === 'admit' && (
        <div className="space-y-3">
          {admitCards.length === 0 ? (
            <Empty icon={ClipboardList} label="No admit cards issued yet." />
          ) : admitCards.map(a => (
            <div key={a.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold break-words">
                  Admit Card
                  {a.semester != null && <span className="text-gray-500"> · Sem {a.semester}</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {a.exam_session && <>{a.exam_session} · </>}
                  Issued {formatDateDDMMYYYY(a.created_at)}
                </p>
              </div>
              <Link
                to="/student/admit-card"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-50"
              >
                View
              </Link>
              <button
                onClick={() => downloadAdmitCard(a)}
                disabled={downloading === a.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {downloading === a.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {downloading === a.id ? 'Generating...' : 'Download'}
              </button>
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
