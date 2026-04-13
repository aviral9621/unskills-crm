import { useEffect, useState } from 'react'
import { Plus, Pencil, Power, BookOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import type { Program } from '../../types'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'
import StatusBadge from '../../components/StatusBadge'

export default function ProgramListPage() {
  const [programs, setPrograms] = useState<(Program & { course_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Program | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Programs</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Course categories</p></div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Program</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
      ) : programs.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><BookOpen size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No programs yet</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {programs.map(p => (
            <div key={p.id} className={cn('bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-all', !p.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0"><BookOpen size={20} className="text-red-500" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.course_count || 0} courses</p>
                  </div>
                </div>
                <StatusBadge label={p.is_active ? 'Active' : 'Inactive'} variant={p.is_active ? 'success' : 'error'} />
              </div>
              {p.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{p.description}</p>}
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
                <button onClick={() => toggleActive(p)} className={`p-1.5 rounded-lg ${p.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}><Power size={14} /></button>
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
    </div>
  )
}
