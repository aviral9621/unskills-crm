import { useEffect, useRef, useState } from 'react'
import {
  Download, Upload, Trash2, Loader2, Plus, X, FileText, BookOpen,
  ClipboardList, FileCheck, GripVertical, Settings, Pencil, Check, FolderOpen,
  Archive, Star, Tag, Globe, Award, Package, ChevronUp, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, deletePublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import FormField, { inputClass } from '../../components/FormField'

// ─── Category types ──────────────────────────────────────────────────────────

interface DownloadCategory {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  sort_order: number
}

// ─── Document types ───────────────────────────────────────────────────────────

interface DownloadItem {
  id: string
  title: string
  description: string | null
  category: string
  file_url: string
  file_name: string
  file_size: number
  is_published: boolean
  sort_order: number
  created_at: string
}

// ─── Icon picker config ───────────────────────────────────────────────────────

const ICON_OPTIONS: { name: string; component: React.ElementType }[] = [
  { name: 'BookOpen',     component: BookOpen },
  { name: 'FileText',     component: FileText },
  { name: 'ClipboardList',component: ClipboardList },
  { name: 'FileCheck',    component: FileCheck },
  { name: 'FolderOpen',   component: FolderOpen },
  { name: 'Archive',      component: Archive },
  { name: 'Star',         component: Star },
  { name: 'Tag',          component: Tag },
  { name: 'Globe',        component: Globe },
  { name: 'Award',        component: Award },
  { name: 'Package',      component: Package },
  { name: 'Download',     component: Download },
]

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(i => [i.name, i.component])) as Record<string, React.ElementType>

function resolveIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? FileText
}

