/**
 * Centralised file-upload helpers.
 *
 * Keeps bucket names in ONE place so we never drift again (e.g. we had
 * `uce-student-photos` in code while the actual bucket is
 * `student-photos`, which silently failed uploads and caused blob URLs
 * to be stored as `photo_url`).
 *
 * When we switch to Cloudflare R2, this file is the only place that
 * changes — call-sites stay the same.
 */
import { supabase } from './supabase'

export const STORAGE_BUCKETS = {
  studentPhotos: 'student-photos',
  avatars:       'avatars',        // director / staff / user avatars
  branchAssets:  'branch-assets',  // logos, other branch files
  employees:     'employee-files',
  examAssets:    'exam-assets',
  expenses:      'expense-receipts',
  studyMaterials:'study-materials',
  website:       'website-assets',
  documents:     'documents',      // generic public docs (syllabus, etc.)
} as const

/** Upload a file and return its PUBLIC URL. Throws on any failure. */
export async function uploadPublicFile(
  bucket: string,
  path: string,
  file: File,
  opts: { upsert?: boolean } = {}
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: opts.upsert ?? true,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) {
    // Surface the real reason so users/devs can fix it instead of silently
    // storing a blob: URL that vanishes on navigation.
    throw new Error(`Upload to ${bucket} failed: ${error.message}`)
  }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

/** True if the URL is a transient in-memory blob (unsafe to persist). */
export function isBlobUrl(u: string | null | undefined): boolean {
  return !!u && u.startsWith('blob:')
}
