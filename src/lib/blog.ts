import { supabase } from './supabase'
import { uploadPublicFile, STORAGE_BUCKETS } from './uploads'

export type BlogBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string; align?: 'left' | 'center' }
  | { type: 'image'; url: string; alt?: string; caption?: string }
  | { type: 'list'; style: 'bullet' | 'number'; items: string[] }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'divider' }
  | { type: 'code'; lang?: string; code: string }

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface BlogRow {
  id: string
  category_id: string | null
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  content: BlogBlock[]
  author_name: string | null
  read_minutes: number
  is_featured: boolean
  is_published: boolean
  published_at: string | null
  view_count: number
  seo_title: string | null
  seo_description: string | null
  created_at: string
  updated_at: string
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function ensureUniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const candidate = base || 'post'
  for (let i = 0; i < 30; i++) {
    const slug = i === 0 ? candidate : `${candidate}-${i + 1}`
    let q = supabase.from('uce_blogs').select('id').eq('slug', slug).limit(1)
    if (ignoreId) q = q.neq('id', ignoreId)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) return slug
  }
  return `${candidate}-${Date.now()}`
}

export function estimateReadMinutes(blocks: BlogBlock[]): number {
  let words = 0
  for (const b of blocks) {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
      words += b.text.trim().split(/\s+/).filter(Boolean).length
    } else if (b.type === 'list') {
      for (const it of b.items) words += it.trim().split(/\s+/).filter(Boolean).length
    } else if (b.type === 'code') {
      words += b.code.trim().split(/\s+/).filter(Boolean).length
    }
  }
  return Math.max(1, Math.round(words / 200))
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Only image files are allowed'
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be 2 MB or smaller'
  return null
}

export async function uploadBlogImage(file: File, prefix: 'cover' | 'inline'): Promise<string> {
  const err = validateImageFile(file)
  if (err) throw new Error(err)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const safeExt = ext || 'jpg'
  const path = `blog/${prefix}/${crypto.randomUUID()}.${safeExt}`
  return uploadPublicFile(STORAGE_BUCKETS.website, path, file)
}
