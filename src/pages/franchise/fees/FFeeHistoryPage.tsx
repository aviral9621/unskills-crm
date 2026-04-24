import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import { formatINR, formatDateDDMMYYYY } from '../../../lib/utils'
import { downloadFeeReceipt } from '../../../lib/pdf/fee-receipt'

interface Row {
  id: string; amount: number; payment_date: string; payment_mode: string | null
  receipt_no: string | null; note: string | null; is_adjustment: boolean
  adjustment_reason: string | null
  schedule_id: string | null
  student: { id: string; name: string; registration_no: string; father_name: string; course_id: string } | null
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default function FFeeHistoryPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Row[]>([])
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_student_fee_payments')
      .select('id,amount,payment_date,payment_mode,receipt_no,note,is_adjustment,adjustment_reason,schedule_id,student:uce_students(id,name,registration_no,father_name,course_id)')
      .eq('branch_id', branchId)
      .gte('payment_date', from).lte('payment_date', to)
      .order('payment_date', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]))
  }, [branchId, from, to])

  const total = rows.filter(r => !r.is_adjustment).reduce((s, r) => s + Number(r.amount), 0)
  const adjTotal = rows.filter(r => r.is_adjustment).reduce((s, r) => s + Number(r.amount), 0)

  async function downloadReceipt(r: Row) {
    if (!r.student || r.is_adjustment) return
    setDownloading(r.id)
    try {
      const [brRes, courseRes, schedRes] = await Promise.all([
        supabase.from('uce_branches')
          .select('name,code,director_phone,society_name,registration_number,center_logo_url,address_line1,village,district,state,pincode')
          .eq('id', branchId).maybeSingle(),
        supabase.from('uce_courses').select('name').eq('id', r.student.course_id).maybeSingle(),
        r.schedule_id
          ? supabase.from('uce_student_fee_schedule').select('month_for').eq('id', r.schedule_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      const br = brRes.data
      await downloadFeeReceipt({
        receiptNo: r.receipt_no || r.id.slice(0, 8).toUpperCase(),
        date: r.payment_date,
        amount: Number(r.amount),
        mode: r.payment_mode || 'N/A',
        note: r.note || '',
        monthsPaid: schedRes.data ? [monthLabel((schedRes.data as { month_for: string }).month_for)] : undefined,
        student: {
          name: r.student.name, registration_no: r.student.registration_no,
          father_name: r.student.father_name || '', course: courseRes.data?.name || '',
        },
        branch: {
          name: br?.name || '', code: br?.code || '', phone: br?.director_phone || '',
          address: [br?.address_line1, br?.village, br?.district, br?.state, br?.pincode].filter(Boolean).join(', '),
          society_name: br?.society_name || null,
          registration_number: br?.registration_number || null,
          logo_url: br?.center_logo_url || null,
        },
      })
    } catch (e) { toast.error((e as Error).message) }
    finally { setDownloading(null) }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Fee History</h1>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm w-full sm:w-auto" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm w-full sm:w-auto" />
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm sm:ml-auto">
          <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700 flex-1 sm:flex-none"><b>Collected:</b> {formatINR(total)}</span>
          <span className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 flex-1 sm:flex-none"><b>Adjusted:</b> {formatINR(adjTotal)}</span>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">No payments in this range</div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className={r.is_adjustment ? 'text-blue-700 font-semibold' : 'text-green-700 font-semibold'}>
                {formatINR(r.amount)}{r.is_adjustment && <span className="ml-1 text-xs">(adj)</span>}
              </span>
              <span className="text-xs text-gray-400">{formatDateDDMMYYYY(r.payment_date)}</span>
            </div>
            <p className="text-sm mt-1 break-words"><b>{r.student?.name}</b> <span className="text-xs font-mono text-gray-400">{r.student?.registration_no}</span></p>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{r.payment_mode?.replace('_', ' ')}{r.receipt_no && ` · ${r.receipt_no}`}</p>
            {(r.adjustment_reason || r.note) && <p className="text-xs text-gray-500 mt-1 break-words">{r.adjustment_reason || r.note}</p>}
            {!r.is_adjustment && (
              <button onClick={() => downloadReceipt(r)} disabled={downloading === r.id}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
                <Download size={12} /> {downloading === r.id ? 'Preparing…' : 'Receipt'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3"></th>
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
                <td className="px-4 py-3">
                  {!r.is_adjustment && (
                    <button onClick={() => downloadReceipt(r)} disabled={downloading === r.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">
                      <Download size={12} /> {downloading === r.id ? '…' : 'Receipt'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No payments in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
