import { supabase } from './supabase'

export async function isStudentLocked(studentId: string): Promise<boolean> {
  const { data } = await supabase.rpc('uce_is_student_locked', { p_student_id: studentId })
  return data === true
}

export async function lockedStudentIds(studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set()
  const [certsRes, msRes] = await Promise.all([
    supabase.from('uce_certificates').select('student_id').in('student_id', studentIds).in('status', ['active','issued']),
    supabase.from('uce_marksheets').select('student_id').in('student_id', studentIds).eq('is_active', true),
  ])
  const set = new Set<string>()
  ;(certsRes.data ?? []).forEach(r => r.student_id && set.add(r.student_id))
  ;(msRes.data ?? []).forEach(r => r.student_id && set.add(r.student_id))
  return set
}
