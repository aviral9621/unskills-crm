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

// ─── Design tokens ──────────────────────────────────────────────────────────
const colors = {
  pageBg: '#FDFBF5',            // cream ivory (page paper tone)
  blockTint: '#FBF7EC',         // subtle cream for grouped blocks
  borderPrimary: '#8B1A2B',     // deep maroon (frame, section bands)
  borderAccent: '#C8102E',      // bright red (SKILLS, inner accent)
  borderSoft: '#D4C9B0',        // muted gold-beige (table/field lines)
  accentGold: '#B8860B',        // decorative gold
  gradeHighlight: '#F4C430',    // bright gold for the Grade letter
  textPrimary: '#0A0A0A',
  textSecondary: '#4A4A4A',
  textLabel: '#6B5E3C',         // warm brown-gold for labels
  semesterTint: '#F4E8D0',      // warm gold-tint for semester dividers
  white: '#FFFFFF',
  // Grade legend dots
  green: '#16A34A',
  greenLight: '#22C55E',
  amber: '#EAB308',
  orange: '#F97316',
  red: '#DC2626',
}

const LEGEND_DOT_COLORS = [
  colors.green,
  colors.greenLight,
  colors.amber,
  colors.orange,
  colors.red,
]

export async function buildMarksheetPdfBlob(input: BuildMarksheetInput): Promise<Blob> {
  await registerFonts()
  const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet, Svg, Path, Line, Circle } = await import('@react-pdf/renderer')

  const {
    student, center, rows, roll_no, issue_date, serial_no,
    totals, finalGrade, gradingScheme, settings,
    logoDataUrl, certLogos, photoDataUrl, qrDataUrl,
  } = input

  const s = StyleSheet.create({
    page: {
      fontFamily: 'DMSans', fontWeight: 400,
      fontSize: 9,
      color: colors.textPrimary,
      backgroundColor: colors.pageBg,
      padding: 24,
    },

    // Outer + inner frames (double-border, nested Views)
    frameOuter: {
      borderWidth: 2,
      borderStyle: 'solid',
      borderColor: colors.borderPrimary,
      padding: 4,
    },
    frameInner: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.borderAccent,
      padding: 14,
    },

    // ─── Header ───────────────────────────────────────────────────────────
    headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
    logoCol: { width: 64, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
    logo: { width: 54, height: 54, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    brandTitle: {
      fontSize: 22, fontFamily: 'DMSans', fontWeight: 700,
      textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase',
    },
    subLine: {
      fontSize: 8.5, color: colors.textSecondary,
      textAlign: 'center', lineHeight: 1.5,
      fontFamily: 'DMSans', fontWeight: 400,
    },
    rightCol: { width: 92, alignItems: 'flex-end', paddingTop: 4 },
    regLine: {
      fontSize: 8.5, color: colors.textPrimary, textAlign: 'right',
      fontFamily: 'DMSans', fontWeight: 700,
    },

    // ─── Title band ───────────────────────────────────────────────────────
    titleBand: { alignItems: 'center', marginTop: 10 },
    titleText: {
      fontSize: 16, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.textPrimary, letterSpacing: 4, textTransform: 'uppercase',
      marginBottom: 4,
    },
    sessionText: {
      fontSize: 10, color: colors.textSecondary,
      textAlign: 'center', marginTop: 2,
      fontFamily: 'DMSans', fontWeight: 400,
    },

    // ─── Student info block ──────────────────────────────────────────────
    infoWrap: {
      marginTop: 10, flexDirection: 'row',
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
      backgroundColor: colors.blockTint,
    },
    infoLeft: { flex: 1 },
    infoPhotoCell: {
      width: 92, alignItems: 'center', justifyContent: 'center',
      padding: 6, borderLeftWidth: 1, borderLeftColor: colors.borderSoft,
      backgroundColor: colors.pageBg,
    },
    infoPhotoImg: {
      width: 80, height: 92, objectFit: 'cover',
      borderWidth: 2, borderStyle: 'solid', borderColor: colors.borderPrimary,
      borderRadius: 2,
    },
    infoPhotoPlaceholder: {
      width: 80, height: 92, backgroundColor: '#EDE5D0',
      borderWidth: 2, borderStyle: 'solid', borderColor: colors.borderPrimary,
      borderRadius: 2, alignItems: 'center', justifyContent: 'center',
    },
    infoRow: {
      flexDirection: 'row',
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    infoRowLast: { flexDirection: 'row' },
    infoCellWrap: {
      flex: 1, flexDirection: 'row',
      paddingVertical: 5, paddingHorizontal: 9,
      alignItems: 'baseline',
    },
    infoCellDivider: { borderRightWidth: 1, borderRightColor: colors.borderSoft },
    infoLabel: { fontSize: 9, color: colors.textLabel, fontFamily: 'DMSans', fontWeight: 700 },
    infoColon: { fontSize: 9, color: colors.textLabel, marginHorizontal: 4, fontFamily: 'DMSans', fontWeight: 700 },
    infoValue: { fontSize: 10, color: colors.textPrimary, flex: 1, fontFamily: 'DMSans', fontWeight: 700 },

    // ─── Marks table ─────────────────────────────────────────────────────
    tableWrap: {
      marginTop: 10,
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
    },
    tHeadRow: {
      flexDirection: 'row', backgroundColor: colors.borderPrimary,
      minHeight: 26,
    },
    tHeadSubject: {
      flex: 3.2, paddingVertical: 6, paddingHorizontal: 8,
      borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadGroup: {
      flex: 2, borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
      alignItems: 'center', justifyContent: 'center', paddingVertical: 4,
    },
    tHeadTotal: {
      flex: 1, paddingVertical: 6, paddingHorizontal: 6,
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadText: {
      fontSize: 10, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'center',
      textTransform: 'uppercase', letterSpacing: 0.8,
    },
    tHeadSub: {
      fontSize: 7.5, color: '#FFFFFFCC', textAlign: 'center', marginTop: 1.5,
      fontFamily: 'DMSans', fontWeight: 400,
    },

    tSemRow: {
      flexDirection: 'row',
      backgroundColor: colors.semesterTint,
      borderTopWidth: 1, borderTopColor: colors.borderSoft,
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    tSemCell: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 8,
      fontSize: 10, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.textLabel, textAlign: 'center',
    },

    tRow: {
      flexDirection: 'row',
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
      minHeight: 18,
    },
    tCellSubject: {
      flex: 3.2, paddingVertical: 5, paddingHorizontal: 8,
      fontSize: 9, color: '#1A1A1A',
      fontFamily: 'DMSans', fontWeight: 400, textAlign: 'left',
      borderRightWidth: 0.6, borderRightColor: colors.borderSoft,
    },
    tCellNum: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 8,
      fontSize: 9, color: colors.textPrimary,
      fontFamily: 'DMSans', fontWeight: 700, textAlign: 'right',
      borderRightWidth: 0.6, borderRightColor: colors.borderSoft,
    },
    tCellNumLast: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 8,
      fontSize: 9, color: colors.textPrimary,
      fontFamily: 'DMSans', fontWeight: 700, textAlign: 'right',
    },

    tTotalRow: {
      flexDirection: 'row', backgroundColor: colors.borderPrimary,
      minHeight: 22,
    },
    tTotalCellLabel: {
      flex: 3.2, paddingVertical: 7, paddingHorizontal: 10,
      fontSize: 11, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'left',
      textTransform: 'uppercase', letterSpacing: 0.8,
      borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
    },
    tTotalCellNum: {
      flex: 1, paddingVertical: 7, paddingHorizontal: 8,
      fontSize: 11, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'right',
      borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
    },
    tTotalCellNumLast: {
      flex: 1, paddingVertical: 7, paddingHorizontal: 8,
      fontSize: 11, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'right',
    },

    // ─── Grade legend ────────────────────────────────────────────────────
    legendWrap: {
      marginTop: 10,
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
      backgroundColor: colors.blockTint,
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 8, paddingHorizontal: 10,
    },
    legendCol: { flex: 1, alignItems: 'center' },
    legendLabelRow: { flexDirection: 'row', alignItems: 'center' },
    legendLabelText: {
      fontSize: 9, fontFamily: 'DMSans', fontWeight: 700, color: colors.textPrimary,
      marginLeft: 4,
    },
    legendRange: {
      fontSize: 8, color: colors.textSecondary,
      fontFamily: 'DMSans', fontWeight: 400, marginTop: 2,
    },

    // ─── Final grade banner ──────────────────────────────────────────────
    finalWrap: {
      marginTop: 10, backgroundColor: colors.borderPrimary,
      paddingVertical: 12, alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center',
    },
    finalLabel: {
      fontSize: 15, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, letterSpacing: 2, textTransform: 'uppercase',
    },
    finalValue: {
      fontSize: 20, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.gradeHighlight, marginLeft: 8,
    },

    notes: { marginTop: 5, fontSize: 8, color: colors.textSecondary, textAlign: 'center' },

    // ─── QR + Signature row ──────────────────────────────────────────────
    bottomRow: {
      flexDirection: 'row', marginTop: 12,
      alignItems: 'flex-start', justifyContent: 'space-between',
    },
    qrBox: { width: 150 },
    qrFrame: {
      padding: 4,
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
      backgroundColor: colors.white,
      width: 78, alignItems: 'center', justifyContent: 'center',
    },
    qrImg: { width: 70, height: 70, objectFit: 'contain' },
    qrPlaceholder: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
    qrLabel: {
      fontSize: 8.5, color: colors.textLabel,
      fontFamily: 'DMSans', fontWeight: 700,
      marginTop: 4, width: 78, textAlign: 'center',
    },
    dateIssue: {
      fontSize: 8.5, color: colors.textLabel,
      fontFamily: 'DMSans', fontWeight: 700, marginTop: 6,
    },

    sigBox: { width: 200, alignItems: 'flex-end' },
    sigImg: { height: 32, width: 160, objectFit: 'contain' },
    sigPlaceholder: { height: 32, width: 160 },
    sigLine: {
      width: 140, borderTopWidth: 1, borderTopStyle: 'solid',
      borderTopColor: colors.borderPrimary,
      marginBottom: 4, alignSelf: 'flex-end',
    },
    sigName: {
      fontSize: 10.5, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.textPrimary, textAlign: 'right', width: 200,
    },
    sigTitle: {
      fontSize: 9, fontFamily: 'DMSans', fontWeight: 400,
      color: colors.textSecondary, textAlign: 'right', width: 200,
    },

    // ─── Certification strip ─────────────────────────────────────────────
    certStrip: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-around',
      paddingVertical: 10, paddingHorizontal: 16,
      backgroundColor: colors.blockTint,
      borderTopWidth: 1, borderTopColor: colors.borderSoft,
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    certLogo: { height: 30, width: 54, objectFit: 'contain' },

    // ─── Footer ──────────────────────────────────────────────────────────
    footerLine: {
      marginTop: 10, alignItems: 'center',
    },
    footerText: {
      fontSize: 8.5, color: colors.textSecondary,
      fontFamily: 'DMSans', fontWeight: 400,
      textAlign: 'center', lineHeight: 1.5,
    },
    footerBold: {
      fontFamily: 'DMSans', fontWeight: 700, color: colors.textPrimary,
    },
    footerBullet: {
      fontFamily: 'DMSans', fontWeight: 700, color: colors.borderPrimary,
    },
  })

  // Build a flat zebra counter so subject rows alternate regardless of
  // semester boundaries (spec requirement §8).
  let zebraIdx = 0
  const semesters = Array.from(new Set(rows.map(r => r.semester ?? 0))).sort((a, b) => a - b)

  return await pdf(
    <Document>
      <Page size="A4" style={s.page}>
        {/* Double-border frame: outer maroon (2pt) → 4pt cream gap → inner red (1pt) → 14pt content padding */}
        <View style={s.frameOuter}>
          <View style={s.frameInner}>

            {/* Header — institute info only */}
            <View style={s.headerRow}>
              <View style={s.logoCol}>
                {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logo} /> : null}
              </View>
              <View style={s.middleCol}>
                <Text style={s.brandTitle}>
                  <Text style={{ color: colors.textPrimary }}>UN</Text>
                  <Text style={{ color: colors.borderAccent }}>SKILLS</Text>
                  <Text style={{ color: colors.textPrimary }}> COMPUTER EDUCATION</Text>
                </Text>
                {settings.header_subtitle ? <Text style={s.subLine}>{settings.header_subtitle}</Text> : null}
                {settings.header_tagline
                  ? settings.header_tagline.split('\n').map((line, i) => (
                      <Text key={i} style={s.subLine}>{line}</Text>
                    ))
                  : null}
                {settings.reg_line ? <Text style={s.subLine}>{settings.reg_line}</Text> : null}
              </View>
              <View style={s.rightCol}>
                <Text style={s.regLine}>Reg. No.:</Text>
                <Text style={s.regLine}>{serial_no || '—'}</Text>
              </View>
            </View>

            {/* Title band + diamond divider */}
            <View style={s.titleBand}>
              <Text style={s.titleText}>Statement of Marks</Text>
              <Svg width={100} height={10} style={{ alignSelf: 'center', marginBottom: 6 }}>
                <Line x1="0" y1="5" x2="40" y2="5" stroke={colors.borderPrimary} strokeWidth={1} />
                <Path d="M 50 1 L 55 5 L 50 9 L 45 5 Z" fill={colors.borderPrimary} />
                <Line x1="60" y1="5" x2="100" y2="5" stroke={colors.borderPrimary} strokeWidth={1} />
              </Svg>
              {student.session ? <Text style={s.sessionText}>Session: {student.session}</Text> : null}
            </View>

            {/* Student info */}
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

              <View style={s.infoPhotoCell}>
                {photoDataUrl
                  ? <PdfImage src={photoDataUrl} style={s.infoPhotoImg} />
                  : <View style={s.infoPhotoPlaceholder}>
                      <Text style={{ fontSize: 22, color: colors.textLabel, fontFamily: 'DMSans', fontWeight: 700 }}>
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
                    {list.map(row => {
                      const bg = zebraIdx % 2 === 0 ? colors.white : colors.blockTint
                      zebraIdx++
                      return (
                        <View key={row.subject_id} style={[s.tRow, { backgroundColor: bg }]}>
                          <Text style={s.tCellSubject}>
                            {row.code ? `${row.code} — ${row.name}` : row.name}
                          </Text>
                          <Text style={s.tCellNum}>{row.theory_max || '—'}</Text>
                          <Text style={s.tCellNum}>{row.theory_obtained ?? '—'}</Text>
                          <Text style={s.tCellNum}>{row.practical_max || '—'}</Text>
                          <Text style={s.tCellNum}>{row.practical_obtained ?? '—'}</Text>
                          <Text style={s.tCellNumLast}>{row.total || '—'}</Text>
                        </View>
                      )
                    })}
                  </View>
                )
              })}

              {/* Totals row */}
              <View style={s.tTotalRow}>
                <Text style={s.tTotalCellLabel}>Total</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNumLast}>{totals.totalObtained}</Text>
              </View>
            </View>

            {/* Grade legend row — colored dots (SVG Circle) */}
            <View style={s.legendWrap}>
              {gradingScheme.map((band, i) => (
                <View key={band.label} style={s.legendCol}>
                  <View style={s.legendLabelRow}>
                    <Svg width={8} height={8}>
                      <Circle cx={4} cy={4} r={3} fill={LEGEND_DOT_COLORS[i] || colors.green} />
                    </Svg>
                    <Text style={s.legendLabelText}>{band.label}</Text>
                  </View>
                  <Text style={s.legendRange}>{band.min}%–{band.max}% – {band.grade}</Text>
                </View>
              ))}
            </View>

            {/* Final grade banner */}
            <View style={s.finalWrap}>
              <Text style={s.finalLabel}>Final Grade:</Text>
              <Text style={s.finalValue}>{finalGrade}</Text>
            </View>

            {settings.notes ? <Text style={s.notes}>{settings.notes}</Text> : null}

            {/* QR + Signature row */}
            <View style={s.bottomRow}>
              <View style={s.qrBox}>
                <View style={s.qrFrame}>
                  {qrDataUrl
                    ? <PdfImage src={qrDataUrl} style={s.qrImg} />
                    : <View style={s.qrPlaceholder}><Text style={{ fontSize: 7, color: colors.textLabel }}>QR</Text></View>}
                </View>
                <Text style={s.qrLabel}>Scan to verify</Text>
                <Text style={s.dateIssue}>Date of Issue: {fmtDate(issue_date)}</Text>
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

            {/* Certification strip */}
            <View style={s.certStrip}>
              {certLogos.filter(Boolean).map((src, i) => (
                <PdfImage key={i} src={src} style={s.certLogo} />
              ))}
            </View>

            {/* Footer */}
            <View style={s.footerLine}>
              <Text style={s.footerText}>
                <Text style={s.footerBold}>Head Office: </Text>
                {settings.footer_address}
              </Text>
              <Text style={s.footerText}>
                Website for verification: <Text style={s.footerBold}>{settings.website}</Text>
                {settings.email ? (
                  <>
                    <Text style={s.footerBullet}>  •  </Text>
                    Email: <Text style={s.footerBold}>{settings.email}</Text>
                  </>
                ) : null}
              </Text>
            </View>

          </View>
        </View>
      </Page>
    </Document>,
  ).toBlob()
}
