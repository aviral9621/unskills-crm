import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, CreditCard, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import FormField, { inputClass } from '../../components/FormField'

interface StudentData {
  id: string; registration_no: string; name: string; father_name: string
  dob: string | null; photo_url: string | null; phone: string; enrollment_date: string
  course?: { name: string } | null; branch?: { name: string; district: string; state: string } | null
  session: string | null
}

export default function StudentIdCardPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('student') || '')
  const [student, setStudent] = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true); setStudent(null)
    try {
      // Search by ID or registration number
      let q = supabase.from('uce_students').select('id, registration_no, name, father_name, dob, photo_url, phone, enrollment_date, session, course:uce_courses(name), branch:uce_branches(name, district, state)')
      if (query.includes('-') || query.length > 10) q = q.eq('id', query)
      else q = q.ilike('registration_no', `%${query}%`)
      const { data, error } = await q.limit(1).single()
      if (error || !data) { toast.error('Student not found'); return }
      setStudent(data as unknown as StudentData)
    } catch { toast.error('Search failed') }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    if (!student) return
    setGenerating(true)
    try {
      // Dynamic import @react-pdf/renderer
      const { pdf, Document, Page, View, Text, Image, StyleSheet } = await import('@react-pdf/renderer')
      const styles = StyleSheet.create({
        page: { width: 243, height: 153, padding: 0, fontFamily: 'Helvetica' }, // ~85x54mm
        header: { backgroundColor: '#DC2626', padding: 8, paddingBottom: 6 },
        headerText: { color: 'white', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
        headerSub: { color: '#FCA5A5', fontSize: 6, textAlign: 'center', marginTop: 1 },
        body: { padding: 8, flexDirection: 'row', gap: 8, flex: 1 },
        photo: { width: 50, height: 50, borderRadius: 4, border: '1px solid #E5E7EB', objectFit: 'cover' },
        photoPlaceholder: { width: 50, height: 50, borderRadius: 4, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
        info: { flex: 1, gap: 2 },
        label: { fontSize: 5, color: '#9CA3AF' },
        value: { fontSize: 7, color: '#111827', fontWeight: 'bold' },
        footer: { backgroundColor: '#F9FAFB', padding: 6, borderTop: '1px solid #E5E7EB' },
        footerText: { fontSize: 5, color: '#6B7280', textAlign: 'center' },
      })

      const course = student.course as { name: string } | null
      const branch = student.branch as { name: string; district: string; state: string } | null

      const IdCardDoc = (
        <Document>
          {/* Front */}
          <Page size={[243, 153]} style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.headerText}>UnSkills Computer Education</Text>
              <Text style={styles.headerSub}>{student.registration_no}</Text>
            </View>
            <View style={styles.body}>
              {student.photo_url ? (
                <Image src={student.photo_url} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}><Text style={{ fontSize: 16, color: '#DC2626' }}>{student.name.charAt(0)}</Text></View>
              )}
              <View style={styles.info}>
                <View><Text style={styles.label}>Name</Text><Text style={styles.value}>{student.name}</Text></View>
                <View><Text style={styles.label}>Father</Text><Text style={styles.value}>{student.father_name}</Text></View>
                <View><Text style={styles.label}>Course</Text><Text style={styles.value}>{course?.name || '—'}</Text></View>
                <View><Text style={styles.label}>Session</Text><Text style={styles.value}>{student.session || '—'}</Text></View>
                <View><Text style={styles.label}>Branch</Text><Text style={styles.value}>{branch?.name || '—'}</Text></View>
              </View>
            </View>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Valid from: {formatDate(student.enrollment_date)}</Text>
            </View>
          </Page>
          {/* Back */}
          <Page size={[243, 153]} style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.headerText}>TERMS & CONDITIONS</Text>
            </View>
            <View style={{ padding: 8, gap: 3, flex: 1 }}>
              {['This card is official ID of UCE.', 'Must be carried at all times.', 'Non-transferable.', 'Report loss immediately.', 'Valid throughout course period.'].map((t, i) => (
                <Text key={i} style={{ fontSize: 6, color: '#374151' }}>{i + 1}. {t}</Text>
              ))}
            </View>
            <View style={{ padding: 8, borderTop: '1px solid #E5E7EB' }}>
              <Text style={{ fontSize: 6, color: '#6B7280' }}>{branch?.name || 'UnSkills Education'}</Text>
              <Text style={{ fontSize: 5, color: '#9CA3AF' }}>{branch ? `${branch.district}, ${branch.state}` : ''}</Text>
              <Text style={{ fontSize: 5, color: '#9CA3AF', marginTop: 2 }}>www.unskillseducation.org</Text>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(IdCardDoc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `ID-Card-${student.registration_no.replace('/', '-')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('ID Card downloaded!')
    } catch (err) { console.error(err); toast.error('Failed to generate ID card') }
    finally { setGenerating(false) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Student ID Card</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Search student and generate ID card</p></div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <FormField label="Search Student" hint="Enter registration number or student ID">
          <div className="flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className={`${inputClass} flex-1`} placeholder="e.g., UCE/0001" />
            <button onClick={handleSearch} disabled={loading} className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shrink-0 flex items-center gap-1.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
            </button>
          </div>
        </FormField>
      </div>

      {student && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            {student.photo_url ? (
              <img src={student.photo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center"><span className="text-xl font-bold text-red-600">{student.name.charAt(0)}</span></div>
            )}
            <div>
              <p className="text-base font-semibold text-gray-900">{student.name}</p>
              <p className="text-xs font-mono text-gray-400">{student.registration_no}</p>
              <p className="text-xs text-gray-500">{(student.course as { name: string } | null)?.name || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-400 uppercase">Father</p><p className="text-sm font-medium text-gray-800">{student.father_name}</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-400 uppercase">Phone</p><p className="text-sm font-medium text-gray-800">{student.phone}</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-400 uppercase">DOB</p><p className="text-sm font-medium text-gray-800">{student.dob ? formatDate(student.dob) : '—'}</p></div>
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-400 uppercase">Enrolled</p><p className="text-sm font-medium text-gray-800">{formatDate(student.enrollment_date)}</p></div>
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm">
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {generating ? 'Generating...' : 'Download ID Card (PDF)'}
          </button>
        </div>
      )}

      {!student && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Search for a student to generate their ID card</p>
        </div>
      )}
    </div>
  )
}
