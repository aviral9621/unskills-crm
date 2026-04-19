import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  Svg,
  Path,
  Rect,
  Line,
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
const GOLD = '#B8860B'
const RED = '#C8102E'

const s = StyleSheet.create({
  page: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: '#1A1A1A',
    backgroundColor: NAVY,
    padding: 10,
  },
  outerCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: NAVY,
    flexDirection: 'column',
    position: 'relative',
  },
  innerBorder: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 0.75,
    borderColor: GOLD,
  },
  content: {
    flex: 1,
    padding: 20,
    flexDirection: 'column',
  },

  cornerSvg: { position: 'absolute', width: 30, height: 30 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  topText: { fontSize: 9, fontWeight: 700 },

  brandRow: { alignItems: 'center', marginTop: 2 },

  blackBar: {
    alignSelf: 'center',
    backgroundColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  blackBarText: { fontSize: 10, fontWeight: 700, color: '#FFFFFF' },

  subHeader: { fontSize: 8.5, textAlign: 'center', color: '#1A1A1A', lineHeight: 1.4 },

  certTitle: {
    fontFamily: 'GreatVibes',
    fontSize: 28,
    color: NAVY,
    textAlign: 'center',
    marginVertical: 8,
  },

  infoTable: {
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column',
    marginBottom: 8,
  },
  infoRow: { flexDirection: 'row' },
  infoHeadCell: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: '#F5F5F5', borderRightWidth: 1, borderRightColor: '#000',
  },
  infoHeadCellLast: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center', backgroundColor: '#F5F5F5',
  },
  infoCell: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000', borderRightWidth: 1, borderRightColor: '#000',
  },
  infoCellLast: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  centerLogoCol: { width: 65, alignItems: 'center' },
  centerLogo: { width: 48, height: 48, objectFit: 'contain', borderRadius: 24 },
  studentCenter: { flex: 1, alignItems: 'center' },
  presentedText: { fontSize: 11, textAlign: 'center', marginBottom: 2 },
  studentName: {
    fontSize: 18,
    fontWeight: 700,
    color: RED,
    textAlign: 'center',
    marginVertical: 2,
  },
  fatherLine: { fontSize: 10.5, fontWeight: 700, textAlign: 'center' },
  studentPhotoCol: { width: 75, alignItems: 'center' },
  studentPhoto: { width: 65, height: 75, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 65, height: 75, borderWidth: 1, borderColor: '#000',
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  body: { alignItems: 'center', marginVertical: 3 },
  bodyLine: { fontSize: 10.5, textAlign: 'center', lineHeight: 1.5 },
  bodyScript: { fontFamily: 'GreatVibes', fontSize: 17, textAlign: 'center', marginVertical: 2 },

  marksTable: { borderWidth: 1, borderColor: '#000', marginTop: 4, marginBottom: 4 },
  mtRow: { flexDirection: 'row' },
  mtHeadCell: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: '#F5F5F5', borderRightWidth: 1, borderRightColor: '#000',
  },
  mtHeadCellLast: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center', backgroundColor: '#F5F5F5',
  },
  mtCell: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000', borderRightWidth: 1, borderRightColor: '#000',
  },
  mtCellFirst: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'left',
    borderTopWidth: 1, borderTopColor: '#000', borderRightWidth: 1, borderRightColor: '#000',
  },
  mtCellLast: {
    flex: 1, fontSize: 9.5, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  legend: { marginTop: 3, alignItems: 'flex-start' },
  legendHead: { fontSize: 8.5, fontWeight: 700, marginBottom: 1 },
  legendLine: { fontSize: 8, lineHeight: 1.3 },

  bottomRow: { flexDirection: 'row', marginTop: 6, justifyContent: 'space-between', alignItems: 'flex-end' },
  bottomLeft: { width: 170 },
  qrImg: { width: 60, height: 60 },
  pillRow: { flexDirection: 'row', marginTop: 3, alignItems: 'center' },
  pillRed: {
    backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 2,
    fontSize: 7.5, fontWeight: 700, color: '#FFFFFF',
  },
  pillBlack: {
    backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2,
    fontSize: 7.5, fontWeight: 700, color: '#FFFFFF',
  },

  bottomRight: { alignItems: 'center', width: 190 },
  sigImg: { width: 130, height: 35, objectFit: 'contain' },
  sigLine: { width: 160, borderTopWidth: 1, borderTopColor: '#000', marginTop: 3, marginBottom: 2 },
  sigName: { fontSize: 9, fontWeight: 700, color: '#000', textAlign: 'center' },
  sigTitle: { fontSize: 8, color: '#000', textAlign: 'center' },
  sigReg: { fontSize: 7, color: '#555', textAlign: 'center', marginTop: 1 },

  spacer: { flexGrow: 1 },

  certStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#D4C9B0',
    borderBottomWidth: 1,
    borderBottomColor: '#D4C9B0',
    marginBottom: 5,
  },
  certLogo: { height: 22, objectFit: 'contain' },

  footer: { alignItems: 'center' },
  footerText: { fontSize: 8.5, textAlign: 'center', lineHeight: 1.4 },
})

function CornerBracket({
  top, right, bottom, left, flipX, flipY,
}: {
  top?: number; right?: number; bottom?: number; left?: number
  flipX?: boolean; flipY?: boolean
}) {
  const style: Record<string, number | string> = { position: 'absolute', width: 30, height: 30 }
  if (top !== undefined) style.top = top
  if (right !== undefined) style.right = right
  if (bottom !== undefined) style.bottom = bottom
  if (left !== undefined) style.left = left

  let d: string
  if (!flipX && !flipY) d = 'M 0 24 L 0 0 L 24 0'
  else if (flipX && !flipY) d = 'M 30 24 L 30 0 L 6 0'
  else if (!flipX && flipY) d = 'M 0 6 L 0 30 L 24 30'
  else d = 'M 30 6 L 30 30 L 6 30'

  return (
    <Svg width="30" height="30" style={style}>
      <Path d={d} stroke={GOLD} strokeWidth="1.5" fill="none" />
    </Svg>
  )
}

