/**
 * IMAGE POLICY:
 * <Image> is used ONLY for: student photo, training-center logo, QR code,
 * signature image, and partner badge data URLs. All decorative framing is
 * drawn with native SVG primitives — no background images.
 */
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
import { registerPDFFonts, FONTS } from './register-fonts'
import { CERT_COLORS as C } from './certificate-theme'
import {
  CornerFlourish,
  TitleDivider,
  SquareAccent,
  EdgeOrnament,
} from './certificate-decorations'

registerPDFFonts()

export interface CertificateOfQualificationProps {
  settings: CertificateSettings
  certificateNumber: string
  issueDate: string
  qrCodeDataUrl: string
  salutation: string
  studentName: string
  fatherPrefix: string
  fatherName: string
  studentPhotoUrl: string | null
  courseLevel?: string
  courseCode: string
  courseName: string
  trainingCenterName: string
  trainingCenterLocation?: string
  performanceText: string
  marksScored: number
  percentage?: number
  grade: string
  rollNumber?: string
  courseDuration?: string
  typingSubjects?: TypingSubject[] | null
  trainingCenterLogoUrl?: string | null
  certificationLogoUrls?: string[]
  /** @deprecated use certificationLogoUrls */
  partnerLogoUrls?: string[]
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.pageBg,
    padding: 0,
    fontFamily: FONTS.body,
    color: C.textPrimary,
  },
  outerFrame: {
    margin: 16,
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: C.frameOuter,
    flex: 1,
  },
  middleFrame: {
    margin: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: C.frameInner,
    flex: 1,
  },
  innerFrame: {
    margin: 6,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: C.frameOuter,
    flex: 1,
    position: 'relative',
  },
  topEdgeOrnament: {
    position: 'absolute',
    top: -7,
    left: '50%',
    marginLeft: -20,
  },
  bottomEdgeOrnament: {
    position: 'absolute',
    bottom: -7,
    left: '50%',
    marginLeft: -20,
  },
  content: {
    flex: 1,
    padding: 20,
    flexDirection: 'column',
  },

  topMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metaText: { fontSize: 8, fontFamily: FONTS.body, fontWeight: 700, color: C.textPrimary },

  brandTitle: {
    fontFamily: FONTS.display,
    fontSize: 24,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 4,
  },

  isoRibbon: {
    backgroundColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 14,
    alignSelf: 'center',
    marginBottom: 4,
  },
  isoText: { color: '#FFFFFF', fontSize: 9, fontFamily: FONTS.body, fontWeight: 700 },

  subHeader: {
    fontSize: 7.5,
    fontFamily: FONTS.body,
    fontWeight: 400,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 1.4,
  },

  certTitle: {
    fontFamily: FONTS.script,
    fontSize: 38,
    color: C.titleNavy,
    textAlign: 'center',
    marginTop: 6,
  },

  presentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  presentedText: {
    fontSize: 10,
    fontFamily: FONTS.body,
    color: C.textPrimary,
    marginHorizontal: 6,
  },

  mainRow: { flexDirection: 'row', marginVertical: 4, flexGrow: 1 },
  leftCol: { width: 90, alignItems: 'center', justifyContent: 'center' },
  centerCol: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  rightCol: { width: 90, alignItems: 'center', justifyContent: 'flex-start' },
  tcLogo: { width: 70, height: 70, objectFit: 'contain' },
  studentPhoto: {
    width: 75, height: 85,
    borderWidth: 1, borderStyle: 'solid', borderColor: '#000000',
    objectFit: 'cover',
  },
  studentPhotoPlaceholder: {
    width: 75, height: 85,
    borderWidth: 1, borderStyle: 'solid', borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  studentName: {
    fontFamily: FONTS.body,
    fontSize: 16,
    fontWeight: 700,
    color: C.titleNavy,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  bodyLine: {
    fontFamily: FONTS.body,
    fontSize: 10,
    textAlign: 'center',
    color: C.textPrimary,
    marginBottom: 3,
    lineHeight: 1.4,
  },
  courseName: {
    fontFamily: FONTS.body,
    fontSize: 11,
    fontWeight: 700,
    color: C.titleNavy,
    textAlign: 'center',
    marginBottom: 5,
  },
  bold: { fontFamily: FONTS.body, fontWeight: 700 },

  typingMini: {
    marginTop: 2,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#000',
    width: '80%',
    alignSelf: 'center',
  },
  typingRow: { flexDirection: 'row' },
  typingHeadCell: {
    flex: 1, fontSize: 7, fontWeight: 700, padding: 2, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#000', backgroundColor: C.tableHeaderBg,
  },
  typingHeadCellLast: {
    flex: 1, fontSize: 7, fontWeight: 700, padding: 2, textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
  },
  typingCell: {
    flex: 1, fontSize: 7, padding: 2, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#000',
    borderTopWidth: 1, borderTopColor: '#000',
  },
  typingCellLast: {
    flex: 1, fontSize: 7, padding: 2, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  bottomRow: { flexDirection: 'row', marginTop: 6, paddingTop: 4 },
  bottomLeft: { width: 180 },
  bottomCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 20,
  },
  bottomRight: { width: 180, alignItems: 'flex-end' },
  certNumLabel: {
    fontSize: 7.5, fontFamily: FONTS.body, fontWeight: 700, color: C.textPrimary,
  },
  certNumValue: {
    fontSize: 13, fontFamily: FONTS.body, fontWeight: 700, color: C.titleNavy, marginBottom: 4,
  },
  qrRow: { flexDirection: 'row', alignItems: 'center' },
  qr: { width: 50, height: 50, borderWidth: 1, borderColor: '#000000' },
  contactBlock: { marginLeft: 6 },
  contactLine: { fontSize: 7.5, fontFamily: FONTS.body, color: C.textPrimary, lineHeight: 1.4 },
  partnerLogo: { height: 28, objectFit: 'contain' },
  signature: { width: 120, height: 28, objectFit: 'contain' },
  sigLine: {
    width: 150,
    borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: '#000000',
    marginTop: 2, marginBottom: 3,
  },
  sigTitle: { fontSize: 9.5, fontFamily: FONTS.body, fontWeight: 700, color: C.textPrimary },
  sigCompany: { fontSize: 8, fontFamily: FONTS.body, color: C.textSecondary },
  sigReg: { fontSize: 7, fontFamily: FONTS.body, color: C.textMuted, marginTop: 1 },

  badgeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 0.5,
    borderTopStyle: 'solid',
    borderTopColor: C.gold,
    marginTop: 4,
  },
  badge: { height: 20, objectFit: 'contain' },

  footer: {
    fontSize: 7.5,
    fontFamily: FONTS.body,
    color: C.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
})

