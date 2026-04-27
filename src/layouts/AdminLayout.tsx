import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/branches': 'Manage Branches',
  '/admin/users': 'Manage Users',
  '/admin/inquiries': 'Inquiries',
  '/admin/students': 'Students',
  '/admin/students/register': 'Register Student',
  '/admin/students/id-card': 'Student ID Card',
  '/admin/students/id-card-settings': 'ID Card Settings',
  '/admin/students/admit-card': 'Admit Card',
  '/admin/students/admit-card-settings': 'Admit Card Settings',
  '/admin/courses/programs': 'Programs',
  '/admin/courses': 'Manage Courses',
  '/admin/courses/subjects': 'Subjects',
  '/admin/courses/batches': 'Batches',
  '/admin/study-material': 'Study Material',
  '/admin/study-material/syllabus': 'Syllabus',
  '/admin/online-classes': 'Online Classes',
  '/admin/exams/paper-sets': 'Paper Sets',
  '/admin/exams/results': 'Results',
  '/admin/exams/forms': 'Exam Forms',
  '/admin/exams/form-windows': 'Exam Form Windows',
  '/admin/exams/admit-cards/new': 'Generate Admit Card',
  '/admin/marksheets': 'Marksheets',
  '/admin/certificates': 'Certificates',
  '/admin/staff/departments': 'Departments',
  '/admin/staff/employees': 'Employees',
  '/admin/staff/attendance': 'Attendance',
  '/admin/staff/advances': 'Advance Report',
  '/admin/staff/salary-slips': 'Salary Slips',
  '/admin/reports/students': 'Student Report',
  '/admin/reports/fees': 'Fees Report',
  '/admin/reports/due-fees': 'Due Fees',
  '/admin/reports/income': 'Income Report',
  '/admin/reports/expenses': 'Expenses',
  '/admin/reports/profit-loss': 'Profit & Loss',
  '/admin/website/gallery': 'Photo Gallery',
  '/admin/website/banners': 'Banners',
  '/admin/website/videos': 'Videos',
  '/admin/website/newsletters': 'Newsletters',
  '/admin/website/downloads': 'Download Center',
  '/admin/website/placements': 'Placements',
  '/admin/website/blog/categories': 'Blog Categories',
  '/admin/website/blogs': 'Blogs',
  '/admin/referrals': 'Referrals',
  '/admin/settings': 'Settings',
  '/admin/profile': 'My Profile',
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const title = PAGE_TITLES[location.pathname] ?? 'UnSkills CRM'

  return (
    <div className="flex h-screen bg-bg-page overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
