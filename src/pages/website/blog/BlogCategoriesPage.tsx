import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tag, Power } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { slugify, type BlogCategory } from '../../../lib/blog'
import Modal from '../../../components/Modal'
import ConfirmDialog from '../../../components/ConfirmDialog'

interface FormState {
  name: string
  slug: string
  description: string
  sort_order: number
  is_active: boolean
}

const EMPTY_FORM: FormState = { name: '', slug: '', description: '', sort_order: 0, is_active: true }

export default function BlogCategoriesPage() {
  const [items, setItems] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<BlogCategory | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BlogCategory | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_blog_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      setItems((data ?? []) as BlogCategory[])
    } catch { toast.error('Failed to load categories') }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, sort_order: items.length })
    setSlugTouched(false)
    setShowModal(true)
  }

  function openEdit(c: BlogCategory) {
    setEditTarget(c)
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      sort_order: c.sort_order,
      is_active: c.is_active,
    })
    setSlugTouched(true)
    setShowModal(true)
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) { toast.error('Name is required'); return }
    const slug = (form.slug.trim() || slugify(name))
    if (!slug) { toast.error('Invalid slug'); return }

    setSaving(true)
    try {
      const payload = {
        name,
        slug,
        description: form.description.trim() || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
      }
      if (editTarget) {
        const { error } = await supabase.from('uce_blog_categories').update(payload).eq('id', editTarget.id)
        if (error) throw error
        toast.success('Category updated')
      } else {
        const { error } = await supabase.from('uce_blog_categories').insert(payload)
        if (error) throw error
        toast.success('Category added')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function toggleActive(c: BlogCategory) {
    try {
      const { error } = await supabase.from('uce_blog_categories').update({ is_active: !c.is_active }).eq('id', c.id)
      if (error) throw error
      setItems(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_blog_categories').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Deleted')
      setDeleteTarget(null)
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <Tag size={20} className="text-red-600" /> Blog Categories
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize blog posts into categories that filter on the public website</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {[1, 2, 3].map(i => (
            <div key={i} className="px-5 py-4">
              <div className="h-3.5 bg-gray-200 rounded animate-pulse w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Tag size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No categories yet</p>
          <p className="text-sm mt-1">Create one to start grouping your blog posts</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Slug</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{c.name}</td>
                  <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell font-mono text-xs">{c.slug}</td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell line-clamp-1">{c.description || <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.sort_order}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => toggleActive(c)} className={`p-1.5 rounded-lg transition-colors ${c.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`} title={c.is_active ? 'Hide' : 'Activate'}>
                        <Power size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
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

      {showModal && (
        <Modal open={showModal} title={editTarget ? 'Edit Category' : 'Add Category'} onClose={() => setShowModal(false)}>
          <div className="space-y-4 p-1">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Name *</label>
              <input
                value={form.name}
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({
                    ...p,
                    name: v,
                    slug: slugTouched ? p.slug : slugify(v),
                  }))
                }}
                placeholder="e.g. Tutorials"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Slug *</label>
              <input
                value={form.slug}
                onChange={e => { setSlugTouched(true); setForm(p => ({ ...p, slug: slugify(e.target.value) })) }}
                placeholder="tutorials"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Used in the URL: /blog/category/{form.slug || 'your-slug'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Optional short blurb shown on the category page"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {editTarget ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? Posts in this category will keep their content but lose the category link.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
