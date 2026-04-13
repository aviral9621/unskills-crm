import { useEffect, useState, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import {
  Receipt, Plus, Search, X, Loader2, FileDown, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'
import FormField, { selectClass } from '../../components/FormField'
import type { Employee } from '../../types'

interface SlipRow {
  id: string; employee_id: string; month: string; year: string
  gross_salary: number | null; total_deductions: number | null; advance_deduction: number | null
  net_payable: number | null; payment_date: string | null; payment_mode: string | null
  created_at: string
  employee?: { name: string; employee_code: string | null; designation: string | null; department_id: string | null; branch_id: string | null } | null
}

interface EmpFull extends Employee {
  department?: { name: string } | null
  branch?: { name: string } | null
}

const MONTHS_MAP: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April', '05': 'May', '06': 'June',
  '07': 'July', '08': 'August', '09': 'September', '10': 'October', '11': 'November', '12': 'December',
}
const MONTH_OPTS = Object.entries(MONTHS_MAP)
const YEARS = Array.from({ length: 10 }, (_, i) => String(2024 + i))
const PAY_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque']

const colHelper = createColumnHelper<SlipRow>()

export default function SalarySlipPage() {
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [slips, setSlips] = useState<SlipRow[]>([])
  const [employees, setEmployees] = useState<EmpFull[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Generate modal
  const [genOpen, setGenOpen] = useState(false)
  const [genEmpId, setGenEmpId] = useState('')
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()))
  const [genPayDate, setGenPayDate] = useState(new Date().toISOString().split('T')[0])
  const [genPayMode, setGenPayMode] = useState('Cash')
  const [generating, setGenerating] = useState(false)

  // View modal
  const [viewSlip, setViewSlip] = useState<SlipRow | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      let sq = supabase.from('uce_salary_slips').select('*, employee:uce_employees(name, employee_code, designation, department_id, branch_id)')
      let eq = supabase.from('uce_employees').select('*, department:uce_departments(name), branch:uce_branches(name)').eq('is_active', true)

      if (!isSuperAdmin && branchId) {
        const { data: empIds } = await supabase.from('uce_employees').select('id').eq('branch_id', branchId)
        const ids = (empIds ?? []).map(e => e.id)
        if (ids.length > 0) { sq = sq.in('employee_id', ids) } else { setSlips([]); setEmployees([]); setLoading(false); return }
        eq = eq.eq('branch_id', branchId)
      }

      const [sRes, eRes] = await Promise.all([
        sq.order('created_at', { ascending: false }),
        eq.order('name'),
      ])
      if (sRes.error) throw sRes.error
      setSlips((sRes.data ?? []) as unknown as SlipRow[])
      setEmployees((eRes.data ?? []) as unknown as EmpFull[])
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  const selectedEmp = useMemo(() => employees.find(e => e.id === genEmpId), [employees, genEmpId])

  const genGross = selectedEmp ? (selectedEmp.base_salary + selectedEmp.da + selectedEmp.hra + selectedEmp.ta + selectedEmp.other_allowance) : 0
  const genDeductions = selectedEmp ? (selectedEmp.pf + selectedEmp.esi + selectedEmp.other_deduction) : 0

  // Calculate total advances for selected month
  const [advanceTotal, setAdvanceTotal] = useState(0)
  useEffect(() => {
    if (!genEmpId) { setAdvanceTotal(0); return }
    supabase.from('uce_salary_advances').select('amount').eq('employee_id', genEmpId)
      .gte('advance_date', `${genYear}-${genMonth}-01`)
      .lte('advance_date', `${genYear}-${genMonth}-31`)
      .then(({ data }) => {
        setAdvanceTotal((data ?? []).reduce((s, a) => s + a.amount, 0))
      })
  }, [genEmpId, genMonth, genYear])

  const genNetPayable = genGross - genDeductions - advanceTotal

  async function handleGenerate() {
    if (!genEmpId) { toast.error('Select an employee'); return }

    // Check duplicate
    const dup = slips.find(s => s.employee_id === genEmpId && s.month === `${genYear}-${genMonth}` && s.year === genYear)
    if (dup) { toast.error('Salary slip already exists for this month'); return }

    setGenerating(true)
    try {
      const { error } = await supabase.from('uce_salary_slips').insert({
        employee_id: genEmpId,
        month: `${genYear}-${genMonth}`,
        year: genYear,
        gross_salary: genGross,
        total_deductions: genDeductions,
        advance_deduction: advanceTotal,
        net_payable: genNetPayable,
        payment_date: genPayDate,
        payment_mode: genPayMode,
        generated_by: user?.id || null,
      }).select().single()
      if (error) throw error

      // Auto-create expense record
      const empBranchId = selectedEmp?.branch_id || branchId
      if (empBranchId) {
        // Find or use "Staff Salary" category
        const { data: cats } = await supabase.from('uce_expense_categories').select('id').ilike('name', '%salary%').limit(1)
        const catId = cats?.[0]?.id || null

        await supabase.from('uce_expenses').insert({
          branch_id: empBranchId,
          category_id: catId,
          amount: genNetPayable,
          expense_date: genPayDate,
          description: `Salary for ${selectedEmp?.name} — ${MONTHS_MAP[genMonth]} ${genYear}`,
          is_salary: true,
          employee_id: genEmpId,
          recorded_by: user?.id || null,
        })
      }

      toast.success('Salary slip generated & expense recorded')
      setGenOpen(false)
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
    finally { setGenerating(false) }
  }

  async function downloadPDF(slip: SlipRow) {
    const emp = employees.find(e => e.id === slip.employee_id) || null
    const dept = emp?.department as { name: string } | null
    const branch = emp?.branch as { name: string } | null
    const monthLabel = MONTHS_MAP[slip.month.split('-')[1]] || slip.month

    const doc = (
      <Document>
        <Page size="A4" style={pdfStyles.page}>
          <View style={pdfStyles.header}>
            <Text style={pdfStyles.title}>SALARY SLIP</Text>
            <Text style={pdfStyles.subtitle}>{monthLabel} {slip.year}</Text>
          </View>

          <View style={pdfStyles.infoRow}>
            <View style={pdfStyles.infoCol}>
              <Text style={pdfStyles.label}>Employee Name</Text>
              <Text style={pdfStyles.value}>{emp?.name || '—'}</Text>
            </View>
            <View style={pdfStyles.infoCol}>
              <Text style={pdfStyles.label}>Employee Code</Text>
              <Text style={pdfStyles.value}>{emp?.employee_code || '—'}</Text>
            </View>
          </View>
          <View style={pdfStyles.infoRow}>
            <View style={pdfStyles.infoCol}>
              <Text style={pdfStyles.label}>Department</Text>
              <Text style={pdfStyles.value}>{dept?.name || '—'}</Text>
            </View>
            <View style={pdfStyles.infoCol}>
              <Text style={pdfStyles.label}>Designation</Text>
              <Text style={pdfStyles.value}>{emp?.designation || '—'}</Text>
            </View>
          </View>
          <View style={pdfStyles.infoRow}>
            <View style={pdfStyles.infoCol}>
              <Text style={pdfStyles.label}>Branch</Text>
              <Text style={pdfStyles.value}>{branch?.name || '—'}</Text>
            </View>
            <View style={pdfStyles.infoCol}>
              <Text style={pdfStyles.label}>Payment Date</Text>
              <Text style={pdfStyles.value}>{slip.payment_date || '—'}</Text>
            </View>
          </View>

          <View style={pdfStyles.divider} />

          <View style={pdfStyles.twoCol}>
            {/* Earnings */}
            <View style={pdfStyles.colBox}>
              <Text style={pdfStyles.colTitle}>EARNINGS</Text>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>Base Salary</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.base_salary || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>DA</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.da || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>HRA</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.hra || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>TA</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.ta || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>Other Allowances</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.other_allowance || 0)}</Text></View>
              <View style={[pdfStyles.row, pdfStyles.totalRow]}><Text style={pdfStyles.totalLabel}>Gross Salary</Text><Text style={pdfStyles.totalVal}>{fmtINR(slip.gross_salary || 0)}</Text></View>
            </View>
            {/* Deductions */}
            <View style={pdfStyles.colBox}>
              <Text style={[pdfStyles.colTitle, { color: '#DC2626' }]}>DEDUCTIONS</Text>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>PF</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.pf || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>ESI</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.esi || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>Other Deductions</Text><Text style={pdfStyles.rowVal}>{fmtINR(emp?.other_deduction || 0)}</Text></View>
              <View style={pdfStyles.row}><Text style={pdfStyles.rowLabel}>Advance</Text><Text style={pdfStyles.rowVal}>{fmtINR(slip.advance_deduction || 0)}</Text></View>
              <View style={[pdfStyles.row, pdfStyles.totalRow]}><Text style={pdfStyles.totalLabel}>Total Deductions</Text><Text style={[pdfStyles.totalVal, { color: '#DC2626' }]}>{fmtINR((slip.total_deductions || 0) + (slip.advance_deduction || 0))}</Text></View>
            </View>
          </View>

          <View style={pdfStyles.netBox}>
            <Text style={pdfStyles.netLabel}>NET PAYABLE</Text>
            <Text style={pdfStyles.netVal}>{fmtINR(slip.net_payable || 0)}</Text>
          </View>

          <Text style={pdfStyles.footer}>This is a computer-generated salary slip and does not require a signature.</Text>
        </Page>
      </Document>
    )

    const blob = await pdf(doc).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SalarySlip_${emp?.name || 'Employee'}_${monthLabel}_${slip.year}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return slips
    const q = search.toLowerCase()
    return slips.filter(s => {
      const emp = s.employee as { name: string; employee_code: string | null } | null
      return emp?.name.toLowerCase().includes(q) || (emp?.employee_code || '').toLowerCase().includes(q)
    })
  }, [slips, search])

  const columns = useMemo(() => [
    colHelper.display({ id: 'employee', header: 'Employee', cell: i => {
      const emp = i.row.original.employee as { name: string; employee_code: string | null } | null
      return (
        <div>
          <p className="text-sm font-medium text-gray-900">{emp?.name || '—'}</p>
          {emp?.employee_code && <p className="text-xs font-mono text-gray-400">{emp.employee_code}</p>}
        </div>
      )
    }}),
    colHelper.accessor('month', { header: 'Month', cell: i => {
      const parts = i.getValue().split('-')
      return <span className="text-sm text-gray-600">{MONTHS_MAP[parts[1]] || parts[1]} {parts[0]}</span>
    }}),
    colHelper.accessor('gross_salary', { header: 'Gross', cell: i => <span className="text-sm text-green-600 font-medium">{formatINR(i.getValue() || 0)}</span> }),
    colHelper.accessor('total_deductions', { header: 'Deductions', cell: i => <span className="text-sm text-red-600">{formatINR((i.getValue() || 0) + (i.row.original.advance_deduction || 0))}</span> }),
    colHelper.accessor('advance_deduction', { header: 'Advance', cell: i => <span className="text-sm text-amber-600">{formatINR(i.getValue() || 0)}</span> }),
    colHelper.accessor('net_payable', { header: 'Net Payable', cell: i => <span className="text-sm font-bold text-blue-700">{formatINR(i.getValue() || 0)}</span> }),
    colHelper.display({ id: 'actions', header: '', enableSorting: false, cell: i => (
      <div className="flex items-center gap-1">
        <button onClick={() => setViewSlip(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="View"><Eye size={15} /></button>
        <button onClick={() => downloadPDF(i.row.original)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Download PDF"><FileDown size={15} /></button>
      </div>
    )}),
  ], [employees])

  function SlipCard({ s }: { s: SlipRow }) {
    const emp = s.employee as { name: string; employee_code: string | null } | null
    const parts = s.month.split('-')
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{emp?.name || '—'}</p>
            <p className="text-xs text-gray-400">{MONTHS_MAP[parts[1]] || parts[1]} {parts[0]}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setViewSlip(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Eye size={15} /></button>
            <button onClick={() => downloadPDF(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><FileDown size={15} /></button>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-[10px] text-gray-400">Gross</p><p className="text-xs font-semibold text-green-600">{formatINR(s.gross_salary || 0)}</p></div>
          <div><p className="text-[10px] text-gray-400">Deductions</p><p className="text-xs font-semibold text-red-600">{formatINR((s.total_deductions || 0) + (s.advance_deduction || 0))}</p></div>
          <div><p className="text-[10px] text-gray-400">Net</p><p className="text-xs font-bold text-blue-700">{formatINR(s.net_payable || 0)}</p></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Salary Slips</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{slips.length} records</p>
        </div>
        <button onClick={() => { setGenEmpId(''); setGenOpen(true) }} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <Plus size={16} /> Generate Slip
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by employee..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
          : filtered.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center"><Receipt size={36} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-400">No salary slips</p></div>
          : <div className="space-y-3">{filtered.map(s => <SlipCard key={s.id} s={s} />)}</div>}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5">
        <DataTable data={filtered} columns={columns} loading={loading} searchValue="" emptyIcon={<Receipt size={36} className="text-gray-300" />} emptyMessage="No salary slips" />
      </div>

      {/* Generate Modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Salary Slip" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Employee" required>
              <select value={genEmpId} onChange={e => setGenEmpId(e.target.value)} className={selectClass}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.employee_code ? `(${e.employee_code})` : ''}</option>)}
              </select>
            </FormField>
            <FormField label="Month" required>
              <select value={genMonth} onChange={e => setGenMonth(e.target.value)} className={selectClass}>
                {MONTH_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="Year" required>
              <select value={genYear} onChange={e => setGenYear(e.target.value)} className={selectClass}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </FormField>
          </div>

          {selectedEmp && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
                {/* Earnings */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-green-700 mb-3">Earnings</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Base Salary</span><span className="font-medium">{formatINR(selectedEmp.base_salary)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">DA</span><span className="font-medium">{formatINR(selectedEmp.da)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">HRA</span><span className="font-medium">{formatINR(selectedEmp.hra)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">TA</span><span className="font-medium">{formatINR(selectedEmp.ta)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Other</span><span className="font-medium">{formatINR(selectedEmp.other_allowance)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-green-200"><span className="font-semibold text-green-700">Gross</span><span className="font-bold text-green-700">{formatINR(genGross)}</span></div>
                  </div>
                </div>
                {/* Deductions */}
                <div className="bg-red-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-red-700 mb-3">Deductions</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">PF</span><span className="font-medium">{formatINR(selectedEmp.pf)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">ESI</span><span className="font-medium">{formatINR(selectedEmp.esi)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Other</span><span className="font-medium">{formatINR(selectedEmp.other_deduction)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Advance</span><span className="font-medium text-amber-600">{formatINR(advanceTotal)}</span></div>
                    <div className="flex justify-between pt-2 border-t border-red-200"><span className="font-semibold text-red-700">Total Deductions</span><span className="font-bold text-red-700">{formatINR(genDeductions + advanceTotal)}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-sm text-blue-600 font-medium">Net Payable</p>
                <p className="text-2xl font-bold text-blue-700">{formatINR(genNetPayable)}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Payment Date">
                  <input type="date" value={genPayDate} onChange={e => setGenPayDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
                </FormField>
                <FormField label="Payment Mode">
                  <select value={genPayMode} onChange={e => setGenPayMode(e.target.value)} className={selectClass}>
                    {PAY_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={() => setGenOpen(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button onClick={handleGenerate} disabled={generating || !genEmpId} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {generating && <Loader2 size={16} className="animate-spin" />} Generate & Save
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewSlip} onClose={() => setViewSlip(null)} title="Salary Slip Details" size="md">
        {viewSlip && (() => {
          const emp = employees.find(e => e.id === viewSlip.employee_id)
          const dept = emp?.department as { name: string } | null
          const parts = viewSlip.month.split('-')
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-400">Employee</p><p className="font-medium">{emp?.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Code</p><p className="font-mono">{emp?.employee_code || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Department</p><p>{dept?.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Month</p><p>{MONTHS_MAP[parts[1]] || parts[1]} {parts[0]}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-green-600">Gross</p><p className="text-lg font-bold text-green-700">{formatINR(viewSlip.gross_salary || 0)}</p></div>
                <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-red-600">Deductions</p><p className="text-lg font-bold text-red-700">{formatINR((viewSlip.total_deductions || 0) + (viewSlip.advance_deduction || 0))}</p></div>
                <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-600">Net Payable</p><p className="text-lg font-bold text-blue-700">{formatINR(viewSlip.net_payable || 0)}</p></div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => downloadPDF(viewSlip)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                  <FileDown size={16} /> Download PDF
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

// ── PDF Helpers ──
function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { textAlign: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoCol: { flex: 1 },
  label: { fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 11, color: '#1F2937' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 16 },
  twoCol: { flexDirection: 'row', gap: 16 },
  colBox: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 },
  colTitle: { fontSize: 10, fontWeight: 'bold', color: '#059669', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rowLabel: { fontSize: 10, color: '#4B5563' },
  rowVal: { fontSize: 10, color: '#1F2937', fontWeight: 'bold' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 6, marginTop: 4 },
  totalLabel: { fontSize: 10, fontWeight: 'bold', color: '#1F2937' },
  totalVal: { fontSize: 11, fontWeight: 'bold', color: '#059669' },
  netBox: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 16, marginTop: 20, textAlign: 'center' },
  netLabel: { fontSize: 10, color: '#2563EB', fontWeight: 'bold' },
  netVal: { fontSize: 22, fontWeight: 'bold', color: '#1D4ED8', marginTop: 4 },
  footer: { marginTop: 30, fontSize: 8, color: '#9CA3AF', textAlign: 'center' },
})
