import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Lead, LeadMessage, LeadStatus } from '../types/leads'

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

  // Realtime subscription — any INSERT/UPDATE/DELETE on uce_leads triggers reload
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

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<void> {
  await supabase.from('uce_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', leadId)
}

export async function markLeadRead(leadId: string): Promise<void> {
  await supabase.from('uce_leads').update({ unread_count: 0 }).eq('id', leadId)
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
