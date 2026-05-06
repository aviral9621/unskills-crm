import { useEffect, useState } from 'react'
import { generateComputerSoftwareLandscapeCertificate } from '../../lib/pdf/cert-generator'
import { generateQRDataUrl } from '../../lib/pdf/generate-qr'
import type { CertificateSettings } from '../../types/certificate'

const MOCK_SETTINGS: CertificateSettings = {
  id: 'mock',
  institute_name: 'UNSKILLS COMPUTER EDUCATION',
  institute_reg_number: '209815',
  tagline: 'An ISO 9001:2015 Certified Organization',
  sub_header_line_1: 'Run by UnSkills FuturePath Tech Pvt. Ltd. Regd. by Govt. of India CIN No. U85499UP2025PTC220102',
  sub_header_line_2: 'Alliance with Skill India, MSME, Niti Ayog, NSDC, Labour & Department',
  sub_header_line_3: 'Regd. Under the Company Act 2013 Ministry of Corporate Affairs, Govt. of India',
  corporate_office_address: 'Corporate Office : B-7, Ground Floor, Sec-2, Noida, Gautam Buddha Nagar, UP - 201301',
  verification_url_base: 'https://unskillseducation.org/verify',
  registration_verify_url: 'https://unskills-computer-education.vercel.app/student/registration-certificate',
  contact_email: 'info@unskillseducation.org',
  logo_url: null,
  training_center_logo_url: null,
  signatory_name: 'Er. Ankit Vishwakarma',
  signatory_designation: 'Chief Executive Officer',
  signatory_company_line: 'UnSkills FuturePath Tech Pvt. Ltd.',
  signatory_reg_line: 'Registered Under Govt. of India (Ministry of Corporate Affairs) CIN No. U85499UP2025PTC220102',
  signature_image_url: null,
  updated_at: new Date().toISOString(),
}

export default function CertificatePreviewPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    ;(async () => {
      try {
        const qr = await generateQRDataUrl(`${MOCK_SETTINGS.verification_url_base}/US-861020001`)
        const bytes = await generateComputerSoftwareLandscapeCertificate({
          settings: MOCK_SETTINGS,
          certificateNumber: 'US-861020001',
          issueDate: '19-04-2026',
          qrCodeDataUrl: qr,
          salutation: 'Mr.',
          studentName: 'Rohit Kumar',
          fatherPrefix: 'S/o',
          fatherName: 'Ram Kumar',
          studentPhotoUrl: null,
          courseCode: 'ADCA',
          courseName: 'Advance Diploma in Computer Application',
          trainingCenterName: 'Ideal Computer Centre, Noida',
          performanceText: 'Excellent',
          percentage: 92,
          grade: 'A+',
        })
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        const blob = new Blob([buf], { type: 'application/pdf' })
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate preview')
      }
    })()
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium">Computer Software Courses — Landscape</span>
        <span className="ml-auto text-xs text-gray-500">Dev preview – mock data</span>
      </div>

      <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
        {error ? (
          <div className="h-full flex items-center justify-center bg-gray-50 text-sm text-red-600 p-6 text-center">
            {error}
          </div>
        ) : pdfUrl ? (
          <iframe
            key={pdfUrl}
            src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
            title="Certificate preview"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50 text-sm text-gray-500">
            Generating…
          </div>
        )}
      </div>
    </div>
  )
}
