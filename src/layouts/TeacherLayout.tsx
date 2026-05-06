import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LogOut, Menu, X, CalendarCheck, BarChart3, UserCircle, GraduationCap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'

const NAV = [
  { label: 'Mark Attendance', icon: CalendarCheck, path: '/teacher/attendance' },
  { label: 'Reports', icon: BarChart3, path: '/teacher/reports' },
]

export default function TeacherLayout() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()

  return (
    <div className="flex h-screen bg-bg-page overflow-hidden">
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-[260px] bg-white border-r flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between px-5 border-b">
          <div className="flex items-center gap-2">
            <GraduationCap size={22} className="text-red-600" />
            <span className="font-heading text-[15px] font-bold">Teacher Panel</span>
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
        <div className="p-3 border-t space-y-0.5">
          <NavLink to="/teacher/profile"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive ? 'bg-red-50 text-red-600 font-semibold' : 'text-gray-600 hover:bg-gray-100',
            )}>
            <UserCircle size={18} /> Profile
          </NavLink>
          <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 relative">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-3 sm:px-4">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Menu size={20} /></button>
          <div className="ml-auto text-sm truncate">
            <span className="text-gray-500 hidden sm:inline">Hi,</span> <span className="font-semibold">{profile?.full_name}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <div className="mx-auto max-w-[1100px]"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
