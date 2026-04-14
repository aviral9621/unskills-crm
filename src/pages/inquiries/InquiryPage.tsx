import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  MessageSquare, Plus, Search, MoreVertical, Eye, Trash2,
  Phone, Mail, MapPin, Calendar, User,
  Send, Building2, GraduationCap, Loader2, ChevronRight, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { Inquiry, InquiryNote, InquiryType, InquiryStatus } from '../../types'

/* ─── Constants ─── */
const TABS: { key: InquiryType; label: string; short: string; icon: React.ReactNode }[] = [
  { key: 'franchise', label: 'Franchise', short: 'Franchise', icon: <Building2 size={16} /> },
  { key: 'contact', label: 'Contact Us', short: 'Contact', icon: <Mail size={16} /> },
  { key: 'student_registration', label: 'Student Registration', short: 'Student', icon: <GraduationCap size={16} /> },
]

const STATUS_OPTIONS: { value: InquiryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
]

const SOURCE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'manual', label: 'Manual' },
  { value: 'phone', label: 'Phone' },
  { value: 'walkin', label: 'Walk-in' },
]

function statusVariant(s: InquiryStatus) {
  switch (s) {
    case 'new': return 'info' as const
    case 'contacted': return 'warning' as const
    case 'in_progress': return 'warning' as const
    case 'converted': return 'success' as const
    case 'closed': return 'neutral' as const
    case 'rejected': return 'error' as const
  }
}

function statusLabel(s: InquiryStatus) {
  return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '?'
}

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-green-100 text-green-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

/* ─── Column helpers ─── */
const franchiseCol = createColumnHelper<Inquiry>()
const contactCol = createColumnHelper<Inquiry>()
const studentCol = createColumnHelper<Inquiry>()

