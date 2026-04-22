/**
 * Service layer for the branch ATC certificate: loads the certificate record
 * from Supabase, enriches it with marksheet-level settings (signature, contact
 * info, verification URL base), and hands the data to the PDF generator.
 */
import { supabase } from './supabase'
import { getMarksheetSettings } from './marksheetSettings'
import {
  generateAtcCertificate,
  generateAtcCertificateBlob,
  type AtcCertificateData,
} from './pdf/atc-certificate'

function formatDateDDMMYYYY(input: string | Date | null | undefined): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input.length === 10 ? input + 'T00:00:00' : input)
  if (isNaN(d.getTime())) return String(input)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

function composeBranchAddress(row: {
  address_line1?: string | null
  village?: string | null
  block?: string | null
  district?: string | null
  state?: string | null
  pincode?: string | null
}): string {
  return [row.address_line1, row.village, row.block, row.district, row.state, row.pincode]
    .filter(Boolean)
    .join(', ')
}

export async function loadAtcCertificateData(branchId: string): Promise<AtcCertificateData> {
  // 1. Branch row (for address + logo + director)
  const { data: branch, error: branchErr } = await supabase
    .from('uce_branches')
    .select(
      'id, name, director_name, address_line1, village, block, district, state, pincode, center_logo_url',
    )
    .eq('id', branchId)
    .single()
  if (branchErr || !branch) {
    throw new Error(branchErr?.message || 'Branch not found')
  }

  // 2. ATC certificate row (auto-created via DB trigger on branch insert)
  const { data: cert, error: certErr } = await supabase
    .from('uce_atc_certificates')
    .select('atc_code, owner_name, course_type, issue_date, renewal_date, status')
    .eq('branch_id', branchId)
    .single()
  if (certErr || !cert) {
    throw new Error(
      "Certificate record missing. It should auto-generate on branch creation — try editing the branch to re-trigger, or contact support.",
    )
  }

  // 3. Shared settings (contact info, signature, verification URL)
  const settings = await getMarksheetSettings().catch(() => null)

  return {
    atcCode: cert.atc_code,
    branchName: branch.name,
    branchAddress: composeBranchAddress(branch),
    branchLogoUrl: branch.center_logo_url,
    ownerName: cert.owner_name || branch.director_name || 'Branch Director',
    courseType: cert.course_type,
    issueDate: formatDateDDMMYYYY(cert.issue_date),
    renewalDate: formatDateDDMMYYYY(cert.renewal_date),
    verificationUrlBase: settings?.verify_base_url || 'https://www.unskillseducation.org',
    regNumber: '220102',
    contactPhone: '8382898686 / 9838382898',
    contactEmail: settings?.email || 'info@unskillseducation.org',
    website: settings?.website || 'www.unskillseducation.org',
    headOfficeAddress:
      settings?.footer_address ||
      '2nd Floor Ranipur Road Mariahu Jaunpur Uttar Pradesh, India - 222161',
    signatoryName: settings?.left_signer_name || 'Er. Ankit Vishwakarma',
    signatureImageUrl: settings?.left_signature_url || null,
    unskillsLogoUrl: '/MAIN LOGO FOR ALL CARDS.png',
  }
}

export async function viewAtcCertificate(branchId: string): Promise<void> {
  const data = await loadAtcCertificateData(branchId)
  const blob = await generateAtcCertificateBlob(data)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  // Revoke after a delay so the new tab has time to load the blob
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadAtcCertificate(branchId: string, branchName: string): Promise<void> {
  const data = await loadAtcCertificateData(branchId)
  const bytes = await generateAtcCertificate(data)
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([buf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${branchName.replace(/[^\w\s-]/g, '').trim() || 'branch'}-ATC-${data.atcCode.replace(/[^\w-]/g, '-')}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
