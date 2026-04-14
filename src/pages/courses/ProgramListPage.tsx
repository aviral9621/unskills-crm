import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Power, BookOpen, Loader2, Trash2, ArrowRight, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import type { Program } from '../../types'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'
import StatusBadge from '../../components/StatusBadge'

export default function ProgramListPage() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<(Program & { course_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Program | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)

  // Delete
  const [delTarget, setDelTarget] = useState<(Program & { course_count?: number }) | null>(null)
  const [delConfirm, setDelConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchPrograms() }, [])

  async function fetchPrograms() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_programs').select('*, uce_courses(id)').order('display_order').order('name')
      if (error) throw error
      const withCount = (data ?? []).map((p: Record<string, unknown>) => ({
        ...p,
        course_count: Array.isArray(p.uce_courses) ? p.uce_courses.length : 0,
      })) as (Program & { course_count: number })[]
      setPrograms(withCount)
    } catch { toast.error('Failed to load programs') }
    finally { setLoading(false) }
  }

  function openAdd() { setEditing(null); setName(''); setDescription(''); setIcon(''); setDisplayOrder(0); setModalOpen(true) }
  function openEdit(p: Program) { setEditing(p); setName(p.name); setDescription(p.description || ''); setIcon(p.icon || ''); setDisplayOrder(p.display_order); setModalOpen(true) }

  async function handleSave() {
    if (!name.trim()) { toast.error('Program name is required'); return }
    setSaving(true)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    try {
      if (editing) {
        const { error } = await supabase.from('uce_programs').update({ name, slug, description: description || null, icon: icon || null, display_order: displayOrder }).eq('id', editing.id)
        if (error) throw error; toast.success('Program updated')
      } else {
        const { error } = await supabase.from('uce_programs').insert({ name, slug, description: description || null, icon: icon || null, display_order: displayOrder })
        if (error) throw error; toast.success('Program created')
      }
      setModalOpen(false); fetchPrograms()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function toggleActive(p: Program) {
    const ns = !p.is_active
    const { error } = await supabase.from('uce_programs').update({ is_active: ns }).eq('id', p.id)
    if (error) { toast.error('Failed'); return }
    toast.success(`${p.name} ${ns ? 'activated' : 'deactivated'}`)
    setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, is_active: ns } : x))
  }

  async function handleDelete() {
    if (!delTarget) return
    if (delConfirm.trim() !== delTarget.name) { toast.error('Program name does not match'); return }
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_programs').delete().eq('id', delTarget.id)
      if (error) throw error
      toast.success(`Program "${delTarget.name}" deleted`)
      setPrograms(prev => prev.filter(p => p.id !== delTarget.id))
      setDelTarget(null); setDelConfirm('')
    } catch (err) { toast.error((err as Error).message || 'Failed to delete program') }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Programs</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Course categories</p></div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Program</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
      ) : programs.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><BookOpen size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No programs yet</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {programs.map(p => (
            <div key={p.id} className={cn('bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-all flex flex-col', !p.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0"><BookOpen size={20} className="text-red-500" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.course_count || 0} course{p.course_count === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <StatusBadge label={p.is_active ? 'Active' : 'Inactive'} variant={p.is_active ? 'success' : 'error'} />
              </div>
              {p.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{p.description}</p>}

              <button
                onClick={() => navigate(`/admin/courses?program=${p.id}`)}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                View Courses <ArrowRight size={13} />
              </button>

              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(p)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
                <button onClick={() => toggleActive(p)} title={p.is_active ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg ${p.is_active ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={14} /></button>
                <button onClick={() => { setDelTarget(p); setDelConfirm('') }} title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Program' : 'Add Program'} size="sm">
        <div className="space-y-4">
          <FormField label="Program Name" required><input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g., Computer Software Courses" /></FormField>
          <FormField label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} rows={2} placeholder="Optional" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Icon" hint="Lucide icon name"><input value={icon} onChange={e => setIcon(e.target.value)} className={inputClass} placeholder="Monitor" /></FormField>
            <FormField label="Display Order"><input type="number" value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} className={inputClass} min={0} /></FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Program Modal */}
      {delTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => !deleting && setDelTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900">Delete Program Permanently?</h3>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
              <button onClick={() => setDelTarget(null)} disabled={deleting} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                <p className="font-semibold mb-1.5">The following will be permanently deleted:</p>
                <ul className="space-y-1">
                  <li>• Program <b>{delTarget.name}</b></li>
                  <li>• <b>{delTarget.course_count ?? 0}</b> linked course{delTarget.course_count === 1 ? '' : 's'}</li>
                  <li>• All subjects, batches, students, marksheets, certificates, etc. tied to those courses</li>
                </ul>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Type <span className="font-mono font-bold text-red-600">{delTarget.name}</span> to confirm:
                </label>
                <input
                  value={delConfirm}
                  onChange={e => setDelConfirm(e.target.value)}
                  placeholder="Program name"
                  disabled={deleting}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setDelTarget(null)} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || delConfirm.trim() !== delTarget.name}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 size={16} className="animate-spin" />}
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
