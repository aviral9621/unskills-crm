import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Users, IndianRupee, AlertTriangle, Briefcase, ScrollText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBranch, useBranchId } from '../../lib/franchise'
import { formatINR } from '../../lib/utils'

interface Stats {
  students: number
  activeStudents: number
  collectedThisMonth: number
  pendingFees: number
  openTickets: number
  pendingCourses: number
}

export default function FDashboardPage() {
  const branch = useBranch()
  const branchId = useBranchId()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!branchId) return
    ;(async () => {
      const [stu, active, payCol, tickets, courses] = await Promise.all([
        supabase.from('uce_students').select('*', { count: 'exact', head: true }).eq('branch_id', branchId),
        supabase.from('uce_students').select('*', { count: 'exact', head: true }).eq('branch_id', branchId).eq('is_active', true),
        supabase.from('uce_student_fee_payments')
          .select('amount').eq('branch_id', branchId).eq('is_adjustment', false)
          .gte('payment_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
        supabase.from('uce_support_tickets').select('*', { count: 'exact', head: true }).eq('branch_id', branchId).in('status', ['open', 'in_progress']),
        supabase.from('uce_courses').select('*', { count: 'exact', head: true }).eq('created_by_branch_id', branchId).eq('approval_status', 'pending'),
      ])
      const allStudents = await supabase.from('uce_students').select('id,net_fee').eq('branch_id', branchId)
      const studentIds = (allStudents.data ?? []).map(s => s.id)
      let paidSum = 0
      if (studentIds.length > 0) {
        const { data: pays } = await supabase.from('uce_student_fee_payments')
          .select('amount').in('student_id', studentIds).eq('is_adjustment', false)
        paidSum = (pays ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
      }
      const totalFees = (allStudents.data ?? []).reduce((s, r) => s + Number(r.net_fee || 0), 0)
      const pendingFees = Math.max(0, totalFees - paidSum)
      const collectedThisMonth = (payCol.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)

      setStats({
        students: stu.count ?? 0,
        activeStudents: active.count ?? 0,
        collectedThisMonth,
        pendingFees,
        openTickets: tickets.count ?? 0,
        pendingCourses: courses.count ?? 0,
      })
    })()
  }, [branchId])

  const walletLow = (branch?.wallet_balance ?? 0) < 500

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-text-primary">
          Welcome{branch ? `, ${branch.name}` : ''}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Code: <span className="font-medium">{branch?.code ?? '—'}</span>
          {branch?.b_code && <> · B-Code: <span className="font-medium">{branch.b_code}</span></>}
        </p>
      </div>

      {walletLow && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Wallet balance is low</p>
            <p className="text-sm text-amber-800">
              Current balance {formatINR(branch?.wallet_balance ?? 0)}. Please create a reload request.
            </p>
          </div>
          <Link to="/franchise/wallet/request" className="text-sm font-semibold text-amber-900 underline">
            Request Reload →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Wallet Balance" value={formatINR(branch?.wallet_balance ?? 0)} color="bg-red-50 text-red-700" />
        <StatCard icon={Users} label="Total Students" value={String(stats?.students ?? '—')} color="bg-blue-50 text-blue-700" />
        <StatCard icon={IndianRupee} label="Collected (this month)" value={formatINR(stats?.collectedThisMonth ?? 0)} color="bg-green-50 text-green-700" />
        <StatCard icon={AlertTriangle} label="Pending Fees" value={formatINR(stats?.pendingFees ?? 0)} color="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/franchise/students/register" className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition">
          <Users className="text-red-600 mb-2" size={22} />
          <p className="font-semibold text-text-primary">Register New Student</p>
          <p className="text-sm text-text-muted">Add a student; wallet is debited by certificate fee.</p>
        </Link>
        <Link to="/franchise/fees/collect" className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition">
          <IndianRupee className="text-red-600 mb-2" size={22} />
          <p className="font-semibold text-text-primary">Collect Fee</p>
          <p className="text-sm text-text-muted">Record a student fee payment.</p>
        </Link>
        <Link to="/franchise/jobs" className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition">
          <Briefcase className="text-red-600 mb-2" size={22} />
          <p className="font-semibold text-text-primary">Post a Job</p>
          <p className="text-sm text-text-muted">Share a job opportunity with students.</p>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoLine icon={ScrollText} label="Pending course approvals" value={stats?.pendingCourses ?? 0} />
        <InfoLine icon={AlertTriangle} label="Open support tickets" value={stats?.openTickets ?? 0} />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-heading text-xl font-bold text-text-primary">{value}</p>
    </div>
  )
}

function InfoLine({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-3">
      <Icon size={18} className="text-text-muted" />
      <span className="flex-1 text-sm text-text-secondary">{label}</span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  )
}
