import type { AdmitCardSettings } from '../admitCardSettings'

export interface AdmitCardSchedule {
  subject_id: string
  subject_name: string
  date: string           // YYYY-MM-DD
  reporting_time: string // HH:MM
  exam_time: string      // HH:MM
  end_time?: string | null
}

export interface AdmitCardStudent {
  id: string
  registration_no: string
  name: string
  father_name: string
  dob: string | null
  gender: string | null
  photo_url: string | null
  course_name: string
  session: string | null
  enrollment_date: string
}

export interface AdmitCardExamCenter {
  name: string
  code: string
  address: string
  semester?: string | null
}

export interface BuildAdmitCardInput {
  student: AdmitCardStudent
  center: AdmitCardExamCenter
  schedule: AdmitCardSchedule[]
  settings: AdmitCardSettings
  logoDataUrl: string
  photoDataUrl: string
}

let fontsRegistered = false

async function registerFonts() {
  if (fontsRegistered) return
  const { Font } = await import('@react-pdf/renderer')
  Font.register({
    family: 'DMSans',
    fonts: [
      { src: '/fonts/dm-sans-400.woff', fontWeight: 400 },
      { src: '/fonts/dm-sans-700.woff', fontWeight: 700 },
    ],
  })
  Font.register({
    family: 'NotoDevanagari',
    fonts: [
      { src: '/fonts/noto-devanagari-400.woff', fontWeight: 400 },
      { src: '/fonts/noto-devanagari-700.woff', fontWeight: 700 },
    ],
  })
  fontsRegistered = true
}

export async function toDataUrl(url: string): Promise<string> {
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

/** Format YYYY-MM-DD → "26 May, 26" (DD Mon, YY) */
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const yy = String(d.getFullYear()).slice(2)
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]}, ${yy}`
}

/** Format HH:MM[:SS] → "HH:MM AM/PM" */
function fmtTime(t: string | null | undefined): string {
  if (!t) return '—'
  const [hStr, m = '00'] = t.split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${String(h).padStart(2,'0')}:${m} ${ampm}`
}

