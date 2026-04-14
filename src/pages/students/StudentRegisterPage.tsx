import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Loader2, Check, User, Phone, MapPin, BookOpen, AlertTriangle, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { INDIAN_STATES, formatINR, cn } from '../../lib/utils'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import FileUpload from '../../components/FileUpload'
import Modal from '../../components/Modal'
import type { Course, Batch, Branch } from '../../types'

const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Contact', icon: Phone },
  { id: 3, label: 'Address', icon: MapPin },
  { id: 4, label: 'Course & Fee', icon: BookOpen },
] as const

const GENDERS = ['male', 'female', 'other'] as const
const ADMISSION_YEARS = Array.from({ length: 17 }, (_, i) => { const y = 2010 + i; return `${y}-${y + 1}` })

const schema = z.object({
  name: z.string().min(2, 'Student name required'),
  father_name: z.string().min(2, "Father's name required"),
  mother_name: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  aadhar_number: z.string().regex(/^(\d{12})?$/, 'Must be 12 digits').optional().or(z.literal('')),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit mobile required'),
  alt_phone: z.string().regex(/^([6-9]\d{9})?$/, 'Valid 10-digit mobile').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  village: z.string().optional(),
  block: z.string().optional(),
  district: z.string().min(1, 'District required'),
  state: z.string().min(1, 'State required'),
  pincode: z.string().regex(/^(\d{6})?$/, '6 digits').optional().or(z.literal('')),
  course_id: z.string().min(1, 'Course required'),
  batch_id: z.string().optional(),
  session: z.string().min(1, 'Session required'),
  admission_year: z.string().min(1, 'Year required'),
  total_fee: z.coerce.number().min(0),
  discount: z.coerce.number().min(0),
  registration_fee: z.coerce.number().min(0),
})

type FormData = z.infer<typeof schema>

