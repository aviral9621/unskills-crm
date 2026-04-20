import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import FranchiseSidebar from '../components/franchise/FranchiseSidebar'
import TopBar from '../components/TopBar'

const PAGE_TITLES: Record<string, string> = {
  '/franchise/dashboard': 'Dashboard',
  '/franchise/wallet': 'Wallet',
  '/franchise/wallet/request': 'Request Wallet Reload',
  '/franchise/students': 'Students',
  '/franchise/students/register': 'Register Student',
  '/franchise/students/id-card': 'Student ID Cards',
  '/franchise/courses': 'Courses',
  '/franchise/courses/new': 'Add Course',
  '/franchise/study-material': 'Study Material',
  '/franchise/exam-forms': 'Exam Forms',
  '/franchise/exam-forms/new': 'New Exam Form',
  '/franchise/marksheets': 'Marksheets',
  '/franchise/certificates': 'Certificates',
  '/franchise/results': 'Results',
  '/franchise/fees/collect': 'Collect Fee',
  '/franchise/fees/history': 'Fee History',
  '/franchise/fees/accounts': 'Payment Accounts',
  '/franchise/jobs': 'Jobs',
  '/franchise/promotions': 'Promotion Material',
  '/franchise/tickets': 'Support Tickets',
  '/franchise/reports/students': 'Student Report',
  '/franchise/reports/fees': 'Fee Collection Report',
  '/franchise/reports/pending-fees': 'Pending Fees',
  '/franchise/reports/wallet': 'Wallet Statement',
  '/franchise/settings': 'Settings',
  '/franchise/profile': 'My Profile',
}

export default function FranchiseLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Institute Panel'

  return (
    <div className="flex h-screen bg-bg-page overflow-hidden">
      <FranchiseSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
