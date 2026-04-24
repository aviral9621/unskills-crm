import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, CreditCard, Download, Loader2, Settings, X, User } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { formatDate, cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { getCardSettings, type CardSettings } from '../../lib/cardSettings'
import { getStaffCardSettings, staffIdCardVerifyUrl, type StaffCardSettings } from '../../lib/staffCardSettings'

interface BranchInfo {
  name: string | null
  center_logo_url: string | null
  address_line1: string | null
  village: string | null
  block: string | null
  district: string | null
  state: string | null
  pincode: string | null
  director_phone: string | null
  director_email: string | null
}

interface EmployeeRow {
  id: string
  employee_code: string | null
  name: string
  father_name: string | null
  dob: string | null
  designation: string | null
  phone: string | null
  photo_url: string | null
  joining_date: string | null
  is_active: boolean
  branch?: BranchInfo | null
}

function formatBranchAddress(b: BranchInfo | null | undefined): string {
  if (!b) return ''
  return [b.address_line1, b.village, b.block, b.district, b.state, b.pincode].filter(Boolean).join(', ')
}

export default function StaffIdCardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const branchId = profile?.branch_id

  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [cardSettings, setCardSettings] = useState<CardSettings | null>(null)
  const [staffSettings, setStaffSettings] = useState<StaffCardSettings | null>(null)
  const [mainBranch, setMainBranch] = useState<BranchInfo | null>(null)
  const [selected, setSelected] = useState<EmployeeRow | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('')
  const [masterLogoDataUrl, setMasterLogoDataUrl] = useState<string>('')
  const [selectedLogoDataUrl, setSelectedLogoDataUrl] = useState<string>('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { fetchAll() }, [])

  // preload master logo once (used as fallback when a branch has no logo)
  useEffect(() => {
    toDataUrl('/MAIN LOGO FOR ALL CARDS.png').then(setMasterLogoDataUrl).catch(() => setMasterLogoDataUrl(''))
  }, [])

  // Deep-link ?employee=<id>
  useEffect(() => {
    const id = searchParams.get('employee')
    if (id && employees.length > 0 && (!selected || selected.id !== id)) {
      const e = employees.find(x => x.id === id)
      if (e) setSelected(e)
    }
  }, [searchParams, employees])

  // Regenerate QR + photo + branch logo when selection changes
  useEffect(() => {
    if (!selected || !staffSettings) {
      setQrDataUrl(''); setPhotoDataUrl(''); setSelectedLogoDataUrl('')
      return
    }
    const code = selected.employee_code || selected.id
    const url = staffIdCardVerifyUrl(staffSettings.verify_base_url, code)
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' } })
      .then(setQrDataUrl).catch(() => setQrDataUrl(''))

    if (selected.photo_url && !selected.photo_url.startsWith('blob:')) {
      toDataUrl(selected.photo_url).then(setPhotoDataUrl).catch(() => setPhotoDataUrl(''))
    } else {
      setPhotoDataUrl('')
    }

    const branchLogo = selected.branch?.center_logo_url
    if (branchLogo) {
      toDataUrl(branchLogo).then(setSelectedLogoDataUrl).catch(() => setSelectedLogoDataUrl(masterLogoDataUrl))
    } else {
      setSelectedLogoDataUrl(masterLogoDataUrl)
    }
  }, [selected, staffSettings, masterLogoDataUrl])

  async function fetchAll() {
    setLoading(true)
    try {
      const branchCols = 'name, center_logo_url, address_line1, village, block, district, state, pincode, director_phone, director_email'
      const [empRes, cardRes, staffRes, mainRes] = await Promise.all([
        (async () => {
          let q = supabase.from('uce_employees')
            .select(`id, employee_code, name, father_name, dob, designation, phone, photo_url, joining_date, is_active, branch:uce_branches(${branchCols})`)
            .eq('is_active', true)
          if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
          return q.order('name')
        })(),
        getCardSettings(),
        getStaffCardSettings(),
        supabase.from('uce_branches').select(branchCols).eq('is_main', true).eq('is_active', true).maybeSingle(),
      ])
      if (empRes.error) throw empRes.error
      setEmployees((empRes.data ?? []) as unknown as EmployeeRow[])
      setCardSettings(cardRes)
      setStaffSettings(staffRes)
      setMainBranch((mainRes.data as unknown as BranchInfo) || null)
    } catch { toast.error('Failed to load staff') }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.employee_code || '').toLowerCase().includes(q) ||
      (e.father_name || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q)
    )
  }, [employees, search])

  function pickEmployee(e: EmployeeRow) {
    setSelected(e)
    setSearchParams({ employee: e.id }, { replace: true })
  }

  async function handleDownloadPdf() {
    if (!selected || !cardSettings || !staffSettings) return
    if (!selected.employee_code) {
      toast.error('This employee has no Employee Code yet — set one before generating the ID card.'); return
    }
    setGenerating(true)
    try {
      const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

      const W = 240, H = 380

      const s = StyleSheet.create({
        page:        { width: W, height: H, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },

        // FRONT
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

        name:        { color: '#B91C1C', fontSize: 12.5, fontWeight: 'bold', textAlign: 'center', marginBottom: 1, letterSpacing: 0.3 },
        designation: { color: '#111827', fontSize: 8.5, textAlign: 'center', marginBottom: 5, fontStyle: 'italic' },

        infoRow:     { flexDirection: 'row', marginBottom: 2.5 },
        infoLabel:   { width: 68, fontSize: 7.5, color: '#111827' },
        infoSep:     { width: 6, fontSize: 7.5, color: '#111827' },
        infoValue:   { flex: 1, fontSize: 7.5, color: '#111827', fontWeight: 'bold' },

        footerRed:   { height: 3, backgroundColor: '#B91C1C' },
        footer:      { backgroundColor: '#111111', paddingHorizontal: 8, paddingVertical: 5 },
        ftLine:      { color: '#FFFFFF', fontSize: 6, textAlign: 'center', marginBottom: 1.2, lineHeight: 1.3 },
        ftBold:      { fontWeight: 'bold' },

        // BACK
        backHeader:  { height: 40, backgroundColor: '#B91C1C', alignItems: 'center', justifyContent: 'center' },
        backTitle:   { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
        backBody:    { flex: 1, padding: 12, alignItems: 'center' },
        qr:          { width: 120, height: 120, marginBottom: 8 },
        validText:   { fontSize: 7, color: '#374151', textAlign: 'center', marginBottom: 10, paddingHorizontal: 8, lineHeight: 1.3 },
        sigBlock:    { alignItems: 'center', marginBottom: 6, width: '100%' },
        sigImg:      { width: 90, height: 32, objectFit: 'contain', marginBottom: 1 },
        sigLine:     { borderTopWidth: 0.8, borderTopColor: '#111827', width: 120, marginBottom: 2 },
        sigAuth:     { fontSize: 7.5, fontWeight: 'bold', color: '#111827' },
        sigDesig:    { fontSize: 6.5, color: '#6B7280' },
      })

      const course = selected.designation || 'Staff'
      const branchAddr = formatBranchAddress(selected.branch) || cardSettings.address
      const headAddr = formatBranchAddress(mainBranch) || cardSettings.address
      const phone = selected.branch?.director_phone || cardSettings.phone
      const qr = qrDataUrl
      const photo = photoDataUrl
      const logo = selectedLogoDataUrl || masterLogoDataUrl
      const title = selected.branch?.name || cardSettings.header_title

      const Doc = (
        <Document>
          {/* FRONT */}
          <Page size={[W, H]} wrap={false} style={s.page}>
            <View style={s.header}>
              <View style={s.headerRed}>
                <Text style={s.headerTitle}>{cardSettings.header_title}</Text>
                <Text style={s.headerSub}>{cardSettings.header_subtitle}</Text>
              </View>
              <View style={s.headerLogo}>
                {logo ? <PdfImage src={logo} style={s.logoImg} /> : null}
              </View>
            </View>

            <View style={s.body}>
              <View style={s.photoWrap}>
                {photo
                  ? <PdfImage src={photo} style={s.photo} />
                  : <View style={s.photoPh}><Text style={{ fontSize: 28, color: '#9CA3AF' }}>{selected.name.charAt(0).toUpperCase()}</Text></View>}
              </View>

              <Text style={s.name}>{selected.name.toUpperCase()}</Text>
              <Text style={s.designation}>{course}</Text>

              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Employee Code</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{selected.employee_code || '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Father&apos;s Name</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{(selected.father_name || '—').toUpperCase()}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>D.O.B.</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{selected.dob ? formatDate(selected.dob) : '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Mobile No.</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{selected.phone || '—'}</Text>
              </View>
              {selected.joining_date && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Joined</Text>
                  <Text style={s.infoSep}>:</Text>
                  <Text style={s.infoValue}>{formatDate(selected.joining_date)}</Text>
                </View>
              )}
            </View>

            <View style={s.footerRed} />
            <View style={s.footer}>
              <Text style={s.ftLine}><Text style={s.ftBold}>Branch :</Text> {title}</Text>
              <Text style={s.ftLine}>{branchAddr}</Text>
              <Text style={s.ftLine}><Text style={s.ftBold}>Mob :</Text> {phone}</Text>
            </View>
          </Page>

          {/* BACK */}
          <Page size={[W, H]} wrap={false} style={s.page}>
            <View style={s.backHeader}>
              <Text style={s.backTitle}>STAFF IDENTITY</Text>
            </View>

            <View style={s.backBody}>
              {qr ? <PdfImage src={qr} style={s.qr} /> : <View style={[s.qr, { backgroundColor: '#F3F4F6' }]} />}
              <Text style={s.validText}>{staffSettings.validity_line}</Text>

              <View style={s.sigBlock}>
                {staffSettings.signature_url
                  ? <PdfImage src={staffSettings.signature_url} style={s.sigImg} />
                  : <View style={[s.sigImg, { backgroundColor: '#F9FAFB' }]} />}
                <View style={s.sigLine} />
                <Text style={s.sigAuth}>{staffSettings.authority_name}</Text>
                <Text style={s.sigDesig}>{staffSettings.authority_designation}</Text>
              </View>
            </View>

            <View style={s.footerRed} />
            <View style={s.footer}>
              <Text style={s.ftLine}><Text style={s.ftBold}>Head Office :</Text> {headAddr}</Text>
              <Text style={s.ftLine}><Text style={s.ftBold}>Phone :</Text> {cardSettings.phone} · {cardSettings.website}</Text>
              <Text style={s.ftLine}>If found, please return to the Head Office above.</Text>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(Doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Staff-ID-${(selected.employee_code || selected.id).replace(/\//g, '-')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Staff ID Card downloaded')
    } catch (e) { console.error(e); toast.error('Failed to generate PDF') }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Staff ID Card</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Pick an employee to generate their two-sided ID card</p>
        </div>
        <button onClick={() => navigate('/admin/staff/id-card-settings')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Settings size={14} /> Teachers ID Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,360px)] gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 space-y-3 min-h-[420px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, designation…"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <User size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No staff found</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 -mx-1">
              {filtered.map(e => (
                <button key={e.id} onClick={() => pickEmployee(e)}
                  className={cn('w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left',
                    selected?.id === e.id && 'bg-red-50 ring-1 ring-red-200')}>
                  {e.photo_url && !e.photo_url.startsWith('blob:')
                    ? <img src={e.photo_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    : <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-red-600">{e.name.charAt(0).toUpperCase()}</span></div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.name}</p>
                    <p className="text-[11px] font-mono text-gray-400">{e.employee_code || '—'} · {e.designation || '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Select an employee to preview their ID card</p>
            </div>
          ) : !cardSettings || !staffSettings ? null : (
            <>
              <StaffIdCardPreview
                employee={selected}
                cardSettings={cardSettings}
                staffSettings={staffSettings}
                mainBranch={mainBranch}
                qrDataUrl={qrDataUrl}
                photoUrl={photoDataUrl || selected.photo_url}
                logoUrl={selectedLogoDataUrl || masterLogoDataUrl || '/MAIN LOGO FOR ALL CARDS.png'}
                title={selected.branch?.name || cardSettings.header_title}
              />
              <button onClick={handleDownloadPdf} disabled={generating}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {generating ? 'Generating…' : 'Download PDF (Front + Back)'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StaffIdCardPreview({
  employee, cardSettings, staffSettings, mainBranch, qrDataUrl, photoUrl, logoUrl, title,
}: {
  employee: EmployeeRow
  cardSettings: CardSettings
  staffSettings: StaffCardSettings
  mainBranch: BranchInfo | null
  qrDataUrl: string
  photoUrl: string | null
  logoUrl: string
  title: string
}) {
  const safePhoto = photoUrl && !photoUrl.startsWith('blob:') ? photoUrl : ''
  const branchAddr = formatBranchAddress(employee.branch) || cardSettings.address
  const headAddr = formatBranchAddress(mainBranch) || cardSettings.address
  const phone = employee.branch?.director_phone || cardSettings.phone
  return (
    <div className="space-y-3">
      {/* FRONT */}
      <div className="bg-white mx-auto rounded-xl overflow-hidden shadow-lg"
        style={{ width: 320, fontFamily: '"DM Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <div className="flex items-stretch bg-black" style={{ height: 86 }}>
          <div className="flex-1 bg-[#B91C1C] px-3 flex flex-col justify-center">
            <p className="text-white text-[13px] font-bold leading-tight">{cardSettings.header_title}</p>
            <p className="text-white/90 text-[8px] leading-snug mt-1">{cardSettings.header_subtitle}</p>
          </div>
          <div className="w-[70px] flex items-center justify-center">
            <img src={logoUrl} alt="" className="w-12 h-12 rounded-full bg-white object-contain p-0.5" />
          </div>
        </div>
        <div className="px-5 pt-3 pb-3">
          <div className="flex justify-center mb-2">
            {safePhoto
              ? <img src={safePhoto} alt="" className="w-[110px] h-[110px] rounded-md object-cover border-2 border-gray-200" />
              : <div className="w-[110px] h-[110px] rounded-md bg-gray-100 flex items-center justify-center"><User size={50} className="text-gray-400" /></div>
            }
          </div>
          <p className="text-center text-[18px] font-extrabold text-[#B91C1C] tracking-wide">{employee.name.toUpperCase()}</p>
          <p className="text-center text-[11px] text-gray-700 italic mb-3">{employee.designation || 'Staff'}</p>
          <div className="space-y-1 text-[11px] text-gray-900 mb-1">
            <CardRow label="Employee Code" value={employee.employee_code || '—'} />
            <CardRow label="Father's Name" value={(employee.father_name || '—').toUpperCase()} />
            <CardRow label="D.O.B." value={employee.dob ? formatDate(employee.dob) : '—'} />
            <CardRow label="Mobile No." value={employee.phone || '—'} />
            {employee.joining_date && <CardRow label="Joined" value={formatDate(employee.joining_date)} />}
          </div>
        </div>
        <div className="h-1 bg-[#B91C1C]" />
        <div className="bg-black text-white text-center px-3 py-2.5" style={{ fontSize: 9, lineHeight: 1.45 }}>
          <p><span className="font-bold">Branch :</span> {title}</p>
          <p>{branchAddr}</p>
          <p><span className="font-bold">Mob :</span> {phone}</p>
        </div>
      </div>

      {/* BACK */}
      <div className="bg-white mx-auto rounded-xl overflow-hidden shadow-lg flex flex-col items-center"
        style={{ width: 320, fontFamily: '"DM Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <div className="w-full bg-[#B91C1C] text-white text-center py-2 text-sm font-bold tracking-widest">STAFF IDENTITY</div>
        <div className="p-4 flex flex-col items-center">
          {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="w-[150px] h-[150px] mb-3" /> : <div className="w-[150px] h-[150px] bg-gray-100 rounded mb-3" />}
          <p className="text-[10px] text-gray-600 text-center px-4 mb-4">{staffSettings.validity_line}</p>
          {staffSettings.signature_url && <img src={staffSettings.signature_url} alt="signature" className="h-10 object-contain mb-1" />}
          <div className="border-t border-gray-900 w-40 mb-1" />
          <p className="text-[11px] font-bold text-gray-900">{staffSettings.authority_name}</p>
          <p className="text-[9px] text-gray-500">{staffSettings.authority_designation}</p>
        </div>
        <div className="h-1 bg-[#B91C1C] w-full" />
        <div className="bg-black text-white text-center w-full px-3 py-2" style={{ fontSize: 9, lineHeight: 1.4 }}>
          <p><span className="font-bold">Head Office :</span> {headAddr}</p>
          <p><span className="font-bold">Phone :</span> {cardSettings.phone} · {cardSettings.website}</p>
        </div>
      </div>
    </div>
  )
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-[100px] shrink-0 text-gray-900">{label}</span>
      <span className="w-2 shrink-0">:</span>
      <span className="font-bold flex-1 break-words">{value}</span>
    </div>
  )
}

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