export function ComputerBasedTypingCertificate(p: ComputerBasedTypingCertificateProps) {
  const logos = p.certificationLogoUrls ?? []

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        <View style={s.outerCard}>
          {/* Gold inner border (decorative absolute overlay) */}
          <View style={s.innerBorder} />

          {/* Gold L-bracket corners */}
          <CornerBracket top={10} left={10} />
          <CornerBracket top={10} right={10} flipX />
          <CornerBracket bottom={10} left={10} flipY />
          <CornerBracket bottom={10} right={10} flipX flipY />

          <View style={s.content}>
            {/* Top row: cert no. | reg. no. */}
            <View style={s.topRow}>
              <Text style={s.topText}>Certificate No : {p.certificateNumber}</Text>
              {p.settings.institute_reg_number ? (
                <Text style={s.topText}>Reg. No.-{p.settings.institute_reg_number}</Text>
              ) : null}
            </View>

            {/* Brand title */}
            <View style={s.brandRow}>
              <Text>
                <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 20, color: '#000', letterSpacing: 0.8 }}>UN</Text>
                <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 20, color: RED, letterSpacing: 0.8 }}>SKILLS</Text>
                <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 20, color: '#000', letterSpacing: 0.8 }}> COMPUTER EDUCATION</Text>
                <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 11, color: '#000' }}>™</Text>
              </Text>
            </View>

            {/* ISO black bar */}
            {p.settings.tagline ? (
              <View style={s.blackBar}>
                <Text style={s.blackBarText}>{p.settings.tagline}</Text>
              </View>
            ) : null}

            {/* Sub-headers */}
            {p.settings.sub_header_line_1 ? (
              <Text style={s.subHeader}>{p.settings.sub_header_line_1}</Text>
            ) : null}
            {p.settings.sub_header_line_2 ? (
              <Text style={s.subHeader}>{p.settings.sub_header_line_2}</Text>
            ) : null}
            {p.settings.sub_header_line_3 ? (
              <Text style={s.subHeader}>{p.settings.sub_header_line_3}</Text>
            ) : null}

            {/* Certificate title */}
            <Text style={s.certTitle}>Computer Based Typing Examination</Text>

            {/* Decorative underline flourish */}
            <Svg width="180" height="8" style={{ alignSelf: 'center', marginBottom: 8 }}>
              <Rect x="0" y="2" width="4" height="4" fill={NAVY} />
              <Line x1="8" y1="4" x2="172" y2="4" stroke={NAVY} strokeWidth="0.8" />
              <Rect x="176" y="2" width="4" height="4" fill={NAVY} />
            </Svg>

            {/* Enrollment / center info table */}
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

            {/* Student row */}
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

            {/* Body text */}
            <View style={s.body}>
              <Text style={s.bodyLine}>has passed in the following subject of the</Text>
              <Text style={s.bodyScript}>Computer Based Typing Examination</Text>
              <Text style={s.bodyLine}>Designed and developed as per the standard of</Text>
              <Text style={s.bodyScript}>
                {p.settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.'}
              </Text>
              <Text style={s.bodyLine}>held at {p.trainingCenterName}</Text>
            </View>

            {/* Marks table */}
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

            {/* Grade legend */}
            <View style={s.legend}>
              <Text style={s.legendHead}>Grade System</Text>
              <Text style={s.legendLine}>A+ : 85% &amp; Above</Text>
              <Text style={s.legendLine}>A  : 75% to 84%</Text>
              <Text style={s.legendLine}>B  : 60% to 74%</Text>
              <Text style={s.legendLine}>C  : 40% to 69%</Text>
            </View>

            {/* Bottom row: QR/grade | signature */}
            <View style={s.bottomRow}>
              <View style={s.bottomLeft}>
                {p.qrCodeDataUrl ? (
                  <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} />
                ) : null}
                <View style={s.pillRow}>
                  <View style={{ backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#fff' }}>Grade</Text>
                  </View>
                  <View style={{ backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#fff' }}>{p.grade}</Text>
                  </View>
                </View>
                <View style={s.pillRow}>
                  <View style={{ backgroundColor: RED, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#fff' }}>Date of Issue</Text>
                  </View>
                  <View style={{ backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#fff' }}>{p.issueDate}</Text>
                  </View>
                </View>
              </View>

              <View style={s.bottomRight}>
                {p.settings.signature_image_url ? (
                  <PdfImage src={p.settings.signature_image_url} style={s.sigImg} />
                ) : (
                  <View style={{ height: 35 }} />
                )}
                <View style={s.sigLine} />
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

            {/* Spacer pushes badge strip and footer to bottom */}
            <View style={s.spacer} />

            {/* Certification badge strip */}
            {logos.length > 0 ? (
              <View style={s.certStrip}>
                {logos.slice(0, 8).map((url, i) => (
                  <PdfImage key={i} src={url} style={s.certLogo} />
                ))}
              </View>
            ) : null}

            {/* Footer */}
            <View style={s.footer}>
              {p.settings.corporate_office_address ? (
                <Text style={s.footerText}>
                  Head Office: {p.settings.corporate_office_address}
                </Text>
              ) : null}
              {p.settings.verification_url_base ? (
                <Text style={s.footerText}>
                  To verify this certificate visit: {p.settings.verification_url_base}
                </Text>
              ) : null}
              {p.settings.contact_email ? (
                <Text style={s.footerText}>Mail us: {p.settings.contact_email}</Text>
              ) : null}
            </View>
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
