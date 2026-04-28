import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Trophy, ArrowRight, Search, ArrowDownRight, ArrowUpRight, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDateDDMMYYYY } from '../../lib/utils'
import {
  fetchMonthlyRewardsForPeriod,
  fetchPointTransactions,
  fetchPointBalance,
  getIstYearMonth,
  MONTH_NAMES,
  type MonthlyReward,
  type PointTransaction,
  type RewardTier,
} from '../../lib/rewards'
import TierBadge, { TIER_LABEL, TIER_COLOR_BG } from '../../components/rewards/TierBadge'

interface RewardRow extends MonthlyReward {
  branch?: { id: string; name: string; code: string; b_code: string | null } | null
}

interface TxnWithStudent extends PointTransaction {
  student?: { name: string; registration_no: string } | null
}

export default function AdminRewardsPage() {
  const initial = getIstYearMonth()
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [rows, setRows] = useState<RewardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<{ id: string; name: string } | null>(null)
  const [drillTxns, setDrillTxns] = useState<TxnWithStudent[]>([])
  const [drillBalance, setDrillBalance] = useState<{ total_earned: number; total_used: number; balance: number } | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMonthlyRewardsForPeriod(year, month)
      .then(d => { if (!cancelled) setRows((d ?? []) as unknown as RewardRow[]) })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [year, month])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      (r.branch?.name?.toLowerCase().includes(q)) ||
      (r.branch?.code?.toLowerCase().includes(q)) ||
      (r.branch?.b_code?.toLowerCase().includes(q)),
    )
  }, [rows, search])

  const totals = useMemo(() => {
    let admissions = 0, points = 0, branches = 0
    let silver = 0, gold = 0, platinum = 0
    for (const r of rows) {
      admissions += r.admission_count
      points += r.points_credited
      if (r.level) branches++
      if (r.level === 'silver') silver++
      if (r.level === 'gold') gold++
      if (r.level === 'platinum') platinum++
    }
    return { admissions, points, branches, silver, gold, platinum }
  }, [rows])

  async function openDrill(branchId: string, branchName: string) {
    setSelectedBranch({ id: branchId, name: branchName })
    setDrillLoading(true)
    setDrillTxns([])
    setDrillBalance(null)
    try {
      const [txns, bal] = await Promise.all([
        fetchPointTransactions(branchId, 500),
        fetchPointBalance(branchId),
      ])
      // Hydrate student names for `certificate_used` rows
      const studentIds = txns.map(t => t.student_id).filter(Boolean) as string[]
      let studentMap: Record<string, { name: string; registration_no: string }> = {}
      if (studentIds.length) {
        const { data: stu } = await supabase
          .from('uce_students')
          .select('id,name,registration_no')
          .in('id', studentIds)
        for (const s of (stu ?? [])) studentMap[s.id] = { name: s.name, registration_no: s.registration_no }
      }
      const enriched = txns.map(t => ({
        ...t,
        student: t.student_id ? studentMap[t.student_id] : null,
      })) as TxnWithStudent[]
      setDrillTxns(enriched)
      setDrillBalance({ total_earned: bal.total_earned, total_used: bal.total_used, balance: bal.balance })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load branch ledger')
    } finally { setDrillLoading(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header + period picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" /> Monthly Rewards Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track admission tiers, points credited, and gifts earned by every branch.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 text-sm rounded-lg border bg-white">
            {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 text-sm rounded-lg border bg-white">
            {[year - 2, year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link
            to="/admin/rewards/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Configure reward tiers and gifts"
          >
            <Settings2 size={14} /> Tier Settings
          </Link>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="Branches Earning" value={String(totals.branches)} sub={`Silver ${totals.silver} · Gold ${totals.gold} · Platinum ${totals.platinum}`} color="bg-purple-50 text-purple-700 border-purple-200" />
        <SummaryTile label="Total Admissions" value={String(totals.admissions)} sub="across all branches" color="bg-blue-50 text-blue-700 border-blue-200" />
        <SummaryTile label="Points Credited" value={String(totals.points)} sub="this month" color="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <SummaryTile label="Branches Tracked" value={String(rows.length)} sub="with at least 1 admission" color="bg-amber-50 text-amber-700 border-amber-200" />
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-heading text-sm sm:text-base font-bold text-gray-900 inline-flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-500" /> Leaderboard — {MONTH_NAMES[month - 1]} {year}
          </h2>
        </div>
        {rows.slice(0, 5).length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6">No branches qualified yet.</div>
        ) : (
          <ol className="space-y-2">
            {rows.slice(0, 5).map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-100 text-amber-800' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'bg-gray-50 text-gray-500'}`}>
                  {i + 1}
                </span>
                {r.level && <TierBadge tier={r.level as RewardTier} size="sm" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{r.branch?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500">{r.branch?.code} {r.branch?.b_code && `· ${r.branch.b_code}`}</p>
                </div>
                <span className="font-bold text-gray-900">{r.admission_count}</span>
                <span className="text-xs text-gray-500 hidden sm:inline">admissions</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search branch by name or code…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Branch table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Admissions</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Points</th>
              <th className="px-4 py-3">Gift</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-900">{r.branch?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.branch?.code} {r.branch?.b_code && `/ ${r.branch.b_code}`}</td>
                <td className="px-4 py-3 font-bold text-gray-900">{r.admission_count}</td>
                <td className="px-4 py-3">
                  {r.level ? (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${TIER_COLOR_BG[r.level as RewardTier]}`}>
                      <TierBadge tier={r.level as RewardTier} size="xs" /> {TIER_LABEL[r.level as RewardTier]}
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-emerald-700 font-bold">+{r.points_credited}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{r.gift ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openDrill(r.branch_id, r.branch?.name ?? 'Branch')} className="text-xs font-medium text-purple-700 hover:text-purple-900 inline-flex items-center gap-1">
                      View ledger <ArrowRight size={12} />
                    </button>
                    <Link to={`/admin/branches/${r.branch_id}/points`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Open branch wallet">
                      <Settings2 size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down panel */}
      {selectedBranch && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setSelectedBranch(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Point Ledger</p>
                <h3 className="font-heading text-lg font-bold text-gray-900">{selectedBranch.name}</h3>
              </div>
              <div className="flex items-center gap-3">
                {drillBalance && (
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">Earned {drillBalance.total_earned}</span>
                    <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">Used {drillBalance.total_used}</span>
                    <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">Balance {drillBalance.balance}</span>
                  </div>
                )}
                <button onClick={() => setSelectedBranch(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 sm:p-4">
              {drillLoading ? (
                <div className="text-center py-12 text-gray-400">Loading…</div>
              ) : drillTxns.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No transactions yet</div>
              ) : (
                <ul className="space-y-2">
                  {drillTxns.map(t => (
                    <li key={t.id} className="rounded-lg border border-gray-200 px-3 py-2.5 flex items-start gap-3">
                      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${t.points > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {t.points > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{t.description}</p>
                          <span className={`text-sm font-bold ${t.points > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {t.points > 0 ? '+' : ''}{t.points} pt
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateDDMMYYYY(t.created_at)} · <span className="capitalize">{t.kind.replace('_', ' ')}</span>
                          {t.student && <> · Student: <b className="text-gray-700">{t.student.name}</b> ({t.student.registration_no})</>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${color}`}>
      <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">{label}</p>
      <p className="font-heading text-2xl sm:text-3xl font-bold mt-1">{value}</p>
      <p className="text-[11px] mt-0.5 opacity-80">{sub}</p>
    </div>
  )
}
