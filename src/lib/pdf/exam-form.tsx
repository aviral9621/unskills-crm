/**
 * Exam form PDF — mirrors admit-card branding.
 * Title swaps to "RETEST EXAMINATION FORM" + a CARRY-FORWARD ribbon for CF.
 */
import type { AdmitCardSettings } from '../admitCardSettings'
import { toDataUrl } from './admit-card'

export interface ExamFormSubject {
  id: string
  name: string
  code: string | null
}

export interface ExamFormStudent {
  registration_no: string
  name: string
  father_name: string | null
  course_name: string
  course_code: string | null
  branch_name: string | null
  branch_code: string | null
  session: string | null
  photo_url: string | null
  phone: string | null
  alt_phone: string | null
  address: string | null
  district: string | null
  state: string | null
  pincode: string | null
}

export interface BuildExamFormPdfInput {
  student: ExamFormStudent
  semester: number
  examSession: string
  formType: 'regular' | 'carry_forward'
  subjects: ExamFormSubject[]
  settings: AdmitCardSettings
  logoDataUrl: string
  isoLogoDataUrl: string
  photoDataUrl: string
  // optional acknowledgement number (set after server insert)
  ackNumber?: string
  submittedOn?: string  // ISO date
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
  fontsRegistered = true
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return new Date().toLocaleDateString('en-GB')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB')
}

export { toDataUrl }

