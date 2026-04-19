import { useEffect, useState } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { registerPdfFonts } from '../../lib/pdf/fonts'
import { CertificateOfQualification } from '../../lib/pdf/certificate-qualification'
import { ComputerBasedTypingCertificate } from '../../lib/pdf/certificate-typing'
import { generateQRDataUrl } from '../../lib/pdf/generate-qr'
import type { CertificateSettings } from '../../types/certificate'

const MOCK_SETTINGS: CertificateSettings = {
  id: 'mock',
  institute_name: 'UNSKILLS COMPUTER EDUCATION',
  institute_reg_number: '209815',
  tagline: 'An ISO 9001:2015 Certified Organization',
  sub_header_line_1:
    'Run by UnSkills FuturePath Tech Pvt. Ltd. Regd. by Govt. of India CIN No. U85499UP2025PTC220102',
  sub_header_line_2: 'Alliance with Skill India, MSME, Niti Ayog, NSDC, Labour & Department',
  sub_header_line_3: 'Regd. Under the Company Act 2013 Ministry of Corporate Affairs, Govt. of India',
  corporate_office_address:
    'Corporate Office : B-7, Ground Floor, Sec-2, Noida, Gautam Buddha Nagar, UP - 201301',
  verification_url_base: 'https://unskillseducation.org/verify',
  contact_email: 'info@unskillseducation.org',
  logo_url: null,
  training_center_logo_url: null,
  signatory_name: 'Er. Ankit Vishwakarma',
  signatory_designation: 'Chief Executive Officer',
  signatory_company_line: 'UnSkills FuturePath Tech Pvt. Ltd.',
  signatory_reg_line:
    'Registered Under Govt. of India (Ministry of Corporate Affairs) CIN No. U85499UP2025PTC220102',
  signature_image_url: null,
  updated_at: new Date().toISOString(),
}

type Tab = 'horizontal' | 'vertical'

export default function CertificatePreviewPage() {
  const [tab, setTab] = useState<Tab>('horizontal')
  const [qr, setQr] = useState<string>('')

  useEffect(() => {
    registerPdfFonts()
    generateQRDataUrl(`${MOCK_SETTINGS.verification_url_base}/US-861020001`).then(setQr)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab('horizontal')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
            tab === 'horizontal' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300'
          }`}
        >
          Horizontal (Qualification)
        </button>
        <button
          onClick={() => setTab('vertical')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
            tab === 'vertical' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300'
          }`}
        >
          Vertical (Typing)
        </button>
        <span className="ml-auto text-xs text-gray-500">Dev preview – mock data</span>
      </div>

      <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
        <PDFViewer width="100%" height="100%" showToolbar>
          {tab === 'horizontal' ? (
            <CertificateOfQualification
              settings={MOCK_SETTINGS}
              certificateNumber="US-861020001"
              issueDate="19-04-2026"
              qrCodeDataUrl={qr}
              salutation="Mr."
              studentName="Rohit Kumar"
              fatherPrefix="S/o"
              fatherName="Ram Kumar"
              studentPhotoUrl={null}
              courseLevel="12"
              courseCode="ADCA"
              courseName="Advance Diploma in Computer Application"
              trainingCenterName="Ideal Computer Centre, Noida"
              performanceText="Excellent"
              marksScored={92}
              grade="A+"
              typingSubjects={[
                { name: 'HINDI TYPING', speed: 39, max: 100, min: 30, obtained: 88 },
                { name: 'ENGLISH TYPING', speed: 41, max: 100, min: 30, obtained: 89 },
              ]}
            />
          ) : (
            <ComputerBasedTypingCertificate
              settings={MOCK_SETTINGS}
              certificateNumber="US-861020002"
              issueDate="19-04-2026"
              qrCodeDataUrl={qr}
              salutation="Mr."
              studentName="Bikram Kumar Baid"
              fatherPrefix="S/o"
              fatherName="Rajesh Baid"
              studentPhotoUrl={null}
              enrollmentNumber="UCE/2026/00142"
              trainingCenterCode="US-86102"
              trainingCenterName="Ideal Computer Centre, Noida"
              typingSubjects={[
                { name: 'HINDI TYPING', speed: 39, max: 100, min: 30, obtained: 88 },
                { name: 'ENGLISH TYPING', speed: 41, max: 100, min: 30, obtained: 89 },
              ]}
              grade="A+"
            />
          )}
        </PDFViewer>
      </div>
    </div>
  )
}
