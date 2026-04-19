import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { CertificateSettings, TypingSubject } from '../../types/certificate'
import { registerPdfFonts } from './fonts'

export interface ComputerBasedTypingCertificateProps {
  settings: CertificateSettings
  certificateNumber: string
  issueDate: string
  qrCodeDataUrl: string
  salutation?: string
  studentName: string
  fatherPrefix: string
  fatherName: string
  studentPhotoUrl: string | null
  enrollmentNumber: string
  trainingCenterCode: string
  trainingCenterName: string
  trainingCenterLogoUrl?: string | null
  typingSubjects: TypingSubject[]
  grade: string
  certificationLogoUrls?: string[]
}

const NAVY = '#0B2447'
const RED = '#C8102E'
const GOLD = '#B8860B'

const s = StyleSheet.create({
  page: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    position: 'absolute',
    top: 60,
    left: 55,
    right: 55,
    bottom: 60,
    flexDirection: 'column',
  },

  // Row 1 — top metadata (kept on LEFT side only to dodge top-right marble)
  topMeta: {
    alignItems: 'flex-start',
    maxWidth: 280,
    marginBottom: 4,
  },
  topMetaText: { fontSize: 8, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.4 },

  // Row 2 — brand title (center, narrower than full width)
  brandLine: {
    textAlign: 'center',
    marginBottom: 3,
    alignSelf: 'center',
    maxWidth: 420,
  },

  // Row 3 — black ribbon
  blackBar: {
    alignSelf: 'center',
    backgroundColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 3,
  },
  blackBarText: { fontSize: 9, fontWeight: 700, color: '#FFFFFF' },

  // Row 4 — sub-headers
  subHeader: {
    fontSize: 7.5,
    textAlign: 'center',
    color: '#1A1A1A',
    lineHeight: 1.35,
    maxWidth: 420,
    alignSelf: 'center',
  },

  // Row 5 — cert title
  certTitle: {
    fontFamily: 'GreatVibes',
    fontSize: 26,
    color: NAVY,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
    maxWidth: 440,
    alignSelf: 'center',
  },

  // Row 6 — info table (full safe width)
  infoTable: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row' },
  infoHeadCell: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: '#F5F5F5', borderRightWidth: 1, borderRightColor: '#000',
  },
  infoHeadCellLast: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: '#F5F5F5',
  },
  infoCell: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  infoCellLast: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  // Row 7 — student row (3-col, after marble recedes around y=260)
  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  centerLogoCol: { width: 60, alignItems: 'center' },
  centerLogo: { width: 45, height: 45, objectFit: 'contain', borderRadius: 23 },
  studentCenter: { flex: 1, alignItems: 'center' },
  presentedText: { fontSize: 11, textAlign: 'center', marginBottom: 2 },
  studentName: {
    fontSize: 17, fontWeight: 700, color: RED, textAlign: 'center', marginBottom: 2,
  },
  fatherLine: { fontSize: 10, fontWeight: 700, textAlign: 'center' },
  studentPhotoCol: { width: 70, alignItems: 'center' },
  studentPhoto: { width: 60, height: 75, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 60, height: 75, borderWidth: 1, borderColor: '#000',
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  // Row 8 — body paragraph
  body: { alignItems: 'center', marginVertical: 4 },
  bodyLine: { fontSize: 10, textAlign: 'center', lineHeight: 1.5 },
  bodyScript: { fontFamily: 'GreatVibes', fontSize: 16, textAlign: 'center', marginVertical: 1 },

  // Row 9 — marks table
  marksTable: { borderWidth: 1, borderColor: '#000', marginTop: 4, marginBottom: 4 },
  mtRow: { flexDirection: 'row' },
  mtHeadCell: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: '#F5F5F5', borderRightWidth: 1, borderRightColor: '#000',
  },
  mtHeadCellLast: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: '#F5F5F5',
  },
  mtCell: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  mtCellFirst: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'left',
    borderTopWidth: 1, borderTopColor: '#000',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  mtCellLast: {
    flex: 1, fontSize: 9, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  // Row 10 — grade legend (left-aligned, max 200pt)
  legend: {
    alignSelf: 'flex-start',
    maxWidth: 200,
    marginTop: 2,
  },
  legendHead: { fontSize: 9, fontWeight: 700, marginBottom: 1 },
  legendLine: { fontSize: 8, lineHeight: 1.3 },

  // Row 11 — QR/pills + signature (avoid bottom-left marble)
  bottomRow: {
    flexDirection: 'row',
    marginTop: 6,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bottomLeft: {
    width: 200,
    // Stay tight against left edge but above bottom marble
  },
  qrImg: { width: 55, height: 55, borderWidth: 1, borderColor: '#000' },
  pillRow: { flexDirection: 'row', marginTop: 3 },
  pillRed: {
    backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 2,
  },
  pillRedText: { fontSize: 7.5, fontWeight: 700, color: '#FFFFFF' },
  pillBlack: {
    backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2,
  },
  pillBlackText: { fontSize: 7.5, fontWeight: 700, color: '#FFFFFF' },

  bottomRight: {
    width: 200,
    alignItems: 'flex-end',
  },
  sigImg: { width: 130, height: 30, objectFit: 'contain' },
  sigHLine: { width: 150, borderTopWidth: 1, borderTopColor: '#000', marginTop: 3, marginBottom: 2 },
  sigName: { fontSize: 10, fontWeight: 700, color: '#000', textAlign: 'right' },
  sigTitle: { fontSize: 9, color: '#000', textAlign: 'right' },
  sigReg: { fontSize: 7, color: '#555', textAlign: 'right', marginTop: 1 },

  spacer: { flexGrow: 1 },

  // Row 12 — badge strip
  certStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 3,
    borderTopWidth: 0.5,
    borderTopColor: GOLD,
  },
  certLogo: { height: 20, objectFit: 'contain' },

  // Row 13 — footer (center-aligned, max 420pt to stay out of bottom-left marble)
  footer: {
    alignSelf: 'center',
    maxWidth: 420,
    marginTop: 3,
  },
  footerText: { fontSize: 8, textAlign: 'center', color: '#1A1A1A' },
})

