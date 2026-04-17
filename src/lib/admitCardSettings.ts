import { supabase } from './supabase'

export interface AdmitCardSettings {
  header_title: string       // e.g. "UNSKILLS COMPUTER EDUCATION"
  header_subtitle: string    // e.g. "A Unit of: UnSkills FuturePath Tech Pvt. Ltd."
  header_tagline: string     // certifications line under subtitle
  header_strip: string       // bottom strip e.g. "Skill Development | Computer Education | Vocational Training"
  iso_line: string           // top-right ISO block text
  footer_address: string     // corporate office address in red footer
  website: string            // e.g. "www.unskillsc.org"
  left_signer: string        // e.g. "Controller of Examination"
  right_signer: string       // e.g. "Director"
  controller_signature_url: string  // base64 data URL of controller signature image
  director_signature_url: string    // base64 data URL of director signature image
  instructions_en: string    // English header line for instructions section
  instructions_hi: string    // Multi-line Hindi terms & conditions
}

const KEYS: Record<keyof AdmitCardSettings, string> = {
  header_title:              'admit_header_title',
  header_subtitle:           'admit_header_subtitle',
  header_tagline:            'admit_header_tagline',
  header_strip:              'admit_header_strip',
  iso_line:                  'admit_iso_line',
  footer_address:            'admit_footer_address',
  website:                   'admit_website',
  left_signer:               'admit_left_signer',
  right_signer:              'admit_right_signer',
  controller_signature_url:  'admit_controller_signature_url',
  director_signature_url:    'admit_director_signature_url',
  instructions_en:           'admit_instructions_en',
  instructions_hi:           'admit_instructions_hi',
}

export const ADMIT_DEFAULTS: AdmitCardSettings = {
  header_title:             'UNSKILLS COMPUTER EDUCATION',
  header_subtitle:          'A Unit of: UnSkills FuturePath Tech Pvt. Ltd.',
  header_tagline:           'ISO 9001:2015 Certified | Govt. Registered Organization | Authorized Training & Certification Body',
  header_strip:             'Skill Development  |  Computer Education  |  Vocational Training',
  iso_line:                 'ISO 9001:2015\nCertified',
  footer_address:           '2nd Floor Near Primary School Ranipur Road Mariahu Jaunpur Uttar Pradesh',
  website:                  'www.unskillsc.org',
  left_signer:              'Controller of Examination',
  right_signer:             'Director',
  controller_signature_url: '',
  director_signature_url:   '',
  instructions_en: 'INSTRUCTIONS TO BE FOLLOWED BY CANDIDATES AT EXAMINATION',
  instructions_hi: [
    '1. उम्मीदवारों को परीक्षा कक्ष में परीक्षा प्रारंभ होने के 15 मिनट पहले प्रवेश दिया जाएगा। परीक्षा शुरू होने के 30 मिनट बाद किसी भी उम्मीदवार को प्रवेश की अनुमति नहीं दी जाएगी।',
    '2. परीक्षा केंद्र पर उम्मीदवारों को केवल Institute द्वारा जारी प्रवेश पत्र, मूल फोटो पहचान पत्र एवं पेन लाने की अनुमति है।',
    '3. परीक्षा कक्ष में मोबाइल फोन या कोई भी इलेक्ट्रॉनिक उपकरण लाना पूरी तरह से प्रतिबंधित है।',
    '   • यदि किसी उम्मीदवार के पास ऐसा कोई उपकरण पाया गया, तो उसे जब्त कर लिया जाएगा।',
    '   • कोई पॉकेटबुक, हैंडबैग, पुस्तकें, नोट्स, लिखित या मुद्रित सामग्री, सीडी या डेटा नहीं लाया जा सकता।',
    '   • यदि ऐसी कोई वस्तु पाई गई, तो उसे भी जब्त कर लिया जाएगा।',
    '4. उम्मीदवारों को परीक्षा के दौरान कंप्यूटर प्रणाली को ध्यानपूर्वक और सावधानीपूर्वक संचालित करना होगा। किसी भी प्रकार की छेड़छाड़ या गलत संचालन पाए जाने पर परीक्षा रद्द की जा सकती है।',
    '5. किसी भी तकनीकी समस्या (जैसे: सिस्टम हैंग, नेटवर्क इश्यू आदि) की स्थिति में तुरंत परीक्षा पर्यवेक्षक को सूचित करें। स्वयं समाधान का प्रयास न करें।',
  ].join('\n'),
}

export async function getAdmitCardSettings(): Promise<AdmitCardSettings> {
  const keys = Object.values(KEYS)
  const { data, error } = await supabase.from('uce_site_settings').select('key, value').in('key', keys)
  if (error || !data) return ADMIT_DEFAULTS
  const map = new Map<string, string>(data.map(r => [r.key as string, (r.value as string) ?? '']))
  const out = { ...ADMIT_DEFAULTS }
  ;(Object.keys(KEYS) as (keyof AdmitCardSettings)[]).forEach(k => {
    const v = map.get(KEYS[k])
    if (v) out[k] = v
  })
  return out
}

export async function saveAdmitCardSettings(s: AdmitCardSettings): Promise<void> {
  const rows = (Object.keys(KEYS) as (keyof AdmitCardSettings)[]).map(k => ({ key: KEYS[k], value: s[k] }))
  const { error } = await supabase.from('uce_site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}
