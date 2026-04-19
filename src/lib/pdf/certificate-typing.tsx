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
  CornerBracket,
  TitleDivider,
  RibbonSeal,
} from './certificate-decorations'

registerPDFFonts()

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

const s = StyleSheet.create({
  page: {
    backgroundColor: C.pageBg,
    padding: 0,
    fontFamily: FONTS.body,
    color: C.textPrimary,
  },
  outerFrame: {
    margin: 16,
    borderWidth: 2.5,
    borderStyle: 'solid',
    borderColor: C.frameOuter,
    flex: 1,
  },
  middleFrame: {
    margin: 4,
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: C.gold,
    flex: 1,
  },
  innerFrame: {
    margin: 5,
    borderWidth: 0.3,
    borderStyle: 'solid',
    borderColor: C.gold,
    flex: 1,
    position: 'relative',
  },
  ribbonWrap: { position: 'absolute', top: 40, left: 18 },
  content: {
    flex: 1,
    paddingTop: 12,
    paddingLeft: 72,
    paddingRight: 14,
    paddingBottom: 12,
    flexDirection: 'column',
  },

  topMeta: { alignItems: 'flex-start', marginBottom: 3 },
  topMetaText: { fontSize: 8, fontFamily: FONTS.body, fontWeight: 700, color: C.textPrimary, lineHeight: 1.4 },

  brandTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },

  isoRibbon: {
    backgroundColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'center',
    marginBottom: 3,
  },
  isoText: { color: '#FFFFFF', fontSize: 9, fontFamily: FONTS.body, fontWeight: 700 },

  subHeader: {
    fontSize: 7.5,
    fontFamily: FONTS.body,
    textAlign: 'center',
    color: C.textSecondary,
    lineHeight: 1.35,
  },

  certTitle: {
    fontFamily: FONTS.script,
    fontSize: 26,
    color: C.titleNavy,
    textAlign: 'center',
    marginTop: 6,
  },

  infoTable: {
    borderWidth: 1, borderColor: '#000',
    marginTop: 4, marginBottom: 6,
  },
  infoRow: { flexDirection: 'row' },
  infoHeadCell: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: C.tableHeaderBg, borderRightWidth: 1, borderRightColor: '#000',
  },
  infoHeadCellLast: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
  },
  infoCell: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  infoCellLast: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  centerLogoCol: { width: 60, alignItems: 'center' },
  centerLogo: { width: 45, height: 45, objectFit: 'contain', borderRadius: 23 },
  studentCenter: { flex: 1, alignItems: 'center' },
  presentedText: { fontSize: 11, fontFamily: FONTS.body, textAlign: 'center', marginBottom: 2 },
  studentName: {
    fontSize: 17, fontFamily: FONTS.body, fontWeight: 700,
    color: C.brandRed, textAlign: 'center', marginBottom: 2,
  },
  fatherLine: { fontSize: 10, fontFamily: FONTS.body, fontWeight: 700, textAlign: 'center' },
  studentPhotoCol: { width: 70, alignItems: 'center' },
  studentPhoto: { width: 60, height: 75, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 60, height: 75, borderWidth: 1, borderColor: '#000',
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  body: { alignItems: 'center', marginVertical: 3 },
  bodyLine: { fontSize: 10, fontFamily: FONTS.body, textAlign: 'center', lineHeight: 1.4 },
  bodyScript: { fontFamily: FONTS.script, fontSize: 14, textAlign: 'center', marginVertical: 1, color: C.titleNavy },

  marksTable: { borderWidth: 1, borderColor: '#000', marginTop: 3, marginBottom: 3 },
  mtRow: { flexDirection: 'row' },
  mtHeadCell: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: C.tableHeaderBg, borderRightWidth: 1, borderRightColor: '#000',
  },
  mtHeadCellLast: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
  },
  mtCell: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  mtCellFirst: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'left',
    borderTopWidth: 1, borderTopColor: '#000',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  mtCellLast: {
    flex: 1, fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, padding: 4, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  legend: { alignSelf: 'flex-start', maxWidth: 200, marginTop: 2 },
  legendHead: { fontSize: 9, fontFamily: FONTS.body, fontWeight: 700, marginBottom: 1 },
  legendLine: { fontSize: 8, fontFamily: FONTS.body, lineHeight: 1.3 },

  bottomRow: {
    flexDirection: 'row', marginTop: 6,
    justifyContent: 'space-between', alignItems: 'flex-end',
  },
  bottomLeft: { width: 200 },
  qrImg: { width: 55, height: 55, borderWidth: 1, borderColor: '#000' },
  pillRow: { flexDirection: 'row', marginTop: 3 },
  pillRed: { backgroundColor: C.pillRed, paddingHorizontal: 6, paddingVertical: 2 },
  pillRedText: { fontSize: 7.5, fontFamily: FONTS.body, fontWeight: 700, color: '#FFFFFF' },
  pillBlack: { backgroundColor: C.pillBlack, paddingHorizontal: 6, paddingVertical: 2 },
  pillBlackText: { fontSize: 7.5, fontFamily: FONTS.body, fontWeight: 700, color: '#FFFFFF' },

  bottomRight: { width: 200, alignItems: 'flex-end' },
  sigImg: { width: 130, height: 30, objectFit: 'contain' },
  sigHLine: { width: 150, borderTopWidth: 1, borderTopColor: '#000', marginTop: 3, marginBottom: 2 },
  sigName: { fontSize: 10, fontFamily: FONTS.body, fontWeight: 700, color: '#000', textAlign: 'right' },
  sigTitle: { fontSize: 9, fontFamily: FONTS.body, color: '#000', textAlign: 'right' },
  sigReg: { fontSize: 7, fontFamily: FONTS.body, color: C.textMuted, textAlign: 'right', marginTop: 1 },

  spacer: { flexGrow: 1 },

  certStrip: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 3,
    borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: C.gold,
    marginTop: 4,
  },
  certLogo: { height: 20, objectFit: 'contain' },

  footer: { alignSelf: 'center', maxWidth: 420, marginTop: 3 },
  footerText: { fontSize: 8, fontFamily: FONTS.body, textAlign: 'center', color: C.textPrimary },
})

