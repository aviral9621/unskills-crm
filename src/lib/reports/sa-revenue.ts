import { supabase } from '../supabase'

/**
 * Super-Admin revenue model — single source of truth.
 *
 * RULES (user-confirmed 2026-04-23):
 *   • Head-office branch (uce_branches.is_main = true):
 *       ALL fee payments from this branch = SA income
 *       ALL expenses of this branch       = SA expenses
 *   • All other branches (franchises):
 *       Only CERTIFICATE FEES charged at student registration = SA income.
 *       Captured via uce_branch_wallet_transactions rows where
 *       type = 'debit' AND reference_type = 'student_registration'.
 *       (Wallet credits/recharges are branch PRE-payments; they don't
 *       become revenue until debited at registration.)
 *       Their regular course/tuition fees and expenses DO NOT roll into SA.
 */

export interface DateRange { from?: string; to?: string }

export interface SaIncomeRow {
  date: string              // YYYY-MM-DD
  amount: number
  source: 'ho_fees' | 'franchise_cert'
  branch_id: string | null
  branch_name: string
  course_name?: string | null
  student_id?: string | null
}

export interface SaExpenseRow {
  date: string
  amount: number
  branch_id: string | null
  branch_name: string
  category_name: string
  description: string | null
  id: string
}

export interface SaReportData {
  mainBranch: { id: string; name: string } | null
  income: SaIncomeRow[]
  expenses: SaExpenseRow[]
  allExpenses: SaExpenseRow[]  // includes non-main (informational)
}

export async function fetchMainBranch(): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from('uce_branches')
    .select('id, name')
    .eq('is_main', true)
    .maybeSingle()
  return data ?? null
}

export async function fetchSaReport(range: DateRange): Promise<SaReportData> {
  const mainBranch = await fetchMainBranch()
  const { from, to } = range

  // 1) HO fee payments (if main branch exists)
  let hoFees: SaIncomeRow[] = []
  if (mainBranch) {
    let q = supabase
      .from('uce_student_fee_payments')
      .select('id, amount, payment_date, branch_id, student:uce_students(course:uce_courses(name)), branch:uce_branches(name)')
      .eq('branch_id', mainBranch.id)
    if (from) q = q.gte('payment_date', from)
    if (to) q = q.lte('payment_date', to)
    const { data } = await q
    hoFees = (data ?? []).map((r: Record<string, unknown>) => ({
      date: r.payment_date as string,
      amount: Number(r.amount || 0),
      source: 'ho_fees' as const,
      branch_id: r.branch_id as string,
      branch_name: (r.branch as { name: string } | null)?.name || mainBranch.name,
      course_name: ((r.student as { course: { name: string } | null } | null)?.course?.name) ?? null,
    }))
  }

  // 2) Franchise certificate-fee debits (all non-main branches)
  //    reference_id points to the uce_students row → join to get course.
  let certFees: SaIncomeRow[] = []
  let cq = supabase
    .from('uce_branch_wallet_transactions')
    .select('amount, created_at, branch_id, description, reference_id, branch:uce_branches(name, is_main)')
    .eq('type', 'debit')
    .eq('reference_type', 'student_registration')
  if (from) cq = cq.gte('created_at', from)
  if (to) cq = cq.lte('created_at', to + 'T23:59:59.999Z')
  const { data: certRows } = await cq
  const nonMainCertRows = (certRows ?? []).filter((r: Record<string, unknown>) => !(r.branch as { is_main?: boolean } | null)?.is_main)

  // Resolve course names in one fetch
  const studentIds = [...new Set(nonMainCertRows.map(r => r.reference_id as string).filter(Boolean))]
  const courseByStudent: Record<string, string> = {}
  if (studentIds.length > 0) {
    const { data: sRows } = await supabase
      .from('uce_students')
      .select('id, course:uce_courses(name)')
      .in('id', studentIds)
    ;(sRows ?? []).forEach((s: Record<string, unknown>) => {
      courseByStudent[s.id as string] = ((s.course as { name: string } | null)?.name) || 'Unknown'
    })
  }

  certFees = nonMainCertRows.map((r: Record<string, unknown>) => ({
    date: (r.created_at as string).slice(0, 10),
    amount: Number(r.amount || 0),
    source: 'franchise_cert' as const,
    branch_id: r.branch_id as string,
    branch_name: (r.branch as { name: string } | null)?.name || 'Unknown',
    course_name: courseByStudent[r.reference_id as string] || null,
    student_id: (r.reference_id as string) || null,
  }))

  const income = [...hoFees, ...certFees]

  // 3) Expenses
  let eq = supabase
    .from('uce_expenses')
    .select('id, amount, expense_date, description, branch_id, category:uce_expense_categories(name), branch:uce_branches(name, is_main)')
  if (from) eq = eq.gte('expense_date', from)
  if (to) eq = eq.lte('expense_date', to)
  const { data: expRows } = await eq
  const allExpenses: SaExpenseRow[] = (expRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    date: r.expense_date as string,
    amount: Number(r.amount || 0),
    branch_id: r.branch_id as string | null,
    branch_name: (r.branch as { name: string } | null)?.name || '—',
    category_name: (r.category as { name: string } | null)?.name || 'Uncategorized',
    description: r.description as string | null,
  }))
  const expenses = mainBranch
    ? allExpenses.filter(e => e.branch_id === mainBranch.id)
    : []

  return { mainBranch, income, expenses, allExpenses }
}

export function groupByMonth<T extends { date: string; amount: number }>(rows: T[]): { month: string; label: string; value: number }[] {
  const map: Record<string, number> = {}
  rows.forEach(r => { const m = r.date.slice(0, 7); map[m] = (map[m] || 0) + r.amount })
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
    const [y, m] = k.split('-')
    return {
      month: k,
      label: new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      value: v,
    }
  })
}

export function defaultDateRange(): DateRange {
  const d = new Date()
  d.setMonth(d.getMonth() - 11)
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const to = new Date().toISOString().slice(0, 10)
  return { from, to }
}

export function sumBy<T>(rows: T[], key: (r: T) => number): number {
  return rows.reduce((a, r) => a + key(r), 0)
}
