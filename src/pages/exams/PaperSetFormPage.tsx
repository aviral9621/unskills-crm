import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { Course } from '../../types'

interface PaperFormData {
  course_id: string
  category: string
  paper_name: string
  total_questions: string
  marks_per_question: string
  total_marks: string
  minus_marking: boolean
  minus_marks: string
  time_limit_minutes: string
  available_from: string
  available_to: string
  is_mock_test: boolean
}

const CATEGORIES = ['Theory', 'Practical', 'Mock Test', 'Final Exam', 'Mid-Term', 'Assignment']

export default function PaperSetFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = !!id

  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<PaperFormData>({
    course_id: '', category: '', paper_name: '', total_questions: '10',
    marks_per_question: '1', total_marks: '10', minus_marking: false,
    minus_marks: '0', time_limit_minutes: '30', available_from: '',
    available_to: '', is_mock_test: false,
  })

  useEffect(() => { fetchCourses(); if (isEdit) loadPaper() }, [id])

  async function fetchCourses() {
    const { data } = await supabase.from('uce_courses').select('id, name, code').eq('is_active', true).order('name')
    setCourses((data ?? []) as Course[])
  }

  async function loadPaper() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_paper_sets').select('*').eq('id', id).single()
      if (error) throw error
      if (!data) { toast.error('Paper set not found'); navigate('/admin/exams/paper-sets'); return }
      setForm({
        course_id: data.course_id,
        category: data.category || '',
        paper_name: data.paper_name,
        total_questions: String(data.total_questions),
        marks_per_question: String(data.marks_per_question || ''),
        total_marks: String(data.total_marks || ''),
        minus_marking: data.minus_marking || false,
        minus_marks: String(data.minus_marks || 0),
        time_limit_minutes: String(data.time_limit_minutes),
        available_from: data.available_from ? data.available_from.slice(0, 16) : '',
        available_to: data.available_to ? data.available_to.slice(0, 16) : '',
        is_mock_test: data.is_mock_test || false,
      })
    } catch { toast.error('Failed to load paper set') }
    finally { setLoading(false) }
  }

  function update(field: keyof PaperFormData, value: string | boolean) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-calc total marks
      if (field === 'total_questions' || field === 'marks_per_question') {
        const q = parseInt(field === 'total_questions' ? String(value) : next.total_questions) || 0
        const m = parseFloat(field === 'marks_per_question' ? String(value) : next.marks_per_question) || 0
        next.total_marks = String(q * m)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.course_id) { toast.error('Select a course'); return }
    if (!form.paper_name.trim()) { toast.error('Paper name is required'); return }
    if (!form.total_questions || parseInt(form.total_questions) < 1) { toast.error('Total questions must be at least 1'); return }
    if (!form.time_limit_minutes || parseInt(form.time_limit_minutes) < 1) { toast.error('Time limit must be at least 1 minute'); return }

    setSaving(true)
    try {
      const payload = {
        course_id: form.course_id,
        category: form.category || null,
        paper_name: form.paper_name.trim(),
        total_questions: parseInt(form.total_questions),
        marks_per_question: form.marks_per_question ? parseFloat(form.marks_per_question) : null,
        total_marks: form.total_marks ? parseFloat(form.total_marks) : null,
        minus_marking: form.minus_marking,
        minus_marks: form.minus_marking ? parseFloat(form.minus_marks) || 0 : 0,
        time_limit_minutes: parseInt(form.time_limit_minutes),
        available_from: form.available_from ? new Date(form.available_from).toISOString() : null,
        available_to: form.available_to ? new Date(form.available_to).toISOString() : null,
        is_mock_test: form.is_mock_test,
      }

      if (isEdit) {
        const { error } = await supabase.from('uce_paper_sets').update(payload).eq('id', id)
        if (error) throw error
        toast.success('Paper set updated')
      } else {
        const { error } = await supabase.from('uce_paper_sets').insert({ ...payload, created_by: user?.id || null })
        if (error) throw error
        toast.success('Paper set created')
      }
      navigate('/admin/exams/paper-sets')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="bg-white rounded-xl border p-6 space-y-4">{[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/exams/paper-sets')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit Paper Set' : 'Create Paper Set'}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{isEdit ? 'Update paper configuration' : 'Configure a new exam paper'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Course" required>
              <select value={form.course_id} onChange={e => update('course_id', e.target.value)} className={selectClass}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </FormField>
            <FormField label="Category">
              <select value={form.category} onChange={e => update('category', e.target.value)} className={selectClass}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Paper Name" required>
            <input value={form.paper_name} onChange={e => update('paper_name', e.target.value)} className={inputClass} placeholder="e.g., Final Exam - Computer Fundamentals" />
          </FormField>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <FormField label="Total Questions" required>
              <input type="number" value={form.total_questions} onChange={e => update('total_questions', e.target.value)} className={inputClass} min={1} />
            </FormField>
            <FormField label="Marks / Question">
              <input type="number" value={form.marks_per_question} onChange={e => update('marks_per_question', e.target.value)} className={inputClass} min={0} step="0.5" />
            </FormField>
            <FormField label="Total Marks">
              <input type="number" value={form.total_marks} onChange={e => update('total_marks', e.target.value)} className={`${inputClass} bg-gray-50 font-semibold`} readOnly />
            </FormField>
          </div>

          <FormField label="Time Limit (minutes)" required>
            <input type="number" value={form.time_limit_minutes} onChange={e => update('time_limit_minutes', e.target.value)} className={inputClass} min={1} placeholder="30" />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Available From">
              <input type="datetime-local" value={form.available_from} onChange={e => update('available_from', e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Available Until">
              <input type="datetime-local" value={form.available_to} onChange={e => update('available_to', e.target.value)} className={inputClass} />
            </FormField>
          </div>

          <div className="flex flex-col gap-3 bg-gray-50 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.minus_marking} onChange={e => update('minus_marking', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <div><span className="text-sm font-medium text-gray-900">Negative Marking</span><p className="text-xs text-gray-400">Deduct marks for wrong answers</p></div>
            </label>
            {form.minus_marking && (
              <FormField label="Minus Marks (per wrong answer)">
                <input type="number" value={form.minus_marks} onChange={e => update('minus_marks', e.target.value)} className={inputClass} min={0} step="0.25" />
              </FormField>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_mock_test} onChange={e => update('is_mock_test', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <div><span className="text-sm font-medium text-gray-900">Mock Test</span><p className="text-xs text-gray-400">Mark as practice test (won't count in results)</p></div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 sm:mt-5 pb-4 sm:pb-6 gap-3">
          <button type="button" onClick={() => navigate('/admin/exams/paper-sets')}
            className="px-3 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <ArrowLeft size={16} /> Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Update Paper' : 'Create Paper'}
          </button>
        </div>
      </form>
    </div>
  )
}
