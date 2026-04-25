import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Lead, LeadMessage, LeadStatus, LeadTemperature, LeadActivity } from '../types/leads'

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('uce_leads')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uce_leads' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  return { leads, loading, reload: load }
}

export function useLeadMessages(leadId: string | null) {
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) { setMessages([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('uce_lead_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: true })
    setMessages((data ?? []) as LeadMessage[])
    setLoading(false)
  }, [leadId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!leadId) return
    const ch = supabase
      .channel(`lead-msgs-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uce_lead_messages', filter: `lead_id=eq.${leadId}` }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [leadId, load])

  return { messages, loading, reload: load }
}

export function useLeadActivities(leadId: string | null) {
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) { setActivities([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('uce_lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    setActivities((data ?? []) as LeadActivity[])
    setLoading(false)
  }, [leadId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!leadId) return
    const ch = supabase
      .channel(`lead-act-${leadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uce_lead_activities', filter: `lead_id=eq.${leadId}` }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [leadId, load])

  return { activities, loading, reload: load }
}

/** Hook for today's follow-ups (used on Dashboard) */
export function useTodayFollowUps() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
    const { data } = await supabase
      .from('uce_leads')
      .select('*')
      .gte('follow_up_date', todayStart)
      .lte('follow_up_date', todayEnd)
      .order('follow_up_date', { ascending: true })
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { leads, loading, reload: load }
}

// ── Mutation helpers ──────────────────────────────────────────────────────────

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  await supabase.from('uce_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId)
}

export async function markLeadRead(leadId: string): Promise<void> {
  await supabase.from('uce_leads').update({ unread_count: 0 }).eq('id', leadId)
}

export async function setLeadTemperature(leadId: string, temperature: LeadTemperature | null): Promise<void> {
  await supabase.from('uce_leads').update({ temperature, updated_at: new Date().toISOString() }).eq('id', leadId)
}

export async function setLeadFollowUp(leadId: string, date: string | null, note: string | null): Promise<void> {
  await supabase.from('uce_leads').update({
    follow_up_date: date,
    follow_up_note: note,
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)
}

export async function assignLead(leadId: string, userId: string | null, branchId: string | null): Promise<void> {
  await supabase.from('uce_leads').update({
    assigned_to: userId,
    branch_id: branchId,
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)
}

export async function updateLeadNotes(leadId: string, notes: string): Promise<void> {
  await supabase.from('uce_leads').update({ notes, updated_at: new Date().toISOString() }).eq('id', leadId)
}

export async function logActivity(
  leadId: string,
  action: string,
  detail: string | null,
  performedByName: string | null,
): Promise<void> {
  await supabase.from('uce_lead_activities').insert({
    lead_id: leadId,
    action,
    detail,
    performed_by_name: performedByName,
  })
}

export async function createManualLead(input: Partial<Lead>): Promise<Lead | null> {
  const { data } = await supabase
    .from('uce_leads')
    .insert({
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      status: input.status || 'new',
      source: 'manual',
      course_interest: input.course_interest || null,
      branch_id: input.branch_id || null,
      assigned_to: input.assigned_to || null,
      notes: input.notes || null,
    })
    .select()
    .single()
  return (data as Lead) || null
}

export async function deleteLead(leadId: string): Promise<void> {
  await supabase.from('uce_leads').delete().eq('id', leadId)
}

export async function addStaffMessage(leadId: string, text: string, senderName: string): Promise<void> {
  const ts = new Date().toISOString()
  await supabase.from('uce_lead_messages').insert({
    lead_id: leadId,
    direction: 'outgoing',
    message_text: text,
    sender_name: senderName,
    timestamp: ts,
    metadata: { origin: 'staff-note' },
  })
  await supabase.from('uce_leads').update({
    last_message_at: ts,
    last_message_preview: text.slice(0, 140),
    updated_at: ts,
  }).eq('id', leadId)
}
