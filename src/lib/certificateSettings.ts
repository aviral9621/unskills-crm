import { supabase } from './supabase'
import { getMarksheetSettings } from './marksheetSettings'
import type {
  CertificateSettings,
  CertificateTemplate,
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

