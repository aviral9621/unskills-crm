import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, CreditCard, Download, Loader2, Settings, X, User, CheckSquare, Square } from 'lucide-react'
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
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('')
  const [logoDataUrl, setLogoDataUrl] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set())
  const [bulkDownloading, setBulkDownloading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  // preload logo once as data URL so PDF + preview both use the embedded copy
  useEffect(() => {
    toDataUrl('/MAIN LOGO FOR ALL CARDS.png').then(setLogoDataUrl).catch(() => setLogoDataUrl(''))
  }, [])

  // Handle deep link ?student=<id>
  useEffect(() => {
    const id = searchParams.get('student')
    if (id && students.length > 0 && (!selected || selected.id !== id)) {
      const s = students.find(x => x.id === id)
      if (s) setSelected(s)
    }
  }, [searchParams, students])

  // Generate QR and re-fetch photo-as-data-URL whenever selection or settings change
  useEffect(() => {
    if (!selected || !settings) { setQrDataUrl(''); setPhotoDataUrl(''); return }
    const url = idCardVerifyUrl(settings.verify_base_url, selected.registration_no)
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))

    if (selected.photo_url && !selected.photo_url.startsWith('blob:')) {
      toDataUrl(selected.photo_url).then(setPhotoDataUrl).catch(() => setPhotoDataUrl(''))
    } else {
      setPhotoDataUrl('')
    }
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

  async function resolveCardAssets(student: StudentRow): Promise<{ qr: string; photo: string }> {
    if (!settings) return { qr: '', photo: '' }
    const qr = await QRCode
      .toDataURL(idCardVerifyUrl(settings.verify_base_url, student.registration_no), {
        margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' },
      })
      .catch(() => '')
    const photo = student.photo_url && !student.photo_url.startsWith('blob:')
      ? await toDataUrl(student.photo_url).catch(() => '')
      : ''
    return { qr, photo }
  }

  /** Build the ID-card PDF blob. One Page per card; guaranteed single-page per
   *  student via wrap={false}. Uses Helvetica (react-pdf built-in) to avoid the
   *  Buffer-polyfill code path triggered by external TTF fonts. */
  async function buildPdfBlob(
    cards: Array<{ student: StudentRow; qr: string; photo: string }>,
  ): Promise<Blob | null> {
    if (!settings || cards.length === 0) return null
    const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

    const W = 240, H = 380

    const s = StyleSheet.create({
      page:        { width: W, height: H, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },

      header:      { height: 62, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'stretch' },
      headerRed:   { flex: 1, backgroundColor: '#B91C1C', padding: 6, justifyContent: 'center' },
      headerTitle: { color: '#FFFFFF', fontSize: 9.5, fontWeight: 'bold', letterSpacing: 0.2 },
      headerSub:   { color: '#FFFFFF', fontSize: 5, marginTop: 2, lineHeight: 1.3 },
      headerLogo:  { width: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111' },
      logoImg:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', padding: 2 },

      body:        { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
      photoWrap:   { alignItems: 'center', marginBottom: 5 },
      photo:       { width: 78, height: 78, objectFit: 'cover', borderRadius: 4, border: '1.5px solid #E5E7EB' },
      photoPh:     { width: 78, height: 78, borderRadius: 4, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

      name:        { color: '#B91C1C', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 6, letterSpacing: 0.3 },

      infoRow:     { flexDirection: 'row', marginBottom: 3 },
      infoLabel:   { width: 74, fontSize: 8, color: '#111827' },
      infoSep:     { width: 6, fontSize: 8, color: '#111827' },
      infoValue:   { flex: 1, fontSize: 8, color: '#111827', fontWeight: 'bold' },

      qrWrap:      { marginTop: 4 },
      qr:          { width: 50, height: 50 },

      footerRed:   { height: 3, backgroundColor: '#B91C1C' },
      footer:      { backgroundColor: '#111111', paddingHorizontal: 8, paddingVertical: 5 },
      ftLine:      { color: '#FFFFFF', fontSize: 6, textAlign: 'center', marginBottom: 1.2, lineHeight: 1.3 },
      ftBold:      { fontWeight: 'bold' },
    })

    const Doc = (
      <Document>
        {cards.map(({ student, qr, photo }) => {
          const course = (student.course as { name: string } | null)?.name || '—'
          return (
            <Page key={student.id} size={[W, H]} wrap={false} style={s.page}>
              <View style={s.header}>
                <View style={s.headerRed}>
                  <Text style={s.headerTitle}>{settings.header_title}</Text>
                  <Text style={s.headerSub}>{settings.header_subtitle}</Text>
                </View>
                <View style={s.headerLogo}>
                  {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logoImg} /> : null}
                </View>
              </View>

              <View style={s.body}>
                <View style={s.photoWrap}>
                  {photo
                    ? <PdfImage src={photo} style={s.photo} />
                    : <View style={s.photoPh}><Text style={{ fontSize: 28, color: '#9CA3AF' }}>{student.name.charAt(0).toUpperCase()}</Text></View>}
                </View>

                <Text style={s.name}>{student.name.toUpperCase()}</Text>

                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Registration No.</Text>
                  <Text style={s.infoSep}>:</Text>
                  <Text style={s.infoValue}>{student.registration_no}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Father&apos;s Name</Text>
                  <Text style={s.infoSep}>:</Text>
                  <Text style={s.infoValue}>{(student.father_name || '—').toUpperCase()}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>D.O.B.</Text>
                  <Text style={s.infoSep}>:</Text>
                  <Text style={s.infoValue}>{student.dob ? formatDate(student.dob) : '—'}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Course</Text>
                  <Text style={s.infoSep}>:</Text>
                  <Text style={s.infoValue}>{course}</Text>
                </View>

                {qr && (
                  <View style={s.qrWrap}>
                    <PdfImage src={qr} style={s.qr} />
                  </View>
                )}
              </View>

              <View style={s.footerRed} />
              <View style={s.footer}>
                <Text style={s.ftLine}><Text style={s.ftBold}>Director</Text> – {settings.director_name}</Text>
                <Text style={s.ftLine}><Text style={s.ftBold}>Address</Text> – {settings.address}</Text>
                <Text style={s.ftLine}><Text style={s.ftBold}>Phone:</Text> {settings.phone}</Text>
                <Text style={s.ftLine}><Text style={s.ftBold}>Website:</Text> {settings.website}</Text>
              </View>
            </Page>
          )
        })}
      </Document>
    )
    return await pdf(Doc).toBlob()
  }

  async function handleDownloadPdf() {
    if (!selected) return
    setGenerating(true)
    try {
      // Reuse the already-resolved qr + photo for the live preview
      const blob = await buildPdfBlob([{ student: selected, qr: qrDataUrl, photo: photoDataUrl }])
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `ID-Card-${selected.registration_no.replace(/\//g, '-')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('ID Card downloaded')
    } catch (e) { console.error(e); toast.error('Failed to generate PDF') }
    finally { setGenerating(false) }
  }

  function toggleBulk(id: string) {
    setBulkIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleBulkAllVisible() {
    const visibleIds = filtered.map(s => s.id)
    const allSelected = visibleIds.every(id => bulkIds.has(id))
    setBulkIds(prev => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  async function handleBulkDownload() {
    if (bulkIds.size === 0) return
    const list = students.filter(s => bulkIds.has(s.id))
    if (list.length === 0) return
    setBulkDownloading(true)
    try {
      // Resolve QR + photo for every selected student in parallel
      const cards = await Promise.all(list.map(async student => ({
        student,
        ...(await resolveCardAssets(student)),
      })))
      const blob = await buildPdfBlob(cards)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = list.length === 1
        ? `ID-Card-${list[0].registration_no.replace(/\//g, '-')}.pdf`
        : `ID-Cards-${list.length}-students.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${list.length} ID card${list.length > 1 ? 's' : ''}`)
    } catch (e) { console.error(e); toast.error('Failed to generate bulk PDF') }
    finally { setBulkDownloading(false) }
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

          {/* Bulk toolbar */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={toggleBulkAllVisible}
                className="inline-flex items-center gap-1.5 text-gray-600 hover:text-red-600"
              >
                {filtered.every(s => bulkIds.has(s.id))
                  ? <CheckSquare size={14} className="text-red-600" />
                  : <Square size={14} />}
                <span>{filtered.every(s => bulkIds.has(s.id)) ? 'Clear selection' : 'Select all visible'}</span>
              </button>
              {bulkIds.size > 0 && (
                <span className="text-gray-500">{bulkIds.size} selected</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <User size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No students found</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 -mx-1">
              {filtered.map(s => {
                const checked = bulkIds.has(s.id)
                return (
                  <div key={s.id}
                    className={cn('flex items-center gap-2 px-2 py-2.5 rounded-lg hover:bg-gray-50',
                      selected?.id === s.id && 'bg-red-50 ring-1 ring-red-200')}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleBulk(s.id) }}
                      className="shrink-0 p-1 -m-1"
                      aria-label={checked ? 'Deselect' : 'Select'}
                    >
                      {checked ? <CheckSquare size={18} className="text-red-600" /> : <Square size={18} className="text-gray-400" />}
                    </button>
                    <button onClick={() => pickStudent(s)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      {s.photo_url && !s.photo_url.startsWith('blob:')
                        ? <img src={s.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        : <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-red-600">{s.name.charAt(0).toUpperCase()}</span></div>
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                        <p className="text-[11px] font-mono text-gray-400">{s.registration_no}</p>
                      </div>
                      <span className="hidden sm:inline text-[11px] text-gray-500 truncate max-w-[100px]">{(s.course as { name: string } | null)?.name}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {bulkIds.size > 0 && (
            <div className="sticky bottom-0 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 px-3 sm:px-4 py-3 bg-white border-t border-gray-200 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setBulkIds(new Set())}
                className="sm:flex-none px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear ({bulkIds.size})
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={bulkDownloading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {bulkDownloading ? 'Generating…' : `Download ${bulkIds.size} ID Card${bulkIds.size > 1 ? 's' : ''} (PDF)`}
              </button>
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
              <div className="mx-auto">
                <IdCardPreview student={selected} settings={settings} qrDataUrl={qrDataUrl} photoUrl={photoDataUrl || selected.photo_url} logoUrl={logoDataUrl || '/MAIN LOGO FOR ALL CARDS.png'} />
              </div>

              <button onClick={handleDownloadPdf} disabled={generating}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {generating ? 'Generating…' : 'Download PDF'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── On-screen card preview (visual match of the PDF) ─── */
function IdCardPreview({
  student, settings, qrDataUrl, photoUrl, logoUrl,
}: {
  student: StudentRow
  settings: CardSettings
  qrDataUrl: string
  photoUrl: string | null
  logoUrl: string
}) {
  const course = (student.course as { name: string } | null)?.name || '—'
  const safePhoto = photoUrl && !photoUrl.startsWith('blob:') ? photoUrl : ''
  return (
    <div className="bg-white mx-auto rounded-xl overflow-hidden shadow-lg"
      style={{ width: 320, fontFamily: '"DM Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {/* Header — two columns: red (title) + black (logo) */}
      <div className="flex items-stretch bg-black" style={{ height: 86 }}>
        <div className="flex-1 bg-[#B91C1C] px-3 flex flex-col justify-center">
          <p className="text-white text-[13px] font-bold leading-tight">{settings.header_title}</p>
          <p className="text-white/90 text-[8px] leading-snug mt-1">{settings.header_subtitle}</p>
        </div>
        <div className="w-[70px] flex items-center justify-center">
          <img src={logoUrl} alt="" className="w-12 h-12 rounded-full bg-white object-contain p-0.5" />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-3 pb-3">
        <div className="flex justify-center mb-2">
          {safePhoto
            ? <img src={safePhoto} alt="" className="w-[110px] h-[110px] rounded-md object-cover border-2 border-gray-200" />
            : <div className="w-[110px] h-[110px] rounded-md bg-gray-100 flex items-center justify-center"><User size={50} className="text-gray-400" /></div>
          }
        </div>

        <p className="text-center text-[20px] font-extrabold text-[#B91C1C] tracking-wide mb-3">{student.name.toUpperCase()}</p>

        <div className="space-y-1.5 text-[12px] text-gray-900 mb-3">
          <CardRow label="Registration No." value={student.registration_no} />
          <CardRow label="Father's Name" value={(student.father_name || '—').toUpperCase()} />
          <CardRow label="D.O.B." value={student.dob ? formatDate(student.dob) : '—'} />
          <CardRow label="Course" value={course} />
        </div>

        <div>
          {qrDataUrl
            ? <img src={qrDataUrl} alt="QR" className="w-[74px] h-[74px]" />
            : <div className="w-[74px] h-[74px] bg-gray-100 rounded" />}
        </div>
      </div>

      {/* Footer */}
      <div className="h-1 bg-[#B91C1C]" />
      <div className="bg-black text-white text-center px-3 py-2.5" style={{ fontSize: 9, lineHeight: 1.45 }}>
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
      <span className="w-[110px] shrink-0 text-gray-900">{label}</span>
      <span className="w-2 shrink-0">:</span>
      <span className="font-bold flex-1 break-words">{value}</span>
    </div>
  )
}

/** Convert a URL (same-origin public or supabase public) to a data URL for @react-pdf. */
async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
