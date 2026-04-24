import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute, PublicRoute } from './components/RoleRoute'

import AdminLayout from './layouts/AdminLayout'
import FranchiseLayout from './layouts/FranchiseLayout'
import StudentLayout from './layouts/StudentLayout'

import LoginPage from './pages/LoginPage'
import FranchiseLoginPage from './pages/FranchiseLoginPage'
import StudentLoginPage from './pages/StudentLoginPage'

// Admin pages
import DashboardPage from './pages/DashboardPage'
import BranchListPage from './pages/branches/BranchListPage'
import BranchFormPage from './pages/branches/BranchFormPage'
import BranchWalletPage from './pages/branches/BranchWalletPage'
import WalletRequestsPage from './pages/branches/WalletRequestsPage'
import UserListPage from './pages/users/UserListPage'
import UserFormPage from './pages/users/UserFormPage'
import PermissionsPage from './pages/users/PermissionsPage'
import InquiryPage from './pages/inquiries/InquiryPage'
import LeadsPage from './pages/leads/LeadsPage'
import StudentListPage from './pages/students/StudentListPage'
import StudentRegisterPage from './pages/students/StudentRegisterPage'
import StudentIdCardPage from './pages/students/StudentIdCardPage'
import IdCardSettingsPage from './pages/students/IdCardSettingsPage'
import AdmitCardPage from './pages/students/AdmitCardPage'
import AdmitCardSettingsPage from './pages/students/AdmitCardSettingsPage'
import ProgramListPage from './pages/courses/ProgramListPage'
import CourseListPage from './pages/courses/CourseListPage'
import CourseFormPage from './pages/courses/CourseFormPage'
import CourseApprovalPage from './pages/courses/CourseApprovalPage'
import SubjectPage from './pages/courses/SubjectPage'
import BatchPage from './pages/courses/BatchPage'
import MaterialListPage from './pages/study-material/MaterialListPage'
import SyllabusPage from './pages/study-material/SyllabusPage'
import ClassesPage from './pages/online-classes/ClassesPage'
import PaperSetListPage from './pages/exams/PaperSetListPage'
import PaperSetFormPage from './pages/exams/PaperSetFormPage'
import QuestionsPage from './pages/exams/QuestionsPage'
import ResultsPage from './pages/exams/ResultsPage'
import MarksheetPage from './pages/marksheet/MarksheetPage'
import MarksheetSettingsPage from './pages/marksheet/MarksheetSettingsPage'
import CertificateListPage from './pages/certificate/CertificateListPage'
import IssueCertificatePage from './pages/certificate/IssueCertificatePage'
import CertificateDetailPage from './pages/certificate/CertificateDetailPage'
import CertificateSettingsPage from './pages/certificate/CertificateSettingsPage'
import CertificatePreviewPage from './pages/certificate/CertificatePreviewPage'
import DepartmentPage from './pages/staff/DepartmentPage'
import EmployeeListPage from './pages/staff/EmployeeListPage'
import EmployeeFormPage from './pages/staff/EmployeeFormPage'
import StaffIdCardPage from './pages/staff/StaffIdCardPage'
import StaffIdCardSettingsPage from './pages/staff/StaffIdCardSettingsPage'
import AttendancePage from './pages/staff/AttendancePage'
import AdvanceReportPage from './pages/staff/AdvanceReportPage'
import SalarySlipPage from './pages/staff/SalarySlipPage'
import StudentReportPage from './pages/reports/StudentReportPage'
import FeesReportPage from './pages/reports/FeesReportPage'
import DueFeesPage from './pages/reports/DueFeesPage'
import IncomeReportPage from './pages/reports/IncomeReportPage'
import ExpensesPage from './pages/reports/ExpensesPage'
import ProfitLossPage from './pages/reports/ProfitLossPage'
import BranchesRevenuePage from './pages/reports/BranchesRevenuePage'
import GalleryManagePage from './pages/website/GalleryManagePage'
import BannerManagePage from './pages/website/BannerManagePage'
import VideoManagePage from './pages/website/VideoManagePage'
import NewsletterPage from './pages/website/NewsletterPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import AdminPromotionsPage from './pages/admin/AdminPromotionsPage'
import AdminTicketsPage from './pages/admin/AdminTicketsPage'
import AdminExamFormsPage from './pages/admin/AdminExamFormsPage'
import AdminFeesOverviewPage from './pages/admin/fees/AdminFeesOverviewPage'
import AdminStudentFeePlanPage from './pages/admin/fees/AdminStudentFeePlanPage'

