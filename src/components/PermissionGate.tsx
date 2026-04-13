import { usePermission } from '../hooks/usePermission'
import type { PermissionKey } from '../lib/permissions'
import { ShieldX } from 'lucide-react'

interface PermissionGateProps {
  permission: PermissionKey
  children: React.ReactNode
  fallback?: React.ReactNode
  showDenied?: boolean
}

/**
 * Wraps content that requires a specific permission.
 * - Super Admin always passes.
 * - Other roles checked against uce_permissions table.
 * - If `showDenied`, renders a 403-like message instead of null.
 */
export default function PermissionGate({
  permission,
  children,
  fallback,
  showDenied = false,
}: PermissionGateProps) {
  const hasPermission = usePermission(permission)

  if (hasPermission) return <>{children}</>

  if (fallback) return <>{fallback}</>

  if (showDenied) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <ShieldX size={48} strokeWidth={1.5} className="mx-auto text-gray-300 mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 font-heading">Access Denied</h2>
          <p className="text-sm text-gray-500 mt-1">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return null
}
