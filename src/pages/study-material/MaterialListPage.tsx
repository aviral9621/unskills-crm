import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  FileText, Plus, Search, MoreVertical, Download, Trash2, Power,
  Upload, Loader2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { StudyMaterial, Program, Course, Subject } from '../../types'

const colHelper = createColumnHelper<StudyMaterial>()

function formatSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function MaterialListPage() {
  const { profile } = useAuth()
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Filters
  const [programs, setPrograms] = useState<Program[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [filterProgram, setFilterProgram] = useState('')
  const [filterCourse, setFilterCourse] = useState('')

  // Upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [formProgram, setFormProgram] = useState('')
  const [formCourse, setFormCourse] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Delete/Toggle
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    const h = () => setMenuOpen(null)
    window.addEventListener('scroll', h, true)
    return () => window.removeEventListener('scroll', h, true)
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [matRes, progRes, courseRes, subRes] = await Promise.all([
      supabase.from('uce_study_materials').select('*, course:uce_courses(name), subject:uce_subjects(name), program:uce_programs(name)').order('created_at', { ascending: false }),
      supabase.from('uce_programs').select('*').eq('is_active', true).order('display_order'),
      supabase.from('uce_courses').select('*').eq('is_active', true).order('name'),
      supabase.from('uce_subjects').select('*').eq('is_active', true).order('name'),
    ])
    setMaterials((matRes.data ?? []) as StudyMaterial[])
    setPrograms((progRes.data ?? []) as Program[])
    setCourses((courseRes.data ?? []) as Course[])
    setSubjects((subRes.data ?? []) as Subject[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let list = materials
    if (filterProgram) list = list.filter(m => m.program_id === filterProgram)
    if (filterCourse) list = list.filter(m => m.course_id === filterCourse)
    return list
  }, [materials, filterProgram, filterCourse])

  const filteredCourses = useMemo(() => formProgram ? courses.filter(c => c.program_id === formProgram) : courses, [courses, formProgram])
  const filteredSubjects = useMemo(() => formCourse ? subjects.filter(s => s.course_id === formCourse) : subjects, [subjects, formCourse])

  const openMenu = useCallback((id: string) => {
    const btn = menuBtnRefs.current.get(id); if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 192, window.innerWidth - 200)) })
    setMenuOpen(id)
  }, [])

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!uploadFile) { toast.error('Please select a file'); return }
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const get = (k: string) => (fd.get(k) as string)?.trim() || null

    try {
      const ext = uploadFile.name.split('.').pop() || 'pdf'
      const path = `study-materials/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, uploadFile)
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

      const { error } = await supabase.from('uce_study_materials').insert({
        program_id: get('program_id') || null,
        course_id: get('course_id'),
        subject_id: get('subject_id') || null,
        title: get('title'),
        description: get('description'),
        file_url: publicUrl,
        file_name: uploadFile.name,
        file_size: uploadFile.size,
        uploaded_by: profile?.id,
      })
      if (error) throw error
      setShowUpload(false)
      setUploadFile(null)
      setFormProgram('')
      setFormCourse('')
      fetchAll()
      toast.success('Material uploaded')
    } catch {
      toast.error('Failed to upload material')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(mat: StudyMaterial) {
    const { error } = await supabase.from('uce_study_materials').update({ is_active: !mat.is_active }).eq('id', mat.id)
    if (error) { toast.error('Failed to update'); return }
    setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, is_active: !m.is_active } : m))
    setMenuOpen(null)
    toast.success(mat.is_active ? 'Deactivated' : 'Activated')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_study_materials').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setMaterials(prev => prev.filter(m => m.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Material deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo(() => [
    colHelper.accessor('title', {
      header: 'Title',
      cell: i => (
        <div>
          <p className="font-medium text-gray-900">{i.getValue()}</p>
          {i.row.original.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{i.row.original.description}</p>}
        </div>
      ),
    }),
    colHelper.accessor('course', { header: 'Course', cell: i => <span className="text-gray-600">{i.getValue()?.name || '—'}</span> }),
    colHelper.accessor('subject', { header: 'Subject', cell: i => <span className="text-gray-600">{i.getValue()?.name || '—'}</span> }),
    colHelper.accessor('file_size', { header: 'Size', cell: i => <span className="text-gray-500 text-xs">{formatSize(i.getValue())}</span> }),
    colHelper.accessor('created_at', { header: 'Uploaded', cell: i => <span className="text-gray-500 text-xs">{format(new Date(i.getValue()), 'dd MMM yyyy')}</span> }),
    colHelper.accessor('is_active', { header: 'Status', cell: i => <StatusBadge label={i.getValue() ? 'Active' : 'Inactive'} variant={i.getValue() ? 'success' : 'neutral'} /> }),
    colHelper.display({
      id: 'actions', header: '',
      cell: i => (
        <button
          ref={el => { if (el) menuBtnRefs.current.set(i.row.original.id, el) }}
          onClick={() => menuOpen === i.row.original.id ? setMenuOpen(null) : openMenu(i.row.original.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
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
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Study Material</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload and manage study materials for courses</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
          <Plus size={18} /> Upload Material
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} className={cn(inputClass, 'pl-9')} />
        </div>
        <select value={filterProgram} onChange={e => { setFilterProgram(e.target.value); setFilterCourse('') }} className={cn(selectClass, 'sm:w-48')}>
          <option value="">All Programs</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={cn(selectClass, 'sm:w-48')}>
          <option value="">All Courses</option>
          {(filterProgram ? courses.filter(c => c.program_id === filterProgram) : courses).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <DataTable data={filtered} columns={columns} loading={loading} searchValue={search} pageSize={10} emptyIcon={<FileText size={40} strokeWidth={1.5} className="text-gray-300" />} emptyMessage="No study materials found" />

      {/* Context menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div className="fixed z-50 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 animate-in fade-in zoom-in-95 duration-150" style={{ top: menuPos.top, left: menuPos.left }}>
            {(() => {
              const mat = materials.find(m => m.id === menuOpen)
              if (!mat) return null
              return (
                <>
                  <a href={mat.file_url} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(null)} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Download size={15} className="text-gray-400" /> Download
                  </a>
                  <button onClick={() => { handleToggle(mat) }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Power size={15} className="text-gray-400" /> {mat.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => { setDeleteTarget(mat); setMenuOpen(null) }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50">
                    <Trash2 size={15} /> Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Upload modal */}
      <Modal open={showUpload} onClose={() => { setShowUpload(false); setUploadFile(null); setFormProgram(''); setFormCourse('') }} title="Upload Study Material" size="lg">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Program">
              <select name="program_id" className={selectClass} value={formProgram} onChange={e => { setFormProgram(e.target.value); setFormCourse('') }}>
                <option value="">Select program</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Course" required>
              <select name="course_id" required className={selectClass} value={formCourse} onChange={e => setFormCourse(e.target.value)}>
                <option value="">Select course</option>
                {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Subject">
              <select name="subject_id" className={selectClass}>
                <option value="">Select subject (optional)</option>
                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Title" required>
              <input name="title" required className={inputClass} placeholder="Material title" />
            </FormField>
            <FormField label="Description" className="sm:col-span-2">
              <input name="description" className={inputClass} placeholder="Brief description" />
            </FormField>
          </div>

          {/* File upload */}
          <FormField label="File" required>
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all',
                uploadFile ? 'border-green-300 bg-green-50/50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              )}
            >
              {uploadFile ? (
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                    <p className="text-xs text-gray-400">{formatSize(uploadFile.size)}</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadFile(null) }} className="p-1 rounded-full hover:bg-gray-200">
                    <X size={14} className="text-gray-500" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={20} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Click to upload PDF (max 10 MB)</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={e => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); e.target.value = '' }} />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowUpload(false); setUploadFile(null) }} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />} Upload
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Material" message={`Delete "${deleteTarget?.title}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </div>
  )
}