// Franchise pages
import FDashboardPage from './pages/franchise/FDashboardPage'
import FProfilePage from './pages/franchise/FProfilePage'
import FCourseListPage from './pages/franchise/courses/FCourseListPage'
import FCourseFormPage from './pages/franchise/courses/FCourseFormPage'
import FPaymentAccountsPage from './pages/franchise/fees/FPaymentAccountsPage'
import FFeeCollectionPage from './pages/franchise/fees/FFeeCollectionPage'
import FFeeHistoryPage from './pages/franchise/fees/FFeeHistoryPage'
import FWalletPage from './pages/franchise/wallet/FWalletPage'
import FWalletRequestPage from './pages/franchise/wallet/FWalletRequestPage'
import FMaterialPage from './pages/franchise/material/FMaterialPage'
import FExamFormPage from './pages/franchise/exams/FExamFormPage'
import FResultsPage from './pages/franchise/results/FResultsPage'
import FJobsPage from './pages/franchise/jobs/FJobsPage'
import FPromotionsPage from './pages/franchise/promotions/FPromotionsPage'
import FTicketsPage from './pages/franchise/tickets/FTicketsPage'
import FTicketDetailPage from './pages/franchise/tickets/FTicketDetailPage'
import {
  FStudentReportPage, FFeesReportPage, FPendingFeesPage, FWalletReportPage,
} from './pages/franchise/reports/FReportsPages'

// Student pages
import StudentDashboardPage from './pages/student/StudentDashboardPage'
import StudentFeesPage from './pages/student/StudentFeesPage'
import StudentMaterialsPage from './pages/student/StudentMaterialsPage'
import StudentSyllabusPage from './pages/student/StudentSyllabusPage'
import StudentClassesPage from './pages/student/StudentClassesPage'
import StudentDocumentsPage from './pages/student/StudentDocumentsPage'
import StudentResultsPage from './pages/student/StudentResultsPage'
import StudentJobsPage from './pages/student/StudentJobsPage'
import StudentExamFormPage from './pages/student/StudentExamFormPage'
import StudentAnnouncementsPage from './pages/student/StudentAnnouncementsPage'
import StudentProfilePage from './pages/student/StudentProfilePage'
import StudentTestsPage from './pages/student/StudentTestsPage'
import StudentTakeTestPage from './pages/student/StudentTakeTestPage'
import AnnouncementsPage from './pages/announcements/AnnouncementsPage'

