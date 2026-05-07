import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute, PublicRoute } from './components/RoleRoute'

import AdminLayout from './layouts/AdminLayout'
import FranchiseLayout from './layouts/FranchiseLayout'
import StudentLayout from './layouts/StudentLayout'
import TeacherLayout from './layouts/TeacherLayout'

// Login pages stay eager — they are the entry points and must paint immediately.
import LoginPage from './pages/LoginPage'
import FranchiseLoginPage from './pages/FranchiseLoginPage'
import StudentLoginPage from './pages/StudentLoginPage'

// Admin pages — lazy
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const BranchListPage = lazy(() => import('./pages/branches/BranchListPage'))
const BranchFormPage = lazy(() => import('./pages/branches/BranchFormPage'))
const BranchWalletPage = lazy(() => import('./pages/branches/BranchWalletPage'))
const WalletRequestsPage = lazy(() => import('./pages/branches/WalletRequestsPage'))
const UserListPage = lazy(() => import('./pages/users/UserListPage'))
const UserFormPage = lazy(() => import('./pages/users/UserFormPage'))
const PermissionsPage = lazy(() => import('./pages/users/PermissionsPage'))
const InquiryPage = lazy(() => import('./pages/inquiries/InquiryPage'))
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage'))
const StudentListPage = lazy(() => import('./pages/students/StudentListPage'))
const StudentRegisterPage = lazy(() => import('./pages/students/StudentRegisterPage'))
const StudentIdCardPage = lazy(() => import('./pages/students/StudentIdCardPage'))
const IdCardSettingsPage = lazy(() => import('./pages/students/IdCardSettingsPage'))
const AdmitCardPage = lazy(() => import('./pages/students/AdmitCardPage'))
const AdmitCardSettingsPage = lazy(() => import('./pages/students/AdmitCardSettingsPage'))
const RegistrationCertificatePage = lazy(() => import('./pages/students/RegistrationCertificatePage'))
const ProgramListPage = lazy(() => import('./pages/courses/ProgramListPage'))
const CourseListPage = lazy(() => import('./pages/courses/CourseListPage'))
const CourseFormPage = lazy(() => import('./pages/courses/CourseFormPage'))
const CourseApprovalPage = lazy(() => import('./pages/courses/CourseApprovalPage'))
const SubjectPage = lazy(() => import('./pages/courses/SubjectPage'))
const BatchPage = lazy(() => import('./pages/courses/BatchPage'))
const MaterialListPage = lazy(() => import('./pages/study-material/MaterialListPage'))
const SyllabusPage = lazy(() => import('./pages/study-material/SyllabusPage'))
const ClassesPage = lazy(() => import('./pages/online-classes/ClassesPage'))
const PaperSetListPage = lazy(() => import('./pages/exams/PaperSetListPage'))
const PaperSetFormPage = lazy(() => import('./pages/exams/PaperSetFormPage'))
const QuestionsPage = lazy(() => import('./pages/exams/QuestionsPage'))
const ResultsPage = lazy(() => import('./pages/exams/ResultsPage'))
const FreeTestsPage = lazy(() => import('./pages/exams/FreeTestsPage'))
const FreeTestGradingPage = lazy(() => import('./pages/exams/FreeTestGradingPage'))
const MarksheetPage = lazy(() => import('./pages/marksheet/MarksheetPage'))
const MarksheetSettingsPage = lazy(() => import('./pages/marksheet/MarksheetSettingsPage'))
const CertificateListPage = lazy(() => import('./pages/certificate/CertificateListPage'))
const IssueCertificatePage = lazy(() => import('./pages/certificate/IssueCertificatePage'))
const CertificateDetailPage = lazy(() => import('./pages/certificate/CertificateDetailPage'))
const CertificateSettingsPage = lazy(() => import('./pages/certificate/CertificateSettingsPage'))
const CertificatePreviewPage = lazy(() => import('./pages/certificate/CertificatePreviewPage'))
const DepartmentPage = lazy(() => import('./pages/staff/DepartmentPage'))
const EmployeeListPage = lazy(() => import('./pages/staff/EmployeeListPage'))
const EmployeeFormPage = lazy(() => import('./pages/staff/EmployeeFormPage'))
const StaffIdCardPage = lazy(() => import('./pages/staff/StaffIdCardPage'))
const StaffIdCardSettingsPage = lazy(() => import('./pages/staff/StaffIdCardSettingsPage'))
const AttendancePage = lazy(() => import('./pages/staff/AttendancePage'))
const AdvanceReportPage = lazy(() => import('./pages/staff/AdvanceReportPage'))
const SalarySlipPage = lazy(() => import('./pages/staff/SalarySlipPage'))
const StudentReportPage = lazy(() => import('./pages/reports/StudentReportPage'))
const FeesReportPage = lazy(() => import('./pages/reports/FeesReportPage'))
const DueFeesPage = lazy(() => import('./pages/reports/DueFeesPage'))
const IncomeReportPage = lazy(() => import('./pages/reports/IncomeReportPage'))
const IncomeCategoriesPage = lazy(() => import('./pages/reports/IncomeCategoriesPage'))
const ExpensesPage = lazy(() => import('./pages/reports/ExpensesPage'))
const ExpenseCategoriesPage = lazy(() => import('./pages/reports/ExpenseCategoriesPage'))
const ProfitLossPage = lazy(() => import('./pages/reports/ProfitLossPage'))
const BranchesRevenuePage = lazy(() => import('./pages/reports/BranchesRevenuePage'))
const GalleryManagePage = lazy(() => import('./pages/website/GalleryManagePage'))
const BannerManagePage = lazy(() => import('./pages/website/BannerManagePage'))
const VideoManagePage = lazy(() => import('./pages/website/VideoManagePage'))
const NewsletterPage = lazy(() => import('./pages/website/NewsletterPage'))
const DownloadCenterPage = lazy(() => import('./pages/website/DownloadCenterPage'))
const PlacementsPage = lazy(() => import('./pages/website/PlacementsPage'))
const BlogCategoriesPage = lazy(() => import('./pages/website/blog/BlogCategoriesPage'))
const BlogListPage = lazy(() => import('./pages/website/blog/BlogListPage'))
const BlogFormPage = lazy(() => import('./pages/website/blog/BlogFormPage'))
const HomepagePopupSettingsPage = lazy(() => import('./pages/website/HomepagePopupSettingsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPromotionsPage = lazy(() => import('./pages/admin/AdminPromotionsPage'))
const AdminTicketsPage = lazy(() => import('./pages/admin/AdminTicketsPage'))
const AdminExamFormsPage = lazy(() => import('./pages/admin/AdminExamFormsPage'))
const AdminReferralsPage = lazy(() => import('./pages/admin/AdminReferralsPage'))
const AdminRewardsPage = lazy(() => import('./pages/admin/AdminRewardsPage'))
const AdminRewardsSettingsPage = lazy(() => import('./pages/admin/AdminRewardsSettingsPage'))
const BranchPointWalletPage = lazy(() => import('./pages/branches/BranchPointWalletPage'))
const AdminFeesOverviewPage = lazy(() => import('./pages/admin/fees/AdminFeesOverviewPage'))
const AdminStudentFeePlanPage = lazy(() => import('./pages/admin/fees/AdminStudentFeePlanPage'))
const AdminExamFormWindowsPage = lazy(() => import('./pages/admin/AdminExamFormWindowsPage'))
const AdminAdmitCardFormPage = lazy(() => import('./pages/admin/AdminAdmitCardFormPage'))
const ViewAsStudentLayout = lazy(() => import('./pages/admin/ViewAsStudentLayout'))
const AdminJobsPage = lazy(() => import('./pages/admin/AdminJobsPage'))
const AdminJobApplicationsPage = lazy(() => import('./pages/admin/AdminJobApplicationsPage'))
const AdminJobApplicationsAllPage = lazy(() => import('./pages/admin/AdminJobApplicationsAllPage'))
const PendingPaymentsPage = lazy(() => import('./pages/fees/PendingPaymentsPage'))
const MarkAttendancePage = lazy(() => import('./pages/attendance/MarkAttendancePage'))
const AttendanceReportsPage = lazy(() => import('./pages/attendance/AttendanceReportsPage'))
const AssignBatchPage = lazy(() => import('./pages/students/AssignBatchPage'))
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'))

// Franchise pages — lazy
const FDashboardPage = lazy(() => import('./pages/franchise/FDashboardPage'))
const FProfilePage = lazy(() => import('./pages/franchise/FProfilePage'))
const FSettingsPage = lazy(() => import('./pages/franchise/FSettingsPage'))
const FCourseListPage = lazy(() => import('./pages/franchise/courses/FCourseListPage'))
const FCourseFormPage = lazy(() => import('./pages/franchise/courses/FCourseFormPage'))
const FPaymentAccountsPage = lazy(() => import('./pages/franchise/fees/FPaymentAccountsPage'))
const FFeeCollectionPage = lazy(() => import('./pages/franchise/fees/FFeeCollectionPage'))
const FFeeHistoryPage = lazy(() => import('./pages/franchise/fees/FFeeHistoryPage'))
const FWalletPage = lazy(() => import('./pages/franchise/wallet/FWalletPage'))
const FWalletRequestPage = lazy(() => import('./pages/franchise/wallet/FWalletRequestPage'))
const FPointWalletPage = lazy(() => import('./pages/franchise/wallet/FPointWalletPage'))
const FMaterialPage = lazy(() => import('./pages/franchise/material/FMaterialPage'))
const FExamFormPage = lazy(() => import('./pages/franchise/exams/FExamFormPage'))
const FResultsPage = lazy(() => import('./pages/franchise/results/FResultsPage'))
const FJobsPage = lazy(() => import('./pages/franchise/jobs/FJobsPage'))
const FPromotionsPage = lazy(() => import('./pages/franchise/promotions/FPromotionsPage'))
const FTicketsPage = lazy(() => import('./pages/franchise/tickets/FTicketsPage'))
const FTicketDetailPage = lazy(() => import('./pages/franchise/tickets/FTicketDetailPage'))
const FStudentReportPage = lazy(() => import('./pages/franchise/reports/FReportsPages').then(m => ({ default: m.FStudentReportPage })))
const FFeesReportPage = lazy(() => import('./pages/franchise/reports/FReportsPages').then(m => ({ default: m.FFeesReportPage })))
const FPendingFeesPage = lazy(() => import('./pages/franchise/reports/FReportsPages').then(m => ({ default: m.FPendingFeesPage })))
const FWalletReportPage = lazy(() => import('./pages/franchise/reports/FReportsPages').then(m => ({ default: m.FWalletReportPage })))

// Student pages — lazy
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'))
const StudentFeesPage = lazy(() => import('./pages/student/StudentFeesPage'))
const StudentMaterialsPage = lazy(() => import('./pages/student/StudentMaterialsPage'))
const StudentReferEarnPage = lazy(() => import('./pages/student/StudentReferEarnPage'))
const StudentSyllabusPage = lazy(() => import('./pages/student/StudentSyllabusPage'))
const StudentClassesPage = lazy(() => import('./pages/student/StudentClassesPage'))
const StudentDocumentsPage = lazy(() => import('./pages/student/StudentDocumentsPage'))
const StudentResultsPage = lazy(() => import('./pages/student/StudentResultsPage'))
const StudentJobsPage = lazy(() => import('./pages/student/StudentJobsPage'))
const StudentNotificationsPage = lazy(() => import('./pages/student/StudentNotificationsPage'))
const StudentExamFormPage = lazy(() => import('./pages/student/StudentExamFormPage'))
const StudentAnnouncementsPage = lazy(() => import('./pages/student/StudentAnnouncementsPage'))
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage'))
const StudentTestsPage = lazy(() => import('./pages/student/StudentTestsPage'))
const StudentTakeTestPage = lazy(() => import('./pages/student/StudentTakeTestPage'))
const StudentAdmitCardPage = lazy(() => import('./pages/student/StudentAdmitCardPage'))
const StudentAttendancePage = lazy(() => import('./pages/student/StudentAttendancePage'))
const StudentExamFormFillPage = lazy(() => import('./pages/student/StudentExamFormFillPage'))
const AnnouncementsPage = lazy(() => import('./pages/announcements/AnnouncementsPage'))

function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-red-200 border-t-red-600 animate-spin" />
        <p className="text-xs font-medium text-gray-400">Loading…</p>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public login routes */}
        <Route path="/admin/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/franchise/login" element={<PublicRoute><FranchiseLoginPage /></PublicRoute>} />
        <Route path="/student/login" element={<PublicRoute><StudentLoginPage /></PublicRoute>} />

        {/* Admin — super_admin only */}
        <Route path="/admin" element={<ProtectedRoute allow={['super_admin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          <Route path="branches" element={<BranchListPage />} />
          <Route path="branches/new" element={<BranchFormPage />} />
          <Route path="branches/:id/edit" element={<BranchFormPage />} />
          <Route path="branches/:id/wallet" element={<BranchWalletPage />} />
          <Route path="branches/wallet-requests" element={<WalletRequestsPage />} />

          <Route path="users" element={<UserListPage />} />
          <Route path="users/new" element={<UserFormPage />} />
          <Route path="users/:id/edit" element={<UserFormPage />} />
          <Route path="users/:id/permissions" element={<PermissionsPage />} />

          <Route path="inquiries" element={<InquiryPage />} />
          <Route path="leads" element={<LeadsPage />} />

          <Route path="students" element={<StudentListPage />} />
          <Route path="students/register" element={<StudentRegisterPage />} />
          <Route path="students/id-card" element={<StudentIdCardPage />} />
          <Route path="students/id-card-settings" element={<IdCardSettingsPage />} />
          <Route path="students/admit-card" element={<AdmitCardPage />} />
          <Route path="students/admit-card-settings" element={<AdmitCardSettingsPage />} />
          <Route path="students/registration-certificate" element={<RegistrationCertificatePage />} />

          <Route path="courses/programs" element={<ProgramListPage />} />
          <Route path="courses" element={<CourseListPage />} />
          <Route path="courses/new" element={<CourseFormPage />} />
          <Route path="courses/:id/edit" element={<CourseFormPage />} />
          <Route path="courses/approvals" element={<CourseApprovalPage />} />
          <Route path="courses/subjects" element={<SubjectPage />} />
          <Route path="batches" element={<BatchPage />} />
          <Route path="courses/batches" element={<Navigate to="/admin/batches" replace />} />

          <Route path="study-material" element={<MaterialListPage />} />
          <Route path="study-material/syllabus" element={<SyllabusPage />} />
          <Route path="online-classes" element={<ClassesPage />} />

          <Route path="exams/paper-sets" element={<PaperSetListPage />} />
          <Route path="exams/paper-sets/new" element={<PaperSetFormPage />} />
          <Route path="exams/paper-sets/:id/edit" element={<PaperSetFormPage />} />
          <Route path="exams/paper-sets/:id/questions" element={<QuestionsPage />} />
          <Route path="exams/results" element={<ResultsPage />} />
          <Route path="exams/forms" element={<AdminExamFormsPage />} />
          <Route path="exams/form-windows" element={<AdminExamFormWindowsPage />} />
          <Route path="exams/free-tests" element={<FreeTestsPage />} />
          <Route path="exams/free-test-grading" element={<FreeTestGradingPage />} />
          <Route path="exams/admit-cards/new" element={<AdminAdmitCardFormPage />} />

          <Route path="marksheets" element={<MarksheetPage />} />
          <Route path="marksheets/settings" element={<MarksheetSettingsPage />} />
          <Route path="certificates" element={<CertificateListPage />} />
          <Route path="certificates/issue" element={<IssueCertificatePage />} />
          <Route path="certificates/settings" element={<CertificateSettingsPage />} />
          {import.meta.env.DEV && <Route path="certificates/preview" element={<CertificatePreviewPage />} />}
          <Route path="certificates/:id" element={<CertificateDetailPage />} />

          <Route path="staff/departments" element={<DepartmentPage />} />
          <Route path="staff/employees" element={<EmployeeListPage />} />
          <Route path="staff/employees/new" element={<EmployeeFormPage />} />
          <Route path="staff/employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="staff/id-card" element={<StaffIdCardPage />} />
          <Route path="staff/id-card-settings" element={<StaffIdCardSettingsPage />} />
          <Route path="staff/attendance" element={<AttendancePage />} />
          <Route path="attendance/mark" element={<MarkAttendancePage />} />
          <Route path="attendance/reports" element={<AttendanceReportsPage />} />
          <Route path="students/assign-batch" element={<AssignBatchPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="staff/advances" element={<AdvanceReportPage />} />
          <Route path="staff/salary-slips" element={<SalarySlipPage />} />

          <Route path="fees" element={<AdminFeesOverviewPage />} />
          <Route path="fees/pending" element={<PendingPaymentsPage />} />
          <Route path="fees/:studentId" element={<AdminStudentFeePlanPage />} />

          <Route path="reports/students" element={<StudentReportPage />} />
          <Route path="reports/fees" element={<FeesReportPage />} />
          <Route path="reports/due-fees" element={<DueFeesPage />} />
          <Route path="reports/income" element={<IncomeReportPage />} />
          <Route path="reports/income/categories" element={<IncomeCategoriesPage />} />
          <Route path="reports/expenses" element={<ExpensesPage />} />
          <Route path="reports/expenses/categories" element={<ExpenseCategoriesPage />} />
          <Route path="reports/profit-loss" element={<ProfitLossPage />} />
          <Route path="reports/branches-revenue" element={<BranchesRevenuePage />} />

          <Route path="website/gallery" element={<GalleryManagePage />} />
          <Route path="website/banners" element={<BannerManagePage />} />
          <Route path="website/videos" element={<VideoManagePage />} />
          <Route path="website/newsletters" element={<NewsletterPage />} />
          <Route path="website/downloads" element={<DownloadCenterPage />} />
          <Route path="website/placements" element={<PlacementsPage />} />
          <Route path="website/blog/categories" element={<BlogCategoriesPage />} />
          <Route path="website/blogs" element={<BlogListPage />} />
          <Route path="website/blogs/new" element={<BlogFormPage />} />
          <Route path="website/blogs/:id/edit" element={<BlogFormPage />} />
          <Route path="website/homepage-popup" element={<HomepagePopupSettingsPage />} />

          <Route path="referrals" element={<AdminReferralsPage />} />
          <Route path="rewards" element={<AdminRewardsPage />} />
          <Route path="rewards/settings" element={<AdminRewardsSettingsPage />} />
          <Route path="branches/:id/points" element={<BranchPointWalletPage />} />
          <Route path="promotions" element={<AdminPromotionsPage />} />
          <Route path="jobs" element={<AdminJobsPage />} />
          <Route path="job-applications" element={<AdminJobApplicationsAllPage />} />
          <Route path="jobs/:jobId/applications" element={<AdminJobApplicationsPage />} />
          <Route path="support/tickets" element={<AdminTicketsPage />} />
          <Route path="support/tickets/:id" element={<FTicketDetailPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />

          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Franchise — branch_admin/branch_staff */}
        <Route path="/franchise" element={<ProtectedRoute allow={['branch_admin', 'branch_staff']}><FranchiseLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<FDashboardPage />} />

          <Route path="students" element={<StudentListPage />} />
          <Route path="students/register" element={<StudentRegisterPage />} />
          <Route path="students/id-card" element={<StudentIdCardPage />} />

          <Route path="courses" element={<FCourseListPage />} />
          <Route path="courses/new" element={<FCourseFormPage />} />
          <Route path="batches" element={<BatchPage />} />

          <Route path="fees/accounts" element={<FPaymentAccountsPage />} />
          <Route path="fees/collect" element={<FFeeCollectionPage />} />
          <Route path="fees/history" element={<FFeeHistoryPage />} />
          <Route path="fees/pending" element={<PendingPaymentsPage />} />

          <Route path="wallet" element={<FWalletPage />} />
          <Route path="wallet/request" element={<FWalletRequestPage />} />
          <Route path="points" element={<FPointWalletPage />} />

          <Route path="study-material" element={<FMaterialPage />} />
          <Route path="exam-forms" element={<AdminExamFormsPage />} />
          <Route path="exam-forms-legacy" element={<FExamFormPage />} />
          <Route path="results" element={<FResultsPage />} />
          <Route path="marksheets" element={<MarksheetPage />} />
          <Route path="certificates" element={<CertificateListPage />} />
          <Route path="certificates/:id" element={<CertificateDetailPage />} />

          <Route path="jobs" element={<FJobsPage />} />
          <Route path="jobs/:jobId/applications" element={<AdminJobApplicationsPage />} />
          <Route path="promotions" element={<FPromotionsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="tickets" element={<FTicketsPage />} />
          <Route path="tickets/:id" element={<FTicketDetailPage />} />

          <Route path="reports/students" element={<FStudentReportPage />} />
          <Route path="reports/fees" element={<FFeesReportPage />} />
          <Route path="reports/pending-fees" element={<FPendingFeesPage />} />
          <Route path="reports/wallet" element={<FWalletReportPage />} />

          <Route path="attendance/mark" element={<MarkAttendancePage />} />
          <Route path="attendance/reports" element={<AttendanceReportsPage />} />
          <Route path="students/assign-batch" element={<AssignBatchPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />

          <Route path="profile" element={<FProfilePage />} />
          <Route path="settings" element={<FSettingsPage />} />
        </Route>

        {/* Teacher panel */}
        <Route path="/teacher" element={<ProtectedRoute allow={['teacher']}><TeacherLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="attendance" element={<MarkAttendancePage />} />
          <Route path="reports" element={<AttendanceReportsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Student panel */}
        <Route path="/student" element={<ProtectedRoute allow={['student']}><StudentLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboardPage />} />
          <Route path="fees" element={<StudentFeesPage />} />
          <Route path="documents" element={<StudentDocumentsPage />} />
          <Route path="refer-earn" element={<StudentReferEarnPage />} />
          <Route path="classes" element={<StudentClassesPage />} />
          <Route path="materials" element={<StudentMaterialsPage />} />
          <Route path="syllabus" element={<StudentSyllabusPage />} />
          <Route path="tests" element={<StudentTestsPage />} />
          <Route path="tests/:id" element={<StudentTakeTestPage />} />
          <Route path="exam-forms" element={<StudentExamFormPage />} />
          <Route path="exam-forms/:windowId/fill" element={<StudentExamFormFillPage />} />
          <Route path="admit-card" element={<StudentAdmitCardPage />} />
          <Route path="attendance" element={<StudentAttendancePage />} />
          <Route path="results" element={<StudentResultsPage />} />
          <Route path="jobs" element={<StudentJobsPage />} />
          <Route path="notifications" element={<StudentNotificationsPage />} />
          <Route path="announcements" element={<StudentAnnouncementsPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
        </Route>

        {/* Super-admin "view as student" — read-only data masquerade */}
        <Route path="/admin/view-as/:studentId" element={<ProtectedRoute allow={['super_admin']}><ViewAsStudentLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboardPage />} />
          <Route path="fees" element={<StudentFeesPage />} />
          <Route path="documents" element={<StudentDocumentsPage />} />
          <Route path="classes" element={<StudentClassesPage />} />
          <Route path="materials" element={<StudentMaterialsPage />} />
          <Route path="syllabus" element={<StudentSyllabusPage />} />
          <Route path="tests" element={<StudentTestsPage />} />
          <Route path="exam-forms" element={<StudentExamFormPage />} />
          <Route path="admit-card" element={<StudentAdmitCardPage />} />
          <Route path="results" element={<StudentResultsPage />} />
          <Route path="announcements" element={<StudentAnnouncementsPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
        </Route>

        {/* Root — default to franchise login (website link target) */}
        <Route path="/" element={<Navigate to="/franchise/login" replace />} />
        <Route path="*" element={<Navigate to="/franchise/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              color: '#111827',
              fontSize: '14px',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
