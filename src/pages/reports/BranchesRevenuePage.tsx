import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatINR } from '../../lib/utils'

interface Row {
  id: string; name: string; code: string; wallet_balance: number
  collected: number; adjusted: number; students: number
}

export default function BranchesRevenuePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    (async () => {
      const { data: branches } = await supabase.from('uce_branches').select('id,name,code,wallet_balance').order('name')
      const result: Row[] = []
      for (const b of branches ?? []) {
        const { data: pays } = await supabase.from('uce_student_fee_payments').select('amount,is_adjustment')
          .eq('branch_id', b.id).gte('payment_date', from).lte('payment_date', to)
        const { count } = await supabase.from('uce_students').select('*', { count: 'exact', head: true }).eq('branch_id', b.id)
        const collected = (pays ?? []).filter(p => !p.is_adjustment).reduce((s, p) => s + Number(p.amount), 0)
        const adjusted = (pays ?? []).filter(p => p.is_adjustment).reduce((s, p) => s + Number(p.amount), 0)
        result.push({ ...b, collected, adjusted, students: count ?? 0 })
      }
      setRows(result)
    })()
  }, [from, to])

  const totalCollected = rows.reduce((s, r) => s + r.collected, 0)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Branch Revenue (View-Only)</h1>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
          This is branch-owned revenue — <b>not part of UCE income</b>. Shown here for awareness only.
        </p>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-semibold">Total branch revenue: {formatINR(totalCollected)}</span>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Branch</th><th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Students</th><th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Collected</th><th className="px-4 py-3">Adjusted</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-3">{r.students}</td>
                <td className="px-4 py-3">{formatINR(r.wallet_balance)}</td>
                <td className="px-4 py-3 text-green-700 font-semibold">{formatINR(r.collected)}</td>
                <td className="px-4 py-3 text-blue-700">{formatINR(r.adjusted)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
