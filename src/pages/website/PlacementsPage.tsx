import { useEffect, useState } from 'react'
import { Plus, Trash2, Power, Image, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Placement {
  id: string
  name: string
  role: string
  company: string
  photo_url: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

interface FormState {
  name: string
  role: string
  company: string
  file: File | null
  preview: string
}

const EMPTY_FORM: FormState = { name: '', role: '', company: '', file: null, preview: '' }

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export default function PlacementsPage() {
  const { user } = useAuth()
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Placement | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Placement | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_placements')
        .select('*')
        .order('display_order')
        .order('created_at')
      if (error) throw error
      setPlacements(data ?? [])
    } catch { toast.error('Failed to load placements') }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(p: Placement) {
    setEditTarget(p)
    setForm({ name: p.name, role: p.role, company: p.company, file: null, preview: p.photo_url || '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.role.trim() || !form.company.trim()) {
      toast.error('Name, role, and company are required')
      return
    }
    setSaving(true)
    try {
      let photoUrl = editTarget?.photo_url ?? null
      if (form.file) {
        const ext = form.file.name.split('.').pop() || 'jpg'
        const path = `placements/${Date.now()}.${ext}`
        photoUrl = await uploadPublicFile(STORAGE_BUCKETS.website, path, form.file)
      }

      if (editTarget) {
        const { error } = await supabase
          .from('uce_placements')
          .update({ name: form.name, role: form.role, company: form.company, photo_url: photoUrl })
          .eq('id', editTarget.id)
        if (error) throw error
        toast.success('Updated')
      } else {
        const nextOrder = placements.length
        const { error } = await supabase
          .from('uce_placements')
          .insert({ name: form.name, role: form.role, company: form.company, photo_url: photoUrl, display_order: nextOrder, created_by: user?.id })
        if (error) throw error
        toast.success('Student added')
      }

      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Placement) {
    try {
      const { error } = await supabase
        .from('uce_placements')
        .update({ is_active: !p.is_active })
        .eq('id', p.id)
      if (error) throw error
      setPlacements(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
      toast.success(p.is_active ? 'Hidden from website' : 'Visible on website')
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_placements').delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Deleted')
      setDeleteTarget(null)
      load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <Users size={20} className="text-red-600" /> Our Placements
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage placed students shown on the public website</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
        >
          <Plus size={16} /> Add Student
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-200 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : placements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Users size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No placed students yet</p>
          <p className="text-sm mt-1">Click "Add Student" to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Company</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {placements.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{getInitials(p.name)}</span>
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">{p.role}</td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">{p.company}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Image size={15} />
                      </button>
                      <button
                        onClick={() => toggleActive(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        title={p.is_active ? 'Hide from website' : 'Show on website'}
                      >
                        <Power size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          title={editTarget ? 'Edit Placed Student' : 'Add Placed Student'}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4 p-1">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Student Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Rajnesh Singh"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Role / Designation *</label>
              <input
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                placeholder="e.g. Accounts Executive"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Company / Workplace *</label>
              <input
                value={form.company}
                onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                placeholder="e.g. Private Firm, Jaunpur"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Photo (optional)</label>
              <div className="flex items-center gap-3">
                {form.preview ? (
                  <img src={form.preview} alt="preview" className="w-14 h-14 rounded-full object-cover ring-1 ring-gray-200 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                    <Image size={18} />
                  </div>
                )}
                <label className="cursor-pointer text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">
                  {form.preview ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setForm(p => ({ ...p, file: f, preview: URL.createObjectURL(f) }))
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {saving && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {editTarget ? 'Save Changes' : 'Add Student'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Placed Student"
        description={`Remove "${deleteTarget?.name}" from the placements list? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
