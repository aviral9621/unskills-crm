import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, GraduationCap, BookOpen, Wallet, IndianRupee,
  FileText, IdCard, ClipboardList, ScrollText, Briefcase, Megaphone,
  LifeBuoy, BarChart3, Settings, UserCircle, ChevronDown, LogOut, X,
  Bell, Coins,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

interface MenuItem {
  label: string
  icon: React.ElementType
  path?: string
  children?: { label: string; path: string }[]
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/franchise/dashboard' },
      { label: 'Wallet', icon: Wallet, path: '/franchise/wallet' },
      { label: 'Reward Points', icon: Coins, path: '/franchise/points' },
    ],
  },
  {
    title: 'ACADEMICS',
    items: [
      {
        label: 'Students', icon: GraduationCap,
        children: [
          { label: 'All Students', path: '/franchise/students' },
          { label: 'Register Student', path: '/franchise/students/register' },
          { label: 'Assign Batch', path: '/franchise/students/assign-batch' },
          { label: 'ID Cards', path: '/franchise/students/id-card' },
        ],
      },
      {
        label: 'Courses', icon: BookOpen,
        children: [
          { label: 'All Courses', path: '/franchise/courses' },
          { label: 'Add Course', path: '/franchise/courses/new' },
        ],
      },
      { label: 'Batches', icon: ClipboardList, path: '/franchise/batches' },
      { label: 'Study Material', icon: FileText, path: '/franchise/study-material' },
      { label: 'Exam Forms', icon: ClipboardList, path: '/franchise/exam-forms' },
      { label: 'Marksheets', icon: ScrollText, path: '/franchise/marksheets' },
      { label: 'Certificates', icon: IdCard, path: '/franchise/certificates' },
      { label: 'Results', icon: ClipboardList, path: '/franchise/results' },
      {
        label: 'Student Attendance', icon: ClipboardList,
        children: [
          { label: 'Mark Attendance', path: '/franchise/attendance/mark' },
          { label: 'Reports', path: '/franchise/attendance/reports' },
        ],
      },
    ],
  },
  {
    title: 'FEES & FINANCE',
    items: [
      {
        label: 'Fees', icon: IndianRupee,
        children: [
          { label: 'Collect Fee', path: '/franchise/fees/collect' },
          { label: 'Fee History', path: '/franchise/fees/history' },
          { label: 'Pending Payments', path: '/franchise/fees/pending' },
          { label: 'Payment Accounts', path: '/franchise/fees/accounts' },
        ],
      },
    ],
  },
  {
    title: 'OPPORTUNITIES',
    items: [
      { label: 'Jobs', icon: Briefcase, path: '/franchise/jobs' },
      { label: 'Promotions', icon: Megaphone, path: '/franchise/promotions' },
      { label: 'Announcements', icon: Bell, path: '/franchise/announcements' },
      { label: 'Notifications', icon: Bell, path: '/franchise/notifications' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { label: 'Tickets', icon: LifeBuoy, path: '/franchise/tickets' },
      {
        label: 'Reports', icon: BarChart3,
        children: [
          { label: 'Students', path: '/franchise/reports/students' },
          { label: 'Fee Collection', path: '/franchise/reports/fees' },
          { label: 'Pending Fees', path: '/franchise/reports/pending-fees' },
          { label: 'Wallet Statement', path: '/franchise/reports/wallet' },
        ],
      },
    ],
  },
]

interface SidebarProps { open: boolean; onClose: () => void }

export default function FranchiseSidebar({ open, onClose }: SidebarProps) {
  const { signOut } = useAuth()
  const location = useLocation()
  const [expanded, setExpanded] = useState<string[]>([])

  function toggleExpand(label: string) {
    setExpanded(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
  }
  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }
  function isParentActive(item: MenuItem) {
    return item.children?.some(c => isActive(c.path)) ?? false
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[260px] bg-bg-sidebar border-r border-border-default flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="UnSkills" className="h-9 w-auto object-contain" />
            <span className="font-heading text-[15px] font-bold text-text-primary leading-tight">
              Institute Panel
            </span>
          </div>
          <button onClick={onClose} className="lg:hidden text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-4">
          {MENU_SECTIONS.map((section, sIdx) => (
            <div key={section.title}>
              {sIdx > 0 && <div className="my-3 border-t border-border-default" />}
              <p className="mt-4 mb-2 ml-3 text-[10px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon
                  const hasChildren = !!item.children
                  const isExp = expanded.includes(item.label) || isParentActive(item)
                  const active = item.path ? isActive(item.path) : isParentActive(item)

                  if (hasChildren) {
                    return (
                      <div key={item.label}>
                        <button
                          onClick={() => toggleExpand(item.label)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors',
                            active
                              ? 'bg-red-50 text-red-600 font-semibold border-l-[3px] border-red-600'
                              : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                          )}
                        >
                          <Icon size={20} strokeWidth={1.5} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown size={16} className={cn('transition-transform duration-200', isExp && 'rotate-180')} />
                        </button>
                        {isExp && (
                          <div className="mt-0.5 pl-11 space-y-0.5">
                            {item.children!.map(child => (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                onClick={onClose}
                                className={cn(
                                  'block rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                                  isActive(child.path)
                                    ? 'text-red-600 font-medium'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
                                )}
                              >{child.label}</NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path!}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors',
                        active
                          ? 'bg-red-50 text-red-600 font-semibold border-l-[3px] border-red-600'
                          : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                      )}
                    >
                      <Icon size={20} strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border-default p-3 space-y-0.5 shrink-0 mt-auto">
          <NavLink to="/franchise/settings" onClick={onClose}
            className={({ isActive: a }) => cn('flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors',
              a ? 'bg-red-50 text-red-600 font-semibold' : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary')}>
            <Settings size={20} strokeWidth={1.5} /><span>Settings</span>
          </NavLink>
          <NavLink to="/franchise/profile" onClick={onClose}
            className={({ isActive: a }) => cn('flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors',
              a ? 'bg-red-50 text-red-600 font-semibold' : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary')}>
            <UserCircle size={20} strokeWidth={1.5} /><span>Profile</span>
          </NavLink>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut size={20} strokeWidth={1.5} /><span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
