import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Trash2, Loader2, Upload, FolderTree, Pencil, Eye, EyeOff, Search,
  ChevronRight, ChevronDown, FileText, Megaphone, Tag, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, deletePublicFile } from '../../lib/uploads'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY, cn } from '../../lib/utils'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

interface Material {
  id: string
  title: string
  description: string | null
  file_url: string
  file_name: string | null
  file_type: string | null
  thumbnail_url: string | null
  is_active: boolean
  created_at: string
  category_id: string | null
}

const UNCATEGORISED = '__uncategorised__'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `cat-${Date.now()}`
}

export default function AdminPromotionsPage() {
  const { user } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials]   = useState<Material[]>([])
  const [loading, setLoading]       = useState(true)

  // Filtering
  const [search, setSearch]         = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('all') // 'all' | category id | UNCATEGORISED

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [title, setTitle]           = useState('')
  const [desc, setDesc]             = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [uploadCatId, setUploadCatId] = useState<string>('')
  const [saving, setSaving]         = useState(false)

  // Categories modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [catName, setCatName]       = useState('')
  const [catDesc, setCatDesc]       = useState('')
  const [catSaving, setCatSaving]   = useState(false)

  async function load() {
    setLoading(true)
    const [catsRes, matsRes] = await Promise.all([
      supabase
        .from('uce_promotional_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('uce_promotional_materials')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setCategories((catsRes.data ?? []) as Category[])
    setMaterials((matsRes.data ?? []) as Material[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Default the upload modal to the currently-selected category for convenience.
  useEffect(() => {
    if (!uploadOpen) return
    if (selectedCat !== 'all' && selectedCat !== UNCATEGORISED) {
      setUploadCatId(prev => prev || selectedCat)
    }
  }, [uploadOpen, selectedCat])

  /* ─── Material CRUD ─────────────────────────────────────────────────── */

  async function handleUpload() {
    if (!title.trim() || !file) {
      toast.error('Title and file are required')
      return
    }
    setSaving(true)
    try {
      const path = `${Date.now()}-${file.name}`
      const publicUrl = await uploadPublicFile('promotions', path, file)
      const { error } = await supabase.from('uce_promotional_materials').insert({
        title: title.trim(),
        description: desc.trim() || null,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        category_id: uploadCatId || null,
        uploaded_by: user?.id || null,
        is_active: true,
      })
      if (error) throw error
      toast.success('Uploaded')
      setUploadOpen(false)
      setTitle(''); setDesc(''); setFile(null); setUploadCatId('')
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function setCategoryFor(matId: string, catId: string | null) {
    const { error } = await supabase
      .from('uce_promotional_materials')
      .update({ category_id: catId })
      .eq('id', matId)
    if (error) {
      toast.error('Failed to update category')
      return
    }
    setMaterials(prev => prev.map(m => (m.id === matId ? { ...m, category_id: catId } : m)))
    toast.success('Category updated')
  }

  async function toggleMaterial(id: string, isActive: boolean) {
    await supabase.from('uce_promotional_materials').update({ is_active: !isActive }).eq('id', id)
    void load()
  }

  async function deleteMaterial(id: string) {
    if (!confirm('Delete permanently?')) return
    const row = materials.find(r => r.id === id)
    await supabase.from('uce_promotional_materials').delete().eq('id', id)
    if (row?.file_url) void deletePublicFile(row.file_url)
    void load()
  }

  /* ─── Category CRUD ─────────────────────────────────────────────────── */

  function openEditCategory(c: Category) {
    setEditingCat(c)
    setCatName(c.name)
    setCatDesc(c.description ?? '')
    setCatModalOpen(true)
  }

  async function saveCategory() {
    if (!catName.trim()) {
      toast.error('Name is required')
      return
    }
    setCatSaving(true)
    try {
      if (editingCat) {
        const { error } = await supabase
          .from('uce_promotional_categories')
          .update({ name: catName.trim(), description: catDesc.trim() || null })
          .eq('id', editingCat.id)
        if (error) throw error
        toast.success('Category updated')
      } else {
        const baseSlug = slugify(catName)
        // Disambiguate slug with a tiny suffix if a clash already exists.
        const slug = categories.some(c => c.slug === baseSlug) ? `${baseSlug}-${Date.now().toString(36).slice(-4)}` : baseSlug
        const { error } = await supabase
          .from('uce_promotional_categories')
          .insert({
            name: catName.trim(),
            slug,
            description: catDesc.trim() || null,
            sort_order: categories.length,
            is_active: true,
          })
        if (error) throw error
        toast.success('Category created')
      }
      setCatModalOpen(false)
      void load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCatSaving(false)
    }
  }

  async function toggleCategoryActive(c: Category) {
    await supabase
      .from('uce_promotional_categories')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    void load()
  }

  async function deleteCategory(c: Category) {
    const linked = materials.filter(m => m.category_id === c.id).length
    const msg = linked > 0
      ? `Delete "${c.name}"? ${linked} material${linked === 1 ? '' : 's'} will move to Uncategorised.`
      : `Delete "${c.name}"?`
    if (!confirm(msg)) return
    const { error } = await supabase
      .from('uce_promotional_categories')
      .delete()
      .eq('id', c.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Category deleted')
    void load()
  }

  /* ─── Derived state ─────────────────────────────────────────────────── */

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: materials.length, [UNCATEGORISED]: 0 }
    for (const m of materials) {
      const k = m.category_id ?? UNCATEGORISED
      map[k] = (map[k] || 0) + 1
    }
    return map
  }, [materials])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter(m => {
      if (selectedCat === UNCATEGORISED && m.category_id !== null) return false
      if (selectedCat !== 'all' && selectedCat !== UNCATEGORISED && m.category_id !== selectedCat) return false
      if (q) {
        const hay = `${m.title} ${m.description ?? ''} ${m.file_name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [materials, selectedCat, search])

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach(c => m.set(c.id, c))
    return m
  }, [categories])

  /* ─── UI ────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Promotion Material</h1>
          <p className="text-sm text-gray-500">Categorise & share marketing assets across all branches.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCatModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FolderTree size={14} /> Categories
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-red-700"
          >
            <Plus size={16} /> Upload
          </button>
        </div>
      </div>

      {/* Toolbar: search + category chips */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, description or filename…"
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:border-red-400 focus:ring-2 focus:ring-red-500/15 outline-none text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={selectedCat === 'all'} onClick={() => setSelectedCat('all')} label="All" count={counts['all'] || 0} />
          {categories.filter(c => c.is_active).map(c => (
            <Chip
              key={c.id}
              active={selectedCat === c.id}
              onClick={() => setSelectedCat(c.id)}
              label={c.name}
              count={counts[c.id] || 0}
            />
          ))}
          <Chip
            active={selectedCat === UNCATEGORISED}
            onClick={() => setSelectedCat(UNCATEGORISED)}
            label="Uncategorised"
            count={counts[UNCATEGORISED] || 0}
            muted
          />
        </div>
      </div>

      {/* Materials grid */}
      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-red-500 mb-2" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          <Megaphone size={28} className="mx-auto mb-2 text-gray-300" />
          {search ? 'No materials match your search.' :
            selectedCat === 'all' ? 'No materials uploaded yet.' :
            'No materials in this category yet.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => (
            <MaterialCard
              key={m.id}
              material={m}
              categoryName={m.category_id ? categoryById.get(m.category_id)?.name ?? null : null}
              allCategories={categories}
              onToggle={() => toggleMaterial(m.id, m.is_active)}
              onDelete={() => deleteMaterial(m.id)}
              onChangeCategory={(id) => setCategoryFor(m.id, id)}
            />
          ))}
        </div>
      )}

      {/* ─── Upload modal ─── */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Promotion Material">
        <div className="space-y-3">
          <FormField label="Title" required>
            <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Category" hint={categories.length === 0 ? 'Create a category first using the Categories button.' : undefined}>
            <select className={inputClass} value={uploadCatId} onChange={e => setUploadCatId(e.target.value)}>
              <option value="">— Uncategorised —</option>
              {categories.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Description">
            <textarea rows={2} className={inputClass} value={desc} onChange={e => setDesc(e.target.value)} />
          </FormField>
          <FormField label="File" required>
            <label className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-red-400 cursor-pointer text-sm text-gray-500">
              <Upload size={16} />{file ? file.name : 'Choose file'}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </FormField>
          <div className="flex justify-end gap-2">
            <button onClick={() => setUploadOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button
              onClick={handleUpload}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Upload
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Categories modal ─── */}
      <Modal open={catModalOpen} onClose={() => { setCatModalOpen(false); setEditingCat(null) }} title="Manage Categories" size="md">
        <div className="space-y-4">
          {/* Create / edit form */}
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              {editingCat ? `Editing "${editingCat.name}"` : 'Create a new category'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className={inputClass}
                placeholder="Category name (e.g. Diwali Posters, Course Brochures)"
                value={catName}
                onChange={e => setCatName(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Short description (optional)"
                value={catDesc}
                onChange={e => setCatDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              {editingCat && (
                <button
                  type="button"
                  onClick={() => { setEditingCat(null); setCatName(''); setCatDesc('') }}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="button"
                onClick={saveCategory}
                disabled={catSaving || !catName.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {catSaving && <Loader2 size={12} className="animate-spin" />}
                {editingCat ? 'Save changes' : 'Create category'}
              </button>
            </div>
          </div>

          {/* Existing list */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No categories yet — create your first one above.</p>
            ) : categories.map(c => {
              const count = counts[c.id] || 0
              return (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition',
                    c.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60',
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                    <Tag size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {count} material{count === 1 ? '' : 's'}
                      {c.description ? <> · {c.description}</> : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCategoryActive(c)}
                    title={c.is_active ? 'Hide from upload form' : 'Show again'}
                    className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    {c.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditCategory(c)}
                    className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(c)}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ───────── Sub-components ───────── */

function Chip({ label, count, active, onClick, muted }: { label: string; count: number; active: boolean; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition',
        active
          ? 'bg-red-600 border-red-600 text-white shadow-sm'
          : muted
            ? 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-700',
      )}
    >
      {label}
      <span className={cn('inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
        active ? 'bg-white/20' : 'bg-gray-100 text-gray-600')}>
        {count}
      </span>
    </button>
  )
}

function MaterialCard({
  material, categoryName, allCategories, onToggle, onDelete, onChangeCategory,
}: {
  material: Material
  categoryName: string | null
  allCategories: Category[]
  onToggle: () => void
  onDelete: () => void
  onChangeCategory: (catId: string | null) => void
}) {
  const isImg = material.file_type?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(material.file_name || '')
  return (
    <div className={cn('rounded-xl border bg-white overflow-hidden flex flex-col', !material.is_active && 'opacity-50')}>
      {isImg ? (
        <img src={material.file_url} alt="" className="w-full h-36 object-cover bg-gray-50" />
      ) : (
        <div className="w-full h-36 bg-gray-50 flex items-center justify-center text-gray-300">
          <FileText size={32} />
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col">
        <p className="font-semibold truncate text-gray-900">{material.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
            categoryName ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500',
          )}>
            <Tag size={9} /> {categoryName || 'Uncategorised'}
          </span>
          <span className="text-[11px] text-gray-400 truncate">{formatDateDDMMYYYY(material.created_at)}</span>
        </div>
        {material.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1.5">{material.description}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-gray-100 mt-3">
          <select
            value={material.category_id ?? ''}
            onChange={e => onChangeCategory(e.target.value || null)}
            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 max-w-[60%] truncate"
            title="Move to category"
          >
            <option value="">Uncategorised</option>
            {allCategories.filter(c => c.is_active).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onToggle} title={material.is_active ? 'Hide' : 'Show'}
              className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100">
              {material.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button onClick={onDelete} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Unused but kept in case we restore the collapsible category-section view later. */
export function _unused_keep(_args: { ChevronRight: typeof ChevronRight; ChevronDown: typeof ChevronDown }) { return null }
