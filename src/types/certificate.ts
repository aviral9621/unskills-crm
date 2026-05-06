export type CertificateTemplateSlug =
  | 'certificate-of-qualification'
  | 'computer-based-typing'

export type CertificateOrientation = 'landscape' | 'portrait'
export type CertificateStatus = 'active' | 'revoked'

export interface CertificateTemplate {
  id: string
  slug: CertificateTemplateSlug
  name: string
  orientation: CertificateOrientation
  description: string | null
  active: boolean
  created_at: string
}

export interface CertificateSettings {
  id: string
  institute_name: string | null
  institute_reg_number: string | null
  tagline: string | null
  sub_header_line_1: string | null
  sub_header_line_2: string | null
  sub_header_line_3: string | null
  corporate_office_address: string | null
  verification_url_base: string | null
  registration_verify_url: string | null
  contact_email: string | null
  logo_url: string | null
  training_center_logo_url: string | null
  signatory_name: string | null
  signatory_designation: string | null
  signatory_company_line: string | null
  signatory_reg_line: string | null
  signature_image_url: string | null
  updated_at: string
}

export interface TypingSubject {
  name: string
  speed: number
  max: number
  min: number
  obtained: number
}

export interface Certificate {
  id: string
  certificate_number: string
  student_id: string | null
  template_id: string
  course_id: string | null
  branch_id: string | null

  salutation: string | null
  student_name: string
  father_prefix: string | null
  father_name: string | null
  student_photo_url: string | null

  course_code: string | null
  course_name: string | null
  course_level: string | null
  training_center_name: string | null
  training_center_code: string | null
  enrollment_number: string | null

  performance_text: string | null
  marks_scored: number | null
  grade: string | null

  typing_subjects: TypingSubject[] | null
  typing_grade: string | null

  qr_code_data_url: string | null
  qr_target_url: string | null
  issue_date: string
  issued_by: string | null
  status: CertificateStatus
  revoked_reason: string | null
  revoked_at: string | null
  created_at: string
}

export interface VerifyCertificateRow {
  certificate_number: string
  status: CertificateStatus
  student_name: string
  father_prefix: string | null
  father_name: string | null
  salutation: string | null
  student_photo_url: string | null
  course_code: string | null
  course_name: string | null
  course_level: string | null
  training_center_name: string | null
  training_center_code: string | null
  enrollment_number: string | null
  performance_text: string | null
  marks_scored: number | null
  grade: string | null
  typing_subjects: TypingSubject[] | null
  typing_grade: string | null
  issue_date: string
  revoked_reason: string | null
  revoked_at: string | null
  template_slug: CertificateTemplateSlug
  institute_name: string | null
  institute_logo_url: string | null
  tagline: string | null
}
