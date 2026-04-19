import { supabase } from './supabase'
import type {
  CertificateSettings,
  CertificateTemplate,
  CourseCertificateMapping,
} from '../types/certificate'

export async function getCertificateSettings(): Promise<CertificateSettings> {
  const { data, error } = await supabase
    .from('uce_certificate_settings')
    .select('*')
    .limit(1)
    .single()
  if (error) throw error
  return data as CertificateSettings
}

export async function saveCertificateSettings(patch: Partial<CertificateSettings>): Promise<void> {
  const { id, ...rest } = patch
  if (!id) {
    // Fetch the singleton id first
    const current = await getCertificateSettings()
    const { error } = await supabase
      .from('uce_certificate_settings')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', current.id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('uce_certificate_settings')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function listCertificateTemplates(): Promise<CertificateTemplate[]> {
  const { data, error } = await supabase
    .from('uce_certificate_templates')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as CertificateTemplate[]
}

export async function listCourseMappings(courseId?: string): Promise<CourseCertificateMapping[]> {
  let q = supabase.from('uce_course_certificate_mapping').select('*')
  if (courseId) q = q.eq('course_id', courseId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CourseCertificateMapping[]
}

export interface CourseMappingInput {
  courseId: string
  templateIds: string[]
  defaultTemplateId: string | null
  showTypingFields: boolean
}

export async function upsertCourseMapping(input: CourseMappingInput): Promise<void> {
  // Replace all mappings for the course atomically.
  const { error: delErr } = await supabase
    .from('uce_course_certificate_mapping')
    .delete()
    .eq('course_id', input.courseId)
  if (delErr) throw delErr

  if (input.templateIds.length === 0) return

  const rows = input.templateIds.map(tid => ({
    course_id: input.courseId,
    template_id: tid,
    is_default: tid === input.defaultTemplateId,
    show_typing_fields: input.showTypingFields,
  }))
  const { error } = await supabase.from('uce_course_certificate_mapping').insert(rows)
  if (error) throw error
}

export async function deleteCourseMapping(courseId: string): Promise<void> {
  const { error } = await supabase
    .from('uce_course_certificate_mapping')
    .delete()
    .eq('course_id', courseId)
  if (error) throw error
}
