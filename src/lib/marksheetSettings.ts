import { supabase } from './supabase'

export interface GradeBand {
  label: string  // e.g. "Excellent"
  min: number    // inclusive, 0-100
  max: number    // inclusive, 0-100
  grade: string  // e.g. "A+"
}

export interface MarksheetSettings {
  header_title: string          // e.g. "UNSKILLS COMPUTER EDUCATION"
  header_subtitle: string       // "An ISO 9001:2015 Certified Organization"
  header_tagline: string        // certifications + company alliance lines (multi-line)
  reg_line: string              // "Registered under Company Act 2013"
  iso_line: string              // top-right ISO block text
  footer_address: string        // head office address in footer
  website: string               // verification website
  email: string                 // contact email
  left_signer_name: string      // e.g. "Er. Ankit Vishwakarma"
  left_signer_title: string     // e.g. "Chief Executive Officer"
  left_signer_org: string       // e.g. "UnSkills FuturePath Tech Pvt. Ltd."
  left_signature_url: string    // base64 data URL
  right_signer_name: string     // optional second signer (e.g. Controller of Exams)
  right_signer_title: string
  right_signature_url: string
  grading_scheme_json: string   // JSON-encoded GradeBand[]
  notes: string                 // optional footer note on the PDF
}

const KEYS: Record<keyof MarksheetSettings, string> = {
  header_title:        'marksheet_header_title',
  header_subtitle:     'marksheet_header_subtitle',
  header_tagline:      'marksheet_header_tagline',
  reg_line:            'marksheet_reg_line',
  iso_line:            'marksheet_iso_line',
  footer_address:      'marksheet_footer_address',
  website:             'marksheet_website',
  email:               'marksheet_email',
  left_signer_name:    'marksheet_left_signer_name',
  left_signer_title:   'marksheet_left_signer_title',
  left_signer_org:     'marksheet_left_signer_org',
  left_signature_url:  'marksheet_left_signature_url',
  right_signer_name:   'marksheet_right_signer_name',
  right_signer_title:  'marksheet_right_signer_title',
  right_signature_url: 'marksheet_right_signature_url',
  grading_scheme_json: 'marksheet_grading_scheme_json',
  notes:               'marksheet_notes',
}

export const DEFAULT_GRADING_SCHEME: GradeBand[] = [
  { label: 'Excellent', min: 85, max: 100, grade: 'A+' },
  { label: 'Very Good', min: 75, max: 84,  grade: 'A'  },
  { label: 'Good',      min: 60, max: 74,  grade: 'B'  },
  { label: 'Pass',      min: 40, max: 59,  grade: 'C'  },
  { label: 'Fail',      min: 0,  max: 39,  grade: 'F'  },
]

export const MARKSHEET_DEFAULTS: MarksheetSettings = {
  header_title:        'UNSKILLS COMPUTER EDUCATION',
  header_subtitle:     'An ISO 9001:2015 Certified Organization',
  header_tagline:      'Run by UnSkills FuturePath Tech Pvt. Ltd.\nAlliance with Skill India, MSME, NSDC, etc.',
  reg_line:            'Registered under Company Act 2013',
  iso_line:            'ISO 9001:2015\nCertified',
  footer_address:      'Nomlarr Sector Noida, UnSkills FuturePath Tech Pvt. Ltd.',
  website:             'www.skils.com',
  email:               'unfo@skils.com',
  left_signer_name:    'Er. Ankit Vishwakarma',
  left_signer_title:   'Chief Executive Officer',
  left_signer_org:     'UnSkills FuturePath Tech Pvt. Ltd.',
  left_signature_url:  '',
  right_signer_name:   '',
  right_signer_title:  '',
  right_signature_url: '',
  grading_scheme_json: JSON.stringify(DEFAULT_GRADING_SCHEME),
  notes:               '',
}

export async function getMarksheetSettings(): Promise<MarksheetSettings> {
  const keys = Object.values(KEYS)
  const { data, error } = await supabase.from('uce_site_settings').select('key, value').in('key', keys)
  if (error || !data) return MARKSHEET_DEFAULTS
  const map = new Map<string, string>(data.map(r => [r.key as string, (r.value as string) ?? '']))
  const out = { ...MARKSHEET_DEFAULTS }
  ;(Object.keys(KEYS) as (keyof MarksheetSettings)[]).forEach(k => {
    const v = map.get(KEYS[k])
    if (v !== undefined && v !== '') out[k] = v
  })
  return out
}

export async function saveMarksheetSettings(s: MarksheetSettings): Promise<void> {
  const rows = (Object.keys(KEYS) as (keyof MarksheetSettings)[]).map(k => ({ key: KEYS[k], value: s[k] }))
  const { error } = await supabase.from('uce_site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

export function parseGradingScheme(json: string): GradeBand[] {
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed) && parsed.every(b => typeof b?.min === 'number' && typeof b?.max === 'number' && typeof b?.grade === 'string')) {
      return parsed as GradeBand[]
    }
  } catch { /* fall through */ }
  return DEFAULT_GRADING_SCHEME
}

export function resolveGrade(percentage: number, bands: GradeBand[]): { grade: string; label: string; isPass: boolean } {
  const pct = Math.max(0, Math.min(100, percentage))
  const band = bands.find(b => pct >= b.min && pct <= b.max)
  if (!band) return { grade: 'F', label: 'Fail', isPass: false }
  const isPass = band.label.toLowerCase() !== 'fail' && band.grade.toUpperCase() !== 'F'
  return { grade: band.grade, label: band.label, isPass }
}
