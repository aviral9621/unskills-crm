import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Globe, Upload, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { INDIAN_STATES, formatINR } from '../../lib/utils'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { Department, Branch } from '../../types'

const GENDERS = ['male', 'female', 'other'] as const

const schema = z.object({
  branch_id: z.string().min(1, 'Branch required'),
  name: z.string().min(2, 'Employee name required'),
  father_name: z.string().optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit mobile required'),
  alt_phone: z.string().regex(/^([6-9]\d{9})?$/, 'Valid 10-digit mobile').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  pincode: z.string().regex(/^(\d{6})?$/, '6 digits').optional().or(z.literal('')),
  department_id: z.string().optional().or(z.literal('')),
  designation: z.string().optional().or(z.literal('')),
  joining_date: z.string().optional().or(z.literal('')),
  base_salary: z.coerce.number().min(0),
  da: z.coerce.number().min(0),
  hra: z.coerce.number().min(0),
  ta: z.coerce.number().min(0),
  pf: z.coerce.number().min(0),
  esi: z.coerce.number().min(0),
  other_allowance: z.coerce.number().min(0),
  other_deduction: z.coerce.number().min(0),
  bank_name: z.string().optional().or(z.literal('')),
  account_number: z.string().optional().or(z.literal('')),
  ifsc_code: z.string().optional().or(z.literal('')),
  show_on_website: z.boolean().optional(),
  website_qualifications: z.string().optional().or(z.literal('')),
  website_experience: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function EmployeeFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      branch_id: profile?.branch_id || '',
      state: 'Uttar Pradesh',
      base_salary: 0, da: 0, hra: 0, ta: 0, pf: 0, esi: 0, other_allowance: 0, other_deduction: 0,
    },
  })

  const baseSalary = watch('base_salary')
  const da = watch('da')
  const hra = watch('hra')
  const ta = watch('ta')
  const pf = watch('pf')
  const esi = watch('esi')
  const otherAllowance = watch('other_allowance')
  const otherDeduction = watch('other_deduction')

  const gross = (baseSalary || 0) + (da || 0) + (hra || 0) + (ta || 0) + (otherAllowance || 0)
  const totalDeductions = (pf || 0) + (esi || 0) + (otherDeduction || 0)
  const netSalary = gross - totalDeductions

  useEffect(() => { fetchLookups() }, [])

  async function fetchLookups() {
    setLoading(true)
    try {
      const [dRes, bRes] = await Promise.all([
        supabase.from('uce_departments').select('*').eq('is_active', true).order('name'),
        supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name'),
      ])
      setDepartments(dRes.data ?? [])
      setBranches((bRes.data ?? []) as Branch[])

      if (isEdit) {
        const { data, error } = await supabase.from('uce_employees').select('*').eq('id', id).single()
        if (error) throw error
        if (data) {
          const fields: (keyof FormData)[] = ['branch_id', 'name', 'father_name', 'dob', 'gender', 'phone', 'alt_phone', 'email', 'address', 'district', 'state', 'pincode', 'department_id', 'designation', 'joining_date', 'base_salary', 'da', 'hra', 'ta', 'pf', 'esi', 'other_allowance', 'other_deduction', 'bank_name', 'account_number', 'ifsc_code', 'show_on_website', 'website_qualifications', 'website_experience']
          fields.forEach(f => {
            const v = (data as Record<string, unknown>)[f]
            if (v !== null && v !== undefined) setValue(f, v as string | number | boolean)
          })
          const url = (data as Record<string, unknown>).photo_url as string | null
          if (url) { setPhotoUrl(url); setPhotoPreview(url) }
        }
      }
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  function autoCalcSalary() {
    const base = baseSalary || 0
    setValue('da', Math.round(base * 0.65))
    setValue('hra', Math.round(base * 0.10))
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    try {
      let finalPhotoUrl = photoUrl
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `staff/${Date.now()}.${ext}`
        finalPhotoUrl = await uploadPublicFile(STORAGE_BUCKETS.employees, path, photoFile)
        setPhotoUrl(finalPhotoUrl)
      }

      const payload = {
        ...data,
        department_id: data.department_id || null,
        father_name: data.father_name || null,
        dob: data.dob || null,
        gender: data.gender || null,
        alt_phone: data.alt_phone || null,
        email: data.email || null,
        address: data.address || null,
        district: data.district || null,
        state: data.state || null,
        pincode: data.pincode || null,
        designation: data.designation || null,
        joining_date: data.joining_date || null,
        bank_name: data.bank_name || null,
        account_number: data.account_number || null,
        ifsc_code: data.ifsc_code || null,
        show_on_website: data.show_on_website ?? false,
        website_qualifications: data.website_qualifications || null,
        website_experience: data.website_experience || null,
        photo_url: finalPhotoUrl || null,
        updated_at: new Date().toISOString(),
      }

      if (isEdit) {
        const { error } = await supabase.from('uce_employees').update(payload).eq('id', id)
        if (error) throw error
        toast.success('Employee updated')
      } else {
        // Generate employee code
        const { data: countData } = await supabase.from('uce_employees').select('id', { count: 'exact', head: true })
        const count = (countData as unknown as number) || 0
        const empCode = `EMP${String(count + 1).padStart(4, '0')}`

        const { error } = await supabase.from('uce_employees').insert({ ...payload, employee_code: empCode })
        if (error) throw error
        toast.success('Employee added')
      }
      navigate('/admin/staff/employees')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save employee')
    }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="bg-white rounded-xl border p-6 space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/staff/employees')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit Employee' : 'New Employee'}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Fill in employee details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Personal */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isSuperAdmin && (
              <FormField label="Branch" required error={errors.branch_id?.message}>
                <select {...register('branch_id')} className={selectClass}>
                  <option value="">Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Employee Name" required error={errors.name?.message}>
              <input {...register('name')} placeholder="Full name" className={inputClass} />
            </FormField>
            <FormField label="Father's Name" error={errors.father_name?.message}>
              <input {...register('father_name')} placeholder="Father's name" className={inputClass} />
            </FormField>
            <FormField label="Date of Birth" error={errors.dob?.message}>
              <input type="date" {...register('dob')} className={inputClass} />
            </FormField>
            <FormField label="Gender" error={errors.gender?.message}>
              <select {...register('gender')} className={selectClass}>
                <option value="">Select</option>
                {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </FormField>
            <FormField label="Phone" required error={errors.phone?.message}>
              <input {...register('phone')} placeholder="10-digit mobile" className={inputClass} maxLength={10} />
            </FormField>
            <FormField label="Alternate Phone" error={errors.alt_phone?.message}>
              <input {...register('alt_phone')} placeholder="10-digit mobile" className={inputClass} maxLength={10} />
            </FormField>
            <FormField label="Email" error={errors.email?.message} className="sm:col-span-2">
              <input type="email" {...register('email')} placeholder="email@example.com" className={inputClass} />
            </FormField>
          </div>
        </div>

        {/* Section 2: Address */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Address</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
              <input {...register('address')} placeholder="Street / area" className={inputClass} />
            </FormField>
            <FormField label="District" error={errors.district?.message}>
              <input {...register('district')} placeholder="District" className={inputClass} />
            </FormField>
            <FormField label="State" error={errors.state?.message}>
              <select {...register('state')} className={selectClass}>
                <option value="">Select</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Pincode" error={errors.pincode?.message}>
              <input {...register('pincode')} placeholder="6 digits" className={inputClass} maxLength={6} />
            </FormField>
          </div>
        </div>

        {/* Section 3: Employment */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Employment Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department" error={errors.department_id?.message}>
              <select {...register('department_id')} className={selectClass}>
                <option value="">Select</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Designation" error={errors.designation?.message}>
              <input {...register('designation')} placeholder="e.g. Trainer, Receptionist" className={inputClass} />
            </FormField>
            <FormField label="Joining Date" error={errors.joining_date?.message}>
              <input type="date" {...register('joining_date')} className={inputClass} />
            </FormField>
          </div>
        </div>

        {/* Section 4: Salary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Salary Structure</h2>
            <button type="button" onClick={autoCalcSalary} className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">
              Auto-calc DA & HRA
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings */}
            <div>
              <h3 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Earnings
              </h3>
              <div className="space-y-3">
                <FormField label="Base Salary" required error={errors.base_salary?.message} hint="DA = 65%, HRA = 10% of base">
                  <input type="number" {...register('base_salary')} placeholder="0" className={inputClass} min={0} />
                </FormField>
                <FormField label="Dearness Allowance (DA)" error={errors.da?.message}>
                  <input type="number" {...register('da')} placeholder="0" className={inputClass} min={0} />
                </FormField>
                <FormField label="House Rent Allowance (HRA)" error={errors.hra?.message}>
                  <input type="number" {...register('hra')} placeholder="0" className={inputClass} min={0} />
                </FormField>
                <FormField label="Travel Allowance (TA)" error={errors.ta?.message}>
                  <input type="number" {...register('ta')} placeholder="0" className={inputClass} min={0} />
                </FormField>
                <FormField label="Other Allowances" error={errors.other_allowance?.message}>
                  <input type="number" {...register('other_allowance')} placeholder="0" className={inputClass} min={0} />
                </FormField>
              </div>
            </div>
            {/* Deductions */}
            <div>
              <h3 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Deductions
              </h3>
              <div className="space-y-3">
                <FormField label="Provident Fund (PF)" error={errors.pf?.message}>
                  <input type="number" {...register('pf')} placeholder="0" className={inputClass} min={0} />
                </FormField>
                <FormField label="ESI" error={errors.esi?.message}>
                  <input type="number" {...register('esi')} placeholder="0" className={inputClass} min={0} />
                </FormField>
                <FormField label="Other Deductions" error={errors.other_deduction?.message}>
                  <input type="number" {...register('other_deduction')} placeholder="0" className={inputClass} min={0} />
                </FormField>
              </div>
            </div>
          </div>

          {/* Net salary display */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">Gross</p>
                <p className="text-lg font-bold text-green-700">{formatINR(gross)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-600 font-medium">Deductions</p>
                <p className="text-lg font-bold text-red-700">{formatINR(totalDeductions)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">Net Salary</p>
                <p className="text-lg font-bold text-blue-700">{formatINR(netSalary)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Bank */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Bank Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Bank Name" error={errors.bank_name?.message}>
              <input {...register('bank_name')} placeholder="e.g. State Bank of India" className={inputClass} />
            </FormField>
            <FormField label="Account Number" error={errors.account_number?.message}>
              <input {...register('account_number')} placeholder="Account number" className={inputClass} />
            </FormField>
            <FormField label="IFSC Code" error={errors.ifsc_code?.message}>
              <input {...register('ifsc_code')} placeholder="e.g. SBIN0001234" className={inputClass} />
            </FormField>
          </div>
        </div>

        {/* Section 6: Website Visibility */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-red-600" />
            <h2 className="text-base font-semibold text-gray-900">Website Visibility</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Control whether this staff member appears in the Faculty section on the public website.</p>

          {/* Show on website toggle */}
          <label className="flex items-center gap-3 cursor-pointer mb-5">
            <div className="relative">
              <input
                type="checkbox"
                {...register('show_on_website')}
                className="sr-only peer"
              />
              <div className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-red-600 transition-colors" />
              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-sm font-medium text-gray-700">Show on Website</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Qualifications (for website)" hint="e.g. MCA, BCA, PGDCA, Tally Expert">
              <input {...register('website_qualifications')} placeholder="e.g. MCA, BCA, O Level" className={inputClass} />
            </FormField>
            <FormField label="Experience (for website)" hint="e.g. 10+ Years">
              <input {...register('website_experience')} placeholder="e.g. 7+ Years" className={inputClass} />
            </FormField>
          </div>

          {/* Photo upload */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Photo (for website & ID card)</p>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(''); setPhotoUrl(null) }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <Upload size={20} />
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                >
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                <p className="text-[11px] text-gray-400 mt-1">JPG or PNG, max 2MB</p>
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setPhotoFile(f)
                setPhotoPreview(URL.createObjectURL(f))
              }}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin/staff/employees')} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shadow-sm">
            {saving && <Loader2 size={16} className="animate-spin" />} {isEdit ? 'Update Employee' : 'Save Employee'}
          </button>
        </div>
      </form>
    </div>
  )
}
