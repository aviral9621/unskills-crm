import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Briefcase, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import { formatDateDDMMYYYY } from '../../../lib/utils'
import Modal from '../../../components/Modal'
import FormField, { inputClass } from '../../../components/FormField'

interface Row {
  id: string; title: string; company: string | null; location: string | null; job_type: string | null
  description: string | null; apply_url: string | null; contact_info: string | null; deadline: string | null
  is_active: boolean; branch_id: string | null; created_at: string
}

export default function FJobsPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', company: '', location: '', job_type: 'full_time', description: '', apply_url: '', contact_info: '', deadline: '' })

  async function load() {
    const { data } = await supabase.from('uce_jobs').select('*').eq('is_active', true).order('created_at', { ascending: false })
    setRows((data ?? []) as Row[])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!form.title) return toast.error('Title required')
    setSaving(true)
    const { error } = await supabase.from('uce_jobs').insert({
      ...form, branch_id: branchId, posted_by: user?.id || null,
      deadline: form.deadline || null,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Job posted')
    setModalOpen(false)
    setForm({ title: '', company: '', location: '', job_type: 'full_time', description: '', apply_url: '', contact_info: '', deadline: '' })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this job?')) return
    await supabase.from('uce_jobs').update({ is_active: false }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Jobs</h1>
          <p className="text-sm text-gray-500">Post opportunities; students see them in their panel + website.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Post Job
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 sm:col-span-2">
            <Briefcase size={28} className="mx-auto mb-2 text-gray-300" />No jobs yet.
          </div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-xs text-gray-500">{r.company} {r.location && `· ${r.location}`}</p>
              </div>
              {r.branch_id === branchId && (
                <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
              )}
            </div>
            {r.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{r.description}</p>}
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{r.deadline ? `By ${formatDateDDMMYYYY(r.deadline)}` : ''}</span>
              {r.apply_url && <a href={r.apply_url} target="_blank" rel="noreferrer" className="text-red-600 font-semibold hover:underline">Apply →</a>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Post a Job">
        <div className="space-y-3">
          <FormField label="Title" required><input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Company"><input className={inputClass} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></FormField>
            <FormField label="Location"><input className={inputClass} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></FormField>
          </div>
          <FormField label="Description"><textarea rows={3} className={inputClass} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Apply URL"><input className={inputClass} value={form.apply_url} onChange={e => setForm({ ...form, apply_url: e.target.value })} placeholder="https://..." /></FormField>
            <FormField label="Contact"><input className={inputClass} value={form.contact_info} onChange={e => setForm({ ...form, contact_info: e.target.value })} placeholder="Phone / email" /></FormField>
          </div>
          <FormField label="Deadline"><input type="date" className={inputClass} value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Post
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
