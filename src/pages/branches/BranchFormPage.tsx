import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Loader2, Check,
  Building2, User, MapPin, Palette,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { INDIAN_STATES, cn } from '../../lib/utils'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import FileUpload from '../../components/FileUpload'
import type { Branch, BranchCategory } from '../../types'

/* ─── Steps Config ─── */
const STEPS = [
  { id: 1, label: 'Center Info', icon: Building2 },
  { id: 2, label: 'Director', icon: User },
  { id: 3, label: 'Address', icon: MapPin },
  { id: 4, label: 'Branding', icon: Palette },
] as const

/* ─── Zod Schemas per step ─── */
const step1Schema = z.object({
  name: z.string().min(3, 'Branch name must be at least 3 characters'),
  b_code: z.string().optional(),
  category: z.enum(['computer', 'beautician', 'both'], { message: 'Please select a category' }),
  society_name: z.string().optional(),
  registration_number: z.string().optional(),
  registration_year: z.string().regex(/^(\d{4})?$/, 'Must be a 4-digit year').optional().or(z.literal('')),
})

const step2Schema = z.object({
  director_name: z.string().min(2, 'Director name must be at least 2 characters'),
  director_phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  director_email: z.string().email('Invalid email').optional().or(z.literal('')),
  director_qualification: z.string().optional(),
})

const step3Schema = z.object({
  address_line1: z.string().optional(),
  village: z.string().optional(),
  block: z.string().optional(),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^(\d{6})?$/, 'Must be 6 digits').optional().or(z.literal('')),
})

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema)

type BranchFormData = z.infer<typeof fullSchema>

