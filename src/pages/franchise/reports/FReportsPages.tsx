import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useBranchId } from '../../../lib/franchise'
import { formatINR, formatDateDDMMYYYY } from '../../../lib/utils'

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map(h => {
      const v = r[h]
      if (v == null) return ''
      const s = String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  }
  return lines.join('\n')
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

export function FStudentReportPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Array<{ id: string; name: string; registration_no: string; phone: string; net_fee: number; paid: number; due: number; course: string }>>([])

  useEffect(() => {
    if (!branchId) return
    ;(async () => {
      const { data } = await supabase.from('uce_students').select('id,name,registration_no,phone,net_fee,course:uce_courses(name)').eq('branch_id', branchId)
      const ids = (data ?? []).map(d => d.id)
      let paidMap: Record<string, number> = {}
      if (ids.length) {
        const { data: pays } = await supabase.from('uce_student_fee_payments').select('student_id,amount').in('student_id', ids).eq('is_adjustment', false)
        paidMap = Object.fromEntries(Object.entries(Object.groupBy(pays ?? [], (p: { student_id: string | null }) => p.student_id || '')).map(([k, v]) => [k, (v as Array<{ amount: number }>).reduce((s, p) => s + Number(p.amount), 0)]))
      }
      setRows((data ?? []).map(d => ({
        id: d.id, name: d.name, registration_no: d.registration_no, phone: d.phone,
        net_fee: Number(d.net_fee), paid: paidMap[d.id] || 0,
        due: Math.max(0, Number(d.net_fee) - (paidMap[d.id] || 0)),
        course: (d.course as { name: string } | null)?.name || '',
      })))
    })()
  }, [branchId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Student Report</h1>
        <button onClick={() => download('students.csv', toCSV(rows))} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Download CSV</button>
      </div>
      <Table cols={['Reg No', 'Name', 'Course', 'Phone', 'Fee', 'Paid', 'Due']} rows={rows.map(r => [r.registration_no, r.name, r.course, r.phone, formatINR(r.net_fee), formatINR(r.paid), formatINR(r.due)])} />
    </div>
  )
}

export function FFeesReportPage() {
  const branchId = useBranchId()
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<Array<{ date: string; student: string; reg: string; amount: number; mode: string }>>([])

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_student_fee_payments')
      .select('payment_date,amount,payment_mode,student:uce_students(name,registration_no)')
      .eq('branch_id', branchId).eq('is_adjustment', false)
      .gte('payment_date', from).lte('payment_date', to).order('payment_date', { ascending: false })
      .then(({ data }) => setRows((data ?? []).map((p: Record<string, unknown>) => ({
        date: p.payment_date as string, amount: Number(p.amount),
        mode: (p.payment_mode as string) || '',
        student: ((p.student as { name: string } | null)?.name) || '',
        reg: ((p.student as { registration_no: string } | null)?.registration_no) || '',
      }))))
  }, [branchId, from, to])

  const total = rows.reduce((s, r) => s + r.amount, 0)
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Fee Collection Report</h1>
      <div className="flex flex-wrap gap-3 items-center">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-semibold">Total: {formatINR(total)}</span>
        <button onClick={() => download('fees.csv', toCSV(rows))} className="ml-auto px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Download CSV</button>
      </div>
      <Table cols={['Date', 'Reg No', 'Student', 'Amount', 'Mode']} rows={rows.map(r => [formatDateDDMMYYYY(r.date), r.reg, r.student, formatINR(r.amount), r.mode])} />
    </div>
  )
}

export function FPendingFeesPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Array<{ reg: string; name: string; phone: string; course: string; fee: number; paid: number; due: number }>>([])

  useEffect(() => {
    if (!branchId) return
    ;(async () => {
      const { data } = await supabase.from('uce_students').select('id,name,registration_no,phone,net_fee,course:uce_courses(name)').eq('branch_id', branchId).eq('is_active', true)
      const ids = (data ?? []).map(d => d.id)
      let paidMap: Record<string, number> = {}
      if (ids.length) {
        const { data: pays } = await supabase.from('uce_student_fee_payments').select('student_id,amount').in('student_id', ids).eq('is_adjustment', false)
        paidMap = Object.fromEntries(Object.entries(Object.groupBy(pays ?? [], (p: { student_id: string | null }) => p.student_id || '')).map(([k, v]) => [k, (v as Array<{ amount: number }>).reduce((s, p) => s + Number(p.amount), 0)]))
      }
      const out = (data ?? []).map(d => ({
        reg: d.registration_no, name: d.name, phone: d.phone,
        course: (d.course as { name: string } | null)?.name || '',
        fee: Number(d.net_fee), paid: paidMap[d.id] || 0,
        due: Math.max(0, Number(d.net_fee) - (paidMap[d.id] || 0)),
      })).filter(r => r.due > 0).sort((a, b) => b.due - a.due)
      setRows(out)
    })()
  }, [branchId])

  const totalDue = rows.reduce((s, r) => s + r.due, 0)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Pending Fees</h1>
        <div className="flex gap-2">
          <span className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">Total Due: {formatINR(totalDue)}</span>
          <button onClick={() => download('pending-fees.csv', toCSV(rows))} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Download CSV</button>
        </div>
      </div>
      <Table cols={['Reg No', 'Student', 'Phone', 'Course', 'Fee', 'Paid', 'Due']} rows={rows.map(r => [r.reg, r.name, r.phone, r.course, formatINR(r.fee), formatINR(r.paid), formatINR(r.due)])} />
    </div>
  )
}

export function FWalletReportPage() {
  const branchId = useBranchId()
  const [rows, setRows] = useState<Array<{ date: string; type: string; amount: number; balance: number; desc: string }>>([])

  useEffect(() => {
    if (!branchId) return
    supabase.from('uce_branch_wallet_transactions').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setRows((data ?? []).map(t => ({
        date: t.created_at, type: t.type, amount: Number(t.amount),
        balance: Number(t.balance_after), desc: t.description,
      }))))
  }, [branchId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Wallet Statement</h1>
        <button onClick={() => download('wallet.csv', toCSV(rows))} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Download CSV</button>
      </div>
      <Table cols={['Date', 'Type', 'Amount', 'Balance After', 'Description']}
        rows={rows.map(r => [formatDateDDMMYYYY(r.date), r.type, formatINR(r.amount), formatINR(r.balance), r.desc])} />
    </div>
  )
}

function Table({ cols, rows }: { cols: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="rounded-xl border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
          <tr>{cols.map(c => <th key={c} className="px-4 py-3">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j} className="px-4 py-3">{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
