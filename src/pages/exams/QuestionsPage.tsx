import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Pencil, Trash2, HelpCircle, Loader2,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Languages, AlertTriangle, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import FormField, { inputClass, selectClass } from '../../components/FormField'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useBidirectionalAutoTranslate } from '../../hooks/useAutoTranslate'

interface Question {
  id: string
  paper_set_id: string
  question_text_en: string
  question_text_hi: string | null
  question_type: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: string | null
  expected_answer: string | null
  keywords: string[] | null
  topic: string | null
  explanation: string | null
  marks: number
  image_url: string | null
  difficulty: string | null
  display_order: number
  created_at: string
}

interface PaperInfo {
  id: string; paper_name: string; total_questions: number; total_marks: number | null
  course: { name: string; code: string } | null
}

type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'long_answer'
const QUESTION_TYPES: { value: QuestionType; label: string; short: string }[] = [
  { value: 'mcq',          label: 'Multiple Choice (MCQ)', short: 'MCQ' },
  { value: 'true_false',   label: 'True / False',          short: 'T/F' },
  { value: 'short_answer', label: 'Short Answer',          short: 'Short' },
  { value: 'long_answer',  label: 'Long Answer',           short: 'Long' },
]
const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard' },
]

const typeBadgeClass: Record<QuestionType, string> = {
  mcq:          'bg-blue-50 text-blue-600',
  true_false:   'bg-purple-50 text-purple-600',
  short_answer: 'bg-amber-50 text-amber-600',
  long_answer:  'bg-rose-50 text-rose-600',
}

const emptyForm = {
  question_text_en: '', question_text_hi: '', question_type: 'mcq' as QuestionType,
  option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: '', expected_answer: '', keywords: '',
  marks: '1', difficulty: 'medium', image_url: '',
  topic: '', explanation: '',
}

function isIncomplete(q: Question): { incomplete: boolean; reason: string } {
  if (q.question_type === 'mcq' || q.question_type === 'true_false') {
    if (!q.correct_answer) return { incomplete: true, reason: 'Missing correct answer' }
  }
  if (q.question_type === 'short_answer' || q.question_type === 'long_answer') {
    if (!q.expected_answer || !q.expected_answer.trim()) return { incomplete: true, reason: 'Missing expected answer' }
  }
  return { incomplete: false, reason: '' }
}

