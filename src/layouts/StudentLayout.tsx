import { useEffect, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Briefcase, ClipboardList, ScrollText, IndianRupee,
  LogOut, Menu, X, Video, IdCard, BookOpen, Megaphone, UserCircle, MessageCircle, Gift,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/student/dashboard' },
  { label: 'Fees', icon: IndianRupee, path: '/student/fees' },
  { label: 'My Documents', icon: IdCard, path: '/student/documents' },
  { label: 'Live Classes', icon: Video, path: '/student/classes' },
  { label: 'Study Material', icon: FileText, path: '/student/materials' },
  { label: 'Syllabus', icon: BookOpen, path: '/student/syllabus' },
  { label: 'Online Tests', icon: ClipboardList, path: '/student/tests' },
  { label: 'Exam Forms', icon: ClipboardList, path: '/student/exam-forms' },
  { label: 'Results', icon: ScrollText, path: '/student/results' },
  { label: 'Jobs', icon: Briefcase, path: '/student/jobs' },
  { label: 'Refer & Earn', icon: Gift, path: '/student/refer-earn' },
  { label: 'Announcements', icon: Megaphone, path: '/student/announcements' },
  { label: 'Profile', icon: UserCircle, path: '/student/profile' },
]

export default function StudentLayout() {
  const [open, setOpen] = useState(false)
  const { profile, user, signOut } = useAuth()
  const [supportNumber, setSupportNumber] = useState<string | null>(null)
  const [regNo, setRegNo] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('uce_students').select('registration_no, branch:uce_branches(director_phone)').eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setRegNo(data.registration_no ?? null)
        const dp = (data.branch as unknown as { director_phone?: string } | null)?.director_phone
        setSupportNumber(dp ?? null)
      })
  }, [user?.id])

  const waHref = supportNumber
    ? `https://wa.me/91${String(supportNumber).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, ${regNo ?? 'student'} needs help with `)}`
    : null

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
            <span className="font-heading text-[15px] font-bold">Student Zone</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-900"><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map(n => {
            const Icon = n.icon
            return (
              <NavLink key={n.path} to={n.path} onClick={() => setOpen(false)}
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
          <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 relative">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-3 sm:px-4">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Menu size={20} /></button>
          <div className="ml-auto text-sm truncate">
            <span className="text-gray-500 hidden sm:inline">Hi,</span> <span className="font-semibold">{profile?.full_name || regNo}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <div className="mx-auto max-w-[1100px]"><Outlet /></div>
        </main>

        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer" aria-label="WhatsApp support"
             className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105">
            <MessageCircle size={22} />
          </a>
        )}
      </div>
    </div>
  )
}
