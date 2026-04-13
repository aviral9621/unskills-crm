import { useEffect, useState, useMemo } from 'react'
import {
  Video, Plus, Search, Pencil, Trash2, Power,
  ExternalLink, Loader2, Monitor, Clock, Calendar, Play,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { OnlineClass, Course, Subject, ClassPlatform } from '../../types'

const PLATFORM_META: Record<ClassPlatform, { label: string; color: string; icon: React.ReactNode }> = {
  youtube: { label: 'YouTube', color: 'bg-red-100 text-red-700', icon: <Play size={18} /> },
  zoom: { label: 'Zoom', color: 'bg-blue-100 text-blue-700', icon: <Video size={18} /> },
  google_meet: { label: 'Google Meet', color: 'bg-green-100 text-green-700', icon: <Monitor size={18} /> },
}

export default function ClassesPage() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState<OnlineClass[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [filterPlatform, setFilterPlatform] = useState<ClassPlatform | ''>('')
  const [filterCourse, setFilterCourse] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<OnlineClass | null>(null)
  const [saving, setSaving] = useState(false)
  const [formPlatform, setFormPlatform] = useState<ClassPlatform>('youtube')
  const [formCourse, setFormCourse] = useState('')

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<OnlineClass | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [classRes, courseRes, subRes] = await Promise.all([
      supabase.from('uce_online_classes').select('*, course:uce_courses(name), subject:uce_subjects(name)').order('schedule_date', { ascending: false, nullsFirst: false }),
      supabase.from('uce_courses').select('*').eq('is_active', true).order('name'),
      supabase.from('uce_subjects').select('*').eq('is_active', true).order('name'),
    ])
    setClasses((classRes.data ?? []) as OnlineClass[])
    setCourses((courseRes.data ?? []) as Course[])
    setSubjects((subRes.data ?? []) as Subject[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let list = classes
    if (filterPlatform) list = list.filter(c => c.platform === filterPlatform)
    if (filterCourse) list = list.filter(c => c.course_id === filterCourse)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.class_name.toLowerCase().includes(q) || c.course?.name?.toLowerCase().includes(q))
    }
    return list
  }, [classes, filterPlatform, filterCourse, search])

  const filteredSubjects = useMemo(() => formCourse ? subjects.filter(s => s.course_id === formCourse) : subjects, [subjects, formCourse])

  function openAdd() {
    setEditItem(null); setFormPlatform('youtube'); setFormCourse(''); setShowModal(true)
  }

  function openEdit(item: OnlineClass) {
    setEditItem(item); setFormPlatform(item.platform); setFormCourse(item.course_id); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const get = (k: string) => (fd.get(k) as string)?.trim() || null

    const payload = {
      course_id: get('course_id'),
      subject_id: get('subject_id') || null,
      platform: formPlatform,
      class_name: get('class_name'),
      class_code: get('class_code'),
      link: get('link'),
      meeting_id: get('meeting_id') || null,
      meeting_password: get('meeting_password') || null,
      schedule_date: get('schedule_date') || null,
      schedule_time: get('schedule_time') || null,
      end_time: get('end_time') || null,
    }

    try {
      if (editItem) {
        const { error } = await supabase.from('uce_online_classes').update(payload).eq('id', editItem.id)
        if (error) throw error
        toast.success('Class updated')
      } else {
        const { error } = await supabase.from('uce_online_classes').insert({ ...payload, created_by: profile?.id })
        if (error) throw error
        toast.success('Class scheduled')
      }
      setShowModal(false); setEditItem(null)
      fetchAll()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleToggle(item: OnlineClass) {
    const { error } = await supabase.from('uce_online_classes').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { toast.error('Failed'); return }
    setClasses(prev => prev.map(c => c.id === item.id ? { ...c, is_active: !c.is_active } : c))
    toast.success(item.is_active ? 'Deactivated' : 'Activated')
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_online_classes').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setClasses(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null); toast.success('Deleted')
    } catch { toast.error('Failed') }
    finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Online Classes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule and manage YouTube, Zoom, and Google Meet classes</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
          <Plus size={18} /> Schedule Class
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} className={cn(inputClass, 'pl-9')} />
        </div>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value as ClassPlatform | '')} className={cn(selectClass, 'sm:w-40')}>
          <option value="">All Platforms</option>
          <option value="youtube">YouTube</option>
          <option value="zoom">Zoom</option>
          <option value="google_meet">Google Meet</option>
        </select>
        <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className={cn(selectClass, 'sm:w-48')}>
          <option value="">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Class cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Video size={40} strokeWidth={1.5} className="text-gray-300" />
          <p className="mt-3 text-sm">No online classes found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(cls => {
            const meta = PLATFORM_META[cls.platform]
            return (
              <div key={cls.id} className={cn('bg-white rounded-xl border border-gray-200 p-5 transition-shadow hover:shadow-md', !cls.is_active && 'opacity-60')}>
                {/* Platform badge + name */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', meta.color)}>
                      {meta.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{cls.class_name}</h3>
                      <span className="text-xs text-gray-400">{meta.label}</span>
                    </div>
                  </div>
                  {!cls.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Inactive</span>}
                </div>

                {/* Course/subject */}
                <div className="space-y-1 mb-3 text-xs text-gray-500">
                  <p>Course: <span className="text-gray-700 font-medium">{cls.course?.name || '—'}</span></p>
                  {cls.subject?.name && <p>Subject: <span className="text-gray-700">{cls.subject.name}</span></p>}
                </div>

                {/* Schedule */}
                {(cls.schedule_date || cls.schedule_time) && (
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    {cls.schedule_date && <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(cls.schedule_date), 'dd MMM yyyy')}</span>}
                    {cls.schedule_time && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {cls.schedule_time.slice(0, 5)}{cls.end_time ? ` – ${cls.end_time.slice(0, 5)}` : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Zoom details */}
                {cls.platform === 'zoom' && cls.meeting_id && (
                  <div className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                    <p>Meeting ID: <span className="font-mono text-gray-700">{cls.meeting_id}</span></p>
                    {cls.meeting_password && <p>Password: <span className="font-mono text-gray-700">{cls.meeting_password}</span></p>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <a href={cls.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors">
                    <ExternalLink size={13} /> Open Link
                  </a>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => openEdit(cls)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleToggle(cls)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><Power size={14} /></button>
                    <button onClick={() => setDeleteTarget(cls)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Schedule / Edit modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditItem(null) }} title={editItem ? 'Edit Class' : 'Schedule Class'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Platform radio */}
          <FormField label="Platform" required>
            <div className="flex gap-3">
              {(['youtube', 'zoom', 'google_meet'] as ClassPlatform[]).map(p => {
                const m = PLATFORM_META[p]
                return (
                  <button
                    key={p} type="button"
                    onClick={() => setFormPlatform(p)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                      formPlatform === p ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {m.icon} {m.label}
                  </button>
                )
              })}
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Course" required>
              <select name="course_id" required className={selectClass} value={formCourse} onChange={e => setFormCourse(e.target.value)}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Subject">
              <select name="subject_id" className={selectClass} defaultValue={editItem?.subject_id ?? ''}>
                <option value="">Select subject (optional)</option>
                {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Class Name" required>
              <input name="class_name" required className={inputClass} defaultValue={editItem?.class_name ?? ''} placeholder="e.g. Introduction to Tally" />
            </FormField>
            <FormField label="Link/URL" required>
              <input name="link" required className={inputClass} defaultValue={editItem?.link ?? ''} placeholder="https://..." />
            </FormField>

            {/* Zoom-specific */}
            {formPlatform === 'zoom' && (
              <>
                <FormField label="Meeting ID">
                  <input name="meeting_id" className={inputClass} defaultValue={editItem?.meeting_id ?? ''} placeholder="123 456 7890" />
                </FormField>
                <FormField label="Password">
                  <input name="meeting_password" className={inputClass} defaultValue={editItem?.meeting_password ?? ''} placeholder="Meeting password" />
                </FormField>
              </>
            )}

            <FormField label="Class Code">
              <input name="class_code" className={inputClass} defaultValue={editItem?.class_code ?? ''} placeholder="Optional code" />
            </FormField>
            <FormField label="Schedule Date">
              <input name="schedule_date" type="date" className={inputClass} defaultValue={editItem?.schedule_date ?? ''} />
            </FormField>
            <FormField label="Start Time">
              <input name="schedule_time" type="time" className={inputClass} defaultValue={editItem?.schedule_time?.slice(0, 5) ?? ''} />
            </FormField>
            <FormField label="End Time">
              <input name="end_time" type="time" className={inputClass} defaultValue={editItem?.end_time?.slice(0, 5) ?? ''} />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setEditItem(null) }} className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />} {editItem ? 'Update' : 'Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Class" message={`Delete "${deleteTarget?.class_name}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </div>
  )
}
