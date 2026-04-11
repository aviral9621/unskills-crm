import { Menu, Bell, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface TopBarProps {
  onMenuClick: () => void
  title: string
}

export default function TopBar({ onMenuClick, title }: TopBarProps) {
  const { profile } = useAuth()

  const roleLabel = profile?.role === 'super_admin'
    ? 'Super Admin'
    : profile?.role === 'branch_admin'
      ? 'Branch Admin'
      : profile?.role === 'branch_staff'
        ? 'Staff'
        : ''

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-default bg-bg-topbar pl-4 pr-6 lg:pl-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden rounded-lg p-2 text-text-muted hover:bg-bg-card-hover hover:text-text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-heading text-xl font-bold text-text-primary">
          {title}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button className="h-10 w-10 flex items-center justify-center rounded-full text-text-muted hover:bg-bg-card-hover hover:text-text-primary transition-colors">
          <Search size={20} />
        </button>
        <button className="relative h-10 w-10 flex items-center justify-center rounded-full text-text-muted hover:bg-bg-card-hover hover:text-text-primary transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
        </button>
        <div className="ml-2 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-white">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-text-primary leading-tight">
              {profile?.full_name ?? 'User'}
            </p>
            <p className="text-xs text-text-muted">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
