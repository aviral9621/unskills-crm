import { supabase } from './supabase'

export type RewardTier = 'silver' | 'gold' | 'platinum'

export interface TierConfig {
  tier: RewardTier
  threshold: number
  totalPoints: number
  gift: string | null
  label: string
}

export const TIERS: TierConfig[] = [
  { tier: 'silver',   threshold: 10, totalPoints: 1, gift: null,                                   label: 'Silver Achiever' },
  { tier: 'gold',     threshold: 20, totalPoints: 3, gift: 'Ring Light',                           label: 'Gold Performer' },
  { tier: 'platinum', threshold: 30, totalPoints: 5, gift: 'Printer / Smartwatch / Speaker',       label: 'Platinum Champion' },
]

export function tierFromCount(count: number): RewardTier | null {
  if (count >= 30) return 'platinum'
  if (count >= 20) return 'gold'
  if (count >= 10) return 'silver'
  return null
}

export function nextTier(current: RewardTier | null): TierConfig | null {
  if (current === null) return TIERS[0]
  if (current === 'silver') return TIERS[1]
  if (current === 'gold') return TIERS[2]
  return null
}

export interface PointBalance {
  branch_id: string
  total_earned: number
  total_used: number
  balance: number
}

export interface MonthlyReward {
  id: string
  branch_id: string
  year: number
  month: number
  admission_count: number
  level: RewardTier | null
  points_credited: number
  gift: string | null
  created_at: string
  updated_at: string
}

export interface PointTransaction {
  id: string
  branch_id: string
  points: number
  kind: 'reward_credit' | 'certificate_used' | 'admin_adjustment'
  description: string
  student_id: string | null
  reward_id: string | null
  performed_by: string | null
  created_at: string
}

/** IST year+month for "this month" lookups. */
export function getIstYearMonth(d: Date = new Date()): { year: number; month: number } {
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return { year: ist.getFullYear(), month: ist.getMonth() + 1 }
}

export async function fetchPointBalance(branchId: string): Promise<PointBalance> {
  const { data, error } = await supabase
    .from('uce_branch_point_balances')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle()
  if (error) throw error
  return (data as PointBalance | null) ?? { branch_id: branchId, total_earned: 0, total_used: 0, balance: 0 }
}

export async function fetchMonthlyReward(
  branchId: string,
  year: number,
  month: number,
): Promise<MonthlyReward | null> {
  const { data, error } = await supabase
    .from('uce_branch_monthly_rewards')
    .select('*')
    .eq('branch_id', branchId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  return (data as MonthlyReward | null) ?? null
}

export async function fetchPointTransactions(branchId: string, limit = 200): Promise<PointTransaction[]> {
  const { data, error } = await supabase
    .from('uce_branch_point_transactions')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as PointTransaction[]
}

export async function fetchMonthlyRewardsForPeriod(year: number, month: number) {
  const { data, error } = await supabase
    .from('uce_branch_monthly_rewards')
    .select('*, branch:uce_branches(id, name, code, b_code)')
    .eq('year', year)
    .eq('month', month)
    .order('admission_count', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function consumePoint(branchId: string, studentId: string, description?: string): Promise<{ balance: number }> {
  const { data, error } = await supabase.rpc('consume_franchise_point', {
    p_branch_id: branchId,
    p_student_id: studentId,
    p_description: description ?? 'Certificate fee paid with 1 point',
  })
  if (error) throw error
  return data as { balance: number }
}

export async function adminAdjustPoints(branchId: string, points: number, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_adjust_franchise_points', {
    p_branch_id: branchId,
    p_points: points,
    p_note: note,
  })
  if (error) throw error
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
