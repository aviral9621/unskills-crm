import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, UserMinus, UserCheck,
  IndianRupee, AlertTriangle, Receipt, TrendingUp,
  Calendar, ArrowRight, GraduationCap, Wallet,
  BookOpen, BarChart3, Upload,
  Clock, Ban, CircleDollarSign, ChevronDown,
  ArrowUpRight, ArrowDownRight, Filter,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart as RechartsBarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/* ─── Helpers ─── */
function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCompact(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount}`
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ─── Types ─── */
interface OverviewStats {
  totalStudents: number
  newAdmissions: number
  droppedStudents: number
  activeStudents: number
  completedStudents: number
  totalRevenue: number
  pendingFees: number
  expenses: number
  profit: number
}

interface FeeStats {
  todayCollection: number
  todayDue: number
  overdueFees: number
  totalPending: number
}

interface AdmissionStats {
  thisMonthCount: number
  lastMonthCount: number
  growthPercent: number
}

interface RecentStudent {
  id: string
  name: string
  registration_no: string
  created_at: string
  course?: { name: string }
  branch?: { name: string }
}

interface RecentPayment {
  id: string
  amount: number
  payment_date: string
  created_at: string
  student?: { name: string; registration_no: string }
}

interface MonthlyDataPoint {
  name: string
  revenue: number
  expenses: number
  admissions: number
}

type FilterPeriod = 'today' | 'this_week' | 'this_month' | 'this_year'

/* ─── Mini Components ─── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2.5 flex-1">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-7 w-24" />
          <div className="skeleton h-3 w-16" />
        </div>
        <div className="skeleton h-10 w-10 rounded-lg" />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendLabel,
  loading,
  onClick,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  trend?: number
  trendLabel?: string
  loading?: boolean
  onClick?: () => void
}) {
  if (loading) return <SkeletonCard />

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-md transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 font-heading truncate">{value}</p>
          {trend !== undefined && (
            <div className="mt-1.5 flex items-center gap-1">
              {trend >= 0 ? (
                <ArrowUpRight size={14} className="text-green-500 shrink-0" />
              ) : (
                <ArrowDownRight size={14} className="text-red-500 shrink-0" />
              )}
              <span className={`text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && <span className="text-xs text-gray-400 hidden sm:inline">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 font-heading">{title}</h3>
      {action && (
        <button onClick={onAction} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors">
          {action} <ArrowRight size={14} />
        </button>
      )}
    </div>
  )
}

