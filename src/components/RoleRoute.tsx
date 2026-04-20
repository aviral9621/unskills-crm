import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type Role = 'super_admin' | 'branch_admin' | 'branch_staff' | 'student'

function defaultHomeFor(role?: string): string {
  if (role === 'super_admin') return '/admin/dashboard'
  if (role === 'branch_admin' || role === 'branch_staff') return '/franchise/dashboard'
  if (role === 'student') return '/student/dashboard'
  return '/franchise/login'
}

export function ProtectedRoute({ children, allow }: { children: React.ReactNode; allow: Role[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 size={32} className="animate-spin text-red-600" />
      </div>
    )
  }
  if (!session) {
    return <Navigate to={allow.includes('super_admin') ? '/admin/login' : '/franchise/login'} replace />
  }
  // Wait until profile loads to decide; show spinner briefly
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 size={32} className="animate-spin text-red-600" />
      </div>
    )
  }
  if (!allow.includes(profile.role as Role)) {
    return <Navigate to={defaultHomeFor(profile.role)} replace />
  }
  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 size={32} className="animate-spin text-red-600" />
      </div>
    )
  }
  if (session && profile) return <Navigate to={defaultHomeFor(profile.role)} replace />
  return <>{children}</>
}
