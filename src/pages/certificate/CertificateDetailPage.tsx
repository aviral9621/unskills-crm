import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PDFViewer } from '@react-pdf/renderer'
import { ArrowLeft, Loader2, Download, Ban, RefreshCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getCertificateSettings } from '../../lib/certificateSettings'
import {
  CertificateOfQualification,
  buildCertificateOfQualificationBlob,
} from '../../lib/pdf/certificate-qualification'
import {
  ComputerBasedTypingCertificate,
  buildComputerBasedTypingBlob,
} from '../../lib/pdf/certificate-typing'
import { toDataUrl } from '../../lib/pdf/marksheet'
import { formatDateDDMMYYYY } from '../../lib/utils'
import type { Certificate, CertificateSettings } from '../../types/certificate'

const CERT_LOGO_URLS = [
  '/ISO LOGOs.png',
  '/MSME loogo.png',
  '/Skill India Logo.png',
  '/NSDC logo.png',
  '/Digital India logo.png',
  '/ANSI logo.png',
  '/IAF LOGO.png',
]

interface CertificateRow extends Certificate {
  template?: { name: string; slug: 'certificate-of-qualification' | 'computer-based-typing' }
  branch?: { center_logo_url: string | null } | null
}

export default function CertificateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [cert, setCert] = useState<CertificateRow | null>(null)
  const [settings, setSettings] = useState<CertificateSettings | null>(null)
  const [certLogos, setCertLogos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [showRevoke, setShowRevoke] = useState(false)
  const [revokeReason, setRevokeReason] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Mount guard — PDFViewer must not render during SSR / before browser APIs are ready
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase
        .from('uce_certificates')
        .select('*, template:uce_certificate_templates(name, slug), branch:uce_branches(center_logo_url)')
        .eq('id', id)
        .single(),
      getCertificateSettings(),
      Promise.all(CERT_LOGO_URLS.map(u => toDataUrl(encodeURI(u)).catch(() => ''))),
    ])
      .then(([certRes, s, logos]) => {
        if (certRes.error) throw certRes.error
        setCert(certRes.data as unknown as CertificateRow)
        setSettings(s)
        setCertLogos(logos.filter(Boolean))
        if (searchParams.get('revoke') === '1' && isSuperAdmin) setShowRevoke(true)
        if (searchParams.get('download') === '1') {
          setTimeout(() => handleDownload(
            certRes.data as unknown as CertificateRow,
            s,
            logos.filter(Boolean),
          ), 200)
        }
      })
      .catch(e => toast.error(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleDownload(c: CertificateRow, s: CertificateSettings, logos: string[] = certLogos) {
    try {
      const slug = c.template?.slug
      const formattedDate = formatDateDDMMYYYY(c.issue_date)
      let blob: Blob
      if (slug === 'certificate-of-qualification') {
        blob = await buildCertificateOfQualificationBlob({
          settings: s,
          certificateNumber: c.certificate_number,
          issueDate: formattedDate,
          qrCodeDataUrl: c.qr_code_data_url ?? '',
          salutation: c.salutation ?? '',
          studentName: c.student_name,
          fatherPrefix: c.father_prefix ?? '',
          fatherName: c.father_name ?? '',
          studentPhotoUrl: c.student_photo_url,
          courseLevel: c.course_level ?? undefined,
          courseCode: c.course_code ?? '',
          courseName: c.course_name ?? '',
          trainingCenterName: c.training_center_name ?? '',
          performanceText: c.performance_text ?? '',
          marksScored: c.marks_scored ?? 0,
          grade: c.grade ?? '',
          typingSubjects: c.typing_subjects,
          trainingCenterLogoUrl: c.branch?.center_logo_url ?? null,
          certificationLogoUrls: logos,
        })
      } else {
        blob = await buildComputerBasedTypingBlob({
          settings: s,
          certificateNumber: c.certificate_number,
          issueDate: formattedDate,
          qrCodeDataUrl: c.qr_code_data_url ?? '',
          salutation: c.salutation ?? undefined,
          studentName: c.student_name,
          fatherPrefix: c.father_prefix ?? '',
          fatherName: c.father_name ?? '',
          studentPhotoUrl: c.student_photo_url,
          enrollmentNumber: c.enrollment_number ?? '',
          trainingCenterCode: c.training_center_code ?? '',
          trainingCenterName: c.training_center_name ?? '',
          trainingCenterLogoUrl: c.branch?.center_logo_url ?? null,
          typingSubjects: c.typing_subjects ?? [],
          grade: c.typing_grade ?? c.grade ?? '',
          certificationLogoUrls: logos,
        })
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Certificate-${c.certificate_number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    }
  }

  async function handleRevoke() {
    if (!cert) return
    if (!revokeReason.trim()) { toast.error('Enter a reason'); return }
    setRevoking(true)
    try {
      const { error } = await supabase
        .from('uce_certificates')
        .update({
          status: 'revoked',
          revoked_reason: revokeReason.trim(),
          revoked_at: new Date().toISOString(),
        })
        .eq('id', cert.id)
      if (error) throw error
      toast.success('Revoked')
      setShowRevoke(false)
      setCert({ ...cert, status: 'revoked', revoked_reason: revokeReason.trim(), revoked_at: new Date().toISOString() })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRevoking(false)
    }
  }

  async function handleDelete() {
    if (!cert) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('uce_certificates')
        .delete()
        .eq('id', cert.id)
      if (error) throw error
      toast.success('Certificate deleted')
      navigate('/admin/certificates')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  if (loading || !cert || !settings) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin text-red-600" />
      </div>
    )
  }

  const isHorizontal = cert.template?.slug === 'certificate-of-qualification'
  const formattedDate = formatDateDDMMYYYY(cert.issue_date)
  const ready = mounted && !loading && !!cert && !!settings

  const pdfComponent = isHorizontal ? (
    <CertificateOfQualification
      settings={settings}
      certificateNumber={cert.certificate_number}
      issueDate={formattedDate}
      qrCodeDataUrl={cert.qr_code_data_url ?? ''}
      salutation={cert.salutation ?? ''}
      studentName={cert.student_name}
      fatherPrefix={cert.father_prefix ?? ''}
      fatherName={cert.father_name ?? ''}
      studentPhotoUrl={cert.student_photo_url}
      courseLevel={cert.course_level ?? undefined}
      courseCode={cert.course_code ?? ''}
      courseName={cert.course_name ?? ''}
      trainingCenterName={cert.training_center_name ?? ''}
      performanceText={cert.performance_text ?? ''}
      marksScored={cert.marks_scored ?? 0}
      grade={cert.grade ?? ''}
      typingSubjects={cert.typing_subjects}
      trainingCenterLogoUrl={cert.branch?.center_logo_url ?? null}
      certificationLogoUrls={certLogos}
    />
  ) : (
    <ComputerBasedTypingCertificate
      settings={settings}
      certificateNumber={cert.certificate_number}
      issueDate={formattedDate}
      qrCodeDataUrl={cert.qr_code_data_url ?? ''}
      salutation={cert.salutation ?? undefined}
      studentName={cert.student_name}
      fatherPrefix={cert.father_prefix ?? ''}
      fatherName={cert.father_name ?? ''}
      studentPhotoUrl={cert.student_photo_url}
      enrollmentNumber={cert.enrollment_number ?? ''}
      trainingCenterCode={cert.training_center_code ?? ''}
      trainingCenterName={cert.training_center_name ?? ''}
      trainingCenterLogoUrl={cert.branch?.center_logo_url ?? null}
      typingSubjects={cert.typing_subjects ?? []}
      grade={cert.typing_grade ?? cert.grade ?? ''}
      certificationLogoUrls={certLogos}
    />
  )

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/certificates')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold font-heading">{cert.certificate_number}</h1>
          <p className="text-xs text-gray-500">
            {cert.student_name} · {cert.template?.name}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void handleDownload(cert, settings)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={() => navigate('/admin/certificates/issue')}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCcw size={14} /> Re-issue
          </button>
          {isSuperAdmin && cert.status === 'active' ? (
            <button
              onClick={() => setShowRevoke(true)}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <Ban size={14} /> Revoke
            </button>
          ) : null}
          {isSuperAdmin ? (
            <button
              onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : null}
        </div>
      </div>

      {cert.status === 'revoked' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          <strong>Revoked</strong>
          {cert.revoked_reason ? <> — {cert.revoked_reason}</> : null}
          {cert.revoked_at ? <> · {new Date(cert.revoked_at).toLocaleString()}</> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-gray-200 rounded-xl overflow-hidden bg-white" style={{ height: 800 }}>
          {ready ? (
            <PDFViewer width="100%" height="800px" showToolbar>
              {pdfComponent}
            </PDFViewer>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <Loader2 className="animate-spin text-red-600 mr-2" />
              <span className="text-sm text-gray-500">Loading certificate…</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
            <Row label="Certificate No." value={cert.certificate_number} mono />
            <Row label="Student" value={cert.student_name} />
            <Row label={cert.father_prefix ?? 'Father'} value={cert.father_name ?? '—'} />
            <Row label="Course" value={cert.course_name ?? '—'} />
            <Row label="Training Center" value={cert.training_center_name ?? '—'} />
            <Row label="Issue Date" value={formattedDate} />
            <Row label="Status" value={cert.status} />
            {cert.grade ? <Row label="Grade" value={cert.grade} /> : null}
            {cert.marks_scored != null ? <Row label="Marks" value={String(cert.marks_scored)} /> : null}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-xs">
            <p className="text-gray-500 mb-1">Verification URL</p>
            <a
              href={cert.qr_target_url ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-red-600 break-all hover:underline"
            >
              {cert.qr_target_url ?? '—'}
            </a>
          </div>
        </div>
      </div>

      {/* Revoke modal */}
      {showRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
            <h3 className="text-lg font-semibold">Revoke certificate</h3>
            <p className="text-sm text-gray-600">
              This will mark {cert.certificate_number} as revoked. Public verify page will show revoked status.
            </p>
            <textarea
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              rows={3}
              placeholder="Reason for revocation"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRevoke(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => void handleRevoke()}
                disabled={revoking}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {revoking ? 'Revoking…' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
            <h3 className="text-lg font-semibold text-red-700">Delete certificate</h3>
            <p className="text-sm text-gray-600">
              Delete certificate <strong>{cert.certificate_number}</strong>? This permanently removes the record and cannot be undone.
              Use <strong>Revoke</strong> instead if you want to keep an audit trail.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
