import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, CreditCard, Download, Loader2, Printer, Settings, X, User } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { formatDate, cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { getCardSettings, idCardVerifyUrl, type CardSettings } from '../../lib/cardSettings'

interface StudentRow {
  id: string
  registration_no: string
  name: string
  father_name: string
  dob: string | null
  photo_url: string | null
  is_active: boolean
  course?: { name: string } | null
}

export default function StudentIdCardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [settings, setSettings] = useState<CardSettings | null>(null)
  const [selected, setSelected] = useState<StudentRow | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchAll() }, [])

  // Handle deep link ?student=<id>
  useEffect(() => {
    const id = searchParams.get('student')
    if (id && students.length > 0 && (!selected || selected.id !== id)) {
      const s = students.find(x => x.id === id)
      if (s) setSelected(s)
    }
  }, [searchParams, students])

  // Generate QR whenever selected / settings change
  useEffect(() => {
    if (!selected || !settings) { setQrDataUrl(''); return }
    const url = idCardVerifyUrl(settings.verify_base_url, selected.registration_no)
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [selected, settings])

  async function fetchAll() {
    setLoading(true)
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        (async () => {
          let q = supabase.from('uce_students')
            .select('id, registration_no, name, father_name, dob, photo_url, is_active, course:uce_courses(name)')
            .eq('is_active', true)
          if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
          return q.order('name')
        })(),
        getCardSettings(),
      ])
      if (studentsRes.error) throw studentsRes.error
      setStudents((studentsRes.data ?? []) as unknown as StudentRow[])
      setSettings(settingsRes)
    } catch { toast.error('Failed to load students') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.registration_no.toLowerCase().includes(q) ||
      s.father_name?.toLowerCase().includes(q)
    )
  }, [students, search])

  function pickStudent(s: StudentRow) {
    setSelected(s)
    setSearchParams({ student: s.id }, { replace: true })
  }

  /** Print only the card element (CSS print isolation happens in index.css) */
  function handlePrint() {
    if (!selected) return
    document.body.classList.add('printing-id-card')
    // next tick so the class is applied
    setTimeout(() => {
      window.print()
      // cleanup after print dialog closes
      setTimeout(() => document.body.classList.remove('printing-id-card'), 200)
    }, 50)
  }

  async function handleDownloadPdf() {
    if (!selected || !settings) return
    setGenerating(true)
    try {
      const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

      // ID card portrait — 85.6mm x 135mm (custom taller ID) at 72dpi ≈ 243 x 383 pt
      // We use 240 x 380 for clean numbers
      const W = 240, H = 380
      const course = (selected.course as { name: string } | null)?.name || '—'

      // Embed logo as base64 data URL for @react-pdf reliability
      const logoUrl = await toDataUrl('/MAIN LOGO FOR ALL CARDS.png').catch(() => null)

      const styles = StyleSheet.create({
        page:       { width: W, height: H, fontFamily: 'Helvetica' },
        // Header black band with red overlay (we fake the angle using two stacked rects)
        headerWrap: { position: 'relative', height: 62, backgroundColor: '#111111' },
        headerRed:  { position: 'absolute', top: 0, left: 0, right: 52, bottom: 0, backgroundColor: '#B91C1C' },
        headerInner:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
        headerText: { flex: 1, paddingRight: 6 },
        headerTitle:{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.2 },
        headerSub:  { color: '#FFFFFF', fontSize: 5.5, marginTop: 2, lineHeight: 1.35 },
        logo:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', padding: 2 },

        body:       { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
        photoWrap:  { alignItems: 'center', marginTop: 4, marginBottom: 8 },
        photo:      { width: 96, height: 96, objectFit: 'cover', borderRadius: 6, border: '2px solid #E5E7EB' },
        photoPh:    { width: 96, height: 96, borderRadius: 6, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
        nameRow:    { alignItems: 'center', marginBottom: 10 },
        name:       { color: '#B91C1C', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },

        infoRow:    { flexDirection: 'row', marginBottom: 5 },
        infoLabel:  { width: 78, fontSize: 8.5, color: '#111827' },
        infoSep:    { width: 8, fontSize: 8.5, color: '#111827' },
        infoValue:  { flex: 1, fontSize: 8.5, color: '#111827', fontWeight: 'bold' },

        qrWrap:     { position: 'absolute', left: 14, bottom: 74, width: 62, height: 62 },
        qr:         { width: 62, height: 62 },

        footerWrap: { backgroundColor: '#111111', paddingHorizontal: 10, paddingVertical: 7 },
        footerRed:  { position: 'absolute', top: -6, left: 0, right: 0, height: 6, backgroundColor: '#B91C1C' },
        ftLine:     { color: '#FFFFFF', fontSize: 6.5, textAlign: 'center', marginBottom: 1.5, lineHeight: 1.35 },
        ftBold:     { fontWeight: 'bold' },
      })

      const IdDoc = (
        <Document>
          <Page size={[W, H]} style={styles.page}>
            <View style={styles.headerWrap}>
              <View style={styles.headerRed} />
              <View style={styles.headerInner}>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>{settings.header_title}</Text>
                  <Text style={styles.headerSub}>{settings.header_subtitle}</Text>
                </View>
                {logoUrl && <PdfImage src={logoUrl} style={styles.logo} />}
              </View>
            </View>

            <View style={styles.body}>
              <View style={styles.photoWrap}>
                {selected.photo_url
                  ? <PdfImage src={selected.photo_url} style={styles.photo} />
                  : <View style={styles.photoPh}><Text style={{ fontSize: 32, color: '#9CA3AF' }}>{selected.name.charAt(0).toUpperCase()}</Text></View>
                }
              </View>

              <View style={styles.nameRow}>
                <Text style={styles.name}>{selected.name.toUpperCase()}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Registration No.</Text>
                <Text style={styles.infoSep}>:</Text>
                <Text style={styles.infoValue}>{selected.registration_no}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Father&apos;s Name</Text>
                <Text style={styles.infoSep}>:</Text>
                <Text style={styles.infoValue}>{(selected.father_name || '—').toUpperCase()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>D.O.B.</Text>
                <Text style={styles.infoSep}>:</Text>
                <Text style={styles.infoValue}>{selected.dob ? formatDate(selected.dob) : '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Course</Text>
                <Text style={styles.infoSep}>:</Text>
                <Text style={styles.infoValue}>{course}</Text>
              </View>
            </View>

            {qrDataUrl && (
              <View style={styles.qrWrap}>
                <PdfImage src={qrDataUrl} style={styles.qr} />
              </View>
            )}

            <View style={styles.footerWrap}>
              <View style={styles.footerRed} />
              <Text style={styles.ftLine}><Text style={styles.ftBold}>Director</Text> – {settings.director_name}</Text>
              <Text style={styles.ftLine}><Text style={styles.ftBold}>Address</Text> – {settings.address}</Text>
              <Text style={styles.ftLine}><Text style={styles.ftBold}>Phone:</Text> {settings.phone}</Text>
              <Text style={styles.ftLine}><Text style={styles.ftBold}>Website:</Text> {settings.website}</Text>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(IdDoc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `ID-Card-${selected.registration_no.replace(/\//g, '-')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('ID Card downloaded')
    } catch (e) { console.error(e); toast.error('Failed to generate PDF') }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Student ID Card</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Pick a student to generate their ID card</p>
        </div>
        <button onClick={() => navigate('/admin/students/id-card-settings')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Settings size={14} /> Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,360px)] gap-4">
        {/* Left: student picker */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 space-y-3 min-h-[420px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, reg no, father's name…"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <User size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No students found</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 -mx-1">
              {filtered.map(s => (
                <button key={s.id} onClick={() => pickStudent(s)}
                  className={cn('w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-gray-50',
                    selected?.id === s.id && 'bg-red-50 ring-1 ring-red-200')}>
                  {s.photo_url
                    ? <img src={s.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    : <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-red-600">{s.name.charAt(0).toUpperCase()}</span></div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-[11px] font-mono text-gray-400">{s.registration_no}</p>
                  </div>
                  <span className="text-[11px] text-gray-500 truncate max-w-[100px]">{(s.course as { name: string } | null)?.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: preview + actions */}
        <div className="space-y-3">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Select a student to preview their ID card</p>
            </div>
          ) : !settings ? null : (
            <>
              <div ref={printRef} id="id-card-print-area" className="mx-auto">
                <IdCardPreview student={selected} settings={settings} qrDataUrl={qrDataUrl} />
              </div>

              <div className="grid grid-cols-2 gap-2 no-print">
                <button onClick={handlePrint}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Printer size={16} /> Print
                </button>
                <button onClick={handleDownloadPdf} disabled={generating}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {generating ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── On-screen card preview (and the same element is what prints) ─── */
function IdCardPreview({ student, settings, qrDataUrl }: { student: StudentRow; settings: CardSettings; qrDataUrl: string }) {
  const course = (student.course as { name: string } | null)?.name || '—'
  return (
    <div className="id-card-root bg-white mx-auto rounded-xl overflow-hidden shadow-lg"
      style={{ width: 340, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {/* Header */}
      <div className="relative bg-black" style={{ height: 88 }}>
        <div className="absolute inset-y-0 left-0 right-[72px] bg-[#B91C1C]" style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)' }} />
        <div className="relative h-full flex items-center px-3 gap-2">
          <div className="flex-1 pr-1">
            <p className="text-white text-[15px] font-bold leading-tight">{settings.header_title}</p>
            <p className="text-white/90 text-[8px] leading-snug mt-1">{settings.header_subtitle}</p>
          </div>
          <img src="/MAIN LOGO FOR ALL CARDS.png" alt="" className="h-12 w-12 rounded-full bg-white object-contain p-0.5 shrink-0" />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-3 relative">
        <div className="flex justify-center mb-3">
          {student.photo_url
            ? <img src={student.photo_url} alt="" className="w-[120px] h-[120px] rounded-md object-cover border-2 border-gray-200" />
            : <div className="w-[120px] h-[120px] rounded-md bg-gray-100 flex items-center justify-center"><User size={56} className="text-gray-400" /></div>
          }
        </div>

        <p className="text-center text-[22px] font-extrabold text-[#B91C1C] tracking-wide mb-3">{student.name.toUpperCase()}</p>

        <div className="space-y-1.5 text-[12.5px] text-gray-900">
          <CardRow label="Registration No." value={student.registration_no} />
          <CardRow label="Father's Name" value={(student.father_name || '—').toUpperCase()} />
          <CardRow label="D.O.B." value={student.dob ? formatDate(student.dob) : '—'} />
          <CardRow label="Course" value={course} />
        </div>

        <div className="mt-3 mb-1">
          {qrDataUrl
            ? <img src={qrDataUrl} alt="QR" className="w-[78px] h-[78px]" />
            : <div className="w-[78px] h-[78px] bg-gray-100 rounded" />}
        </div>
      </div>

      {/* Footer */}
      <div className="relative bg-black text-white text-center px-3 py-2.5" style={{ fontSize: 9.5, lineHeight: 1.45 }}>
        <div className="absolute -top-1 inset-x-0 h-1 bg-[#B91C1C]" />
        <p><span className="font-bold">Director</span> – {settings.director_name}</p>
        <p><span className="font-bold">Address</span> – {settings.address}</p>
        <p><span className="font-bold">Phone:</span> {settings.phone}</p>
        <p><span className="font-bold">Website:</span> {settings.website}</p>
      </div>
    </div>
  )
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-[110px] shrink-0">{label}</span>
      <span className="w-2 shrink-0">:</span>
      <span className="font-bold flex-1 break-words">{value}</span>
    </div>
  )
}

/** Convert a same-origin image URL to a data URL for @react-pdf embedding. */
async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
