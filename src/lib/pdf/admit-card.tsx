// Admit-card PDF generator.
// Renders an A4 admit card matching the reference design:
// red accent bars, logo+company heading, student details table with photo,
// exam schedule table, bilingual instructions, signature line, red footer.
//
// Custom fonts (DM Sans for English, Noto Sans Devanagari for Hindi) are
// registered on first call. This requires globalThis.Buffer to be polyfilled
// (done in main.tsx).

import type { AdmitCardSettings } from '../admitCardSettings'

export interface AdmitCardSchedule {
  subject_id: string
  subject_name: string
  date: string          // YYYY-MM-DD
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
  logoDataUrl: string       // '/MAIN LOGO FOR ALL CARDS.png' converted to data-url
  photoDataUrl: string      // student photo converted to data-url (or empty)
}

// Registered flag so Font.register runs only once per browser session.
let fontsRegistered = false

async function registerFonts() {
  if (fontsRegistered) return
  const { Font } = await import('@react-pdf/renderer')
  try {
    // DM Sans — English body font. Google Fonts TTF endpoints.
    Font.register({
      family: 'DMSans',
      fonts: [
        { src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZaIGDWCBl0O8Q.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Cp2ywxg089UriAWCrCBamC2QX.ttf',   fontWeight: 700 },
      ],
    })
    // Noto Sans Devanagari — Hindi instructions.
    Font.register({
      family: 'NotoDevanagari',
      fonts: [
        { src: 'https://fonts.gstatic.com/s/notosansdevanagari/v26/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHjbL_08AlXQly-AzoFoW4Ow.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/notosansdevanagari/v26/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHjbL_08AlXQly-AzodoV4Ow.ttf', fontWeight: 700 },
      ],
    })
    fontsRegistered = true
  } catch {
    // If CDN is unreachable, @react-pdf falls back to Helvetica.
    fontsRegistered = true
  }
}

/** Convert a same-origin or Supabase-public URL to a data URL for @react-pdf. */
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

/** Format YYYY-MM-DD to "DD MMM YYYY" (e.g. "20 Nov 2023"). */
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

/** Format HH:MM[:SS] to "HH:MM AM/PM". */
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

  const { student, center, schedule, settings, logoDataUrl, photoDataUrl } = input

  const RED = '#C8102E'
  const BLACK = '#111111'
  const BORDER = '#D1D5DB'
  const MUTED = '#6B7280'
  const BG_ROW = '#F9FAFB'

  const s = StyleSheet.create({
    page: {
      paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
      fontFamily: 'DMSans', fontSize: 10, color: BLACK, backgroundColor: '#FFFFFF',
    },

    topBarRed:    { height: 10, backgroundColor: RED },
    topBarWhite:  { height: 3,  backgroundColor: '#FFFFFF' },
    topBarRed2:   { height: 3,  backgroundColor: RED },

    headerWrap: {
      flexDirection: 'row', alignItems: 'center', padding: 14,
      borderBottomWidth: 1, borderBottomColor: BORDER,
    },
    logoCol: { width: 76, alignItems: 'center', justifyContent: 'center' },
    logo:    { width: 60, height: 60, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    brand:    { fontSize: 22, fontWeight: 700, color: BLACK, letterSpacing: 0.5 },
    subtitle: { fontSize: 10, color: BLACK, marginTop: 2, fontWeight: 700 },
    tagline:  { fontSize: 7, color: MUTED, marginTop: 3, textAlign: 'center', lineHeight: 1.3 },
    isoCol:   { width: 96, alignItems: 'center' },
    isoText:  { fontSize: 9, color: BLACK, textAlign: 'center', fontWeight: 400, lineHeight: 1.3 },

    titleWrap:  { alignItems: 'center', marginTop: 10, marginBottom: 6 },
    titleText:  { fontSize: 16, fontWeight: 700, color: BLACK, letterSpacing: 1 },
    titleRule:  { width: 90, height: 2, backgroundColor: RED, marginTop: 3 },

    body: { paddingHorizontal: 18 },
    studentRow: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, marginTop: 8 },
    studentCol: { flex: 1, borderRightWidth: 1, borderRightColor: BORDER },
    photoCol:   { width: 120, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    photoBox:   { width: 92, height: 108, borderWidth: 1, borderColor: BORDER, objectFit: 'cover' },
    photoPlaceholder: { width: 92, height: 108, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    photoCaption: { fontSize: 8, color: MUTED, marginTop: 4 },

    tRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 22 },
    tRowLast:{ flexDirection: 'row', minHeight: 22 },
    tLbl:    { width: 120, paddingVertical: 5, paddingHorizontal: 8, fontSize: 9, color: BLACK, borderRightWidth: 1, borderRightColor: BORDER },
    tVal:    { flex: 1, paddingVertical: 5, paddingHorizontal: 8, fontSize: 9, color: BLACK, fontWeight: 700 },

    sectionTitle: { fontSize: 13, fontWeight: 700, color: BLACK, marginTop: 14, letterSpacing: 0.5 },
    sectionRule:  { width: 100, height: 2, backgroundColor: RED, marginTop: 2, marginBottom: 6 },

    schTable:  { borderWidth: 1, borderColor: BORDER, marginBottom: 6 },
    schHeader: { flexDirection: 'row', backgroundColor: BG_ROW, borderBottomWidth: 1, borderBottomColor: BORDER },
    schHeadCell: { paddingVertical: 5, paddingHorizontal: 8, fontSize: 9, fontWeight: 700, color: BLACK },
    schRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
    schRowLast:{ flexDirection: 'row' },
    schCell:   { paddingVertical: 5, paddingHorizontal: 8, fontSize: 9, color: BLACK },

    instrHeader: { fontSize: 10, fontWeight: 700, color: BLACK, marginTop: 12, marginBottom: 5 },
    instrBody:   { fontFamily: 'NotoDevanagari', fontSize: 8.5, color: BLACK, lineHeight: 1.6 },

    sigRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22, paddingHorizontal: 4 },
    sigCell: { alignItems: 'center', width: 160 },
    sigWebsite: { fontSize: 9, color: MUTED, alignSelf: 'center' },
    sigLabel: { fontSize: 9, fontWeight: 700, color: BLACK },

    footerWrap: { marginTop: 14, backgroundColor: RED, paddingVertical: 8, paddingHorizontal: 18 },
    footerText: { color: '#FFFFFF', fontSize: 9, fontWeight: 700 },
  })

  const Doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topBarRed} />
        <View style={s.topBarWhite} />
        <View style={s.topBarRed2} />

        <View style={s.headerWrap}>
          <View style={s.logoCol}>
            {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logo} /> : null}
          </View>
          <View style={s.middleCol}>
            <Text style={s.brand}>{settings.header_title}</Text>
            <Text style={s.subtitle}>{settings.header_subtitle}</Text>
            {settings.header_tagline ? <Text style={s.tagline}>{settings.header_tagline}</Text> : null}
          </View>
          <View style={s.isoCol}>
            <Text style={s.isoText}>{settings.iso_line}</Text>
          </View>
        </View>

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
                : <View style={s.photoPlaceholder}><Text style={{ fontSize: 22, color: '#9CA3AF', fontWeight: 700 }}>{student.name.charAt(0).toUpperCase()}</Text></View>}
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
                <Text style={[s.schCell, { flex: 2 }]}>{row.date || '—'}</Text>
                <Text style={[s.schCell, { flex: 3, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{row.subject_name}</Text>
                <Text style={[s.schCell, { flex: 2, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{fmtTime(row.reporting_time)}</Text>
                <Text style={[s.schCell, { flex: 2, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{fmtTime(row.exam_time)}</Text>
              </View>
            ))}
          </View>

          {settings.instructions_en ? <Text style={s.instrHeader}>{settings.instructions_en}</Text> : null}
          {settings.instructions_hi ? <Text style={s.instrBody}>{settings.instructions_hi}</Text> : null}

          <View style={s.sigRow}>
            <View style={s.sigCell}><Text style={s.sigLabel}>{settings.left_signer}</Text></View>
            <Text style={s.sigWebsite}>{settings.website}</Text>
            <View style={s.sigCell}><Text style={s.sigLabel}>{settings.right_signer}</Text></View>
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
