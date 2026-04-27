import { useEffect, useState } from 'react'
import { Coins, ArrowDownRight, ArrowUpRight, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react'
import { useBranch, useBranchId } from '../../../lib/franchise'
import { formatDateDDMMYYYY } from '../../../lib/utils'
import {
  fetchMonthlyReward,
  fetchPointBalance,
  fetchPointTransactions,
  getIstYearMonth,
  MONTH_NAMES,
  nextTier,
  TIERS,
  type MonthlyReward,
  type PointBalance,
  type PointTransaction,
  type RewardTier,
} from '../../../lib/rewards'
import TierBadge, { TIER_LABEL, TIER_COLOR_BG } from '../../../components/rewards/TierBadge'
import GiftCard from '../../../components/rewards/GiftCard'

const KIND_LABEL: Record<PointTransaction['kind'], string> = {
  reward_credit: 'Reward Credit',
  certificate_used: 'Certificate Used',
  admin_adjustment: 'Admin Adjustment',
}

export default function FPointWalletPage() {
  const branch = useBranch()
  const branchId = useBranchId()
  const [balance, setBalance] = useState<PointBalance | null>(null)
  const [reward, setReward] = useState<MonthlyReward | null>(null)
  const [txns, setTxns] = useState<PointTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { year, month } = getIstYearMonth()
      try {
        const [b, r, t] = await Promise.all([
          fetchPointBalance(branchId),
          fetchMonthlyReward(branchId, year, month),
          fetchPointTransactions(branchId, 200),
        ])
        if (cancelled) return
        setBalance(b)
        setReward(r)
        setTxns(t)
      } catch { /* table may not exist yet */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [branchId])

  const { year, month } = getIstYearMonth()
  const count = reward?.admission_count ?? 0
  const level: RewardTier | null = (reward?.level as RewardTier | null) ?? null
  const next = nextTier(level)
  const remaining = next ? Math.max(0, next.threshold - count) : 0

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Hero — purple to differentiate from rupee wallet's red */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-fuchsia-700 text-white p-4 sm:p-6">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm opacity-90 inline-flex items-center gap-1.5">
              <Sparkles size={14} /> Certificate Point Wallet
            </p>
            <p className="text-3xl sm:text-5xl font-bold font-heading mt-1">{balance?.balance ?? 0}</p>
            <p className="text-xs sm:text-sm opacity-80 mt-1">
              Earned {balance?.total_earned ?? 0} · Used {balance?.total_used ?? 0}
            </p>
            <p className="text-[10px] sm:text-xs opacity-70 mt-2 truncate">{branch?.name}</p>
          </div>
          <Coins size={48} className="opacity-30 shrink-0 sm:w-16 sm:h-16" />
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatTile color="bg-emerald-50 text-emerald-700 border-emerald-200" Icon={TrendingUp} label="Total Earned" value={balance?.total_earned ?? 0} />
        <StatTile color="bg-rose-50 text-rose-700 border-rose-200" Icon={ArrowDownRight} label="Used" value={balance?.total_used ?? 0} />
        <StatTile color="bg-purple-50 text-purple-700 border-purple-200" Icon={ShieldCheck} label="Remaining" value={balance?.balance ?? 0} />
      </div>

      {/* This-month progress */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-heading text-sm sm:text-base font-bold text-gray-900">
            {MONTH_NAMES[month - 1]} {year} — Progress
          </h2>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${level ? TIER_COLOR_BG[level] : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {level ? TIER_LABEL[level] : 'No tier yet'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div>
              <p className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
                {count} <span className="text-sm font-medium text-gray-500">admission{count === 1 ? '' : 's'}</span>
              </p>
              {next ? (
                <p className="text-sm text-gray-600 mt-0.5">
                  <b className="text-purple-700">{remaining}</b> more to reach <b>{TIER_LABEL[next.tier]}</b>
                </p>
              ) : (
                <p className="text-sm text-purple-700 font-semibold mt-0.5">🏆 Top tier reached this month</p>
              )}
            </div>
            {/* Progress bar to platinum */}
            <div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden ring-1 ring-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.round((count / 30) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
                <span>0</span>
                <span>10 Silver</span>
                <span>20 Gold</span>
                <span>30 Platinum</span>
              </div>
            </div>
          </div>
          <GiftCard gift={reward?.gift ?? null} size="md" />
        </div>
      </div>

      {/* Tier ladder */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5">
        <h2 className="font-heading text-sm sm:text-base font-bold text-gray-900 mb-3">Reward Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TIERS.map(t => {
            const reached = count >= t.threshold
            return (
              <div
                key={t.tier}
                className={`relative rounded-xl border p-4 ${reached ? 'border-purple-200 bg-purple-50/40' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center gap-3">
                  <TierBadge tier={t.tier} size="md" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                      {t.threshold} admissions
                    </p>
                    <p className="font-heading font-bold text-gray-900 leading-tight">{t.label}</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                  <p>+{t.totalPoints} Certificate Point{t.totalPoints === 1 ? '' : 's'}</p>
                  {t.gift ? <p>🎁 {t.gift}</p> : <p className="text-gray-400">No gift</p>}
                </div>
                {reached && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    ✓ Achieved
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Transaction History</h2>
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : txns.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-400">No transactions yet</div>
          ) : txns.map(t => (
            <div key={t.id} className="rounded-xl border bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 font-semibold text-xs ${t.points > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {t.points > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {KIND_LABEL[t.kind]}
                </span>
                <span className="text-xs text-gray-400">{formatDateDDMMYYYY(t.created_at)}</span>
              </div>
              <p className={`font-bold mt-1 ${t.points > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {t.points > 0 ? '+' : ''}{t.points} pt{Math.abs(t.points) === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-gray-500 break-words mt-0.5">{t.description}</p>
            </div>
          ))}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : txns.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No transactions yet</td></tr>
              ) : txns.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDDMMYYYY(t.created_at)}</td>
                  <td className="px-4 py-3">
                    {t.points > 0
                      ? <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowUpRight size={14} /> {KIND_LABEL[t.kind]}</span>
                      : <span className="inline-flex items-center gap-1 text-rose-700"><ArrowDownRight size={14} /> {KIND_LABEL[t.kind]}</span>}
                  </td>
                  <td className={`px-4 py-3 font-bold ${t.points > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {t.points > 0 ? '+' : ''}{t.points}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatTile({ color, Icon, label, value }: { color: string; Icon: React.ElementType; label: string; value: number }) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${color}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider opacity-80">
        <Icon size={12} /> {label}
      </div>
      <div className="font-heading text-xl sm:text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}
