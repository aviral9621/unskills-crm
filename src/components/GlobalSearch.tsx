import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, X, CornerDownLeft, ArrowUp, ArrowDown, Building2, GraduationCap, MessageCircle, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { SEARCH_CATALOG, searchCatalog, type SearchEntry } from '../lib/search-catalog'

type EntityHit =
  | { kind: 'student'; id: string; title: string; subtitle: string; path: string }
  | { kind: 'branch'; id: string; title: string; subtitle: string; path: string }
  | { kind: 'lead'; id: string; title: string; subtitle: string; path: string }

type Row =
  | { type: 'page'; entry: SearchEntry }
  | { type: 'entity'; hit: EntityHit }

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [entities, setEntities] = useState<EntityHit[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const pages = useMemo(() => searchCatalog(query), [query])

  // Reset when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setEntities([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  // Debounced entity lookup
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setEntities([]); return }
    const t = setTimeout(async () => {
      const [sRes, bRes, lRes] = await Promise.all([
        supabase.from('uce_students').select('id, name, registration_no, phone, branch:uce_branches!uce_students_branch_id_fkey(name), course:uce_courses(name)')
          .or(`name.ilike.%${q}%,registration_no.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5),
        supabase.from('uce_branches').select('id, name, code, district').or(`name.ilike.%${q}%,code.ilike.%${q}%`).limit(3),
        supabase.from('uce_leads').select('id, name, phone, status').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(3),
      ])
      const hits: EntityHit[] = []
      ;(sRes.data ?? []).forEach((s: Record<string, unknown>) => hits.push({
        kind: 'student',
        id: s.id as string,
        title: s.name as string,
        subtitle: `${(s.registration_no as string) || '—'} · ${(s.course as { name: string } | null)?.name || ''} · ${(s.branch as { name: string } | null)?.name || ''}`,
        path: `/admin/students?q=${encodeURIComponent((s.registration_no as string) || (s.name as string))}`,
      }))
      ;(bRes.data ?? []).forEach((b: Record<string, unknown>) => hits.push({
        kind: 'branch',
        id: b.id as string,
        title: b.name as string,
        subtitle: `${b.code} · ${b.district || ''}`,
        path: `/admin/branches/${b.id}/edit`,
      }))
      ;(lRes.data ?? []).forEach((l: Record<string, unknown>) => hits.push({
        kind: 'lead',
        id: l.id as string,
        title: l.name as string,
        subtitle: `${l.phone} · ${l.status}`,
        path: `/admin/leads`,
      }))
      setEntities(hits)
    }, 180)
    return () => clearTimeout(t)
  }, [query, open])

  const rows: Row[] = useMemo(() => {
    const arr: Row[] = []
    pages.forEach(p => arr.push({ type: 'page', entry: p }))
    entities.forEach(e => arr.push({ type: 'entity', hit: e }))
    return arr
  }, [pages, entities])

  // Clamp selection to range
  useEffect(() => { setSelected(s => Math.min(s, Math.max(0, rows.length - 1))) }, [rows.length])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(rows.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(0, i - 1)) }
      else if (e.key === 'Enter') {
        const r = rows[selected]
        if (r) { navigate(r.type === 'page' ? r.entry.path : r.hit.path); onClose() }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, rows, selected, navigate, onClose])

  if (!open) return null

  const showEmpty = query.trim().length > 0 && rows.length === 0
  const showHint = query.trim().length === 0

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-start justify-center p-3 sm:p-6 pt-[10vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-100" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search modules, students, branches, leads…"
            className="flex-1 py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 rounded text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-gray-400 font-mono px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto py-1">
          {showHint && (
            <div className="px-4 py-3 text-[11px] text-gray-500">
              <p className="font-semibold mb-1 uppercase tracking-wider text-[10px]">Quick access</p>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {SEARCH_CATALOG.slice(0, 8).map(e => (
                  <button
                    key={e.path}
                    onClick={() => { navigate(e.path); onClose() }}
                    className="text-left px-2 py-1.5 rounded hover:bg-gray-50 text-[12px] text-gray-700 flex items-center gap-1 min-w-0"
                  >
                    <ChevronRight size={11} className="text-gray-300 shrink-0" />
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-gray-400">Tip: press <kbd className="px-1 py-0.5 text-[10px] bg-gray-100 rounded">Ctrl</kbd> <kbd className="px-1 py-0.5 text-[10px] bg-gray-100 rounded">K</kbd> to open from anywhere</p>
            </div>
          )}

          {showEmpty && (
            <div className="p-8 text-center">
              <Search size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No matches for "<b>{query}</b>"</p>
              <p className="text-[11px] text-gray-400 mt-1">Try a different keyword or module name</p>
            </div>
          )}

          {!showEmpty && !showHint && rows.length > 0 && (() => {
            // Group rows: pages by category, then entities
            const pageRows = rows.filter(r => r.type === 'page') as Extract<Row, { type: 'page' }>[]
            const entityRows = rows.filter(r => r.type === 'entity') as Extract<Row, { type: 'entity' }>[]
            let idx = 0

            const renderPage = (r: Extract<Row, { type: 'page' }>) => {
              const myIdx = idx++
              const active = myIdx === selected
              return (
                <button
                  key={`p-${r.entry.path}`}
                  onMouseEnter={() => setSelected(myIdx)}
                  onClick={() => { navigate(r.entry.path); onClose() }}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    active ? 'bg-red-50' : 'hover:bg-gray-50')}
                >
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                    active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500')}>
                    {r.entry.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm truncate', active ? 'font-semibold text-red-700' : 'text-gray-900 font-medium')}>{r.entry.title}</p>
                    <p className="text-[11px] text-gray-400 truncate">{r.entry.category} · {r.entry.path}</p>
                  </div>
                  {active && <CornerDownLeft size={13} className="text-red-500 shrink-0" />}
                </button>
              )
            }

            const renderEntity = (r: Extract<Row, { type: 'entity' }>) => {
              const myIdx = idx++
              const active = myIdx === selected
              const Icon = r.hit.kind === 'student' ? GraduationCap : r.hit.kind === 'branch' ? Building2 : MessageCircle
              return (
                <button
                  key={`e-${r.hit.kind}-${r.hit.id}`}
                  onMouseEnter={() => setSelected(myIdx)}
                  onClick={() => { navigate(r.hit.path); onClose() }}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    active ? 'bg-red-50' : 'hover:bg-gray-50')}
                >
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                    active ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600')}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm truncate', active ? 'font-semibold text-red-700' : 'text-gray-900 font-medium')}>{r.hit.title}</p>
                    <p className="text-[11px] text-gray-400 truncate">{r.hit.subtitle}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-300 shrink-0">{r.hit.kind}</span>
                </button>
              )
            }

            return (
              <>
                {pageRows.length > 0 && (
                  <div>
                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Pages</p>
                    {pageRows.map(renderPage)}
                  </div>
                )}
                {entityRows.length > 0 && (
                  <div className="mt-1">
                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Matching records</p>
                    {entityRows.map(renderEntity)}
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} /> Navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft size={10} /> Open</span>
          </div>
          <span>{rows.length > 0 ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : ''}</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
