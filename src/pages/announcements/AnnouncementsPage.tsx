import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Megaphone, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'
import { formatDateDDMMYYYY } from '../../lib/utils'
import type { Branch, Course } from '../../types'

interface Row {
  id: string; title: string; body: string; target: string; target_id: string | null
  branch_id: string | null; is_active: boolean; created_at: string
  branch: { name: string } | null
  course: { name: string } | null
}

export default function AnnouncementsPage() {
  const { profile } = useAuth()
  const isSuper = profile?.role === 'super_admin'
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [form, setForm] = useState({ title: '', body: '', target: 'branch', target_id: '', branch_id: profile?.branch_id || '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('uce_announcements')
      .select('id,title,body,target,target_id,branch_id,is_active,created_at,branch:uce_branches(name)')
      .order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }

  useEffect(() => {
    load()
    if (isSuper) {
      supabase.from('uce_branches').select('*').eq('is_active', true).order('name').then(({ data }) => setBranches((data ?? []) as Branch[]))
    } else if (profile?.branch_id) {
      setForm(f => ({ ...f, branch_id: profile.branch_id! }))
    }
    supabase.from('uce_courses').select('*').eq('is_active', true).eq('approval_status', 'approved').order('name').then(({ data }) => setCourses((data ?? []) as Course[]))
  }, [isSuper, profile?.branch_id])

  async function save() {
    if (!form.title || !form.body) return toast.error('Title and body required')
    const branch_id = form.target === 'all' ? null : (form.branch_id || profile?.branch_id || null)
    if (form.target !== 'all' && !branch_id && !isSuper) return toast.error('Branch missing')

    setSaving(true)
    const { error } = await supabase.from('uce_announcements').insert({
      title: form.title, body: form.body,
      target: form.target,
      target_id: form.target === 'course' ? form.target_id || null : null,
      branch_id,
      created_by: profile?.id,
      is_active: true,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Announcement published')
    setModalOpen(false)
    setForm({ title: '', body: '', target: isSuper ? 'all' : 'branch', target_id: '', branch_id: profile?.branch_id || '' })
    load()
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from('uce_announcements').update({ is_active: !is_active, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('uce_announcements').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading">Announcements</h1>
          <p className="text-sm text-gray-500">Post updates visible on students' dashboards.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-red-700">
          <Plus size={14} /> New
        </button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
            <Megaphone size={28} className="mx-auto mb-2 text-gray-300" />No announcements yet.
          </div>
        ) : rows.map(r => (
          <div key={r.id} className={`rounded-xl border bg-white p-4 ${!r.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold break-words">{r.title}</p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">
                  Scope: {r.target}{r.branch?.name && ` · ${r.branch.name}`} · {formatDateDDMMYYYY(r.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggle(r.id, r.is_active)} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">
                  {r.is_active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">{r.body}</p>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Announcement">
        <div className="space-y-3">
          <FormField label="Title" required><input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></FormField>
          <FormField label="Body" required><textarea rows={4} className={inputClass} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></FormField>
          <FormField label="Scope">
            <select className={inputClass} value={form.target} onChange={e => setForm({ ...form, target: e.target.value, target_id: '' })}>
              {isSuper && <option value="all">All students (everywhere)</option>}
              <option value="branch">All students in a branch</option>
              <option value="course">All students on a specific course</option>
            </select>
          </FormField>
          {isSuper && form.target !== 'all' && (
            <FormField label="Branch" required>
              <select className={inputClass} value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">Select branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </select>
            </FormField>
          )}
          {form.target === 'course' && (
            <FormField label="Course" required>
              <select className={inputClass} value={form.target_id} onChange={e => setForm({ ...form, target_id: e.target.value })}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Publish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
