import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  MessageSquare, Plus, Search, MoreVertical, Eye, Trash2,
  Phone, Mail, MapPin, Calendar, Clock, User,
  Send, Building2, GraduationCap, Loader2,
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
const TABS: { key: InquiryType; label: string; icon: React.ReactNode }[] = [
  { key: 'franchise', label: 'Franchise', icon: <Building2 size={16} /> },
  { key: 'contact', label: 'Contact Us', icon: <Mail size={16} /> },
  { key: 'student_registration', label: 'Student Registration', icon: <GraduationCap size={16} /> },
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
    return filtered
  }, [inquiries, activeTab, statusFilter])

  const tabCounts = useMemo(() => ({
    franchise: inquiries.filter(i => i.type === 'franchise').length,
    contact: inquiries.filter(i => i.type === 'contact').length,
    student_registration: inquiries.filter(i => i.type === 'student_registration').length,
  }), [inquiries])

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

  /* ─── Open detail ─── */
  function openDetail(inquiry: Inquiry) {
    setDetailInquiry(inquiry)
    setDetailNotes([])
    setNewNote('')
    fetchNotes(inquiry.id)
    setMenuOpen(null)
  }

  /* ─── Delete ─── */
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

  /* ─── Add Inquiry ─── */
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

  /* ─── Action cell renderer ─── */
  // eslint-disable-next-line react/no-unstable-nested-components
  function ActionsCell({ row }: { row: Inquiry }) {
    return (
      <button
        ref={el => { if (el) menuBtnRefs.current.set(row.id, el) }}
        onClick={() => menuOpen === row.id ? setMenuOpen(null) : openMenu(row.id)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
    )
  }

  /* ─── Columns ─── */
  const franchiseColumns = useMemo(() => [
    franchiseCol.accessor('name', { header: 'Name', cell: i => <span className="font-medium text-gray-900">{i.getValue()}</span> }),
    franchiseCol.accessor('phone', { header: 'Phone', cell: i => <span className="text-gray-600">{i.getValue()}</span> }),
    franchiseCol.accessor('city', { header: 'City', cell: i => <span className="text-gray-600">{i.getValue() || '—'}</span> }),
    franchiseCol.accessor('investment_range', { header: 'Investment', cell: i => <span className="text-gray-600">{i.getValue() || '—'}</span> }),
    franchiseCol.accessor('created_at', { header: 'Date', cell: i => <span className="text-gray-500 text-xs">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    franchiseCol.accessor('status', { header: 'Status', cell: i => <StatusBadge label={statusLabel(i.getValue())} variant={statusVariant(i.getValue())} /> }),
    franchiseCol.display({ id: 'actions', header: '', cell: i => <ActionsCell row={i.row.original} /> }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  const contactColumns = useMemo(() => [
    contactCol.accessor('name', { header: 'Name', cell: i => <span className="font-medium text-gray-900">{i.getValue()}</span> }),
    contactCol.accessor('email', { header: 'Email', cell: i => <span className="text-gray-600">{i.getValue() || '—'}</span> }),
    contactCol.accessor('subject', { header: 'Subject', cell: i => <span className="text-gray-600">{i.getValue() || '—'}</span> }),
    contactCol.accessor('created_at', { header: 'Date', cell: i => <span className="text-gray-500 text-xs">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    contactCol.accessor('status', { header: 'Status', cell: i => <StatusBadge label={statusLabel(i.getValue())} variant={statusVariant(i.getValue())} /> }),
    contactCol.display({ id: 'actions', header: '', cell: i => <ActionsCell row={i.row.original} /> }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  const studentColumns = useMemo(() => [
    studentCol.accessor('name', { header: 'Name', cell: i => <span className="font-medium text-gray-900">{i.getValue()}</span> }),
    studentCol.accessor('phone', { header: 'Phone', cell: i => <span className="text-gray-600">{i.getValue()}</span> }),
    studentCol.accessor('course_interest', { header: 'Course Interest', cell: i => <span className="text-gray-600">{i.getValue() || '—'}</span> }),
    studentCol.accessor('branch_preference', { header: 'Branch Pref', cell: i => <span className="text-gray-600">{i.getValue() || '—'}</span> }),
    studentCol.accessor('created_at', { header: 'Date', cell: i => <span className="text-gray-500 text-xs">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    studentCol.accessor('status', { header: 'Status', cell: i => <StatusBadge label={statusLabel(i.getValue())} variant={statusVariant(i.getValue())} /> }),
    studentCol.display({ id: 'actions', header: '', cell: i => <ActionsCell row={i.row.original} /> }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  const activeColumns = activeTab === 'franchise' ? franchiseColumns : activeTab === 'contact' ? contactColumns : studentColumns

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Inquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage franchise, contact, and student registration inquiries</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> Add Inquiry
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setStatusFilter('all'); setSearch('') }}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.icon}
              {tab.label}
              <span className={cn(
                'ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-semibold',
                activeTab === tab.key ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'
              )}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn(inputClass, 'pl-9')}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as InquiryStatus | 'all')}
          className={cn(selectClass, 'sm:w-44')}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* DataTable */}
      <DataTable
        data={tabData}
        columns={activeColumns}
        loading={loading}
        searchValue={search}
        pageSize={10}
        emptyIcon={<MessageSquare size={40} strokeWidth={1.5} className="text-gray-300" />}
        emptyMessage={`No ${activeTab === 'student_registration' ? 'student registration' : activeTab} inquiries found`}
      />

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

      {/* Detail Modal */}
      {detailInquiry && (
        <Modal open onClose={() => setDetailInquiry(null)} title={`${activeTab === 'franchise' ? 'Franchise' : activeTab === 'contact' ? 'Contact' : 'Student Registration'} Inquiry`} size="lg">
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Status change */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status:</span>
              <select
                value={detailInquiry.status}
                disabled={updatingStatus}
                onChange={e => handleStatusChange(detailInquiry, e.target.value as InquiryStatus)}
                className={cn(selectClass, 'w-40 !py-2')}
              >
                {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {updatingStatus && <Loader2 size={16} className="animate-spin text-gray-400" />}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <DetailField icon={<User size={14} />} label="Name" value={detailInquiry.name} />
              <DetailField icon={<Phone size={14} />} label="Phone" value={detailInquiry.phone} />
              {detailInquiry.email && <DetailField icon={<Mail size={14} />} label="Email" value={detailInquiry.email} />}
              {detailInquiry.alt_phone && <DetailField icon={<Phone size={14} />} label="Alt Phone" value={detailInquiry.alt_phone} />}
              <DetailField icon={<Calendar size={14} />} label="Date" value={format(new Date(detailInquiry.created_at), 'dd MMM yyyy, hh:mm a')} />
              <DetailField icon={<Clock size={14} />} label="Source" value={detailInquiry.source} />

              {/* Franchise fields */}
              {detailInquiry.type === 'franchise' && (
                <>
                  {detailInquiry.gender && <DetailField label="Gender" value={detailInquiry.gender} />}
                  {detailInquiry.city && <DetailField icon={<MapPin size={14} />} label="City" value={detailInquiry.city} />}
                  {detailInquiry.state && <DetailField label="State" value={detailInquiry.state} />}
                  {detailInquiry.district && <DetailField label="District" value={detailInquiry.district} />}
                  {detailInquiry.pincode && <DetailField label="Pincode" value={detailInquiry.pincode} />}
                  {detailInquiry.address && <DetailField label="Address" value={detailInquiry.address} className="sm:col-span-2" />}
                  {detailInquiry.qualification && <DetailField label="Qualification" value={detailInquiry.qualification} />}
                  {detailInquiry.occupation && <DetailField label="Occupation" value={detailInquiry.occupation} />}
                  {detailInquiry.experience && <DetailField label="Experience" value={detailInquiry.experience} />}
                  {detailInquiry.space_available && <DetailField label="Space Available" value={detailInquiry.space_available} />}
                  {detailInquiry.investment_range && <DetailField label="Investment Range" value={detailInquiry.investment_range} />}
                  {detailInquiry.preferred_location && <DetailField label="Preferred Location" value={detailInquiry.preferred_location} />}
                  {detailInquiry.how_heard && <DetailField label="How Heard" value={detailInquiry.how_heard} />}
                  {detailInquiry.why_franchise && <DetailField label="Why Franchise" value={detailInquiry.why_franchise} className="sm:col-span-2" />}
                </>
              )}

              {/* Contact fields */}
              {detailInquiry.type === 'contact' && (
                <>
                  {detailInquiry.subject && <DetailField label="Subject" value={detailInquiry.subject} className="sm:col-span-2" />}
                  {detailInquiry.message && <DetailField label="Message" value={detailInquiry.message} className="sm:col-span-2" />}
                </>
              )}

              {/* Student registration fields */}
              {detailInquiry.type === 'student_registration' && (
                <>
                  {detailInquiry.father_name && <DetailField label="Father's Name" value={detailInquiry.father_name} />}
                  {detailInquiry.mother_name && <DetailField label="Mother's Name" value={detailInquiry.mother_name} />}
                  {detailInquiry.dob && <DetailField label="Date of Birth" value={format(new Date(detailInquiry.dob), 'dd MMM yyyy')} />}
                  {detailInquiry.course_interest && <DetailField label="Course Interest" value={detailInquiry.course_interest} />}
                  {detailInquiry.branch_preference && <DetailField label="Branch Preference" value={detailInquiry.branch_preference} />}
                  {detailInquiry.address && <DetailField label="Address" value={detailInquiry.address} className="sm:col-span-2" />}
                </>
              )}
            </div>

            {/* Notes section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Notes</h3>

              {/* Add note */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote() } }}
                  className={cn(inputClass, 'flex-1')}
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Add
                </button>
              </div>

              {/* Notes timeline */}
              {notesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
                </div>
              ) : detailNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {detailNotes.map(note => (
                    <div key={note.id} className="bg-gray-50 rounded-lg px-4 py-3">
                      <p className="text-sm text-gray-700">{note.note}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-400">{note.added_by_name || 'Admin'}</span>
                        <span className="text-xs text-gray-300">&bull;</span>
                        <span className="text-xs text-gray-400">{format(new Date(note.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add Inquiry Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={`Add ${activeTab === 'franchise' ? 'Franchise' : activeTab === 'contact' ? 'Contact' : 'Student Registration'} Inquiry`} size="lg">
        <form onSubmit={handleAddInquiry} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required>
              <input name="name" required className={inputClass} placeholder="Full name" />
            </FormField>
            <FormField label="Phone" required>
              <input name="phone" required className={inputClass} placeholder="Phone number" />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" className={inputClass} placeholder="Email address" />
            </FormField>
            <FormField label="Source">
              <select name="source" className={selectClass} defaultValue="manual">
                {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>

            {/* Franchise fields */}
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
                <FormField label="Alt Phone">
                  <input name="alt_phone" className={inputClass} placeholder="Alternative phone" />
                </FormField>
                <FormField label="City">
                  <input name="city" className={inputClass} placeholder="City" />
                </FormField>
                <FormField label="State">
                  <input name="state" className={inputClass} placeholder="State" />
                </FormField>
                <FormField label="District">
                  <input name="district" className={inputClass} placeholder="District" />
                </FormField>
                <FormField label="Pincode">
                  <input name="pincode" className={inputClass} placeholder="Pincode" />
                </FormField>
                <FormField label="Address" className="sm:col-span-2">
                  <input name="address" className={inputClass} placeholder="Full address" />
                </FormField>
                <FormField label="Qualification">
                  <input name="qualification" className={inputClass} placeholder="e.g. B.Tech" />
                </FormField>
                <FormField label="Occupation">
                  <input name="occupation" className={inputClass} placeholder="e.g. Business" />
                </FormField>
                <FormField label="Experience">
                  <input name="experience" className={inputClass} placeholder="e.g. 5 years" />
                </FormField>
                <FormField label="Space Available">
                  <input name="space_available" className={inputClass} placeholder="e.g. 800 sq ft" />
                </FormField>
                <FormField label="Investment Range">
                  <input name="investment_range" className={inputClass} placeholder="e.g. 5-10 Lakh" />
                </FormField>
                <FormField label="Preferred Location">
                  <input name="preferred_location" className={inputClass} placeholder="Preferred location" />
                </FormField>
                <FormField label="How Heard">
                  <input name="how_heard" className={inputClass} placeholder="e.g. Google, Referral" />
                </FormField>
                <FormField label="Why Franchise" className="sm:col-span-2">
                  <textarea name="why_franchise" rows={2} className={inputClass} placeholder="Reason for franchise interest" />
                </FormField>
              </>
            )}

            {/* Contact fields */}
            {activeTab === 'contact' && (
              <>
                <FormField label="Subject" className="sm:col-span-2">
                  <input name="subject" className={inputClass} placeholder="Inquiry subject" />
                </FormField>
                <FormField label="Message" className="sm:col-span-2">
                  <textarea name="message" rows={3} className={inputClass} placeholder="Message details" />
                </FormField>
              </>
            )}

            {/* Student registration fields */}
            {activeTab === 'student_registration' && (
              <>
                <FormField label="Father's Name">
                  <input name="father_name" className={inputClass} placeholder="Father's name" />
                </FormField>
                <FormField label="Mother's Name">
                  <input name="mother_name" className={inputClass} placeholder="Mother's name" />
                </FormField>
                <FormField label="Date of Birth">
                  <input name="dob" type="date" className={inputClass} />
                </FormField>
                <FormField label="Course Interest">
                  <input name="course_interest" className={inputClass} placeholder="e.g. ADCA, DCA" />
                </FormField>
                <FormField label="Branch Preference">
                  <input name="branch_preference" className={inputClass} placeholder="Preferred branch" />
                </FormField>
                <FormField label="Address" className="sm:col-span-2">
                  <input name="address" className={inputClass} placeholder="Full address" />
                </FormField>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
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
        loading={deleting}
      />
    </div>
  )
}

/* ─── Detail field component ─── */
function DetailField({ icon, label, value, className }: { icon?: React.ReactNode; label: string; value: string | null; className?: string }) {
  if (!value) return null
  return (
    <div className={cn('space-y-0.5', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  )
}
