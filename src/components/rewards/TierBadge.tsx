import { Award, Crown, Trophy } from 'lucide-react'
import type { RewardTier } from '../../lib/rewards'

const STYLES: Record<RewardTier, {
  bg: string
  ring: string
  text: string
  shadow: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
}> = {
  silver: {
    bg: 'bg-[linear-gradient(135deg,#F5F5F5_0%,#D1D5DB_45%,#9CA3AF_100%)]',
    ring: 'ring-gray-300',
    text: 'text-white',
    shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_4px_12px_rgba(120,120,120,0.25)]',
    Icon: Award,
  },
  gold: {
    bg: 'bg-[linear-gradient(135deg,#FFE17A_0%,#FBBF24_50%,#B45309_100%)]',
    ring: 'ring-amber-300',
    text: 'text-white',
    shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_6px_18px_rgba(217,119,6,0.35)]',
    Icon: Trophy,
  },
  platinum: {
    bg: 'bg-[linear-gradient(135deg,#E0F2FE_0%,#7DD3FC_45%,#1E40AF_100%)]',
    ring: 'ring-sky-300',
    text: 'text-white',
    shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_6px_18px_rgba(30,64,175,0.35)]',
    Icon: Crown,
  },
}

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg', { box: number; icon: number }> = {
  xs: { box: 24, icon: 12 },
  sm: { box: 36, icon: 18 },
  md: { box: 56, icon: 28 },
  lg: { box: 80, icon: 40 },
}

interface Props {
  tier: RewardTier
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export default function TierBadge({ tier, size = 'md', className = '' }: Props) {
  const s = STYLES[tier]
  const dim = SIZE_PX[size]
  const Icon = s.Icon
  return (
    <div
      style={{ width: dim.box, height: dim.box }}
      className={`inline-flex items-center justify-center rounded-full ring-2 ${s.bg} ${s.ring} ${s.shadow} ${className}`}
      aria-label={`${tier} tier badge`}
    >
      <Icon size={dim.icon} className={`${s.text} drop-shadow-sm`} />
    </div>
  )
}

export const TIER_LABEL: Record<RewardTier, string> = {
  silver: 'Silver Achiever',
  gold: 'Gold Performer',
  platinum: 'Platinum Champion',
}

export const TIER_COLOR_TEXT: Record<RewardTier, string> = {
  silver: 'text-gray-700',
  gold: 'text-amber-700',
  platinum: 'text-sky-700',
}

export const TIER_COLOR_BG: Record<RewardTier, string> = {
  silver: 'bg-gray-100 text-gray-700 border-gray-200',
  gold: 'bg-amber-50 text-amber-800 border-amber-200',
  platinum: 'bg-sky-50 text-sky-800 border-sky-200',
}