// ─── Color config ─────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  { name: 'blue',   bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-400' },
  { name: 'green',  bg: 'bg-green-50',  text: 'text-green-600',  ring: 'ring-green-400' },
  { name: 'purple', bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-400' },
  { name: 'amber',  bg: 'bg-amber-50',  text: 'text-amber-600',  ring: 'ring-amber-400' },
  { name: 'red',    bg: 'bg-red-50',    text: 'text-red-600',    ring: 'ring-red-400' },
  { name: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-400' },
  { name: 'pink',   bg: 'bg-pink-50',   text: 'text-pink-600',   ring: 'ring-pink-400' },
  { name: 'teal',   bg: 'bg-teal-50',   text: 'text-teal-600',   ring: 'ring-teal-400' },
]

const COLOR_MAP = Object.fromEntries(COLOR_OPTIONS.map(c => [c.name, c])) as Record<string, typeof COLOR_OPTIONS[0]>

function getCategoryColors(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP['blue']
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DownloadCenterPage() {
  const { user } = useAuth()

  // Data
  const [categories, setCategories] = useState<DownloadCategory[]>([])
  const [items, setItems]           = useState<DownloadItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Upload modal
  const [uploadOpen, setUploadOpen]     = useState(false)
  const [formTitle, setFormTitle]       = useState('')
  const [formDesc, setFormDesc]         = useState('')
  const [formCatSlug, setFormCatSlug]   = useState('')
  const [formFile, setFormFile]         = useState<File | null>(null)
  const [uploading, setUploading]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete doc
  const [deleteDocId, setDeleteDocId]   = useState<string | null>(null)
  const [deleteDocLoading, setDeleteDocLoading] = useState(false)
  const [toggling, setToggling]         = useState<string | null>(null)

  // Category settings panel
  const [catSettingsOpen, setCatSettingsOpen] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editName, setEditName]         = useState('')
  const [editIcon, setEditIcon]         = useState('FileText')
  const [editColor, setEditColor]       = useState('blue')
  const [catSaving, setCatSaving]       = useState(false)
  const [deleteCatId, setDeleteCatId]   = useState<string | null>(null)
  const [deleteCatLoading, setDeleteCatLoading] = useState(false)

  // Add new category
  const [addingCat, setAddingCat]   = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('FileText')
  const [newCatColor, setNewCatColor] = useState('blue')
  const [addCatSaving, setAddCatSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [catRes, docRes] = await Promise.all([
      supabase.from('uce_download_categories').select('*').order('sort_order'),
      supabase.from('uce_download_center').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
    ])
    setCategories((catRes.data ?? []) as DownloadCategory[])
    setItems((docRes.data ?? []) as DownloadItem[])
    setLoading(false)
  }

  // ─── Upload document ────────────────────────────────────────────────────────

  function openUploadModal() {
    setFormTitle(''); setFormDesc('')
    setFormCatSlug(categories[0]?.slug ?? '')
    setFormFile(null)
    setUploadOpen(true)
  }

  async function handleUpload() {
    if (!formTitle.trim()) { toast.error('Title is required'); return }
    if (!formCatSlug) { toast.error('Please select a category'); return }
    if (!formFile) { toast.error('Please select a file to upload'); return }
    setUploading(true)
    try {
      const safeName = formFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${formCatSlug}/${Date.now()}_${safeName}`
      const fileUrl = await uploadPublicFile(STORAGE_BUCKETS.documents, path, formFile)
      const { error } = await supabase.from('uce_download_center').insert({
        title: formTitle.trim(), description: formDesc.trim() || null,
        category: formCatSlug, file_url: fileUrl, file_name: formFile.name,
        file_size: formFile.size, is_published: true,
        sort_order: items.length, created_by: user?.id || null,
      })
      if (error) { await deletePublicFile(fileUrl); throw error }
      toast.success('Document uploaded successfully')
      setUploadOpen(false)
      fetchAll()
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  // ─── Toggle publish / delete doc ───────────────────────────────────────────

  async function togglePublish(item: DownloadItem) {
    setToggling(item.id)
    const { error } = await supabase.from('uce_download_center')
      .update({ is_published: !item.is_published, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) { toast.error('Failed to update'); setToggling(null); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_published: !i.is_published } : i))
    toast.success(item.is_published ? 'Unpublished' : 'Published to website')
    setToggling(null)
  }

  async function handleDeleteDoc() {
    if (!deleteDocId) return
    const item = items.find(i => i.id === deleteDocId)
    if (!item) return
    setDeleteDocLoading(true)
    try {
      await deletePublicFile(item.file_url)
      const { error } = await supabase.from('uce_download_center').delete().eq('id', deleteDocId)
      if (error) throw error
      setItems(prev => prev.filter(i => i.id !== deleteDocId))
      toast.success('Document deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleteDocLoading(false); setDeleteDocId(null) }
  }

  // ─── Category management ────────────────────────────────────────────────────

  function startEditCat(cat: DownloadCategory) {
    setEditingCatId(cat.id)
    setEditName(cat.name)
    setEditIcon(cat.icon)
    setEditColor(cat.color)
  }

  function cancelEditCat() {
    setEditingCatId(null); setEditName(''); setEditIcon('FileText'); setEditColor('blue')
  }

  async function saveEditCat(cat: DownloadCategory) {
    if (!editName.trim()) { toast.error('Category name is required'); return }
    setCatSaving(true)
    const { error } = await supabase.from('uce_download_categories')
      .update({ name: editName.trim(), icon: editIcon, color: editColor })
      .eq('id', cat.id)
    if (error) { toast.error('Failed to save'); setCatSaving(false); return }
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: editName.trim(), icon: editIcon, color: editColor } : c))
    toast.success('Category updated')
    setCatSaving(false)
    cancelEditCat()
  }

  async function handleDeleteCat() {
    if (!deleteCatId) return
    const docCount = items.filter(i => i.category === categories.find(c => c.id === deleteCatId)?.slug).length
    if (docCount > 0) {
      toast.error(`Cannot delete — ${docCount} document(s) are in this category. Move or delete them first.`)
      setDeleteCatId(null); return
    }
    setDeleteCatLoading(true)
    const { error } = await supabase.from('uce_download_categories').delete().eq('id', deleteCatId)
    if (error) { toast.error('Failed to delete'); setDeleteCatLoading(false); setDeleteCatId(null); return }
    setCategories(prev => prev.filter(c => c.id !== deleteCatId))
    if (activeCategory === categories.find(c => c.id === deleteCatId)?.slug) setActiveCategory('all')
    toast.success('Category deleted')
    setDeleteCatLoading(false); setDeleteCatId(null)
  }

  async function handleAddCat() {
    if (!newCatName.trim()) { toast.error('Category name is required'); return }
    const slug = toSlug(newCatName)
    if (categories.some(c => c.slug === slug)) { toast.error('A category with this name already exists'); return }
    setAddCatSaving(true)
    const { data, error } = await supabase.from('uce_download_categories')
      .insert({ name: newCatName.trim(), slug, icon: newCatIcon, color: newCatColor, sort_order: categories.length })
      .select().single()
    if (error) { toast.error('Failed to add category'); setAddCatSaving(false); return }
    setCategories(prev => [...prev, data as DownloadCategory])
    toast.success('Category added')
    setAddCatSaving(false); setAddingCat(false)
    setNewCatName(''); setNewCatIcon('FileText'); setNewCatColor('blue')
  }

  async function moveCat(idx: number, dir: 'up' | 'down') {
    const next = [...categories]
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    const updates = next.map((c, i) => ({ id: c.id, sort_order: i }))
    setCategories(next.map((c, i) => ({ ...c, sort_order: i })))
    await Promise.all(updates.map(u => supabase.from('uce_download_categories').update({ sort_order: u.sort_order }).eq('id', u.id)))
  }

  // ─── Derived data ───────────────────────────────────────────────────────────

  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)
  const countAll = items.length
  const countByCat = Object.fromEntries(categories.map(c => [c.slug, items.filter(i => i.category === c.slug).length]))

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <Download size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Download Center</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage documents visible on the public website</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCatSettingsOpen(v => !v)}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-colors',
              catSettingsOpen ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <Settings size={15} />
            Categories
          </button>
          <button
            onClick={openUploadModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm"
          >
            <Plus size={16} /> Upload Document
          </button>
        </div>
      </div>

      {/* Category settings panel */}
      {catSettingsOpen && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">Manage Categories</span>
              <span className="text-xs text-gray-400">({categories.length} total)</span>
            </div>
            <button
              onClick={() => { setAddingCat(true); setNewCatName(''); setNewCatIcon('FileText'); setNewCatColor('blue') }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
            >
              <Plus size={13} /> Add Category
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Add new category row */}
            {addingCat && (
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <p className="text-xs font-semibold text-blue-700 mb-3">New Category</p>
                <div className="space-y-3">
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    className={inputClass}
                    placeholder="Category name (e.g. Study Guides)"
                    autoFocus
                  />
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Icon</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ICON_OPTIONS.map(opt => {
                        const Icon = opt.component
                        return (
                          <button key={opt.name} onClick={() => setNewCatIcon(opt.name)}
                            className={cn('p-2 rounded-lg border transition-colors', newCatIcon === opt.name ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300')}
                            title={opt.name}>
                            <Icon size={15} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Color</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_OPTIONS.map(opt => (
                        <button key={opt.name} onClick={() => setNewCatColor(opt.name)}
                          className={cn('w-6 h-6 rounded-full border-2 transition-all', opt.bg, newCatColor === opt.name ? `ring-2 ${opt.ring} ring-offset-1` : 'border-transparent')}
                          title={opt.name} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setAddingCat(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleAddCat} disabled={addCatSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                      {addCatSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No categories yet. Click "Add Category" to create one.</div>
            ) : categories.map((cat, idx) => {
              const Icon = resolveIcon(cat.icon)
              const colors = getCategoryColors(cat.color)
              const isEditing = editingCatId === cat.id
              const docCount = countByCat[cat.slug] ?? 0

              return (
                <div key={cat.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                    <button onClick={() => moveCat(idx, 'up')} disabled={idx === 0} className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronUp size={13} /></button>
                    <button onClick={() => moveCat(idx, 'down')} disabled={idx === categories.length - 1} className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronDown size={13} /></button>
                  </div>

                  {/* Icon preview */}
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', colors.bg)}>
                    <Icon size={16} className={colors.text} />
                  </div>

                  {isEditing ? (
                    /* Editing state */
                    <div className="flex-1 space-y-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className={`${inputClass} text-sm`}
                        autoFocus
                      />
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1">Icon</p>
                        <div className="flex flex-wrap gap-1">
                          {ICON_OPTIONS.map(opt => {
                            const Ic = opt.component
                            return (
                              <button key={opt.name} onClick={() => setEditIcon(opt.name)}
                                className={cn('p-1.5 rounded-md border transition-colors', editIcon === opt.name ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:border-gray-300')}
                                title={opt.name}><Ic size={13} /></button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 mb-1">Color</p>
                        <div className="flex gap-1.5">
                          {COLOR_OPTIONS.map(opt => (
                            <button key={opt.name} onClick={() => setEditColor(opt.name)}
                              className={cn('w-5 h-5 rounded-full border-2 transition-all', opt.bg, editColor === opt.name ? `ring-2 ${opt.ring} ring-offset-1` : 'border-transparent')}
                              title={opt.name} />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={cancelEditCat} className="px-3 py-1 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => saveEditCat(cat)} disabled={catSaving}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                          {catSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View state */
                    <div className="flex-1 min-w-0 mt-0.5">
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        slug: <code className="text-gray-500">{cat.slug}</code> · {docCount} document{docCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button onClick={() => startEditCat(cat)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteCatId(cat.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
            activeCategory === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          All ({countAll})
        </button>
        {categories.map(cat => {
          const Icon = resolveIcon(cat.icon)
          return (
            <button key={cat.slug} onClick={() => setActiveCategory(cat.slug)}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                activeCategory === cat.slug ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              <Icon size={14} />
              {cat.name} ({countByCat[cat.slug] ?? 0})
            </button>
          )
        })}
      </div>

      {/* Document list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Download size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No documents yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Upload Document" to add your first file.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(item => {
              const cat = categories.find(c => c.slug === item.category)
              const Icon = cat ? resolveIcon(cat.icon) : FileText
              const colors = cat ? getCategoryColors(cat.color) : getCategoryColors('blue')
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 group">
                  <GripVertical size={16} className="text-gray-300 shrink-0" />
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', colors.bg)}>
                    <Icon size={16} className={colors.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400">{cat?.name ?? item.category}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400">{item.file_name}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400">{formatBytes(item.file_size)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Published toggle */}
                    <button
                      onClick={() => togglePublish(item)}
                      disabled={toggling === item.id}
                      className="flex items-center gap-1.5 disabled:opacity-50"
                      title={item.is_published ? 'Click to unpublish' : 'Click to publish'}
                    >
                      {toggling === item.id ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        <span className={cn(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                          item.is_published ? 'bg-green-500' : 'bg-gray-300'
                        )}>
                          <span className={cn(
                            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                            item.is_published ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          )} />
                        </span>
                      )}
                      <span className={cn('text-[11px] font-semibold', item.is_published ? 'text-green-700' : 'text-gray-400')}>
                        {item.is_published ? 'Live' : 'Off'}
                      </span>
                    </button>
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View file">
                      <Download size={15} />
                    </a>
                    <button onClick={() => setDeleteDocId(item.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
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
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document" size="sm">
        <div className="space-y-4">
          <FormField label="Title" required>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={inputClass}
              placeholder="e.g. Student ID Card Application Form" />
          </FormField>
          <FormField label="Description" hint="Optional short description shown on website">
            <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
              className={`${inputClass} resize-none`} rows={2} placeholder="Optional description" />
          </FormField>
          <FormField label="Category" required>
            {categories.length === 0 ? (
              <p className="text-xs text-amber-600 p-2 bg-amber-50 rounded-lg border border-amber-200">No categories yet — create one in the Categories settings first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => {
                  const Icon = resolveIcon(cat.icon)
                  const colors = getCategoryColors(cat.color)
                  return (
                    <label key={cat.slug} className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm',
                      formCatSlug === cat.slug ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    )}>
                      <input type="radio" name="formCat" value={cat.slug}
                        checked={formCatSlug === cat.slug} onChange={() => setFormCatSlug(cat.slug)}
                        className="accent-red-600" />
                      <Icon size={14} className={formCatSlug === cat.slug ? 'text-red-600' : colors.text} />
                      <span className="font-medium text-xs">{cat.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </FormField>
          <FormField label="File" required hint="PDF, DOC, DOCX, JPG, PNG, XLS — max 10 MB">
            {formFile ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <FileText size={16} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{formFile.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(formFile.size)}</p>
                </div>
                <button onClick={() => { setFormFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-gray-400 hover:bg-gray-50">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-gray-500 text-center">Click to select a file</span>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.ppt,.pptx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 10 * 1024 * 1024) { toast.error('Max file size is 10 MB'); return } setFormFile(f) } }} />
              </label>
            )}
          </FormField>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setUploadOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleUpload} disabled={uploading || categories.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete doc confirm */}
      <ConfirmDialog open={!!deleteDocId} onClose={() => setDeleteDocId(null)} onConfirm={handleDeleteDoc}
        title="Delete document?" message="This permanently deletes the file from storage and removes it from the website. Cannot be undone."
        confirmText="Delete" variant="danger" loading={deleteDocLoading} />

      {/* Delete category confirm */}
      <ConfirmDialog open={!!deleteCatId} onClose={() => setDeleteCatId(null)} onConfirm={handleDeleteCat}
        title="Delete category?" message="This will delete the category. Any documents in this category must be moved or deleted first."
        confirmText="Delete" variant="danger" loading={deleteCatLoading} />
    </div>
  )
}