export default function BranchFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { } = useAuth()
  const isEdit = !!id

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [branchCode, setBranchCode] = useState('UCE-BR-...')
  const [existing, setExisting] = useState<Branch | null>(null)

  // File state
  const [directorPhotoFile, setDirectorPhotoFile] = useState<File | null>(null)
  const [directorPhotoUrl, setDirectorPhotoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<BranchFormData>({
    defaultValues: {
      category: 'computer',
      state: 'Uttar Pradesh',
    },
  })

  const category = watch('category')

  /* ─── Load existing branch for edit ─── */
  useEffect(() => {
    if (isEdit) loadBranch()
    else generateCode()
  }, [id])

  async function loadBranch() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_branches').select('*').eq('id', id).single()
      if (error) throw error
      if (!data) { toast.error('Branch not found'); navigate('/admin/branches'); return }
      setExisting(data)
      setBranchCode(data.code)
      setDirectorPhotoUrl(data.director_image_url)
      setLogoUrl(data.center_logo_url)
      reset({
        name: data.name,
        b_code: data.b_code || '',
        category: data.category,
        society_name: data.society_name || '',
        registration_number: data.registration_number || '',
        registration_year: data.registration_year || '',
        director_name: data.director_name,
        director_phone: data.director_phone,
        director_email: data.director_email || '',
        director_qualification: data.director_qualification || '',
        address_line1: data.address_line1 || '',
        village: data.village || '',
        block: data.block || '',
        district: data.district,
        state: data.state,
        pincode: data.pincode || '',
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load branch')
    } finally {
      setLoading(false)
    }
  }

  async function generateCode() {
    try {
      const { data } = await supabase
        .from('uce_branches')
        .select('code')
        .order('code', { ascending: false })
        .limit(1)
      let nextNum = 1
      if (data && data.length > 0) {
        const match = data[0].code.match(/UCE-BR-(\d+)/)
        if (match) nextNum = parseInt(match[1], 10) + 1
      }
      setBranchCode(`UCE-BR-${String(nextNum).padStart(3, '0')}`)
    } catch {
      setBranchCode('UCE-BR-001')
    }
  }

  /* ─── Step validation ─── */
  async function validateStep(s: number): Promise<boolean> {
    const fieldsMap: Record<number, (keyof BranchFormData)[]> = {
      1: ['name', 'category', 'society_name', 'registration_number', 'registration_year', 'b_code'],
      2: ['director_name', 'director_phone', 'director_email', 'director_qualification'],
      3: ['address_line1', 'village', 'block', 'district', 'state', 'pincode'],
    }
    const fields = fieldsMap[s]
    if (!fields) return true

    // Use Zod for step-level validation
    const schemas: Record<number, z.ZodSchema> = { 1: step1Schema, 2: step2Schema, 3: step3Schema }
    const schema = schemas[s]
    if (!schema) return true

    const values = getValues()
    const stepData: Record<string, unknown> = {}
    fields.forEach(f => { stepData[f] = values[f] })
    const result = schema.safeParse(stepData)

    if (!result.success) {
      // Trigger react-hook-form validation to show errors
      await trigger(fields)
      const firstErr = result.error.issues[0]
      toast.error(firstErr.message)
      return false
    }

    return true
  }

  async function goNext() {
    const valid = await validateStep(step)
    if (valid && step < 4) setStep(step + 1)
  }

  function goPrev() {
    if (step > 1) setStep(step - 1)
  }

  /* ─── Upload helper ─── */
  async function uploadFile(file: File, bucket: string, path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return urlData.publicUrl
  }

  /* ─── Submit (final step) ─── */
  async function onSubmit(formData: BranchFormData) {
    const parsed = fullSchema.safeParse(formData)
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]
      toast.error(firstErr.message)
      return
    }

    setSaving(true)
    try {
      let dirImageUrl = existing?.director_image_url || null
      let centerLogoUrl = existing?.center_logo_url || null

      if (directorPhotoFile) {
        const ext = directorPhotoFile.name.split('.').pop()
        const path = `director-photos/${id || 'new'}/${Date.now()}.${ext}`
        dirImageUrl = await uploadFile(directorPhotoFile, 'uce-avatars', path)
      }
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `logos/${id || 'new'}/${Date.now()}.${ext}`
        centerLogoUrl = await uploadFile(logoFile, 'uce-branch-logos', path)
      }

      const branchPayload = {
        code: branchCode,
        name: formData.name,
        b_code: formData.b_code || null,
        category: formData.category as BranchCategory,
        society_name: formData.society_name || null,
        registration_number: formData.registration_number || null,
        registration_year: formData.registration_year || null,
        director_name: formData.director_name,
        director_phone: formData.director_phone,
        director_email: formData.director_email || null,
        director_qualification: formData.director_qualification || null,
        director_image_url: dirImageUrl,
        address_line1: formData.address_line1 || null,
        village: formData.village || null,
        block: formData.block || null,
        district: formData.district,
        state: formData.state,
        pincode: formData.pincode || null,
        center_logo_url: centerLogoUrl,
        updated_at: new Date().toISOString(),
      }

      if (isEdit) {
        const { error } = await supabase.from('uce_branches').update(branchPayload).eq('id', id)
        if (error) throw error
        toast.success('Branch updated successfully')
      } else {
        const { data: newBranch, error } = await supabase
          .from('uce_branches')
          .insert({ ...branchPayload, wallet_balance: 0, is_active: true })
          .select()
          .single()
        if (error) {
          if (error.message?.includes('duplicate')) {
            toast.error('Branch code or name already exists')
          } else {
            throw error
          }
          return
        }

        // Re-upload files with actual branch ID
        if (directorPhotoFile && newBranch) {
          const ext = directorPhotoFile.name.split('.').pop()
          const path = `director-photos/${newBranch.id}/${Date.now()}.${ext}`
          const url = await uploadFile(directorPhotoFile, 'uce-avatars', path)
          await supabase.from('uce_branches').update({ director_image_url: url }).eq('id', newBranch.id)
        }
        if (logoFile && newBranch) {
          const ext = logoFile.name.split('.').pop()
          const path = `logos/${newBranch.id}/${Date.now()}.${ext}`
          const url = await uploadFile(logoFile, 'uce-branch-logos', path)
          await supabase.from('uce_branches').update({ center_logo_url: url }).eq('id', newBranch.id)
        }

        toast.success('Branch created successfully')
      }

      navigate('/admin/branches')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save branch')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/branches')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading truncate">
            {isEdit ? 'Edit Branch' : 'Add New Branch'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
            {isEdit ? `Editing ${existing?.name || ''}` : 'Step-by-step registration'}
          </p>
        </div>
      </div>

      {/* ═══ Progress Bar ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-5">
        {/* Mobile: compact pill bar */}
        <div className="sm:hidden">
          <div className="flex items-center gap-1 mb-2">
            {STEPS.map((s) => {
              const isActive = step === s.id
              const isDone = step > s.id
              return (
                <div key={s.id} className="flex-1">
                  <div className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    isDone ? 'bg-green-500' : isActive ? 'bg-red-500' : 'bg-gray-200'
                  )} />
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              Step {step} of {STEPS.length}
            </p>
            <p className="text-sm font-medium text-red-600">{STEPS[step - 1].label}</p>
          </div>
        </div>

        {/* Desktop: full stepper */}
        <div className="hidden sm:flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.id
            const isDone = step > s.id
            return (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  onClick={() => { if (isDone) setStep(s.id) }}
                  className={cn('flex items-center gap-2 shrink-0 transition-all', isDone && 'cursor-pointer', !isDone && !isActive && 'cursor-default')}
                >
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center transition-all shrink-0',
                    isActive && 'bg-red-600 text-white shadow-md shadow-red-200',
                    isDone && 'bg-green-500 text-white',
                    !isActive && !isDone && 'bg-gray-100 text-gray-400',
                  )}>
                    {isDone ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <div className="text-left">
                    <p className={cn('text-xs font-medium', isActive ? 'text-red-600' : isDone ? 'text-green-600' : 'text-gray-400')}>Step {s.id}</p>
                    <p className={cn('text-sm font-semibold', isActive ? 'text-gray-900' : isDone ? 'text-gray-700' : 'text-gray-400')}>{s.label}</p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div className="h-0.5 rounded-full bg-gray-200 relative">
                      <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-300" style={{ width: isDone ? '100%' : '0%' }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ Form Card ═══ */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-[280px]">
          {/* ─── Step 1: Center Information ─── */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-gray-900 font-heading flex items-center gap-2">
                <Building2 size={18} className="text-red-500" /> Center Information
              </h2>

              <FormField label="Branch Code">
                <input type="text" value={branchCode} readOnly className={`${inputClass} bg-gray-100 font-mono font-semibold`} />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Branch Name" required error={errors.name?.message}>
                  <input {...register('name')} className={inputClass} placeholder="e.g., Jaunpur Main Center" />
                </FormField>
                <FormField label="B-Code" hint="Optional internal code">
                  <input {...register('b_code')} className={inputClass} placeholder="Optional" />
                </FormField>
              </div>

              <FormField label="Category" required error={errors.category?.message}>
                <div className="flex flex-wrap gap-3 mt-1">
                  {(['computer', 'beautician', 'both'] as const).map((cat) => (
                    <label
                      key={cat}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all',
                        category === cat
                          ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="radio"
                        {...register('category')}
                        value={cat}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Society Name">
                  <input {...register('society_name')} className={inputClass} placeholder="Society / Trust name" />
                </FormField>
                <FormField label="Registration Number">
                  <input {...register('registration_number')} className={inputClass} placeholder="Registration no." />
                </FormField>
              </div>

              <FormField label="Registration Year" error={errors.registration_year?.message} className="sm:w-1/2">
                <input {...register('registration_year')} className={inputClass} placeholder="e.g., 2020" maxLength={4} />
              </FormField>
            </>
          )}

          {/* ─── Step 2: Director Information ─── */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-gray-900 font-heading flex items-center gap-2">
                <User size={18} className="text-red-500" /> Director Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Director Name" required error={errors.director_name?.message}>
                  <input {...register('director_name')} className={inputClass} placeholder="Full name" />
                </FormField>
                <FormField label="Phone" required error={errors.director_phone?.message}>
                  <input {...register('director_phone')} className={inputClass} placeholder="10-digit mobile" maxLength={10} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Email" error={errors.director_email?.message}>
                  <input {...register('director_email')} type="email" className={inputClass} placeholder="director@email.com" />
                </FormField>
                <FormField label="Qualification">
                  <input {...register('director_qualification')} className={inputClass} placeholder="e.g., B.Tech, MBA" />
                </FormField>
              </div>

              <FormField label="Director Photo" hint="Max 200 KB, JPG or PNG">
                <FileUpload
                  value={directorPhotoUrl}
                  onChange={(url, file) => { setDirectorPhotoUrl(url); setDirectorPhotoFile(file) }}
                  maxSizeKB={200}
                  previewSize={120}
                />
              </FormField>
            </>
          )}

          {/* ─── Step 3: Address ─── */}
          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-gray-900 font-heading flex items-center gap-2">
                <MapPin size={18} className="text-red-500" /> Address Details
              </h2>

              <FormField label="Address Line 1">
                <input {...register('address_line1')} className={inputClass} placeholder="Street address" />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Village">
                  <input {...register('village')} className={inputClass} placeholder="Village" />
                </FormField>
                <FormField label="Block">
                  <input {...register('block')} className={inputClass} placeholder="Block / Tehsil" />
                </FormField>
                <FormField label="District" required error={errors.district?.message}>
                  <input {...register('district')} className={inputClass} placeholder="District" />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="State" required error={errors.state?.message}>
                  <select {...register('state')} className={selectClass}>
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Pincode" error={errors.pincode?.message}>
                  <input {...register('pincode')} className={inputClass} placeholder="6-digit pincode" maxLength={6} />
                </FormField>
              </div>
            </>
          )}

          {/* ─── Step 4: Branding & Review ─── */}
          {step === 4 && (
            <>
              <h2 className="text-base font-semibold text-gray-900 font-heading flex items-center gap-2">
                <Palette size={18} className="text-red-500" /> Branding & Review
              </h2>

              <FormField label="Center Logo" hint="Max 50 KB, JPG or PNG">
                <FileUpload
                  value={logoUrl}
                  onChange={(url, file) => { setLogoUrl(url); setLogoFile(file) }}
                  maxSizeKB={50}
                  previewSize={80}
                  label="Click to upload center logo"
                />
              </FormField>

              {/* Review Summary */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">Review Summary</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ReviewItem label="Branch Code" value={branchCode} />
                  <ReviewItem label="Branch Name" value={getValues('name')} />
                  <ReviewItem label="Category" value={getValues('category')?.charAt(0).toUpperCase() + getValues('category')?.slice(1)} />
                  <ReviewItem label="Director" value={getValues('director_name')} />
                  <ReviewItem label="Phone" value={getValues('director_phone')} />
                  <ReviewItem label="District" value={getValues('district')} />
                  <ReviewItem label="State" value={getValues('state')} />
                  {getValues('director_email') && <ReviewItem label="Email" value={getValues('director_email') || ''} />}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ Navigation Buttons ═══ */}
        <div className="flex items-center justify-between mt-4 sm:mt-5 pb-4 sm:pb-6 gap-3">
          <button type="button" onClick={step === 1 ? () => navigate('/admin/branches') : goPrev}
            className="px-3 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 sm:gap-2">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{step === 1 ? 'Cancel' : 'Previous'}</span>
            <span className="sm:hidden">{step === 1 ? 'Cancel' : 'Back'}</span>
          </button>
          {step < 4 ? (
            <button type="button" onClick={goNext}
              className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5 sm:gap-2 shadow-sm">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={saving}
              className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2 shadow-sm">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

/* ─── Review Item ─── */
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3.5 py-2.5">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{value || '—'}</p>
    </div>
  )
}
