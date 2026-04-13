import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PermissionKey } from '../lib/permissions'

/**
 * Check if current user has a specific permission.
 * - Super Admin & Branch Admin: always true (full access)
 * - Branch Staff: checked against uce_permissions table
 */
export function usePermission(key: PermissionKey): boolean {
  const { profile } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    if (!profile) {
      setHasPermission(false)
      return
    }

    // Super admin and branch admin have all permissions
    if (profile.role === 'super_admin' || profile.role === 'branch_admin') {
      setHasPermission(true)
      return
    }

    // Branch staff — check DB
    let cancelled = false
    supabase
      .from('uce_permissions')
      .select('granted')
      .eq('user_id', profile.id)
      .eq('permission_key', key)
      .single()
      .then(({ data }) => {
        if (!cancelled) setHasPermission(data?.granted ?? false)
      })

    return () => { cancelled = true }
  }, [profile?.id, profile?.role, key])

  return hasPermission
}

export function usePermissions(keys: PermissionKey[]): Record<string, boolean> {
  const { profile } = useAuth()
  const [perms, setPerms] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!profile) {
      setPerms({})
      return
    }

    if (profile.role === 'super_admin' || profile.role === 'branch_admin') {
      const all: Record<string, boolean> = {}
      keys.forEach(k => { all[k] = true })
      setPerms(all)
      return
    }

    let cancelled = false
    supabase
      .from('uce_permissions')
      .select('permission_key, granted')
      .eq('user_id', profile.id)
      .in('permission_key', keys)
      .then(({ data }) => {
        if (cancelled) return
        const result: Record<string, boolean> = {}
        keys.forEach(k => { result[k] = false })
        data?.forEach(d => { result[d.permission_key] = d.granted })
        setPerms(result)
      })

    return () => { cancelled = true }
  }, [profile?.id, profile?.role, keys.join(',')])

  return perms
}