export default function StudentRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = !!editId
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regNo, setRegNo] = useState('UCE/...')

  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [branch, setBranch] = useState<Branch | null>(null)        // selected (or only) branch used for wallet
  const [branchesList, setBranchesList] = useState<Branch[]>([])   // all branches (super_admin picker)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [certFee, setCertFee] = useState(0)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [walletError, setWalletError] = useState(false)

  const { register, handleSubmit, watch, reset, trigger, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: { state: 'Uttar Pradesh', session: '2025-26', admission_year: '2025-2026', total_fee: 0, discount: 0, registration_fee: 0 },
  })

  const courseId = watch('course_id')
  const totalFee = watch('total_fee')
  const discount = watch('discount')
  const netFee = Math.max(0, (totalFee || 0) - (discount || 0))

  useEffect(() => { fetchInitial() }, [])
  useEffect(() => { if (courseId) fetchBatches(courseId) }, [courseId])

  async function fetchInitial() {
    setLoading(true)
    try {
      const [cRes, branchRes] = await Promise.all([
        supabase.from('uce_courses').select('*').eq('is_active', true).order('name'),
        // Super admin sees ALL active branches; branch user only their own
        isSuperAdmin
          ? supabase.from('uce_branches').select('*').eq('is_active', true).order('name')
          : profile?.branch_id
            ? supabase.from('uce_branches').select('*').eq('id', profile.branch_id)
            : Promise.resolve({ data: [], error: null }),
      ])
      setCourses(cRes.data ?? [])
      const list = (branchRes.data ?? []) as Branch[]
      setBranchesList(list)
      if (!isSuperAdmin && list.length === 1) {
        setBranch(list[0])
        setSelectedBranchId(list[0].id)
      } else if (isSuperAdmin && list.length === 1) {
        // only one branch exists — pre-select for convenience
        setBranch(list[0])
        setSelectedBranchId(list[0].id)
      }

      if (!isEdit) await generateRegNo()
      else await loadStudent()
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  // Whenever super_admin changes the branch dropdown, keep `branch` (for wallet) in sync
  useEffect(() => {
    if (!selectedBranchId) { setBranch(null); return }
    const b = branchesList.find(x => x.id === selectedBranchId) || null
    setBranch(b)
  }, [selectedBranchId, branchesList])

  async function generateRegNo() {
    try {
      const { data } = await supabase.from('uce_students').select('registration_no').order('registration_no', { ascending: false }).limit(1)
      let next = 1
      if (data && data.length > 0) {
        const m = data[0].registration_no.match(/UCE\/(\d+)/)
        if (m) next = parseInt(m[1], 10) + 1
      }
      setRegNo(`UCE/${String(next).padStart(4, '0')}`)
    } catch { setRegNo('UCE/0001') }
  }

  async function loadStudent() {
    try {
      const { data, error } = await supabase.from('uce_students').select('*').eq('id', editId).single()
      if (error || !data) { toast.error('Student not found'); navigate('/admin/students'); return }
      setRegNo(data.registration_no)
      setPhotoUrl(data.photo_url)
      setSelectedBranchId(data.branch_id || '')
      reset({
        name: data.name, father_name: data.father_name, mother_name: data.mother_name || '',
        dob: data.dob || '', gender: data.gender || '', aadhar_number: data.aadhar_number || '',
        phone: data.phone, alt_phone: data.alt_phone || '', email: data.email || '', whatsapp: data.whatsapp || '',
        address: data.address || '', village: data.village || '', block: data.block || '',
        district: data.district || '', state: data.state || 'Uttar Pradesh', pincode: data.pincode || '',
        course_id: data.course_id, batch_id: data.batch_id || '', session: data.session || '2025-26',
        admission_year: data.admission_year || '2025-2026',
        total_fee: data.total_fee, discount: data.discount, registration_fee: data.registration_fee,
      })
    } catch { toast.error('Failed to load student') }
  }

  async function fetchBatches(cid: string) {
    const { data } = await supabase.from('uce_batches').select('*').eq('course_id', cid).eq('is_active', true).order('name')
    setBatches(data ?? [])
    const c = courses.find(x => x.id === cid)
    if (c) { setValue('total_fee', c.total_fee); setCertFee(c.certification_fee) }
  }

  const stepFields: Record<number, (keyof FormData)[]> = {
    1: ['name', 'father_name'],
    2: ['phone'],
    3: ['district', 'state'],
    4: ['course_id', 'session', 'admission_year'],
  }

  async function goNext() {
    const fields = stepFields[step]
    if (fields) { const ok = await trigger(fields); if (!ok) return }
    if (step < 4) setStep(step + 1)
  }

  async function onSubmit(form: FormData) {
    const parsed = schema.safeParse(form)
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }

    // Resolve branch_id: super_admin picks from dropdown, branch user uses their own
    const effectiveBranchId = isSuperAdmin
      ? selectedBranchId
      : (profile?.branch_id || selectedBranchId)

    if (!effectiveBranchId) {
      toast.error(isSuperAdmin ? 'Please select a branch' : 'Your account is not attached to a branch — contact super admin')
      if (isSuperAdmin) setStep(4)
      return
    }

    // Wallet check (only when we have a branch and cert fee applies, on create)
    if (!isEdit && branch && certFee > 0) {
      if ((branch.wallet_balance || 0) < certFee) {
        setWalletError(true); return
      }
    }

    setSaving(true)
    try {
      let photoFinalUrl = photoUrl
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `student-photos/${editId || 'new'}/${Date.now()}.${ext}`
        const { data: upData, error: upErr } = await supabase.storage.from('uce-student-photos').upload(path, photoFile, { upsert: true })
        if (!upErr && upData) { const { data: urlD } = supabase.storage.from('uce-student-photos').getPublicUrl(upData.path); photoFinalUrl = urlD.publicUrl }
      }

      const payload = {
        registration_no: regNo, branch_id: effectiveBranchId,
        name: form.name, father_name: form.father_name, mother_name: form.mother_name || null,
        dob: form.dob || null, gender: form.gender || null, aadhar_number: form.aadhar_number || null,
        photo_url: photoFinalUrl, phone: form.phone, alt_phone: form.alt_phone || null,
        email: form.email || null, whatsapp: form.whatsapp || null,
        address: form.address || null, village: form.village || null, block: form.block || null,
        district: form.district, state: form.state, pincode: form.pincode || null,
        course_id: form.course_id, batch_id: form.batch_id || null,
        total_fee: form.total_fee, discount: form.discount, net_fee: netFee,
        registration_fee: form.registration_fee, session: form.session,
        admission_year: form.admission_year, enrollment_date: new Date().toISOString().split('T')[0],
        registered_by: user?.id || null, updated_at: new Date().toISOString(),
      }

      if (isEdit) {
        const { error } = await supabase.from('uce_students').update(payload).eq('id', editId)
        if (error) throw error; toast.success('Student updated')
      } else {
        const { data: newStudent, error } = await supabase.from('uce_students').insert({ ...payload, is_active: true }).select().single()
        if (error) { if (error.message?.includes('duplicate')) toast.error('Registration number already exists'); else throw error; return }

        // Wallet deduction
        if (branch && certFee > 0 && newStudent) {
          const newBal = (branch.wallet_balance || 0) - certFee
          await supabase.from('uce_branches').update({ wallet_balance: newBal }).eq('id', branch.id)
          await supabase.from('uce_branch_wallet_transactions').insert({
            branch_id: branch.id, type: 'debit', amount: certFee, balance_after: newBal,
            description: `Certificate fee - ${regNo}`, reference_type: 'student_registration',
            reference_id: newStudent.id, performed_by: user?.id || null,
          })
        }

        // Record registration fee payment
        if (form.registration_fee > 0 && newStudent) {
          await supabase.from('uce_student_fee_payments').insert({
            student_id: newStudent.id, amount: form.registration_fee,
            payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash',
            note: 'Registration fee', recorded_by: user?.id || null,
          })
        }

        toast.success('Student registered successfully')
      }
      navigate('/admin/students')
    } catch (err) { console.error(err); toast.error('Failed to save student') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="max-w-3xl mx-auto space-y-4"><div className="skeleton h-8 w-48 rounded-lg" /><div className="skeleton h-3 w-full rounded-full" /><div className="bg-white rounded-xl border p-6 space-y-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div></div>

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/students')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0"><ArrowLeft size={18} className="text-gray-600" /></button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit Student' : 'Register Student'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">{regNo}</span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-5">
        <div className="sm:hidden">
          <div className="flex items-center gap-1 mb-2">{STEPS.map(s => <div key={s.id} className={cn('flex-1 h-1.5 rounded-full transition-all', step > s.id ? 'bg-green-500' : step === s.id ? 'bg-red-500' : 'bg-gray-200')} />)}</div>
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-gray-900">Step {step} of {STEPS.length}</p><p className="text-sm font-medium text-red-600">{STEPS[step - 1].label}</p></div>
        </div>
        <div className="hidden sm:flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon; const isActive = step === s.id; const isDone = step > s.id
            return (
              <div key={s.id} className="flex items-center flex-1">
                <button onClick={() => { if (isDone) setStep(s.id) }} className={cn('flex items-center gap-2 shrink-0', isDone && 'cursor-pointer')}>
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0', isActive && 'bg-red-600 text-white shadow-md shadow-red-200', isDone && 'bg-green-500 text-white', !isActive && !isDone && 'bg-gray-100 text-gray-400')}>
                    {isDone ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <div className="text-left"><p className={cn('text-xs font-medium', isActive ? 'text-red-600' : isDone ? 'text-green-600' : 'text-gray-400')}>Step {s.id}</p><p className={cn('text-sm font-semibold', isActive ? 'text-gray-900' : isDone ? 'text-gray-700' : 'text-gray-400')}>{s.label}</p></div>
                </button>
                {i < STEPS.length - 1 && <div className="flex-1 mx-4"><div className="h-0.5 rounded-full bg-gray-200 relative"><div className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-300" style={{ width: isDone ? '100%' : '0%' }} /></div></div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-[280px]">

          {step === 1 && (<>
            <h2 className="text-sm font-semibold text-gray-900 font-heading flex items-center gap-2"><User size={16} className="text-red-500" /> Personal Information</h2>
            <FormField label="Student Photo"><FileUpload value={photoUrl} onChange={(u, f) => { setPhotoUrl(u); setPhotoFile(f) }} maxSizeKB={500} previewSize={100} /></FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Student Name" required error={errors.name?.message}><input {...register('name')} className={inputClass} placeholder="Full name" /></FormField>
              <FormField label="Father's Name" required error={errors.father_name?.message}><input {...register('father_name')} className={inputClass} placeholder="Father's name" /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Mother's Name"><input {...register('mother_name')} className={inputClass} placeholder="Mother's name" /></FormField>
              <FormField label="Date of Birth"><input type="date" {...register('dob')} className={inputClass} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Gender"><select {...register('gender')} className={selectClass}><option value="">Select</option>{GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}</select></FormField>
              <FormField label="Aadhar Number" error={errors.aadhar_number?.message}><input {...register('aadhar_number')} className={inputClass} placeholder="12-digit Aadhar" maxLength={12} /></FormField>
            </div>
          </>)}

          {step === 2 && (<>
            <h2 className="text-sm font-semibold text-gray-900 font-heading flex items-center gap-2"><Phone size={16} className="text-red-500" /> Contact Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Phone Number" required error={errors.phone?.message}><input {...register('phone')} className={inputClass} placeholder="10-digit mobile" maxLength={10} /></FormField>
              <FormField label="Alternate Phone" error={errors.alt_phone?.message}><input {...register('alt_phone')} className={inputClass} placeholder="Optional" maxLength={10} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email" error={errors.email?.message}><input {...register('email')} type="email" className={inputClass} placeholder="student@email.com" /></FormField>
              <FormField label="WhatsApp"><input {...register('whatsapp')} className={inputClass} placeholder="WhatsApp number" maxLength={10} /></FormField>
            </div>
          </>)}

          {step === 3 && (<>
            <h2 className="text-sm font-semibold text-gray-900 font-heading flex items-center gap-2"><MapPin size={16} className="text-red-500" /> Address</h2>
            <FormField label="Full Address"><textarea {...register('address')} className={`${inputClass} resize-none`} rows={2} placeholder="Complete address" /></FormField>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Village"><input {...register('village')} className={inputClass} /></FormField>
              <FormField label="Block"><input {...register('block')} className={inputClass} /></FormField>
              <FormField label="District" required error={errors.district?.message}><input {...register('district')} className={inputClass} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="State" required error={errors.state?.message}><select {...register('state')} className={selectClass}><option value="">Select</option>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></FormField>
              <FormField label="Pincode" error={errors.pincode?.message}><input {...register('pincode')} className={inputClass} placeholder="6-digit" maxLength={6} /></FormField>
            </div>
          </>)}

          {step === 4 && (<>
            <h2 className="text-sm font-semibold text-gray-900 font-heading flex items-center gap-2"><BookOpen size={16} className="text-red-500" /> Course & Fee</h2>

            {isSuperAdmin && (
              <FormField label="Branch" required hint="Pick the branch this student belongs to">
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}
                    className={`${selectClass} pl-9`}>
                    <option value="">Select branch</option>
                    {branchesList.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                </div>
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Course" required error={errors.course_id?.message}>
                <select {...register('course_id')} className={selectClass}><option value="">Select course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select>
              </FormField>
              <FormField label="Batch">
                <select {...register('batch_id')} className={selectClass}><option value="">Select batch</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Session" required><input {...register('session')} className={inputClass} placeholder="2025-26" /></FormField>
              <FormField label="Admission Year" required><select {...register('admission_year')} className={selectClass}>{ADMISSION_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></FormField>
            </div>

            {/* Fee breakdown */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3 mt-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee Breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Total Fee (₹)"><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span><input type="number" {...register('total_fee')} className={`${inputClass} pl-8`} min={0} /></div></FormField>
                <FormField label="Discount (₹)"><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span><input type="number" {...register('discount')} className={`${inputClass} pl-8`} min={0} /></div></FormField>
                <FormField label="Net Fee">
                  <div className="px-3.5 py-2.5 rounded-lg bg-white border border-gray-300 text-sm font-bold text-gray-900">{formatINR(netFee)}</div>
                </FormField>
              </div>
              <FormField label="Registration Fee (₹)" hint="First payment now">
                <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span><input type="number" {...register('registration_fee')} className={`${inputClass} pl-8`} min={0} /></div>
              </FormField>
              {!isEdit && certFee > 0 && (
                <div className={`rounded-lg p-3 border ${(branch?.wallet_balance || 0) >= certFee ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Certification Fee:</span>
                    <span className="text-sm font-bold text-gray-900">{formatINR(certFee)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-600">Branch Wallet:</span>
                    <span className={`text-sm font-bold ${(branch?.wallet_balance || 0) >= certFee ? 'text-green-600' : 'text-red-600'}`}>{formatINR(branch?.wallet_balance || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          </>)}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-4 sm:mt-5 pb-4 sm:pb-6 gap-3">
          <button type="button" onClick={step === 1 ? () => navigate('/admin/students') : () => setStep(step - 1)}
            className="px-3 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <ArrowLeft size={16} /><span>{step === 1 ? 'Cancel' : 'Back'}</span>
          </button>
          {step < 4 ? (
            <button type="button" onClick={goNext} className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 flex items-center gap-1.5 shadow-sm">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={saving} className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm">
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : isEdit ? 'Update' : 'Register'}
            </button>
          )}
        </div>
      </form>

      {/* Wallet insufficient modal */}
      <Modal open={walletError} onClose={() => setWalletError(false)} title="Insufficient Balance" size="sm">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto"><AlertTriangle size={24} className="text-amber-600" /></div>
          <p className="text-sm text-gray-600">Your branch wallet balance (<span className="font-bold text-red-600">{formatINR(branch?.wallet_balance || 0)}</span>) is insufficient to cover the certification fee (<span className="font-bold">{formatINR(certFee)}</span>).</p>
          <p className="text-xs text-gray-400">Contact your Super Admin to recharge your wallet.</p>
          <button onClick={() => setWalletError(false)} className="w-full px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">OK, Understood</button>
        </div>
      </Modal>
    </div>
  )
}
