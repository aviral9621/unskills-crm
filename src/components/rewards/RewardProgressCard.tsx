import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight, Coins, TrendingUp } from 'lucide-react'
import {
  fetchMonthlyReward,
  fetchPointBalance,
  fetchRewardTiers,
  getIstYearMonth,
  MONTH_NAMES,
  nextTier,
  DEFAULT_TIERS,
  type MonthlyReward,
  type PointBalance,
  type RewardTier,
  type TierConfig,
} from '../../lib/rewards'
import TierBadge, { TIER_LABEL, TIER_COLOR_BG } from './TierBadge'
import GiftCard from './GiftCard'

interface Props {
  branchId: string
}

export default function RewardProgressCard({ branchId }: Props) {
  const [reward, setReward] = useState<MonthlyReward | null>(null)
  const [balance, setBalance] = useState<PointBalance | null>(null)
  const [tiers, setTiers] = useState<TierConfig[]>(DEFAULT_TIERS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { year, month } = getIstYearMonth()
      try {
        const [r, b, ts] = await Promise.all([
          fetchMonthlyReward(branchId, year, month),
          fetchPointBalance(branchId),
          fetchRewardTiers(),
        ])
        if (cancelled) return
        setReward(r)
        setBalance(b)
        setTiers(ts)
      } catch { /* table may not exist yet */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [branchId])

  const count = reward?.admission_count ?? 0
  const level: RewardTier | null = (reward?.level as RewardTier | null) ?? null
  const next = nextTier(level, tiers)
  const remaining = next ? Math.max(0, next.threshold - count) : 0

  const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold)
  const topThreshold = sortedTiers[sortedTiers.length - 1]?.threshold ?? 30
  const goalThreshold = next?.threshold ?? topThreshold
  const currentTierConfig = level ? tiers.find(t => t.tier === level) : null
  const fromThreshold = currentTierConfig?.threshold ?? 0
  const span = goalThreshold - fromThreshold || 1
  const within = Math.max(0, count - fromThreshold)
  const pct = next ? Math.min(100, Math.round((within / span) * 100)) : 100

  const { year, month } = getIstYearMonth()

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-pink-50 p-4 sm:p-6">
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-200/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-pink-200/30 blur-3xl pointer-events-none" />

      <div className="relative flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <h3 className="font-heading text-sm sm:text-base font-bold text-purple-900">
            {MONTH_NAMES[month - 1]} {year} — Reward Progress
          </h3>
        </div>
        <Link
          to="/franchise/points"
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900"
        >
          View wallet <ArrowRight size={12} />
        </Link>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Tier + count */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 sm:gap-4 mb-3">
            {level ? (
              <TierBadge tier={level} size="lg" />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-purple-300 flex items-center justify-center text-purple-300">
                <TrendingUp size={26} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">This month</p>
              <p className="font-heading text-2xl sm:text-3xl font-bold text-gray-900 leading-none">
                {count} <span className="text-sm font-medium text-gray-500">admission{count === 1 ? '' : 's'}</span>
              </p>
              <p className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${level ? TIER_COLOR_BG[level] : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {level ? `${TIER_LABEL[level]} achieved` : 'No tier yet'}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {next ? (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-600">
                  <b className="text-purple-700">{remaining}</b> more to reach <b>{TIER_LABEL[next.tier]}</b>
                </span>
                <span className="text-gray-500 font-medium">{count} / {next.threshold}</span>
              </div>
              <div className="h-3 rounded-full bg-purple-100 overflow-hidden ring-1 ring-purple-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
                <span>0</span>
                {sortedTiers.map(t => (
                  <span key={t.tier}>{t.threshold} {TIER_LABEL[t.tier]}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-purple-100/60 border border-purple-200 px-3 py-2.5 text-xs text-purple-800 font-medium text-center">
              🏆 You've reached the top tier this month — Platinum Champion!
            </div>
          )}
        </div>

        {/* Side: balance + gift */}
        <div className="space-y-3">
          <div className="rounded-xl bg-white border border-purple-200 p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Coins size={16} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">Point balance</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">{balance?.balance ?? 0}</span>
              <span className="text-xs text-gray-500">point{(balance?.balance ?? 0) === 1 ? '' : 's'}</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Earned {balance?.total_earned ?? 0} · Used {balance?.total_used ?? 0}
            </p>
          </div>
          <GiftCard gift={reward?.gift ?? null} size="sm" />
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/40 pointer-events-none" />
      )}
    </div>
  )
}