export function ComputerBasedTypingCertificate(p: ComputerBasedTypingCertificateProps) {
  const logos = p.certificationLogoUrls ?? []

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        {/* Background image fills entire page */}
        <PdfImage src="/Portrait.webp" style={s.backgroundImage} />

        {/* Content overlay */}
        <View style={s.contentContainer}>

          {/* Row 1 — top metadata (LEFT side only, dodge top-right marble) */}
          <View style={s.topMeta}>
            <Text style={s.topMetaText}>Certificate No : {p.certificateNumber}</Text>
            {p.settings.institute_reg_number ? (
              <Text style={s.topMetaText}>Reg. No.-{p.settings.institute_reg_number}</Text>
            ) : null}
          </View>

          {/* Row 2 — brand title (narrower, centered) */}
          <Text style={s.brandLine}>
            <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 17, color: '#000', letterSpacing: 0.8 }}>UN</Text>
            <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 17, color: RED, letterSpacing: 0.8 }}>SKILLS</Text>
            <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 17, color: '#000', letterSpacing: 0.8 }}> COMPUTER EDUCATION</Text>
            <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 9, color: '#000' }}>™</Text>
          </Text>

          {/* Row 3 — black ISO ribbon */}
          {p.settings.tagline ? (
            <View style={s.blackBar}>
              <Text style={s.blackBarText}>{p.settings.tagline}</Text>
            </View>
          ) : null}

          {/* Row 4 — sub-header lines */}
          {p.settings.sub_header_line_1 ? (
            <Text style={s.subHeader}>{p.settings.sub_header_line_1}</Text>
          ) : null}
          {p.settings.sub_header_line_2 ? (
            <Text style={s.subHeader}>{p.settings.sub_header_line_2}</Text>
          ) : null}
          {p.settings.sub_header_line_3 ? (
            <Text style={s.subHeader}>{p.settings.sub_header_line_3}</Text>
          ) : null}

          {/* Row 5 — certificate title */}
          <Text style={s.certTitle}>Computer Based Typing Examination</Text>

          {/* Row 6 — info table (full safe width at y~200+, safe) */}
          <View style={s.infoTable}>
            <View style={s.infoRow}>
              <Text style={s.infoHeadCell}>Enrollment No.</Text>
              <Text style={s.infoHeadCell}>Center Code</Text>
              <Text style={s.infoHeadCellLast}>Authorised Training Center Name</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoCell}>{p.enrollmentNumber || '—'}</Text>
              <Text style={s.infoCell}>{p.trainingCenterCode || '—'}</Text>
              <Text style={s.infoCellLast}>{p.trainingCenterName || '—'}</Text>
            </View>
          </View>

          {/* Row 7 — student row (y~250+, safe after marble recedes) */}
          <View style={s.studentRow}>
            <View style={s.centerLogoCol}>
              {p.trainingCenterLogoUrl ? (
                <PdfImage src={p.trainingCenterLogoUrl} style={s.centerLogo} />
              ) : p.settings.training_center_logo_url ? (
                <PdfImage src={p.settings.training_center_logo_url} style={s.centerLogo} />
              ) : null}
            </View>
            <View style={s.studentCenter}>
              <Text style={s.presentedText}>This certificate is Proudly Presented to</Text>
              <Text style={s.studentName}>
                {p.salutation ? `${p.salutation} ` : ''}{p.studentName}
              </Text>
              <Text style={s.fatherLine}>
                {p.fatherPrefix} {p.fatherName}
              </Text>
            </View>
            <View style={s.studentPhotoCol}>
              {p.studentPhotoUrl ? (
                <PdfImage src={p.studentPhotoUrl} style={s.studentPhoto} />
              ) : (
                <View style={s.studentPhotoPlaceholder}>
                  <Text style={{ fontSize: 22, color: '#9CA3AF' }}>
                    {p.studentName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Row 8 — body paragraph */}
          <View style={s.body}>
            <Text style={s.bodyLine}>has passed in the following subject of the</Text>
            <Text style={s.bodyScript}>Computer Based Typing Examination</Text>
            <Text style={s.bodyLine}>Designed and developed as per the standard of</Text>
            <Text style={s.bodyScript}>
              {p.settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.'}
            </Text>
            <Text style={s.bodyLine}>held at {p.trainingCenterName}</Text>
          </View>

          {/* Row 9 — marks table */}
          <View style={s.marksTable}>
            <View style={s.mtRow}>
              <Text style={s.mtHeadCell}>Name of the Subject</Text>
              <Text style={s.mtHeadCell}>Speed W.P.M.</Text>
              <Text style={s.mtHeadCell}>Maximum Marks</Text>
              <Text style={s.mtHeadCell}>Minimum Marks</Text>
              <Text style={s.mtHeadCellLast}>Marks Obtained</Text>
            </View>
            {p.typingSubjects.map((t, i) => (
              <View key={i} style={s.mtRow}>
                <Text style={s.mtCellFirst}>{t.name}</Text>
                <Text style={s.mtCell}>{t.speed}</Text>
                <Text style={s.mtCell}>{t.max}</Text>
                <Text style={s.mtCell}>{t.min}</Text>
                <Text style={s.mtCellLast}>{t.obtained}</Text>
              </View>
            ))}
          </View>

          {/* Row 10 — grade legend (left-aligned, maxWidth 200) */}
          <View style={s.legend}>
            <Text style={s.legendHead}>Grade System</Text>
            <Text style={s.legendLine}>A+ : 85% &amp; Above</Text>
            <Text style={s.legendLine}>A  : 75% to 84%</Text>
            <Text style={s.legendLine}>B  : 60% to 74%</Text>
            <Text style={s.legendLine}>C  : 40% to 69%</Text>
          </View>

          {/* Spacer pushes bottom content to bottom of safe zone */}
          <View style={s.spacer} />

          {/* Row 11 — QR/pills + signature (bottom-left marble aware) */}
          <View style={s.bottomRow}>
            {/* LEFT — kept tight and above bottom marble */}
            <View style={s.bottomLeft}>
              {p.qrCodeDataUrl ? (
                <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} />
              ) : null}
              <View style={s.pillRow}>
                <View style={s.pillRed}>
                  <Text style={s.pillRedText}>Grade</Text>
                </View>
                <View style={s.pillBlack}>
                  <Text style={s.pillBlackText}>{p.grade}</Text>
                </View>
              </View>
              <View style={s.pillRow}>
                <View style={s.pillRed}>
                  <Text style={s.pillRedText}>Date of Issue</Text>
                </View>
                <View style={s.pillBlack}>
                  <Text style={s.pillBlackText}>{p.issueDate}</Text>
                </View>
              </View>
            </View>

            {/* RIGHT — signature (safe in bottom-right) */}
            <View style={s.bottomRight}>
              {p.settings.signature_image_url ? (
                <PdfImage src={p.settings.signature_image_url} style={s.sigImg} />
              ) : (
                <View style={{ height: 30 }} />
              )}
              <View style={s.sigHLine} />
              <Text style={s.sigName}>{p.settings.signatory_name || '—'}</Text>
              {p.settings.signatory_designation ? (
                <Text style={s.sigTitle}>{p.settings.signatory_designation}</Text>
              ) : null}
              {p.settings.signatory_company_line ? (
                <Text style={s.sigTitle}>{p.settings.signatory_company_line}</Text>
              ) : null}
              {p.settings.signatory_reg_line ? (
                <Text style={s.sigReg}>{p.settings.signatory_reg_line}</Text>
              ) : null}
            </View>
          </View>

          {/* Row 12 — certification badge strip */}
          {logos.length > 0 ? (
            <View style={s.certStrip}>
              {logos.slice(0, 7).map((url, i) => (
                <PdfImage key={i} src={url} style={s.certLogo} />
              ))}
            </View>
          ) : null}

          {/* Row 13 — footer (center, maxWidth 420, dodge bottom-left marble) */}
          <View style={s.footer}>
            {p.settings.verification_url_base ? (
              <Text style={s.footerText}>
                To verify this certificate visit: {p.settings.verification_url_base}
              </Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function buildComputerBasedTypingBlob(
  p: ComputerBasedTypingCertificateProps,
): Promise<Blob> {
  await registerPdfFonts()
  return await pdf(<ComputerBasedTypingCertificate {...p} />).toBlob()
}
