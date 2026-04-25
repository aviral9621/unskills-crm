import { supabase } from './supabase'

export interface SiteSettings {
  institute_name: string
  institute_logo_url: string   // base64 data URL
  tagline: string
  contact_email: string
  contact_phone: string
  address: string
  website: string
  social_facebook: string
  social_instagram: string
  social_youtube: string
  social_linkedin: string
  kit_amount: string
}

const KEYS: Record<keyof SiteSettings, string> = {
  institute_name:     'site_institute_name',
  institute_logo_url: 'site_institute_logo_url',
  tagline:            'site_tagline',
  contact_email:      'site_contact_email',
  contact_phone:      'site_contact_phone',
  address:            'site_address',
  website:            'site_website',
  social_facebook:    'site_social_facebook',
  social_instagram:   'site_social_instagram',
  social_youtube:     'site_social_youtube',
  social_linkedin:    'site_social_linkedin',
  kit_amount:         'site_kit_amount',
}

export const SITE_DEFAULTS: SiteSettings = {
  institute_name:     'UNSKILLS COMPUTER EDUCATION',
  institute_logo_url: '',
  tagline:            'A Unit of: UnSkills FuturePath Tech Pvt. Ltd.',
  contact_email:      '',
  contact_phone:      '',
  address:            '',
  website:            'www.unskillsc.org',
  social_facebook:    '',
  social_instagram:   '',
  social_youtube:     '',
  social_linkedin:    '',
  kit_amount:         '500',
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const keys = Object.values(KEYS)
  const { data, error } = await supabase.from('uce_site_settings').select('key, value').in('key', keys)
  if (error || !data) return SITE_DEFAULTS
  const map = new Map<string, string>(data.map(r => [r.key as string, (r.value as string) ?? '']))
  const out = { ...SITE_DEFAULTS }
  ;(Object.keys(KEYS) as (keyof SiteSettings)[]).forEach(k => {
    const v = map.get(KEYS[k])
    if (v) out[k] = v
  })
  return out
}

export async function saveSiteSettings(s: SiteSettings): Promise<void> {
  const rows = (Object.keys(KEYS) as (keyof SiteSettings)[]).map(k => ({ key: KEYS[k], value: s[k] }))
  const { error } = await supabase.from('uce_site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}