export function ComputerBasedTypingCertificate(p: ComputerBasedTypingCertificateProps) {
  const logos = p.certificationLogoUrls ?? []

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page} wrap={false}>
        <View style={s.outerFrame}>
          <View style={s.middleFrame}>
            <View style={s.innerFrame}>
              {/* Thin gold L-bracket corners */}
              <CornerBracket top={6} left={6} rotation={0} />
              <CornerBracket top={6} right={6} rotation={90} />
              <CornerBracket bottom={6} right={6} rotation={180} />
              <CornerBracket bottom={6} left={6} rotation={270} />

              {/* Ribbon seal on left edge */}
              <View style={s.ribbonWrap}>
                <RibbonSeal size={40} />
              </View>

              <View style={s.content}>
                <View style={s.topMeta}>
                  <Text style={s.topMetaText}>Certificate No : {p.certificateNumber}</Text>
                  {p.settings.institute_reg_number ? (
                    <Text style={s.topMetaText}>Reg. No.-{p.settings.institute_reg_number}</Text>
                  ) : null}
                </View>

                <Text style={s.brandTitle}>
                  <Text style={{ color: C.textPrimary }}>UN</Text>
                  <Text style={{ color: C.brandRed }}>SKILLS</Text>
                  <Text style={{ color: C.textPrimary }}> COMPUTER EDUCATION</Text>
                  <Text style={{ fontSize: 9 }}>™</Text>
                </Text>

                {p.settings.tagline ? (
                  <View style={s.isoRibbon}>
                    <Text style={s.isoText}>{p.settings.tagline}</Text>
                  </View>
                ) : null}

                {p.settings.sub_header_line_1 ? <Text style={s.subHeader}>{p.settings.sub_header_line_1}</Text> : null}
                {p.settings.sub_header_line_2 ? <Text style={s.subHeader}>{p.settings.sub_header_line_2}</Text> : null}
                {p.settings.sub_header_line_3 ? <Text style={s.subHeader}>{p.settings.sub_header_line_3}</Text> : null}

                <Text style={s.certTitle}>Computer Based Typing Examination</Text>
                <TitleDivider width={160} />

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

                <View style={s.body}>
                  <Text style={s.bodyLine}>has passed in the following subject of the</Text>
                  <Text style={s.bodyScript}>Computer Based Typing Examination</Text>
                  <Text style={s.bodyLine}>Designed and developed as per the standard of</Text>
                  <Text style={s.bodyScript}>
                    {p.settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.'}
                  </Text>
                  <Text style={s.bodyLine}>held at {p.trainingCenterName}</Text>
                </View>

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

                <View style={s.legend}>
                  <Text style={s.legendHead}>Grade System</Text>
                  <Text style={s.legendLine}>A+ : 85% &amp; Above</Text>
                  <Text style={s.legendLine}>A  : 75% to 84%</Text>
                  <Text style={s.legendLine}>B  : 60% to 74%</Text>
                  <Text style={s.legendLine}>C  : 40% to 69%</Text>
                </View>

                <View style={s.spacer} />

                <View style={s.bottomRow}>
                  <View style={s.bottomLeft}>
                    {p.qrCodeDataUrl ? (
                      <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} />
                    ) : null}
                    <View style={s.pillRow}>
                      <View style={s.pillRed}><Text style={s.pillRedText}>Grade</Text></View>
                      <View style={s.pillBlack}><Text style={s.pillBlackText}>{p.grade}</Text></View>
                    </View>
                    <View style={s.pillRow}>
                      <View style={s.pillRed}><Text style={s.pillRedText}>Date of Issue</Text></View>
                      <View style={s.pillBlack}><Text style={s.pillBlackText}>{p.issueDate}</Text></View>
                    </View>
                  </View>

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

                {logos.length > 0 ? (
                  <View style={s.certStrip}>
                    {logos.slice(0, 7).map((url, i) => (
                      <PdfImage key={i} src={url} style={s.certLogo} />
                    ))}
                  </View>
                ) : null}

                <View style={s.footer}>
                  {p.settings.verification_url_base ? (
                    <Text style={s.footerText}>
                      To verify this certificate visit: {p.settings.verification_url_base}
                    </Text>
                  ) : null}
                </View>
              </View>
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
  registerPDFFonts()
  return await pdf(<ComputerBasedTypingCertificate {...p} />).toBlob()
}
