import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Trash2, Eye, EyeOff, Loader2, Plus, X, FileText, BookOpen, ClipboardList, FileCheck, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, deletePublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import FormField, { inputClass } from '../../components/FormField'

type Category = 'student_material' | 'forms' | 'course_detail' | 'student_document'

interface DownloadItem {
  id: string
  title: string
  description: string | null
  category: Category
  file_url: string
  file_name: string
  file_size: number
  is_published: boolean
  sort_order: number
  created_at: string
}

const CATEGORIES: { value: Category; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'student_material', label: 'Student Material', icon: BookOpen, color: 'blue' },
  { value: 'forms', label: 'Forms', icon: ClipboardList, color: 'green' },
  { value: 'course_detail', label: 'Course Detail', icon: FileText, color: 'purple' },
  { value: 'student_document', label: 'Student Document', icon: FileCheck, color: 'amber' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c])) as Record<Category, typeof CATEGORIES[0]>

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DownloadCenterPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<DownloadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState<Category>('student_material')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formUploading, setFormUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('uce_download_center')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Failed to load documents'); setLoading(false); return }
    setItems((data ?? []) as DownloadItem[])
    setLoading(false)
  }

  function openModal() {
    setFormTitle(''); setFormDesc(''); setFormCategory('student_material'); setFormFile(null)
    setModalOpen(true)
  }

  async function handleUpload() {
    if (!formTitle.trim()) { toast.error('Title is required'); return }
    if (!formFile) { toast.error('Please select a file to upload'); return }

    setFormUploading(true)
    try {
      const safeName = formFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${formCategory}/${Date.now()}_${safeName}`
      const fileUrl = await uploadPublicFile(STORAGE_BUCKETS.documents, path, formFile)

      const { error } = await supabase.from('uce_download_center').insert({
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        category: formCategory,
        file_url: fileUrl,
        file_name: formFile.name,
        file_size: formFile.size,
        is_published: false,
        sort_order: items.length,
        created_by: user?.id || null,
      })
      if (error) { await deletePublicFile(fileUrl); throw error }
      toast.success('Document uploaded successfully')
      setModalOpen(false)
      fetchItems()
    } catch (err) {
      console.error(err); toast.error('Upload failed')
    } finally {
      setFormUploading(false)
    }
  }

  async function togglePublish(item: DownloadItem) {
    setToggling(item.id)
    const { error } = await supabase
      .from('uce_download_center')
      .update({ is_published: !item.is_published, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) { toast.error('Failed to update'); setToggling(null); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_published: !i.is_published } : i))
    toast.success(item.is_published ? 'Unpublished' : 'Published to website')
    setToggling(null)
  }

  async function handleDelete() {
    if (!deleteId) return
    const item = items.find(i => i.id === deleteId)
    if (!item) return
    setDeleteLoading(true)
    try {
      await deletePublicFile(item.file_url)
      const { error } = await supabase.from('uce_download_center').delete().eq('id', deleteId)
      if (error) throw error
      setItems(prev => prev.filter(i => i.id !== deleteId))
      toast.success('Document deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleteLoading(false); setDeleteId(null) }
  }

  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.value, items.filter(i => i.category === c.value).length])) as Record<Category, number>

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <Download size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Download Center</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage documents visible on the public website</p>
          </div>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"
        >
          <Plus size={16} /> Upload Document
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
            activeCategory === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          All ({items.length})
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                activeCategory === cat.value
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              <Icon size={14} />
              {cat.label} ({counts[cat.value]})
            </button>
          )
        })}
      </div>

      {/* Document list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Download size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No documents yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Upload Document" to add your first file.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(item => {
              const cat = CATEGORY_MAP[item.category]
              const Icon = cat.icon
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 group">
                  <GripVertical size={16} className="text-gray-300 shrink-0" />
                  <div className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                    cat.color === 'blue' && 'bg-blue-50',
                    cat.color === 'green' && 'bg-green-50',
                    cat.color === 'purple' && 'bg-purple-50',
                    cat.color === 'amber' && 'bg-amber-50',
                  )}>
                    <Icon size={16} className={cn(
                      cat.color === 'blue' && 'text-blue-600',
                      cat.color === 'green' && 'text-green-600',
                      cat.color === 'purple' && 'text-purple-600',
                      cat.color === 'amber' && 'text-amber-600',
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400">{cat.label}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400">{item.file_name}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400">{formatBytes(item.file_size)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      item.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </span>
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Preview"
                    >
                      <Download size={15} />
                    </a>
                    <button
                      onClick={() => togglePublish(item)}
                      disabled={toggling === item.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                      title={item.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {toggling === item.id ? <Loader2 size={15} className="animate-spin" /> : item.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload Document" size="sm">
        <div className="space-y-4">
          <FormField label="Title" required>
            <input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Student ID Card Application Form"
            />
          </FormField>
          <FormField label="Description" hint="Optional short description shown on website">
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="Optional description"
            />
          </FormField>
          <FormField label="Category" required>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                return (
                  <label key={cat.value} className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm',
                    formCategory === cat.value ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  )}>
                    <input type="radio" name="formCategory" value={cat.value}
                      checked={formCategory === cat.value}
                      onChange={() => setFormCategory(cat.value)}
                      className="accent-red-600" />
                    <Icon size={14} />
                    <span className="font-medium text-xs">{cat.label}</span>
                  </label>
                )
              })}
            </div>
          </FormField>
          <FormField label="File" required hint="PDF, DOC, DOCX, JPG, PNG — max 10 MB">
            {formFile ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <FileText size={16} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{formFile.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(formFile.size)}</p>
                </div>
                <button onClick={() => { setFormFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-gray-400 hover:bg-gray-50">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-gray-500 text-center">Click to select a file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 10 * 1024 * 1024) { toast.error('Max file size is 10 MB'); return } setFormFile(f) } }}
                />
              </label>
            )}
          </FormField>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleUpload}
              disabled={formUploading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {formUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload</>}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete document?"
        message="This will permanently delete the file from storage and remove it from the website. This cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  )
}
