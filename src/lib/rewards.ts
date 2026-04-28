import { supabase } from './supabase'

export type RewardTier = 'silver' | 'gold' | 'platinum'

export interface TierConfig {
  tier: RewardTier
  threshold: number
  totalPoints: number
  gift: string | null
  label: string
}

// Fallback used only if the settings table is unreachable on first paint.
// The DB is the source of truth — these values match the seeded defaults.
export const DEFAULT_TIERS: TierConfig[] = [
  { tier: 'silver',   threshold: 10, totalPoints: 1, gift: null,                                label: 'Silver Achiever' },
  { tier: 'gold',     threshold: 20, totalPoints: 3, gift: 'Ring Light',                        label: 'Gold Performer' },
  { tier: 'platinum', threshold: 30, totalPoints: 5, gift: 'Printer / Smartwatch / Speaker',    label: 'Platinum Champion' },
]

// Module-level cache so multiple components don't re-hit the table on every mount.
// Cleared by mutators (saveRewardTiers) and after a soft TTL.
let cachedTiers: TierConfig[] | null = null
let cachedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000

interface TierRow {
  tier: RewardTier
  threshold: number
  total_points: number
  gift: string | null
  label: string
  display_order: number
}

export async function fetchRewardTiers(force = false): Promise<TierConfig[]> {
  if (!force && cachedTiers && Date.now() - cachedAt < CACHE_TTL_MS) return cachedTiers
  const { data, error } = await supabase
    .from('uce_franchise_reward_tiers')
    .select('tier, threshold, total_points, gift, label, display_order')
    .order('display_order', { ascending: true })
  if (error || !data || data.length === 0) {
    // Fall back to defaults; don't cache the failure so a later request can retry.
    return DEFAULT_TIERS
  }
  cachedTiers = (data as TierRow[]).map(r => ({
    tier: r.tier,
    threshold: r.threshold,
    totalPoints: r.total_points,
    gift: r.gift,
    label: r.label,
  }))
  cachedAt = Date.now()
  return cachedTiers
}

export function clearRewardTiersCache() {
  cachedTiers = null
  cachedAt = 0
}

export async function saveRewardTiers(tiers: TierConfig[]): Promise<void> {
  const rows = tiers.map((t, i) => ({
    tier: t.tier,
    threshold: t.threshold,
    total_points: t.totalPoints,
    gift: t.gift,
    label: t.label,
    display_order: i + 1,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('uce_franchise_reward_tiers').upsert(rows, { onConflict: 'tier' })
  if (error) throw error
  clearRewardTiersCache()
}

export function tierFromCount(count: number, tiers: TierConfig[] = DEFAULT_TIERS): RewardTier | null {
  // Walk highest threshold first
  const sorted = [...tiers].sort((a, b) => b.threshold - a.threshold)
  for (const t of sorted) if (count >= t.threshold) return t.tier
  return null
}

export function nextTier(current: RewardTier | null, tiers: TierConfig[] = DEFAULT_TIERS): TierConfig | null {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
  if (current === null) return sorted[0] ?? null
  const idx = sorted.findIndex(t => t.tier === current)
  if (idx === -1) return null
  return sorted[idx + 1] ?? null
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
