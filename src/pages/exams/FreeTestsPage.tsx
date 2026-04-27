import { useEffect, useState } from 'react'
import { FlaskConical, Users, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

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
  paper_set?: { paper_name: string }[] | null
}

export default function FreeTestsPage() {
  const [papers, setPapers] = useState<PaperSet[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'papers' | 'attempts'>('papers')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loadingAttempts, setLoadingAttempts] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => { loadPapers() }, [])
  useEffect(() => { if (activeTab === 'attempts') loadAttempts() }, [activeTab])

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

      // Get attempt counts for free test papers
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
        .select('id, name, phone, email, pursuing, score, total_marks, is_submitted, started_at, submitted_at, paper_set:uce_paper_sets(paper_name)')
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
          {/* Live free tests */}
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

          {/* Available paper sets */}
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Phone</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Paper</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{a.name}</p>
                        {a.pursuing && <p className="text-xs text-gray-500">{a.pursuing}</p>}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
