import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Branch } from '../types'

export function useBranchId(): string | null {
  const { profile } = useAuth()
  return profile?.branch_id ?? null
}

export function useBranch(): Branch | null {
  const branchId = useBranchId()
  const [branch, setBranch] = useState<Branch | null>(null)

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_branches').select('*').eq('id', branchId).single()
      .then(({ data }) => data && setBranch(data as Branch))
  }, [branchId])

  return branch
}
