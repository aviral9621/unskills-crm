import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Copy, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { INDIAN_STATES } from '../../lib/utils'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import FileUpload from '../../components/FileUpload'
import Modal from '../../components/Modal'
import type { Branch, BranchCategory } from '../../types'

/* ─── Zod Schema ─── */
const branchSchema = z.object({
  name: z.string().min(3, 'Branch name must be at least 3 characters'),
  b_code: z.string().optional(),
  category: z.enum(['computer', 'beautician', 'both'], { message: 'Category is required' }),
  society_name: z.string().optional(),
  registration_number: z.string().optional(),
  registration_year: z.string().regex(/^(\d{4})?$/, 'Must be a 4-digit year').optional().or(z.literal('')),
  director_name: z.string().min(2, 'Director name must be at least 2 characters'),
  director_phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  director_email: z.string().email('Invalid email').optional().or(z.literal('')),
  director_qualification: z.string().optional(),
  address_line1: z.string().optional(),
  village: z.string().optional(),
  block: z.string().optional(),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().regex(/^(\d{6})?$/, 'Must be 6 digits').optional().or(z.literal('')),
})

type BranchFormData = z.infer<typeof branchSchema>

export default function BranchFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: _user } = useAuth()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [branchCode, setBranchCode] = useState('UCE-BR-...')
  const [existing, setExisting] = useState<Branch | null>(null)

  // File state
  const [directorPhotoFile, setDirectorPhotoFile] = useState<File | null>(null)
  const [directorPhotoUrl, setDirectorPhotoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Admin credentials modal
  const [credModal, setCredModal] = useState(false)
  const [creds, setCreds] = useState({ email: '', password: '' })
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
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

  /* ─── Upload helper ─── */
  async function uploadFile(file: File, bucket: string, path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return urlData.publicUrl
  }

  /* ─── Generate password ─── */
  function generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const specials = '@#$!%'
    let pw = ''
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    pw += specials[Math.floor(Math.random() * specials.length)]
    pw += String(Math.floor(Math.random() * 90) + 10)
    return pw
  }

  /* ─── Submit ─── */
  async function onSubmit(formData: BranchFormData) {
    // Validate with Zod manually for extra safety
    const parsed = branchSchema.safeParse(formData)
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]
      toast.error(firstErr.message)
      return
    }

    setSaving(true)
    try {
      let dirImageUrl = existing?.director_image_url || null
      let centerLogoUrl = existing?.center_logo_url || null

      // Upload director photo
      if (directorPhotoFile) {
        const ext = directorPhotoFile.name.split('.').pop()
        const path = `director-photos/${id || 'new'}/${Date.now()}.${ext}`
        dirImageUrl = await uploadFile(directorPhotoFile, 'uce-avatars', path)
      }

      // Upload logo
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
        /* ─── UPDATE ─── */
        const { error } = await supabase.from('uce_branches').update(branchPayload).eq('id', id)
        if (error) throw error
        toast.success('Branch updated successfully')
        navigate('/admin/branches')
      } else {
        /* ─── CREATE ─── */
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

        // Re-upload files with actual branch ID paths
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

        // Auto-create Branch Admin user
        try {
          const safeName = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
          const email = `${safeName}-admin@unskillseducation.org`
          const password = generatePassword()

          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { role: 'branch_admin', branch_id: newBranch.id } },
          })

          if (authError) {
            console.error('Auth creation error:', authError)
            toast.warning('Branch created but admin account could not be auto-created. Create manually.')
          } else if (authData.user) {
            // Create profile
            await supabase.from('uce_profiles').insert({
              id: authData.user.id,
              full_name: `Admin - ${formData.name}`,
              email,
              role: 'branch_admin',
              branch_id: newBranch.id,
              is_active: true,
            })

            setCreds({ email, password })
            setCredModal(true)
            setSaving(false)
            return // Don't navigate yet, wait for modal close
          }
        } catch (adminErr) {
          console.error('Admin creation error:', adminErr)
          toast.warning('Branch created, but admin user creation failed.')
        }

        toast.success('Branch created successfully')
        navigate('/admin/branches')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to save branch')
    } finally {
      setSaving(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(`Email: ${creds.email}\nPassword: ${creds.password}`)
    setCopied(true)
    toast.success('Credentials copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/branches')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">
            {isEdit ? 'Edit Branch' : 'Add New Branch'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEdit ? `Editing ${existing?.name || ''}` : 'Fill in the details below to register a new branch'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ═══ Section 1: Center Information ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 font-heading border-b border-gray-100 pb-3">Center Information</h2>

          {/* Branch Code (read-only) */}
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

          {/* Category Radio Group */}
          <FormField label="Category" required error={errors.category?.message}>
            <div className="flex flex-wrap gap-4 mt-1">
              {(['computer', 'beautician', 'both'] as const).map((cat) => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    {...register('category')}
                    value={cat}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className={`text-sm font-medium ${category === cat ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
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
        </div>

        {/* ═══ Section 2: Director Information ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 font-heading border-b border-gray-100 pb-3">Director Information</h2>

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

          <FormField label="Director Photo">
            <FileUpload
              value={directorPhotoUrl}
              onChange={(url, file) => { setDirectorPhotoUrl(url); setDirectorPhotoFile(file) }}
              maxSizeKB={200}
              previewSize={120}
            />
          </FormField>
        </div>

        {/* ═══ Section 3: Address ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 font-heading border-b border-gray-100 pb-3">Address</h2>

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
        </div>

        {/* ═══ Section 4: Branding ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900 font-heading border-b border-gray-100 pb-3">Branding</h2>
          <FormField label="Center Logo">
            <FileUpload
              value={logoUrl}
              onChange={(url, file) => { setLogoUrl(url); setLogoFile(file) }}
              maxSizeKB={50}
              previewSize={80}
              label="Click to upload center logo"
            />
          </FormField>
        </div>

        {/* ═══ Actions ═══ */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/branches')}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Update Branch' : 'Save Branch'}
          </button>
        </div>
      </form>

      {/* ═══ Credentials Modal ═══ */}
      <Modal
        open={credModal}
        onClose={() => { setCredModal(false); navigate('/admin/branches') }}
        title="Branch Admin Created Successfully"
        size="sm"
        hideClose
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Email</p>
              <p className="text-sm font-semibold text-green-900 mt-0.5 break-all">{creds.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Password</p>
              <p className="text-sm font-mono font-semibold text-green-900 mt-0.5">{creds.password}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span className="text-amber-600 mt-0.5 shrink-0">&#9888;</span>
            <p className="text-xs text-amber-800">
              Share these credentials with the branch manager. The password cannot be retrieved later.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={() => { setCredModal(false); navigate('/admin/branches') }}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Close & Continue
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
