import { useEffect, useState } from 'react'
import {
  FlaskConical, Users, Eye, EyeOff, MoreVertical, UserPlus, X,
  Phone, Mail, GraduationCap, Calendar, Trophy, ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { createManualLead } from '../../hooks/useLeads'
import Modal from '../../components/Modal'

interface PaperSet {
  id: string
  paper_name: string
  category: string | null
  total_questions: number
  time_limit_minutes: number
  marks_per_question: number | null
  total_marks: number | null
  is_active: boolean
  is_free_test: boolean
  attempt_count?: number
}

interface Attempt {
  id: string
  name: string
  phone: string
  email: string | null
  pursuing: string | null
  score: number
  total_marks: number
  is_submitted: boolean
  started_at: string
  submitted_at: string | null
  lead_id: string | null
  paper_set?: { paper_name: string }[] | null
}

export default function FreeTestsPage() {
  const [papers, setPapers] = useState<PaperSet[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'papers' | 'attempts'>('papers')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loadingAttempts, setLoadingAttempts] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState<Attempt | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  useEffect(() => { loadPapers() }, [])
  useEffect(() => { if (activeTab === 'attempts') loadAttempts() }, [activeTab])
  useEffect(() => {
    function close() { setMenuOpen(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  async function loadPapers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('uce_paper_sets')
        .select('id, paper_name, category, total_questions, time_limit_minutes, marks_per_question, total_marks, is_active, is_free_test')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error

      const ps = (data ?? []) as PaperSet[]

      const freeIds = ps.filter(p => p.is_free_test).map(p => p.id)
      if (freeIds.length > 0) {
        const { data: counts } = await supabase
          .from('uce_free_test_attempts')
          .select('paper_set_id')
          .in('paper_set_id', freeIds)
        const countMap: Record<string, number> = {}
        ;(counts ?? []).forEach((r: { paper_set_id: string }) => {
          countMap[r.paper_set_id] = (countMap[r.paper_set_id] || 0) + 1
        })
        ps.forEach(p => { p.attempt_count = countMap[p.id] ?? 0 })
      }

      setPapers(ps)
    } catch { toast.error('Failed to load paper sets') }
    finally { setLoading(false) }
  }

  async function loadAttempts() {
    setLoadingAttempts(true)
    try {
      const { data, error } = await supabase
        .from('uce_free_test_attempts')
        .select('id, name, phone, email, pursuing, score, total_marks, is_submitted, started_at, submitted_at, lead_id, paper_set:uce_paper_sets(paper_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setAttempts((data ?? []) as Attempt[])
    } catch { toast.error('Failed to load attempts') }
    finally { setLoadingAttempts(false) }
  }

  async function toggleFreeTest(paper: PaperSet) {
    setToggling(paper.id)
    try {
      const { error } = await supabase
        .from('uce_paper_sets')
        .update({ is_free_test: !paper.is_free_test })
        .eq('id', paper.id)
      if (error) throw error
      setPapers(prev => prev.map(p => p.id === paper.id ? { ...p, is_free_test: !p.is_free_test, attempt_count: p.attempt_count ?? 0 } : p))
      toast.success(paper.is_free_test ? 'Removed from free tests' : 'Added to free tests — now live on website')
    } catch { toast.error('Failed to update') }
    finally { setToggling(null) }
  }

  async function convertToLead(a: Attempt) {
    if (a.lead_id) { toast.info('This submission is already a lead'); return }
    if (!a.name?.trim() || !a.phone?.trim()) { toast.error('Submission missing name or phone'); return }
    setConverting(a.id)
    try {
      // Reuse existing lead by phone if present so WhatsApp threads stay unified.
      const { data: existing } = await supabase
        .from('uce_leads')
        .select('id, name')
        .eq('phone', a.phone.trim())
        .limit(1)
        .maybeSingle()

      let leadId: string
      if (existing?.id) {
        leadId = existing.id
        toast.success(`Linked to existing lead: ${existing.name}`)
      } else {
        const paperName = a.paper_set?.[0]?.paper_name ?? 'Free Test'
        const noteParts = [
          `Submitted free online test "${paperName}".`,
          a.is_submitted ? `Score: ${a.score}/${a.total_marks}` : 'Test in progress',
          a.pursuing ? `Pursuing: ${a.pursuing}` : null,
        ].filter(Boolean)
        const lead = await createManualLead({
          name: a.name.trim(),
          phone: a.phone.trim(),
          email: a.email?.trim() || null,
          status: 'new',
          notes: noteParts.join(' · '),
        })
        if (!lead) throw new Error('Insert failed')
        leadId = lead.id
        // Stamp source so we can distinguish later — createManualLead defaults to 'manual'.
        await supabase.from('uce_leads').update({ source: 'free_test' }).eq('id', leadId)
        toast.success('Converted to lead — open Leads to start WhatsApp follow-up')
      }

      const { error: linkErr } = await supabase
        .from('uce_free_test_attempts')
        .update({ lead_id: leadId })
        .eq('id', a.id)
      if (linkErr) throw linkErr

      setAttempts(prev => prev.map(x => x.id === a.id ? { ...x, lead_id: leadId } : x))
    } catch (e) {
      console.error('[FreeTestsPage] convertToLead failed:', e)
      toast.error(e instanceof Error ? e.message : 'Failed to convert to lead')
    } finally { setConverting(null); setMenuOpen(null) }
  }

  const freePapers = papers.filter(p => p.is_free_test)
  const otherPapers = papers.filter(p => !p.is_free_test)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-heading flex items-center gap-2">
            <FlaskConical size={20} className="text-red-600" /> Free Online Tests
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enable any paper set as a public free test — anyone can take it without logging in.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('papers')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'papers' ? 'bg-red-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Paper Sets
          </button>
          <button
            onClick={() => setActiveTab('attempts')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'attempts' ? 'bg-red-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Submissions
          </button>
        </div>
      </div>

      {activeTab === 'papers' && (
        <>
          {freePapers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live on Website ({freePapers.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paper</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Questions</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Time</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <Users size={12} className="inline" /> Attempts
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {freePapers.map(p => (
                      <tr key={p.id} className="hover:bg-green-50/40 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{p.paper_name}</td>
                        <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{p.category || '—'}</td>
                        <td className="px-5 py-3.5 text-center text-gray-600 hidden md:table-cell">{p.total_questions}</td>
                        <td className="px-5 py-3.5 text-center text-gray-600 hidden md:table-cell">{p.time_limit_minutes} min</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <Users size={10} /> {p.attempt_count ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggleFreeTest(p)}
                            disabled={toggling === p.id}
                            className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
                          >
                            <EyeOff size={12} /> Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Available Paper Sets — click "Launch" to add to free tests
            </h2>
            {loading ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : otherPapers.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
                All active paper sets are already live as free tests.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paper</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Questions</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Time</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {otherPapers.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{p.paper_name}</td>
                        <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{p.category || '—'}</td>
                        <td className="px-5 py-3.5 text-center text-gray-600 hidden md:table-cell">{p.total_questions}</td>
                        <td className="px-5 py-3.5 text-center text-gray-600 hidden md:table-cell">{p.time_limit_minutes} min</td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggleFreeTest(p)}
                            disabled={toggling === p.id}
                            className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 border border-green-300 rounded-lg px-3 py-1.5 hover:bg-green-50 disabled:opacity-50"
                          >
                            <Eye size={12} /> Launch as Free Test
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'attempts' && (
        <div>
          {loadingAttempts ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : attempts.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <Users size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">No submissions yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Phone</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Paper</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{a.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.pursuing && <span className="text-xs text-gray-500">{a.pursuing}</span>}
                          {a.lead_id && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              ✓ LEAD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">{a.phone}</td>
                      <td className="px-5 py-3.5 text-gray-600 hidden lg:table-cell">{a.paper_set?.[0]?.paper_name || '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {a.is_submitted ? (
                          <span className="font-semibold text-gray-900">{a.score}/{a.total_marks}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">In progress</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.is_submitted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {a.is_submitted ? 'Submitted' : 'Ongoing'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs hidden lg:table-cell">
                        {new Date(a.started_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-3 py-3.5 text-right relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === a.id ? null : a.id) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                          aria-label="Open actions menu"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuOpen === a.id && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute right-2 top-9 z-30 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
                          >
                            <button
                              onClick={() => { setDetailOpen(a); setMenuOpen(null) }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                            >
                              <Eye size={14} /> View Details
                            </button>
                            {a.lead_id ? (
                              <Link
                                to={`/admin/leads?selected=${a.lead_id}`}
                                onClick={() => setMenuOpen(null)}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 text-left"
                              >
                                <ExternalLink size={14} /> Open Lead
                              </Link>
                            ) : (
                              <button
                                onClick={() => convertToLead(a)}
                                disabled={converting === a.id}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left disabled:opacity-50"
                              >
                                <UserPlus size={14} /> {converting === a.id ? 'Converting…' : 'Convert to Lead'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Submission detail modal */}
      <Modal open={!!detailOpen} onClose={() => setDetailOpen(null)} title="Submission Details" size="md">
        {detailOpen && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 p-4 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 border border-red-100">
              <div className="min-w-0">
                <p className="text-xs uppercase font-bold tracking-wider text-red-700">Candidate</p>
                <p className="font-heading text-lg font-bold text-gray-900 truncate">{detailOpen.name}</p>
                {detailOpen.lead_id && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                    ✓ LINKED TO LEAD
                  </span>
                )}
              </div>
              {detailOpen.is_submitted && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">Score</p>
                  <p className="font-heading text-xl font-bold text-gray-900 inline-flex items-center gap-1">
                    <Trophy size={16} className="text-amber-500" /> {detailOpen.score}/{detailOpen.total_marks}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailRow icon={Phone} label="Phone" value={detailOpen.phone} copyable />
              <DetailRow icon={Mail} label="Email" value={detailOpen.email || '—'} copyable={!!detailOpen.email} />
              <DetailRow icon={GraduationCap} label="Currently Pursuing" value={detailOpen.pursuing || '—'} />
              <DetailRow icon={FlaskConical} label="Paper" value={detailOpen.paper_set?.[0]?.paper_name || '—'} />
              <DetailRow icon={Calendar} label="Started" value={new Date(detailOpen.started_at).toLocaleString('en-IN')} />
              <DetailRow
                icon={Calendar}
                label="Submitted"
                value={detailOpen.submitted_at ? new Date(detailOpen.submitted_at).toLocaleString('en-IN') : 'Not submitted'}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setDetailOpen(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg inline-flex items-center gap-1.5"
              >
                <X size={14} /> Close
              </button>
              {detailOpen.lead_id ? (
                <Link
                  to={`/admin/leads?selected=${detailOpen.lead_id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                >
                  <ExternalLink size={14} /> Open Lead
                </Link>
              ) : (
                <button
                  onClick={() => convertToLead(detailOpen)}
                  disabled={converting === detailOpen.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <UserPlus size={14} /> {converting === detailOpen.id ? 'Converting…' : 'Convert to Lead'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DetailRow({
  icon: Icon, label, value, copyable = false,
}: {
  icon: React.ElementType; label: string; value: string; copyable?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 inline-flex items-center gap-1">
        <Icon size={10} /> {label}
      </p>
      <p className="text-sm text-gray-900 mt-0.5 break-words">
        {copyable && value !== '—' ? (
          <button
            onClick={() => { navigator.clipboard?.writeText(value); toast.success('Copied') }}
            className="hover:text-red-600 hover:underline text-left"
            title="Click to copy"
          >
            {value}
          </button>
        ) : value}
      </p>
    </div>
  )
}