export function CertificateOfQualification(p: CertificateOfQualificationProps) {
  const showTyping = Array.isArray(p.typingSubjects) && p.typingSubjects.length > 0
  const logoUrls = p.certificationLogoUrls ?? p.partnerLogoUrls ?? []
  const displayPct = p.percentage != null ? p.percentage : p.marksScored

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page} wrap={false}>
        <View style={s.outerFrame}>
          <View style={s.middleFrame}>
            <View style={s.innerFrame}>
              {/* Corner flourishes — rotation mirrors to each corner */}
              <CornerFlourish size={70} top={-4} left={-4} rotation={0} />
              <CornerFlourish size={70} top={-4} right={-4} rotation={90} />
              <CornerFlourish size={70} bottom={-4} right={-4} rotation={180} />
              <CornerFlourish size={70} bottom={-4} left={-4} rotation={270} />

              {/* Mid-edge ornaments */}
              <View style={s.topEdgeOrnament}><EdgeOrnament /></View>
              <View style={s.bottomEdgeOrnament}><EdgeOrnament /></View>

              <View style={s.content}>
                <View style={s.topMeta}>
                  <Text style={s.metaText}>Reg. by Govt. of India</Text>
                  {p.settings.institute_reg_number ? (
                    <Text style={s.metaText}>Reg. No.-{p.settings.institute_reg_number}</Text>
                  ) : null}
                </View>

                <Text style={s.brandTitle}>
                  <Text style={{ color: C.textPrimary }}>UN</Text>
                  <Text style={{ color: C.brandRed }}>SKILLS</Text>
                  <Text style={{ color: C.textPrimary }}> COMPUTER EDUCATION</Text>
                  <Text style={{ fontSize: 10 }}>™</Text>
                </Text>

                {p.settings.tagline ? (
                  <View style={s.isoRibbon}>
                    <Text style={s.isoText}>{p.settings.tagline}</Text>
                  </View>
                ) : null}

                {p.settings.sub_header_line_1 ? <Text style={s.subHeader}>{p.settings.sub_header_line_1}</Text> : null}
                {p.settings.sub_header_line_2 ? <Text style={s.subHeader}>{p.settings.sub_header_line_2}</Text> : null}
                {p.settings.sub_header_line_3 ? <Text style={s.subHeader}>{p.settings.sub_header_line_3}</Text> : null}

                <Text style={s.certTitle}>Certificate of Qualification</Text>
                <TitleDivider width={220} />

                <View style={s.presentedRow}>
                  <SquareAccent />
                  <Text style={s.presentedText}>This Certificate Is Proudly Presented To</Text>
                  <SquareAccent />
                </View>

                <View style={s.mainRow}>
                  <View style={s.leftCol}>
                    {p.trainingCenterLogoUrl ? (
                      <PdfImage src={p.trainingCenterLogoUrl} style={s.tcLogo} />
                    ) : p.settings.training_center_logo_url ? (
                      <PdfImage src={p.settings.training_center_logo_url} style={s.tcLogo} />
                    ) : null}
                  </View>

                  <View style={s.centerCol}>
                    <Text style={s.studentName}>{p.salutation} {p.studentName}</Text>
                    <Text style={s.bodyLine}>has successfully attended the</Text>
                    <Text style={s.courseName}>{p.courseCode} – {p.courseName}</Text>
                    <Text style={s.bodyLine}>
                      learning at UnSkills Computer Education at{' '}
                      <Text style={s.bold}>{p.trainingCenterName}</Text>
                    </Text>
                    <Text style={s.bodyLine}>
                      and entitled to all honors and privileges associated with this achievement
                    </Text>
                    <Text style={s.bodyLine}>
                      on <Text style={s.bold}>{p.issueDate}</Text> with Secured{' '}
                      <Text style={s.bold}>{displayPct}% marks</Text> and achieved Grade{' '}
                      <Text style={s.bold}>{p.grade}</Text>
                    </Text>

                    {showTyping ? (
                      <View style={s.typingMini}>
                        <View style={s.typingRow}>
                          <Text style={s.typingHeadCell}>Subject</Text>
                          <Text style={s.typingHeadCell}>Speed WPM</Text>
                          <Text style={s.typingHeadCell}>Max</Text>
                          <Text style={s.typingHeadCell}>Min</Text>
                          <Text style={s.typingHeadCellLast}>Obtained</Text>
                        </View>
                        {p.typingSubjects!.map((t, i) => (
                          <View key={i} style={s.typingRow}>
                            <Text style={s.typingCell}>{t.name}</Text>
                            <Text style={s.typingCell}>{t.speed}</Text>
                            <Text style={s.typingCell}>{t.max}</Text>
                            <Text style={s.typingCell}>{t.min}</Text>
                            <Text style={s.typingCellLast}>{t.obtained}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  <View style={s.rightCol}>
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

                <View style={s.bottomRow}>
                  <View style={s.bottomLeft}>
                    <Text style={s.certNumLabel}>CERTIFICATE NUMBER</Text>
                    <Text style={s.certNumValue}>{p.certificateNumber}</Text>
                    <View style={s.qrRow}>
                      {p.qrCodeDataUrl ? <PdfImage src={p.qrCodeDataUrl} style={s.qr} /> : null}
                      <View style={s.contactBlock}>
                        {p.settings.contact_email ? <Text style={s.contactLine}>{p.settings.contact_email}</Text> : null}
                        {p.settings.verification_url_base ? (
                          <Text style={s.contactLine}>
                            {p.settings.verification_url_base.replace(/^https?:\/\//, '')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={s.bottomCenter}>
                    {logoUrls.slice(0, 5).map((url, i) => (
                      <PdfImage key={i} src={url} style={s.partnerLogo} />
                    ))}
                  </View>

                  <View style={s.bottomRight}>
                    {p.settings.signature_image_url ? (
                      <PdfImage src={p.settings.signature_image_url} style={s.signature} />
                    ) : (
                      <View style={{ height: 28 }} />
                    )}
                    <View style={s.sigLine} />
                    <Text style={s.sigTitle}>
                      {p.settings.signatory_designation || 'Chief Executive Officer'}
                    </Text>
                    {p.settings.signatory_company_line ? (
                      <Text style={s.sigCompany}>{p.settings.signatory_company_line}</Text>
                    ) : null}
                    {p.settings.signatory_reg_line ? (
                      <Text style={s.sigReg}>{p.settings.signatory_reg_line}</Text>
                    ) : null}
                  </View>
                </View>

                {logoUrls.length > 0 ? (
                  <View style={s.badgeStrip}>
                    {logoUrls.slice(0, 7).map((url, i) => (
                      <PdfImage key={i} src={url} style={s.badge} />
                    ))}
                  </View>
                ) : null}

                {p.settings.verification_url_base ? (
                  <Text style={s.footer}>
                    To verify this certificate visit: {p.settings.verification_url_base}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function buildCertificateOfQualificationBlob(
  p: CertificateOfQualificationProps,
): Promise<Blob> {
  registerPDFFonts()
  return await pdf(<CertificateOfQualification {...p} />).toBlob()
}
