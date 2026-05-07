import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, FileBadge2 } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { getCertificateSettings } from '../../lib/certificateSettings'
import {
  buildRegistrationCertificatePdf,
  toDataUrl,
  REG_CERT_ASSETS,
  type RegCertBranch,
  type RegCertCourse,
  type RegCertStudent,
} from '../../lib/pdf/registration-certificate'

interface FetchedStudent extends RegCertStudent {
  id: string
  branch: RegCertBranch | null
  course: RegCertCourse | null
}

const HEAD_OFFICE_ADDRESS =
  'UnSkills Building Near Primary School Ranipur Road Mariahu Jaunpur'
const HEAD_OFFICE_CONTACTS = '8382898866, 9838382898'
const BRAND_TITLE = 'UnSkills Computer Education'
const DEFAULT_VERIFY_URL =
  'https://unskillseducation.org/student/registration-certificate'

export default function RegistrationCertificatePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const studentId = params.get('student') || ''

  const [student, setStudent] = useState<FetchedStudent | null>(null)
  const [amountPaid, setAmountPaid] = useState(0)
  const [paymentDate, setPaymentDate] = useState<string | null>(null)
  const [verifyUrlBase, setVerifyUrlBase] = useState<string>(DEFAULT_VERIFY_URL)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!studentId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const branchCols =
          'name, center_logo_url, address_line1, village, block, district, state, pincode, director_phone'
        const [{ data, error }, paymentsRes, settings] = await Promise.all([
          supabase
            .from('uce_students')
            .select(
              `id, registration_no, name, father_name, mother_name, dob, gender, category, religion, address, village, block, district, state, pincode, phone, email, identity_type, aadhar_number, photo_url, admission_date, enrollment_date, session, total_fee, net_fee, monthly_fee, installment_count, fee_start_month,
               course:uce_courses(name, duration_label, duration_months),
               branch:uce_branches!uce_students_branch_id_fkey(${branchCols})`,
            )
            .eq('id', studentId)
            .single(),
          supabase
            .from('uce_student_fee_payments')
            .select('amount, payment_date')
            .eq('student_id', studentId)
            .order('payment_date', { ascending: true }),
          getCertificateSettings().catch(() => null),
        ])
        if (cancelled) return
        if (error) throw error
        const row = data as unknown as FetchedStudent
        setStudent(row)
        const payments = (paymentsRes.data ?? []) as Array<{ amount: number; payment_date: string | null }>
        const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        setAmountPaid(paid)
        const firstDate = payments.find(p => p.payment_date)?.payment_date ?? null
        setPaymentDate(firstDate)
        if (settings) {
          if (settings.registration_verify_url) setVerifyUrlBase(settings.registration_verify_url)
          else if (settings.verification_url_base) {
            // Fall back to deriving the host from the existing certificate URL.
            try {
              const u = new URL(settings.verification_url_base)
              setVerifyUrlBase(`${u.origin}/student/registration-certificate`)
            } catch { /* keep default */ }
          }
          setSignatureUrl(settings.signature_image_url || null)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) toast.error('Failed to load student')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [studentId])

  const nextDueDate = useMemo(() => {
    if (!student?.fee_start_month || !student.installment_count) return null
    const start = new Date(student.fee_start_month)
    if (isNaN(start.getTime())) return null
    // crude: next-due = first unpaid month, where each paid 'monthly_fee' covers one installment
    const monthsPaid = student.monthly_fee && student.monthly_fee > 0
      ? Math.floor(amountPaid / Number(student.monthly_fee))
      : 0
    const next = new Date(start)
    next.setMonth(next.getMonth() + monthsPaid)
    if (monthsPaid >= (student.installment_count || 0)) return null
    return next.toISOString().slice(0, 10)
  }, [student, amountPaid])

  // Build the PDF whenever student / fees change.
  useEffect(() => {
    let revokedUrl = ''
    let cancelled = false
    async function build() {
      if (!student) return
      setGenerating(true)
      try {
        const verifyUrl = `${verifyUrlBase}${verifyUrlBase.includes('?') ? '&' : '?'}reg=${encodeURIComponent(student.registration_no)}`
        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
          margin: 1, width: 260, color: { dark: '#0B1B3F', light: '#ffffff' },
        }).catch(() => '')

        const branchLogoUrl = student.branch?.center_logo_url || REG_CERT_ASSETS.FALLBACK_LOGO
        const [branchLogoDataUrl, sealDataUrl, signatureDataUrl] = await Promise.all([
          toDataUrl(branchLogoUrl),
          toDataUrl(REG_CERT_ASSETS.SEAL_PATH),
          signatureUrl ? toDataUrl(signatureUrl) : Promise.resolve(''),
        ])

        const blob = await buildRegistrationCertificatePdf({
          student: {
            registration_no: student.registration_no,
            name: student.name,
            father_name: student.father_name,
            mother_name: student.mother_name,
            address: student.address,
            village: student.village,
            block: student.block,
            district: student.district,
            state: student.state,
            pincode: student.pincode,
            dob: student.dob,
            gender: student.gender,
            category: student.category,
            religion: student.religion,
            phone: student.phone,
            email: student.email,
            identity_type: student.identity_type,
            aadhar_number: student.aadhar_number,
            admission_date: student.admission_date,
            enrollment_date: student.enrollment_date,
            session: student.session,
            total_fee: student.total_fee,
            net_fee: student.net_fee,
            monthly_fee: student.monthly_fee,
            installment_count: student.installment_count,
            fee_start_month: student.fee_start_month,
            photo_url: student.photo_url,
          },
          course: student.course,
          branch: student.branch,
          fees: {
            amountPaid,
            paymentDate,
            nextInstallmentDue: nextDueDate,
          },
          qrDataUrl,
          branchLogoDataUrl,
          sealDataUrl,
          signatureDataUrl,
          headOfficeAddress: HEAD_OFFICE_ADDRESS,
          headOfficeContacts: HEAD_OFFICE_CONTACTS,
          brandTitle: student.branch?.name || BRAND_TITLE,
        })
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        revokedUrl = url
        setPdfUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) toast.error('Failed to generate PDF')
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }
    void build()
    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, amountPaid, paymentDate, nextDueDate, verifyUrlBase, signatureUrl])

  function handleDownload() {
    if (!pdfUrl || !student) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `Registration-Certificate-${student.registration_no.replace(/[\\/]+/g, '-')}.pdf`
    a.click()
  }

  if (!studentId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <FileBadge2 size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No student selected. Open this page from the student list’s ⋮ menu.</p>
        <button
          onClick={() => navigate('/admin/students')}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm"
        >
          <ArrowLeft size={14} /> Back to Students
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <FileBadge2 size={20} className="text-red-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">
              Registration Certificate
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
              {student ? `${student.name} · ${student.registration_no}` : 'Loading…'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={!pdfUrl || generating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {generating ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-red-600" />
        </div>
      ) : !student ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">Student not found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {pdfUrl ? (
            // 100vh minus the header row + a little breathing room. Fits a full A4
            // preview on desktop and stays usable on mobile.
            <iframe
              key={pdfUrl}
              title="Registration Certificate"
              src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              className="block w-full bg-gray-100"
              style={{ height: 'calc(100vh - 140px)', minHeight: 480, border: 'none' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="animate-spin text-red-600" />
              <p className="text-xs text-gray-400">Generating preview…</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
