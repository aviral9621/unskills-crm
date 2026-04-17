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
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border-default bg-bg-topbar px-3 sm:pl-4 sm:pr-6 lg:pl-6">
      {/* Left — hamburger only on mobile, title only on desktop */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden rounded-lg p-1.5 sm:p-2 text-text-muted hover:bg-bg-card-hover hover:text-text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        {/* Hide title on mobile — pages have their own titles */}
        <h1 className="hidden sm:block font-heading text-lg font-bold text-text-primary truncate max-w-[300px]">
          {title}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full text-text-muted hover:bg-bg-card-hover hover:text-text-primary transition-colors">
          <Search size={18} />
        </button>
        <button className="relative h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full text-text-muted hover:bg-bg-card-hover hover:text-text-primary transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
        </button>
        <div className="ml-1 sm:ml-2 flex items-center gap-2 sm:gap-3">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? 'avatar'}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-red-600 flex items-center justify-center shrink-0">
              <span className="text-xs sm:text-sm font-semibold text-white">
                {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
            </div>
          )}
          <div className="hidden md:block">
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
