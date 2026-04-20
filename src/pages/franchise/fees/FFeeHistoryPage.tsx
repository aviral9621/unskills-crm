import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import { formatINR, formatDateDDMMYYYY } from '../../../lib/utils'

interface Row {
  id: string; amount: number; payment_date: string; payment_mode: string | null
  receipt_no: string | null; note: string | null; is_adjustment: boolean
  adjustment_reason: string | null
  student: { name: string; registration_no: string } | null
}

export default function FFeeHistoryPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_student_fee_payments')
      .select('id,amount,payment_date,payment_mode,receipt_no,note,is_adjustment,adjustment_reason,student:uce_students(name,registration_no)')
      .eq('branch_id', branchId)
      .gte('payment_date', from).lte('payment_date', to)
      .order('payment_date', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]))
  }, [branchId, from, to])

  const total = rows.filter(r => !r.is_adjustment).reduce((s, r) => s + Number(r.amount), 0)
  const adjTotal = rows.filter(r => r.is_adjustment).reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Fee History</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <div className="flex gap-2 text-sm ml-auto">
          <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700"><b>Collected:</b> {formatINR(total)}</span>
          <span className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700"><b>Adjusted:</b> {formatINR(adjTotal)}</span>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateDDMMYYYY(r.payment_date)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.student?.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{r.student?.registration_no}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={r.is_adjustment ? 'text-blue-700 font-semibold' : 'text-green-700 font-semibold'}>
                    {formatINR(r.amount)}
                    {r.is_adjustment && <span className="ml-1 text-xs">(adj)</span>}
                  </span>
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">{r.payment_mode?.replace('_', ' ')}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.receipt_no}</td>
                <td className="px-4 py-3 text-gray-500">{r.adjustment_reason || r.note}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No payments in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
