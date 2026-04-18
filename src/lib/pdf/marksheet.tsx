import type { MarksheetSettings, GradeBand } from '../marksheetSettings'

export interface MarksheetSubjectRow {
  subject_id: string
  code: string | null
  name: string
  semester: number | null
  theory_max: number
  theory_obtained: number | null
  practical_max: number
  practical_obtained: number | null
  total: number
}

export interface MarksheetStudent {
  id: string
  registration_no: string
  name: string
  father_name: string
  dob: string | null
  photo_url: string | null
  course_name: string
  course_duration: string
  session: string | null
  enrollment_date: string | null
}

export interface MarksheetCenter {
  name: string
  code: string
  address: string
}

export interface BuildMarksheetInput {
  student: MarksheetStudent
  center: MarksheetCenter
  rows: MarksheetSubjectRow[]
  roll_no: string
  issue_date: string       // YYYY-MM-DD
  serial_no: string
  totals: { totalObtained: number; totalMax: number; percentage: number }
  finalGrade: string
  result: string           // "Pass" / "Fail"
  gradingScheme: GradeBand[]
  settings: MarksheetSettings
  logoDataUrl: string
  /** Ordered list of certification logo data URLs (ISO, MSME, Skill India, NSDC, Digital India, ANSI, IAF). */
  certLogos: string[]
  photoDataUrl: string
  qrDataUrl: string
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

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function semesterLabel(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix} Semester`
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

export async function buildMarksheetPdfBlob(input: BuildMarksheetInput): Promise<Blob> {
  await registerFonts()
  const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

  const {
    student, center, rows, roll_no, issue_date, serial_no,
    totals, finalGrade, gradingScheme, settings,
    logoDataUrl, certLogos, photoDataUrl, qrDataUrl,
  } = input

  const RED = '#C8102E'
  const BLACK = '#0F172A'
  const BORDER = '#111827'
  const BORDER_LIGHT = '#D1D5DB'
  const MUTED = '#4B5563'
  const LIGHT = '#F3F4F6'

  const s = StyleSheet.create({
    page: {
      fontFamily: 'DMSans', fontWeight: 400,
      fontSize: 9,
      color: BLACK,
      backgroundColor: '#FFFFFF',
      padding: 0,
    },

    // Thick decorative border — two strips: red outer + black inner
    frameRed:   { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderWidth: 2.8, borderColor: RED },
    frameBlack: { position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, borderWidth: 1.2, borderColor: BLACK },

    content: { paddingTop: 22, paddingHorizontal: 24, paddingBottom: 26 },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2 },
    logoCol: { width: 66, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
    logo: { width: 56, height: 56, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4, paddingTop: 2 },
    brand: { fontSize: 16.5, fontFamily: 'DMSans', fontWeight: 700, color: BLACK, textAlign: 'center', letterSpacing: 0.6 },
    subLine: { fontSize: 8, color: BLACK, textAlign: 'center', marginTop: 1.2, fontFamily: 'DMSans', fontWeight: 400 },
    rightCol: { width: 86, alignItems: 'flex-end', paddingTop: 4 },
    regLine: { fontSize: 8, color: BLACK, textAlign: 'right', fontFamily: 'DMSans', fontWeight: 700 },

    divider: { marginTop: 6, height: 0.6, backgroundColor: MUTED },

    // Title
    titleBand: { alignItems: 'center', marginTop: 6 },
    titleText: { fontSize: 16, fontFamily: 'DMSans', fontWeight: 700, color: BLACK, letterSpacing: 2.4 },
    sessionText: { fontSize: 9, color: BLACK, marginTop: 2, fontFamily: 'DMSans', fontWeight: 400 },

    // Student info — bordered grid with photo on right
    infoWrap: { marginTop: 7, flexDirection: 'row', borderWidth: 0.8, borderColor: BORDER },
    infoLeft: { flex: 1 },
    infoPhoto: {
      width: 86, alignItems: 'center', justifyContent: 'center',
      padding: 4, borderLeftWidth: 0.8, borderLeftColor: BORDER, backgroundColor: '#FFFFFF',
    },
    infoPhotoImg: { width: 76, height: 88, objectFit: 'cover', borderWidth: 0.6, borderColor: BLACK },
    infoPhotoPlaceholder: {
      width: 76, height: 88, backgroundColor: '#E5E7EB',
      borderWidth: 0.6, borderColor: BLACK, alignItems: 'center', justifyContent: 'center',
    },
    infoRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, minHeight: 16 },
    infoRowLast: { flexDirection: 'row', minHeight: 16 },
    infoCellWrap: { flex: 1, flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 5, alignItems: 'baseline' },
    infoCellDivider: { borderRightWidth: 0.5, borderRightColor: BORDER },
    infoLabel: { fontSize: 8.8, color: BLACK, fontFamily: 'DMSans', fontWeight: 700 },
    infoColon: { fontSize: 8.8, color: BLACK, marginHorizontal: 4, fontFamily: 'DMSans', fontWeight: 700 },
    infoValue: { fontSize: 8.8, color: BLACK, flex: 1 },

    // Marks table
    tableWrap: { marginTop: 6, borderWidth: 0.8, borderColor: BORDER },
    tHeadRow: { flexDirection: 'row', backgroundColor: LIGHT, borderBottomWidth: 0.8, borderBottomColor: BORDER, minHeight: 24 },
    tHeadSubject: {
      flex: 3.2, paddingVertical: 4, paddingHorizontal: 5,
      borderRightWidth: 0.5, borderRightColor: BORDER,
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadGroup: {
      flex: 2, borderRightWidth: 0.5, borderRightColor: BORDER,
      alignItems: 'center', justifyContent: 'center', paddingVertical: 2,
    },
    tHeadTotal: {
      flex: 1, paddingVertical: 4, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadText: { fontSize: 9, fontFamily: 'DMSans', fontWeight: 700, color: BLACK, textAlign: 'center' },
    tHeadSub: { fontSize: 7, color: MUTED, textAlign: 'center', marginTop: 1, fontFamily: 'DMSans', fontWeight: 400 },

    tSemRow: {
      flexDirection: 'row', backgroundColor: '#E5E7EB',
      borderBottomWidth: 0.5, borderBottomColor: BORDER,
      borderTopWidth: 0.5, borderTopColor: BORDER,
    },
    tSemCell: {
      flex: 1, paddingVertical: 2.5, paddingHorizontal: 6,
      fontSize: 8.8, fontFamily: 'DMSans', fontWeight: 700, color: BLACK, textAlign: 'center',
    },

    tRow: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT, minHeight: 15 },
    tCell: {
      paddingVertical: 2.5, paddingHorizontal: 5, fontSize: 8.2, color: BLACK,
      borderRightWidth: 0.5, borderRightColor: BORDER,
    },
    tCellRight: { paddingVertical: 2.5, paddingHorizontal: 5, fontSize: 8.2, color: BLACK, textAlign: 'center' },

    tTotalRow: {
      flexDirection: 'row', borderTopWidth: 0.8, borderTopColor: BORDER,
      backgroundColor: LIGHT,
    },
    tTotalCell: {
      paddingVertical: 3.5, paddingHorizontal: 5, fontSize: 8.8, fontFamily: 'DMSans', fontWeight: 700,
      color: BLACK, borderRightWidth: 0.5, borderRightColor: BORDER, textAlign: 'center',
    },

    // Grading scheme strip
    gradeWrap: { marginTop: 6, borderWidth: 0.8, borderColor: BORDER, flexDirection: 'row' },
    gradeCol: { flex: 1, borderRightWidth: 0.5, borderRightColor: BORDER, alignItems: 'center' },
    gradeColLast: { flex: 1, alignItems: 'center' },
    gradeLbl: {
      fontSize: 8.8, fontFamily: 'DMSans', fontWeight: 700, color: BLACK,
      paddingVertical: 2.5, width: '100%', textAlign: 'center',
      backgroundColor: LIGHT, borderBottomWidth: 0.5, borderBottomColor: BORDER,
    },
    gradeVal: { fontSize: 8.4, color: BLACK, paddingVertical: 3 },

    // Final grade band
    finalWrap: {
      marginTop: 5, borderWidth: 0.8, borderColor: BORDER, backgroundColor: LIGHT,
      paddingVertical: 4.5, alignItems: 'center',
    },
    finalText: { fontSize: 11.5, fontFamily: 'DMSans', fontWeight: 700, color: BLACK, letterSpacing: 0.5 },

    notes: { marginTop: 3, fontSize: 7.5, color: MUTED, textAlign: 'center' },

    // Bottom: QR left, signature right
    bottomRow: { flexDirection: 'row', marginTop: 8, alignItems: 'flex-start', justifyContent: 'space-between' },
    qrBox: { width: 140 },
    qrImg: { width: 64, height: 64, borderWidth: 0.6, borderColor: BLACK, objectFit: 'contain' },
    qrPlaceholder: {
      width: 64, height: 64, borderWidth: 0.6, borderColor: BLACK,
      alignItems: 'center', justifyContent: 'center',
    },
    qrLabel: { fontSize: 7, color: MUTED, textAlign: 'center', marginTop: 2, width: 64 },
    dateIssue: { fontSize: 8, color: BLACK, marginTop: 5 },

    // Signature block — right-anchored with a fixed line width so the name sits centered on it
    sigBox: { width: 190, alignItems: 'center' },
    sigImg: { height: 28, width: 170, objectFit: 'contain' },
    sigPlaceholder: { height: 28, width: 170 },
    sigLine: { width: 190, height: 0.7, backgroundColor: BLACK, marginTop: 2 },
    sigName: {
      fontSize: 9.2, fontFamily: 'DMSans', fontWeight: 700, color: BLACK,
      paddingTop: 2, width: 190, textAlign: 'center',
    },
    sigTitle: { fontSize: 8, color: BLACK, textAlign: 'center', width: 190 },

    // Bottom block — absolutely positioned so cert strip + footer always
    // hug the bottom of the A4 page regardless of content above.
    bottomBlock: {
      position: 'absolute', bottom: 22, left: 24, right: 24,
    },
    certStrip: {
      flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    certLogo: { height: 28, width: 50, objectFit: 'contain' },

    // Footer
    footerLine: {
      marginTop: 6, paddingTop: 4,
      borderTopWidth: 0.5, borderTopColor: BORDER_LIGHT, alignItems: 'center',
    },
    footerText: { fontSize: 7.5, color: BLACK, textAlign: 'center' },
    footerTextBold: { fontSize: 7.5, color: BLACK, textAlign: 'center', fontFamily: 'DMSans', fontWeight: 700 },

    issueRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    issueLabel: { fontSize: 8, color: BLACK, fontFamily: 'DMSans', fontWeight: 700 },
    issueValue: { fontSize: 8, color: BLACK },
  })

  const semesters = Array.from(new Set(rows.map(r => r.semester ?? 0))).sort((a, b) => a - b)

  return await pdf(
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.frameRed} fixed />
        <View style={s.frameBlack} fixed />

        <View style={s.content} wrap={false}>
          {/* Header — institute info only (no student photo here) */}
          <View style={s.headerRow}>
            <View style={s.logoCol}>
              {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logo} /> : null}
            </View>
            <View style={s.middleCol}>
              <Text style={s.brand}>{settings.header_title}</Text>
              {settings.header_subtitle ? <Text style={s.subLine}>{settings.header_subtitle}</Text> : null}
              {settings.header_tagline
                ? settings.header_tagline.split('\n').map((line, i) => (
                    <Text key={i} style={s.subLine}>{line}</Text>
                  ))
                : null}
              {settings.reg_line ? <Text style={s.subLine}>{settings.reg_line}</Text> : null}
            </View>
            <View style={s.rightCol}>
              <Text style={s.regLine}>Reg. No.: {serial_no || '—'}</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Title */}
          <View style={s.titleBand}>
            <Text style={s.titleText}>STATEMENT OF MARKS</Text>
            {student.session ? <Text style={s.sessionText}>Session: {student.session}</Text> : null}
          </View>

          {/* Student info section — photo on right, no photo in header */}
          <View style={s.infoWrap}>
            <View style={s.infoLeft}>
              <View style={s.infoRow}>
                <View style={[s.infoCellWrap, s.infoCellDivider]}>
                  <Text style={s.infoLabel}>Enrollment No</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{student.registration_no}</Text>
                </View>
                <View style={s.infoCellWrap}>
                  <Text style={s.infoLabel}>Roll No</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{roll_no || '—'}</Text>
                </View>
              </View>

              <View style={s.infoRow}>
                <View style={[s.infoCellWrap, s.infoCellDivider]}>
                  <Text style={s.infoLabel}>Training Center</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{center.name || '—'}</Text>
                </View>
                <View style={s.infoCellWrap}>
                  <Text style={s.infoLabel}>Center Code</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{center.code || '—'}</Text>
                </View>
              </View>

              <View style={s.infoRow}>
                <View style={[s.infoCellWrap, s.infoCellDivider]}>
                  <Text style={s.infoLabel}>Course Name</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{student.course_name || '—'}</Text>
                </View>
                <View style={s.infoCellWrap}>
                  <Text style={s.infoLabel}>Course Duration</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{student.course_duration || '—'}</Text>
                </View>
              </View>

              <View style={s.infoRow}>
                <View style={[s.infoCellWrap, s.infoCellDivider]}>
                  <Text style={s.infoLabel}>Student Name</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{student.name}</Text>
                </View>
                <View style={s.infoCellWrap}>
                  <Text style={s.infoLabel}>Father&#39;s Name</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{student.father_name || '—'}</Text>
                </View>
              </View>

              <View style={s.infoRowLast}>
                <View style={[s.infoCellWrap, s.infoCellDivider]}>
                  <Text style={s.infoLabel}>Date of Registration</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{fmtDate(student.enrollment_date)}</Text>
                </View>
                <View style={s.infoCellWrap}>
                  <Text style={s.infoLabel}>Center Address</Text>
                  <Text style={s.infoColon}>:</Text>
                  <Text style={s.infoValue}>{center.address || '—'}</Text>
                </View>
              </View>
            </View>

            <View style={s.infoPhoto}>
              {photoDataUrl
                ? <PdfImage src={photoDataUrl} style={s.infoPhotoImg} />
                : <View style={s.infoPhotoPlaceholder}>
                    <Text style={{ fontSize: 20, color: '#9CA3AF', fontFamily: 'DMSans', fontWeight: 700 }}>
                      {student.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>}
            </View>
          </View>

          {/* Marks table */}
          <View style={s.tableWrap}>
            <View style={s.tHeadRow}>
              <View style={s.tHeadSubject}>
                <Text style={s.tHeadText}>Subject</Text>
              </View>
              <View style={s.tHeadGroup}>
                <Text style={s.tHeadText}>Theory</Text>
                <Text style={s.tHeadSub}>(Max | Obtained)</Text>
              </View>
              <View style={s.tHeadGroup}>
                <Text style={s.tHeadText}>Practical</Text>
                <Text style={s.tHeadSub}>(Max | Obtained)</Text>
              </View>
              <View style={s.tHeadTotal}>
                <Text style={s.tHeadText}>Total</Text>
              </View>
            </View>

            {semesters.map(sem => {
              const list = rows.filter(r => (r.semester ?? 0) === sem)
              if (list.length === 0) return null
              return (
                <View key={`sem-${sem}`}>
                  {sem > 0 ? (
                    <View style={s.tSemRow}>
                      <Text style={s.tSemCell}>{semesterLabel(sem)}</Text>
                    </View>
                  ) : null}
                  {list.map(row => (
                    <View key={row.subject_id} style={s.tRow}>
                      <Text style={[s.tCell, { flex: 3.2 }]}>
                        {row.code ? `${row.code} — ${row.name}` : row.name}
                      </Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>
                        {row.theory_max || '—'}
                      </Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>
                        {row.theory_obtained ?? '—'}
                      </Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>
                        {row.practical_max || '—'}
                      </Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>
                        {row.practical_obtained ?? '—'}
                      </Text>
                      <Text style={[s.tCellRight, { flex: 1 }]}>
                        {row.total || '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            })}

            {/* Totals row */}
            <View style={s.tTotalRow}>
              <Text style={[s.tTotalCell, { flex: 3.2, textAlign: 'left' }]}>Total</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1, borderRightWidth: 0 }]}>
                {totals.totalObtained}
              </Text>
            </View>
          </View>

          {/* Grading scheme */}
          <View style={s.gradeWrap}>
            {gradingScheme.map((band, i) => (
              <View key={band.label} style={i === gradingScheme.length - 1 ? s.gradeColLast : s.gradeCol}>
                <Text style={s.gradeLbl}>{band.label}</Text>
                <Text style={s.gradeVal}>{band.min}%–{band.max}% – {band.grade}</Text>
              </View>
            ))}
          </View>

          {/* Final grade */}
          <View style={s.finalWrap}>
            <Text style={s.finalText}>Final Grade: {finalGrade}</Text>
          </View>

          {settings.notes ? <Text style={s.notes}>{settings.notes}</Text> : null}

          {/* QR + Signature row */}
          <View style={s.bottomRow}>
            <View style={s.qrBox}>
              {qrDataUrl
                ? <PdfImage src={qrDataUrl} style={s.qrImg} />
                : <View style={s.qrPlaceholder}>
                    <Text style={{ fontSize: 7, color: MUTED }}>QR</Text>
                  </View>}
              <Text style={s.qrLabel}>Scan to verify</Text>
              <Text style={s.dateIssue}>
                Date of Issue: <Text style={{ fontFamily: 'DMSans', fontWeight: 700 }}>{fmtDate(issue_date)}</Text>
              </Text>
            </View>

            <View style={s.sigBox}>
              {settings.left_signature_url
                ? <PdfImage src={settings.left_signature_url} style={s.sigImg} />
                : <View style={s.sigPlaceholder} />}
              <View style={s.sigLine} />
              <Text style={s.sigName}>{settings.left_signer_name || '—'}</Text>
              {settings.left_signer_title ? <Text style={s.sigTitle}>{settings.left_signer_title}</Text> : null}
              {settings.left_signer_org ? <Text style={s.sigTitle}>{settings.left_signer_org}</Text> : null}
            </View>
          </View>

        </View>

        {/* Bottom block: cert logos + footer pinned to the bottom of the page */}
        <View style={s.bottomBlock} fixed>
          <View style={s.certStrip}>
            {certLogos.filter(Boolean).map((src, i) => (
              <PdfImage key={i} src={src} style={s.certLogo} />
            ))}
          </View>

          <View style={s.footerLine}>
            <Text style={s.footerTextBold}>
              Head Office Address, <Text style={{ fontFamily: 'DMSans', fontWeight: 400 }}>{settings.footer_address}</Text>
            </Text>
            <Text style={s.footerText}>
              Website for verification: <Text style={{ fontFamily: 'DMSans', fontWeight: 700 }}>{settings.website}</Text>
              {settings.email ? <>  |  Email: <Text style={{ fontFamily: 'DMSans', fontWeight: 700 }}>{settings.email}</Text></> : null}
            </Text>
          </View>
        </View>
      </Page>
    </Document>,
  ).toBlob()
}
