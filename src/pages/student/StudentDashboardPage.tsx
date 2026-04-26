import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  IndianRupee, FileText, Briefcase, Calendar, Video, Megaphone,
  IdCard, Award, ClipboardList, AlertCircle, CheckCircle2,
  Clock, ChevronRight, Gift, ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { useImpersonation } from '../../contexts/ImpersonationContext'
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

interface OpenWindow {
  id: string
  semester: number
  exam_session: string
  closes_at: string | null
  status: 'fill' | 'resubmit'
  review_note: string | null
}

interface ActiveAdmitCard {
  id: string
  semester: number | null
  exam_session: string | null
  created_at: string
}

export default function StudentDashboardPage() {
  const { rec, loading } = useStudentRecord()
  const { isImpersonating } = useImpersonation()
  const [totals, setTotals] = useState<{ paid: number; due: number }>({ paid: 0, due: 0 })
  const [upcomingClass, setUpcomingClass] = useState<{ class_name: string; platform: string; link: string; schedule_date: string | null; schedule_time: string | null } | null>(null)
  const [latestAnn, setLatestAnn] = useState<{ title: string; body: string; created_at: string } | null>(null)
  const [pendingExams, setPendingExams] = useState<PendingExam[]>([])
  const [recentSubmission, setRecentSubmission] = useState<RecentSubmission | null>(null)
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([])
  const [admitCards, setAdmitCards] = useState<ActiveAdmitCard[]>([])

  // Route prefix derives from the current path so the dashboard works under both
  // /student/* and the admin /admin/view-as/:studentId/* shells. Mutating actions
  // are still blocked separately by isImpersonating checks.
  const location = useLocation()
  const m = location.pathname.match(/^(\/admin\/view-as\/[^/]+)\//)
  const studentBase = m ? m[1] : '/student'

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

      // Pending tests — gated by admit card via RPC
      const { data: papers } = await supabase.rpc('student_visible_papers', { p_student_id: rec.id })

      const { data: attempts } = await supabase
        .from('uce_exam_attempts')
        .select('paper_set_id, is_submitted, submitted_at, total_marks_obtained, is_graded')
        .eq('student_id', rec.id)

      const submittedSet = new Set((attempts ?? []).filter(a => a.is_submitted).map(a => a.paper_set_id))
      const pending = ((papers ?? []) as PendingExam[]).filter(p => !submittedSet.has(p.id))
      setPendingExams(pending.slice(0, 3))

      // Open exam-form windows for this course where student hasn't submitted (or was asked to resubmit)
      const { data: windows } = await supabase
        .from('uce_exam_form_windows')
        .select('id, semester, exam_session, opens_at, closes_at')
        .eq('course_id', rec.course_id)
        .eq('is_active', true)
      const { data: myForms } = await supabase
        .from('uce_exam_forms')
        .select('id, window_id, status, review_note')
        .eq('student_id', rec.id)
      const openable: OpenWindow[] = []
      ;(windows ?? []).forEach((w: { id: string; semester: number; exam_session: string; opens_at: string | null; closes_at: string | null }) => {
        if (w.opens_at && w.opens_at > today) return
        if (w.closes_at && w.closes_at < today) return
        const sub = (myForms ?? []).find(f => f.window_id === w.id)
        if (!sub) {
          openable.push({ id: w.id, semester: w.semester, exam_session: w.exam_session, closes_at: w.closes_at, status: 'fill', review_note: null })
        } else if (sub.status === 'resubmit') {
          openable.push({ id: w.id, semester: w.semester, exam_session: w.exam_session, closes_at: w.closes_at, status: 'resubmit', review_note: sub.review_note })
        }
      })
      setOpenWindows(openable)

      // Active admit cards for this student
      const { data: cards } = await supabase
        .from('uce_admit_cards')
        .select('id, semester, exam_session, is_active, student_visible, created_at')
        .eq('student_id', rec.id)
        .order('created_at', { ascending: false })
      const visibleCards = ((cards ?? []) as { id: string; semester: number | null; exam_session: string | null; is_active: boolean | null; student_visible: boolean | null; created_at: string }[])
        .filter(c => (c.is_active ?? true) && (c.student_visible ?? true))
      setAdmitCards(visibleCards.slice(0, 1))

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

      {/* Active exam-form windows */}
      {openWindows.length > 0 && (
        <div className="space-y-2">
          {openWindows.map(w => (
            <div key={w.id} className={`rounded-2xl border p-4 sm:p-5 ${w.status === 'resubmit' ? 'border-orange-300 bg-orange-50' : 'border-yellow-300 bg-yellow-50'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full text-white flex items-center justify-center shrink-0 ${w.status === 'resubmit' ? 'bg-orange-500' : 'bg-yellow-500'}`}>
                    <ClipboardList size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900">
                      {w.status === 'resubmit' ? 'Resubmit Exam Form' : 'Fill Exam Form'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">Sem {w.semester} · Session {w.exam_session}</p>
                    {w.closes_at && <p className="text-xs text-gray-600 mt-0.5">Closes on {formatDateDDMMYYYY(w.closes_at)}</p>}
                    {w.review_note && <p className="text-xs text-orange-800 mt-1"><strong>Note:</strong> {w.review_note}</p>}
                  </div>
                </div>
                {!isImpersonating && (
                  <Link to={`${studentBase}/exam-forms/${w.id}/fill`} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${w.status === 'resubmit' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'} text-white`}>
                    {w.status === 'resubmit' ? 'Resubmit' : 'Fill Now'} <ArrowRight size={13} />
                  </Link>
                )}
                {isImpersonating && (
                  <span className="shrink-0 text-xs text-gray-500 px-2 py-1 rounded bg-gray-100">Read-only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active admit card */}
      {admitCards.length > 0 && admitCards.map(c => (
        <div key={c.id} className="rounded-2xl border border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                <IdCard size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-900">Your Admit Card is Ready</p>
                <p className="text-sm font-semibold text-blue-900 mt-0.5">
                  {rec.course?.name}{c.semester != null && ` · Sem ${c.semester}`}{c.exam_session && ` · ${c.exam_session}`}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">Issued {formatDateDDMMYYYY(c.created_at)}</p>
              </div>
            </div>
            <Link to={`${studentBase}/admit-card`} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg">
              View / Download <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      ))}

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
                to={isImpersonating ? '#' : `${studentBase}/tests/${p.id}`}
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
            <Link to={`${studentBase}/results`} className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-900 hidden sm:inline-flex items-center gap-1">
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
              <Link to={`${studentBase}/announcements`} className="inline-block mt-2 text-sm font-semibold text-red-600 hover:underline">See all →</Link>
            </>
          ) : (
            <p className="text-sm text-gray-400">No announcements yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <QuickLink to={`${studentBase}/fees`} icon={IndianRupee} label="Fees" />
        <QuickLink to={`${studentBase}/documents`} icon={IdCard} label="Documents" />
        <QuickLink to={`${studentBase}/classes`} icon={Video} label="Classes" />
        <QuickLink to={`${studentBase}/materials`} icon={FileText} label="Materials" />
        <QuickLink to={`${studentBase}/tests`} icon={ClipboardList} label="Tests" />
        <QuickLink to={`${studentBase}/exam-forms`} icon={ClipboardList} label="Exam Forms" />
        <QuickLink to={`${studentBase}/admit-card`} icon={IdCard} label="Admit Card" />
        <QuickLink to={`${studentBase}/results`} icon={Award} label="Results" />
        <QuickLink to={`${studentBase}/jobs`} icon={Briefcase} label="Jobs" />
        {!isImpersonating && <QuickLink to="/student/refer-earn" icon={Gift} label="Refer & Earn" />}
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
