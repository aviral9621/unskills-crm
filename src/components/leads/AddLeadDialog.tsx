import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Modal from '../Modal'
import { supabase } from '../../lib/supabase'
import { ALL_LEAD_STATUSES, LEAD_STATUS_CONFIG, type LeadStatus } from '../../types/leads'
import { createManualLead } from '../../hooks/useLeads'

interface BranchOpt { id: string; name: string }

export default function AddLeadDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<LeadStatus>('new')
  const [courseInterest, setCourseInterest] = useState('')
  const [branchId, setBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [branches, setBranches] = useState<BranchOpt[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('uce_branches').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setBranches((data ?? []) as BranchOpt[]))
  }, [open])

  useEffect(() => {
    if (!open) {
      setName(''); setPhone(''); setEmail(''); setStatus('new'); setCourseInterest(''); setBranchId(''); setNotes('')
    }
  }, [open])

  async function submit() {
    if (!name.trim() || !phone.trim()) { toast.error('Name and phone are required'); return }
    setSaving(true)
    try {
      const lead = await createManualLead({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        status,
        course_interest: courseInterest.trim() || null,
        branch_id: branchId || null,
        notes: notes.trim() || null,
      })
      if (lead) {
        toast.success('Lead added')
        onCreated?.(lead.id)
        onClose()
      } else {
        toast.error('Failed to create lead')
      }
    } catch { toast.error('Failed to create lead') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Lead">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh Kumar" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as LeadStatus)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              {ALL_LEAD_STATUSES.map(s => <option key={s} value={s}>{LEAD_STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assign to Branch</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="">None</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Course Interest</label>
            <input value={courseInterest} onChange={e => setCourseInterest(e.target.value)} placeholder="e.g. DCA, Beautician Level 1" className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any additional context..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Adding…' : 'Add Lead'}</button>
        </div>
      </div>
    </Modal>
  )
}
