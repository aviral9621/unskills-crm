import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IndianRupee, FileText, Briefcase, Calendar, Video, Megaphone,
  BookOpen, IdCard, Award, ClipboardList, AlertCircle, CheckCircle2,
  Clock, ChevronRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

interface PendingExam {
  id: string
  paper_name: string
  total_questions: number | null
  total_marks: number | null
  time_limit_minutes: number | null
  available_to: string | null
  is_mock_test: boolean | null
}

interface RecentSubmission {
  paper_name: string
  submitted_at: string
  total_marks_obtained: number | null
  total_marks: number | null
  is_graded: boolean
}

export default function StudentDashboardPage() {
  const { rec, loading } = useStudentRecord()
  const [totals, setTotals] = useState<{ paid: number; due: number }>({ paid: 0, due: 0 })
  const [upcomingClass, setUpcomingClass] = useState<{ class_name: string; platform: string; link: string; schedule_date: string | null; schedule_time: string | null } | null>(null)
  const [latestAnn, setLatestAnn] = useState<{ title: string; body: string; created_at: string } | null>(null)
  const [pendingExams, setPendingExams] = useState<PendingExam[]>([])
  const [recentSubmission, setRecentSubmission] = useState<RecentSubmission | null>(null)

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

      // Pending tests for this student's course (active right now, not yet submitted)
      const nowIso = new Date().toISOString()
      const { data: papers } = await supabase
        .from('uce_paper_sets')
        .select('id, paper_name, total_questions, total_marks, time_limit_minutes, available_from, available_to, is_mock_test')
        .eq('course_id', rec.course_id)
        .eq('is_active', true)
        .or(`available_from.is.null,available_from.lte.${nowIso}`)
        .or(`available_to.is.null,available_to.gte.${nowIso}`)
        .order('available_to', { ascending: true })

      const { data: attempts } = await supabase
        .from('uce_exam_attempts')
        .select('paper_set_id, is_submitted, submitted_at, total_marks_obtained, is_graded')
        .eq('student_id', rec.id)

      const submittedSet = new Set((attempts ?? []).filter(a => a.is_submitted).map(a => a.paper_set_id))
      const pending = ((papers ?? []) as PendingExam[]).filter(p => !submittedSet.has(p.id))
      setPendingExams(pending.slice(0, 3))

      // Most recent submission (last 7 days) for "submitted" toast banner
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: latestSub } = await supabase
        .from('uce_exam_attempts')
        .select('submitted_at, total_marks_obtained, is_graded, paper_set:uce_paper_sets(paper_name, total_marks)')
        .eq('student_id', rec.id)
        .eq('is_submitted', true)
        .gte('submitted_at', sevenDaysAgo)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latestSub) {
        const raw = latestSub as unknown as {
          submitted_at: string
          total_marks_obtained: number | null
          is_graded: boolean | null
          paper_set: { paper_name: string; total_marks: number | null } | { paper_name: string; total_marks: number | null }[] | null
        }
        const ps = Array.isArray(raw.paper_set) ? raw.paper_set[0] : raw.paper_set
        setRecentSubmission({
          paper_name: ps?.paper_name ?? 'Test',
          submitted_at: raw.submitted_at,
          total_marks_obtained: raw.total_marks_obtained,
          total_marks: ps?.total_marks ?? null,
          is_graded: !!raw.is_graded,
        })
      }
    })()
  }, [rec])

  function formatDeadline(iso: string | null): string {
    if (!iso) return 'Open'
    const d = new Date(iso)
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function timeLeft(iso: string | null): string {
    if (!iso) return ''
    const ms = new Date(iso).getTime() - Date.now()
    if (ms <= 0) return 'Closing now'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days  = Math.floor(hours / 24)
    if (days >= 1) return `${days}d left`
    if (hours >= 1) return `${hours}h left`
    return `${Math.max(1, Math.floor(ms / (1000 * 60)))}m left`
  }

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

      {/* Pending exam alert (top priority) */}
      {pendingExams.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
              <AlertCircle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wider">
                {pendingExams.length === 1 ? 'You have an exam to take' : `You have ${pendingExams.length} exams to take`}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">Don't miss the submission deadline.</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {pendingExams.map(p => (
              <Link
                key={p.id}
                to={`/student/tests/${p.id}`}
                className="flex items-center gap-3 bg-white border border-amber-200 rounded-xl p-3 hover:border-amber-400 hover:shadow-sm transition-all group"
              >
                <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <ClipboardList size={16} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {p.paper_name}
                    {p.is_mock_test && <span className="ml-1.5 text-[10px] font-bold text-blue-600 uppercase">Mock</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                    {p.total_questions && <span>{p.total_questions} Qs</span>}
                    {p.total_marks && <span>· {p.total_marks} marks</span>}
                    {p.time_limit_minutes && (
                      <span className="flex items-center gap-0.5"><Clock size={10} /> {p.time_limit_minutes}m</span>
                    )}
                  </div>
                  {p.available_to && (
                    <p className="text-[11px] text-amber-700 font-semibold mt-1">
                      Last date: {formatDeadline(p.available_to)} · {timeLeft(p.available_to)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 group-hover:bg-amber-600 text-white text-xs font-bold rounded-lg">
                  Start <ChevronRight size={13} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent submission confirmation */}
      {recentSubmission && (
        <div className="rounded-2xl border border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-green-900 uppercase tracking-wider">Exam Submitted Successfully</p>
              <p className="text-sm text-green-800 mt-1 font-semibold">{recentSubmission.paper_name}</p>
              <p className="text-xs text-green-700 mt-0.5">
                Submitted on {formatDeadline(recentSubmission.submitted_at)}
                {recentSubmission.is_graded && recentSubmission.total_marks != null && (
                  <> · Score: <strong>{recentSubmission.total_marks_obtained ?? 0} / {recentSubmission.total_marks}</strong></>
                )}
                {!recentSubmission.is_graded && <> · Awaiting grading</>}
              </p>
            </div>
            <Link to="/student/results" className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-900 hidden sm:inline-flex items-center gap-1">
              View results <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}

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