export default function QuestionsPage() {
  const { id: paperId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [paper, setPaper] = useState<PaperInfo | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'' | QuestionType>('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  // Delete
  const [delTarget, setDelTarget] = useState<Question | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { if (paperId) fetchData() }, [paperId])

  async function fetchData() {
    setLoading(true)
    try {
      const [pRes, qRes] = await Promise.all([
        supabase.from('uce_paper_sets').select('id, paper_name, total_questions, total_marks, course:uce_courses(name, code)').eq('id', paperId!).single(),
        supabase.from('uce_questions').select('*').eq('paper_set_id', paperId!).order('display_order').order('created_at'),
      ])
      if (pRes.error) throw pRes.error
      setPaper(pRes.data as unknown as PaperInfo)
      setQuestions((qRes.data ?? []) as Question[])
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm })
    setModalOpen(true)
  }

  function openEdit(q: Question) {
    setEditing(q)
    setForm({
      question_text_en: q.question_text_en,
      question_text_hi: q.question_text_hi || '',
      question_type: q.question_type as QuestionType,
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_answer: q.correct_answer || '',
      expected_answer: q.expected_answer || '',
      keywords: (q.keywords || []).join(', '),
      marks: String(q.marks),
      difficulty: (q.difficulty || 'medium').toLowerCase(),
      image_url: q.image_url || '',
      topic: q.topic || '',
      explanation: q.explanation || '',
    })
    setModalOpen(true)
  }

  function updateForm(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const { translating, notifyTyping } = useBidirectionalAutoTranslate({
    enText: form.question_text_en,
    hiText: form.question_text_hi,
    setEnText: v => setForm(prev => ({ ...prev, question_text_en: v })),
    setHiText: v => setForm(prev => ({ ...prev, question_text_hi: v })),
    enabled: modalOpen,
  })

  async function handleSave() {
    if (!form.question_text_en.trim()) { toast.error('Question text is required'); return }

    if (form.question_type === 'mcq') {
      if (!form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) {
        toast.error('All four MCQ options are required'); return
      }
      if (!form.correct_answer) { toast.error('Correct answer is required'); return }
    }
    if (form.question_type === 'true_false' && !form.correct_answer) {
      toast.error('Correct answer is required'); return
    }
    if ((form.question_type === 'short_answer' || form.question_type === 'long_answer') && !form.expected_answer.trim()) {
      toast.error('Expected / model answer is required'); return
    }

    setSaving(true)
    try {
      const isMcq = form.question_type === 'mcq'
      const isTF  = form.question_type === 'true_false'
      const isWritten = form.question_type === 'short_answer' || form.question_type === 'long_answer'

      const keywordsArr = form.keywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)

      const payload = {
        paper_set_id: paperId!,
        question_text_en: form.question_text_en.trim(),
        question_text_hi: form.question_text_hi.trim() || null,
        question_type: form.question_type,
        option_a: isMcq ? form.option_a.trim() : (isTF ? 'True'  : null),
        option_b: isMcq ? form.option_b.trim() : (isTF ? 'False' : null),
        option_c: isMcq ? form.option_c.trim() : null,
        option_d: isMcq ? form.option_d.trim() : null,
        correct_answer: (isMcq || isTF) ? form.correct_answer : null,
        expected_answer: isWritten ? form.expected_answer.trim() : null,
        keywords: isWritten ? keywordsArr : [],
        marks: parseFloat(form.marks) || 1,
        difficulty: form.difficulty ? form.difficulty.toLowerCase() : null,
        image_url: form.image_url || null,
        topic: form.topic.trim() || null,
        explanation: form.explanation.trim() || null,
        display_order: editing ? editing.display_order : questions.length,
      }

      if (editing) {
        const { error } = await supabase.from('uce_questions').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Question updated')
      } else {
        const { error } = await supabase.from('uce_questions').insert(payload)
        if (error) throw error
        toast.success('Question added')
      }
      setModalOpen(false)
      fetchData()
    } catch (e) {
      console.error(e)
      toast.error('Failed to save question')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('uce_questions').delete().eq('id', delTarget.id)
      if (error) throw error
      toast.success('Question deleted')
      setQuestions(p => p.filter(q => q.id !== delTarget.id))
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDelTarget(null) }
  }

  // Derived
  const allTopics = useMemo(() => {
    const s = new Set<string>()
    questions.forEach(q => { if (q.topic) s.add(q.topic) })
    return Array.from(s).sort()
  }, [questions])

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase()
    return questions.filter(q => {
      if (filterType && q.question_type !== filterType) return false
      if (filterTopic && (q.topic || '') !== filterTopic) return false
      if (filterDifficulty && (q.difficulty || '') !== filterDifficulty) return false
      if (showIncompleteOnly && !isIncomplete(q).incomplete) return false
      if (term) {
        const hay = [q.question_text_en, q.question_text_hi, q.topic, q.option_a, q.option_b, q.option_c, q.option_d, q.expected_answer]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [questions, filterType, filterTopic, filterDifficulty, showIncompleteOnly, search])

  const totalMarksAdded = questions.reduce((s, q) => s + Number(q.marks || 0), 0)
  const incompleteCount = questions.filter(q => isIncomplete(q).incomplete).length
  const course = paper?.course as { name: string; code: string } | null

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="skeleton h-8 w-64 rounded-lg" />
      <div className="skeleton h-20 rounded-xl" />
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={() => navigate('/admin/exams/paper-sets')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 shrink-0">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading truncate">{paper?.paper_name || 'Questions'}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{course?.name || ''} · {questions.length}/{paper?.total_questions || 0} questions</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-400">Questions</p>
            <p className="text-lg font-bold text-gray-900">{questions.length}<span className="text-sm text-gray-400 font-normal"> / {paper?.total_questions}</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Marks</p>
            <p className="text-lg font-bold text-gray-900">{totalMarksAdded}<span className="text-sm text-gray-400 font-normal"> / {paper?.total_marks || '—'}</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Needs review</p>
            <p className={`text-lg font-bold ${incompleteCount ? 'text-amber-600' : 'text-gray-900'}`}>{incompleteCount}</p>
          </div>
        </div>
        {paper?.total_questions && questions.length < paper.total_questions && (
          <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (questions.length / paper.total_questions) * 100)}%` }} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search question text, options, topic…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={filterType} onChange={e => setFilterType(e.target.value as QuestionType | '')} className={selectClass}>
            <option value="">All types</option>
            {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className={selectClass}>
            <option value="">All topics</option>
            {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className={selectClass}>
            <option value="">All levels</option>
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer text-xs text-gray-700">
            <input type="checkbox" checked={showIncompleteOnly} onChange={e => setShowIncompleteOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span>Needs review only</span>
          </label>
        </div>
      </div>

      {/* List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <HelpCircle size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">{questions.length === 0 ? 'No questions added yet' : 'No questions match the filters'}</p>
          {questions.length === 0 && (
            <button onClick={openAdd} className="mt-3 text-sm text-red-600 font-medium hover:text-red-700">+ Add first question</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredQuestions.map((q, idx) => {
            const isExpanded = expanded === q.id
            const isMCQ = q.question_type === 'mcq'
            const isTF = q.question_type === 'true_false'
            const isWritten = q.question_type === 'short_answer' || q.question_type === 'long_answer'
            const incomplete = isIncomplete(q)
            const typeMeta = QUESTION_TYPES.find(t => t.value === q.question_type)

            return (
              <div key={q.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${incomplete.incomplete ? 'border-amber-300' : 'border-gray-200'}`}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : q.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-red-50 text-red-600 text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{q.question_text_en}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadgeClass[q.question_type as QuestionType] || 'bg-gray-100 text-gray-600'}`}>
                        {typeMeta?.short || q.question_type.toUpperCase()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">{q.marks} marks</span>
                      {q.difficulty && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium capitalize">{q.difficulty}</span>}
                      {q.topic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{q.topic}</span>}
                      {incomplete.incomplete && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium inline-flex items-center gap-1">
                          <AlertTriangle size={10} /> {incomplete.reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); openEdit(q) }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Pencil size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); setDelTarget(q) }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-3">
                    {q.question_text_hi && (
                      <p className="text-sm text-gray-500 italic">{q.question_text_hi}</p>
                    )}

                    {(isMCQ || isTF) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { key: 'A', val: q.option_a },
                          { key: 'B', val: q.option_b },
                          { key: 'C', val: q.option_c },
                          { key: 'D', val: q.option_d },
                        ].filter(o => o.val).map(o => {
                          const isCorrect = q.correct_answer?.toUpperCase() === o.key
                          return (
                            <div key={o.key} className={`flex items-center gap-2 p-2.5 rounded-lg border ${isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                              {isCorrect ? <CheckCircle2 size={16} className="text-green-600 shrink-0" /> : <XCircle size={16} className="text-gray-300 shrink-0" />}
                              <span className="text-xs font-bold text-gray-400 shrink-0">{o.key}.</span>
                              <span className="text-sm text-gray-700">{o.val}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isWritten && q.expected_answer && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs text-green-700 font-medium mb-1">Expected / Model Answer</p>
                        <p className="text-sm text-green-900 whitespace-pre-wrap">{q.expected_answer}</p>
                      </div>
                    )}

                    {isWritten && q.keywords && q.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-500">Keywords:</span>
                        {q.keywords.map(k => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{k}</span>
                        ))}
                      </div>
                    )}

                    {q.explanation && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-700 font-medium mb-1">Explanation (shown in post-test review)</p>
                        <p className="text-sm text-blue-900 whitespace-pre-wrap">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Question Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Question' : 'Add Question'} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <FormField
            label="Question (English)"
            required
            hint={translating ? 'Translating…' : 'Auto-translates to/from Hindi when the other field is empty'}
          >
            <div className="relative">
              <textarea
                value={form.question_text_en}
                onChange={e => { notifyTyping('en'); updateForm('question_text_en', e.target.value) }}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Enter question text..."
              />
              {translating && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  <Languages size={11} className="animate-pulse" /> Translating
                </div>
              )}
            </div>
          </FormField>

          <FormField label="Question (Hindi)" hint="Optional — auto-fills if you type in English (and vice versa)">
            <div className="relative">
              <textarea
                value={form.question_text_hi}
                onChange={e => { notifyTyping('hi'); updateForm('question_text_hi', e.target.value) }}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="हिंदी में प्रश्न (वैकल्पिक)"
              />
              {translating && (
                <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  <Languages size={11} className="animate-pulse" /> Translating
                </div>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Question Type" required>
              <select value={form.question_type} onChange={e => updateForm('question_type', e.target.value)} className={selectClass}>
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Marks" required>
              <input type="number" value={form.marks} onChange={e => updateForm('marks', e.target.value)} className={inputClass} min={0} step="0.5" />
            </FormField>
            <FormField label="Difficulty">
              <select value={form.difficulty} onChange={e => updateForm('difficulty', e.target.value)} className={selectClass}>
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </FormField>
            <FormField label="Topic" hint="e.g. MS Word, Networking">
              <input value={form.topic} onChange={e => updateForm('topic', e.target.value)} className={inputClass} placeholder="Topic label" list="topic-suggestions" />
              <datalist id="topic-suggestions">
                {allTopics.map(t => <option key={t} value={t} />)}
              </datalist>
            </FormField>
          </div>

          {/* MCQ Options */}
          {form.question_type === 'mcq' && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700">Options</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Option A" required>
                  <input value={form.option_a} onChange={e => updateForm('option_a', e.target.value)} className={inputClass} placeholder="Option A" />
                </FormField>
                <FormField label="Option B" required>
                  <input value={form.option_b} onChange={e => updateForm('option_b', e.target.value)} className={inputClass} placeholder="Option B" />
                </FormField>
                <FormField label="Option C" required>
                  <input value={form.option_c} onChange={e => updateForm('option_c', e.target.value)} className={inputClass} placeholder="Option C" />
                </FormField>
                <FormField label="Option D" required>
                  <input value={form.option_d} onChange={e => updateForm('option_d', e.target.value)} className={inputClass} placeholder="Option D" />
                </FormField>
              </div>
              <FormField label="Correct Answer" required>
                <select value={form.correct_answer} onChange={e => updateForm('correct_answer', e.target.value)} className={selectClass}>
                  <option value="">Select correct option</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </FormField>
            </div>
          )}

          {/* True/False */}
          {form.question_type === 'true_false' && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-500">Options are auto-set: A = True, B = False</p>
              <FormField label="Correct Answer" required>
                <select value={form.correct_answer} onChange={e => updateForm('correct_answer', e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  <option value="A">A — True</option>
                  <option value="B">B — False</option>
                </select>
              </FormField>
            </div>
          )}

          {/* Short / Long answer */}
          {(form.question_type === 'short_answer' || form.question_type === 'long_answer') && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <FormField
                label="Expected / Model Answer"
                required
                hint={form.question_type === 'short_answer' ? '1–2 lines, used as reference during manual grading' : 'Multi-line model answer for grading reference'}
              >
                <textarea
                  value={form.expected_answer}
                  onChange={e => updateForm('expected_answer', e.target.value)}
                  rows={form.question_type === 'long_answer' ? 6 : 3}
                  className={`${inputClass} resize-none`}
                  placeholder="Enter the expected answer..."
                />
              </FormField>
              <FormField label="Keywords" hint="Comma-separated; helps faculty grade quickly">
                <input
                  value={form.keywords}
                  onChange={e => updateForm('keywords', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. CPU, RAM, motherboard"
                />
              </FormField>
            </div>
          )}

          <FormField label="Explanation" hint="Optional — shown to the student in the post-test review">
            <textarea
              value={form.explanation}
              onChange={e => updateForm('explanation', e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Why is this the correct answer? (optional)"
            />
          </FormField>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
          <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : editing ? 'Update' : 'Add Question'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}
        title="Delete Question?" message="This question will be permanently removed." confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
