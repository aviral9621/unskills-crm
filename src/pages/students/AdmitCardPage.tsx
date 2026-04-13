import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ClipboardList, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import FormField, { inputClass } from '../../components/FormField'

interface StudentData {
  id: string; registration_no: string; name: string; father_name: string
  dob: string | null; gender: string | null; photo_url: string | null
  address: string | null; district: string | null; state: string | null
  course_id: string; session: string | null; enrollment_date: string
  course?: { name: string; code: string } | null
  branch?: { name: string; address_line1: string | null; district: string; state: string; pincode: string | null; director_phone: string } | null
}

interface SubjectRow { id: string; name: string; code: string | null; selected: boolean }
interface ExamEntry { subject: string; date: string; startTime: string; endTime: string }

export default function AdmitCardPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('student') || '')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Exam details
  const [centerName, setCenterName] = useState('')
  const [centerCode, setCenterCode] = useState('')
  const [centerAddress, setCenterAddress] = useState('')
  const [examEntries, setExamEntries] = useState<ExamEntry[]>([])

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); setStudent(null); setSubjects([])
    try {
      let q = supabase.from('uce_students').select('id, registration_no, name, father_name, dob, gender, photo_url, address, district, state, course_id, session, enrollment_date, course:uce_courses(name, code), branch:uce_branches(name, address_line1, district, state, pincode, director_phone)')
      if (query.includes('-') || query.length > 10) q = q.eq('id', query)
      else q = q.ilike('registration_no', `%${query}%`)
      const { data, error } = await q.limit(1).single()
      if (error || !data) { toast.error('Student not found'); return }
      const s = data as unknown as StudentData
      setStudent(s)

      // Pre-fill center from branch
      const branch = s.branch as { name: string; address_line1: string | null; district: string; state: string; pincode: string | null; director_phone: string } | null
      if (branch) {
        setCenterName(branch.name)
        setCenterAddress(`${branch.address_line1 || ''}, ${branch.district}, ${branch.state}${branch.pincode ? ' - ' + branch.pincode : ''}`)
      }

      // Load subjects
      const { data: subs } = await supabase.from('uce_subjects').select('id, name, code').eq('course_id', s.course_id).eq('is_active', true).order('display_order')
      const subRows = (subs ?? []).map(sub => ({ ...sub, selected: true }))
      setSubjects(subRows as SubjectRow[])
      setExamEntries(subRows.map(sub => ({ subject: sub.name, date: '', startTime: '10:00', endTime: '12:00' })))
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (searchParams.get('student')) handleSearch()
  }, [])

  function updateEntry(idx: number, field: keyof ExamEntry, value: string) {
    setExamEntries(p => p.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  async function handleGenerate() {
    if (!student) return
    const selectedEntries = examEntries.filter((_, i) => subjects[i]?.selected)
    if (selectedEntries.length === 0) { toast.error('Select at least one subject'); return }
    setGenerating(true)
    try {
      const { pdf, Document, Page, View, Text, StyleSheet } = await import('@react-pdf/renderer')
      const s = StyleSheet.create({
        page: { padding: 30, fontFamily: 'Helvetica', fontSize: 10 },
        header: { textAlign: 'center', marginBottom: 15 },
        title: { fontSize: 16, fontWeight: 'bold', color: '#DC2626' },
        subtitle: { fontSize: 8, color: '#6B7280', marginTop: 2 },
        regNo: { fontSize: 9, color: '#DC2626', marginTop: 4, fontWeight: 'bold' },
        section: { marginTop: 12 },
        sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#111827', borderBottom: '1px solid #E5E7EB', paddingBottom: 4, marginBottom: 8 },
        row: { flexDirection: 'row', marginBottom: 4 },
        label: { width: 120, fontSize: 9, color: '#6B7280' },
        value: { fontSize: 9, color: '#111827', fontWeight: 'bold', flex: 1 },
        table: { marginTop: 8 },
        tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 6, borderBottom: '1px solid #E5E7EB' },
        tableRow: { flexDirection: 'row', padding: 6, borderBottom: '1px solid #F3F4F6' },
        th: { fontSize: 8, fontWeight: 'bold', color: '#374151' },
        td: { fontSize: 8, color: '#111827' },
        notes: { marginTop: 15, padding: 10, backgroundColor: '#FEF3C7', borderRadius: 4 },
        noteText: { fontSize: 7, color: '#92400E', marginBottom: 2 },
        footer: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
        sigBlock: { alignItems: 'center', width: 150 },
        sigLine: { borderBottom: '1px solid #000', width: 100, marginTop: 30 },
        sigLabel: { fontSize: 7, color: '#6B7280', marginTop: 2 },
      })

      const course = student.course as { name: string; code: string } | null

      const AdmitDoc = (
        <Document>
          <Page size="A4" style={s.page}>
            <View style={s.header}>
              <Text style={s.title}>ADMIT CARD</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>UnSkills Computer Education</Text>
              <Text style={s.subtitle}>An ISO 9001:2015 Certified Organization</Text>
              <Text style={s.regNo}>{student.registration_no}</Text>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>CANDIDATE INFORMATION</Text>
              <View style={s.row}><Text style={s.label}>Registration No:</Text><Text style={s.value}>{student.registration_no}</Text></View>
              <View style={s.row}><Text style={s.label}>Name:</Text><Text style={s.value}>{student.name}</Text></View>
              <View style={s.row}><Text style={s.label}>Father{"'"}s Name:</Text><Text style={s.value}>{student.father_name}</Text></View>
              <View style={s.row}><Text style={s.label}>Course:</Text><Text style={s.value}>{course?.name || '—'} ({course?.code || ''})</Text></View>
              <View style={s.row}><Text style={s.label}>Session:</Text><Text style={s.value}>{student.session || '—'}</Text></View>
              {student.dob && <View style={s.row}><Text style={s.label}>Date of Birth:</Text><Text style={s.value}>{formatDate(student.dob)}</Text></View>}
              {student.gender && <View style={s.row}><Text style={s.label}>Gender:</Text><Text style={s.value}>{student.gender.charAt(0).toUpperCase() + student.gender.slice(1)}</Text></View>}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>EXAMINATION SCHEDULE</Text>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 3 }]}>Subject</Text>
                  <Text style={[s.th, { flex: 2 }]}>Date</Text>
                  <Text style={[s.th, { flex: 2 }]}>Time</Text>
                </View>
                {selectedEntries.map((e, i) => (
                  <View key={i} style={s.tableRow}>
                    <Text style={[s.td, { flex: 3 }]}>{e.subject}</Text>
                    <Text style={[s.td, { flex: 2 }]}>{e.date ? formatDate(e.date) : '—'}</Text>
                    <Text style={[s.td, { flex: 2 }]}>{e.startTime} - {e.endTime}</Text>
                  </View>
                ))}
              </View>
            </View>

            {centerName && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>EXAMINATION CENTER</Text>
                <View style={s.row}><Text style={s.label}>Center Name:</Text><Text style={s.value}>{centerName}</Text></View>
                {centerCode && <View style={s.row}><Text style={s.label}>Center Code:</Text><Text style={s.value}>{centerCode}</Text></View>}
                {centerAddress && <View style={s.row}><Text style={s.label}>Address:</Text><Text style={s.value}>{centerAddress}</Text></View>}
              </View>
            )}

            <View style={s.notes}>
              {['Report 30 minutes before exam time.', 'Bring valid photo ID along with this admit card.', 'No mobile phones or electronic devices allowed.', 'Follow all examination center rules.'].map((n, i) => (
                <Text key={i} style={s.noteText}>• {n}</Text>
              ))}
            </View>

            <View style={s.footer}>
              <View style={s.sigBlock}><View style={s.sigLine} /><Text style={s.sigLabel}>Candidate Signature</Text></View>
              <View style={s.sigBlock}><View style={s.sigLine} /><Text style={s.sigLabel}>Authorized Signature</Text></View>
            </View>

            <View style={{ marginTop: 15, textAlign: 'center' }}>
              <Text style={{ fontSize: 7, color: '#9CA3AF' }}>Date of Issue: {formatDate(new Date().toISOString())}</Text>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(AdmitDoc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Admit-Card-${student.registration_no.replace('/', '-')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Admit Card downloaded!')
    } catch (err) { console.error(err); toast.error('Failed to generate admit card') }
    finally { setGenerating(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Admit Card</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Generate exam admit cards</p></div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <FormField label="Search Student" hint="Enter registration number">
          <div className="flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className={`${inputClass} flex-1`} placeholder="e.g., UCE/0001" />
            <button onClick={handleSearch} disabled={loading} className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shrink-0 flex items-center gap-1.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
            </button>
          </div>
        </FormField>
      </div>

      {student && (
        <>
          {/* Student Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center shrink-0"><span className="text-lg font-bold text-red-600">{student.name.charAt(0)}</span></div>
              <div>
                <p className="text-base font-semibold text-gray-900">{student.name}</p>
                <p className="text-xs font-mono text-gray-400">{student.registration_no} &middot; {(student.course as { name: string } | null)?.name}</p>
              </div>
            </div>

            {/* Subject selection */}
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Subjects & Exam Schedule</h3>
            <div className="space-y-2">
              {subjects.map((sub, idx) => (
                <div key={sub.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={sub.selected} onChange={() => setSubjects(p => p.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                    <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                    {sub.code && <span className="text-xs text-gray-400 font-mono">({sub.code})</span>}
                  </div>
                  {sub.selected && (
                    <div className="grid grid-cols-3 gap-2 ml-6">
                      <FormField label="Date"><input type="date" value={examEntries[idx]?.date || ''} onChange={e => updateEntry(idx, 'date', e.target.value)} className={`${inputClass} text-xs`} /></FormField>
                      <FormField label="Start"><input type="time" value={examEntries[idx]?.startTime || '10:00'} onChange={e => updateEntry(idx, 'startTime', e.target.value)} className={`${inputClass} text-xs`} /></FormField>
                      <FormField label="End"><input type="time" value={examEntries[idx]?.endTime || '12:00'} onChange={e => updateEntry(idx, 'endTime', e.target.value)} className={`${inputClass} text-xs`} /></FormField>
                    </div>
                  )}
                </div>
              ))}
              {subjects.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No subjects found for this course</p>}
            </div>
          </div>

          {/* Center details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Exam Center Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Center Name"><input value={centerName} onChange={e => setCenterName(e.target.value)} className={inputClass} /></FormField>
              <FormField label="Center Code"><input value={centerCode} onChange={e => setCenterCode(e.target.value)} className={inputClass} placeholder="e.g., UCE-EC-001" /></FormField>
            </div>
            <FormField label="Center Address"><input value={centerAddress} onChange={e => setCenterAddress(e.target.value)} className={inputClass} /></FormField>
          </div>

          {/* Generate */}
          <button onClick={handleGenerate} disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm">
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {generating ? 'Generating...' : 'Download Admit Card (PDF)'}
          </button>
        </>
      )}

      {!student && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Search for a student to generate their admit card</p>
        </div>
      )}
    </div>
  )
}
