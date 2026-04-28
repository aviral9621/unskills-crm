import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, X, MessageCircle, MessageSquare, Filter, LayoutList, Kanban } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLeads } from '../../hooks/useLeads'
import { useAuth } from '../../contexts/AuthContext'
import LeadsList from '../../components/leads/LeadsList'
import ChatPane from '../../components/leads/ChatPane'
import LeadPipelineBoard from '../../components/leads/LeadPipelineBoard'
import AddLeadDialog from '../../components/leads/AddLeadDialog'
import { ALL_LEAD_STATUSES, LEAD_STATUS_CONFIG, type LeadStatus } from '../../types/leads'

type FilterMode = 'all' | 'whatsapp' | 'manual' | 'unread'
type ViewMode = 'list' | 'pipeline'

export default function LeadsPage() {
  const { leads, loading } = useLeads()
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('selected'))

  // When opened with ?selected=… (e.g. from "Open Lead" on a free-test
  // submission), select that lead automatically once data has loaded.
  useEffect(() => {
    const fromUrl = searchParams.get('selected')
    if (!fromUrl) return
    if (leads.find(l => l.id === fromUrl)) {
      setSelectedId(fromUrl)
      // Clear the param so back/forward isn't sticky
      const next = new URLSearchParams(searchParams)
      next.delete('selected')
      setSearchParams(next, { replace: true })
    }
  }, [leads, searchParams, setSearchParams])
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [modeFilter, setModeFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const performedByName = profile?.full_name || 'Staff'

  const filtered = useMemo(() => {
    let r = leads
    if (statusFilter !== 'all') r = r.filter(l => l.status === statusFilter)
    if (modeFilter === 'whatsapp') r = r.filter(l => l.source === 'whatsapp' || l.source === 'botbee')
    else if (modeFilter === 'manual') r = r.filter(l => l.source === 'manual')
    else if (modeFilter === 'unread') r = r.filter(l => l.unread_count > 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.last_message_preview || '').toLowerCase().includes(q)
      )
    }
    return r
  }, [leads, statusFilter, modeFilter, search])

  const selected = useMemo(() => leads.find(l => l.id === selectedId) || null, [leads, selectedId])

  const unreadCount = useMemo(() => leads.reduce((a, l) => a + (l.unread_count || 0), 0), [leads])

  return (
    <div className="h-[calc(100vh-6rem)] -mx-3 sm:mx-0 sm:h-[calc(100vh-7rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-0 pb-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading flex items-center gap-2">
            Leads Management
            {unreadCount > 0 && (
              <span className="text-[11px] bg-green-500 text-white rounded-full px-2 py-0.5 font-bold">{unreadCount} new</span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">WhatsApp &amp; manual leads · {leads.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              <LayoutList size={14} /> List
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'pipeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              <Kanban size={14} /> Pipeline
            </button>
          </div>
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm">
            <Plus size={16} /> <span className="hidden sm:inline">Add</span> Lead
          </button>
        </div>
      </div>

      {/* Pipeline view */}
      {viewMode === 'pipeline' ? (
        <div className="flex-1 min-h-0 bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-sm overflow-hidden flex flex-col">
          {/* Pipeline filters bar */}
          <div className="p-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <div className="relative shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-40 pl-8 pr-6 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:border-red-500 focus:outline-none"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={12} /></button>}
            </div>
            {[
              { k: 'all' as FilterMode, label: 'All' },
              { k: 'whatsapp' as FilterMode, label: 'WhatsApp' },
              { k: 'manual' as FilterMode, label: 'Manual' },
              { k: 'unread' as FilterMode, label: 'Unread' },
            ].map(m => (
              <button key={m.k} onClick={() => setModeFilter(m.k)}
                className={cn('shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors',
                  modeFilter === m.k ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
                {m.label}
              </button>
            ))}
          </div>
          {/* Board */}
          <div className="flex-1 overflow-hidden p-3">
            <LeadPipelineBoard leads={filtered} onSelect={id => { setSelectedId(id); setViewMode('list') }} performedByName={performedByName} />
          </div>
        </div>
      ) : (
        /* List view */
        <div className="flex-1 min-h-0 bg-white sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-sm overflow-hidden flex">
          {/* LEFT column (list) */}
          <div className={cn(
            'flex flex-col w-full lg:w-[360px] lg:shrink-0 border-r border-gray-100',
            selected ? 'hidden lg:flex' : 'flex'
          )}>
            {/* Search + filters */}
            <div className="p-2.5 border-b border-gray-100 space-y-2 bg-gray-50/50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search leads..."
                  className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
              </div>
              {/* Mode chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { k: 'all' as FilterMode, label: 'All', icon: null },
                  { k: 'whatsapp' as FilterMode, label: 'WhatsApp', icon: <MessageCircle size={11} /> },
                  { k: 'manual' as FilterMode, label: 'Manual', icon: <MessageSquare size={11} /> },
                  { k: 'unread' as FilterMode, label: 'Unread', icon: null },
                ].map(m => (
                  <button key={m.k} onClick={() => setModeFilter(m.k)}
                    className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors',
                      modeFilter === m.k ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
                    {m.icon}{m.label}
                  </button>
                ))}
              </div>
              {/* Status filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold shrink-0 flex items-center gap-0.5"><Filter size={10} /> Status:</span>
                <button onClick={() => setStatusFilter('all')}
                  className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0',
                    statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200')}>All</button>
                {ALL_LEAD_STATUSES.map(s => {
                  const count = leads.filter(l => l.status === s).length
                  if (count === 0 && statusFilter !== s) return null
                  return (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1',
                        statusFilter === s ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', LEAD_STATUS_CONFIG[s].dot)} />
                      {LEAD_STATUS_CONFIG[s].label} {count > 0 && <span className="opacity-70">({count})</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              <LeadsList
                leads={filtered}
                loading={loading}
                selectedId={selectedId}
                onSelect={setSelectedId}
                emptyHint={modeFilter === 'whatsapp' ? 'WhatsApp leads will auto-appear when BotBee sends a webhook.' : undefined}
              />
            </div>
          </div>

          {/* RIGHT column (chat) */}
          <div className={cn('flex-1 min-w-0', selected ? 'flex' : 'hidden lg:flex')}>
            {selected ? (
              <div className="flex-1 min-w-0">
                <ChatPane
                  lead={selected}
                  onBack={() => setSelectedId(null)}
                  onDeleted={() => setSelectedId(null)}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-sm p-8">
                  <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-700 font-semibold">Select a lead</p>
                  <p className="text-xs text-gray-500 mt-1">Pick a lead from the left to view its conversation, notes and status.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile view toggle (bottom) */}
      <div className="sm:hidden flex items-center justify-center gap-1 pt-2">
        <button
          onClick={() => setViewMode('list')}
          className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            viewMode === 'list' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          <LayoutList size={13} /> List
        </button>
        <button
          onClick={() => setViewMode('pipeline')}
          className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            viewMode === 'pipeline' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          <Kanban size={13} /> Pipeline
        </button>
      </div>

      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={id => { setSelectedId(id); setViewMode('list') }} />
    </div>
  )
}