/* ─── Main Component ─── */
export default function InquiryPage() {
  const { profile } = useAuth()

  // Data
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)

  // Tab & filters
  const [activeTab, setActiveTab] = useState<InquiryType>('franchise')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all')

  // Detail modal
  const [detailInquiry, setDetailInquiry] = useState<Inquiry | null>(null)
  const [detailNotes, setDetailNotes] = useState<InquiryNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Add inquiry modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addSaving, setAddSaving] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Inquiry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Context menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  /* ─── Fetch ─── */
  useEffect(() => { fetchInquiries() }, [])
  useEffect(() => {
    const h = () => setMenuOpen(null)
    window.addEventListener('scroll', h, true)
    return () => window.removeEventListener('scroll', h, true)
  }, [])

  async function fetchInquiries() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_inquiries')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setInquiries((data ?? []) as Inquiry[])
    } catch {
      toast.error('Failed to load inquiries')
    } finally {
      setLoading(false)
    }
  }

  /* ─── Filtered data per tab ─── */
  const tabData = useMemo(() => {
    let filtered = inquiries.filter(i => i.type === activeTab)
    if (statusFilter !== 'all') filtered = filtered.filter(i => i.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.phone || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q) ||
        (i.city || '').toLowerCase().includes(q) ||
        (i.subject || '').toLowerCase().includes(q)
      )
    }
    return filtered
  }, [inquiries, activeTab, statusFilter, search])

  const tabCounts = useMemo(() => ({
    franchise: inquiries.filter(i => i.type === 'franchise').length,
    contact: inquiries.filter(i => i.type === 'contact').length,
    student_registration: inquiries.filter(i => i.type === 'student_registration').length,
  }), [inquiries])

  const newCount = useMemo(() => inquiries.filter(i => i.type === activeTab && i.status === 'new').length, [inquiries, activeTab])

  /* ─── Context menu ─── */
  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id)
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  /* ─── Status update ─── */
  async function handleStatusChange(inquiry: Inquiry, newStatus: InquiryStatus) {
    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('uce_inquiries')
        .update({
          status: newStatus,
          responded_by: profile?.id,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', inquiry.id)
      if (error) throw error
      setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: newStatus, responded_by: profile?.id ?? null, responded_at: new Date().toISOString() } : i))
      if (detailInquiry?.id === inquiry.id) setDetailInquiry(prev => prev ? { ...prev, status: newStatus } : null)
      toast.success(`Status updated to ${statusLabel(newStatus)}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  /* ─── Notes ─── */
  async function fetchNotes(inquiryId: string) {
    setNotesLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_inquiry_notes')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setDetailNotes((data ?? []) as InquiryNote[])
    } catch {
      toast.error('Failed to load notes')
    } finally {
      setNotesLoading(false)
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !detailInquiry) return
    setAddingNote(true)
    try {
      const { error } = await supabase.from('uce_inquiry_notes').insert({
        inquiry_id: detailInquiry.id,
        note: newNote.trim(),
        added_by: profile?.id,
        added_by_name: profile?.full_name ?? 'Admin',
      })
      if (error) throw error
      setNewNote('')
      fetchNotes(detailInquiry.id)
      toast.success('Note added')
    } catch {
      toast.error('Failed to add note')
    } finally {
      setAddingNote(false)
    }
  }

  function openDetail(inquiry: Inquiry) {
    setDetailInquiry(inquiry)
    setDetailNotes([])
    setNewNote('')
    fetchNotes(inquiry.id)
    setMenuOpen(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_inquiries').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setInquiries(prev => prev.filter(i => i.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Inquiry deleted')
    } catch {
      toast.error('Failed to delete inquiry')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddInquiry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddSaving(true)
    const fd = new FormData(e.currentTarget)
    const get = (k: string) => (fd.get(k) as string)?.trim() || null

    const payload: Record<string, unknown> = {
      type: activeTab,
      name: get('name'),
      phone: get('phone'),
      email: get('email'),
      source: get('source') || 'manual',
      status: 'new',
    }

    if (activeTab === 'franchise') {
      Object.assign(payload, {
        city: get('city'), state: get('state'), district: get('district'),
        qualification: get('qualification'), occupation: get('occupation'),
        experience: get('experience'), space_available: get('space_available'),
        investment_range: get('investment_range'), address: get('address'),
        preferred_location: get('preferred_location'), why_franchise: get('why_franchise'),
        how_heard: get('how_heard'), alt_phone: get('alt_phone'), gender: get('gender'),
        pincode: get('pincode'),
      })
    } else if (activeTab === 'contact') {
      Object.assign(payload, { subject: get('subject'), message: get('message') })
    } else {
      Object.assign(payload, {
        father_name: get('father_name'), mother_name: get('mother_name'),
        dob: get('dob') || null, course_interest: get('course_interest'),
        branch_preference: get('branch_preference'), address: get('address'),
      })
    }

    try {
      const { error } = await supabase.from('uce_inquiries').insert(payload)
      if (error) throw error
      setShowAddModal(false)
      fetchInquiries()
      toast.success('Inquiry added successfully')
    } catch {
      toast.error('Failed to add inquiry')
    } finally {
      setAddSaving(false)
    }
  }

  // eslint-disable-next-line react/no-unstable-nested-components
  function NameCell({ inquiry }: { inquiry: Inquiry }) {
    return (
      <div className="flex items-center gap-2.5 min-w-[180px]">
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold', avatarColor(inquiry.name || inquiry.id))}>
          {initials(inquiry.name || '?')}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{inquiry.name}</p>
          <p className="text-xs text-gray-500 truncate">{inquiry.phone}{inquiry.email ? ` · ${inquiry.email}` : ''}</p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line react/no-unstable-nested-components
  function ActionsCell({ row }: { row: Inquiry }) {
    return (
      <button
        ref={el => { if (el) menuBtnRefs.current.set(row.id, el) }}
        onClick={e => { e.stopPropagation(); menuOpen === row.id ? setMenuOpen(null) : openMenu(row.id) }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
    )
  }

  /* ─── Columns ─── */
  const franchiseColumns = useMemo(() => [
    franchiseCol.display({ id: 'name', header: 'Name & Contact', cell: i => <NameCell inquiry={i.row.original} /> }),
    franchiseCol.accessor('city', { header: 'City / State', cell: i => {
      const r = i.row.original
      return (
        <div>
          <p className="text-sm text-gray-700">{r.city || '—'}</p>
          <p className="text-xs text-gray-400">{r.state || ''}</p>
        </div>
      )
    } }),
    franchiseCol.accessor('investment_range', { header: 'Investment', cell: i => <span className="text-sm text-gray-700">{i.getValue() || '—'}</span> }),
    franchiseCol.accessor('occupation', { header: 'Occupation', cell: i => <span className="text-sm text-gray-600">{i.getValue() || '—'}</span> }),
    franchiseCol.accessor('created_at', { header: 'Date', cell: i => <span className="text-xs text-gray-500">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    franchiseCol.accessor('status', { header: 'Status', cell: i => <StatusBadge label={statusLabel(i.getValue())} variant={statusVariant(i.getValue())} /> }),
    franchiseCol.display({ id: 'actions', header: '', cell: i => <ActionsCell row={i.row.original} /> }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  const contactColumns = useMemo(() => [
    contactCol.display({ id: 'name', header: 'Name & Contact', cell: i => <NameCell inquiry={i.row.original} /> }),
    contactCol.accessor('subject', { header: 'Subject', cell: i => <span className="text-sm text-gray-700 max-w-[260px] inline-block truncate align-middle">{i.getValue() || '—'}</span> }),
    contactCol.accessor('message', { header: 'Message', cell: i => <span className="text-sm text-gray-600 max-w-[320px] inline-block truncate align-middle">{i.getValue() || '—'}</span> }),
    contactCol.accessor('created_at', { header: 'Date', cell: i => <span className="text-xs text-gray-500">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    contactCol.accessor('status', { header: 'Status', cell: i => <StatusBadge label={statusLabel(i.getValue())} variant={statusVariant(i.getValue())} /> }),
    contactCol.display({ id: 'actions', header: '', cell: i => <ActionsCell row={i.row.original} /> }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  const studentColumns = useMemo(() => [
    studentCol.display({ id: 'name', header: 'Name & Contact', cell: i => <NameCell inquiry={i.row.original} /> }),
    studentCol.accessor('course_interest', { header: 'Course Interest', cell: i => <span className="text-sm text-gray-700">{i.getValue() || '—'}</span> }),
    studentCol.accessor('branch_preference', { header: 'Branch Pref', cell: i => <span className="text-sm text-gray-600">{i.getValue() || '—'}</span> }),
    studentCol.accessor('father_name', { header: "Father's Name", cell: i => <span className="text-sm text-gray-600">{i.getValue() || '—'}</span> }),
    studentCol.accessor('created_at', { header: 'Date', cell: i => <span className="text-xs text-gray-500">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    studentCol.accessor('status', { header: 'Status', cell: i => <StatusBadge label={statusLabel(i.getValue())} variant={statusVariant(i.getValue())} /> }),
    studentCol.display({ id: 'actions', header: '', cell: i => <ActionsCell row={i.row.original} /> }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  const activeColumns = activeTab === 'franchise' ? franchiseColumns : activeTab === 'contact' ? contactColumns : studentColumns

  /* ─── Mobile card ─── */
  function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
    return (
      <button
        onClick={() => openDetail(inquiry)}
        className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-red-200 hover:shadow-sm active:scale-[0.99] transition-all"
      >
        <div className="flex items-start gap-3">
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold', avatarColor(inquiry.name || inquiry.id))}>
            {initials(inquiry.name || '?')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{inquiry.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{format(new Date(inquiry.created_at), 'dd MMM yyyy')}</p>
              </div>
              <StatusBadge label={statusLabel(inquiry.status)} variant={statusVariant(inquiry.status)} />
            </div>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs text-gray-600 flex items-center gap-1.5 truncate"><Phone size={11} className="shrink-0" />{inquiry.phone}</p>
              {inquiry.email && <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate"><Mail size={11} className="shrink-0" />{inquiry.email}</p>}
              {inquiry.type === 'franchise' && inquiry.city && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate"><MapPin size={11} className="shrink-0" />{inquiry.city}{inquiry.state ? `, ${inquiry.state}` : ''}</p>
              )}
              {inquiry.type === 'franchise' && inquiry.investment_range && (
                <p className="text-xs text-gray-500 truncate">💰 {inquiry.investment_range}</p>
              )}
              {inquiry.type === 'contact' && inquiry.subject && (
                <p className="text-xs text-gray-600 truncate">📌 {inquiry.subject}</p>
              )}
              {inquiry.type === 'student_registration' && inquiry.course_interest && (
                <p className="text-xs text-gray-600 truncate">📘 {inquiry.course_interest}</p>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 self-center shrink-0" />
        </div>
      </button>
    )
  }

  /* ─── Render ─── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Inquiries</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage franchise, contact, and student inquiries</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors shadow-sm shrink-0"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Add</span> Inquiry
        </button>
      </div>

      {/* Tabs — pill style */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1.5 flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setStatusFilter('all'); setSearch('') }}
            className={cn(
              'flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all',
              activeTab === tab.key ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
            <span className={cn(
              'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-semibold',
              activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            )}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {!loading && tabCounts[activeTab] > 0 && (
        <div className="flex items-center gap-3 text-xs text-gray-500 px-1">
          <span><b className="text-gray-800">{tabCounts[activeTab]}</b> total</span>
          {newCount > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /><b className="text-blue-700">{newCount}</b> new</span>}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, email, city…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as InquiryStatus | 'all')}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white sm:w-44 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex gap-3">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div>
                </div>
                <div className="skeleton h-3 w-full rounded" />
              </div>
            ))}
          </div>
        ) : tabData.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <MessageSquare size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No {activeTab === 'student_registration' ? 'student registration' : activeTab} inquiries</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tabData.map(inq => <InquiryCard key={inq.id} inquiry={inq} />)}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable
          data={tabData}
          columns={activeColumns}
          loading={loading}
          searchValue=""
          onRowClick={(inq) => openDetail(inq)}
          emptyIcon={<MessageSquare size={40} strokeWidth={1.5} className="text-gray-300" />}
          emptyMessage={`No ${activeTab === 'student_registration' ? 'student registration' : activeTab} inquiries found`}
        />
      </div>

      {/* Context menu portal */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div
            className="fixed z-50 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {(() => {
              const inq = inquiries.find(i => i.id === menuOpen)
              if (!inq) return null
              return (
                <>
                  <button onClick={() => openDetail(inq)} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Eye size={15} className="text-gray-400" /> View Details
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(inq); setMenuOpen(null) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Detail Modal — redesigned */}
      {detailInquiry && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-in fade-in duration-150" onClick={() => setDetailInquiry(null)}>
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
          >
            {/* Header card */}
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 sm:hidden" />
            <div className="p-5 sm:p-6 border-b border-gray-100">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={cn('h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center shrink-0 text-base sm:text-lg font-bold', avatarColor(detailInquiry.name || detailInquiry.id))}>
                  {initials(detailInquiry.name || '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{detailInquiry.name}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activeTab === 'franchise' ? 'Franchise' : activeTab === 'contact' ? 'Contact' : 'Student Registration'} Inquiry ·{' '}
                        {format(new Date(detailInquiry.created_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                    <button onClick={() => setDetailInquiry(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 shrink-0"><X size={18} /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Status:</span>
                    <select
                      value={detailInquiry.status}
                      disabled={updatingStatus}
                      onChange={e => handleStatusChange(detailInquiry, e.target.value as InquiryStatus)}
                      className={cn(selectClass, '!py-1.5 !px-2.5 text-xs w-auto min-w-[9rem]')}
                    >
                      {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {updatingStatus && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  </div>
                </div>
              </div>

              {/* Quick contact actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`tel:${detailInquiry.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100">
                  <Phone size={12} /> Call
                </a>
                <a href={`https://wa.me/${(detailInquiry.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100">
                  <MessageSquare size={12} /> WhatsApp
                </a>
                {detailInquiry.email && (
                  <a href={`mailto:${detailInquiry.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100">
                    <Mail size={12} /> Email
                  </a>
                )}
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Key info grid */}
              <div>
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoCard icon={<User size={14} />} label="Full Name" value={detailInquiry.name} />
                  <InfoCard icon={<Phone size={14} />} label="Phone" value={detailInquiry.phone} />
                  {detailInquiry.email && <InfoCard icon={<Mail size={14} />} label="Email" value={detailInquiry.email} />}
                  {detailInquiry.alt_phone && <InfoCard icon={<Phone size={14} />} label="Alt Phone" value={detailInquiry.alt_phone} />}
                  <InfoCard icon={<Calendar size={14} />} label="Source" value={detailInquiry.source} />
                </div>
              </div>

              {detailInquiry.type === 'franchise' && (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Location &amp; Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detailInquiry.gender && <InfoCard label="Gender" value={detailInquiry.gender} />}
                    {detailInquiry.city && <InfoCard icon={<MapPin size={14} />} label="City" value={detailInquiry.city} />}
                    {detailInquiry.state && <InfoCard label="State" value={detailInquiry.state} />}
                    {detailInquiry.district && <InfoCard label="District" value={detailInquiry.district} />}
                    {detailInquiry.pincode && <InfoCard label="Pincode" value={detailInquiry.pincode} />}
                    {detailInquiry.preferred_location && <InfoCard label="Preferred Location" value={detailInquiry.preferred_location} />}
                    {detailInquiry.address && <InfoCard label="Address" value={detailInquiry.address} className="sm:col-span-2" />}
                  </div>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-5">Business Profile</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detailInquiry.qualification && <InfoCard label="Qualification" value={detailInquiry.qualification} />}
                    {detailInquiry.occupation && <InfoCard label="Occupation" value={detailInquiry.occupation} />}
                    {detailInquiry.experience && <InfoCard label="Experience" value={detailInquiry.experience} />}
                    {detailInquiry.space_available && <InfoCard label="Space Available" value={detailInquiry.space_available} />}
                    {detailInquiry.investment_range && <InfoCard label="Investment Range" value={detailInquiry.investment_range} />}
                    {detailInquiry.how_heard && <InfoCard label="How Heard" value={detailInquiry.how_heard} />}
                    {detailInquiry.why_franchise && <InfoCard label="Why Franchise" value={detailInquiry.why_franchise} className="sm:col-span-2" />}
                  </div>
                </div>
              )}

              {detailInquiry.type === 'contact' && (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Message</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {detailInquiry.subject && <InfoCard label="Subject" value={detailInquiry.subject} />}
                    {detailInquiry.message && <InfoCard label="Message" value={detailInquiry.message} />}
                  </div>
                </div>
              )}

              {detailInquiry.type === 'student_registration' && (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Student Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detailInquiry.father_name && <InfoCard label="Father's Name" value={detailInquiry.father_name} />}
                    {detailInquiry.mother_name && <InfoCard label="Mother's Name" value={detailInquiry.mother_name} />}
                    {detailInquiry.dob && <InfoCard label="Date of Birth" value={format(new Date(detailInquiry.dob), 'dd MMM yyyy')} />}
                    {detailInquiry.course_interest && <InfoCard label="Course Interest" value={detailInquiry.course_interest} />}
                    {detailInquiry.branch_preference && <InfoCard label="Branch Preference" value={detailInquiry.branch_preference} />}
                    {detailInquiry.address && <InfoCard label="Address" value={detailInquiry.address} className="sm:col-span-2" />}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Internal Notes {detailNotes.length > 0 && <span className="ml-1 text-gray-500">({detailNotes.length})</span>}
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Add a note about this inquiry…"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote() } }}
                    className={cn(inputClass, 'flex-1')}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !newNote.trim()}
                    className="px-3.5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
                {notesLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
                  </div>
                ) : detailNotes.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-lg">No notes yet. Be the first to add one.</p>
                ) : (
                  <div className="space-y-2">
                    {detailNotes.map(note => (
                      <div key={note.id} className="bg-gray-50 rounded-lg px-3.5 py-2.5">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] font-medium text-gray-600">{note.added_by_name || 'Admin'}</span>
                          <span className="text-[11px] text-gray-300">•</span>
                          <span className="text-[11px] text-gray-400">{format(new Date(note.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Inquiry Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={`Add ${activeTab === 'franchise' ? 'Franchise' : activeTab === 'contact' ? 'Contact' : 'Student Registration'} Inquiry`} size="lg">
        <form onSubmit={handleAddInquiry} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required><input name="name" required className={inputClass} placeholder="Full name" /></FormField>
            <FormField label="Phone" required><input name="phone" required className={inputClass} placeholder="Phone number" /></FormField>
            <FormField label="Email"><input name="email" type="email" className={inputClass} placeholder="Email address" /></FormField>
            <FormField label="Source">
              <select name="source" className={selectClass} defaultValue="manual">
                {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>

            {activeTab === 'franchise' && (
              <>
                <FormField label="Gender">
                  <select name="gender" className={selectClass}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField label="Alt Phone"><input name="alt_phone" className={inputClass} placeholder="Alternative phone" /></FormField>
                <FormField label="City"><input name="city" className={inputClass} placeholder="City" /></FormField>
                <FormField label="State"><input name="state" className={inputClass} placeholder="State" /></FormField>
                <FormField label="District"><input name="district" className={inputClass} placeholder="District" /></FormField>
                <FormField label="Pincode"><input name="pincode" className={inputClass} placeholder="Pincode" /></FormField>
                <FormField label="Address" className="sm:col-span-2"><input name="address" className={inputClass} placeholder="Full address" /></FormField>
                <FormField label="Qualification"><input name="qualification" className={inputClass} placeholder="e.g. B.Tech" /></FormField>
                <FormField label="Occupation"><input name="occupation" className={inputClass} placeholder="e.g. Business" /></FormField>
                <FormField label="Experience"><input name="experience" className={inputClass} placeholder="e.g. 5 years" /></FormField>
                <FormField label="Space Available"><input name="space_available" className={inputClass} placeholder="e.g. 800 sq ft" /></FormField>
                <FormField label="Investment Range"><input name="investment_range" className={inputClass} placeholder="e.g. 5-10 Lakh" /></FormField>
                <FormField label="Preferred Location"><input name="preferred_location" className={inputClass} placeholder="Preferred location" /></FormField>
                <FormField label="How Heard"><input name="how_heard" className={inputClass} placeholder="e.g. Google, Referral" /></FormField>
                <FormField label="Why Franchise" className="sm:col-span-2"><textarea name="why_franchise" rows={2} className={inputClass} placeholder="Reason for franchise interest" /></FormField>
              </>
            )}

            {activeTab === 'contact' && (
              <>
                <FormField label="Subject" className="sm:col-span-2"><input name="subject" className={inputClass} placeholder="Inquiry subject" /></FormField>
                <FormField label="Message" className="sm:col-span-2"><textarea name="message" rows={3} className={inputClass} placeholder="Message details" /></FormField>
              </>
            )}

            {activeTab === 'student_registration' && (
              <>
                <FormField label="Father's Name"><input name="father_name" className={inputClass} placeholder="Father's name" /></FormField>
                <FormField label="Mother's Name"><input name="mother_name" className={inputClass} placeholder="Mother's name" /></FormField>
                <FormField label="Date of Birth"><input name="dob" type="date" className={inputClass} /></FormField>
                <FormField label="Course Interest"><input name="course_interest" className={inputClass} placeholder="e.g. ADCA, DCA" /></FormField>
                <FormField label="Branch Preference"><input name="branch_preference" className={inputClass} placeholder="Preferred branch" /></FormField>
                <FormField label="Address" className="sm:col-span-2"><input name="address" className={inputClass} placeholder="Full address" /></FormField>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={addSaving} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {addSaving && <Loader2 size={16} className="animate-spin" />}
              Save Inquiry
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Inquiry"
        message={`Are you sure you want to delete this inquiry from ${deleteTarget?.name}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}

/* ─── Info card (detail modal) ─── */
function InfoCard({ icon, label, value, className }: { icon?: React.ReactNode; label: string; value: string | null; className?: string }) {
  if (!value) return null
  return (
    <div className={cn('bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5', className)}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-sm text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  )
}
