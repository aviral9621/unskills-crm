import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { Course, Program } from '../../types'

const courseSchema = z.object({
  code: z.string().min(3, 'Code is required'),
  name: z.string().min(3, 'Course name is required'),
  short_name: z.string().optional(),
  program_id: z.string().min(1, 'Select a program'),
  duration_months: z.coerce.number().min(0).optional(),
  duration_label: z.string().optional(),
  eligibility: z.string().optional(),
  description: z.string().optional(),
  total_fee: z.coerce.number().min(0, 'Fee must be positive'),
  certification_fee: z.coerce.number().min(0, 'Cert fee must be positive'),
  is_featured: z.boolean().optional(),
  is_govt_course: z.boolean().optional(),
  is_certificate_eligible: z.boolean().optional(),
  is_marksheet_eligible: z.boolean().optional(),
})

type CourseFormData = z.infer<typeof courseSchema>

export default function CourseFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [existing, setExisting] = useState<Course | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CourseFormData>({
    defaultValues: { total_fee: 0, certification_fee: 0, is_marksheet_eligible: true },
  })

  useEffect(() => {
    fetchPrograms()
    if (isEdit) loadCourse()
  }, [id])

  async function fetchPrograms() {
    const { data } = await supabase.from('uce_programs').select('*').eq('is_active', true).order('name')
    setPrograms(data ?? [])
  }

  async function loadCourse() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_courses').select('*').eq('id', id).single()
      if (error) throw error
      if (!data) { toast.error('Course not found'); navigate('/admin/courses'); return }
      setExisting(data)
      reset({
        code: data.code, name: data.name, short_name: data.short_name || '', program_id: data.program_id,
        duration_months: data.duration_months || 0, duration_label: data.duration_label || '',
        eligibility: data.eligibility || '', description: data.description || '',
        total_fee: data.total_fee, certification_fee: data.certification_fee,
        is_featured: data.is_featured, is_govt_course: data.is_govt_course,
        is_certificate_eligible: data.is_certificate_eligible, is_marksheet_eligible: data.is_marksheet_eligible,
      })
    } catch { toast.error('Failed to load course') }
    finally { setLoading(false) }
  }

  async function onSubmit(form: CourseFormData) {
    const parsed = courseSchema.safeParse(form)
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    setSaving(true)
    try {
      const payload = {
        code: form.code, name: form.name, short_name: form.short_name || null, program_id: form.program_id,
        duration_months: form.duration_months || null, duration_label: form.duration_label || null,
        eligibility: form.eligibility || null, description: form.description || null,
        total_fee: form.total_fee, certification_fee: form.certification_fee,
        is_featured: form.is_featured ?? false, is_govt_course: form.is_govt_course ?? false,
        is_certificate_eligible: form.is_certificate_eligible ?? false, is_marksheet_eligible: form.is_marksheet_eligible ?? true,
        updated_at: new Date().toISOString(),
      }
      if (isEdit) {
        const { error } = await supabase.from('uce_courses').update(payload).eq('id', id)
        if (error) throw error; toast.success('Course updated')
      } else {
        const { error } = await supabase.from('uce_courses').insert(payload)
        if (error) { if (error.message?.includes('duplicate')) toast.error('Course code already exists'); else throw error; return }
        toast.success('Course created')
      }
      navigate('/admin/courses')
    } catch { toast.error('Failed to save course') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="max-w-3xl mx-auto space-y-4"><div className="skeleton h-8 w-48 rounded-lg" /><div className="bg-white rounded-xl border p-6 space-y-4">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div></div>

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/courses')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0"><ArrowLeft size={18} className="text-gray-600" /></button>
        <div><h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit Course' : 'Add New Course'}</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{isEdit ? `Editing ${existing?.name || ''}` : 'Fill in the course details'}</p></div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 font-heading border-b border-gray-100 pb-3">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Course Code" required error={errors.code?.message}><input {...register('code')} className={inputClass} placeholder="e.g., USCE-101" /></FormField>
            <FormField label="Course Name" required error={errors.name?.message}><input {...register('name')} className={inputClass} placeholder="e.g., ADCA" /></FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Short Name"><input {...register('short_name')} className={inputClass} placeholder="Abbreviated name" /></FormField>
            <FormField label="Program" required error={errors.program_id?.message}>
              <select {...register('program_id')} className={selectClass}><option value="">Select program</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Duration (Months)"><input type="number" {...register('duration_months')} className={inputClass} placeholder="e.g., 12" min={0} /></FormField>
            <FormField label="Duration Label"><input {...register('duration_label')} className={inputClass} placeholder="e.g., 12 Months" /></FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Eligibility"><input {...register('eligibility')} className={inputClass} placeholder="e.g., 10th Pass" /></FormField>
            <FormField label="Description"><textarea {...register('description')} className={`${inputClass} resize-none`} rows={2} placeholder="Course description" /></FormField>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 font-heading border-b border-gray-100 pb-3">Fees & Flags</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Total Fee (₹)" required error={errors.total_fee?.message}>
              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span><input type="number" {...register('total_fee')} className={`${inputClass} pl-8`} min={0} /></div>
            </FormField>
            <FormField label="Certification Fee (₹)" required error={errors.certification_fee?.message} hint="Deducted from branch wallet">
              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span><input type="number" {...register('certification_fee')} className={`${inputClass} pl-8`} min={0} /></div>
            </FormField>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { key: 'is_featured', label: 'Featured' },
              { key: 'is_marksheet_eligible', label: 'Marksheet Eligible' },
              { key: 'is_certificate_eligible', label: 'Certificate Eligible' },
              { key: 'is_govt_course', label: 'Government Course' },
            ].map(f => (
              <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register(f.key as keyof CourseFormData)} className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <span className="text-sm text-gray-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pb-4 sm:pb-6 gap-3">
          <button type="button" onClick={() => navigate('/admin/courses')} className="px-3 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"><ArrowLeft size={16} /> Cancel</button>
          <button type="submit" disabled={saving} className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : isEdit ? 'Update' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  )
}
