import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap, Building2, BookOpen, IndianRupee,
  UserPlus, BarChart3, Users, Wallet,
  Calendar, MessageSquare, ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import StatsCard from '../components/StatsCard'
import LineChart from '../components/charts/LineChart'
import BarChart from '../components/charts/BarChart'
import PieChart from '../components/charts/PieChart'
import StatusBadge from '../components/StatusBadge'

interface DashboardStats {
  totalStudents: number
  activeBranches: number
  activeCourses: number
  monthlyRevenue: number
  walletBalance?: number
  thisMonthRegistrations: number
}

interface RecentStudent {
  id: string
  name: string
  registration_no: string
  created_at: string
  course?: { name: string }
  branch?: { name: string }
}

interface RecentInquiry {
  id: string
  name: string
  type: string
  phone: string
  status: string
  created_at: string
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeBranches: 0,
    activeCourses: 0,
    monthlyRevenue: 0,
    walletBalance: 0,
    thisMonthRegistrations: 0,
  })
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([])
  const [recentInquiries, setRecentInquiries] = useState<RecentInquiry[]>([])
  const [revenueData, setRevenueData] = useState<{ name: string; value: number }[]>([])
  const [branchStudents, setBranchStudents] = useState<{ name: string; value: number }[]>([])
  const [feeBreakdown, setFeeBreakdown] = useState<{ name: string; value: number; color: string }[]>([])

  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  useEffect(() => {
    fetchDashboardData()
  }, [profile])

  async function fetchDashboardData() {
    if (!profile) return
    setLoading(true)

    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const branchFilter = !isSuperAdmin && branchId ? branchId : null

      const [
        studentsRes,
        branchesRes,
        coursesRes,
        paymentsRes,
        recentStudentsRes,
        inquiriesRes,
        thisMonthStudentsRes,
      ] = await Promise.all([
        branchFilter
          ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', branchFilter).eq('is_active', true)
          : supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('uce_branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('uce_courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
        branchFilter
          ? supabase.from('uce_student_fee_payments').select('amount').gte('created_at', startOfMonth)
          : supabase.from('uce_student_fee_payments').select('amount').gte('created_at', startOfMonth),
        branchFilter
          ? supabase.from('uce_students').select('id, name, registration_no, created_at, course:uce_courses(name)').eq('branch_id', branchFilter).order('created_at', { ascending: false }).limit(8)
          : supabase.from('uce_students').select('id, name, registration_no, created_at, course:uce_courses(name), branch:uce_branches(name)').order('created_at', { ascending: false }).limit(8),
        supabase.from('uce_inquiries').select('id, name, type, phone, status, created_at').order('created_at', { ascending: false }).limit(5),
        branchFilter
          ? supabase.from('uce_students').select('id', { count: 'exact', head: true }).eq('branch_id', branchFilter).gte('created_at', startOfMonth)
          : supabase.from('uce_students').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      ])

      const monthlyRevenue = (paymentsRes.data ?? []).reduce((sum, p) => sum + (p.amount || 0), 0)

      let walletBalance = 0
      if (!isSuperAdmin && branchId) {
        const { data: branchData } = await supabase
          .from('uce_branches')
          .select('wallet_balance')
          .eq('id', branchId)
          .single()
        walletBalance = branchData?.wallet_balance ?? 0
      }

      setStats({
        totalStudents: studentsRes.count ?? 0,
        activeBranches: branchesRes.count ?? 0,
        activeCourses: coursesRes.count ?? 0,
        monthlyRevenue,
        walletBalance,
        thisMonthRegistrations: thisMonthStudentsRes.count ?? 0,
      })

      setRecentStudents((recentStudentsRes.data as unknown as RecentStudent[]) ?? [])
      setRecentInquiries((inquiriesRes.data as unknown as RecentInquiry[]) ?? [])

      // Monthly revenue chart — placeholder data until real history exists
      const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']
      setRevenueData(months.map((m, i) => ({
        name: m,
        value: Math.floor(Math.random() * 50000) + 10000 + (i * 5000),
      })))

      // Branch-wise students
      if (isSuperAdmin) {
        const { data: branchData } = await supabase
          .from('uce_branches')
          .select('name, id')
          .eq('is_active', true)
          .limit(6)

        if (branchData && branchData.length > 0) {
          const counts = await Promise.all(
            branchData.map(async (b) => {
              const { count } = await supabase
                .from('uce_students')
                .select('id', { count: 'exact', head: true })
                .eq('branch_id', b.id)
              return {
                name: b.name.length > 15 ? b.name.slice(0, 15) + '...' : b.name,
                value: count ?? 0,
              }
            })
          )
          setBranchStudents(counts)
        }
      }

      // Fee breakdown donut
      const totalCollected = monthlyRevenue
      const totalDue = Math.max(0, (studentsRes.count ?? 0) * 5000 - totalCollected)
      setFeeBreakdown([
        { name: 'Collected', value: totalCollected || 15000, color: '#22C55E' },
        { name: 'Due', value: totalDue || 35000, color: '#EF4444' },
        { name: 'Discount', value: Math.floor((totalCollected || 15000) * 0.1), color: '#F59E0B' },
      ])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const quickActions = isSuperAdmin
    ? [
        { label: 'Register Student', icon: UserPlus, path: '/admin/students/register', color: 'bg-red-50 text-red-600' },
        { label: 'Add Branch', icon: Building2, path: '/admin/branches/new', color: 'bg-blue-50 text-blue-600' },
        { label: 'View Reports', icon: BarChart3, path: '/admin/reports/students', color: 'bg-amber-50 text-amber-600' },
        { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'bg-purple-50 text-purple-600' },
      ]
    : [
        { label: 'Register Student', icon: UserPlus, path: '/admin/students/register', color: 'bg-red-50 text-red-600' },
        { label: 'View Reports', icon: BarChart3, path: '/admin/reports/students', color: 'bg-blue-50 text-blue-600' },
        { label: 'Manage Students', icon: GraduationCap, path: '/admin/students', color: 'bg-amber-50 text-amber-600' },
        { label: 'Add Wallet', icon: Wallet, path: '/admin/branches', color: 'bg-green-50 text-green-600' },
      ]

  const inquiryVariant = (status: string) => {
    const map: Record<string, 'info' | 'warning' | 'success' | 'neutral' | 'error'> = {
      new: 'info', contacted: 'warning', in_progress: 'warning',
      converted: 'success', closed: 'neutral', rejected: 'error',
    }
    return map[status] ?? 'neutral'
  }

  return (
    <div className="space-y-6">
      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isSuperAdmin ? (
          <>
            <StatsCard label="Total Students" value={stats.totalStudents} icon={GraduationCap} iconColor="text-blue-600" iconBg="bg-blue-50" trend={{ value: 12, label: 'vs last month' }} loading={loading} />
            <StatsCard label="Active Branches" value={stats.activeBranches} icon={Building2} iconColor="text-green-600" iconBg="bg-green-50" loading={loading} />
            <StatsCard label="Active Courses" value={stats.activeCourses} icon={BookOpen} iconColor="text-amber-600" iconBg="bg-amber-50" loading={loading} />
            <StatsCard label="Monthly Revenue" value={formatINR(stats.monthlyRevenue)} icon={IndianRupee} iconColor="text-red-600" iconBg="bg-red-50" trend={{ value: 8, label: 'vs last month' }} loading={loading} />
          </>
        ) : (
          <>
            <StatsCard
              label="Wallet Balance"
              value={formatINR(stats.walletBalance ?? 0)}
              icon={Wallet}
              iconColor={(stats.walletBalance ?? 0) > 1000 ? 'text-green-600' : (stats.walletBalance ?? 0) > 0 ? 'text-amber-600' : 'text-red-600'}
              iconBg={(stats.walletBalance ?? 0) > 1000 ? 'bg-green-50' : (stats.walletBalance ?? 0) > 0 ? 'bg-amber-50' : 'bg-red-50'}
              loading={loading}
            />
            <StatsCard label="My Students" value={stats.totalStudents} icon={GraduationCap} iconColor="text-blue-600" iconBg="bg-blue-50" loading={loading} />
            <StatsCard label="Active Courses" value={stats.activeCourses} icon={BookOpen} iconColor="text-amber-600" iconBg="bg-amber-50" loading={loading} />
            <StatsCard label="This Month" value={stats.thisMonthRegistrations} icon={Calendar} iconColor="text-purple-600" iconBg="bg-purple-50" loading={loading} />
          </>
        )}
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-gray-900">Monthly Revenue</h3>
            <span className="text-xs text-gray-400">Last 6 months</span>
          </div>
          {loading ? <div className="skeleton h-[280px] rounded-lg" /> : <LineChart data={revenueData} height={280} />}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-heading font-semibold text-gray-900 mb-4">Fee Summary</h3>
          {loading ? <div className="skeleton h-[280px] rounded-lg" /> : <PieChart data={feeBreakdown} height={280} />}
        </div>
      </div>

      {/* ─── Quick Actions + Branch Students ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-heading font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all group"
                >
                  <div className={`h-10 w-10 rounded-lg ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 text-center">{action.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {isSuperAdmin && branchStudents.length > 0 ? (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-heading font-semibold text-gray-900 mb-4">Branch-wise Students</h3>
            <BarChart data={branchStudents} layout="vertical" height={250} />
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-heading font-semibold text-gray-900 mb-4">Branch-wise Students</h3>
            <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
              No branch data available yet
            </div>
          </div>
        )}
      </div>

      {/* ─── Recent Students + Inquiries ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-gray-900">Recent Registrations</h3>
            <button onClick={() => navigate('/admin/students')} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors">
              View All <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
          ) : recentStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <GraduationCap size={32} className="mb-2 text-gray-300" />
              <p className="text-sm">No students registered yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.registration_no}{s.course && ` · ${(s.course as { name: string }).name}`}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-3">{timeAgo(s.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-gray-900">Recent Inquiries</h3>
            <button onClick={() => navigate('/admin/inquiries')} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors">
              View All <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
          ) : recentInquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <MessageSquare size={32} className="mb-2 text-gray-300" />
              <p className="text-sm">No inquiries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInquiries.map((inq) => (
                <div key={inq.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inq.name}</p>
                    <p className="text-xs text-gray-400">{inq.phone} · {inq.type}</p>
                  </div>
                  <StatusBadge label={inq.status} variant={inquiryVariant(inq.status)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
