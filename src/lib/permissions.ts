// Permission keys for the CRM system
// Each key maps to a specific action in a specific module

export const PERMISSION_KEYS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Branches
  BRANCH_VIEW: 'branch.view',
  BRANCH_ADD: 'branch.add',
  BRANCH_EDIT: 'branch.edit',
  BRANCH_DELETE: 'branch.delete',
  BRANCH_WALLET: 'branch.wallet',

  // Users
  USER_VIEW: 'user.view',
  USER_ADD: 'user.add',
  USER_EDIT: 'user.edit',
  USER_DELETE: 'user.delete',
  USER_PERMISSIONS: 'user.permissions',

  // Students
  STUDENT_VIEW: 'student.view',
  STUDENT_REGISTER: 'student.register',
  STUDENT_EDIT: 'student.edit',
  STUDENT_DELETE: 'student.delete',
  STUDENT_PRINT: 'student.print',
  STUDENT_IDCARD: 'student.idcard',

  // Courses
  COURSE_VIEW: 'course.view',
  COURSE_ADD: 'course.add',
  COURSE_EDIT: 'course.edit',
  COURSE_DELETE: 'course.delete',

  // Staff
  STAFF_VIEW: 'staff.view',
  STAFF_ADD: 'staff.add',
  STAFF_EDIT: 'staff.edit',
  STAFF_DELETE: 'staff.delete',
  STAFF_ATTENDANCE: 'staff.attendance',
  STAFF_SALARY: 'staff.salary',

  // Inquiries
  INQUIRY_VIEW: 'inquiry.view',
  INQUIRY_RESPOND: 'inquiry.respond',
  INQUIRY_DELETE: 'inquiry.delete',

  // Study Material
  MATERIAL_VIEW: 'material.view',
  MATERIAL_ADD: 'material.add',
  MATERIAL_DELETE: 'material.delete',

  // Online Classes
  CLASS_VIEW: 'class.view',
  CLASS_ADD: 'class.add',
  CLASS_EDIT: 'class.edit',
  CLASS_DELETE: 'class.delete',

  // Exams
  EXAM_VIEW: 'exam.view',
  EXAM_CREATE: 'exam.create',
  EXAM_EDIT: 'exam.edit',
  EXAM_QUESTIONS: 'exam.questions',
  EXAM_RESULTS: 'exam.results',

  // Marksheet
  MARKSHEET_VIEW: 'marksheet.view',
  MARKSHEET_GENERATE: 'marksheet.generate',
  MARKSHEET_DOWNLOAD: 'marksheet.download',

  // Certificate
  CERTIFICATE_VIEW: 'certificate.view',
  CERTIFICATE_GENERATE: 'certificate.generate',
  CERTIFICATE_DOWNLOAD: 'certificate.download',

  // Admit Card
  ADMITCARD_VIEW: 'admitcard.view',
  ADMITCARD_GENERATE: 'admitcard.generate',
  ADMITCARD_DOWNLOAD: 'admitcard.download',

  // Reports
  REPORT_STUDENT: 'report.student',
  REPORT_FEES: 'report.fees',
  REPORT_DUEFEES: 'report.duefees',

  // Finance
  FINANCE_INCOME: 'finance.income',
  FINANCE_EXPENSE: 'finance.expense',
  FINANCE_PNL: 'finance.pnl',

  // Website
  WEBSITE_GALLERY: 'website.gallery',
  WEBSITE_BANNER: 'website.banner',
  WEBSITE_VIDEO: 'website.video',
  WEBSITE_NEWSLETTER: 'website.newsletter',
} as const

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS]
