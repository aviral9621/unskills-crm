import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { isStudentLocked } from '../../lib/studentLock'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Loader2, Check, User, Phone, MapPin, BookOpen, AlertTriangle, Package, Coins } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, deletePublicFile, isBlobUrl, STORAGE_BUCKETS } from '../../lib/uploads'
import { useAuth } from '../../contexts/AuthContext'
import { fetchPointBalance, consumePoint } from '../../lib/rewards'
import { INDIAN_STATES, formatINR, cn } from '../../lib/utils'
import FormField, { inputClass } from '../../components/FormField'
import FileUpload from '../../components/FileUpload'
import Modal from '../../components/Modal'
import Select from '../../components/Select'
import type { Course, Batch, Branch } from '../../types'

const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Contact', icon: Phone },
  { id: 3, label: 'Address', icon: MapPin },
  { id: 4, label: 'Course & Fee', icon: BookOpen },
] as const

const GENDERS = ['male', 'female', 'other'] as const
const ADMISSION_YEARS = (() => {
  const cy = new Date().getFullYear()
  return Array.from({ length: 8 }, (_, i) => cy - 5 + i).map(y => `${y}-${y + 1}`)
})()

const CATEGORIES = ['GEN', 'OBC', 'OBC-NCL', 'SC', 'ST', 'EWS', 'Other'] as const
const RELIGIONS = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other'] as const
const IDENTITY_TYPES = ['Adhar Card', 'Voter ID', 'Passport', 'Driving License', 'PAN Card', 'Other'] as const

