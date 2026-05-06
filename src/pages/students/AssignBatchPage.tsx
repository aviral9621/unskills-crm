import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, UserPlus, AlertTriangle, GraduationCap, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Batch {
  id: string; name: string; max_students: number | null;
  start_time: string | null; end_time: string | null;
  teacher: { name: string } | null;
}
interface Student {
  id: string; name: string; registration_no: string; phone: string;
  batch_id: string | null; batch?: { name: string } | null;
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  const ap = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ap}`
}

export default function AssignBatchPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [batches, setBatches] = useState<Batch[]>([])
  const [batchCounts, setBatchCounts] = useState<Record<string, number>>({})
  const [batchId, setBatchId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unassigned'>('unassigned')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    let bq = supabase.from('uce_batches')
      .select('id, name, max_students, start_time, end_time, branch_id, teacher:uce_employees!uce_batches_teacher_id_fkey(name)')
      .eq('is_active', true).order('name')
    if (!isSuperAdmin && branchId) bq = bq.or(`branch_id.eq.${branchId},branch_id.is.null`)

    let sq = supabase.from('uce_students')
      .select('id, name, registration_no, phone, batch_id, batch:uce_batches!uce_students_batch_id_fkey(name)')
      .eq('is_active', true).order('name').limit(2000)
    if (!isSuperAdmin && branchId) sq = sq.eq('branch_id', branchId)

    const [bRes, sRes, cntRes] = await Promise.all([
      bq, sq,
      supabase.from('uce_students').select('batch_id').not('batch_id', 'is', null),
    ])
    const counts: Record<string, number> = {}
    ;(cntRes.data ?? []).forEach((r: { batch_id: string | null }) => {
      if (r.batch_id) counts[r.batch_id] = (counts[r.batch_id] || 0) + 1
    })
    setBatches((bRes.data ?? []) as unknown as Batch[])
    setStudents((sRes.data ?? []) as unknown as Student[])
    setBatchCounts(counts)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let rows = students
    if (filter === 'unassigned') rows = rows.filter(s => !s.batch_id)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.registration_no.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
      )
    }
    return rows
  }, [students, search, filter])

  function togglePick(id: string) {
    setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function pickAll() {
    if (picked.size === filtered.length) setPicked(new Set())
    else setPicked(new Set(filtered.map(s => s.id)))
  }

  const selectedBatch = batches.find(b => b.id === batchId)
  const currentCount = batchCounts[batchId] || 0
  const remainingCap = selectedBatch?.max_students
    ? selectedBatch.max_students - currentCount
    : Infinity

  async function assign() {
    if (!batchId) { toast.error('Select a batch first'); return }
    if (picked.size === 0) { toast.error('Pick at least one student'); return }
    if (selectedBatch?.max_students && picked.size > remainingCap) {
      toast.error(`Cannot assign — only ${Math.max(0, remainingCap)} seat${remainingCap === 1 ? '' : 's'} left in "${selectedBatch.name}". Capacity is ${selectedBatch.max_students}.`)
      return
    }
    setSaving(true)
    const ids = Array.from(picked)
    const { error } = await supabase.from('uce_students')
      .update({ batch_id: batchId, updated_at: new Date().toISOString() })
      .in('id', ids)
    if (error) { toast.error('Assignment failed: ' + error.message); setSaving(false); return }
    toast.success(`Assigned ${ids.length} student${ids.length > 1 ? 's' : ''} to ${selectedBatch?.name}`)
    setPicked(new Set())
    setSaving(false)
    loadInitial()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Assign Batch to Students</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Bulk-assign students to a batch</p>
      </div>

      {/* Step 1: pick batch */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Target Batch *</label>
        <select value={batchId} onChange={e => { setBatchId(e.target.value); setPicked(new Set()) }}
          className="w-full sm:max-w-md px-3 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
          <option value="">Choose a batch…</option>
          {batches.map(b => {
            const used = batchCounts[b.id] || 0
            const cap = b.max_students || 0
            const full = cap > 0 && used >= cap
            const seats = cap > 0 ? ` — ${used}/${cap}${full ? ' FULL' : ''}` : ''
            return <option key={b.id} value={b.id} disabled={full}>{b.name}{seats}</option>
          })}
        </select>

        {selectedBatch && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
            {selectedBatch.teacher?.name && (
              <span className="inline-flex items-center gap-1"><GraduationCap size={12} className="text-red-500" /> {selectedBatch.teacher.name}</span>
            )}
            {(selectedBatch.start_time || selectedBatch.end_time) && (
              <span className="inline-flex items-center gap-1"><Clock size={12} /> {fmtTime(selectedBatch.start_time)} – {fmtTime(selectedBatch.end_time)}</span>
            )}
            {selectedBatch.max_students && (
              <span className={`inline-flex items-center gap-1 font-semibold ${remainingCap <= 0 ? 'text-red-600' : 'text-green-700'}`}>
                {remainingCap > 0 ? `${remainingCap} seat${remainingCap === 1 ? '' : 's'} left` : 'No seats left'}
              </span>
            )}
          </div>
        )}
      </div>

      {batchId && (
        <>
          {/* Step 2: filter + select students */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, reg no, phone…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setFilter('unassigned')}
                className={`px-3 py-2 text-xs font-medium ${filter === 'unassigned' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Unassigned</button>
              <button onClick={() => setFilter('all')}
                className={`px-3 py-2 text-xs font-medium ${filter === 'all' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>All</button>
            </div>
            <button onClick={assign} disabled={saving || picked.size === 0}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign {picked.size > 0 ? `(${picked.size})` : ''}
            </button>
          </div>

          {selectedBatch?.max_students && picked.size > remainingCap && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                You've selected {picked.size} students but only <b>{Math.max(0, remainingCap)} seat{remainingCap === 1 ? '' : 's'}</b> left in this batch.
                Reduce your selection or increase the batch capacity.
              </div>
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-sm text-gray-400">
              {filter === 'unassigned' ? 'No unassigned students.' : 'No students match the search.'}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 w-8">
                        <input type="checkbox" checked={picked.size > 0 && picked.size === filtered.length} onChange={pickAll}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Student</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Reg No.</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Phone</th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-600">Current Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => {
                      const checked = picked.has(s.id)
                      return (
                        <tr key={s.id} onClick={() => togglePick(s.id)}
                          className={`border-b border-gray-50 cursor-pointer ${checked ? 'bg-red-50/50' : 'hover:bg-gray-50/50'}`}>
                          <td className="px-4 py-2">
                            <input type="checkbox" checked={checked} onChange={() => togglePick(s.id)}
                              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.registration_no}</td>
                          <td className="px-4 py-2 text-gray-600">{s.phone}</td>
                          <td className="px-4 py-2 text-gray-600">
                            {s.batch?.name ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                                {s.batch.name}
                              </span>
                            ) : <span className="text-amber-600 text-xs">— unassigned</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