export async function buildExamFormPdfBlob(input: BuildExamFormPdfInput): Promise<Blob> {
  await registerFonts()
  const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } =
    await import('@react-pdf/renderer')

  const {
    student, semester, examSession, formType, subjects,
    settings, logoDataUrl, isoLogoDataUrl, photoDataUrl,
    ackNumber, submittedOn,
  } = input

  const RED = '#C8102E'
  const DARK = '#1A1A2E'
  const BLACK = '#111111'
  const BORDER = '#D1D5DB'
  const MUTED = '#6B7280'
  const BG_ROW = '#F9FAFB'
  const TEAL = '#0D6B5E'
  const GOLD = '#B8962E'
  const AMBER = '#B45309'

  const isCF = formType === 'carry_forward'

  const s = StyleSheet.create({
    page: {
      paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
      fontFamily: 'DMSans', fontSize: 10, color: BLACK, backgroundColor: '#FFFFFF',
    },

    // Top decorative bars (tricolor-inspired)
    topBarGreen: { height: 5, backgroundColor: TEAL },
    topBarGold:  { height: 2, backgroundColor: GOLD },
    topBarWhite: { height: 2, backgroundColor: '#FFFFFF' },
    topBarRed:   { height: 2, backgroundColor: RED },

    headerWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
    logoCol:    { width: 72, alignItems: 'center', justifyContent: 'center' },
    logo:       { width: 58, height: 58, objectFit: 'contain' },
    middleCol:  { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    brand:      { fontSize: 20, fontWeight: 700, color: DARK, letterSpacing: 0.5, textAlign: 'center' },
    subtitleRow:{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 },
    subtitleDash:{ width: 24, height: 1.5, backgroundColor: RED },
    subtitleText:{ fontSize: 9, color: BLACK, fontWeight: 400 },
    certLine:   { fontSize: 8, color: MUTED, marginTop: 4, textAlign: 'center', lineHeight: 1.4 },
    isoCol:     { width: 80, alignItems: 'center', justifyContent: 'center' },
    isoImg:     { width: 72, height: 72, objectFit: 'contain' },

    stripWrap: {
      backgroundColor: '#F8F8F8', borderTopWidth: 1, borderTopColor: BORDER,
      borderBottomWidth: 2, borderBottomColor: RED,
      paddingVertical: 5, paddingHorizontal: 14, alignItems: 'center',
    },
    stripText: { fontSize: 9.5, fontWeight: 700, color: DARK, letterSpacing: 0.3, textAlign: 'center' },

    titleWrap: { alignItems: 'center', marginTop: 10, marginBottom: 6 },
    titleText: { fontSize: 15, fontWeight: 700, color: BLACK, letterSpacing: 1, textAlign: 'center' },
    titleRule: { width: 100, height: 2, backgroundColor: RED, marginTop: 3 },

    typeBadgeWrap: { alignItems: 'center', marginBottom: 8 },
    typeBadge: {
      paddingHorizontal: 10, paddingVertical: 3,
      borderRadius: 3,
      fontSize: 9, fontWeight: 700, letterSpacing: 1,
    },

    sessionLine: { fontSize: 9, color: MUTED, textAlign: 'center', marginBottom: 4 },

    body: { flex: 1, paddingHorizontal: 18, flexDirection: 'column' },

    studentRow: { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, marginTop: 4 },
    studentCol: { flex: 1, borderRightWidth: 1, borderRightColor: BORDER },
    photoCol:   { width: 110, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    photoBox:   { width: 84, height: 100, borderWidth: 1, borderColor: BORDER, objectFit: 'cover' },
    photoPlaceholder: { width: 84, height: 100, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    photoCaption: { fontSize: 7.5, color: MUTED, marginTop: 3 },
    sigBox: { width: 84, height: 28, borderWidth: 1, borderColor: BORDER, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
    sigBoxLbl: { fontSize: 7, color: MUTED },

    tRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 20 },
    tRowLast: { flexDirection: 'row', minHeight: 20 },
    tLbl:     { width: 110, paddingVertical: 4, paddingHorizontal: 7, fontSize: 8.5, color: MUTED, borderRightWidth: 1, borderRightColor: BORDER },
    tVal:     { flex: 1, paddingVertical: 4, paddingHorizontal: 7, fontSize: 8.5, color: BLACK, fontWeight: 700 },

    sectionTitle: { fontSize: 12, fontWeight: 700, color: BLACK, marginTop: 12, letterSpacing: 0.5 },
    sectionRule:  { width: 80, height: 2, backgroundColor: RED, marginTop: 2, marginBottom: 5 },

    subjTable:    { borderWidth: 1, borderColor: BORDER, marginBottom: 6 },
    subjHead:     { flexDirection: 'row', backgroundColor: BG_ROW, borderBottomWidth: 1, borderBottomColor: BORDER },
    subjHeadCell: { paddingVertical: 5, paddingHorizontal: 7, fontSize: 8.5, fontWeight: 700, color: BLACK },
    subjRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
    subjRowLast:  { flexDirection: 'row' },
    subjCell:     { paddingVertical: 4, paddingHorizontal: 7, fontSize: 8.5, color: BLACK },
    checkbox:     { width: 9, height: 9, borderWidth: 1, borderColor: BLACK, marginRight: 6 },
    checked:      { backgroundColor: BLACK },

    declarationWrap: {
      marginTop: 10, padding: 7, borderWidth: 1, borderColor: BORDER, backgroundColor: BG_ROW,
    },
    declarationText: { fontSize: 8.5, color: BLACK, lineHeight: 1.5 },

    sigPusher: { marginTop: 'auto', paddingTop: 12 },
    sigRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, paddingBottom: 10 },
    sigCell: { alignItems: 'center', width: 150 },
    sigLabel: { fontSize: 8.5, fontWeight: 700, color: BLACK, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3, width: 140, textAlign: 'center' },
    sigWebsite: { fontSize: 8.5, color: MUTED, alignSelf: 'center' },

    ackLine: { fontSize: 7.5, color: MUTED, textAlign: 'center', marginBottom: 4 },

    footerWrap: { backgroundColor: RED, paddingVertical: 7, paddingHorizontal: 18, alignItems: 'center' },
    footerText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: 700, textAlign: 'center' },
  })

  const Doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topBarGreen} />
        <View style={s.topBarGold} />
        <View style={s.topBarWhite} />
        <View style={s.topBarRed} />

        {/* Header */}
        <View style={s.headerWrap}>
          <View style={s.logoCol}>
            {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logo} /> : null}
          </View>
          <View style={s.middleCol}>
            <Text style={s.brand}>
              <Text style={{ color: RED }}>UN</Text>
              <Text style={{ color: DARK }}>SKILLS</Text>
              <Text style={{ color: DARK }}> COMPUTER EDUCATION</Text>
            </Text>
            <View style={s.subtitleRow}>
              <View style={s.subtitleDash} />
              <Text style={s.subtitleText}>{settings.header_subtitle}</Text>
              <View style={s.subtitleDash} />
            </View>
            {settings.header_tagline ? <Text style={s.certLine}>{settings.header_tagline}</Text> : null}
          </View>
          <View style={s.isoCol}>
            {isoLogoDataUrl
              ? <PdfImage src={isoLogoDataUrl} style={s.isoImg} />
              : <Text style={{ fontSize: 8, color: '#1A6AB8', textAlign: 'center' }}>{settings.iso_line}</Text>}
          </View>
        </View>

        {settings.header_strip ? (
          <View style={s.stripWrap}>
            <Text style={s.stripText}>{settings.header_strip}</Text>
          </View>
        ) : null}

        {/* Title */}
        <View style={s.titleWrap}>
          <Text style={s.titleText}>
            {isCF ? 'RETEST / CARRY-FORWARD EXAMINATION FORM' : 'EXAMINATION FORM'}
          </Text>
          <View style={s.titleRule} />
        </View>

        <View style={s.typeBadgeWrap}>
          <Text style={[s.typeBadge, {
            color: isCF ? '#FFFFFF' : '#FFFFFF',
            backgroundColor: isCF ? AMBER : TEAL,
          }]}>
            {isCF ? 'CARRY-FORWARD STUDENT' : 'REGULAR STUDENT'}
          </Text>
        </View>

        <Text style={s.sessionLine}>
          Semester {semester} · Session {examSession || '—'}
        </Text>

        <View style={s.body}>
          <View style={s.studentRow}>
            <View style={s.studentCol}>
              <View style={s.tRow}><Text style={s.tLbl}>Registration No</Text><Text style={s.tVal}>{student.registration_no}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Student Name</Text><Text style={s.tVal}>{student.name}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Father{"'"}s Name</Text><Text style={s.tVal}>{student.father_name || '—'}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Course</Text><Text style={s.tVal}>{student.course_name}{student.course_code ? ` (${student.course_code})` : ''}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Semester</Text><Text style={s.tVal}>{semester}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Session</Text><Text style={s.tVal}>{examSession || '—'}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Branch / Centre</Text><Text style={s.tVal}>{student.branch_name || '—'}{student.branch_code ? ` (${student.branch_code})` : ''}</Text></View>
              <View style={s.tRow}><Text style={s.tLbl}>Phone</Text><Text style={s.tVal}>{student.phone || '—'}{student.alt_phone ? ` / ${student.alt_phone}` : ''}</Text></View>
              <View style={s.tRowLast}><Text style={s.tLbl}>Address</Text><Text style={s.tVal}>{[student.address, student.district, student.state, student.pincode].filter(Boolean).join(', ') || '—'}</Text></View>
            </View>
            <View style={s.photoCol}>
              {photoDataUrl
                ? <PdfImage src={photoDataUrl} style={s.photoBox} />
                : <View style={s.photoPlaceholder}><Text style={{ fontSize: 20, color: '#9CA3AF', fontWeight: 700 }}>{student.name.charAt(0).toUpperCase()}</Text></View>}
              <Text style={s.photoCaption}>Candidate Photo</Text>
              <View style={s.sigBox}><Text style={s.sigBoxLbl}>Sign</Text></View>
            </View>
          </View>

          <Text style={s.sectionTitle}>SUBJECTS APPLYING FOR</Text>
          <View style={s.sectionRule} />

          <View style={s.subjTable}>
            <View style={s.subjHead}>
              <Text style={[s.subjHeadCell, { width: 30 }]}>S.No</Text>
              <Text style={[s.subjHeadCell, { width: 70, borderLeftWidth: 1, borderLeftColor: BORDER }]}>Code</Text>
              <Text style={[s.subjHeadCell, { flex: 1, borderLeftWidth: 1, borderLeftColor: BORDER }]}>Subject Name</Text>
              <Text style={[s.subjHeadCell, { width: 60, borderLeftWidth: 1, borderLeftColor: BORDER, textAlign: 'center' }]}>Applied</Text>
            </View>
            {subjects.length === 0 ? (
              <View style={s.subjRowLast}><Text style={[s.subjCell, { flex: 1, textAlign: 'center', color: MUTED }]}>No subjects selected</Text></View>
            ) : subjects.map((sub, idx) => (
              <View key={sub.id} style={idx === subjects.length - 1 ? s.subjRowLast : s.subjRow}>
                <Text style={[s.subjCell, { width: 30 }]}>{idx + 1}.</Text>
                <Text style={[s.subjCell, { width: 70, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{sub.code || '—'}</Text>
                <Text style={[s.subjCell, { flex: 1, borderLeftWidth: 1, borderLeftColor: BORDER }]}>{sub.name}</Text>
                <View style={[s.subjCell, { width: 60, borderLeftWidth: 1, borderLeftColor: BORDER, alignItems: 'center', justifyContent: 'center' }]}>
                  <View style={[s.checkbox, s.checked]} />
                </View>
              </View>
            ))}
          </View>

          <View style={s.declarationWrap}>
            <Text style={s.declarationText}>
              I hereby declare that the particulars given above are true to the best of my knowledge.
              I will abide by the rules and regulations of the institute. I understand that admit card
              and roll number will be issued only after this form is approved by the institute. {isCF
                ? 'I am applying for CARRY-FORWARD examination of the subjects listed above where I previously did not clear the assessment.'
                : 'I am applying as a REGULAR student for all subjects of the current semester listed above.'}
            </Text>
          </View>

          <View style={s.sigPusher}>
            <View style={s.sigRow}>
              <View style={s.sigCell}>
                <View style={{ height: 32 }} />
                <Text style={s.sigLabel}>Student Signature</Text>
              </View>
              <Text style={s.sigWebsite}>{settings.website}</Text>
              <View style={s.sigCell}>
                <View style={{ height: 32 }} />
                <Text style={s.sigLabel}>{settings.right_signer || 'Director / Branch Head'}</Text>
              </View>
            </View>
            {ackNumber ? (
              <Text style={s.ackLine}>
                Acknowledgement: {ackNumber} · Submitted on {fmtDate(submittedOn)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.footerWrap}>
          <Text style={s.footerText}>{settings.footer_address}</Text>
        </View>
      </Page>
    </Document>
  )

  return await pdf(Doc).toBlob()
}
