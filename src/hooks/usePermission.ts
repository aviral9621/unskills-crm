import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PermissionKey } from '../lib/permissions'

export function usePermission(key: PermissionKey): boolean {
  const { profile } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    if (!profile) {
      setHasPermission(false)
      return
    }

    // Super admin has all permissions
    if (profile.role === 'super_admin') {
      setHasPermission(true)
      return
    }

    supabase
      .from('uce_permissions')
      .select('granted')
      .eq('user_id', profile.id)
      .eq('permission_key', key)
      .single()
      .then(({ data }) => {
        setHasPermission(data?.granted ?? false)
      })
  }, [profile, key])

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

    if (profile.role === 'super_admin') {
      const all: Record<string, boolean> = {}
      keys.forEach(k => { all[k] = true })
      setPerms(all)
      return
    }

    supabase
      .from('uce_permissions')
      .select('permission_key, granted')
      .eq('user_id', profile.id)
      .in('permission_key', keys)
      .then(({ data }) => {
        const result: Record<string, boolean> = {}
        keys.forEach(k => { result[k] = false })
        data?.forEach(d => { result[d.permission_key] = d.granted })
        setPerms(result)
      })
  }, [profile, keys.join(',')])

  return perms
}
