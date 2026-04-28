import { supabase } from './supabase'

const CHUNK = 200

function chunk<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function isStudentLocked(studentId: string): Promise<boolean> {
  const { data } = await supabase.rpc('uce_is_student_locked', { p_student_id: studentId })
  return data === true
}

export async function lockedStudentIds(studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set()
  const chunks = chunk(studentIds)
  const set = new Set<string>()
  await Promise.all(chunks.map(async ids => {
    const [certsRes, msRes] = await Promise.all([
      supabase.from('uce_certificates').select('student_id').in('student_id', ids).in('status', ['active','issued']),
      supabase.from('uce_marksheets').select('student_id').in('student_id', ids).eq('is_active', true),
    ])
    ;(certsRes.data ?? []).forEach(r => r.student_id && set.add(r.student_id))
    ;(msRes.data ?? []).forEach(r => r.student_id && set.add(r.student_id))
  }))
  return set
}
