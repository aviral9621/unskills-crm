import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, Loader2, Save, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import {
  ensureUniqueSlug,
  estimateReadMinutes,
  slugify,
  uploadBlogImage,
  validateImageFile,
  type BlogBlock,
  type BlogCategory,
  type BlogRow,
} from '../../../lib/blog'
import BlogBlocksEditor from './BlogBlocksEditor'

interface FormState {
  title: string
  slug: string
  category_id: string
  excerpt: string
  cover_image_url: string
  blocks: BlogBlock[]
  author_name: string
  is_featured: boolean
  is_published: boolean
  seo_title: string
  seo_description: string
}

const EMPTY: FormState = {
  title: '', slug: '', category_id: '', excerpt: '', cover_image_url: '',
  blocks: [], author_name: '', is_featured: false, is_published: false,
  seo_title: '', seo_description: '',
}

export default function BlogFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const nav = useNavigate()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [original, setOriginal] = useState<BlogRow | null>(null)

  useEffect(() => {
    supabase.from('uce_blog_categories').select('*').order('sort_order').order('name').then(({ data }) => {
      setCategories((data ?? []) as BlogCategory[])
    })
  }, [])

  useEffect(() => {
    if (!isEdit || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('uce_blogs').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        if (!data) { toast.error('Blog post not found'); nav('/admin/website/blogs'); return }
        if (cancelled) return
        const row = data as BlogRow
        setOriginal(row)
        setForm({
          title: row.title,
          slug: row.slug,
          category_id: row.category_id ?? '',
          excerpt: row.excerpt ?? '',
          cover_image_url: row.cover_image_url ?? '',
          blocks: Array.isArray(row.content) ? row.content : [],
          author_name: row.author_name ?? '',
          is_featured: row.is_featured,
          is_published: row.is_published,
          seo_title: row.seo_title ?? '',
          seo_description: row.seo_description ?? '',
        })
        setSlugTouched(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load post')
        nav('/admin/website/blogs')
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id, isEdit, nav])

  const readMinutes = useMemo(() => estimateReadMinutes(form.blocks), [form.blocks])

  async function handleCoverUpload(file: File | null) {
    if (!file) return
    const err = validateImageFile(file)
    if (err) { toast.error(err); return }
    setCoverUploading(true)
    try {
      const url = await uploadBlogImage(file, 'cover')
      setForm(p => ({ ...p, cover_image_url: url }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cover upload failed')
    } finally { setCoverUploading(false) }
  }

  async function save(publish: boolean | null = null) {
    const title = form.title.trim()
    if (!title) { toast.error('Title is required'); return }
    if (form.blocks.length === 0) { toast.error('Add at least one content block'); return }

    const wantsPublish = publish === null ? form.is_published : publish

    setSaving(true)
    try {
      const baseSlug = form.slug.trim() ? slugify(form.slug) : slugify(title)
      const finalSlug = isEdit && original?.slug === baseSlug ? baseSlug : await ensureUniqueSlug(baseSlug, id)

      const payload = {
        title,
        slug: finalSlug,
        category_id: form.category_id || null,
        excerpt: form.excerpt.trim() || null,
        cover_image_url: form.cover_image_url || null,
        content: form.blocks,
        author_name: form.author_name.trim() || null,
        read_minutes: estimateReadMinutes(form.blocks),
        is_featured: form.is_featured,
        is_published: wantsPublish,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        published_at:
          wantsPublish && !original?.published_at
            ? new Date().toISOString()
            : original?.published_at ?? null,
      }

      if (isEdit && id) {
        const { error } = await supabase.from('uce_blogs').update(payload).eq('id', id)
        if (error) throw error
        toast.success(wantsPublish ? 'Saved & published' : 'Saved')
      } else {
        const { error } = await supabase.from('uce_blogs').insert(payload)
        if (error) throw error
        toast.success(wantsPublish ? 'Created & published' : 'Draft created')
      }
      nav('/admin/website/blogs')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/admin/website/blogs')} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100" title="Back">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit Blog Post' : 'New Blog Post'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            <EyeOff size={15} /> Save as Draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
            Publish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Title *</label>
              <input
                value={form.title}
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({ ...p, title: v, slug: slugTouched ? p.slug : slugify(v) }))
                }}
                placeholder="A great post title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg font-semibold focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">URL Slug</label>
              <input
                value={form.slug}
                onChange={e => { setSlugTouched(true); setForm(p => ({ ...p, slug: slugify(e.target.value) })) }}
                placeholder="auto-generated"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">/blog/{form.slug || '<slug>'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={e => setForm(p => ({ ...p, excerpt: e.target.value }))}
                rows={2}
                placeholder="Short summary shown on the blog grid and in search results"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">Cover Image</label>
              {form.cover_image_url ? (
                <div className="space-y-2">
                  <img src={form.cover_image_url} alt="cover" className="max-h-64 w-full object-cover rounded-lg border border-gray-200" />
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 cursor-pointer">
                      Replace
                      <input type="file" accept="image/*" className="hidden" disabled={coverUploading} onChange={e => handleCoverUpload(e.target.files?.[0] ?? null)} />
                    </label>
                    <button onClick={() => setForm(p => ({ ...p, cover_image_url: '' }))} className="text-xs text-gray-500 hover:text-red-600">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-red-300">
                  {coverUploading ? <Loader2 size={24} className="text-red-500 animate-spin" /> : <ImageIcon size={24} className="text-gray-400" />}
                  <span className="text-sm text-gray-600">{coverUploading ? 'Uploading…' : 'Click to upload cover image'}</span>
                  <span className="text-xs text-gray-400">Recommended 1600×900 — max 2 MB</span>
                  <input type="file" accept="image/*" className="hidden" disabled={coverUploading} onChange={e => handleCoverUpload(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Content Blocks</label>
              <span className="text-xs text-gray-400">~{readMinutes} min read</span>
            </div>
            <BlogBlocksEditor blocks={form.blocks} onChange={blocks => setForm(p => ({ ...p, blocks }))} />
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Category</label>
              <select
                value={form.category_id}
                onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              >
                <option value="">— Uncategorized —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Author Name</label>
              <input
                value={form.author_name}
                onChange={e => setForm(p => ({ ...p, author_name: e.target.value }))}
                placeholder="e.g. UnSkill Team"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              Featured (highlighted on blog landing)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              Published (visible on website)
            </label>
            {original?.published_at && (
              <p className="text-xs text-gray-400">Published {new Date(original.published_at).toLocaleString()}</p>
            )}
            {original && (
              <p className="text-xs text-gray-400">{original.view_count} views</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">SEO</h3>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">SEO Title</label>
              <input
                value={form.seo_title}
                onChange={e => setForm(p => ({ ...p, seo_title: e.target.value }))}
                placeholder="Defaults to post title"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Meta Description</label>
              <textarea
                value={form.seo_description}
                onChange={e => setForm(p => ({ ...p, seo_description: e.target.value }))}
                rows={3}
                placeholder="Defaults to excerpt"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => save()}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
