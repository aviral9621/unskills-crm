import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useImpersonation } from '../../contexts/ImpersonationContext'

export interface StudentRec {
  id: string
  name: string
  father_name: string
  registration_no: string
  phone: string
  email: string | null
  alt_phone: string | null
  whatsapp: string | null
  address: string | null
  village: string | null
  block: string | null
  district: string | null
  state: string | null
  pincode: string | null
  course_id: string
  branch_id: string
  net_fee: number
  photo_url: string | null
  session: string | null
  course: { name: string; code: string } | null
  branch: { name: string; code: string; director_phone: string } | null
}

const SELECT_COLS =
  'id,name,father_name,registration_no,phone,email,alt_phone,whatsapp,address,village,block,district,state,pincode,course_id,branch_id,net_fee,photo_url,session,course:uce_courses(name,code),branch:uce_branches(name,code,director_phone)'

export function useStudentRecord() {
  const { user } = useAuth()
  const { studentId, isImpersonating } = useImpersonation()
  const [rec, setRec] = useState<StudentRec | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    let data: unknown = null
    if (isImpersonating && studentId) {
      const res = await supabase.from('uce_students').select(SELECT_COLS).eq('id', studentId).maybeSingle()
      data = res.data
    } else if (user) {
      const res = await supabase.from('uce_students').select(SELECT_COLS).eq('auth_user_id', user.id).maybeSingle()
      data = res.data
    }
    setRec(data as StudentRec | null)
    setLoading(false)
  }

  useEffect(() => { reload() }, [user?.id, studentId, isImpersonating])

  return { rec, loading, reload }
}