const schema = z.object({
  name: z.string().min(2, 'Student name required'),
  father_name: z.string().min(2, "Father's name required"),
  mother_name: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().optional(),
  identity_type: z.string().optional(),
  aadhar_number: z.string().regex(/^(\d{12})?$/, 'Aadhaar must be exactly 12 digits (or leave blank)').optional().or(z.literal('')),
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
  admission_date: z.string().optional(),
  admission_year: z.string().min(1, 'Year required'),
  total_fee: z.coerce.number().min(0),
  discount: z.coerce.number().min(0),
  registration_fee: z.coerce.number().min(0),
  fee_start_month: z.string().optional().or(z.literal('')),
  installment_count: z.coerce.number().int().min(0).optional(),
  monthly_fee: z.coerce.number().min(0).optional(),
  referral_code: z.string().regex(/^([A-Z0-9]{6,7})?$/, 'Code must be 6-7 letters/digits').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

type PackageType = 'certificate_only' | 'certificate_kit'

export default function StudentRegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const base = location.pathname.startsWith('/franchise') ? '/franchise' : '/admin'
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = !!editId
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [locked, setLocked] = useState(false)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regNo, setRegNo] = useState('UCE/...')

  const [courses, setCourses] = useState<Course[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchCounts, setBatchCounts] = useState<Record<string, number>>({})
  const [branch, setBranch] = useState<Branch | null>(null)
  const [branchesList, setBranchesList] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [certFee, setCertFee] = useState(0)
  const [kitAmount, setKitAmount] = useState(500)
  const [packageType, setPackageType] = useState<PackageType>('certificate_only')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const savedPhotoUrlRef = useRef<string | null>(null)

  const [walletError, setWalletError] = useState(false)
  const [payLaterLoading, setPayLaterLoading] = useState(false)

  // Certificate-point wallet
  const [pointBalance, setPointBalance] = useState<number>(0)
  const [usePoint, setUsePoint] = useState<boolean>(false)

  // Referral code: lookup state — 'idle' | 'checking' | 'valid' | 'invalid'
  const [refState, setRefState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [refReferrerName, setRefReferrerName] = useState<string>('')
  const refTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentAcademicYear = (() => {
    const cy = new Date().getFullYear()
    return `${cy}-${cy + 1}`
  })()

  const { register, handleSubmit, watch, reset, trigger, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      state: 'Uttar Pradesh',
      admission_date: new Date().toISOString().split('T')[0],
      admission_year: currentAcademicYear,
      total_fee: 0, discount: 0, registration_fee: 0,
    },
  })

  const courseId = watch('course_id')
  const totalFee = watch('total_fee')
  const discount = watch('discount')
  const netFee = Math.max(0, (totalFee || 0) - (discount || 0))

  // Total amount to deduct based on package selection
  const totalDeduction = certFee + (packageType === 'certificate_kit' ? kitAmount : 0)

  useEffect(() => { fetchInitial() }, [])
  useEffect(() => { fetchBatches() }, [])
  useEffect(() => { if (courseId) {
    const c = courses.find(x => x.id === courseId)
    if (c) {
      if (!isEdit) setValue('total_fee', c.total_fee)
      setCertFee(c.certification_fee)
    }
  } }, [courseId, courses])

  async function fetchInitial() {
    setLoading(true)
    try {
      const [cRes, branchRes, kitRes] = await Promise.all([
        supabase.from('uce_courses').select('*').eq('is_active', true).order('name'),
        isSuperAdmin
          ? supabase.from('uce_branches').select('*').eq('is_active', true).order('name')
          : profile?.branch_id
            ? supabase.from('uce_branches').select('*').eq('id', profile.branch_id)
            : Promise.resolve({ data: [], error: null }),
        supabase.from('uce_site_settings').select('value').eq('key', 'site_kit_amount').maybeSingle(),
      ])
      setCourses(cRes.data ?? [])
      const list = (branchRes.data ?? []) as Branch[]
      setBranchesList(list)
      if (!isSuperAdmin && list.length === 1) {
        setBranch(list[0])
        setSelectedBranchId(list[0].id)
      } else if (isSuperAdmin && list.length === 1) {
        setBranch(list[0])
        setSelectedBranchId(list[0].id)
      }
      const kitVal = parseInt(kitRes.data?.value || '500', 10)
      setKitAmount(isNaN(kitVal) ? 500 : kitVal)

      if (!isEdit) await generateRegNo()
      else await loadStudent()
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!selectedBranchId) { setBranch(null); return }
    const b = branchesList.find(x => x.id === selectedBranchId) || null
    setBranch(b)
  }, [selectedBranchId, branchesList])

  // Load certificate-point balance for the selected branch (franchise side only)
  useEffect(() => {
    if (!selectedBranchId || isSuperAdmin) { setPointBalance(0); return }
    let cancelled = false
    fetchPointBalance(selectedBranchId)
      .then(b => { if (!cancelled) setPointBalance(b.balance ?? 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedBranchId, isSuperAdmin])

  // If user toggled "use point" and then switched to a branch with no points, reset.
  useEffect(() => {
    if (usePoint && pointBalance < 1) setUsePoint(false)
  }, [pointBalance, usePoint])

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
      if (error || !data) { toast.error('Student not found'); navigate(`${base}/students`); return }
      if (editId) setLocked(await isStudentLocked(editId))
      setRegNo(data.registration_no)
      setPhotoUrl(data.photo_url)
      savedPhotoUrlRef.current = data.photo_url
      setSelectedBranchId(data.branch_id || '')
      if (data.package_type) setPackageType(data.package_type as PackageType)
      reset({
        name: data.name, father_name: data.father_name, mother_name: data.mother_name || '',
        dob: data.dob || '', gender: data.gender || '',
        category: data.category || '', religion: data.religion || '', identity_type: data.identity_type || '',
        aadhar_number: data.aadhar_number || '',
        phone: data.phone, alt_phone: data.alt_phone || '', email: data.email || '', whatsapp: data.whatsapp || '',
        address: data.address || '', village: data.village || '', block: data.block || '',
        district: data.district || '', state: data.state || 'Uttar Pradesh', pincode: data.pincode || '',
        course_id: data.course_id, batch_id: data.batch_id || '',
        admission_date: data.admission_date || new Date().toISOString().split('T')[0],
        admission_year: data.admission_year || currentAcademicYear,
        total_fee: data.total_fee, discount: data.discount, registration_fee: data.registration_fee,
        fee_start_month: data.fee_start_month || '',
        installment_count: data.installment_count ?? 0,
        monthly_fee: data.monthly_fee ?? 0,
      })
    } catch { toast.error('Failed to load student') }
  }

  // Resolve a referral code to a referrer's first name (returns null if invalid).
  // Uses the public RPC so we never need full referrer-row select access.
  async function resolveReferralCode(code: string): Promise<string | null> {
    const trimmed = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6,7}$/.test(trimmed)) return null
    const { data, error } = await supabase.rpc('fn_resolve_referral_code_public', { p_code: trimmed })
    if (error) return null
    const row = Array.isArray(data) ? data[0] : data
    return row?.referrer_first_name ?? null
  }

  function onReferralCodeChange(raw: string) {
    const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7)
    setValue('referral_code', code, { shouldValidate: false })
    if (refTimerRef.current) clearTimeout(refTimerRef.current)
    if (!code) { setRefState('idle'); setRefReferrerName(''); return }
    if (code.length < 6) { setRefState('idle'); setRefReferrerName(''); return }
    setRefState('checking')
    refTimerRef.current = setTimeout(async () => {
      const name = await resolveReferralCode(code)
      if (name) { setRefState('valid'); setRefReferrerName(name) }
      else      { setRefState('invalid'); setRefReferrerName('') }
    }, 500)
  }

  async function fetchBatches() {
    let bq = supabase.from('uce_batches')
      .select('*, teacher:uce_employees!uce_batches_teacher_id_fkey(name)')
      .eq('is_active', true).order('name')
    if (!isSuperAdmin && profile?.branch_id) {
      bq = bq.or(`branch_id.eq.${profile.branch_id},branch_id.is.null`)
    }
    const [bRes, cntRes] = await Promise.all([
      bq,
      supabase.from('uce_students').select('batch_id').not('batch_id', 'is', null),
    ])
    const counts: Record<string, number> = {}
    ;(cntRes.data ?? []).forEach((r: { batch_id: string | null }) => {
      if (r.batch_id) counts[r.batch_id] = (counts[r.batch_id] || 0) + 1
    })
    setBatches((bRes.data ?? []) as Batch[])
    setBatchCounts(counts)
  }

  const stepFields: Record<number, (keyof FormData)[]> = {
    1: ['name', 'father_name', 'aadhar_number'],
    2: ['phone', 'alt_phone', 'email'],
    3: ['district', 'state', 'pincode'],
    4: ['course_id', 'admission_year'],
  }

  const fieldStepMap: Partial<Record<keyof FormData, { step: number; label: string }>> = {
    name: { step: 1, label: 'Student Name (Step 1)' },
    father_name: { step: 1, label: "Father's Name (Step 1)" },
    aadhar_number: { step: 1, label: 'Aadhar Number (Step 1)' },
    phone: { step: 2, label: 'Phone Number (Step 2)' },
    alt_phone: { step: 2, label: 'Alternate Phone (Step 2)' },
    email: { step: 2, label: 'Email (Step 2)' },
    district: { step: 3, label: 'District (Step 3)' },
    state: { step: 3, label: 'State (Step 3)' },
    pincode: { step: 3, label: 'Pincode (Step 3)' },
    course_id: { step: 4, label: 'Course (Step 4)' },
    admission_year: { step: 4, label: 'Admission Year (Step 4)' },
  }

  async function goNext() {
    const fields = stepFields[step]
    if (fields) {
      const ok = await trigger(fields)
      if (!ok) {
        const firstErrField = fields.find(f => errors[f])
        if (firstErrField) {
          const meta = fieldStepMap[firstErrField]
          const msg = errors[firstErrField]?.message as string | undefined
          toast.error(meta ? `${meta.label}: ${msg || 'is invalid'}` : (msg || 'Invalid field'))
        }
        return
      }
    }
    if (step < 4) setStep(step + 1)
  }

  async function saveStudent(form: FormData, payLater: boolean) {
    const effectiveBranchId = isSuperAdmin
      ? selectedBranchId
      : (profile?.branch_id || selectedBranchId)

    if (!effectiveBranchId) {
      toast.error(isSuperAdmin ? 'Please select a branch' : 'Your account is not attached to a branch — contact super admin')
      if (isSuperAdmin) setStep(4)
      return
    }

    // Final capacity guard — fetch live count to avoid race
    if (form.batch_id) {
      const b = batches.find(x => x.id === form.batch_id)
      if (b?.max_students) {
        const { count } = await supabase.from('uce_students')
          .select('id', { count: 'exact', head: true })
          .eq('batch_id', form.batch_id)
          .neq('id', editId || '00000000-0000-0000-0000-000000000000')
        if ((count ?? 0) >= b.max_students) {
          toast.error(`No seats left in "${b.name}" — capacity ${b.max_students} reached. Choose a different batch or contact admin.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      let photoFinalUrl: string | null = isBlobUrl(photoUrl) ? null : photoUrl
      if (photoFile) {
        const ext = (photoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${editId || 'new'}/${Date.now()}.${ext}`
        try {
          photoFinalUrl = await uploadPublicFile(STORAGE_BUCKETS.studentPhotos, path, photoFile)
        } catch (e) {
          console.error(e); toast.error('Failed to upload photo'); setSaving(false); return
        }
      }

      const payload = {
        registration_no: regNo, branch_id: effectiveBranchId,
        name: form.name, father_name: form.father_name, mother_name: form.mother_name || null,
        dob: form.dob || null, gender: form.gender || null,
        category: form.category || null, religion: form.religion || null, identity_type: form.identity_type || null,
        aadhar_number: form.aadhar_number || null,
        photo_url: photoFinalUrl, phone: form.phone, alt_phone: form.alt_phone || null,
        email: form.email || null, whatsapp: form.whatsapp || null,
        address: form.address || null, village: form.village || null, block: form.block || null,
        district: form.district, state: form.state, pincode: form.pincode || null,
        course_id: form.course_id, batch_id: form.batch_id || null,
        total_fee: form.total_fee, discount: form.discount, net_fee: netFee,
        registration_fee: form.registration_fee,
        admission_date: form.admission_date || new Date().toISOString().split('T')[0],
        admission_year: form.admission_year,
        enrollment_date: new Date().toISOString().split('T')[0],
        package_type: packageType,
        // fee_start_month accepts a full ISO date (YYYY-MM-DD); legacy month-only
        // values (YYYY-MM) get auto-promoted to the 1st of that month.
        fee_start_month: form.fee_start_month
          ? (/^\d{4}-\d{2}$/.test(form.fee_start_month) ? `${form.fee_start_month}-01` : form.fee_start_month)
          : null,
        installment_count: form.installment_count && form.installment_count > 0 ? form.installment_count : null,
        monthly_fee: form.monthly_fee && form.monthly_fee > 0 ? form.monthly_fee : null,
        registered_by: user?.id || null, updated_at: new Date().toISOString(),
      }

      if (isEdit) {
        const oldUrl = savedPhotoUrlRef.current
        if (oldUrl && oldUrl !== photoFinalUrl) void deletePublicFile(oldUrl)
        const { error } = await supabase.from('uce_students').update(payload).eq('id', editId)
        if (error) throw error
        savedPhotoUrlRef.current = photoFinalUrl
        if (editId) { void supabase.rpc('fn_generate_fee_schedule', { p_student_id: editId }) }
        toast.success('Student updated')
      } else {
        const { data: newStudent, error } = await supabase.from('uce_students').insert({ ...payload, is_active: true }).select().single()
        if (error) { if (error.message?.includes('duplicate')) toast.error('Registration number already exists'); else throw error; return }

        if (branch && totalDeduction > 0 && newStudent && !isSuperAdmin) {
          if (usePoint && pointBalance >= 1) {
            // Burn 1 certificate point in lieu of rupee debit.
            try {
              await consumePoint(branch.id, newStudent.id,
                `${packageType === 'certificate_kit' ? 'Certificate + Kit' : 'Certificate'} fee - ${regNo} (paid with 1 point)`)
              setPointBalance(p => Math.max(0, p - 1))
              toast.success('1 Certificate Point used — wallet not charged.')
            } catch (e) {
              // Point burn failed — don't break registration; surface a warning.
              console.warn('consumePoint failed', e)
              toast.warning('Could not consume point — please contact admin to reconcile.')
            }
          } else if (payLater) {
            // Record pending payment — deduction happens within 24 hours
            const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            await supabase.from('uce_pending_wallet_payments').insert({
              branch_id: branch.id, student_id: newStudent.id, amount: totalDeduction,
              description: `${packageType === 'certificate_kit' ? 'Certificate + Kit' : 'Certificate'} fee - ${regNo} (Pay Later)`,
              due_at: dueAt, status: 'pending', created_by: user?.id || null,
            })
            toast.warning(`Student registered. ₹${totalDeduction} payment due within 24 hours.`)
          } else {
            const newBal = (branch.wallet_balance || 0) - totalDeduction
            await supabase.from('uce_branches').update({ wallet_balance: newBal }).eq('id', branch.id)
            await supabase.from('uce_branch_wallet_transactions').insert({
              branch_id: branch.id, type: 'debit', amount: totalDeduction, balance_after: newBal,
              description: `${packageType === 'certificate_kit' ? 'Certificate + Kit' : 'Certificate'} fee - ${regNo}`,
              reference_type: 'student_registration', reference_id: newStudent.id,
              performed_by: user?.id || null,
            })
          }
        }

        if (form.registration_fee > 0 && newStudent) {
          await supabase.from('uce_student_fee_payments').insert({
            student_id: newStudent.id, branch_id: effectiveBranchId, amount: form.registration_fee,
            payment_date: new Date().toISOString().split('T')[0], payment_mode: 'cash',
            note: 'Registration fee', recorded_by: user?.id || null, status: 'confirmed',
          })
        }

        if (newStudent && form.fee_start_month && form.installment_count && form.installment_count > 0) {
          void supabase.rpc('fn_generate_fee_schedule', { p_student_id: newStudent.id })
        }

        if (newStudent) {
          const { error: fnErr } = await supabase.functions.invoke('create-student-auth', {
            body: { student_id: newStudent.id },
          })
          if (fnErr) {
            console.warn('create-student-auth failed', fnErr)
            toast.warning('Student saved, but login account could not be created. Contact admin.')
          }
        }

        // Referral: re-validate at submit time and insert referral row.
        // Silent failure — never block admission over a referral hiccup.
        if (newStudent && form.referral_code && refState === 'valid') {
          try {
            const { data: refResolved } = await supabase.rpc('fn_resolve_referral_code', {
              p_code: form.referral_code.trim().toUpperCase(),
            })
            const referrerId = refResolved as string | null
            if (referrerId && referrerId !== newStudent.id) {
              await supabase.from('uce_referrals').insert({
                referrer_student_id: referrerId,
                referee_student_id: newStudent.id,
                referee_phone: newStudent.phone,
                level: 1,
                status: 'pending',
              })
            }
          } catch (e) { console.warn('Referral insert failed (non-blocking)', e) }
        }

        if (!payLater) toast.success('Student registered successfully')
      }
      navigate(`${base}/students`)
    } catch (err) { console.error(err); toast.error('Failed to save student') }
    finally { setSaving(false) }
  }

  async function onSubmit(form: FormData) {
    if (step !== 4) return
    if (isEdit && locked && !isSuperAdmin) {
      toast.error('This student is locked because a certificate or result has been issued')
      return
    }
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const key = issue.path[0] as keyof FormData
      const meta = fieldStepMap[key]
      toast.error(meta ? `${meta.label}: ${issue.message}` : issue.message)
      if (meta) setStep(meta.step)
      return
    }

    const effectiveBranchId = isSuperAdmin
      ? selectedBranchId
      : (profile?.branch_id || selectedBranchId)

    if (!effectiveBranchId) {
      toast.error(isSuperAdmin ? 'Please select a branch' : 'Your account is not attached to a branch — contact super admin')
      if (isSuperAdmin) setStep(4)
      return
    }

    if (!isEdit && branch && totalDeduction > 0 && !isSuperAdmin && !usePoint) {
      if ((branch.wallet_balance || 0) < totalDeduction) {
        setWalletError(true); return
      }
    }

    await saveStudent(form, false)
  }

  async function handlePayLater() {
    const form = watch()
    setWalletError(false)
    setPayLaterLoading(true)
    try {
      await saveStudent(form as FormData, true)
    } finally {
      setPayLaterLoading(false)
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto space-y-4"><div className="skeleton h-8 w-48 rounded-lg" /><div className="skeleton h-3 w-full rounded-full" /><div className="bg-white rounded-xl border p-6 space-y-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div></div>

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate(`${base}/students`)} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0"><ArrowLeft size={18} className="text-gray-600" /></button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading">{isEdit ? 'Edit Student' : 'Register Student'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">{regNo}</span>
          </div>
        </div>
      </div>

      {isEdit && locked && !isSuperAdmin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600" />
          <p className="text-sm text-amber-900">
            <strong>Data locked.</strong> A certificate or result has been issued for this student — their details cannot be edited.
          </p>
        </div>
      )}

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
              <FormField label="Gender">
                <Select
                  value={watch('gender') || ''}
                  onChange={v => setValue('gender', v, { shouldValidate: true })}
                  options={GENDERS.map(g => ({ value: g, label: g.charAt(0).toUpperCase() + g.slice(1) }))}
                  placeholder="Select gender"
                />
              </FormField>
              <FormField label="Aadhar Number" hint="Leave blank if unknown — but if you enter it, it must be all 12 digits." error={errors.aadhar_number?.message}>
                <input
                  {...register('aadhar_number')}
                  inputMode="numeric"
                  className={inputClass}
                  placeholder="12-digit Aadhar"
                  maxLength={12}
                  onInput={e => {
                    const el = e.currentTarget
                    const cleaned = el.value.replace(/\D/g, '')
                    if (cleaned !== el.value) el.value = cleaned
                  }}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Category">
                <Select
                  value={watch('category') || ''}
                  onChange={v => setValue('category', v)}
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  placeholder="Select category"
                />
              </FormField>
              <FormField label="Religion">
                <Select
                  value={watch('religion') || ''}
                  onChange={v => setValue('religion', v)}
                  options={RELIGIONS.map(r => ({ value: r, label: r }))}
                  placeholder="Select religion"
                />
              </FormField>
              <FormField label="Identity Type">
                <Select
                  value={watch('identity_type') || ''}
                  onChange={v => setValue('identity_type', v)}
                  options={IDENTITY_TYPES.map(t => ({ value: t, label: t }))}
                  placeholder="Select ID type"
                />
              </FormField>
            </div>
            {/* Referral code (optional) */}
            <FormField
              label="Referral Code"
              hint="Optional — 6-character code if this student was referred by an existing student"
              error={errors.referral_code?.message}
            >
              <div className="relative">
                <input
                  value={watch('referral_code') || ''}
                  onChange={e => onReferralCodeChange(e.target.value)}
                  className={cn(inputClass, 'uppercase tracking-widest font-mono')}
                  placeholder="e.g. AB12CD"
                  maxLength={7}
                />
                {refState === 'checking' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 inline-flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Checking…
                  </span>
                )}
                {refState === 'valid' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600 inline-flex items-center gap-1">
                    <Check size={12} /> Referred by {refReferrerName}
                  </span>
                )}
                {refState === 'invalid' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-red-500">
                    Unknown code
                  </span>
                )}
              </div>
            </FormField>
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
            <FormField label="Address"><textarea {...register('address')} className={`${inputClass} resize-none`} rows={2} placeholder="House no, street, locality" /></FormField>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Village"><input {...register('village')} className={inputClass} /></FormField>
              <FormField label="Block"><input {...register('block')} className={inputClass} /></FormField>
              <FormField label="District" required error={errors.district?.message}><input {...register('district')} className={inputClass} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="State" required error={errors.state?.message}>
                <Select
                  value={watch('state') || ''}
                  onChange={v => setValue('state', v, { shouldValidate: true })}
                  options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                  placeholder="Select state"
                  error={!!errors.state}
                />
              </FormField>
              <FormField label="Pincode" error={errors.pincode?.message}><input {...register('pincode')} className={inputClass} placeholder="6-digit" maxLength={6} /></FormField>
            </div>
          </>)}

          {step === 4 && (<>
            <h2 className="text-sm font-semibold text-gray-900 font-heading flex items-center gap-2"><BookOpen size={16} className="text-red-500" /> Course & Fee</h2>

            {isSuperAdmin && (
              <FormField label="Branch" required hint="Pick the branch this student belongs to">
                <Select
                  value={selectedBranchId}
                  onChange={v => setSelectedBranchId(v)}
                  options={branchesList.map(b => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                  placeholder={loading ? 'Loading branches…' : branchesList.length === 0 ? 'No branches available' : 'Select branch'}
                  disabled={loading || branchesList.length === 0}
                />
                {!loading && branchesList.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">No active branches found. Create a branch first, then come back here.</p>
                )}
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Course" required error={errors.course_id?.message}>
                <Select
                  value={watch('course_id') || ''}
                  onChange={v => setValue('course_id', v, { shouldValidate: true })}
                  options={courses.map(c => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                  placeholder="Select course"
                  error={!!errors.course_id}
                />
              </FormField>
              <FormField label="Batch">
                <Select
                  value={watch('batch_id') || ''}
                  onChange={v => {
                    const b = batches.find(x => x.id === v)
                    if (b && b.max_students && b.id !== (isEdit ? watch('batch_id') : '')) {
                      const used = batchCounts[v] || 0
                      if (used >= b.max_students) {
                        toast.error(`No seats left in "${b.name}" — capacity ${b.max_students} reached. Choose a different batch or contact admin.`)
                        return
                      }
                    }
                    setValue('batch_id', v, { shouldValidate: true })
                  }}
                  options={batches.map(b => {
                    const used = batchCounts[b.id] || 0
                    const cap = b.max_students || 0
                    const full = cap > 0 && used >= cap
                    const seats = cap > 0 ? ` — ${used}/${cap}${full ? ' FULL' : ''}` : ''
                    return { value: b.id, label: `${b.name}${seats}` }
                  })}
                  placeholder={batches.length === 0 ? 'No batches available' : 'Select batch'}
                  disabled={batches.length === 0}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Admission Date">
                <input type="date" {...register('admission_date')} className={inputClass} />
              </FormField>
              <FormField label="Admission Year" required error={errors.admission_year?.message}>
                <Select
                  value={watch('admission_year') || ''}
                  onChange={v => setValue('admission_year', v, { shouldValidate: true })}
                  options={ADMISSION_YEARS.map(y => ({ value: y, label: y }))}
                  placeholder="Select year"
                  error={!!errors.admission_year}
                />
              </FormField>
            </div>

            {/* Package Selection */}
            {!isEdit && certFee > 0 && !isSuperAdmin && (
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-red-500" />
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Registration Package</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={cn(
                    'flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all',
                    packageType === 'certificate_only' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                    <input type="radio" name="packageType" value="certificate_only"
                      checked={packageType === 'certificate_only'}
                      onChange={() => setPackageType('certificate_only')}
                      className="mt-0.5 accent-red-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Only Certificate</p>
                      <p className="text-xs text-gray-500 mt-0.5">Certificate fee only</p>
                      <p className="text-sm font-bold text-red-600 mt-1">{formatINR(certFee)}</p>
                    </div>
                  </label>
                  <label className={cn(
                    'flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all',
                    packageType === 'certificate_kit' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                    <input type="radio" name="packageType" value="certificate_kit"
                      checked={packageType === 'certificate_kit'}
                      onChange={() => setPackageType('certificate_kit')}
                      className="mt-0.5 accent-red-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Certificate + Kit</p>
                      <p className="text-xs text-gray-500 mt-0.5">Certificate + study kit ({formatINR(kitAmount)})</p>
                      <p className="text-sm font-bold text-red-600 mt-1">{formatINR(certFee + kitAmount)}</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

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

              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 mt-1">
                <p className="text-xs font-semibold text-gray-700 mb-0.5">Monthly Fee Plan <span className="text-gray-400 font-normal">(optional)</span></p>
                <p className="text-[11px] text-gray-500 mb-3">Set this to auto-generate a monthly payment schedule. Leave blank for flat / one-shot fees.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Fee Start Date" hint="Date the first installment is due">
                    <input type="date" {...register('fee_start_month')} className={inputClass} />
                  </FormField>
                  <FormField label="Installments">
                    <input type="number" min={0} {...register('installment_count')} className={inputClass} placeholder="e.g. 12" />
                  </FormField>
                  <FormField label="Monthly Fee (₹)" hint="Leave blank to auto-split net fee">
                    <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span><input type="number" min={0} {...register('monthly_fee')} className={`${inputClass} pl-8`} placeholder="auto" /></div>
                  </FormField>
                </div>
              </div>

              {!isEdit && totalDeduction > 0 && !isSuperAdmin && (
                <>
                  <div className={cn('rounded-lg p-3 border', usePoint ? 'bg-purple-50 border-purple-200' : (branch?.wallet_balance || 0) >= totalDeduction ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{packageType === 'certificate_kit' ? 'Certificate + Kit Fee:' : 'Certification Fee:'}</span>
                      <span className={cn('text-sm font-bold', usePoint ? 'text-purple-700 line-through' : 'text-gray-900')}>{formatINR(totalDeduction)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Branch Wallet:</span>
                      <span className={cn('text-sm font-bold', usePoint ? 'text-gray-500' : (branch?.wallet_balance || 0) >= totalDeduction ? 'text-green-600' : 'text-red-600')}>{formatINR(branch?.wallet_balance || 0)}</span>
                    </div>
                    {usePoint && (
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-purple-200">
                        <span className="text-xs text-purple-700 font-semibold">Charge to wallet:</span>
                        <span className="text-sm font-bold text-purple-700">₹0 + 1 Point</span>
                      </div>
                    )}
                  </div>
                  <label className={cn(
                    'flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors',
                    pointBalance < 1 ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' :
                    usePoint ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:bg-purple-50/50 hover:border-purple-200'
                  )}>
                    <input
                      type="checkbox"
                      checked={usePoint}
                      disabled={pointBalance < 1}
                      onChange={e => setUsePoint(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Coins size={14} className="text-purple-600" />
                        <span className="text-sm font-semibold text-gray-900">Use 1 Certificate Point</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">{pointBalance} available</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pointBalance >= 1
                          ? `Skip the ₹${totalDeduction} wallet charge — burn 1 point instead.`
                          : 'Earn points by hitting 10/20/30 admissions in a month.'}
                      </p>
                    </div>
                  </label>
                </>
              )}
              {!isEdit && totalDeduction > 0 && isSuperAdmin && (
                <div className="rounded-lg p-3 border bg-blue-50 border-blue-200 text-xs text-blue-800">
                  Super admin — {packageType === 'certificate_kit' ? 'certificate + kit' : 'certification'} fee (<b>{formatINR(totalDeduction)}</b>) is not billed to the branch wallet.
                </div>
              )}
            </div>
          </>)}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-4 sm:mt-5 pb-4 sm:pb-6 gap-3">
          <button type="button" onClick={step === 1 ? () => navigate(`${base}/students`) : () => setStep(step - 1)}
            className="px-3 sm:px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <ArrowLeft size={16} /><span>{step === 1 ? 'Cancel' : 'Back'}</span>
          </button>
          {step < 4 ? (
            <button type="button" onClick={goNext} className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 flex items-center gap-1.5 shadow-sm">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit(onSubmit)()}
              className="px-4 sm:px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : isEdit ? 'Update' : 'Register'}
            </button>
          )}
        </div>
      </form>

      {/* Wallet insufficient modal — with pay later option */}
      <Modal open={walletError} onClose={() => setWalletError(false)} title="Insufficient Wallet Balance" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center"><AlertTriangle size={24} className="text-amber-600" /></div>
            <p className="text-sm text-gray-600">
              Your branch wallet balance (<span className="font-bold text-red-600">{formatINR(branch?.wallet_balance || 0)}</span>) is insufficient to cover the {packageType === 'certificate_kit' ? 'certificate + kit' : 'certification'} fee (<span className="font-bold">{formatINR(totalDeduction)}</span>).
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold mb-0.5">Pay Later option</p>
            <p>Register the student now and clear the outstanding amount within <strong>24 hours</strong>. Failure to pay may result in account restrictions.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setWalletError(false)}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Go Back
            </button>
            <button
              onClick={handlePayLater}
              disabled={payLaterLoading}
              className="px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {payLaterLoading && <Loader2 size={14} className="animate-spin" />}
              Pay Later (24h)
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">Or recharge your wallet first — contact your Super Admin.</p>
        </div>
      </Modal>
    </div>
  )
}
