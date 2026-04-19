import { supabase } from './supabase'
import { getMarksheetSettings } from './marksheetSettings'
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

/** Copies shared fields from marksheet settings into certificate settings. */
export async function syncCertificateFromMarksheet(): Promise<CertificateSettings> {
  const [ms, cert] = await Promise.all([getMarksheetSettings(), getCertificateSettings()])

  // Split the marksheet header_tagline (multi-line) into 3 sub-header lines
  const taglineLines = (ms.header_tagline || '').split('\n').map(l => l.trim()).filter(Boolean)

  const patch: Partial<CertificateSettings> = {
    tagline: ms.header_subtitle || cert.tagline,
    sub_header_line_1: taglineLines[0] ?? cert.sub_header_line_1,
    sub_header_line_2: taglineLines[1] ?? cert.sub_header_line_2,
    sub_header_line_3: ms.reg_line || taglineLines[2] || cert.sub_header_line_3,
    corporate_office_address: ms.footer_address || cert.corporate_office_address,
    contact_email: ms.email || cert.contact_email,
    verification_url_base: ms.verify_base_url || cert.verification_url_base,
    signatory_name: ms.left_signer_name || cert.signatory_name,
    signatory_designation: ms.left_signer_title || cert.signatory_designation,
    signatory_company_line: ms.left_signer_org || cert.signatory_company_line,
    signature_image_url: ms.left_signature_url || cert.signature_image_url,
  }

  await saveCertificateSettings({ id: cert.id, ...patch })
  return { ...cert, ...patch }
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

export async function upsertBulkCourseMappings(
  courseIds: string[],
  templateId: string,
  showTypingFields: boolean,
): Promise<void> {
  if (courseIds.length === 0) return

  // Delete existing mappings for all selected courses
  const { error: delErr } = await supabase
    .from('uce_course_certificate_mapping')
    .delete()
    .in('course_id', courseIds)
  if (delErr) throw delErr

  const rows = courseIds.map(cid => ({
    course_id: cid,
    template_id: templateId,
    is_default: true,
    show_typing_fields: showTypingFields,
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

export async function deleteBulkCourseMappings(courseIds: string[]): Promise<void> {
  if (courseIds.length === 0) return
  const { error } = await supabase
    .from('uce_course_certificate_mapping')
    .delete()
    .in('course_id', courseIds)
  if (error) throw error
}

/** Determines which certificate template to auto-assign based on course name/type. */
export function autoMapCertificateTemplate(
  courseName: string,
  courseType?: string,
): 'portrait' | 'landscape' | null {
  const name = courseName.toLowerCase()
  const type = (courseType || '').toLowerCase()

  if (name.includes('typing') || type.includes('typing')) return 'portrait'

  if (
    name.includes('diploma') || name.includes('certificate') ||
    name.includes('training') || name.includes('skill') ||
    name.includes('computer') || name.includes('programming') ||
    name.includes('development') || type.includes('skill') ||
    type.includes('training')
  ) return 'landscape'

  return null
}
