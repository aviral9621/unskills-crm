import { Lightbulb, Printer, Watch, Speaker, Gift } from 'lucide-react'

interface Props {
  gift: string | null
  size?: 'sm' | 'md' | 'lg'
}

function pickIcon(gift: string | null) {
  if (!gift) return Gift
  const g = gift.toLowerCase()
  if (g.includes('ring')) return Lightbulb
  if (g.includes('printer')) return Printer
  if (g.includes('watch')) return Watch
  if (g.includes('speaker')) return Speaker
  return Gift
}

const SIZE = {
  sm: { card: 'p-3', iconBox: 'w-10 h-10', icon: 18, text: 'text-xs' },
  md: { card: 'p-4', iconBox: 'w-14 h-14', icon: 24, text: 'text-sm' },
  lg: { card: 'p-5', iconBox: 'w-16 h-16', icon: 28, text: 'text-base' },
}

export default function GiftCard({ gift, size = 'md' }: Props) {
  const s = SIZE[size]
  const Icon = pickIcon(gift)
  if (!gift) {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 ${s.card}`}>
        <div className={`${s.iconBox} rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-300`}>
          <Gift size={s.icon} />
        </div>
        <div>
          <div className="text-xs text-gray-400 font-medium">No gift yet</div>
          <div className={`${s.text} text-gray-500`}>Reach Gold (20 admissions) to unlock</div>
        </div>
      </div>
    )
  }

  // Gold gift (Ring Light) → amber framing; otherwise platinum (sky).
  const isGold = gift.toLowerCase().includes('ring')
  const frame = isGold
    ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
    : 'bg-gradient-to-br from-sky-50 to-sky-100 border-sky-200'
  const iconWrap = isGold
    ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-lg shadow-amber-200'
    : 'bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-200'
  const labelText = isGold ? 'text-amber-800' : 'text-sky-800'
  const subText = isGold ? 'text-amber-600' : 'text-sky-600'

  return (
    <div className={`flex items-center gap-3 rounded-xl border ${frame} ${s.card}`}>
      <div className={`${s.iconBox} rounded-xl flex items-center justify-center ${iconWrap}`}>
        <Icon size={s.icon} />
      </div>
      <div className="min-w-0">
        <div className={`text-[10px] uppercase tracking-wide font-bold ${subText}`}>Gift Earned</div>
        <div className={`${s.text} font-semibold ${labelText} truncate`}>{gift}</div>
      </div>
    </div>
  )
}
