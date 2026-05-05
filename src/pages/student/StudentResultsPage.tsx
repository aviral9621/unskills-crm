import { useEffect, useState } from 'react'
import { Eye, Award } from 'lucide-react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY } from '../../lib/utils'
import { toast } from 'sonner'
import {
  getMarksheetSettings,
  parseGradingScheme,
  marksheetVerifyUrl,
} from '../../lib/marksheetSettings'
import { toDataUrl } from '../../lib/pdf/marksheet'
import MarksheetHTMLPreview, { type MarksheetPreviewData } from '../../components/MarksheetHTMLPreview'

interface Marksheet {
  id: string; serial_no: string | null; percentage: number | null; grade: string | null; result: string | null
  issue_date: string | null; marks_data: Record<string, unknown>; total_obtained: number | null
  total_max: number | null; is_final: boolean
  course: { name: string; code: string } | null
}

async function buildQrDataUrl(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#111827', light: '#ffffff' } })
  } catch { return '' }
}

export default function StudentResultsPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Marksheet[]>([])
  const [previewData, setPreviewData] = useState<MarksheetPreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_marksheets')
      .select('id,serial_no,percentage,grade,result,issue_date,marks_data,total_obtained,total_max,is_final,course:uce_courses(name,code)')
      .eq('student_id', rec.id).eq('is_active', true)
      .order('issue_date', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Marksheet[]))
  }, [rec])

  async function openPreview(m: Marksheet) {
    if (!rec) return
    setPreviewLoading(m.id)
    try {
      const [settings, logoDataUrl] = await Promise.all([
        getMarksheetSettings(),
        toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => ''),
      ])

      const br = rec.branch
      const centerAddress = br
        ? [br.address_line1, br.district, br.state, br.pincode].filter(Boolean).join(', ')
        : ''
      const centerCode = br?.b_code || br?.code || ''

      const [photoDataUrl, signatureDataUrl, qrDataUrl] = await Promise.all([
        rec.photo_url ? toDataUrl(rec.photo_url).catch(() => '') : Promise.resolve(''),
        settings.left_signature_url ? toDataUrl(settings.left_signature_url).catch(() => '') : Promise.resolve(''),
        buildQrDataUrl(marksheetVerifyUrl(settings.verify_base_url, m.serial_no || rec.registration_no)),
      ])

      const md = m.marks_data as { roll_no?: string; semesters?: number[]; subjects?: unknown[]; grading_scheme?: unknown[]; notes?: string }
      const bands = md.grading_scheme?.length
        ? (md.grading_scheme as ReturnType<typeof parseGradingScheme>)
        : parseGradingScheme(settings.grading_scheme_json)

      const courseFull = m.course ? `${m.course.name}${m.course.code ? ` (${m.course.code})` : ''}` : '—'

      setPreviewData({
        serial_no: m.serial_no || '',
        issue_date: m.issue_date,
        grade: m.grade,
        result: m.result,
        percentage: m.percentage,
        total_obtained: m.total_obtained,
        total_max: m.total_max,
        is_final: m.is_final,
        roll_no: md.roll_no || '',
        subjects: (md.subjects ?? []) as MarksheetPreviewData['subjects'],
        grading_scheme: bands,
        session: rec.session,
        student_name: rec.name,
        registration_no: rec.registration_no,
        father_name: rec.father_name,
        enrollment_date: rec.enrollment_date,
        center_name: br?.name || '—',
        center_code: centerCode,
        center_address: centerAddress || '—',
        course_name: courseFull,
        course_duration: '—',
        signer_name: settings.left_signer_name,
        signer_title: settings.left_signer_title,
        signer_org: settings.left_signer_org,
        signature_url: signatureDataUrl || null,
        footer_address: settings.footer_address,
        website: settings.website,
        email: settings.email,
        notes: settings.notes || md.notes,
        qrDataUrl,
        logoDataUrl,
        photoDataUrl,
      })
    } catch (err) { console.error(err); toast.error('Could not load marksheet preview') }
    finally { setPreviewLoading(null) }
  }

  if (!rec) return null
  return (
    <>
      {previewData && (
        <MarksheetHTMLPreview
          data={previewData}
          onClose={() => setPreviewData(null)}
        />
      )}
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold font-heading">My Results</h1>
        <div className="grid gap-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
              <Award size={28} className="mx-auto mb-2 text-gray-300" />No results published yet.
            </div>
          ) : rows.map(m => (
            <div key={m.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold break-words">{m.course?.name}</p>
                <p className="text-xs text-gray-500">{m.issue_date && formatDateDDMMYYYY(m.issue_date)}</p>
                <p className="text-sm mt-2">
                  <b>{m.total_obtained}</b> / {m.total_max} &middot;
                  <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-semibold ${m.result === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {m.result ? m.result.charAt(0).toUpperCase() + m.result.slice(1) : '—'}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">Grade {m.grade}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-heading text-red-600">{m.percentage ? `${Number(m.percentage).toFixed(2)}%` : '—'}</p>
              </div>
              <button
                onClick={() => openPreview(m)}
                disabled={previewLoading === m.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                {previewLoading === m.id
                  ? <span className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  : <Eye size={12} />}
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
