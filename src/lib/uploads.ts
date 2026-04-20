/**
 * Centralised file-upload helpers.
 *
 * All uploads go to Cloudflare R2 via the `r2-upload` Supabase Edge Function.
 * The bucket/path scheme is preserved: key = `{bucket}/{path}` so folder
 * structure stays identical to the old Supabase Storage layout.
 *
 * Call-sites are unchanged — they still call uploadPublicFile(bucket, path, file).
 */
import { supabase } from './supabase'

export const STORAGE_BUCKETS = {
  studentPhotos: 'student-photos',
  avatars:       'avatars',
  branchAssets:  'branch-assets',
  employees:     'employee-files',
  examAssets:    'exam-assets',
  expenses:      'expense-receipts',
  studyMaterials:'study-materials',
  website:       'website-assets',
  documents:     'documents',
  certificateAssets: 'certificate-assets',
  promotions:    'promotions',
  walletRequests:'wallet-requests',
} as const

/** Upload a file to Cloudflare R2 and return its PUBLIC URL. Throws on failure. */
export async function uploadPublicFile(
  bucket: string,
  path: string,
  file: File,
  _opts: { upsert?: boolean } = {}
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const key = `${bucket}/${path}`
  const form = new FormData()
  form.append('file', file)
  form.append('key', key)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${supabaseUrl}/functions/v1/r2-upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Upload to R2 failed (${res.status}): ${body}`)
  }

  const json = await res.json() as { url?: string; error?: string }
  if (!json.url) throw new Error(`Upload to R2 failed: ${json.error ?? 'no url returned'}`)
  return json.url
}

/** True if the URL is a transient in-memory blob (unsafe to persist). */
export function isBlobUrl(u: string | null | undefined): boolean {
  return !!u && u.startsWith('blob:')
}
