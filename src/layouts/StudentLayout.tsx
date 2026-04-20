import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Briefcase, ClipboardList, ScrollText, IndianRupee, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/student/dashboard' },
  { label: 'Fees', icon: IndianRupee, path: '/student/fees' },
  { label: 'Study Material', icon: FileText, path: '/student/materials' },
  { label: 'Exam Forms', icon: ClipboardList, path: '/student/exam-forms' },
  { label: 'Results', icon: ScrollText, path: '/student/results' },
  { label: 'Jobs', icon: Briefcase, path: '/student/jobs' },
]

export default function StudentLayout() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()

  return (
    <div className="flex h-screen bg-bg-page overflow-hidden">
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-[260px] bg-white border-r flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center justify-between px-5 border-b">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-9" />
            <span className="font-heading text-[15px] font-bold">Student Zone</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden"><X size={20} /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(n => {
            const Icon = n.icon
            return (
              <NavLink key={n.path} to={n.path} onClick={() => setOpen(false)}
                className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm', isActive ? 'bg-red-50 text-red-600 font-semibold' : 'text-gray-600 hover:bg-gray-100')}>
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
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-4">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2"><Menu size={20} /></button>
          <div className="ml-auto text-sm">
            <span className="text-gray-500">Hi,</span> <span className="font-semibold">{profile?.full_name}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1100px]"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