/* ─── Chart Theme Colors ─── */
const CHART_COLORS = {
  primary: '#DC2626',
  primaryLight: '#FEE2E2',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════ */
export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterPeriod>('this_month')
  const [filterOpen, setFilterOpen] = useState(false)

  const [overview, setOverview] = useState<OverviewStats>({
    totalStudents: 0, newAdmissions: 0, droppedStudents: 0, activeStudents: 0, completedStudents: 0,
    totalRevenue: 0, pendingFees: 0, expenses: 0, profit: 0,
  })
  const [feeStats, setFeeStats] = useState<FeeStats>({
    todayCollection: 0, todayDue: 0, overdueFees: 0, totalPending: 0,
  })
  const [admissionStats, setAdmissionStats] = useState<AdmissionStats>({
    thisMonthCount: 0, lastMonthCount: 0, growthPercent: 0,
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([])
  const [feeBreakdown, setFeeBreakdown] = useState<{ name: string; value: number; color: string }[]>([])
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([])
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([])

  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const filterLabel: Record<FilterPeriod, string> = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
  }

  /* ─── Date helpers ─── */
  function getFilterStart(f: FilterPeriod): string {
    const now = new Date()
    switch (f) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      case 'this_week': {
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        return new Date(now.getFullYear(), now.getMonth(), diff).toISOString()
      }
      case 'this_month':
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      case 'this_year':
        return new Date(now.getFullYear(), 0, 1).toISOString()
    }
  }

  /* ─── Data Fetch ─── */
  useEffect(() => {
    if (profile) fetchAll()
  }, [profile, filter])

  async function fetchAll() {
    setLoading(true)
    try {
      await Promise.all([
        fetchOverview(),
        fetchFeeStats(),
        fetchAdmissionStats(),
        fetchMonthlyData(),
        fetchRecentStudents(),
        fetchRecentPayments(),
      ])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchOverview() {
    const filterStart = getFilterStart(filter)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const bf = !isSuperAdmin && branchId ? branchId : null

    // Total students (all time)
    const totalQ = bf
      ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', bf)
      : supabase.from('uce_students').select('id', { count: 'exact', head: true })
    const { count: totalStudents } = await totalQ

    // Active students
    const activeQ = bf
      ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', bf).eq('is_active', true)
      : supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('is_active', true)
    const { count: activeStudents } = await activeQ

    // Dropped (inactive) students
    const droppedQ = bf
      ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', bf).eq('is_active', false)
      : supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('is_active', false)
    const { count: droppedStudents } = await droppedQ

    // New admissions this month
    const newQ = bf
      ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', bf).gte('created_at', startOfMonth)
      : supabase.from('uce_students').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth)
    const { count: newAdmissions } = await newQ

    // Completed students — distinct students with an active certificate issued.
    const certQ = bf
      ? supabase.from('uce_certificates').select('student_id').eq('status', 'active').eq('branch_id', bf)
      : supabase.from('uce_certificates').select('student_id').eq('status', 'active')
    const { data: certRows } = await certQ
    const completedStudents = new Set((certRows ?? []).map(r => r.student_id).filter(Boolean)).size

    // Revenue in filter period
    const { data: payments } = await supabase
      .from('uce_student_fee_payments')
      .select('amount')
      .gte('created_at', filterStart)
    const totalRevenue = (payments ?? []).reduce((s, p) => s + (p.amount || 0), 0)

    // Expenses in filter period
    const expQ = bf
      ? supabase.from('uce_expenses').select('amount').eq('branch_id', bf).gte('created_at', filterStart)
      : supabase.from('uce_expenses').select('amount').gte('created_at', filterStart)
    const { data: expenseRows } = await expQ
    const expenses = (expenseRows ?? []).reduce((s, e) => s + (e.amount || 0), 0)

    // Pending fees: sum(net_fee) - sum(all payments) for all active students
    const studFeeQ = bf
      ? supabase.from('uce_students').select('net_fee').eq('branch_id', bf).eq('is_active', true)
      : supabase.from('uce_students').select('net_fee').eq('is_active', true)
    const { data: studFees } = await studFeeQ
    const totalNetFee = (studFees ?? []).reduce((s, st) => s + (st.net_fee || 0), 0)

    const { data: allPayments } = await supabase.from('uce_student_fee_payments').select('amount')
    const totalPaid = (allPayments ?? []).reduce((s, p) => s + (p.amount || 0), 0)
    const pendingFees = Math.max(0, totalNetFee - totalPaid)

    setOverview({
      totalStudents: totalStudents ?? 0,
      newAdmissions: newAdmissions ?? 0,
      droppedStudents: droppedStudents ?? 0,
      activeStudents: activeStudents ?? 0,
      completedStudents,
      totalRevenue,
      pendingFees,
      expenses,
      profit: totalRevenue - expenses,
    })

    // Fee breakdown for donut
    setFeeBreakdown([
      { name: 'Collected', value: totalPaid || 1, color: CHART_COLORS.green },
      { name: 'Pending', value: pendingFees || 1, color: CHART_COLORS.amber },
      { name: 'Overdue', value: Math.floor(pendingFees * 0.3) || 1, color: CHART_COLORS.primary },
    ])
  }

  async function fetchFeeStats() {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    // Today's collection
    const { data: todayPayments } = await supabase
      .from('uce_student_fee_payments')
      .select('amount')
      .gte('created_at', todayStart)
    const todayCollection = (todayPayments ?? []).reduce((s, p) => s + (p.amount || 0), 0)

    // Total pending (reuse from overview calculation or separate)
    const bf = !isSuperAdmin && branchId ? branchId : null
    const studQ = bf
      ? supabase.from('uce_students').select('net_fee').eq('branch_id', bf).eq('is_active', true)
      : supabase.from('uce_students').select('net_fee').eq('is_active', true)
    const { data: studFees } = await studQ
    const totalNet = (studFees ?? []).reduce((s, st) => s + (st.net_fee || 0), 0)

    const { data: allPay } = await supabase.from('uce_student_fee_payments').select('amount')
    const totalPaid = (allPay ?? []).reduce((s, p) => s + (p.amount || 0), 0)
    const totalPending = Math.max(0, totalNet - totalPaid)
    const overdueFees = Math.floor(totalPending * 0.3)  // estimate ~30% overdue

    setFeeStats({
      todayCollection,
      todayDue: Math.max(0, Math.floor(totalPending / 30)),  // approximate daily due
      overdueFees,
      totalPending,
    })
  }

  async function fetchAdmissionStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
    const bf = !isSuperAdmin && branchId ? branchId : null

    const thisQ = bf
      ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', bf).gte('created_at', startOfMonth)
      : supabase.from('uce_students').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth)
    const { count: thisMonthCount } = await thisQ

    const lastQ = bf
      ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', bf).gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth)
      : supabase.from('uce_students').select('id', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth)
    const { count: lastMonthCount } = await lastQ

    const thisC = thisMonthCount ?? 0
    const lastC = lastMonthCount ?? 0
    const growth = lastC > 0 ? Math.round(((thisC - lastC) / lastC) * 100) : thisC > 0 ? 100 : 0

    setAdmissionStats({
      thisMonthCount: thisC,
      lastMonthCount: lastC,
      growthPercent: growth,
    })
  }

  async function fetchMonthlyData() {
    const now = new Date()
    // Build the 6 month ranges first, then fire ALL queries in parallel —
    // previously this looped sequentially (6 × ~220ms = ~1.3s dashboard lag).
    const ranges = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return {
        name: d.toLocaleString('en-IN', { month: 'short' }),
        start: d.toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      }
    })

    const results = await Promise.all(ranges.map(r => Promise.all([
      supabase.from('uce_student_fee_payments').select('amount').gte('created_at', r.start).lte('created_at', r.end),
      supabase.from('uce_expenses').select('amount').gte('created_at', r.start).lte('created_at', r.end),
      supabase.from('uce_students').select('id', { count: 'exact', head: true }).gte('created_at', r.start).lte('created_at', r.end),
    ])))

    const months: MonthlyDataPoint[] = ranges.map((r, idx) => {
      const [payRes, expRes, admRes] = results[idx]
      return {
        name: r.name,
        revenue: (payRes.data ?? []).reduce((s, p) => s + (p.amount || 0), 0),
        expenses: (expRes.data ?? []).reduce((s, e) => s + (e.amount || 0), 0),
        admissions: admRes.count ?? 0,
      }
    })
    setMonthlyData(months)
  }

  async function fetchRecentStudents() {
    const bf = !isSuperAdmin && branchId ? branchId : null
    const q = bf
      ? supabase.from('uce_students').select('id, name, registration_no, created_at, course:uce_courses(name)').eq('branch_id', bf).order('created_at', { ascending: false }).limit(5)
      : supabase.from('uce_students').select('id, name, registration_no, created_at, course:uce_courses(name), branch:uce_branches(name)').order('created_at', { ascending: false }).limit(5)
    const { data } = await q
    setRecentStudents((data as unknown as RecentStudent[]) ?? [])
  }

  async function fetchRecentPayments() {
    const { data } = await supabase
      .from('uce_student_fee_payments')
      .select('id, amount, payment_date, created_at, student:uce_students(name, registration_no)')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentPayments((data as unknown as RecentPayment[]) ?? [])
  }

  /* ─── Quick Actions ─── */
  const quickActions = isSuperAdmin
    ? [
        { label: 'Add Student', sub: 'New Registration', icon: UserPlus, path: '/admin/students/register', color: 'bg-red-600 text-white' },
        { label: 'Collect Fee', sub: 'Record Payment', icon: IndianRupee, path: '/admin/reports/fees', color: 'bg-white text-gray-700 border border-gray-200' },
        { label: 'Add Course', sub: 'Create New Course', icon: BookOpen, path: '/admin/courses/new', color: 'bg-white text-gray-700 border border-gray-200' },
        { label: 'Upload Material', sub: 'PDF Only', icon: Upload, path: '/admin/study-material', color: 'bg-white text-gray-700 border border-gray-200' },
      ]
    : [
        { label: 'Add Student', sub: 'New Registration', icon: UserPlus, path: '/admin/students/register', color: 'bg-red-600 text-white' },
        { label: 'Collect Fee', sub: 'Record Payment', icon: IndianRupee, path: '/admin/reports/fees', color: 'bg-white text-gray-700 border border-gray-200' },
        { label: 'View Reports', sub: 'All Reports', icon: BarChart3, path: '/admin/reports/students', color: 'bg-white text-gray-700 border border-gray-200' },
        { label: 'Wallet', sub: 'Manage Balance', icon: Wallet, path: '/admin/branches', color: 'bg-white text-gray-700 border border-gray-200' },
      ]

  /* ─── Donut center value ─── */
  const totalFeeValue = useMemo(() => {
    const total = feeBreakdown.reduce((s, d) => s + d.value, 0)
    return formatINR(total)
  }, [feeBreakdown])

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's your institute overview</p>
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Filter size={16} className="text-gray-400" />
            {filterLabel[filter]}
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                {(Object.keys(filterLabel) as FilterPeriod[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setFilter(key); setFilterOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${filter === key ? 'text-red-600 font-medium bg-red-50' : 'text-gray-700'}`}
                  >
                    {filterLabel[key]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 1: Overview Stats (8 cards)
          ═══════════════════════════════════════════ */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Students" value={overview.totalStudents} icon={Users} iconColor="text-blue-600" iconBg="bg-blue-50" loading={loading} />
          <StatCard label="New Admissions" value={overview.newAdmissions} icon={UserPlus} iconColor="text-green-600" iconBg="bg-green-50" trend={admissionStats.growthPercent} trendLabel="vs last month" loading={loading} />
          <StatCard label="Dropped Students" value={overview.droppedStudents} icon={UserMinus} iconColor="text-red-600" iconBg="bg-red-50" loading={loading} />
          <StatCard label="Active Students" value={overview.activeStudents} icon={UserCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" loading={loading} />
          <StatCard
            label="Completed Students"
            value={overview.completedStudents}
            icon={GraduationCap}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            loading={loading}
            onClick={() => navigate('/admin/students?filter=completed')}
          />
          <StatCard label="Total Revenue" value={formatINR(overview.totalRevenue)} icon={IndianRupee} iconColor="text-green-600" iconBg="bg-green-50" loading={loading} />
          <StatCard label="Pending Fees" value={formatINR(overview.pendingFees)} icon={AlertTriangle} iconColor="text-amber-600" iconBg="bg-amber-50" loading={loading} />
          <StatCard label="Expenses" value={formatINR(overview.expenses)} icon={Receipt} iconColor="text-orange-600" iconBg="bg-orange-50" loading={loading} />
          <StatCard
            label="Profit"
            value={formatINR(overview.profit)}
            icon={TrendingUp}
            iconColor={overview.profit >= 0 ? 'text-green-600' : 'text-red-600'}
            iconBg={overview.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}
            loading={loading}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 2: Fee Management (4 cards)
          ═══════════════════════════════════════════ */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fee Management</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl border border-green-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center">
                <CircleDollarSign size={16} className="text-white" />
              </div>
              <span className="text-xs font-medium text-green-700">Today's Collection</span>
            </div>
            {loading ? (
              <div className="skeleton h-7 w-24 mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-green-800 font-heading">{formatINR(feeStats.todayCollection)}</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
              <span className="text-xs font-medium text-blue-700">Today's Due</span>
            </div>
            {loading ? (
              <div className="skeleton h-7 w-24 mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-blue-800 font-heading">{formatINR(feeStats.todayDue)}</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl border border-red-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
                <Ban size={16} className="text-white" />
              </div>
              <span className="text-xs font-medium text-red-700">Overdue Fees</span>
            </div>
            {loading ? (
              <div className="skeleton h-7 w-24 mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-red-800 font-heading">{formatINR(feeStats.overdueFees)}</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <AlertTriangle size={16} className="text-white" />
              </div>
              <span className="text-xs font-medium text-amber-700">Total Pending</span>
            </div>
            {loading ? (
              <div className="skeleton h-7 w-24 mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-amber-800 font-heading">{formatINR(feeStats.totalPending)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 3: Charts Row — Revenue + Fee Donut + Admissions
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Fee Collection — Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <SectionHeader title="Monthly Fee Collection" />
          {loading ? (
            <div className="skeleton h-[280px] rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(value) => [formatINR(Number(value)), '']}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.amber} strokeWidth={2} fill="transparent" strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fee Summary Donut */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <SectionHeader title="Fee Summary" />
          {loading ? (
            <div className="skeleton h-[280px] rounded-lg" />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPieChart>
                  <Pie data={feeBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" strokeWidth={3} stroke="#FFFFFF">
                    {feeBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(value) => [formatINR(Number(value)), '']}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-30px' }}>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Total Fees</p>
                  <p className="text-sm font-bold text-gray-900 font-heading">{totalFeeValue}</p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-1">
                {feeBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-500">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 4: Admission Growth + Quick Actions
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Admission Growth Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <SectionHeader title="Admission Growth (Monthly)" />
          {loading ? (
            <div className="skeleton h-[220px] rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RechartsBarChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Bar dataKey="admissions" name="Admissions" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} barSize={36} />
              </RechartsBarChart>
            </ResponsiveContainer>
          )}
          {/* Admission summary strip */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                <Calendar size={16} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">This Month</p>
                <p className="text-sm font-bold text-gray-900">{loading ? '—' : admissionStats.thisMonthCount}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Calendar size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Last Month</p>
                <p className="text-sm font-bold text-gray-900">{loading ? '—' : admissionStats.lastMonthCount}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              {admissionStats.growthPercent >= 0 ? (
                <ArrowUpRight size={18} className="text-green-500" />
              ) : (
                <ArrowDownRight size={18} className="text-red-500" />
              )}
              <div>
                <p className="text-xs text-gray-400">Growth</p>
                <p className={`text-sm font-bold ${admissionStats.growthPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {loading ? '—' : `${admissionStats.growthPercent >= 0 ? '+' : ''}${admissionStats.growthPercent}%`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <SectionHeader title="Quick Actions" />
          <div className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all hover:shadow-md ${action.color}`}
                >
                  <Icon size={20} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{action.label}</p>
                    <p className={`text-xs truncate ${action.color.includes('text-white') ? 'text-red-100' : 'text-gray-400'}`}>{action.sub}</p>
                  </div>
                  <ArrowRight size={16} className="ml-auto shrink-0 opacity-50" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 5: Recent Students + Recent Payments
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Students */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <SectionHeader title="Recent Students" action="View All" onAction={() => navigate('/admin/students')} />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : recentStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <GraduationCap size={36} className="mb-2 text-gray-300" />
              <p className="text-sm">No students registered yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-red-600">
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.course ? (s.course as { name: string }).name : 'N/A'} · {s.registration_no}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                      New
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(s.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
          <SectionHeader title="Recent Payments" action="View All" onAction={() => navigate('/admin/reports/fees')} />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : recentPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <IndianRupee size={36} className="mb-2 text-gray-300" />
              <p className="text-sm">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPayments.map((p) => {
                const student = p.student as unknown as { name: string; registration_no: string } | null
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                    <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <IndianRupee size={16} className="text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{student?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400 truncate">{student?.registration_no ?? ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-600">{formatINR(p.amount)}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                        Received
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
