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
  isoLogoDataUrl: string
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
  await registerFonts()
  const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

  const { student, center, rows, roll_no, issue_date, serial_no, totals, finalGrade, result, gradingScheme, settings, logoDataUrl, isoLogoDataUrl, photoDataUrl } = input

  const ORANGE = '#F97316'
  const DARK = '#111827'
  const BLACK = '#0F0F0F'
  const BORDER = '#D1D5DB'
  const MUTED = '#6B7280'
  const LIGHT = '#F3F4F6'
  const RED = '#C8102E'

  const s = StyleSheet.create({
    page: {
      paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
      fontFamily: 'DMSans', fontSize: 9, color: BLACK, backgroundColor: '#FFFFFF',
    },

    pageBorder: {
      position: 'absolute', top: 8, left: 8, right: 8, bottom: 8,
      borderWidth: 1, borderColor: '#111',
    },

    // Corner triangles
    cornerTL: { position: 'absolute', top: 8, left: 8, width: 44, height: 44, backgroundColor: ORANGE },
    cornerTR: { position: 'absolute', top: 8, right: 8, width: 44, height: 44, backgroundColor: ORANGE },
    cornerTLMask: { position: 'absolute', top: 8, left: 8, width: 0, height: 0, borderStyle: 'solid', borderTopWidth: 0, borderRightWidth: 44, borderBottomWidth: 44, borderLeftWidth: 0, borderTopColor: 'transparent', borderRightColor: '#FFFFFF', borderBottomColor: '#FFFFFF', borderLeftColor: 'transparent' },
    cornerTRMask: { position: 'absolute', top: 8, right: 8, width: 0, height: 0, borderStyle: 'solid', borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 44, borderLeftWidth: 44, borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFFFFF', borderLeftColor: '#FFFFFF' },

    content: { paddingTop: 22, paddingHorizontal: 24, paddingBottom: 18 },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    logoCol: { width: 70, alignItems: 'center', justifyContent: 'center' },
    logo: { width: 60, height: 60, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    brand: { fontSize: 16, fontWeight: 700, color: DARK, textAlign: 'center', letterSpacing: 0.3 },
    subLine: { fontSize: 8.5, color: BLACK, textAlign: 'center', marginTop: 1.5 },
    isoCol: { width: 86, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 },
    regLine: { fontSize: 8, color: BLACK, textAlign: 'right' },

    // Title
    titleBand: { alignItems: 'center', marginTop: 10 },
    titleText: { fontSize: 17, fontWeight: 700, color: BLACK, letterSpacing: 2 },
    sessionText: { fontSize: 9, color: BLACK, marginTop: 2 },

    // Student info table
    infoWrap: { marginTop: 10, flexDirection: 'row', borderWidth: 1, borderColor: BORDER, borderRadius: 2 },
    infoLeft: { flex: 1 },
    infoPhoto: { width: 88, alignItems: 'center', justifyContent: 'center', padding: 6, borderLeftWidth: 1, borderLeftColor: BORDER, backgroundColor: LIGHT },
    infoPhotoImg: { width: 72, height: 82, objectFit: 'cover', borderWidth: 1, borderColor: BORDER },
    infoPhotoPlaceholder: { width: 72, height: 82, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
    infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 18 },
    infoRowLast: { flexDirection: 'row', minHeight: 18 },
    infoCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 6, fontSize: 8.5 },
    infoCellDivider: { borderRightWidth: 1, borderRightColor: BORDER },
    infoLabel: { color: MUTED, fontWeight: 700 },
    infoValue: { color: BLACK, fontWeight: 700 },

    // Marks table
    tableWrap: { marginTop: 10, borderWidth: 1, borderColor: BORDER },
    tHeadRow: { flexDirection: 'row', backgroundColor: LIGHT, borderBottomWidth: 1, borderBottomColor: BORDER },
    tHeadCell: { paddingVertical: 5, paddingHorizontal: 5, fontSize: 8.5, fontWeight: 700, color: BLACK, textAlign: 'center', borderRightWidth: 1, borderRightColor: BORDER },
    tHeadCellLast: { paddingVertical: 5, paddingHorizontal: 5, fontSize: 8.5, fontWeight: 700, color: BLACK, textAlign: 'center' },
    tSubHead: { fontSize: 7.5, color: MUTED, fontWeight: 400 },

    tSemRow: { flexDirection: 'row', backgroundColor: LIGHT, borderBottomWidth: 1, borderBottomColor: BORDER, borderTopWidth: 1, borderTopColor: BORDER },
    tSemCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 8, fontSize: 9, fontWeight: 700, color: BLACK, textAlign: 'center' },

    tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 20 },
    tRowLast: { flexDirection: 'row', minHeight: 20 },
    tCell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8.5, color: BLACK, borderRightWidth: 1, borderRightColor: BORDER },
    tCellLast: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8.5, color: BLACK, textAlign: 'center' },
    tTotalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: LIGHT },
    tTotalCell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8.5, fontWeight: 700, color: BLACK, borderRightWidth: 1, borderRightColor: BORDER, textAlign: 'center' },

    // Grading scheme
    gradeWrap: { marginTop: 10, borderWidth: 1, borderColor: BORDER, flexDirection: 'row' },
    gradeCol: { flex: 1, borderRightWidth: 1, borderRightColor: BORDER, alignItems: 'center' },
    gradeColLast: { flex: 1, alignItems: 'center' },
    gradeLbl: { fontSize: 8.5, fontWeight: 700, color: BLACK, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: BORDER, width: '100%', textAlign: 'center', backgroundColor: LIGHT },
    gradeVal: { fontSize: 8.5, color: BLACK, paddingVertical: 4 },

    // Final grade banner
    finalWrap: { marginTop: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: LIGHT, paddingVertical: 6, alignItems: 'center' },
    finalText: { fontSize: 12, fontWeight: 700, color: BLACK, letterSpacing: 1 },

    notes: { marginTop: 6, fontSize: 8, color: MUTED, textAlign: 'center' },

    // Bottom row: QR + signature
    bottomRow: { flexDirection: 'row', marginTop: 14, alignItems: 'flex-end', justifyContent: 'space-between' },
    qrBox: { alignItems: 'flex-start', width: 140 },
    qrPlaceholder: { width: 86, height: 86, borderWidth: 1, borderColor: BLACK, alignItems: 'center', justifyContent: 'center' },
    qrLabel: { fontSize: 8, color: MUTED, textAlign: 'center', marginTop: 2 },
    issueLabel: { fontSize: 8.5, color: BLACK, marginTop: 8 },
    sigBox: { alignItems: 'center', width: 220 },
    sigImg: { height: 32, width: 150, objectFit: 'contain' },
    sigPlaceholder: { height: 32, width: 150 },
    sigItalic: { fontSize: 10.5, fontWeight: 700, color: BLACK, marginTop: -4, marginBottom: 4 },
    sigName: { fontSize: 9, fontWeight: 700, color: BLACK, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 3, width: 200, textAlign: 'center' },
    sigTitle: { fontSize: 8, color: BLACK, textAlign: 'center' },

    // Cert strip + footer
    certStrip: { flexDirection: 'row', marginTop: 14, alignItems: 'center', justifyContent: 'flex-start', gap: 10 },
    certLogo: { height: 28, width: 60, objectFit: 'contain' },

    footerLine: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: BORDER, alignItems: 'center' },
    footerText: { fontSize: 8, color: BLACK, textAlign: 'center' },
    footerTextBold: { fontSize: 8, color: BLACK, textAlign: 'center', fontWeight: 700 },
  })

  // Group rows by semester, stable order
  const semesters = Array.from(new Set(rows.map(r => r.semester ?? 0))).sort((a, b) => a - b)

  return await pdf(
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.pageBorder} fixed />

        {/* Corner triangles (orange squares masked by a white triangle) */}
        <View style={s.cornerTL} fixed />
        <View style={s.cornerTLMask} fixed />
        <View style={s.cornerTR} fixed />
        <View style={s.cornerTRMask} fixed />

        <View style={s.content}>
          {/* Header */}
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
            <View style={s.isoCol}>
              <Text style={s.regLine}>Reg. No.: {serial_no}</Text>
            </View>
          </View>

          {/* Title */}
          <View style={s.titleBand}>
            <Text style={s.titleText}>STATEMENT OF MARKS</Text>
            {student.session ? <Text style={s.sessionText}>Session: {student.session}</Text> : null}
          </View>

          {/* Student info table */}
          <View style={s.infoWrap}>
            <View style={s.infoLeft}>
              <View style={s.infoRow}>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Enrollment No</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoValue]}>{student.registration_no}</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Roll No</Text>
                <Text style={[s.infoCell, s.infoValue]}>{roll_no || '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Training Center</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoValue]}>{center.name || '—'}</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Center Code</Text>
                <Text style={[s.infoCell, s.infoValue]}>{center.code || '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Course Name</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoValue]}>{student.course_name || '—'}</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Course Duration</Text>
                <Text style={[s.infoCell, s.infoValue]}>{student.course_duration || '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Student Name</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoValue]}>{student.name}</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Father&#39;s Name</Text>
                <Text style={[s.infoCell, s.infoValue]}>{student.father_name || '—'}</Text>
              </View>
              <View style={s.infoRowLast}>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Date of Registration</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoValue]}>{fmtDate(student.enrollment_date)}</Text>
                <Text style={[s.infoCell, s.infoCellDivider, s.infoLabel]}>Center Address</Text>
                <Text style={[s.infoCell, s.infoValue]}>{center.address || '—'}</Text>
              </View>
            </View>
            <View style={s.infoPhoto}>
              {photoDataUrl
                ? <PdfImage src={photoDataUrl} style={s.infoPhotoImg} />
                : <View style={s.infoPhotoPlaceholder}>
                    <Text style={{ fontSize: 18, color: '#9CA3AF', fontWeight: 700 }}>{student.name.charAt(0).toUpperCase()}</Text>
                  </View>}
            </View>
          </View>

          {/* Marks table */}
          <View style={s.tableWrap}>
            <View style={s.tHeadRow}>
              <Text style={[s.tHeadCell, { flex: 3, textAlign: 'left' }]}>Subject</Text>
              <View style={[{ flex: 2, borderRightWidth: 1, borderRightColor: BORDER }]}>
                <Text style={[s.tHeadCell, { borderRightWidth: 0, borderBottomWidth: 0 }]}>Theory</Text>
                <Text style={s.tSubHead}>(Max | Obtained)</Text>
              </View>
              <View style={[{ flex: 2, borderRightWidth: 1, borderRightColor: BORDER }]}>
                <Text style={[s.tHeadCell, { borderRightWidth: 0, borderBottomWidth: 0 }]}>Practical</Text>
                <Text style={s.tSubHead}>(Max | Obtained)</Text>
              </View>
              <Text style={[s.tHeadCellLast, { flex: 1 }]}>Total</Text>
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
                  {list.map((row, idx) => (
                    <View key={row.subject_id} style={idx === list.length - 1 ? s.tRowLast : s.tRow}>
                      <Text style={[s.tCell, { flex: 3 }]}>{row.code ? `${row.code} — ${row.name}` : row.name}</Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>{row.theory_max || '—'}</Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>{row.theory_obtained ?? '—'}</Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>{row.practical_max || '—'}</Text>
                      <Text style={[s.tCell, { flex: 1, textAlign: 'center' }]}>{row.practical_obtained ?? '—'}</Text>
                      <Text style={[s.tCellLast, { flex: 1 }]}>{row.total || '—'}</Text>
                    </View>
                  ))}
                </View>
              )
            })}

            {/* Totals row */}
            <View style={s.tTotalRow}>
              <Text style={[s.tTotalCell, { flex: 3, textAlign: 'left' }]}>Total</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1 }]}>—</Text>
              <Text style={[s.tTotalCell, { flex: 1, borderRightWidth: 0 }]}>{totals.totalObtained}</Text>
            </View>
          </View>

          {/* Grading scheme strip */}
          <View style={s.gradeWrap}>
            {gradingScheme.map((band, i) => (
              <View key={band.label} style={i === gradingScheme.length - 1 ? s.gradeColLast : s.gradeCol}>
                <Text style={s.gradeLbl}>{band.label}</Text>
                <Text style={s.gradeVal}>{band.min}%–{band.max}% – {band.grade}</Text>
              </View>
            ))}
          </View>

          {/* Final grade banner */}
          <View style={s.finalWrap}>
            <Text style={s.finalText}>Final Grade: {finalGrade}  ·  Result: {result}  ·  {totals.percentage.toFixed(2)}%</Text>
          </View>

          {settings.notes ? <Text style={s.notes}>{settings.notes}</Text> : null}

          {/* Bottom: QR + Signature */}
          <View style={s.bottomRow}>
            <View style={s.qrBox}>
              <View style={s.qrPlaceholder}>
                <Text style={{ fontSize: 7, color: MUTED, textAlign: 'center' }}>{'QR\nCode'}</Text>
              </View>
              <Text style={s.issueLabel}>Date of Issue: <Text style={{ fontWeight: 700 }}>{fmtDate(issue_date)}</Text></Text>
            </View>

            <View style={s.sigBox}>
              {settings.left_signature_url
                ? <PdfImage src={settings.left_signature_url} style={s.sigImg} />
                : <Text style={s.sigItalic}>{settings.left_signer_name}</Text>}
              <Text style={s.sigName}>{settings.left_signer_name || '—'}</Text>
              {settings.left_signer_title ? <Text style={s.sigTitle}>{settings.left_signer_title}</Text> : null}
              {settings.left_signer_org ? <Text style={s.sigTitle}>{settings.left_signer_org}</Text> : null}
            </View>
          </View>

          {/* Cert strip */}
          {isoLogoDataUrl ? (
            <View style={s.certStrip}>
              <PdfImage src={isoLogoDataUrl} style={s.certLogo} />
            </View>
          ) : null}

          {/* Footer lines */}
          <View style={s.footerLine}>
            <Text style={s.footerTextBold}>
              Head Office Address, <Text style={{ fontWeight: 400 }}>{settings.footer_address}</Text>
            </Text>
            <Text style={s.footerText}>
              Website for verification: <Text style={{ color: RED }}>{settings.website}</Text>
              {settings.email ? <>  |  Email: <Text style={{ color: RED }}>{settings.email}</Text></> : null}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  ).toBlob()
}
