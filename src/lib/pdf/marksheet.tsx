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

export async function buildMarksheetPdfBlob(input: BuildMarksheetInput): Promise<Blob> {
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
      fontFamily: 'Helvetica',
      fontSize: 9,
      color: BLACK,
      backgroundColor: '#FFFFFF',
      padding: 0,
    },

    // Thick decorative border — four concentric strips: red, black, red, black
    frameRed1:   { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderWidth: 2.2, borderColor: RED },
    frameBlack1: { position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, borderWidth: 1.5, borderColor: BLACK },
    frameRed2:   { position: 'absolute', top: 18, left: 18, right: 18, bottom: 18, borderWidth: 1.2, borderColor: RED },
    frameBlack2: { position: 'absolute', top: 21, left: 21, right: 21, bottom: 21, borderWidth: 0.8, borderColor: BLACK },

    content: { paddingTop: 28, paddingHorizontal: 28, paddingBottom: 20 },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
    logoCol: { width: 74, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
    logo: { width: 64, height: 64, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 6, paddingTop: 2 },
    brand: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center', letterSpacing: 0.6 },
    subLine: { fontSize: 8.5, color: BLACK, textAlign: 'center', marginTop: 1.5 },
    rightCol: { width: 96, alignItems: 'flex-end', paddingTop: 6 },
    regLine: { fontSize: 8.5, color: BLACK, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

    divider: { marginTop: 8, height: 0.8, backgroundColor: MUTED },

    // Title
    titleBand: { alignItems: 'center', marginTop: 10 },
    titleText: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: 2.4 },
    sessionText: { fontSize: 9.5, color: BLACK, marginTop: 3 },

    // Student info — bordered grid with photo on right
    infoWrap: { marginTop: 10, flexDirection: 'row', borderWidth: 0.8, borderColor: BORDER },
    infoLeft: { flex: 1 },
    infoPhoto: {
      width: 98, alignItems: 'center', justifyContent: 'center',
      padding: 6, borderLeftWidth: 0.8, borderLeftColor: BORDER, backgroundColor: '#FFFFFF',
    },
    infoPhotoImg: { width: 84, height: 98, objectFit: 'cover', borderWidth: 0.6, borderColor: BLACK },
    infoPhotoPlaceholder: {
      width: 84, height: 98, backgroundColor: '#E5E7EB',
      borderWidth: 0.6, borderColor: BLACK, alignItems: 'center', justifyContent: 'center',
    },
    infoRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER, minHeight: 18 },
    infoRowLast: { flexDirection: 'row', minHeight: 18 },
    infoCellWrap: { flex: 1, flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 6, alignItems: 'baseline' },
    infoCellDivider: { borderRightWidth: 0.5, borderRightColor: BORDER },
    infoLabel: { fontSize: 8.8, color: BLACK, fontFamily: 'Helvetica-Bold' },
    infoColon: { fontSize: 8.8, color: BLACK, marginHorizontal: 4, fontFamily: 'Helvetica-Bold' },
    infoValue: { fontSize: 8.8, color: BLACK, flex: 1 },

    // Marks table
    tableWrap: { marginTop: 9, borderWidth: 0.8, borderColor: BORDER },
    tHeadRow: { flexDirection: 'row', backgroundColor: LIGHT, borderBottomWidth: 0.8, borderBottomColor: BORDER, minHeight: 28 },
    tHeadSubject: {
      flex: 3.2, paddingVertical: 5, paddingHorizontal: 5,
      borderRightWidth: 0.5, borderRightColor: BORDER,
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadGroup: {
      flex: 2, borderRightWidth: 0.5, borderRightColor: BORDER,
      alignItems: 'center', justifyContent: 'center', paddingVertical: 3,
    },
    tHeadTotal: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadText: { fontSize: 9.2, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center' },
    tHeadSub: { fontSize: 7.4, color: MUTED, textAlign: 'center', marginTop: 1.5 },

    tSemRow: {
      flexDirection: 'row', backgroundColor: '#E5E7EB',
      borderBottomWidth: 0.5, borderBottomColor: BORDER,
      borderTopWidth: 0.5, borderTopColor: BORDER,
    },
    tSemCell: {
      flex: 1, paddingVertical: 3.5, paddingHorizontal: 6,
      fontSize: 9.2, fontFamily: 'Helvetica-Bold', color: BLACK, textAlign: 'center',
    },

    tRow: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: BORDER_LIGHT, minHeight: 18 },
    tCell: {
      paddingVertical: 3.5, paddingHorizontal: 5, fontSize: 8.5, color: BLACK,
      borderRightWidth: 0.5, borderRightColor: BORDER,
    },
    tCellRight: { paddingVertical: 3.5, paddingHorizontal: 5, fontSize: 8.5, color: BLACK, textAlign: 'center' },

    tTotalRow: {
      flexDirection: 'row', borderTopWidth: 0.8, borderTopColor: BORDER,
      backgroundColor: LIGHT,
    },
    tTotalCell: {
      paddingVertical: 4.5, paddingHorizontal: 5, fontSize: 9, fontFamily: 'Helvetica-Bold',
      color: BLACK, borderRightWidth: 0.5, borderRightColor: BORDER, textAlign: 'center',
    },

    // Grading scheme strip
    gradeWrap: { marginTop: 9, borderWidth: 0.8, borderColor: BORDER, flexDirection: 'row' },
    gradeCol: { flex: 1, borderRightWidth: 0.5, borderRightColor: BORDER, alignItems: 'center' },
    gradeColLast: { flex: 1, alignItems: 'center' },
    gradeLbl: {
      fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLACK,
      paddingVertical: 3.5, width: '100%', textAlign: 'center',
      backgroundColor: LIGHT, borderBottomWidth: 0.5, borderBottomColor: BORDER,
    },
    gradeVal: { fontSize: 8.8, color: BLACK, paddingVertical: 4 },

    // Final grade band
    finalWrap: {
      marginTop: 7, borderWidth: 0.8, borderColor: BORDER, backgroundColor: LIGHT,
      paddingVertical: 6, alignItems: 'center',
    },
    finalText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BLACK, letterSpacing: 0.6 },

    notes: { marginTop: 5, fontSize: 8, color: MUTED, textAlign: 'center' },

    // Bottom: QR left, signature right
    bottomRow: { flexDirection: 'row', marginTop: 12, alignItems: 'flex-start', justifyContent: 'space-between' },
    qrBox: { width: 150 },
    qrImg: { width: 76, height: 76, borderWidth: 0.6, borderColor: BLACK, objectFit: 'contain' },
    qrPlaceholder: {
      width: 76, height: 76, borderWidth: 0.6, borderColor: BLACK,
      alignItems: 'center', justifyContent: 'center',
    },
    qrLabel: { fontSize: 7, color: MUTED, textAlign: 'center', marginTop: 2, width: 76 },
    dateIssue: { fontSize: 8.5, color: BLACK, marginTop: 8 },

    // Signature block — right-anchored with a fixed line width so the name sits centered on it
    sigBox: { width: 200, alignItems: 'center' },
    sigImg: { height: 32, width: 180, objectFit: 'contain' },
    sigPlaceholder: { height: 32, width: 180 },
    sigLine: { width: 200, height: 0.7, backgroundColor: BLACK, marginTop: 2 },
    sigName: {
      fontSize: 9.6, fontFamily: 'Helvetica-Bold', color: BLACK,
      paddingTop: 3, width: 200, textAlign: 'center',
    },
    sigTitle: { fontSize: 8.2, color: BLACK, textAlign: 'center', width: 200 },

    // Certification logos strip — seven individual logos, evenly spaced
    certStrip: {
      marginTop: 10, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 6,
    },
    certLogo: { height: 34, width: 56, objectFit: 'contain' },

    // Footer
    footerLine: {
      marginTop: 8, paddingTop: 6,
      borderTopWidth: 0.5, borderTopColor: BORDER_LIGHT, alignItems: 'center',
    },
    footerText: { fontSize: 8, color: BLACK, textAlign: 'center' },
    footerTextBold: { fontSize: 8, color: BLACK, textAlign: 'center', fontFamily: 'Helvetica-Bold' },

    issueRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    issueLabel: { fontSize: 8, color: BLACK, fontFamily: 'Helvetica-Bold' },
    issueValue: { fontSize: 8, color: BLACK },
  })

  const semesters = Array.from(new Set(rows.map(r => r.semester ?? 0))).sort((a, b) => a - b)

  return await pdf(
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.frameRed1} fixed />
        <View style={s.frameBlack1} fixed />
        <View style={s.frameRed2} fixed />
        <View style={s.frameBlack2} fixed />

        <View style={s.content}>
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
                    <Text style={{ fontSize: 20, color: '#9CA3AF', fontFamily: 'Helvetica-Bold' }}>
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
                Date of Issue: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmtDate(issue_date)}</Text>
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

          {/* Certification logos strip — ISO / MSME / Skill India / NSDC / Digital India / ANSI / IAF */}
          <View style={s.certStrip}>
            {certLogos.filter(Boolean).map((src, i) => (
              <PdfImage key={i} src={src} style={s.certLogo} />
            ))}
          </View>

          {/* Footer */}
          <View style={s.footerLine}>
            <Text style={s.footerTextBold}>
              Head Office Address, <Text style={{ fontFamily: 'Helvetica' }}>{settings.footer_address}</Text>
            </Text>
            <Text style={s.footerText}>
              Website for verification: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings.website}</Text>
              {settings.email ? <>  |  Email: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{settings.email}</Text></> : null}
            </Text>
          </View>
        </View>
      </Page>
    </Document>,
  ).toBlob()
}
