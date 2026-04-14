import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BranchListPage from './pages/branches/BranchListPage'
import BranchFormPage from './pages/branches/BranchFormPage'
import BranchWalletPage from './pages/branches/BranchWalletPage'
import UserListPage from './pages/users/UserListPage'
import UserFormPage from './pages/users/UserFormPage'
import PermissionsPage from './pages/users/PermissionsPage'
import InquiryPage from './pages/inquiries/InquiryPage'
import StudentListPage from './pages/students/StudentListPage'
import StudentRegisterPage from './pages/students/StudentRegisterPage'
import StudentIdCardPage from './pages/students/StudentIdCardPage'
import IdCardSettingsPage from './pages/students/IdCardSettingsPage'
import AdmitCardPage from './pages/students/AdmitCardPage'
import ProgramListPage from './pages/courses/ProgramListPage'
import CourseListPage from './pages/courses/CourseListPage'
import CourseFormPage from './pages/courses/CourseFormPage'
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
import CertificatePage from './pages/certificate/CertificatePage'
import DepartmentPage from './pages/staff/DepartmentPage'
import EmployeeListPage from './pages/staff/EmployeeListPage'
import EmployeeFormPage from './pages/staff/EmployeeFormPage'
import AttendancePage from './pages/staff/AttendancePage'
import AdvanceReportPage from './pages/staff/AdvanceReportPage'
import SalarySlipPage from './pages/staff/SalarySlipPage'
import StudentReportPage from './pages/reports/StudentReportPage'
import FeesReportPage from './pages/reports/FeesReportPage'
import DueFeesPage from './pages/reports/DueFeesPage'
import IncomeReportPage from './pages/reports/IncomeReportPage'
import ExpensesPage from './pages/reports/ExpensesPage'
import ProfitLossPage from './pages/reports/ProfitLossPage'
import GalleryManagePage from './pages/website/GalleryManagePage'
import BannerManagePage from './pages/website/BannerManagePage'
import VideoManagePage from './pages/website/VideoManagePage'
import NewsletterPage from './pages/website/NewsletterPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 size={32} className="animate-spin text-red-600" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 size={32} className="animate-spin text-red-600" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/admin/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* Protected admin routes */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Branches */}
        <Route path="branches" element={<BranchListPage />} />
        <Route path="branches/new" element={<BranchFormPage />} />
        <Route path="branches/:id/edit" element={<BranchFormPage />} />
        <Route path="branches/:id/wallet" element={<BranchWalletPage />} />

        {/* Users */}
        <Route path="users" element={<UserListPage />} />
        <Route path="users/new" element={<UserFormPage />} />
        <Route path="users/:id/edit" element={<UserFormPage />} />
        <Route path="users/:id/permissions" element={<PermissionsPage />} />

        {/* Inquiries */}
        <Route path="inquiries" element={<InquiryPage />} />

        {/* Students */}
        <Route path="students" element={<StudentListPage />} />
        <Route path="students/register" element={<StudentRegisterPage />} />
        <Route path="students/id-card" element={<StudentIdCardPage />} />
        <Route path="students/id-card-settings" element={<IdCardSettingsPage />} />
        <Route path="students/admit-card" element={<AdmitCardPage />} />

        {/* Courses */}
        <Route path="courses/programs" element={<ProgramListPage />} />
        <Route path="courses" element={<CourseListPage />} />
        <Route path="courses/new" element={<CourseFormPage />} />
        <Route path="courses/:id/edit" element={<CourseFormPage />} />
        <Route path="courses/subjects" element={<SubjectPage />} />
        <Route path="courses/batches" element={<BatchPage />} />

        {/* Study Material */}
        <Route path="study-material" element={<MaterialListPage />} />
        <Route path="study-material/syllabus" element={<SyllabusPage />} />

        {/* Online Classes */}
        <Route path="online-classes" element={<ClassesPage />} />

        {/* Exams */}
        <Route path="exams/paper-sets" element={<PaperSetListPage />} />
        <Route path="exams/paper-sets/new" element={<PaperSetFormPage />} />
        <Route path="exams/paper-sets/:id/edit" element={<PaperSetFormPage />} />
        <Route path="exams/paper-sets/:id/questions" element={<QuestionsPage />} />
        <Route path="exams/results" element={<ResultsPage />} />

        {/* Documents */}
        <Route path="marksheets" element={<MarksheetPage />} />
        <Route path="certificates" element={<CertificatePage />} />

        {/* Staff */}
        <Route path="staff/departments" element={<DepartmentPage />} />
        <Route path="staff/employees" element={<EmployeeListPage />} />
        <Route path="staff/employees/new" element={<EmployeeFormPage />} />
        <Route path="staff/employees/:id/edit" element={<EmployeeFormPage />} />
        <Route path="staff/attendance" element={<AttendancePage />} />
        <Route path="staff/advances" element={<AdvanceReportPage />} />
        <Route path="staff/salary-slips" element={<SalarySlipPage />} />

        {/* Reports */}
        <Route path="reports/students" element={<StudentReportPage />} />
        <Route path="reports/fees" element={<FeesReportPage />} />
        <Route path="reports/due-fees" element={<DueFeesPage />} />
        <Route path="reports/income" element={<IncomeReportPage />} />
        <Route path="reports/expenses" element={<ExpensesPage />} />
        <Route path="reports/profit-loss" element={<ProfitLossPage />} />

        {/* Website */}
        <Route path="website/gallery" element={<GalleryManagePage />} />
        <Route path="website/banners" element={<BannerManagePage />} />
        <Route path="website/videos" element={<VideoManagePage />} />
        <Route path="website/newsletters" element={<NewsletterPage />} />

        {/* Settings & Profile */}
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Redirect root to admin */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
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
