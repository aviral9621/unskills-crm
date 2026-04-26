import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Tag, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Cat {
  id: string
  name: string
  is_active: boolean
  is_system: boolean
}

export default function IncomeCategoriesPage() {
  const navigate = useNavigate()
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [delTarget, setDelTarget] = useState<Cat | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_income_categories')
        .select('id, name, is_active, is_system')
        .order('is_system', { ascending: false })
        .order('name')
      if (error) throw error
      setCats((data ?? []) as Cat[])
    } catch { toast.error('Failed to load categories') }
    finally { setLoading(false) }
  }

  async function save() {
    if (!name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase.from('uce_income_categories').update({ name: name.trim() }).eq('id', editId)
        if (error) throw error
        toast.success('Category updated')
      } else {
        const { error } = await supabase.from('uce_income_categories').insert({ name: name.trim(), is_active: true, is_system: false })
        if (error) {
          if (String(error.message).includes('duplicate')) toast.error('A category with this name already exists')
          else throw error
          return
        }
        toast.success('Category added')
      }
      setShowModal(false); setEditId(null); setName('')
      load()
    } catch { toast.error('Failed to save category') }
    finally { setSaving(false) }
  }

  async function toggleActive(c: Cat) {
    try {
      const { error } = await supabase.from('uce_income_categories').update({ is_active: !c.is_active }).eq('id', c.id)
      if (error) throw error
      setCats(p => p.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
    } catch { toast.error('Failed to update') }
  }

  async function doDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_income_categories').delete().eq('id', delTarget.id)
      if (error) {
        const { error: e2 } = await supabase.from('uce_income_categories').update({ is_active: false }).eq('id', delTarget.id)
        if (e2) throw e2
        toast.warning('Category was used by existing income — disabled instead of deleted')
      } else {
        toast.success('Category deleted')
      }
      load()
    } catch { toast.error('Failed') }
    finally { setDeleting(false); setDelTarget(null) }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/reports/income')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Income Categories</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage which categories appear when adding income</p>
        </div>
        <button onClick={() => { setEditId(null); setName(''); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm">
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> Loading…</div>
        ) : cats.length === 0 ? (
          <div className="p-12 text-center text-gray-400"><Tag size={36} className="mx-auto mb-2 text-gray-300" /><p className="text-sm">No categories yet</p></div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cats.map(c => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60">
                <Tag size={14} className={c.is_active ? 'text-green-500' : 'text-gray-300'} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${c.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{c.name}</p>
                  {c.is_system && <p className="text-[10px] text-amber-600 font-semibold mt-0.5 inline-flex items-center gap-1"><Lock size={10} /> SYSTEM DEFAULT</p>}
                </div>
                <button onClick={() => toggleActive(c)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.is_active ? 'Active' : 'Hidden'}
                </button>
                <button onClick={() => { setEditId(c.id); setName(c.name); setShowModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
                {!c.is_system && (
                  <button onClick={() => setDelTarget(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Category' : 'Add Category'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category Name <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Workshop Income"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving…' : (editId ? 'Update' : 'Add')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={doDelete}
        title="Delete Category?"
        message={`Delete "${delTarget?.name}"? If it's used by existing income it will be hidden instead.`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
