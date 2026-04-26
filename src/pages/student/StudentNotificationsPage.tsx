import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Briefcase, Megaphone, CheckCheck, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface Notification {
  id: string
  channel: string
  template: string
  payload: Record<string, unknown> | null
  status: string
  created_at: string
}

const TEMPLATE_META: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  job_alert:        { icon: Briefcase, color: 'text-red-600 bg-red-50',         label: 'New Job' },
  announcement:     { icon: Megaphone, color: 'text-blue-600 bg-blue-50',       label: 'Announcement' },
  default:          { icon: Bell,      color: 'text-gray-600 bg-gray-100',      label: 'Notice' },
}

export default function StudentNotificationsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('uce_notifications_log')
      .select('id, channel, template, payload, status, created_at')
      .eq('student_id', user.id)
      .eq('channel', 'inapp')
      .order('created_at', { ascending: false })
      .limit(100)
    setRows((data ?? []) as Notification[])
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [user?.id])

  async function markAllRead() {
    if (!user?.id) return
    await supabase.from('uce_notifications_log')
      .update({ status: 'read' })
      .eq('student_id', user.id)
      .eq('channel', 'inapp')
      .neq('status', 'read')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Notifications</h1>
        {rows.some(r => r.status !== 'read') && (
          <button onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400">
          <Bell size={28} className="mx-auto mb-2 text-gray-300" />No notifications yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(n => {
            const meta = TEMPLATE_META[n.template] || TEMPLATE_META.default
            const Icon = meta.icon
            const isUnread = n.status !== 'read'
            const payload = n.payload || {}
            const title = (payload as { title?: string }).title
            const message = (payload as { message?: string }).message
            const jobId = (payload as { job_id?: string }).job_id
            return (
              <div key={n.id}
                className={`rounded-xl border bg-white p-3 flex items-start gap-3 ${isUnread ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${meta.color}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400">{meta.label}</span>
                    {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  </div>
                  <p className="font-semibold text-gray-900 truncate mt-0.5">{title || message || meta.label}</p>
                  {message && title && <p className="text-sm text-gray-600 line-clamp-2">{message}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">{formatDateDDMMYYYY(n.created_at)}</p>
                </div>
                {jobId && n.template === 'job_alert' && (
                  <Link to="/student/jobs" className="text-xs font-semibold text-red-600 hover:underline shrink-0">
                    View →
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
