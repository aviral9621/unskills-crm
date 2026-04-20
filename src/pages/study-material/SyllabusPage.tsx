import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  FileText, Plus, Search, MoreVertical, Download, Trash2, Power,
  Upload, Loader2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, deletePublicFile } from '../../lib/uploads'
import { cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { Syllabus, Course, Subject } from '../../types'

const colHelper = createColumnHelper<Syllabus>()

export default function SyllabusPage() {
  const [items, setItems] = useState<Syllabus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [filterCourse, setFilterCourse] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [formCourse, setFormCourse] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [deleteTarget, setDeleteTarget] = useState<Syllabus | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { const h = () => setMenuOpen(null); window.addEventListener('scroll', h, true); return () => window.removeEventListener('scroll', h, true) }, [])

  async function fetchAll() {
    setLoading(true)
    const [syllRes, courseRes, subRes] = await Promise.all([
      supabase.from('uce_syllabus').select('*, course:uce_courses(name), subject:uce_subjects(name)').order('created_at', { ascending: false }),
      supabase.from('uce_courses').select('*').eq('is_active', true).order('name'),
      supabase.from('uce_subjects').select('*').eq('is_active', true).order('name'),
    ])
    setItems((syllRes.data ?? []) as Syllabus[])
    setCourses((courseRes.data ?? []) as Course[])
    setSubjects((subRes.data ?? []) as Subject[])
    setLoading(false)
  }

  const filtered = useMemo(() => filterCourse ? items.filter(i => i.course_id === filterCourse) : items, [items, filterCourse])
  const filteredSubjects = useMemo(() => formCourse ? subjects.filter(s => s.course_id === formCourse) : subjects, [subjects, formCourse])

  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id); if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const get = (k: string) => (fd.get(k) as string)?.trim() || null

    try {
      let fileUrl: string | null = null
      let fileName: string | null = null
      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop() || 'pdf'
        const path = `syllabus/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        fileUrl = await uploadPublicFile('documents', path, uploadFile)
        fileName = uploadFile.name
      }

      const { error } = await supabase.from('uce_syllabus').insert({
        course_id: get('course_id'),
        subject_id: get('subject_id') || null,
        title: get('title'),
        description: get('description'),
        file_url: fileUrl,
        file_name: fileName,
      })
      if (error) throw error
      setShowModal(false); setUploadFile(null); setFormCourse('')
      fetchAll()
      toast.success('Syllabus added')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleToggle(item: Syllabus) {
    const { error } = await supabase.from('uce_syllabus').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { toast.error('Failed'); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
    setMenuOpen(null)
    toast.success(item.is_active ? 'Deactivated' : 'Activated')
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_syllabus').delete().eq('id', deleteTarget.id)
      if (error) throw error
      void deletePublicFile(deleteTarget.file_url)
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false) }
  }

  const columns = useMemo(() => [
    colHelper.accessor('title', { header: 'Title', cell: i => <span className="font-medium text-gray-900">{i.getValue()}</span> }),
    colHelper.accessor('course', { header: 'Course', cell: i => <span className="text-gray-600">{i.getValue()?.name || '—'}</span> }),
    colHelper.accessor('subject', { header: 'Subject', cell: i => <span className="text-gray-600">{i.getValue()?.name || '—'}</span> }),
    colHelper.accessor('file_url', { header: 'File', cell: i => i.getValue() ? <a href={i.getValue()!} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline text-xs flex items-center gap-1"><Download size={12} /> Download</a> : <span className="text-gray-400 text-xs">No file</span> }),
    colHelper.accessor('created_at', { header: 'Date', cell: i => <span className="text-gray-500 text-xs">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'neutral'} /> }),
    colHelper.display({
      id: 'actions', header: '',
      cell: i => (
        <button ref={el => { if (el) menuBtnRefs.current.set(i.row.original.id, el) }} onClick={() => menuOpen === i.row.original.id ? setMenuOpen(null) : openMenu(i.row.original.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <MoreVertical size={16} />
        </button>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [menuOpen])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Syllabus</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage syllabus files for courses and subjects</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
          <Plus size={18} /> Add Syllabus
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search syllabus..." value={search} onChange={e => setSearch(e.target.value)} className={cn(inputClass, 'pl-9')} />
        </div>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={cn(selectClass, 'sm:w-48')}>
          <option value="">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <DataTable data={filtered} columns={columns} loading={loading} searchValue={search} pageSize={10} emptyIcon={<FileText size={40} strokeWidth={1.5} className="text-gray-300" />} emptyMessage="No syllabus found" />

      {/* Context menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div className="fixed z-50 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 animate-in fade-in zoom-in-95 duration-150" style={{ top: menuPos.top, left: menuPos.left }}>
            {(() => {
              const item = items.find(i => i.id === menuOpen)
              if (!item) return null
              return (
                <>
                  {item.file_url && <a href={item.file_url} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(null)} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Download size={15} className="text-gray-400" /> Download</a>}
                  <button onClick={() => handleToggle(item)} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Power size={15} className="text-gray-400" /> {item.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => { setDeleteTarget(item); setMenuOpen(null) }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"><Trash2 size={15} /> Delete</button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Add modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setUploadFile(null); setFormCourse('') }} title="Add Syllabus" size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Course" required>
              <select name="course_id" required className={selectClass} value={formCourse} onChange={e => setFormCourse(e.target.value)}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Subject">
              <select name="subject_id" className={selectClass}>
                <option value="">Select subject (optional)</option>
                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Title" required>
              <input name="title" required className={inputClass} placeholder="Syllabus title" />
            </FormField>
            <FormField label="Description">
              <input name="description" className={inputClass} placeholder="Brief description" />
            </FormField>
          </div>
          <FormField label="File (PDF)">
            <div onClick={() => fileRef.current?.click()} className={cn('flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all', uploadFile ? 'border-green-300 bg-green-50/50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50')}>
              {uploadFile ? (
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-green-600" />
                  <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null) }} className="p-1 rounded-full hover:bg-gray-200"><X size={14} className="text-gray-500" /></button>
                </div>
              ) : (
                <><Upload size={20} className="text-gray-400" /><p className="text-xs text-gray-500">Click to upload PDF</p></>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); e.target.value = '' }} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setUploadFile(null) }} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Syllabus" message={`Delete "${deleteTarget?.title}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </div>
  )
}
