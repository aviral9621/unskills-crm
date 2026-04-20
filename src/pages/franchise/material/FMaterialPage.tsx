import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, FileText, Download, Trash2, Loader2, Upload } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { uploadPublicFile, deletePublicFile } from '../../../lib/uploads'
import { useAuth } from '../../../contexts/AuthContext'
import { useBranchId } from '../../../lib/franchise'
import Modal from '../../../components/Modal'
import FormField, { inputClass } from '../../../components/FormField'
import type { Course } from '../../../types'

interface Row {
  id: string; title: string; description: string | null; file_url: string
  file_name: string | null; uploaded_by_branch_id: string | null; created_at: string
  course: { name: string } | null
}

export default function FMaterialPage() {
  const { user } = useAuth()
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState('')
  const [courseId, setCourseId] = useState(''); const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('uce_study_materials')
      .select('id,title,description,file_url,file_name,uploaded_by_branch_id,created_at,course:uce_courses(name)')
      .eq('is_active', true).order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }
  useEffect(() => {
    load()
    supabase.from('uce_courses').select('*').eq('is_active', true).eq('approval_status', 'approved').order('name')
      .then(({ data }) => setCourses((data ?? []) as Course[]))
  }, [])

  async function upload() {
    if (!branchId) return
    if (!title || !courseId || !file) return toast.error('Fill all fields')
    if (!/\.pdf$/i.test(file.name)) return toast.error('Only PDF files allowed')
    setSaving(true)
    try {
      const path = `${branchId}/${Date.now()}-${file.name}`
      const publicUrl = await uploadPublicFile('promotions', path, file)
      const { error } = await supabase.from('uce_study_materials').insert({
        title, description: desc || null, course_id: courseId, file_url: publicUrl,
        file_name: file.name, file_size: file.size, uploaded_by: user?.id || null,
        uploaded_by_branch_id: branchId, is_active: true,
      })
      if (error) throw error
      toast.success('Material uploaded'); setModalOpen(false)
      setTitle(''); setDesc(''); setCourseId(''); setFile(null); load()
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this material?')) return
    const row = rows.find(r => r.id === id)
    await supabase.from('uce_study_materials').update({ is_active: false }).eq('id', id)
    if (row?.file_url) void deletePublicFile(row.file_url)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Study Material</h1>
          <p className="text-sm text-gray-500">Upload PDFs for your students; admin-shared materials also visible.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
          <Plus size={16} /> Upload PDF
        </button>
      </div>

      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">No materials yet.</div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.title}</p>
              <p className="text-xs text-gray-500">{r.course?.name}{r.uploaded_by_branch_id === null && <span className="ml-2 text-red-600">· Admin-shared</span>}</p>
            </div>
            <a href={r.file_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><Download size={16} /></a>
            {r.uploaded_by_branch_id === branchId && (
              <button onClick={() => remove(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload Study Material (PDF)">
        <div className="space-y-4">
          <FormField label="Title" required><input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} /></FormField>
          <FormField label="Course" required>
            <select className={inputClass} value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Description"><textarea rows={2} className={inputClass} value={desc} onChange={e => setDesc(e.target.value)} /></FormField>
          <FormField label="PDF File" required>
            <label className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-red-400 cursor-pointer text-sm text-gray-500">
              <Upload size={16} />{file ? file.name : 'Choose PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
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
