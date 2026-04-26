import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, IdCard, MapPin, Clock, FileText, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import {
  buildAdmitCardPdfBlob,
  toDataUrl,
  type AdmitCardSchedule,
} from '../../lib/pdf/admit-card'
import { getAdmitCardSettings } from '../../lib/admitCardSettings'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface AdmitCardRecord {
  id: string
  student_id: string
  course_id: string
  semester: number | null
  exam_session: string | null
  exam_center_name: string | null
  exam_center_code: string | null
  exam_center_address: string | null
  schedule: AdmitCardSchedule[] | null
  is_active: boolean | null
  student_visible: boolean | null
  visible_from: string | null
  visible_until: string | null
  paper_set_id: string | null
  created_at: string
  paper_set?: { id: string; paper_name: string; available_from: string | null; available_to: string | null } | null
}

function paperIsActiveNow(p: { available_from: string | null; available_to: string | null }): boolean {
  const now = Date.now()
  if (p.available_from && new Date(p.available_from).getTime() > now) return false
  if (p.available_to && new Date(p.available_to).getTime() < now) return false
  return true
}

export default function StudentAdmitCardPage() {
  const { rec } = useStudentRecord()
  const [cards, setCards] = useState<AdmitCardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!rec) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('uce_admit_cards')
        .select('id, student_id, course_id, semester, exam_session, exam_center_name, exam_center_code, exam_center_address, schedule, is_active, student_visible, visible_from, visible_until, paper_set_id, created_at, paper_set:uce_paper_sets(id, paper_name, available_from, available_to)')
        .eq('student_id', rec.id)
        .order('created_at', { ascending: false })
      const now = Date.now()
      const visible = (data ?? []).filter(c => {
        if (!(c.is_active ?? true)) return false
        if (!(c.student_visible ?? true)) return false
        if (c.visible_from && new Date(c.visible_from).getTime() > now) return false
        if (c.visible_until && new Date(c.visible_until).getTime() < now) return false
        return true
      })
      setCards(visible as unknown as AdmitCardRecord[])
      setLoading(false)
    })()
  }, [rec])

  async function download(card: AdmitCardRecord) {
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
    } catch (err) { console.error(err); toast.error('Failed to generate PDF') }
    finally { setDownloading(null) }
  }

  if (!rec) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Admit Card</h1>
        <p className="text-sm text-gray-500">Download your admit card and bring it to the exam center.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-red-600" /></div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <IdCard size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No admit card available yet.</p>
          <p className="text-xs text-gray-400 mt-1">It will appear here once your exam form is approved and admit card is generated.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(c => (
            <div key={c.id} className="rounded-xl border bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {rec.course?.name}
                    {c.semester != null && <span className="text-gray-500"> · Sem {c.semester}</span>}
                    {c.exam_session && <span className="text-gray-500"> · {c.exam_session}</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Issued {formatDateDDMMYYYY(c.created_at)}</p>
                </div>
                <button onClick={() => download(c)} disabled={downloading === c.id}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0">
                  {downloading === c.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {downloading === c.id ? 'Generating...' : 'Download PDF'}
                </button>
              </div>

              {c.exam_center_name && (
                <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-700">{c.exam_center_name}{c.exam_center_code ? ` (${c.exam_center_code})` : ''}</p>
                    <p>{c.exam_center_address}</p>
                  </div>
                </div>
              )}

              {Array.isArray(c.schedule) && c.schedule.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {c.schedule.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-900 min-w-[120px]">{s.subject_name}</span>
                      <span className="text-gray-600">{formatDateDDMMYYYY(s.date)}</span>
                      <span className="text-gray-500 inline-flex items-center gap-1"><Clock size={11} /> {s.exam_time}{s.end_time ? ` – ${s.end_time}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}

              {c.paper_set && paperIsActiveNow(c.paper_set) && (
                <Link
                  to={`/student/tests/${c.paper_set.id}`}
                  className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm hover:bg-emerald-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <FileText size={14} /> Online Paper available: <strong>{c.paper_set.paper_name}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">Start Paper <ArrowRight size={14} /></span>
                </Link>
              )}
              {c.paper_set && !paperIsActiveNow(c.paper_set) && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
                  Online paper <strong>{c.paper_set.paper_name}</strong> will open at the scheduled time.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
