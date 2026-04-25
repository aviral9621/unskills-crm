import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Loader2 } from 'lucide-react'
import Modal from '../Modal'
import type { Lead } from '../../types/leads'
import { updateLeadStatus, logActivity } from '../../hooks/useLeads'
import { toast } from 'sonner'

interface Props {
  open: boolean
  lead: Lead
  performedByName: string
  onClose: () => void
}

export default function ConvertToStudentDialog({ open, lead, performedByName, onClose }: Props) {
  const navigate = useNavigate()
  const [converting, setConverting] = useState(false)

  async function handleConvert() {
    setConverting(true)
    try {
      // Mark lead as admitted before navigating
      await updateLeadStatus(lead.id, 'admitted')
      await logActivity(lead.id, 'converted', `Lead converted to student by ${performedByName}`, performedByName)
      toast.success('Lead marked as Admitted — opening registration form')
      onClose()
      // Navigate to student register with pre-filled query params
      const params = new URLSearchParams({
        name:   lead.name,
        phone:  lead.phone,
        ...(lead.email          ? { email:  lead.email }          : {}),
        ...(lead.course_interest ? { course: lead.course_interest } : {}),
        lead_id: lead.id,
      })
      navigate(`/admin/students/register?${params.toString()}`)
    } catch {
      toast.error('Failed to convert lead')
    } finally {
      setConverting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Convert Lead to Student">
      <div className="space-y-4">
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <GraduationCap size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-900">{lead.name}</p>
            <p className="text-xs text-green-700 mt-0.5">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
            {lead.course_interest && (
              <p className="text-xs text-green-600 mt-0.5">Course interest: {lead.course_interest}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600">
          This will mark the lead as <strong>Admitted</strong> and open the student registration form
          pre-filled with their details. You can complete the registration from there.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={converting} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleConvert} disabled={converting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
            {converting ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
            {converting ? 'Converting…' : 'Convert to Student'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
