import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: { value: number; label: string }
  loading?: boolean
}

export default function StatsCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-red-600',
  iconBg = 'bg-red-50',
  trend,
  loading = false,
}: StatsCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="skeleton h-3 w-16 sm:h-4 sm:w-24" />
            <div className="skeleton h-6 w-14 sm:h-8 sm:w-20" />
            <div className="skeleton h-3 w-20 sm:w-32" />
          </div>
          <div className="skeleton h-9 w-9 sm:h-11 sm:w-11 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-gray-900 font-heading truncate">{value}</p>
          {trend && (
            <div className="mt-1.5 sm:mt-2 flex items-center gap-1">
              {trend.value >= 0 ? (
                <TrendingUp size={12} className="text-green-500 shrink-0" />
              ) : (
                <TrendingDown size={12} className="text-red-500 shrink-0" />
              )}
              <span className={`text-[10px] sm:text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={`${iconColor} sm:hidden`} />
          <Icon size={22} className={`${iconColor} hidden sm:block`} />
        </div>
      </div>
    </div>
  )
}
