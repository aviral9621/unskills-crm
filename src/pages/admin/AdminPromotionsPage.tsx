import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, deletePublicFile } from '../../lib/uploads'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'
import Modal from '../../components/Modal'
import FormField, { inputClass } from '../../components/FormField'

interface Row {
  id: string; title: string; description: string | null; file_url: string
  file_name: string | null; file_type: string | null; thumbnail_url: string | null
  is_active: boolean; created_at: string
}

export default function AdminPromotionsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('uce_promotional_materials').select('*').order('created_at', { ascending: false })
    setRows((data ?? []) as Row[])
  }
  useEffect(() => { load() }, [])

  async function upload() {
    if (!title || !file) return toast.error('Title and file required')
    setSaving(true)
    try {
      const path = `${Date.now()}-${file.name}`
      const publicUrl = await uploadPublicFile('promotions', path, file)
      const { error } = await supabase.from('uce_promotional_materials').insert({
        title, description: desc || null, file_url: publicUrl, file_name: file.name,
        file_type: file.type, uploaded_by: user?.id || null, is_active: true,
      })
      if (error) throw error
      toast.success('Uploaded'); setModalOpen(false); setTitle(''); setDesc(''); setFile(null); load()
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from('uce_promotional_materials').update({ is_active: !is_active }).eq('id', id)
    load()
  }
  async function remove(id: string) {
    if (!confirm('Delete permanently?')) return
    const row = rows.find(r => r.id === id)
    await supabase.from('uce_promotional_materials').delete().eq('id', id)
    if (row?.file_url) void deletePublicFile(row.file_url)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading">Promotion Material</h1>
          <p className="text-sm text-gray-500">Upload assets visible to all branches.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Upload
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 sm:col-span-2 lg:col-span-3">Nothing uploaded.</div>
        : rows.map(r => {
          const isImg = r.file_type?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(r.file_name || '')
          return (
            <div key={r.id} className={`rounded-xl border bg-white overflow-hidden ${!r.is_active ? 'opacity-50' : ''}`}>
              {isImg && <img src={r.file_url} alt="" className="w-full h-36 object-cover" />}
              <div className="p-3">
                <p className="font-semibold truncate">{r.title}</p>
                <p className="text-xs text-gray-400">{formatDateDDMMYYYY(r.created_at)}</p>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => toggle(r.id, r.is_active)} className="text-xs text-gray-600 hover:underline">
                    {r.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload Promotion Material">
        <div className="space-y-3">
          <FormField label="Title" required><input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} /></FormField>
          <FormField label="Description"><textarea rows={2} className={inputClass} value={desc} onChange={e => setDesc(e.target.value)} /></FormField>
          <FormField label="File" required>
            <label className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-red-400 cursor-pointer text-sm text-gray-500">
              <Upload size={16} />{file ? file.name : 'Choose file'}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </FormField>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">Cancel</button>
            <button onClick={upload} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Upload
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
