import { useEffect, useMemo, useState } from 'react'
import {
  Download, Megaphone, FileText, Search, Tag, X, Loader2,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatDateDDMMYYYY, cn } from '../../../lib/utils'

interface Category {
  id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

interface Material {
  id: string
  title: string
  description: string | null
  file_url: string
  file_name: string | null
  file_type: string | null
  thumbnail_url: string | null
  created_at: string
  category_id: string | null
}

const ALL = 'all'
const UNCATEGORISED = '__uncategorised__'

export default function FPromotionsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [materials, setMaterials]   = useState<Material[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selectedCat, setSelectedCat] = useState<string>(ALL)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [catsRes, matsRes] = await Promise.all([
        supabase
          .from('uce_promotional_categories')
          .select('id, name, description, sort_order, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('uce_promotional_materials')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setCategories((catsRes.data ?? []) as Category[])
      setMaterials((matsRes.data ?? []) as Material[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const counts = useMemo(() => {
    const map: Record<string, number> = { [ALL]: materials.length, [UNCATEGORISED]: 0 }
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
      if (selectedCat !== ALL && selectedCat !== UNCATEGORISED && m.category_id !== selectedCat) return false
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

  /**
   * When viewing "All", group rendered cards by category so each section is
   * a clear chunk. When a single category is picked, render a flat grid.
   */
  const grouped = useMemo(() => {
    if (selectedCat !== ALL) return null
    const groups = new Map<string, { key: string; name: string; mats: Material[] }>()
    for (const m of filtered) {
      const key = m.category_id ?? UNCATEGORISED
      const name = m.category_id ? categoryById.get(m.category_id)?.name ?? 'Uncategorised' : 'Uncategorised'
      const g = groups.get(key) ?? { key, name, mats: [] }
      g.mats.push(m)
      groups.set(key, g)
    }
    // Order: keep category sort order, "Uncategorised" last.
    const ordered = Array.from(groups.values()).sort((a, b) => {
      if (a.key === UNCATEGORISED) return 1
      if (b.key === UNCATEGORISED) return -1
      const aSort = categoryById.get(a.key)?.sort_order ?? 0
      const bSort = categoryById.get(b.key)?.sort_order ?? 0
      if (aSort !== bSort) return aSort - bSort
      return a.name.localeCompare(b.name)
    })
    return ordered
  }, [filtered, selectedCat, categoryById])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Promotion Material</h1>
        <p className="text-sm text-gray-500">Marketing assets shared by the head office.</p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or description…"
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:border-red-400 focus:ring-2 focus:ring-red-500/15 outline-none text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={selectedCat === ALL} onClick={() => setSelectedCat(ALL)} label="All" count={counts[ALL] || 0} />
          {categories.map(c => (
            <Chip
              key={c.id}
              active={selectedCat === c.id}
              onClick={() => setSelectedCat(c.id)}
              label={c.name}
              count={counts[c.id] || 0}
            />
          ))}
          {(counts[UNCATEGORISED] || 0) > 0 && (
            <Chip
              active={selectedCat === UNCATEGORISED}
              onClick={() => setSelectedCat(UNCATEGORISED)}
              label="Uncategorised"
              count={counts[UNCATEGORISED] || 0}
              muted
            />
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-red-500 mb-2" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          <Megaphone size={28} className="mx-auto mb-2 text-gray-300" />
          {search ? 'No materials match your search.' :
            selectedCat === ALL ? 'Nothing shared yet.' :
            'No materials in this category yet.'}
        </div>
      ) : grouped ? (
        /* All view → grouped sections */
        <div className="space-y-6">
          {grouped.map(g => (
            <section key={g.key}>
              <div className="flex items-center gap-2 mb-3">
                <Tag size={14} className="text-red-700" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700">{g.name}</h2>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                  {g.mats.length}
                </span>
                <div className="flex-1 h-px bg-gray-100 ml-2" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.mats.map(m => <MaterialCard key={m.id} material={m} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* Single category → flat grid */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => <MaterialCard key={m.id} material={m} />)}
        </div>
      )}
    </div>
  )
}

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

function MaterialCard({ material }: { material: Material }) {
  const isImage = material.file_type?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(material.file_name || '')
  return (
    <div className="rounded-xl border bg-white overflow-hidden flex flex-col">
      {material.thumbnail_url || isImage ? (
        <img
          src={material.thumbnail_url || material.file_url}
          alt={material.title}
          className="w-full h-40 object-cover bg-gray-50"
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-gray-50 text-gray-300">
          <FileText size={36} />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <p className="font-semibold truncate text-gray-900">{material.title}</p>
        {material.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{material.description}</p>}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDateDDMMYYYY(material.created_at)}</span>
          <a
            href={material.file_url}
            target="_blank"
            rel="noreferrer"
            download
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
          >
            <Download size={12} /> Download
          </a>
        </div>
      </div>
    </div>
  )
}
