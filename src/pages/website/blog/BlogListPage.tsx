import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Newspaper, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import type { BlogCategory, BlogRow } from '../../../lib/blog'
import ConfirmDialog from '../../../components/ConfirmDialog'

type Status = 'all' | 'published' | 'draft'

interface Row extends BlogRow {
  category: { id: string; name: string; slug: string } | null
}

export default function BlogListPage() {
  const nav = useNavigate()
  const [items, setItems] = useState<Row[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: posts, error: e1 }, { data: cats, error: e2 }] = await Promise.all([
        supabase
          .from('uce_blogs')
          .select('*, category:uce_blog_categories(id,name,slug)')
          .order('created_at', { ascending: false }),
        supabase.from('uce_blog_categories').select('*').order('sort_order').order('name'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setItems((posts ?? []) as Row[])
      setCategories((cats ?? []) as BlogCategory[])
    } catch { toast.error('Failed to load blogs') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(p => {
      if (status === 'published' && !p.is_published) return false
      if (status === 'draft' && p.is_published) return false
      if (categoryId !== 'all' && p.category_id !== categoryId) return false
      if (q && !p.title.toLowerCase().includes(q) && !(p.excerpt ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, status, categoryId])

  async function togglePublish(p: Row) {
    try {
      const update: Record<string, unknown> = { is_published: !p.is_published }
      if (!p.is_published && !p.published_at) update.published_at = new Date().toISOString()
      const { error } = await supabase.from('uce_blogs').update(update).eq('id', p.id)
      if (error) throw error
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, is_published: !x.is_published, published_at: x.published_at ?? (update.published_at as string | null) } : x))
      toast.success(p.is_published ? 'Unpublished' : 'Published')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed') }
  }

  async function toggleFeatured(p: Row) {
    try {
      const { error } = await supabase.from('uce_blogs').update({ is_featured: !p.is_featured }).eq('id', p.id)
      if (error) throw error
      setItems(prev => prev.map(x => x.id === p.id ? { ...x, is_featured: !x.is_featured } : x))
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_blogs').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Deleted')
      setDeleteTarget(null)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <Newspaper size={20} className="text-red-600" /> Blogs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Write, publish & manage blog posts shown on the public website</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/website/blog/categories" className="text-sm text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg px-3 py-2">
            Manage Categories
          </Link>
          <button onClick={() => nav('/admin/website/blogs/new')} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm">
            <Plus size={16} /> New Post
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title or excerpt"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
        </div>
        <div className="relative">
          <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={status}
            onChange={e => setStatus(e.target.value as Status)}
            className="pl-7 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white"
          >
            <option value="all">All status</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white"
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Newspaper size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">{items.length === 0 ? 'No blog posts yet' : 'No posts match your filters'}</p>
          {items.length === 0 && <p className="text-sm mt-1">Create your first post to get started</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Post</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Views</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.cover_image_url ? (
                        <img src={p.cover_image_url} alt="" className="w-12 h-12 rounded-lg object-cover ring-1 ring-gray-200 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 flex-shrink-0">
                          <Newspaper size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 line-clamp-1 flex items-center gap-1.5">
                          {p.title}
                          {p.is_featured && <Star size={12} className="text-amber-500 fill-amber-500" />}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{p.excerpt || <span className="text-gray-300">No excerpt</span>}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">
                    {p.category ? p.category.name : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">{p.view_count}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs hidden lg:table-cell">{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.is_featured ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                        title={p.is_featured ? 'Remove from featured' : 'Mark as featured'}
                      >
                        <Star size={15} className={p.is_featured ? 'fill-amber-500' : ''} />
                      </button>
                      <button
                        onClick={() => togglePublish(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.is_published ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        title={p.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {p.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button onClick={() => nav(`/admin/website/blogs/${p.id}/edit`)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Blog Post"
        message={`Permanently delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
