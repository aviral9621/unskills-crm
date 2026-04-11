import { CreditCard } from 'lucide-react'

export default function StudentIdCardPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <CreditCard size={48} strokeWidth={1.5} className="mx-auto text-[#D1D5DB]" />
        <h2 className="mt-4 font-heading text-xl font-semibold text-text-heading">Student ID Card</h2>
        <p className="mt-1 text-sm text-text-muted">This module is under development</p>
      </div>
    </div>
  )
}
