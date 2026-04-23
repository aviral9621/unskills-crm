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
  branch_category?: string
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
  pageBg: '#FDFBF5',
  blockTint: '#FBF7EC',
  borderPrimary: '#8B1A2B',
  borderAccent: '#C8102E',
  borderSoft: '#D4C9B0',
  accentGold: '#B8860B',
  gradeHighlight: '#F4C430',
  textPrimary: '#0A0A0A',
  textSecondary: '#4A4A4A',
  textLabel: '#6B5E3C',
  semesterTint: '#F4E8D0',
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
    logoDataUrl, certLogos, photoDataUrl, qrDataUrl, branch_category,
  } = input
  const isBeautician = branch_category === 'beautician'

  const s = StyleSheet.create({
    page: {
      fontFamily: 'DMSans', fontWeight: 400,
      fontSize: 8.5,
      color: colors.textPrimary,
      backgroundColor: colors.pageBg,
      padding: 18,
    },
    bgPattern: {
      position: 'absolute', top: -18, left: -18,
      width: 595.28, height: 841.89,
    },

    // Double-border frame (nested Views)
    frameOuter: {
      borderWidth: 2, borderStyle: 'solid', borderColor: colors.borderPrimary,
      padding: 4,
    },
    frameInner: {
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderAccent,
      padding: 12,
    },

    // ─── Header ───────────────────────────────────────────────────────────
    headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
    logoCol: { width: 56, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 1 },
    logo: { width: 46, height: 46, objectFit: 'contain' },
    middleCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    brandTitle: {
      fontSize: 17, fontFamily: 'DMSans', fontWeight: 700,
      textAlign: 'center', letterSpacing: 1.2, textTransform: 'uppercase',
      marginBottom: 2,
    },
    subHeader: {
      fontSize: 7.5, color: colors.textSecondary,
      textAlign: 'center', lineHeight: 1.35,
      fontFamily: 'DMSans', fontWeight: 400,
    },
    subBullet: {
      fontFamily: 'DMSans', fontWeight: 700, color: colors.borderPrimary,
    },
    rightCol: { width: 84, alignItems: 'flex-end', paddingTop: 2 },
    regLine: {
      fontSize: 7.8, color: colors.textPrimary, textAlign: 'right',
      fontFamily: 'DMSans', fontWeight: 700,
    },

    // ─── Title band ───────────────────────────────────────────────────────
    titleBand: { alignItems: 'center', marginTop: 5 },
    statementTitle: {
      fontSize: 13, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.textPrimary, letterSpacing: 3, textTransform: 'uppercase',
      marginTop: 6, marginBottom: 2,
    },
    sessionText: {
      fontSize: 8.5, color: colors.textSecondary,
      textAlign: 'center', marginBottom: 6,
      fontFamily: 'DMSans', fontWeight: 400,
    },

    // ─── Student info block ──────────────────────────────────────────────
    infoWrap: {
      marginTop: 5, flexDirection: 'row',
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
      backgroundColor: colors.blockTint,
    },
    infoLeft: { flex: 1 },
    infoPhotoCell: {
      width: 80, alignItems: 'center', justifyContent: 'center',
      padding: 5, borderLeftWidth: 1, borderLeftColor: colors.borderSoft,
      backgroundColor: colors.pageBg,
    },
    infoPhotoImg: {
      width: 65, height: 75, objectFit: 'cover',
      borderWidth: 2, borderStyle: 'solid', borderColor: colors.borderPrimary,
      borderRadius: 2,
    },
    infoPhotoPlaceholder: {
      width: 65, height: 75, backgroundColor: '#EDE5D0',
      borderWidth: 2, borderStyle: 'solid', borderColor: colors.borderPrimary,
      borderRadius: 2, alignItems: 'center', justifyContent: 'center',
    },
    infoRow: {
      flexDirection: 'row',
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    infoRowLast: { flexDirection: 'row' },
    detailCell: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      paddingVertical: 4, paddingHorizontal: 8,
    },
    detailCellDivider: { borderRightWidth: 1, borderRightColor: colors.borderSoft },
    detailLabel: { fontSize: 8, fontFamily: 'DMSans', fontWeight: 700, color: colors.textLabel },
    detailValue: { fontSize: 8.5, fontFamily: 'DMSans', fontWeight: 700, color: colors.textPrimary },

    // ─── Marks table ─────────────────────────────────────────────────────
    tableWrap: {
      marginTop: 5,
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
    },
    tHeadRow: {
      flexDirection: 'row', backgroundColor: colors.borderPrimary,
    },
    tHeadSubject: {
      flex: 3.2, paddingVertical: 5, paddingHorizontal: 8,
      borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadGroup: {
      flex: 2, borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
      alignItems: 'center', justifyContent: 'center', paddingVertical: 3,
    },
    tHeadTotal: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 6,
      alignItems: 'center', justifyContent: 'center',
    },
    tHeadText: {
      fontSize: 9, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'center',
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    tHeadSub: {
      fontSize: 7, color: '#FFFFFFCC', textAlign: 'center', marginTop: 1,
      fontFamily: 'DMSans', fontWeight: 400,
    },

    tSemRow: {
      flexDirection: 'row',
      backgroundColor: colors.semesterTint,
      borderTopWidth: 1, borderTopColor: colors.borderSoft,
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    tSemCell: {
      flex: 1, paddingVertical: 3, paddingHorizontal: 8,
      fontSize: 9, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.textLabel, textAlign: 'center',
    },

    tRow: {
      flexDirection: 'row',
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    tCellSubject: {
      flex: 3.2, paddingVertical: 4, paddingHorizontal: 8,
      fontSize: 9, color: '#1A1A1A',
      fontFamily: 'DMSans', fontWeight: 400, textAlign: 'left',
      borderRightWidth: 0.6, borderRightColor: colors.borderSoft,
    },
    tCellNum: {
      flex: 1, paddingVertical: 4, paddingHorizontal: 8,
      fontSize: 9, color: colors.textPrimary,
      fontFamily: 'DMSans', fontWeight: 700, textAlign: 'right',
      borderRightWidth: 0.6, borderRightColor: colors.borderSoft,
    },
    tCellNumLast: {
      flex: 1, paddingVertical: 4, paddingHorizontal: 8,
      fontSize: 9, color: colors.textPrimary,
      fontFamily: 'DMSans', fontWeight: 700, textAlign: 'right',
    },

    tTotalRow: {
      flexDirection: 'row', backgroundColor: colors.borderPrimary,
    },
    tTotalCellLabel: {
      flex: 3.2, paddingVertical: 5, paddingHorizontal: 10,
      fontSize: 10, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'left',
      textTransform: 'uppercase', letterSpacing: 0.5,
      borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
    },
    tTotalCellNum: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 8,
      fontSize: 10, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'right',
      borderRightWidth: 0.6, borderRightColor: '#FFFFFF66',
    },
    tTotalCellNumLast: {
      flex: 1, paddingVertical: 5, paddingHorizontal: 8,
      fontSize: 10, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, textAlign: 'right',
    },

    // ─── Grade legend ────────────────────────────────────────────────────
    legendWrap: {
      marginTop: 5,
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
      backgroundColor: colors.blockTint,
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 4, paddingHorizontal: 10,
    },
    legendCol: { flex: 1, alignItems: 'center' },
    legendLabelRow: { flexDirection: 'row', alignItems: 'center' },
    legendLabelText: {
      fontSize: 8, fontFamily: 'DMSans', fontWeight: 700, color: colors.textPrimary,
      marginLeft: 3,
    },
    legendRange: {
      fontSize: 7, color: colors.textSecondary,
      fontFamily: 'DMSans', fontWeight: 400, marginTop: 1,
    },

    // ─── Final grade banner ──────────────────────────────────────────────
    finalWrap: {
      marginTop: 5, backgroundColor: colors.borderPrimary,
      paddingVertical: 7, alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center',
    },
    gradeLabel: {
      fontSize: 12, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.white, letterSpacing: 1.5, textTransform: 'uppercase',
    },
    gradeLetter: {
      fontSize: 16, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.gradeHighlight, marginLeft: 8,
    },

    notes: { marginTop: 3, fontSize: 7.5, color: colors.textSecondary, textAlign: 'center' },

    // ─── QR + Signature row ──────────────────────────────────────────────
    bottomRow: {
      flexDirection: 'row', marginVertical: 6,
      alignItems: 'flex-start', justifyContent: 'space-between',
    },
    qrBox: { width: 140 },
    qrFrame: {
      padding: 3,
      borderWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft,
      backgroundColor: colors.white,
      width: 66, alignItems: 'center', justifyContent: 'center',
    },
    qrImg: { width: 60, height: 60, objectFit: 'contain' },
    qrPlaceholder: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
    qrLabel: {
      fontSize: 7.5, color: colors.textLabel,
      fontFamily: 'DMSans', fontWeight: 700,
      marginTop: 3, width: 66, textAlign: 'center',
    },
    dateIssue: {
      fontSize: 7.5, color: colors.textLabel,
      fontFamily: 'DMSans', fontWeight: 700, marginTop: 4,
    },

    sigBox: { width: 180, alignItems: 'flex-end' },
    sigImg: { height: 28, width: 150, objectFit: 'contain' },
    sigPlaceholder: { height: 28, width: 150 },
    sigLine: {
      width: 140, borderTopWidth: 1, borderTopStyle: 'solid',
      borderTopColor: colors.borderPrimary,
      marginBottom: 3, alignSelf: 'flex-end',
    },
    sigName: {
      fontSize: 9.5, fontFamily: 'DMSans', fontWeight: 700,
      color: colors.textPrimary, textAlign: 'right', width: 180,
    },
    sigTitle: {
      fontSize: 8, fontFamily: 'DMSans', fontWeight: 400,
      color: colors.textSecondary, textAlign: 'right', width: 180,
    },

    // ─── Certification strip ─────────────────────────────────────────────
    certStrip: {
      marginTop: 5,
      flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-around',
      paddingVertical: 6, paddingHorizontal: 14,
      backgroundColor: colors.blockTint,
      borderTopWidth: 1, borderTopColor: colors.borderSoft,
      borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    },
    certLogo: { height: 20, width: 46, objectFit: 'contain' },

    // ─── Footer ──────────────────────────────────────────────────────────
    footer: {
      marginTop: 5, alignItems: 'center', paddingVertical: 4,
    },
    footerText: {
      fontSize: 7.5, color: colors.textSecondary,
      fontFamily: 'DMSans', fontWeight: 400,
      textAlign: 'center', lineHeight: 1.3,
    },
    footerBold: {
      fontFamily: 'DMSans', fontWeight: 700, color: colors.textPrimary,
    },
    footerBullet: {
      fontFamily: 'DMSans', fontWeight: 700, color: colors.borderPrimary,
    },
  })

  // Flat zebra counter so subject rows alternate regardless of semester.
  let zebraIdx = 0
  const semesters = Array.from(new Set(rows.map(r => r.semester ?? 0))).sort((a, b) => a - b)

  // Subtle offset dot grid — sits behind all content, does not disturb text.
  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const DOT_SPACING = 18
  const DOT_RADIUS = 0.85
  const dots: { cx: number; cy: number }[] = []
  for (let row = 0, y = 12; y < PAGE_H - 6; y += DOT_SPACING, row++) {
    const offset = (row % 2) * (DOT_SPACING / 2)
    for (let x = 12 + offset; x < PAGE_W - 6; x += DOT_SPACING) {
      dots.push({ cx: x, cy: y })
    }
  }

  return await pdf(
    <Document>
      <Page size="A4" style={s.page}>
        {/* Subtle offset-grid dot pattern — premium, non-intrusive */}
        <View style={s.bgPattern} fixed>
          <Svg width={PAGE_W} height={PAGE_H}>
            {dots.map((d, i) => (
              <Circle
                key={i}
                cx={d.cx}
                cy={d.cy}
                r={DOT_RADIUS}
                fill={colors.accentGold}
                fillOpacity={0.14}
              />
            ))}
          </Svg>
        </View>

        <View style={s.frameOuter}>
          <View style={s.frameInner} wrap={false}>

            {/* Header — institute info only */}
            <View style={s.headerRow}>
              <View style={s.logoCol}>
                {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logo} /> : null}
              </View>
              <View style={s.middleCol}>
                <Text style={s.brandTitle}>
                  <Text style={{ color: colors.textPrimary }}>UN</Text>
                  <Text style={{ color: colors.borderAccent }}>SKILLS</Text>
                  <Text style={{ color: colors.textPrimary }}>{isBeautician ? ' BEAUTY ACADEMY' : ' COMPUTER EDUCATION'}</Text>
                </Text>
                <Text style={s.subHeader}>
                  An ISO 9001:2015 Certified Organization
                  <Text style={s.subBullet}>  •  </Text>
                  Run by UnSkills FuturePath Tech Pvt. Ltd.
                </Text>
                <Text style={s.subHeader}>
                  Alliance with Skill India, MSME, NSDC, etc.
                  <Text style={s.subBullet}>  •  </Text>
                  Registered under Company Act 2013
                </Text>
              </View>
              <View style={s.rightCol}>
                <Text style={s.regLine}>Reg. No.:</Text>
                <Text style={s.regLine}>{serial_no || '—'}</Text>
              </View>
            </View>

            {/* Title band + diamond divider */}
            <View style={s.titleBand}>
              <Text style={s.statementTitle}>Statement of Marks</Text>
              <Svg width={80} height={10} style={{ alignSelf: 'center', marginBottom: 3 }}>
                <Line x1="0" y1="5" x2="32" y2="5" stroke={colors.borderPrimary} strokeWidth={1} />
                <Path d="M 40 1 L 45 5 L 40 9 L 35 5 Z" fill={colors.borderPrimary} />
                <Line x1="48" y1="5" x2="80" y2="5" stroke={colors.borderPrimary} strokeWidth={1} />
              </Svg>
              {student.session ? <Text style={s.sessionText}>Session: {student.session}</Text> : null}
            </View>

            {/* Student info — inline label+value on same line, top-aligned cells */}
            <View style={s.infoWrap}>
              <View style={s.infoLeft}>
                <View style={s.infoRow}>
                  <View style={[s.detailCell, s.detailCellDivider]}>
                    <Text>
                      <Text style={s.detailLabel}>Enrollment No : </Text>
                      <Text style={s.detailValue}>{student.registration_no}</Text>
                    </Text>
                  </View>
                  <View style={s.detailCell}>
                    <Text>
                      <Text style={s.detailLabel}>Roll No : </Text>
                      <Text style={s.detailValue}>{roll_no || '—'}</Text>
                    </Text>
                  </View>
                </View>

                <View style={s.infoRow}>
                  <View style={[s.detailCell, s.detailCellDivider]}>
                    <Text>
                      <Text style={s.detailLabel}>Training Center : </Text>
                      <Text style={s.detailValue}>{center.name || '—'}</Text>
                    </Text>
                  </View>
                  <View style={s.detailCell}>
                    <Text>
                      <Text style={s.detailLabel}>Center Code : </Text>
                      <Text style={s.detailValue}>{center.code || '—'}</Text>
                    </Text>
                  </View>
                </View>

                <View style={s.infoRow}>
                  <View style={[s.detailCell, s.detailCellDivider]}>
                    <Text>
                      <Text style={s.detailLabel}>Course Name : </Text>
                      <Text style={s.detailValue}>{student.course_name || '—'}</Text>
                    </Text>
                  </View>
                  <View style={s.detailCell}>
                    <Text>
                      <Text style={s.detailLabel}>Course Duration : </Text>
                      <Text style={s.detailValue}>{student.course_duration || '—'}</Text>
                    </Text>
                  </View>
                </View>

                <View style={s.infoRow}>
                  <View style={[s.detailCell, s.detailCellDivider]}>
                    <Text>
                      <Text style={s.detailLabel}>Student Name : </Text>
                      <Text style={s.detailValue}>{student.name}</Text>
                    </Text>
                  </View>
                  <View style={s.detailCell}>
                    <Text>
                      <Text style={s.detailLabel}>Father&#39;s Name : </Text>
                      <Text style={s.detailValue}>{student.father_name || '—'}</Text>
                    </Text>
                  </View>
                </View>

                <View style={s.infoRowLast}>
                  <View style={[s.detailCell, s.detailCellDivider]}>
                    <Text>
                      <Text style={s.detailLabel}>Date of Registration : </Text>
                      <Text style={s.detailValue}>{fmtDate(student.enrollment_date)}</Text>
                    </Text>
                  </View>
                  <View style={s.detailCell}>
                    <Text>
                      <Text style={s.detailLabel}>Center Address : </Text>
                      <Text style={s.detailValue}>{center.address || '—'}</Text>
                    </Text>
                  </View>
                </View>
              </View>

              <View style={s.infoPhotoCell}>
                {photoDataUrl
                  ? <PdfImage src={photoDataUrl} style={s.infoPhotoImg} />
                  : <View style={s.infoPhotoPlaceholder}>
                      <Text style={{ fontSize: 18, color: colors.textLabel, fontFamily: 'DMSans', fontWeight: 700 }}>
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

              <View style={s.tTotalRow}>
                <Text style={s.tTotalCellLabel}>Total</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNum}>—</Text>
                <Text style={s.tTotalCellNumLast}>{totals.totalObtained}</Text>
              </View>
            </View>

            {/* Grade legend */}
            <View style={s.legendWrap}>
              {gradingScheme.map((band, i) => (
                <View key={band.label} style={s.legendCol}>
                  <View style={s.legendLabelRow}>
                    <Svg width={6} height={6}>
                      <Circle cx={3} cy={3} r={2.5} fill={LEGEND_DOT_COLORS[i] || colors.green} />
                    </Svg>
                    <Text style={s.legendLabelText}>{band.label}</Text>
                  </View>
                  <Text style={s.legendRange}>{band.min}%–{band.max}% – {band.grade}</Text>
                </View>
              ))}
            </View>

            {/* Final grade banner */}
            <View style={s.finalWrap}>
              <Text style={s.gradeLabel}>Final Grade:</Text>
              <Text style={s.gradeLetter}>{finalGrade}</Text>
            </View>

            {settings.notes ? <Text style={s.notes}>{settings.notes}</Text> : null}

            {/* QR + Signature */}
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
            <View style={s.footer}>
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
