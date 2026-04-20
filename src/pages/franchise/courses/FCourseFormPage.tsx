import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import FormField, { inputClass } from '../../../components/FormField'
import type { Program } from '../../../types'

interface Form {
  code: string; name: string; short_name?: string; program_id: string
  duration_label?: string; duration_months?: number
  eligibility?: string; description?: string
  total_fee: number; certification_fee: number
}

export default function FCourseFormPage() {
  const navigate = useNavigate()
  const branchId = useBranchId()
  const [programs, setPrograms] = useState<Program[]>([])
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    defaultValues: { total_fee: 0, certification_fee: 0 },
  })

  useEffect(() => {
    supabase.from('uce_programs').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setPrograms((data ?? []) as Program[]))
  }, [])

  async function onSubmit(f: Form) {
    if (!branchId) return toast.error('Branch not resolved')
    const { error } = await supabase.from('uce_courses').insert({
      ...f,
      created_by_branch_id: branchId,
      approval_status: 'pending',
      is_active: false,
      duration_months: f.duration_months ? Number(f.duration_months) : null,
      total_fee: Number(f.total_fee),
      certification_fee: Number(f.certification_fee),
      is_certificate_eligible: true,
      is_marksheet_eligible: true,
      display_order: 99,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Course submitted — pending admin approval')
    navigate('/franchise/courses')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => navigate('/franchise/courses')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Courses
      </button>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Add Course</h1>
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Your course will be <b>pending admin approval</b>. It won't be visible or registerable until approved.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Code" required error={errors.code?.message}>
            <input {...register('code', { required: 'Code required' })} className={inputClass} placeholder="e.g. DCA-2026" />
          </FormField>
          <FormField label="Program" required error={errors.program_id?.message}>
            <select {...register('program_id', { required: 'Program required' })} className={inputClass}>
              <option value="">Select program</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Course Name" required error={errors.name?.message}>
          <input {...register('name', { required: 'Name required' })} className={inputClass} />
        </FormField>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Short Name">
            <input {...register('short_name')} className={inputClass} />
          </FormField>
          <FormField label="Duration Label"><input {...register('duration_label')} className={inputClass} placeholder="6 Months" /></FormField>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Duration (Months)">
            <input type="number" {...register('duration_months')} className={inputClass} />
          </FormField>
          <FormField label="Eligibility"><input {...register('eligibility')} className={inputClass} placeholder="10th pass" /></FormField>
        </div>

        <FormField label="Description">
          <textarea {...register('description')} rows={3} className={inputClass} />
        </FormField>

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Total Fee (₹)" required>
            <input type="number" {...register('total_fee', { valueAsNumber: true, min: 0 })} className={inputClass} />
          </FormField>
          <FormField label="Certification Fee (₹)" required hint="Debited from wallet on each student registration">
            <input type="number" {...register('certification_fee', { valueAsNumber: true, min: 0 })} className={inputClass} />
          </FormField>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Submit for Approval
          </button>
        </div>
      </form>
    </div>
  )
}
