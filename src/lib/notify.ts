import { supabase } from './supabase'

interface QueueArgs {
  studentId: string
  branchId: string | null
  template: string
  payload?: Record<string, unknown>
  channels?: Array<'sms' | 'whatsapp' | 'email'>
}

/**
 * Queue a notification for a student. Currently stubbed — rows are logged
 * to uce_notifications_log with status='stubbed'. When a provider
 * (MSG91/Twilio/Gupshup) is wired, flip status handling here.
 */
export async function queueStudentNotification(args: QueueArgs): Promise<void> {
  const channels = args.channels ?? ['whatsapp', 'sms']
  const rows = channels.map(channel => ({
    student_id: args.studentId,
    branch_id: args.branchId,
    channel,
    template: args.template,
    payload: args.payload ?? {},
    status: 'stubbed' as const,
  }))
  await supabase.from('uce_notifications_log').insert(rows)
}
