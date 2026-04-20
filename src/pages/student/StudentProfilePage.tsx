import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import FormField, { inputClass } from '../../components/FormField'

export default function StudentProfilePage() {
  const { rec, reload } = useStudentRecord()
  const [form, setForm] = useState({ phone: '', alt_phone: '', email: '', whatsapp: '', address: '', village: '', block: '', district: '', state: '', pincode: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (!rec) return
    setForm({
      phone: rec.phone || '', alt_phone: rec.alt_phone || '', email: rec.email || '',
      whatsapp: rec.whatsapp || '', address: rec.address || '', village: rec.village || '',
      block: rec.block || '', district: rec.district || '', state: rec.state || '', pincode: rec.pincode || '',
    })
  }, [rec])

  if (!rec) return null

  async function saveProfile() {
    setSavingProfile(true)
    const { error } = await supabase.from('uce_students').update({
      ...form,
      alt_phone: form.alt_phone || null, email: form.email || null, whatsapp: form.whatsapp || null,
      address: form.address || null, village: form.village || null, block: form.block || null,
      pincode: form.pincode || null, updated_at: new Date().toISOString(),
    }).eq('id', rec!.id)
    setSavingProfile(false)
    if (error) return toast.error(error.message)
    toast.success('Profile updated')
    reload()
  }

  async function changePassword() {
    if (newPw.length < 6) return toast.error('Password must be at least 6 characters')
    if (newPw !== confirmPw) return toast.error("Passwords don't match")
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) return toast.error(error.message)
    toast.success('Password changed')
    setNewPw(''); setConfirmPw('')
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">My Profile</h1>

      <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-2">
        <p className="text-sm font-semibold text-gray-700 mb-2">Identity (locked)</p>
        <Row label="Name" value={rec.name} />
        <Row label="Father" value={rec.father_name} />
        <Row label="Registration No." value={rec.registration_no} />
        <Row label="Course" value={rec.course?.name ?? '—'} />
        <Row label="Institute" value={rec.branch?.name ?? '—'} />
      </div>

      <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Contact Details</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="Phone"><input className={inputClass} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></FormField>
          <FormField label="Alternate Phone"><input className={inputClass} value={form.alt_phone} onChange={e => setForm({ ...form, alt_phone: e.target.value })} /></FormField>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="Email"><input className={inputClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></FormField>
          <FormField label="WhatsApp"><input className={inputClass} value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></FormField>
        </div>
        <FormField label="Address"><textarea rows={2} className={inputClass} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></FormField>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Village"><input className={inputClass} value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} /></FormField>
          <FormField label="Block"><input className={inputClass} value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} /></FormField>
          <FormField label="District"><input className={inputClass} value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="State"><input className={inputClass} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></FormField>
          <FormField label="Pincode"><input className={inputClass} value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} maxLength={6} /></FormField>
        </div>
        <div className="flex justify-end pt-1">
          <button onClick={saveProfile} disabled={savingProfile}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 sm:p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Lock size={14} /> Change Password</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="New Password"><input type="password" className={inputClass} value={newPw} onChange={e => setNewPw(e.target.value)} /></FormField>
          <FormField label="Confirm New Password"><input type="password" className={inputClass} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></FormField>
        </div>
        <div className="flex justify-end pt-1">
          <button onClick={changePassword} disabled={savingPw || !newPw}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {savingPw ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Update Password
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between text-sm border-b border-gray-100 pb-2 gap-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 break-words">{value}</span>
    </div>
  )
}
