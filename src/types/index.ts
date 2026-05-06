// ── Auth & User Types ──
export type UserRole = 'super_admin' | 'branch_admin' | 'branch_staff' | 'teacher' | 'student'

export type StudentAttendanceStatus = 'present' | 'absent' | 'leave'

export interface StudentAttendance {
  id: string
  student_id: string
  batch_id: string
  date: string
  status: StudentAttendanceStatus
  leave_reason: string | null
  marked_by: string | null
  marked_at: string
}


export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  avatar_url: string | null
  role: UserRole
  branch_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Branch Types ──
export type BranchCategory = 'computer' | 'beautician' | 'both'

export interface Branch {
  id: string
  code: string
  b_code: string | null
  name: string
  category: BranchCategory
  society_name: string | null
  registration_number: string | null
  registration_year: string | null
  director_name: string
  director_phone: string
  director_email: string | null
  director_qualification: string | null
  director_image_url: string | null
  address_line1: string | null
  village: string | null
  block: string | null
  district: string
  state: string
  pincode: string | null
  center_logo_url: string | null
  wallet_balance: number
  is_active: boolean
  is_main: boolean
  joined_at: string
  created_at: string
  updated_at: string
}

export interface WalletTransaction {
  id: string
  branch_id: string
  type: 'credit' | 'debit'
  amount: number
  balance_after: number
  description: string
  reference_type: string | null
  reference_id: string | null
  performed_by: string | null
  created_at: string
}

// ── Course Types ──
export interface Program {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export interface Course {
  id: string
  code: string
  name: string
  short_name: string | null
  program_id: string
  duration_months: number | null
  duration_label: string | null
  total_semesters: number | null
  months_per_semester: number | null
  eligibility: string | null
  description: string | null
  total_fee: number
  certification_fee: number
  is_featured: boolean
  is_govt_course: boolean
  is_certificate_eligible: boolean
  is_marksheet_eligible: boolean
  display_order: number
  is_active: boolean
  video_url: string | null
  thumbnail_url: string | null
  website_category: string | null
  website_body: string | null
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  course_id: string
  code: string | null
  name: string
  theory_max_marks: number
  practical_max_marks: number
  total_max_marks: number
  display_order: number
  semester: number | null
  is_active: boolean
  created_at: string
}

export interface Batch {
  id: string
  course_id: string | null
  branch_id: string | null
  teacher_id: string | null
  name: string
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  max_students: number | null
  is_active: boolean
  created_at: string
}

// ── Student Types ──
export type Gender = 'male' | 'female' | 'other'
export type PaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other'

export interface Student {
  id: string
  registration_no: string
  auth_user_id: string | null
  branch_id: string
  name: string
  father_name: string
  mother_name: string | null
  dob: string | null
  gender: Gender | null
  aadhar_number: string | null
  photo_url: string | null
  phone: string
  alt_phone: string | null
  email: string | null
  whatsapp: string | null
  address: string | null
  village: string | null
  block: string | null
  district: string | null
  state: string | null
  pincode: string | null
  course_id: string
  batch_id: string | null
  total_fee: number
  discount: number
  net_fee: number
  registration_fee: number
  admission_year: string | null
  session: string | null
  enrollment_date: string
  is_active: boolean
  registered_by: string | null
  created_at: string
  updated_at: string
  // Monthly fee plan (optional)
  fee_start_month: string | null
  installment_count: number | null
  monthly_fee: number | null
}

export interface FeePayment {
  id: string
  student_id: string
  amount: number
  payment_date: string
  payment_mode: PaymentMode | null
  receipt_no: string | null
  month_for: string | null
  note: string | null
  recorded_by: string | null
  created_at: string
  schedule_id: string | null
}

export interface StudentFeeScheduleRow {
  id: string
  student_id: string
  month_for: string // yyyy-mm-dd (1st of month)
  expected_amount: number
  created_at: string
}

// ── Employee Types ──
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave'

export interface Department {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Employee {
  id: string
  branch_id: string
  employee_code: string | null
  department_id: string | null
  name: string
  father_name: string | null
  dob: string | null
  gender: string | null
  phone: string
  alt_phone: string | null
  email: string | null
  photo_url: string | null
  address: string | null
  district: string | null
  state: string | null
  pincode: string | null
  designation: string | null
  joining_date: string | null
  base_salary: number
  da: number
  hra: number
  ta: number
  pf: number
  esi: number
  other_allowance: number
  other_deduction: number
  net_salary: number
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  id_proof_url: string | null
  address_proof_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Inquiry Types ──
export type InquiryType = 'franchise' | 'contact' | 'student_registration'
export type InquiryStatus = 'new' | 'contacted' | 'in_progress' | 'converted' | 'closed' | 'rejected'

export interface Inquiry {
  id: string
  type: InquiryType
  name: string
  email: string | null
  phone: string
  message: string | null
  // Franchise-specific
  qualification: string | null
  occupation: string | null
  experience: string | null
  space_available: string | null
  investment_range: string | null
  address: string | null
  city: string | null
  state: string | null
  district: string | null
  pincode: string | null
  preferred_location: string | null
  why_franchise: string | null
  how_heard: string | null
  alt_phone: string | null
  gender: string | null
  // Student registration-specific
  father_name: string | null
  mother_name: string | null
  dob: string | null
  course_interest: string | null
  branch_preference: string | null
  // Contact-specific
  subject: string | null
  // Tracking
  status: InquiryStatus
  notes: string | null
  responded_by: string | null
  responded_at: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface InquiryNote {
  id: string
  inquiry_id: string
  note: string
  added_by: string | null
  added_by_name: string | null
  created_at: string
}

// ── Study Material & Online Classes Types ──
export type ClassPlatform = 'youtube' | 'zoom' | 'google_meet'

export type MaterialType = 'file' | 'video'
export type VideoProvider = 'youtube' | 'vimeo' | 'other'

export interface StudyMaterial {
  id: string
  program_id: string | null
  course_id: string
  subject_id: string | null
  title: string
  description: string | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  uploaded_by: string | null
  uploaded_by_branch_id: string | null
  is_active: boolean
  created_at: string
  material_type: MaterialType
  video_url: string | null
  video_provider: VideoProvider | null
  // Joined
  course?: { name: string } | null
  subject?: { name: string } | null
  program?: { name: string } | null
}

export interface Syllabus {
  id: string
  course_id: string
  subject_id: string | null
  title: string
  description: string | null
  file_url: string | null
  file_name: string | null
  is_active: boolean
  created_at: string
  // Joined
  course?: { name: string } | null
  subject?: { name: string } | null
}

export interface OnlineClass {
  id: string
  program_id: string | null
  course_id: string
  subject_id: string | null
  platform: ClassPlatform
  class_name: string
  class_code: string | null
  link: string
  meeting_id: string | null
  meeting_password: string | null
  schedule_date: string | null
  schedule_time: string | null
  end_time: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  // Joined
  course?: { name: string } | null
  subject?: { name: string } | null
}

// ── Permission Types ──
export interface Permission {
  id: string
  user_id: string
  permission_key: string
  granted: boolean
  granted_by: string | null
  created_at: string
}

// ── Expense Types ──
export interface ExpenseCategory {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Expense {
  id: string
  branch_id: string | null
  category_id: string | null
  amount: number
  expense_date: string
  description: string | null
  receipt_url: string | null
  is_salary: boolean
  employee_id: string | null
  recorded_by: string | null
  created_at: string
}
