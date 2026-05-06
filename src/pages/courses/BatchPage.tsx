import { useEffect, useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Loader2, Users, Clock, Calendar, GraduationCap, Search } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../lib/utils'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import StatusBadge from '../../components/StatusBadge'
import type { Batch } from '../../types'

interface Teacher { id: string; name: string; designation: string | null }
interface BatchRow extends Batch {
  teacher?: { id: string; name: string } | null
  enrolled_count?: number
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ap = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ap}`
}

export default function BatchPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [batches, setBatches] = useState<BatchRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<BatchRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxStudents, setMaxStudents] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    let bq = supabase.from('uce_batches')
      .select('id, name, start_date, end_date, start_time, end_time, max_students, is_active, created_at, course_id, branch_id, teacher_id, teacher:uce_employees!uce_batches_teacher_id_fkey(id, name)')
      .order('created_at', { ascending: false })
    if (!isSuperAdmin && branchId) bq = bq.eq('branch_id', branchId)
    const [bRes, tRes, cntRes] = await Promise.all([
      bq,
      (() => {
        let tq = supabase.from('uce_employees').select('id, name, designation').eq('is_active', true).order('name')
        if (!isSuperAdmin && branchId) tq = tq.eq('branch_id', branchId)
        return tq
      })(),
      // count enrolled per batch
      supabase.from('uce_students').select('batch_id').not('batch_id', 'is', null),
    ])
    const counts: Record<string, number> = {}
    ;(cntRes.data ?? []).forEach((r: { batch_id: string | null }) => {
      if (r.batch_id) counts[r.batch_id] = (counts[r.batch_id] || 0) + 1
    })
    const rows = ((bRes.data ?? []) as unknown as BatchRow[]).map(b => ({ ...b, enrolled_count: counts[b.id] || 0 }))
    setBatches(rows)
    setTeachers((tRes.data ?? []) as Teacher[])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setName(''); setStartTime(''); setEndTime(''); setStartDate(''); setEndDate('')
    setMaxStudents(''); setTeacherId(''); setActive(true)
    setOpen(true)
  }

  function openEdit(b: BatchRow) {
    setEditing(b)
    setName(b.name)
    setStartTime(b.start_time?.slice(0, 5) || '')
    setEndTime(b.end_time?.slice(0, 5) || '')
    setStartDate(b.start_date || '')
    setEndDate(b.end_date || '')
    setMaxStudents(b.max_students?.toString() || '')
    setTeacherId(b.teacher_id || '')
    setActive(b.is_active ?? true)
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Batch name is required'); return }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      toast.error('End date must be after start date'); return
    }
    if (startTime && endTime && endTime <= startTime) {
      toast.error('End time must be after start time'); return
    }
    if (maxStudents && parseInt(maxStudents) < 1) {
      toast.error('Max students must be at least 1'); return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        max_students: maxStudents ? parseInt(maxStudents) : null,
        teacher_id: teacherId || null,
        branch_id: branchId || null,
        is_active: active,
      }
      if (editing) {
        const { error } = await supabase.from('uce_batches').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Batch updated')
      } else {
        const { error } = await supabase.from('uce_batches').insert(payload)
        if (error) throw error
        toast.success('Batch created')
      }
      setOpen(false)
      loadAll()
    } catch (e) {
      toast.error('Failed to save: ' + (e as Error).message)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_batches').delete().eq('id', delTarget.id)
      if (error) throw error
      toast.success('Batch deleted')
      setDelTarget(null)
      loadAll()
    } catch (e) {
      toast.error('Cannot delete: ' + (e as Error).message)
    } finally { setDeleting(false) }
  }

  const filtered = useMemo(() => {
    if (!search) return batches
    const q = search.toLowerCase()
    return batches.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.teacher?.name?.toLowerCase().includes(q)
    )
  }, [batches, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Batches</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{batches.length} total batches</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm">
          <Plus size={16} /> Add New Batch
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by batch or teacher…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Users size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No batches yet. Click "Add New Batch" to create one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Batch</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Timing</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Duration</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Teacher</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Capacity</th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const cap = b.max_students || 0
                  const used = b.enrolled_count || 0
                  const full = cap > 0 && used >= cap
                  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
                  return (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{b.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.start_time || b.end_time ? (
                          <span className="inline-flex items-center gap-1 text-xs"><Clock size={12} />{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {b.start_date || b.end_date ? (
                          <span className="inline-flex items-center gap-1"><Calendar size={12} />{b.start_date ? formatDate(b.start_date) : '—'} → {b.end_date ? formatDate(b.end_date) : 'ongoing'}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {b.teacher ? (
                          <span className="inline-flex items-center gap-1 text-gray-700"><GraduationCap size={12} className="text-red-500" />{b.teacher.name}</span>
                        ) : <span className="text-gray-300 text-xs">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className={`text-xs font-bold ${full ? 'text-red-600' : 'text-gray-900'}`}>
                            {used}{cap > 0 ? ` / ${cap}` : ''}
                          </span>
                          {cap > 0 && (
                            <div className="h-1 w-20 bg-gray-100 rounded-full mt-1">
                              <div className={`h-1 rounded-full ${full ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge label={b.is_active ? 'Active' : 'Inactive'} variant={b.is_active ? 'success' : 'neutral'} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDelTarget(b)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Batch' : 'Add New Batch'} size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Batch Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Batch 1"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Max Students (Capacity)</label>
              <input type="number" min={1} value={maxStudents} onChange={e => setMaxStudents(e.target.value)} placeholder="e.g. 30"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Assign Teacher</label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
                <option value="">No teacher</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.designation ? ` — ${t.designation}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            Active (available for student enrollment)
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Save Changes' : 'Create Batch'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete batch?"
        message={delTarget ? `Delete "${delTarget.name}"? Students enrolled in this batch will be unlinked, and all attendance records will be removed.` : ''} />
    </div>
  )
}
