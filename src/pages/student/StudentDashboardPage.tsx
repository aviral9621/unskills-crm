import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IndianRupee, FileText, Briefcase, Calendar, Video, Megaphone,
  BookOpen, IdCard, Award, ClipboardList,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

export default function StudentDashboardPage() {
  const { rec, loading } = useStudentRecord()
  const [totals, setTotals] = useState<{ paid: number; due: number }>({ paid: 0, due: 0 })
  const [upcomingClass, setUpcomingClass] = useState<{ class_name: string; platform: string; link: string; schedule_date: string | null; schedule_time: string | null } | null>(null)
  const [latestAnn, setLatestAnn] = useState<{ title: string; body: string; created_at: string } | null>(null)

  useEffect(() => {
    if (!rec) return
    ;(async () => {
      const { data: pays } = await supabase
        .from('uce_student_fee_payments')
        .select('amount,is_adjustment,status')
        .eq('student_id', rec.id)
      const paid = (pays ?? [])
        .filter(p => !p.is_adjustment && p.status === 'confirmed')
        .reduce((s, p) => s + Number(p.amount), 0)
      setTotals({ paid, due: Math.max(0, Number(rec.net_fee) - paid) })

      const today = new Date().toISOString().slice(0, 10)
      const { data: cls } = await supabase
        .from('uce_online_classes')
        .select('class_name,platform,link,schedule_date,schedule_time,is_recording')
        .eq('course_id', rec.course_id)
        .eq('is_active', true)
        .eq('is_recording', false)
        .gte('schedule_date', today)
        .order('schedule_date', { ascending: true })
        .order('schedule_time', { ascending: true })
        .limit(1)
      setUpcomingClass((cls?.[0] as typeof upcomingClass) ?? null)

      // Latest announcement in any scope that applies
      const { data: anns } = await supabase
        .from('uce_announcements')
        .select('title,body,target,target_id,branch_id,created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30)
      const match = (anns ?? []).find(a => {
        if (a.target === 'all') return true
        if (a.target === 'branch') return a.branch_id === rec.branch_id
        if (a.target === 'course') return a.target_id === rec.course_id
        if (a.target === 'student') return a.target_id === rec.id
        return false
      })
      setLatestAnn(match as typeof latestAnn)
    })()
  }, [rec])

  if (loading || !rec) {
    return <div className="space-y-4"><div className="skeleton h-32 rounded-2xl" /><div className="grid sm:grid-cols-3 gap-3"><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-24 rounded-xl" /></div></div>
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white p-5 sm:p-6">
        <p className="text-sm opacity-90">Welcome back</p>
        <h1 className="text-xl sm:text-2xl font-bold font-heading break-words">{rec.name}</h1>
        <p className="text-xs sm:text-sm opacity-90 mt-1 break-words">
          <span className="font-mono">{rec.registration_no}</span>
          {rec.course?.name && <> · {rec.course.name}</>}
          {rec.branch?.name && <> · {rec.branch.name}</>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Total Fee" value={formatINR(rec.net_fee)} tone="blue" />
        <Stat label="Paid" value={formatINR(totals.paid)} tone="green" />
        <Stat label="Due" value={formatINR(totals.due)} tone="red" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-text-muted mb-2 flex items-center gap-1.5">
            <Calendar size={14} /> Upcoming Live Class
          </p>
          {upcomingClass ? (
            <>
              <p className="font-semibold text-text-primary break-words">{upcomingClass.class_name}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{upcomingClass.platform.replace('_', ' ')} · {upcomingClass.schedule_date && formatDateDDMMYYYY(upcomingClass.schedule_date)} {upcomingClass.schedule_time && upcomingClass.schedule_time.slice(0, 5)}</p>
              <a href={upcomingClass.link} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm font-semibold text-red-600 hover:underline">Join class →</a>
            </>
          ) : (
            <p className="text-sm text-gray-400">No upcoming classes scheduled.</p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold uppercase text-text-muted mb-2 flex items-center gap-1.5">
            <Megaphone size={14} /> Latest Announcement
          </p>
          {latestAnn ? (
            <>
              <p className="font-semibold text-text-primary">{latestAnn.title}</p>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{latestAnn.body}</p>
              <Link to="/student/announcements" className="inline-block mt-2 text-sm font-semibold text-red-600 hover:underline">See all →</Link>
            </>
          ) : (
            <p className="text-sm text-gray-400">No announcements yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <QuickLink to="/student/fees" icon={IndianRupee} label="Fees" />
        <QuickLink to="/student/documents" icon={IdCard} label="Documents" />
        <QuickLink to="/student/classes" icon={Video} label="Classes" />
        <QuickLink to="/student/materials" icon={FileText} label="Materials" />
        <QuickLink to="/student/tests" icon={ClipboardList} label="Tests" />
        <QuickLink to="/student/syllabus" icon={BookOpen} label="Syllabus" />
        <QuickLink to="/student/results" icon={Award} label="Results" />
        <QuickLink to="/student/jobs" icon={Briefcase} label="Jobs" />
      </div>

      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center">
        <p className="text-sm font-semibold text-gray-700">Attendance</p>
        <p className="text-xs text-gray-500 mt-1">Attendance tracking via biometric machine — coming soon.</p>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'red' }) {
  const c = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  return (
    <div className={`rounded-xl p-3 sm:p-4 ${c}`}>
      <p className="text-[10px] sm:text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 font-heading text-base sm:text-lg font-bold break-words">{value}</p>
    </div>
  )
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <Link to={to} className="rounded-xl border bg-white p-3 sm:p-4 hover:shadow-md transition text-center">
      <Icon size={20} className="text-red-600 mx-auto mb-1.5" />
      <p className="text-xs sm:text-sm font-semibold text-text-primary">{label}</p>
    </Link>
  )
}
