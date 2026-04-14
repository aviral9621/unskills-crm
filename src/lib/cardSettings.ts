import { supabase } from './supabase'

export interface CardSettings {
  header_title: string
  header_subtitle: string
  director_name: string
  address: string
  phone: string
  website: string
  verify_base_url: string
}

const KEYS: Record<keyof CardSettings, string> = {
  header_title:     'card_header_title',
  header_subtitle:  'card_header_subtitle',
  director_name:    'card_director_name',
  address:          'card_address',
  phone:            'card_phone',
  website:          'card_website',
  verify_base_url:  'card_verify_base_url',
}

const DEFAULTS: CardSettings = {
  header_title:     'UNSKILLS COMPUTER EDUCATION',
  header_subtitle:  'Regd. Under the Company Act 2013 Ministry of Corporate Affairs Govt. of India An ISO 9001:2015 Certified Organization',
  director_name:    'Er. Ankit Vishwakarma',
  address:          '2nd Floor Near Primary School Ranipur Road Mariyahu Jaunpur Uttar Pradesh 222161',
  phone:            '8382898686, 9838382898',
  website:          'www.unskillseducation.org',
  verify_base_url:  'https://www.unskillseducation.org',
}

export async function getCardSettings(): Promise<CardSettings> {
  const keys = Object.values(KEYS)
  const { data, error } = await supabase.from('uce_site_settings').select('key, value').in('key', keys)
  if (error || !data) return DEFAULTS
  const map = new Map<string, string>(data.map(r => [r.key as string, (r.value as string) ?? '']))
  const out = { ...DEFAULTS }
  ;(Object.keys(KEYS) as (keyof CardSettings)[]).forEach(k => {
    const v = map.get(KEYS[k])
    if (v) out[k] = v
  })
  return out
}

export async function saveCardSettings(s: CardSettings): Promise<void> {
  const rows = (Object.keys(KEYS) as (keyof CardSettings)[]).map(k => ({ key: KEYS[k], value: s[k] }))
  const { error } = await supabase.from('uce_site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

/** QR URL for an ID card verification — website should render student details when scanned. */
export function idCardVerifyUrl(baseUrl: string, registrationNo: string): string {
  const b = (baseUrl || '').replace(/\/+$/, '')
  return `${b}/verify/id-card/${encodeURIComponent(registrationNo)}`
}
