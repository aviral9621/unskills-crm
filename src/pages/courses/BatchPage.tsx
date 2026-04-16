import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createColumnHelper } from '@tanstack/react-table'
import { ArrowLeft, Plus, Pencil, Trash2, Layers, Loader2, Power, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDate, cn } from '../../lib/utils'
import type { Batch, Course } from '../../types'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import StatusBadge from '../../components/StatusBadge'
import ConfirmDialog from '../../components/ConfirmDialog'

const colHelper = createColumnHelper<Batch>()

export default function BatchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const courseIdParam = searchParams.get('course')

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState(courseIdParam || '')
  const [courseName, setCourseName] = useState('')
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<Batch | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [bName, setBName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxStudents, setMaxStudents] = useState('')

  useEffect(() => { fetchCourses() }, [])
  useEffect(() => { if (selectedCourse) fetchBatches() }, [selectedCourse])

  async function fetchCourses() {
    const { data } = await supabase.from('uce_courses').select('id, name, code').eq('is_active', true).order('name')
    setCourses((data ?? []) as Course[])
    if (courseIdParam) { const c = data?.find((x: { id: string }) => x.id === courseIdParam); if (c) setCourseName((c as { name: string }).name) }
    setLoading(false)
  }

  async function fetchBatches() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_batches').select('*').eq('course_id', selectedCourse).order('created_at', { ascending: false })
      if (error) throw error
      setBatches(data ?? [])
      const c = courses.find(x => x.id === selectedCourse); if (c) setCourseName(c.name)
    } catch { toast.error('Failed to load batches') }
    finally { setLoading(false) }
  }

  function openAdd() { setEditing(null); setBName(''); setStartDate(''); setEndDate(''); setMaxStudents(''); setModalOpen(true) }
  function openEdit(b: Batch) { setEditing(b); setBName(b.name); setStartDate(b.start_date || ''); setEndDate(b.end_date || ''); setMaxStudents(b.max_students?.toString() || ''); setModalOpen(true) }

  async function handleSave() {
    if (!bName.trim()) { toast.error('Batch name is required'); return }
    if (!selectedCourse) { toast.error('Select a course first'); return }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      toast.error('End date must be after start date'); return
    }
    if (maxStudents && parseInt(maxStudents) < 1) {
      toast.error('Max students must be at least 1'); return
    }
    setSaving(true)
    try {
      const payload = { course_id: selectedCourse, name: bName.trim(), start_date: startDate || null, end_date: endDate || null, max_students: maxStudents ? parseInt(maxStudents) : null }
      if (editing) {
        const { error } = await supabase.from('uce_batches').update(payload).eq('id', editing.id)
        if (error) throw error; toast.success('Batch updated')
      } else {
        const { error } = await supabase.from('uce_batches').insert(payload)
        if (error) throw error; toast.success('Batch created')
      }
      setModalOpen(false); fetchBatches()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!delTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_batches').delete().eq('id', delTarget.id)
      if (error) throw error; toast.success('Batch deleted'); setBatches(p => p.filter(x => x.id !== delTarget.id))
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDelTarget(null) }
  }

  async function toggleActive(b: Batch) {
    const ns = !b.is_active
    const { error } = await supabase.from('uce_batches').update({ is_active: ns }).eq('id', b.id)
    if (error) { toast.error('Failed'); return }
    toast.success(`Batch ${ns ? 'activated' : 'deactivated'}`)
    setBatches(p => p.map(x => x.id === b.id ? { ...x, is_active: ns } : x))
  }

  const columns = useMemo(() => [
    colHelper.accessor('name', { header: 'Batch Name', cell: i => <span className="text-sm font-medium text-gray-900">{i.getValue()}</span> }),
    colHelper.accessor('start_date', { header: 'Start', cell: i => <span className="text-sm text-gray-600">{i.getValue() ? formatDate(i.getValue()!) : '—'}</span> }),
    colHelper.accessor('end_date', { header: 'End', cell: i => <span className="text-sm text-gray-600">{i.getValue() ? formatDate(i.getValue()!) : '—'}</span> }),
    colHelper.accessor('max_students', { header: 'Max Students', cell: i => <span className="text-sm text-gray-600">{i.getValue() || 'Unlimited'}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'error'} /> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
        <button onClick={() => toggleActive(i.row.original)} className={`p-1.5 rounded-lg ${i.row.original.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={14} /></button>
        <button onClick={() => setDelTarget(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )}),
  ], [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/courses')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0"><ArrowLeft size={18} className="text-gray-600" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading truncate">Batches{courseName ? ` — ${courseName}` : ''}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage course batches</p>
        </div>
        {selectedCourse && <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add</button>}
      </div>

      {!courseIdParam && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <FormField label="Select Course" required>
            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className={selectClass}>
              <option value="">Choose a course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </FormField>
        </div>
      )}

      {selectedCourse && (
        <>
          <div className="md:hidden">
            {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
            : batches.length === 0 ? <div className="bg-white rounded-xl border p-10 text-center"><Layers size={32} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No batches yet</p></div>
            : <div className="space-y-2">{batches.map(b => (
              <div key={b.id} className={cn('bg-white rounded-xl border border-gray-200 p-3.5', !b.is_active && 'opacity-60')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      {b.start_date && <span>{formatDate(b.start_date)}</span>}
                      {b.start_date && b.end_date && <span>→</span>}
                      {b.end_date && <span>{formatDate(b.end_date)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.max_students && <span className="text-xs text-gray-500 flex items-center gap-0.5"><Users size={11} />{b.max_students}</span>}
                    <StatusBadge label={b.is_active ? 'Active' : 'Inactive'} variant={b.is_active ? 'success' : 'error'} />
                  </div>
                </div>
                <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
                  <button onClick={() => toggleActive(b)} className={`p-1.5 rounded-lg ${b.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={14} /></button>
                  <button onClick={() => setDelTarget(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}</div>}
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
            <DataTable data={batches} columns={columns} loading={loading} emptyIcon={<Layers size={36} className="text-gray-300" />} emptyMessage="No batches yet" />
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Batch' : 'Add Batch'} size="sm">
        <div className="space-y-4">
          <FormField label="Batch Name" required><input value={bName} onChange={e => setBName(e.target.value)} className={inputClass} placeholder="e.g., Morning 7AM-9AM" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} /></FormField>
            <FormField label="End Date"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} /></FormField>
          </div>
          <FormField label="Max Students" hint="Leave empty for unlimited"><input type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} className={inputClass} placeholder="e.g., 30" min={1} /></FormField>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}
        title="Delete Batch?" message={`"${delTarget?.name}" will be permanently removed.`} confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
