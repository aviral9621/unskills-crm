import { useState } from 'react'
import { Outlet, NavLink, useParams, Link } from 'react-router-dom'
import {
  LayoutDashboard, FileText, ClipboardList, ScrollText, IndianRupee,
  Menu, X, Video, IdCard, BookOpen, Megaphone, UserCircle, Eye, ArrowLeft,
} from 'lucide-react'
import { ImpersonationProvider } from '../../contexts/ImpersonationContext'
import { useStudentRecord } from '../student/useStudent'
import { cn } from '../../lib/utils'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, slug: 'dashboard' },
  { label: 'Fees', icon: IndianRupee, slug: 'fees' },
  { label: 'My Documents', icon: IdCard, slug: 'documents' },
  { label: 'Live Classes', icon: Video, slug: 'classes' },
  { label: 'Study Material', icon: FileText, slug: 'materials' },
  { label: 'Syllabus', icon: BookOpen, slug: 'syllabus' },
  { label: 'Online Tests', icon: ClipboardList, slug: 'tests' },
  { label: 'Exam Forms', icon: ClipboardList, slug: 'exam-forms' },
  { label: 'Admit Card', icon: IdCard, slug: 'admit-card' },
  { label: 'Results', icon: ScrollText, slug: 'results' },
  { label: 'Announcements', icon: Megaphone, slug: 'announcements' },
  { label: 'Profile', icon: UserCircle, slug: 'profile' },
]

function ViewAsStudentInner() {
  const [open, setOpen] = useState(false)
  const { studentId } = useParams<{ studentId: string }>()
  const { rec } = useStudentRecord()

  const base = `/admin/view-as/${studentId}`

  return (
    <div className="flex h-screen bg-bg-page overflow-hidden">
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-[260px] bg-white border-r flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between px-5 border-b">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-9" />
            <span className="font-heading text-[15px] font-bold">Student View</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-900"><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map(n => {
            const Icon = n.icon
            return (
              <NavLink key={n.slug} to={`${base}/${n.slug}`} end onClick={() => setOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-red-50 text-red-600 font-semibold border-l-[3px] border-red-600' : 'text-gray-600 hover:bg-gray-100',
                )}>
                <Icon size={18} /> {n.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="p-3 border-t">
          <Link to="/admin/students" className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            <ArrowLeft size={18} /> Back to Students
          </Link>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 relative">
        <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-2 text-xs sm:text-sm flex items-center gap-2">
          <Eye size={14} className="text-amber-700 shrink-0" />
          <span className="text-amber-900">
            <strong>Read-only admin view</strong>
            {rec && <> — {rec.name} <span className="font-mono text-amber-700">· {rec.registration_no}</span></>}
          </span>
          <button
            onClick={() => window.close()}
            className="ml-auto text-amber-800 hover:text-amber-900 font-semibold underline-offset-2 hover:underline"
          >
            Exit
          </button>
        </div>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-3 sm:px-4">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Menu size={20} /></button>
          <div className="ml-auto text-sm truncate">
            <span className="text-gray-500 hidden sm:inline">Viewing:</span>{' '}
            <span className="font-semibold">{rec?.name ?? '...'}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <div className="mx-auto max-w-[1100px]"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}

export default function ViewAsStudentLayout() {
  const { studentId } = useParams<{ studentId: string }>()
  if (!studentId) return null
  return (
    <ImpersonationProvider studentId={studentId}>
      <ViewAsStudentInner />
    </ImpersonationProvider>
  )
}
