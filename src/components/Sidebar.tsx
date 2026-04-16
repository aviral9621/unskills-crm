import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, MessageSquare,
  GraduationCap, BookOpen, BookText, Layers,
  FileText, Video, ClipboardList, ScrollText, Award,
  Briefcase,
  BarChart3, MonitorPlay,
  Settings, UserCircle, ChevronDown, LogOut, X,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

interface MenuItem {
  label: string
  icon: React.ElementType
  path?: string
  permission?: string // permission key prefix to check (e.g. 'student', 'course')
  children?: { label: string; path: string; permission?: string }[]
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard', permission: 'dashboard' },
      { label: 'Branches', icon: Building2, path: '/admin/branches', permission: 'branch' },
      { label: 'Users', icon: Users, path: '/admin/users', permission: 'user' },
      { label: 'Inquiries', icon: MessageSquare, path: '/admin/inquiries', permission: 'inquiry' },
    ],
  },
  {
    title: 'ACADEMICS',
    items: [
      {
        label: 'Students', icon: GraduationCap, permission: 'student',
        children: [
          { label: 'All Students', path: '/admin/students', permission: 'student.view' },
          { label: 'Register Student', path: '/admin/students/register', permission: 'student.register' },
          { label: 'ID Card', path: '/admin/students/id-card', permission: 'student.idcard' },
          { label: 'Admit Card', path: '/admin/students/admit-card', permission: 'admitcard.view' },
        ],
      },
      {
        label: 'Courses', icon: BookOpen, permission: 'course',
        children: [
          { label: 'Programs', path: '/admin/courses/programs' },
          { label: 'All Courses', path: '/admin/courses' },
        ],
      },
      { label: 'Subjects', icon: BookText, path: '/admin/courses/subjects', permission: 'course' },
      { label: 'Batches', icon: Layers, path: '/admin/courses/batches', permission: 'course' },
      {
        label: 'Study Material', icon: FileText, permission: 'material',
        children: [
          { label: 'Materials', path: '/admin/study-material' },
          { label: 'Syllabus', path: '/admin/study-material/syllabus' },
        ],
      },
      { label: 'Online Classes', icon: Video, path: '/admin/online-classes', permission: 'class' },
      {
        label: 'Online Exams', icon: ClipboardList, permission: 'exam',
        children: [
          { label: 'Paper Sets', path: '/admin/exams/paper-sets' },
          { label: 'Results', path: '/admin/exams/results' },
        ],
      },
      { label: 'Marksheets', icon: ScrollText, path: '/admin/marksheets', permission: 'marksheet' },
      { label: 'Certificates', icon: Award, path: '/admin/certificates', permission: 'certificate' },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      {
        label: 'Staff', icon: Briefcase, permission: 'staff',
        children: [
          { label: 'Departments', path: '/admin/staff/departments' },
          { label: 'Employees', path: '/admin/staff/employees' },
          { label: 'Attendance', path: '/admin/staff/attendance', permission: 'staff.attendance' },
          { label: 'Advances', path: '/admin/staff/advances' },
          { label: 'Salary Slips', path: '/admin/staff/salary-slips', permission: 'staff.salary' },
        ],
      },
      {
        label: 'Reports', icon: BarChart3, permission: 'report',
        children: [
          { label: 'Student Report', path: '/admin/reports/students', permission: 'report.student' },
          { label: 'Fees Report', path: '/admin/reports/fees', permission: 'report.fees' },
          { label: 'Due Fees', path: '/admin/reports/due-fees', permission: 'report.duefees' },
          { label: 'Income', path: '/admin/reports/income', permission: 'finance.income' },
          { label: 'Expenses', path: '/admin/reports/expenses', permission: 'finance.expense' },
          { label: 'Profit & Loss', path: '/admin/reports/profit-loss', permission: 'finance.pnl' },
        ],
      },
      {
        label: 'Website', icon: MonitorPlay, permission: 'website',
        children: [
          { label: 'Gallery', path: '/admin/website/gallery', permission: 'website.gallery' },
          { label: 'Banners', path: '/admin/website/banners', permission: 'website.banner' },
          { label: 'Videos', path: '/admin/website/videos', permission: 'website.video' },
          { label: 'Newsletters', path: '/admin/website/newsletters', permission: 'website.newsletter' },
        ],
      },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [expanded, setExpanded] = useState<string[]>([])
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set())
  const [permsLoaded, setPermsLoaded] = useState(false)

  const isStaff = profile?.role === 'branch_staff'

  // Load permissions for branch_staff
  useEffect(() => {
    if (!profile) return
    if (!isStaff) {
      setPermsLoaded(true)
      return
    }
    supabase
      .from('uce_permissions')
      .select('permission_key')
      .eq('user_id', profile.id)
      .eq('granted', true)
      .then(({ data }) => {
        setGrantedKeys(new Set((data ?? []).map(d => d.permission_key)))
        setPermsLoaded(true)
      })
  }, [profile?.id, profile?.role])

  // Admins (super_admin / branch_admin) see everything — no need to wait on perms query
  const showFullMenu = profile && !isStaff
  // Staff must wait for perms query to know what they can access
  const showStaffMenu = profile && isStaff && permsLoaded

  // Check if staff user has any permission matching a prefix
  function hasAccess(permissionPrefix?: string): boolean {
    if (!isStaff) return true // super_admin & branch_admin see everything
    if (!permissionPrefix) return true
    // Check if user has ANY permission starting with this prefix
    for (const key of grantedKeys) {
      if (key.startsWith(permissionPrefix)) return true
    }
    return false
  }

  // Check specific child permission
  function hasChildAccess(childPerm?: string, parentPerm?: string): boolean {
    if (!isStaff) return true
    if (childPerm) {
      return grantedKeys.has(childPerm)
    }
    // No specific child permission — inherit from parent
    return hasAccess(parentPerm)
  }

  function toggleExpand(label: string) {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function isParentActive(item: MenuItem) {
    return item.children?.some(c => isActive(c.path)) ?? false
  }

  // Render the sidebar shell immediately (logo + footer + section headers).
  // Menu items are gated below based on role/perms.
  const renderMenu = showFullMenu || showStaffMenu

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[260px] bg-bg-sidebar border-r border-border-default flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="UnSkills" className="h-9 w-auto object-contain" />
            <span className="font-heading text-[15px] font-bold text-text-primary leading-tight">
              UnSkills CRM
            </span>
          </div>
          <button onClick={onClose} className="lg:hidden text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-2 px-4">
          {!renderMenu && (
            // Skeleton placeholders while profile / perms load
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton h-9 rounded-lg" />
              ))}
            </div>
          )}
          {renderMenu && MENU_SECTIONS.map((section, sIdx) => {
            // Filter items this user can access
            const visibleItems = section.items.filter(item => hasAccess(item.permission))
            if (visibleItems.length === 0) return null

            return (
              <div key={section.title}>
                {sIdx > 0 && <div className="my-3 border-t border-border-default" />}

                <p className="mt-4 mb-2 ml-3 text-[10px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const Icon = item.icon
                    const hasChildren = !!item.children
                    const isExp = expanded.includes(item.label) || isParentActive(item)
                    const active = item.path ? isActive(item.path) : isParentActive(item)

                    if (hasChildren) {
                      // Filter children by permission
                      const visibleChildren = item.children!.filter(c => hasChildAccess(c.permission, item.permission))
                      if (visibleChildren.length === 0) return null

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
                            <ChevronDown
                              size={16}
                              className={cn(
                                'transition-transform duration-200',
                                isExp && 'rotate-180'
                              )}
                            />
                          </button>
                          {isExp && (
                            <div className="mt-0.5 pl-11 space-y-0.5">
                              {visibleChildren.map(child => (
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
                                >
                                  {child.label}
                                </NavLink>
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
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border-default p-3 space-y-0.5 shrink-0 mt-auto">
          <NavLink
            to="/admin/settings"
            onClick={onClose}
            className={({ isActive: a }) => cn(
              'flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors',
              a ? 'bg-red-50 text-red-600 font-semibold' : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
            )}
          >
            <Settings size={20} strokeWidth={1.5} />
            <span>Settings</span>
          </NavLink>
          <NavLink
            to="/admin/profile"
            onClick={onClose}
            className={({ isActive: a }) => cn(
              'flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors',
              a ? 'bg-red-50 text-red-600 font-semibold' : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
            )}
          >
            <UserCircle size={20} strokeWidth={1.5} />
            <span>Profile</span>
          </NavLink>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={20} strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