function AppRoutes() {
  return (
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

        <Route path="courses/programs" element={<ProgramListPage />} />
        <Route path="courses" element={<CourseListPage />} />
        <Route path="courses/new" element={<CourseFormPage />} />
        <Route path="courses/:id/edit" element={<CourseFormPage />} />
        <Route path="courses/approvals" element={<CourseApprovalPage />} />
        <Route path="courses/subjects" element={<SubjectPage />} />
        <Route path="courses/batches" element={<BatchPage />} />

        <Route path="study-material" element={<MaterialListPage />} />
        <Route path="study-material/syllabus" element={<SyllabusPage />} />
        <Route path="online-classes" element={<ClassesPage />} />

        <Route path="exams/paper-sets" element={<PaperSetListPage />} />
        <Route path="exams/paper-sets/new" element={<PaperSetFormPage />} />
        <Route path="exams/paper-sets/:id/edit" element={<PaperSetFormPage />} />
        <Route path="exams/paper-sets/:id/questions" element={<QuestionsPage />} />
        <Route path="exams/results" element={<ResultsPage />} />
        <Route path="exams/forms" element={<AdminExamFormsPage />} />

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
        <Route path="staff/advances" element={<AdvanceReportPage />} />
        <Route path="staff/salary-slips" element={<SalarySlipPage />} />

        <Route path="fees" element={<AdminFeesOverviewPage />} />
        <Route path="fees/:studentId" element={<AdminStudentFeePlanPage />} />

        <Route path="reports/students" element={<StudentReportPage />} />
        <Route path="reports/fees" element={<FeesReportPage />} />
        <Route path="reports/due-fees" element={<DueFeesPage />} />
        <Route path="reports/income" element={<IncomeReportPage />} />
        <Route path="reports/expenses" element={<ExpensesPage />} />
        <Route path="reports/profit-loss" element={<ProfitLossPage />} />
        <Route path="reports/branches-revenue" element={<BranchesRevenuePage />} />

        <Route path="website/gallery" element={<GalleryManagePage />} />
        <Route path="website/banners" element={<BannerManagePage />} />
        <Route path="website/videos" element={<VideoManagePage />} />
        <Route path="website/newsletters" element={<NewsletterPage />} />

        <Route path="promotions" element={<AdminPromotionsPage />} />
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

        <Route path="fees/accounts" element={<FPaymentAccountsPage />} />
        <Route path="fees/collect" element={<FFeeCollectionPage />} />
        <Route path="fees/history" element={<FFeeHistoryPage />} />

        <Route path="wallet" element={<FWalletPage />} />
        <Route path="wallet/request" element={<FWalletRequestPage />} />

        <Route path="study-material" element={<FMaterialPage />} />
        <Route path="exam-forms" element={<FExamFormPage />} />
        <Route path="results" element={<FResultsPage />} />
        <Route path="marksheets" element={<MarksheetPage />} />
        <Route path="certificates" element={<CertificateListPage />} />
        <Route path="certificates/:id" element={<CertificateDetailPage />} />

        <Route path="jobs" element={<FJobsPage />} />
        <Route path="promotions" element={<FPromotionsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="tickets" element={<FTicketsPage />} />
        <Route path="tickets/:id" element={<FTicketDetailPage />} />

        <Route path="reports/students" element={<FStudentReportPage />} />
        <Route path="reports/fees" element={<FFeesReportPage />} />
        <Route path="reports/pending-fees" element={<FPendingFeesPage />} />
        <Route path="reports/wallet" element={<FWalletReportPage />} />

        <Route path="profile" element={<FProfilePage />} />
        <Route path="settings" element={<FProfilePage />} />
      </Route>

      {/* Student panel */}
      <Route path="/student" element={<ProtectedRoute allow={['student']}><StudentLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboardPage />} />
        <Route path="fees" element={<StudentFeesPage />} />
        <Route path="documents" element={<StudentDocumentsPage />} />
        <Route path="classes" element={<StudentClassesPage />} />
        <Route path="materials" element={<StudentMaterialsPage />} />
        <Route path="syllabus" element={<StudentSyllabusPage />} />
        <Route path="tests" element={<StudentTestsPage />} />
        <Route path="tests/:id" element={<StudentTakeTestPage />} />
        <Route path="exam-forms" element={<StudentExamFormPage />} />
        <Route path="results" element={<StudentResultsPage />} />
        <Route path="jobs" element={<StudentJobsPage />} />
        <Route path="announcements" element={<StudentAnnouncementsPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
      </Route>

      {/* Root — default to franchise login (website link target) */}
      <Route path="/" element={<Navigate to="/franchise/login" replace />} />
      <Route path="*" element={<Navigate to="/franchise/login" replace />} />
    </Routes>
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
