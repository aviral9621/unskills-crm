import { useEffect, useState } from 'react'
import { Newspaper, Plus, Trash2, Power, Pencil, FileText, Calendar, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import { formatDate } from '../../lib/utils'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

type Category = 'announcement' | 'campus_news' | 'examination' | 'notice' | 'event'

interface Newsletter {
  id: string; title: string; content: string | null; pdf_url: string | null
  publish_date: string; is_published: boolean; created_at: string
  category: Category
}

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'campus_news',  label: 'Campus News' },
  { value: 'examination',  label: 'Examination' },
  { value: 'notice',       label: 'Notice' },
  { value: 'event',        label: 'Event' },
]

const CATEGORY_LABELS: Record<Category, string> = {
  announcement: 'Announcement',
  campus_news:  'Campus News',
  examination:  'Examination',
  notice:       'Notice',
  event:        'Event',
}

export default function NewsletterPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '', category: 'announcement' as Category, pdf: null as File | null, pdfName: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Newsletter | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [previewItem, setPreviewItem] = useState<Newsletter | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_newsletters').select('*').order('publish_date', { ascending: false })
      if (error) throw error
      setItems(data ?? [])
    } catch { toast.error('Failed to load newsletters') }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title is required'); return }
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
      setShowModal(false); setEditId(null); setForm({ title: '', content: '', category: 'announcement', pdf: null, pdfName: '' })
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

  function openEdit(n: Newsletter) {
    setEditId(n.id); setForm({ title: n.title, content: n.content || '', category: n.category ?? 'announcement', pdf: null, pdfName: '' }); setShowModal(true)
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max size: 5MB'); return }
    setForm(p => ({ ...p, pdf: file, pdfName: file.name }))
  }

  const published = items.filter(n => n.is_published).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Newsletters & Updates</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{items.length} total, {published} published on website</p></div>
        <button onClick={() => { setEditId(null); setForm({ title: '', content: '', category: 'announcement', pdf: null, pdfName: '' }); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Update</button>
      </div>

      {/* List */}
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-semibold uppercase tracking-wide">{CATEGORY_LABELS[item.category ?? 'announcement']}</span>
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
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as Category }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none bg-white">
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Publish'}</button>
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

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Newsletter?" message={`Remove "${deleteTarget?.title}" permanently?`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
