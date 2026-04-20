import { useEffect, useState } from 'react'
import { Newspaper, Plus, Trash2, Power, Pencil, FileText, Calendar, Eye, Tag, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import { formatDate } from '../../lib/utils'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Category {
  id: string; slug: string; name: string; sort_order: number; is_active: boolean
}

interface Newsletter {
  id: string; title: string; content: string | null; pdf_url: string | null
  publish_date: string; is_published: boolean; created_at: string
  category: string | null
}

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'category'
}

export default function NewsletterPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Newsletter[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '', category: '', pdf: null as File | null, pdfName: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Newsletter | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<Newsletter | null>(null)

  // Category manager
  const [showCatModal, setShowCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [nls, cats] = await Promise.all([
        supabase.from('uce_newsletters').select('*').order('publish_date', { ascending: false }),
        supabase.from('uce_newsletter_categories').select('*').order('sort_order').order('name'),
      ])
      if (nls.error) throw nls.error
      if (cats.error) throw cats.error
      setItems(nls.data ?? [])
      setCategories(cats.data ?? [])
    } catch { toast.error('Failed to load newsletters') }
    finally { setLoading(false) }
  }

  const activeCats = categories.filter(c => c.is_active)
  const categoryName = (slug: string | null | undefined) =>
    categories.find(c => c.slug === slug)?.name ?? slug ?? '—'

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.category) { toast.error('Select a category'); return }
    setSaving(true)
    try {
      let pdfUrl: string | null = null
      if (form.pdf) {
        const ext = form.pdf.name.split('.').pop() || 'pdf'
        const path = `newsletters/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        pdfUrl = await uploadPublicFile(STORAGE_BUCKETS.documents, path, form.pdf)
      }

      const payload: Record<string, unknown> = {
        title: form.title.trim(), content: form.content.trim() || null,
        category: form.category,
        publish_date: new Date().toISOString().split('T')[0], created_by: user?.id,
      }
      if (pdfUrl) payload.pdf_url = pdfUrl

      if (editId) {
        const { error } = await supabase.from('uce_newsletters').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Newsletter updated')
      } else {
        const { error } = await supabase.from('uce_newsletters').insert(payload)
        if (error) throw error
        toast.success('Newsletter added')
      }
      setShowModal(false); setEditId(null)
      setForm({ title: '', content: '', category: activeCats[0]?.slug ?? '', pdf: null, pdfName: '' })
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  async function togglePublished(item: Newsletter) {
    try {
      const { error } = await supabase.from('uce_newsletters').update({ is_published: !item.is_published }).eq('id', item.id)
      if (error) throw error
      setItems(p => p.map(n => n.id === item.id ? { ...n, is_published: !n.is_published } : n))
      toast.success(item.is_published ? 'Unpublished' : 'Published')
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_newsletters').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setItems(p => p.filter(n => n.id !== deleteTarget.id))
      toast.success('Newsletter deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  function openAdd() {
    if (activeCats.length === 0) { toast.error('Create a category first'); setShowCatModal(true); return }
    setEditId(null)
    setForm({ title: '', content: '', category: activeCats[0].slug, pdf: null, pdfName: '' })
    setShowModal(true)
  }

  function openEdit(n: Newsletter) {
    setEditId(n.id)
    setForm({ title: n.title, content: n.content || '', category: n.category ?? (activeCats[0]?.slug ?? ''), pdf: null, pdfName: '' })
    setShowModal(true)
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max size: 5MB'); return }
    setForm(p => ({ ...p, pdf: file, pdfName: file.name }))
  }

  // Category CRUD
  async function addCategory() {
    const name = newCatName.trim()
    if (!name) return
    const slug = toSlug(name)
    if (categories.some(c => c.slug === slug)) { toast.error('Category already exists'); return }
    setCatSaving(true)
    const nextOrder = (categories[categories.length - 1]?.sort_order ?? 0) + 10
    const { data, error } = await supabase.from('uce_newsletter_categories').insert({
      slug, name, sort_order: nextOrder, is_active: true,
    }).select().single()
    setCatSaving(false)
    if (error) { toast.error(error.message); return }
    setCategories(p => [...p, data as Category])
    setNewCatName('')
    toast.success('Category added')
  }

  async function toggleCatActive(c: Category) {
    const { error } = await supabase.from('uce_newsletter_categories').update({ is_active: !c.is_active }).eq('id', c.id)
    if (error) { toast.error(error.message); return }
    setCategories(p => p.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function moveCategory(c: Category, dir: -1 | 1) {
    const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order)
    const idx = ordered.findIndex(x => x.id === c.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= ordered.length) return
    const other = ordered[swapIdx]
    const updates = [
      supabase.from('uce_newsletter_categories').update({ sort_order: other.sort_order }).eq('id', c.id),
      supabase.from('uce_newsletter_categories').update({ sort_order: c.sort_order }).eq('id', other.id),
    ]
    await Promise.all(updates)
    setCategories(p => p.map(x => {
      if (x.id === c.id) return { ...x, sort_order: other.sort_order }
      if (x.id === other.id) return { ...x, sort_order: c.sort_order }
      return x
    }))
  }

  async function confirmDeleteCategory() {
    if (!deleteCat) return
    const count = items.filter(i => i.category === deleteCat.slug).length
    if (count > 0) { toast.error(`Cannot delete: ${count} newsletter(s) use this category`); setDeleteCat(null); return }
    const { error } = await supabase.from('uce_newsletter_categories').delete().eq('id', deleteCat.id)
    if (error) { toast.error(error.message); return }
    setCategories(p => p.filter(x => x.id !== deleteCat.id))
    setDeleteCat(null)
    toast.success('Category deleted')
  }

  const published = items.filter(n => n.is_published).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Newsletters & Updates</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{items.length} total, {published} published on website</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCatModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 shrink-0">
            <Tag size={14} /> Categories
          </button>
          <button onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
            <Plus size={16} /> Add Update
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Newspaper size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No newsletters yet. Add your first update.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={`bg-white rounded-xl border border-gray-200 p-4 ${!item.is_published ? 'opacity-60' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Newspaper size={18} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h3>
                      {item.content && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.content}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${item.is_published ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.is_published ? 'Published' : 'Draft'}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-semibold uppercase tracking-wide">{categoryName(item.category)}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(item.publish_date)}</span>
                    {item.pdf_url && (
                      <a href={item.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-500 hover:text-red-600">
                        <FileText size={11} /> PDF Attachment
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <button onClick={() => setPreviewItem(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Eye size={14} /></button>
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
                    <button onClick={() => togglePublished(item)} className={`p-1.5 rounded-lg ${item.is_published ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}><Power size={14} /></button>
                    <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Newsletter' : 'Add Newsletter'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white">
              {activeCats.length === 0 && <option value="">No categories — create one first</option>}
              {activeCats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            {activeCats.length === 0 && (
              <button type="button" onClick={() => { setShowModal(false); setShowCatModal(true) }} className="mt-1.5 text-xs text-red-600 hover:underline">
                Manage categories →
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Newsletter title..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={5} placeholder="Write the newsletter content..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PDF Attachment (optional)</label>
            {form.pdfName ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileText size={16} className="text-red-500" />
                <span className="text-sm text-gray-700 flex-1 truncate">{form.pdfName}</span>
                <button onClick={() => setForm(p => ({ ...p, pdf: null, pdfName: '' }))} className="text-xs text-red-500 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-red-400 transition">
                <div className="text-center"><FileText size={20} className="mx-auto text-gray-400 mb-1" /><span className="text-xs text-gray-500">Click to attach PDF (max 5MB)</span></div>
                <input type="file" accept=".pdf" onChange={handlePdfChange} className="hidden" />
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving || activeCats.length === 0} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Publish'}</button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!previewItem} onClose={() => setPreviewItem(null)} title={previewItem?.title || ''} size="lg">
        <div>
          <p className="text-xs text-gray-400 mb-3">{previewItem?.publish_date ? formatDate(previewItem.publish_date) : ''}</p>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{previewItem?.content || 'No content'}</div>
          {previewItem?.pdf_url && (
            <a href={previewItem.pdf_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
              <FileText size={14} /> Download PDF
            </a>
          )}
        </div>
      </Modal>

      {/* Category Manager Modal */}
      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title="Manage Categories" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add category</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                placeholder="e.g. Scholarships"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
              />
              <button onClick={addCategory} disabled={catSaving || !newCatName.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {catSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Slug auto-generated from name. Duplicates not allowed.</p>
          </div>

          <div className="border rounded-lg divide-y divide-gray-100">
            {categories.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">No categories yet. Add one above.</div>
            )}
            {categories.sort((a, b) => a.sort_order - b.sort_order).map((c, idx, arr) => {
              const count = items.filter(i => i.category === c.slug).length
              return (
                <div key={c.id} className={`flex items-center gap-2 px-3 py-2.5 ${!c.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col">
                    <button disabled={idx === 0} onClick={() => moveCategory(c, -1)} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ArrowUp size={12} /></button>
                    <button disabled={idx === arr.length - 1} onClick={() => moveCategory(c, 1)} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"><ArrowDown size={12} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{c.slug} · {count} {count === 1 ? 'item' : 'items'}</p>
                  </div>
                  <button onClick={() => toggleCatActive(c)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.is_active ? 'Active' : 'Hidden'}
                  </button>
                  <button onClick={() => setDeleteCat(c)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={() => setShowCatModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Close</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Newsletter?" message={`Remove "${deleteTarget?.title}" permanently?`}
        confirmText="Delete" variant="danger" loading={deleting} />

      <ConfirmDialog open={!!deleteCat} onClose={() => setDeleteCat(null)} onConfirm={confirmDeleteCategory}
        title="Delete category?" message={`Remove "${deleteCat?.name}"? Newsletters using it must be reassigned first.`}
        confirmText="Delete" variant="danger" />
    </div>
  )
}
