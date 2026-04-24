import { supabase } from './supabase'

export interface StaffCardSettings {
  authority_name: string
  authority_designation: string
  signature_url: string       // base64 data URL (PNG/JPG) — the authorised stamp/signature
  verify_base_url: string
  validity_line: string       // e.g. "Valid throughout the service period of the employee"
}

const KEYS: Record<keyof StaffCardSettings, string> = {
  authority_name:        'staff_card_authority_name',
  authority_designation: 'staff_card_authority_designation',
  signature_url:         'staff_card_authority_signature_url',
  verify_base_url:       'staff_card_verify_base_url',
  validity_line:         'staff_card_validity_line',
}

const DEFAULTS: StaffCardSettings = {
  authority_name:        'Er. Ankit Vishwakarma',
  authority_designation: 'Director',
  signature_url:         '',
  verify_base_url:       'https://www.unskillseducation.org',
  validity_line:         'Valid throughout the service period of the employee.',
}

export async function getStaffCardSettings(): Promise<StaffCardSettings> {
  const keys = Object.values(KEYS)
  const { data, error } = await supabase.from('uce_site_settings').select('key, value').in('key', keys)
  if (error || !data) return DEFAULTS
  const map = new Map<string, string>(data.map(r => [r.key as string, (r.value as string) ?? '']))
  const out = { ...DEFAULTS }
  ;(Object.keys(KEYS) as (keyof StaffCardSettings)[]).forEach(k => {
    const v = map.get(KEYS[k])
    if (v) out[k] = v
  })
  return out
}

export async function saveStaffCardSettings(s: StaffCardSettings): Promise<void> {
  const rows = (Object.keys(KEYS) as (keyof StaffCardSettings)[]).map(k => ({ key: KEYS[k], value: s[k] }))
  const { error } = await supabase.from('uce_site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

/** QR URL for staff ID card verification. */
export function staffIdCardVerifyUrl(baseUrl: string, employeeCode: string): string {
  const b = (baseUrl || '').replace(/\/+$/, '')
  return `${b}/verify/staff/${encodeURIComponent(employeeCode)}`
}
