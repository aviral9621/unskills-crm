import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Sparkles, Gift, Trophy, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchRewardTiers,
  saveRewardTiers,
  DEFAULT_TIERS,
  type TierConfig,
  type RewardTier,
} from '../../lib/rewards'
import TierBadge from '../../components/rewards/TierBadge'

const TIER_ORDER: RewardTier[] = ['silver', 'gold', 'platinum']

export default function AdminRewardsSettingsPage() {
  const [tiers, setTiers] = useState<TierConfig[]>(DEFAULT_TIERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchRewardTiers(true)
      .then(t => { if (!cancelled) setTiers(orderTiers(t)) })
      .catch(() => { if (!cancelled) setTiers(DEFAULT_TIERS) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function update(tier: RewardTier, patch: Partial<TierConfig>) {
    setTiers(prev => prev.map(t => t.tier === tier ? { ...t, ...patch } : t))
  }

  function validate(): string | null {
    // Thresholds must be strictly increasing in display order so the
    // "highest threshold reached" SQL logic stays sensible.
    const ordered = orderTiers(tiers)
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].threshold <= ordered[i - 1].threshold) {
        return `Thresholds must increase: ${ordered[i - 1].tier} (${ordered[i - 1].threshold}) must be lower than ${ordered[i].tier} (${ordered[i].threshold}).`
      }
    }
    for (const t of ordered) {
      if (t.threshold < 1) return `${t.tier}: threshold must be at least 1.`
      if (t.totalPoints < 0) return `${t.tier}: points cannot be negative.`
      if (!t.label.trim()) return `${t.tier}: label is required.`
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { toast.error(err); return }
    setSaving(true)
    try {
      await saveRewardTiers(orderTiers(tiers))
      toast.success('Reward tiers updated — every franchise will see the new gifts')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400">Loading…</div>
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/rewards"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          title="Back to monthly rewards"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" /> Reward Tier Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure admission thresholds, points, and gifts. Changes apply to every franchise dashboard immediately.
          </p>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold mb-0.5">How this works</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-90">
            <li>Each branch's current month is evaluated against these thresholds on every new admission.</li>
            <li>Mid-month <b>upgrades</b> (raising tier) automatically credit the point delta.</li>
            <li>Raising a threshold mid-month will <b>not</b> retroactively downgrade a branch — earned points stay credited.</li>
          </ul>
        </div>
      </div>

      {/* Tiers */}
      <div className="space-y-3">
        {orderTiers(tiers).map(t => (
          <TierEditor key={t.tier} tier={t} onChange={(patch) => update(t.tier, patch)} />
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Link
          to="/admin/rewards"
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

function TierEditor({ tier, onChange }: { tier: TierConfig; onChange: (patch: Partial<TierConfig>) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <TierBadge tier={tier.tier} size="md" />
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Tier</p>
          <p className="font-heading font-bold text-gray-900 capitalize">{tier.tier}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Display Label</label>
          <input
            value={tier.label}
            onChange={e => onChange({ label: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            placeholder="e.g. Silver Achiever"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Admission Threshold</label>
          <input
            type="number"
            min={1}
            value={tier.threshold}
            onChange={e => onChange({ threshold: Number(e.target.value) || 0 })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
            <Sparkles size={12} className="text-purple-500" /> Total Points (cumulative)
          </label>
          <input
            type="number"
            min={0}
            value={tier.totalPoints}
            onChange={e => onChange({ totalPoints: Number(e.target.value) || 0 })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
            <Gift size={12} className="text-pink-500" /> Gift (optional)
          </label>
          <input
            value={tier.gift ?? ''}
            onChange={e => onChange({ gift: e.target.value.trim() ? e.target.value : null })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            placeholder='e.g. "Ring Light" or "Smartwatch"'
          />
        </div>
      </div>
    </div>
  )
}

function orderTiers(tiers: TierConfig[]): TierConfig[] {
  // Always render in silver → gold → platinum order regardless of how
  // the DB returned them.
  const map = new Map(tiers.map(t => [t.tier, t]))
  return TIER_ORDER.map(k => map.get(k)).filter(Boolean) as TierConfig[]
}