export async function buildAdmitCardPdfBlob(input: BuildAdmitCardInput): Promise<Blob> {
  await registerFonts()
  const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

  const { student, center, settings, logoDataUrl, photoDataUrl } = input

  // Sort schedule by date ascending, nulls last
  const schedule = [...input.schedule].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })

  const RED = '#C8102E'
  const DARK = '#1A1A2E'
  const BLACK = '#111111'
  const BORDER = '#D1D5DB'
  const MUTED = '#6B7280'
  const BG_ROW = '#F9FAFB'
  const TEAL = '#0D6B5E'
  const GOLD = '#B8962E'

  const s = StyleSheet.create({
    page: {
      paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
      fontFamily: 'DMSans', fontSize: 10, color: BLACK, backgroundColor: '#FFFFFF',
    },

    // Top decorative bars (tricolor-inspired)
    topBarGreen:  { height: 5, backgroundColor: TEAL },
    topBarGold:   { height: 2, backgroundColor: GOLD },
    topBarWhite:  { height: 2, backgroundColor: '#FFFFFF' },
    topBarRed:    { height: 2, backgroundColor: RED },

    // Main header row
    headerWrap: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 0,
    },
    logoCol:   { width: 72, alignItems: 'center', justifyContent: 'center' },
    logo:      { width: 58, height: 58, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    brand:     { fontSize: 20, fontWeight: 700, color: DARK, letterSpacing: 0.5, textAlign: 'center' },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 },
    subtitleDash: { width: 24, height: 1.5, backgroundColor: RED },
    subtitleText: { fontSize: 9, color: BLACK, fontWeight: 400 },
    certLine:  { fontSize: 8, color: MUTED, marginTop: 4, textAlign: 'center', lineHeight: 1.4 },
    isoCol:    { width: 80, alignItems: 'center', justifyContent: 'center' },
    isoBox: {
      borderWidth: 1.5, borderColor: '#1A6AB8', borderRadius: 4,
      paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center',
    },
    isoLetters: { fontSize: 18, fontWeight: 700, color: '#1A6AB8', letterSpacing: 1 },
    isoSubText: { fontSize: 7, color: '#1A6AB8', textAlign: 'center', lineHeight: 1.3 },

    // Bottom strip of header
    stripWrap: {
      backgroundColor: '#F8F8F8', borderTopWidth: 1, borderTopColor: BORDER,
      borderBottomWidth: 2, borderBottomColor: RED,
      paddingVertical: 5, paddingHorizontal: 14, alignItems: 'center',
    },
    stripText: { fontSize: 9.5, fontWeight: 700, color: DARK, letterSpacing: 0.3, textAlign: 'center' },

    titleWrap: { alignItems: 'center', marginTop: 10, marginBottom: 6 },
    titleText: { fontSize: 15, fontWeight: 700, color: BLACK, letterSpacing: 1 },
    titleRule: { width: 90, height: 2, backgroundColor: RED, marginTop: 3 },

    body: { paddingHorizontal: 18 },
    studentRow: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, marginTop: 8 },
    studentCol: { flex: 1, borderRightWidth: 1, borderRightColor: BORDER },
    photoCol:   { width: 110, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    photoBox:   { width: 84, height: 100, borderWidth: 1, borderColor: BORDER, objectFit: 'cover' },
    photoPlaceholder: { width: 84, height: 100, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    photoCaption: { fontSize: 7.5, color: MUTED, marginTop: 3 },

    tRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 20 },
    tRowLast: { flexDirection: 'row', minHeight: 20 },
    tLbl:     { width: 110, paddingVertical: 4, paddingHorizontal: 7, fontSize: 8.5, color: MUTED, borderRightWidth: 1, borderRightColor: BORDER },
    tVal:     { flex: 1, paddingVertical: 4, paddingHorizontal: 7, fontSize: 8.5, color: BLACK, fontWeight: 700 },

    sectionTitle: { fontSize: 12, fontWeight: 700, color: BLACK, marginTop: 12, letterSpacing: 0.5 },
    sectionRule:  { width: 80, height: 2, backgroundColor: RED, marginTop: 2, marginBottom: 5 },

    schTable:    { borderWidth: 1, borderColor: BORDER, marginBottom: 6 },
    schHeader:   { flexDirection: 'row', backgroundColor: BG_ROW, borderBottomWidth: 1, borderBottomColor: BORDER },
    schHeadCell: { paddingVertical: 5, paddingHorizontal: 7, fontSize: 8.5, fontWeight: 700, color: BLACK },
    schRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
    schRowLast:  { flexDirection: 'row' },
    schCell:     { paddingVertical: 4, paddingHorizontal: 7, fontSize: 8.5, color: BLACK },

    instrHeader: { fontSize: 9.5, fontWeight: 700, color: BLACK, marginTop: 10, marginBottom: 4 },
    instrBody:   { fontFamily: 'NotoDevanagari', fontSize: 8, color: BLACK, lineHeight: 1.6 },

    sigRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, paddingHorizontal: 4 },
    sigCell: { alignItems: 'center', width: 150 },
    sigImg:  { height: 30, width: 120, objectFit: 'contain', marginBottom: 3 },
    sigWebsite: { fontSize: 8.5, color: MUTED, alignSelf: 'center' },
    sigLabel:   { fontSize: 8.5, fontWeight: 700, color: BLACK, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3, width: 140, textAlign: 'center' },

    footerWrap: { marginTop: 12, backgroundColor: RED, paddingVertical: 7, paddingHorizontal: 18 },
    footerText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: 700 },
  })

  const Doc = (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Top decorative bars */}
        <View style={s.topBarGreen} />
        <View style={s.topBarGold} />
        <View style={s.topBarWhite} />
        <View style={s.topBarRed} />

        {/* Main header */}
        <View style={s.headerWrap}>
          <View style={s.logoCol}>
            {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logo} /> : null}
          </View>
          <View style={s.middleCol}>
            <Text style={s.brand}>{settings.header_title}</Text>
            <View style={s.subtitleRow}>
              <View style={s.subtitleDash} />
              <Text style={s.subtitleText}>{settings.header_subtitle}</Text>
              <View style={s.subtitleDash} />
            </View>
            {settings.header_tagline ? <Text style={s.certLine}>{settings.header_tagline}</Text> : null}
          </View>
          <View style={s.isoCol}>
            <View style={s.isoBox}>
              <Text style={s.isoLetters}>ISO</Text>
              <Text style={s.isoSubText}>{settings.iso_line}</Text>
            </View>
          </View>
        </View>

        {/* Bottom strip */}
        {settings.header_strip ? (
          <View style={s.stripWrap}>
            <Text style={s.stripText}>{settings.header_strip}</Text>
          </View>
        ) : null}

        <View style={s.titleWrap}>
          <Text style={s.titleText}>CANDIDATE ADMIT CARD</Text>
          <View style={s.titleRule} />
        </View>

        <View style={s.body}>
          <View style={s.studentRow}>
            <View style={s.studentCol}>
              <View style={s.tRow}><Text style={s.tLbl}>Registration No</Text><Text style={s.tVal}>{student.registration_no}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Student Name</Text><Text style={s.tVal}>{student.name}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Date of Birth</Text><Text style={s.tVal}>{fmtDate(student.dob)}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Father{"'"}s Name</Text><Text style={s.tVal}>{student.father_name || '—'}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Course Name</Text><Text style={s.tVal}>{student.course_name || '—'}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Centre Name</Text><Text style={s.tVal}>{center.name || '—'}</Text></View>
              {center.semester ? (
                <View style={s.tRow}><Text style={s.tLbl}>Semester</Text><Text style={s.tVal}>{center.semester}</Text></View>
              ) : null}
              <View style={s.tRow}><Text style={s.tLbl}>Centre Code</Text><Text style={s.tVal}>{center.code || '—'}</Text></View>
              <View style={s.tRowLast}><Text style={s.tLbl}>Exam Centre Address</Text><Text style={s.tVal}>{center.address || '—'}</Text></View>
            </View>
            <View style={s.photoCol}>
              {photoDataUrl
                ? <PdfImage src={photoDataUrl} style={s.photoBox} />
                : <View style={s.photoPlaceholder}><Text style={{ fontSize: 20, color: '#9CA3AF', fontWeight: 700 }}>{student.name.charAt(0).toUpperCase()}</Text></View>}
              <Text style={s.photoCaption}>Candidate Photo</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>EXAM SCHEDULE</Text>
          <View style={s.sectionRule} />

          <View style={s.schTable}>
            <View style={s.schHeader}>
              <Text style={[s.schHeadCell, { flex: 2 }]}>Date of Examination</Text>
              <Text style={[s.schHeadCell, { flex: 3, borderLeftWidth: 1, borderLeftColor: BORDER }]}>Subject of Examination</Text>
              <Text style={[s.schHeadCell, { flex: 2, borderLeftWidth: 1, borderLeftColor: BORDER }]}>Reporting Time</Text>
              <Text style={[s.schHeadCell, { flex: 2, borderLeftWidth: 1, borderLeftColor: BORDER }]}>Exam Time</Text>
            </View>
            {schedule.map((row, idx) => (
              <View key={idx} style={idx === schedule.length - 1 ? s.schRowLast : s.schRow}>
                <Text style={[s.schCell, { flex: 2 }]}>{fmtDate(row.date)}</Text>
                <Text style={[s.schCell, { flex: 3, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{row.subject_name}</Text>
                <Text style={[s.schCell, { flex: 2, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{fmtTime(row.reporting_time)}</Text>
                <Text style={[s.schCell, { flex: 2, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{fmtTime(row.exam_time)}</Text>
              </View>
            ))}
          </View>

          {settings.instructions_en ? <Text style={s.instrHeader}>{settings.instructions_en}</Text> : null}
          {settings.instructions_hi ? <Text style={s.instrBody}>{settings.instructions_hi}</Text> : null}

          <View style={s.sigRow}>
            <View style={s.sigCell}>
              {settings.controller_signature_url
                ? <PdfImage src={settings.controller_signature_url} style={s.sigImg} />
                : <View style={{ height: 30 }} />}
              <Text style={s.sigLabel}>{settings.left_signer}</Text>
            </View>
            <Text style={s.sigWebsite}>{settings.website}</Text>
            <View style={s.sigCell}>
              {settings.director_signature_url
                ? <PdfImage src={settings.director_signature_url} style={s.sigImg} />
                : <View style={{ height: 30 }} />}
              <Text style={s.sigLabel}>{settings.right_signer}</Text>
            </View>
          </View>
        </View>

        <View style={s.footerWrap}>
          <Text style={s.footerText}>UnSkills Corporate Office: {settings.footer_address}</Text>
        </View>
      </Page>
    </Document>
  )

  return await pdf(Doc).toBlob()
}
