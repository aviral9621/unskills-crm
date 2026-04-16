import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import type { Profile, Branch } from '../../types'

const userSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^([6-9]\d{9})?$/, 'Must be a valid 10-digit number').optional().or(z.literal('')),
  role: z.enum(['branch_admin', 'branch_staff'], { message: 'Select a role' }),
  branch_id: z.string().min(1, 'Select a branch'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
})

type UserFormData = z.infer<typeof userSchema>

export default function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useAuth()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [existing, setExisting] = useState<Profile | null>(null)
  const [showPw, setShowPw] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({
    defaultValues: { role: 'branch_staff' },
  })

  useEffect(() => {
    fetchBranches()
    if (isEdit) loadUser()
  }, [id])

  async function fetchBranches() {
    const { data } = await supabase.from('uce_branches').select('id, name, code').eq('is_active', true).order('name')
    setBranches((data ?? []) as Branch[])
  }

  async function loadUser() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_profiles').select('*').eq('id', id).single()
      if (error) throw error
      if (!data) { toast.error('User not found'); navigate('/admin/users'); return }
      setExisting(data)
      reset({
        full_name: data.full_name,
        email: data.email || '',
        phone: data.phone || '',
        role: data.role as 'branch_admin' | 'branch_staff',
        branch_id: data.branch_id || '',
        password: '',
      })
    } catch { toast.error('Failed to load user') }
    finally { setLoading(false) }
  }

  async function onSubmit(form: UserFormData) {
    // Zod validate
    const parsed = userSchema.safeParse(form)
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }

    if (!isEdit && !form.password) { toast.error('Password is required for new users'); return }

    setSaving(true)
    try {
      if (isEdit) {
        const { error } = await supabase.from('uce_profiles').update({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
          branch_id: form.branch_id,
          updated_at: new Date().toISOString(),
        }).eq('id', id)
        if (error) throw error
        toast.success('User updated successfully')
      } else {
        // Create user via Edge Function (uses admin API with service role key)
        const { data, error: fnError } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone || null,
            role: form.role,
            branch_id: form.branch_id,
          },
        })
        if (fnError) {
          // In supabase-js v2, FunctionsHttpError carries the Response in `.context`.
          let msg = 'Failed to create user'
          try {
            const ctx = (fnError as { context?: Response }).context
            if (ctx && typeof ctx.json === 'function') {
              const parsed = await ctx.json()
              if (parsed?.error) msg = parsed.error
            }
          } catch { /* keep default msg */ }
          toast.error(msg)
          return
        }
        if (data?.error) {
          toast.error(data.error)
          return
        }
        toast.success('User created successfully')
      }
      navigate('/admin/users')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save user')
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="bg-white rounded-xl border p-6 space-y-4">{[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/users')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit User' : 'Add New User'}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{isEdit ? `Editing ${existing?.full_name || ''}` : 'Create a new CRM user'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
          <FormField label="Branch" required error={errors.branch_id?.message}>
            <select {...register('branch_id')} className={selectClass}>
              <option value="">Select a branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required error={errors.full_name?.message}>
              <input {...register('full_name')} className={inputClass} placeholder="Full name" />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} className={inputClass} placeholder="10-digit mobile" maxLength={10} />
            </FormField>
          </div>

          <FormField label="Email" required error={errors.email?.message}>
            <input {...register('email')} type="email" className={inputClass} placeholder="user@email.com" disabled={isEdit} />
          </FormField>

          <FormField label="Role" required error={errors.role?.message}>
            <select {...register('role')} className={selectClass}>
              <option value="branch_admin">Branch Admin</option>
              <option value="branch_staff">Branch Staff</option>
            </select>
          </FormField>

          {!isEdit && (
            <FormField label="Password" required error={errors.password?.message} hint="Min 8 characters">
              <div className="relative">
                <input {...register('password')} type={showPw ? 'text' : 'password'} className={`${inputClass} pr-10`} placeholder="Create password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 sm:mt-5 pb-4 sm:pb-6 gap-3">
          <button type="button" onClick={() => navigate('/admin/users')}
            className="px-3 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <ArrowLeft size={16} /> Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  )
}
