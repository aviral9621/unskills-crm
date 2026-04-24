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
      const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet, Font } = await import('@react-pdf/renderer')
      try {
        Font.register({
          family: 'Roboto',
          fonts: [
            { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.ttf', fontWeight: 400 },
            { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.ttf', fontWeight: 700 },
          ],
        })
      } catch { /* already registered */ }

      const PRIMARY = '#B91C1C'
      const INK = '#111827'
      const MUTED = '#6B7280'
      const BORDER = '#E5E7EB'
      const initialBg = pickInitialColor(selected.name)

      const s = StyleSheet.create({
        page: { fontFamily: 'Roboto', padding: 36, backgroundColor: '#FFFFFF', color: INK, fontSize: 10 },

        // Brand header
        brandWrap: { alignItems: 'center', paddingBottom: 8 },
        brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        brandLogo: { width: 40, height: 40, marginRight: 10, objectFit: 'contain' },
        brandUn: { fontSize: 24, fontWeight: 700, color: INK, letterSpacing: 0.3 },
        brandSk: { fontSize: 24, fontWeight: 700, color: PRIMARY, letterSpacing: 0.3 },
        brandTail: { fontSize: 18, fontWeight: 700, color: INK, letterSpacing: 0.5, marginLeft: 6 },
        hqLine: { fontSize: 8.5, color: MUTED, marginTop: 3, textAlign: 'center' },

        hr: { height: 1, backgroundColor: BORDER, marginTop: 10 },

        // Title pill
        titleWrap: { alignItems: 'center', marginTop: 16 },
        titlePill: { backgroundColor: PRIMARY, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 999 },
        titleText: { color: '#FFFFFF', fontSize: 12, fontWeight: 700, letterSpacing: 3 },

        // Card body — two columns
        cardWrap: { marginTop: 20, borderWidth: 1.2, borderColor: BORDER, borderRadius: 10, padding: 22 },
        topRow: { flexDirection: 'row', alignItems: 'center' },
        photo: { width: 130, height: 150, objectFit: 'cover', borderRadius: 6, borderWidth: 1.5, borderColor: BORDER },
        photoPh: { width: 130, height: 150, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
        photoPhText: { fontSize: 64, color: '#FFFFFF', fontWeight: 700 },

        topRight: { flex: 1, paddingLeft: 20 },
        nameText: { fontSize: 24, fontWeight: 700, color: INK, letterSpacing: 0.4 },
        desigText: { fontSize: 14, fontWeight: 700, color: PRIMARY, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
        codeRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
        codeLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
        codePill: { marginLeft: 6, backgroundColor: '#FEF2F2', borderWidth: 0.8, borderColor: '#F3C7C7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, color: PRIMARY, fontSize: 11, fontWeight: 700 },

        infoGrid: { marginTop: 18, flexDirection: 'row', gap: 18 },
        infoCol: { flex: 1 },
        infoRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.6, borderBottomColor: BORDER },
        infoKey: { width: 90, fontSize: 9, color: MUTED },
        infoVal: { flex: 1, fontSize: 10, fontWeight: 700, color: INK },

        // QR + signature row
        qrRow: { flexDirection: 'row', marginTop: 22, alignItems: 'flex-end' },
        qrCol: { alignItems: 'center' },
        qrImg: { width: 110, height: 110 },
        qrCaption: { fontSize: 7.5, color: MUTED, marginTop: 4, textAlign: 'center', maxWidth: 130 },
        sigCol: { flex: 1, alignItems: 'flex-end' },
        sigImg: { width: 140, height: 45, objectFit: 'contain' },
        sigLine: { borderTopWidth: 0.8, borderTopColor: INK, width: 170, marginTop: 2, marginBottom: 3 },
        sigAuth: { fontSize: 10, fontWeight: 700, color: INK },
        sigDesig: { fontSize: 8, color: MUTED },

        // Branch footer
        branchFooter: { marginTop: 22, paddingTop: 10, borderTopWidth: 0.6, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center' },
        branchLogo: { width: 34, height: 34, borderRadius: 17, marginRight: 10, objectFit: 'cover' },
        branchTitle: { fontSize: 11, fontWeight: 700, color: INK },
        branchSub: { fontSize: 8, color: MUTED, marginTop: 1 },
        validityBox: { marginTop: 10, padding: 6, borderWidth: 0.6, borderStyle: 'dashed', borderColor: '#F3C7C7', borderRadius: 4 },
        validityText: { fontSize: 8, color: '#555', textAlign: 'center', fontStyle: 'italic' },
      })

      const designation = selected.designation || 'Staff'
      const branchAddr = formatBranchAddress(selected.branch) || cardSettings.address
      const phone = selected.branch?.director_phone || cardSettings.phone
      const qr = qrDataUrl
      const photo = photoDataUrl
      const logo = selectedLogoDataUrl || masterLogoDataUrl
      const branchTitle = selected.branch?.name || cardSettings.header_title
      const initials = getInitials(selected.name)

      const Doc = (
        <Document>
          <Page size="A4" style={s.page}>
            {/* Brand header */}
            <View style={s.brandWrap}>
              <View style={s.brandRow}>
                {logo ? <PdfImage src={logo} style={s.brandLogo} /> : null}
                <Text style={s.brandUn}>UN</Text>
                <Text style={s.brandSk}>SKILLS</Text>
                <Text style={s.brandTail}>COMPUTER EDUCATION</Text>
              </View>
              <Text style={s.hqLine}>{cardSettings.header_subtitle}</Text>
              <Text style={s.hqLine}>{cardSettings.address}</Text>
              <Text style={s.hqLine}>Ph: {cardSettings.phone} {'\u00B7'} {cardSettings.website}</Text>
            </View>
            <View style={s.hr} />

            <View style={s.titleWrap}>
              <View style={s.titlePill}><Text style={s.titleText}>STAFF IDENTITY CARD</Text></View>
            </View>

            <View style={s.cardWrap}>
              <View style={s.topRow}>
                {photo
                  ? <PdfImage src={photo} style={s.photo} />
                  : <View style={[s.photoPh, { backgroundColor: initialBg }]}><Text style={s.photoPhText}>{initials}</Text></View>}

                <View style={s.topRight}>
                  <Text style={s.nameText}>{selected.name.toUpperCase()}</Text>
                  <Text style={s.desigText}>{designation}</Text>
                  <View style={s.codeRow}>
                    <Text style={s.codeLabel}>Employee Code</Text>
                    <Text style={s.codePill}>{selected.employee_code}</Text>
                  </View>
                </View>
              </View>

              {/* Info grid */}
              <View style={s.infoGrid}>
                <View style={s.infoCol}>
                  <View style={s.infoRow}><Text style={s.infoKey}>Father's Name</Text><Text style={s.infoVal}>{(selected.father_name || '—').toUpperCase()}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Date of Birth</Text><Text style={s.infoVal}>{selected.dob ? formatDate(selected.dob) : '—'}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Mobile No.</Text><Text style={s.infoVal}>{selected.phone || '—'}</Text></View>
                </View>
                <View style={s.infoCol}>
                  <View style={s.infoRow}><Text style={s.infoKey}>Designation</Text><Text style={s.infoVal}>{designation}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Branch</Text><Text style={s.infoVal}>{branchTitle}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Email</Text><Text style={s.infoVal}>{selected.branch?.director_email || cardSettings.website}</Text></View>
                </View>
              </View>

              {/* QR + signature */}
              <View style={s.qrRow}>
                <View style={s.qrCol}>
                  {qr ? <PdfImage src={qr} style={s.qrImg} /> : <View style={[s.qrImg, { backgroundColor: '#F3F4F6' }]} />}
                  <Text style={s.qrCaption}>Scan to verify identity</Text>
                </View>
                <View style={s.sigCol}>
                  {staffSettings.signature_url
                    ? <PdfImage src={staffSettings.signature_url} style={s.sigImg} />
                    : null}
                  <View style={s.sigLine} />
                  <Text style={s.sigAuth}>{staffSettings.authority_name}</Text>
                  <Text style={s.sigDesig}>{staffSettings.authority_designation}</Text>
                </View>
              </View>

              {/* Validity */}
              <View style={s.validityBox}>
                <Text style={s.validityText}>{staffSettings.validity_line}</Text>
              </View>
            </View>

            {/* Branch footer */}
            <View style={s.branchFooter}>
              {selectedLogoDataUrl
                ? <PdfImage src={selectedLogoDataUrl} style={s.branchLogo} />
                : <View style={[s.branchLogo, { backgroundColor: initialBg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 700 }}>{(selected.branch?.name || 'B').charAt(0).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.branchTitle}>{branchTitle}</Text>
                <Text style={s.branchSub}>{branchAddr}  {phone ? `\u00B7 Mob: ${phone}` : ''}</Text>
              </View>
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
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {generating ? 'Generating…' : 'Download A4 ID Card'}
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
  const phone = employee.branch?.director_phone || cardSettings.phone
  const designation = employee.designation || 'Staff'
  const initials = getInitials(employee.name)
  const initialBg = pickInitialColor(employee.name)
  void mainBranch; void title
  return (
    <div className="bg-white mx-auto rounded-xl overflow-hidden shadow-lg border border-gray-200 max-w-sm"
      style={{ fontFamily: '"DM Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {/* Brand header */}
      <div className="px-5 pt-5 pb-3 flex flex-col items-center">
        <div className="flex items-center">
          <img src={logoUrl} alt="" className="w-8 h-8 mr-2 object-contain" />
          <span className="text-lg font-extrabold text-gray-900 tracking-wide">UN</span>
          <span className="text-lg font-extrabold text-red-700 tracking-wide">SKILLS</span>
          <span className="text-sm font-extrabold text-gray-900 ml-1.5">COMPUTER EDUCATION</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-1 text-center">{cardSettings.header_subtitle}</p>
      </div>
      <div className="h-px bg-gray-200" />

      {/* Title pill */}
      <div className="flex justify-center py-3">
        <span className="bg-red-700 text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest">STAFF IDENTITY CARD</span>
      </div>

      {/* Body */}
      <div className="px-5 pb-4">
        <div className="flex items-start gap-4 mb-4">
          {safePhoto
            ? <img src={safePhoto} alt="" className="w-24 h-28 rounded-md object-cover border-2 border-gray-200" />
            : (
              <div className="w-24 h-28 rounded-md flex items-center justify-center text-white font-bold text-3xl" style={{ backgroundColor: initialBg }}>
                {initials}
              </div>
            )
          }
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold text-gray-900 uppercase leading-tight break-words">{employee.name}</p>
            <p className="text-sm font-bold text-red-700 uppercase tracking-wide mt-1">{designation}</p>
            <div className="mt-3 inline-flex items-baseline gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-gray-500">Employee Code</span>
              <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">{employee.employee_code || '—'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 text-[11px]">
          <CardRow label="Father's Name" value={(employee.father_name || '—').toUpperCase()} />
          <CardRow label="Designation" value={designation} />
          <CardRow label="D.O.B." value={employee.dob ? formatDate(employee.dob) : '—'} />
          <CardRow label="Branch" value={employee.branch?.name || '—'} />
          <CardRow label="Mobile No." value={employee.phone || '—'} />
        </div>

        {/* QR + signature */}
        <div className="flex items-end justify-between mt-4 gap-4">
          <div className="flex flex-col items-center">
            {qrDataUrl
              ? <img src={qrDataUrl} alt="QR" className="w-20 h-20" />
              : <div className="w-20 h-20 bg-gray-100 rounded" />}
            <p className="text-[8px] text-gray-500 mt-1">Scan to verify</p>
          </div>
          <div className="flex-1 flex flex-col items-end">
            {staffSettings.signature_url && <img src={staffSettings.signature_url} alt="sig" className="h-8 object-contain" />}
            <div className="border-t border-gray-900 w-32 mt-1" />
            <p className="text-[10px] font-bold text-gray-900 mt-0.5">{staffSettings.authority_name}</p>
            <p className="text-[8px] text-gray-500">{staffSettings.authority_designation}</p>
          </div>
        </div>

        <div className="mt-3 rounded border border-dashed border-red-200 bg-red-50/30 px-2 py-1">
          <p className="text-[9px] text-gray-600 italic text-center">{staffSettings.validity_line}</p>
        </div>
      </div>

      {/* Branch footer */}
      <div className="border-t border-gray-200 px-5 py-2.5 flex items-center gap-2">
        {logoUrl ? <img src={logoUrl} alt="" className="w-7 h-7 rounded-full object-cover" /> : null}
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-900 truncate">{employee.branch?.name || cardSettings.header_title}</p>
          <p className="text-[8px] text-gray-500 truncate">{branchAddr}  {phone ? `· ${phone}` : ''}</p>
        </div>
      </div>
    </div>
  )
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 mr-2 shrink-0" style={{ minWidth: 80 }}>{label}</span>
      <span className="font-semibold text-gray-900 break-words flex-1">{value}</span>
    </div>
  )
}

/** Render-time helpers — no React state. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function pickInitialColor(seed: string): string {
  // Deterministic pleasant color — hash the name to one of several brand-friendly tones.
  const palette = ['#B91C1C', '#C2410C', '#7C3AED', '#1D4ED8', '#0F766E', '#047857', '#BE185D', '#4F46E5']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return palette[Math.abs(h) % palette.length]
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
