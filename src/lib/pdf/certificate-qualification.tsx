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
  /** Badge logos (ISO, MSME, Skill India, NSDC, Digital India, ANSI, IAF) as data URLs */
  certificationLogoUrls?: string[]
  /** @deprecated use certificationLogoUrls */
  partnerLogoUrls?: string[]
}

const NAVY = '#0B2447'
const RED = '#C8102E'

const s = StyleSheet.create({
  page: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    padding: 6,
  },
  outerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: NAVY,
    padding: 14,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: NAVY,
    padding: 22,
    flexDirection: 'column',
    position: 'relative',
  },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  topText: { fontSize: 9, fontWeight: 700, color: '#1A1A1A' },

  brandRow: { alignItems: 'center', marginBottom: 4 },

  blackBar: {
    alignSelf: 'center',
    backgroundColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 14,
    marginBottom: 5,
  },
  blackBarText: { fontSize: 10, fontWeight: 700, color: '#FFFFFF' },

  subHeader: { fontSize: 8.5, textAlign: 'center', color: '#1A1A1A', lineHeight: 1.4 },

  certTitleScript: {
    fontFamily: 'GreatVibes',
    fontSize: 44,
    color: NAVY,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  presentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 2,
  },
  presentedText: { fontSize: 11, color: '#1A1A1A' },

  studentName: {
    fontSize: 24,
    fontWeight: 700,
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  bodyBlock: { alignItems: 'center', marginBottom: 6 },
  bodyLine: { fontSize: 11, textAlign: 'center', lineHeight: 1.7, color: '#1A1A1A' },
  bodyCourseLine: { fontSize: 13, fontWeight: 700, color: NAVY, textAlign: 'center', marginVertical: 2 },

  typingMini: {
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#000',
    width: '80%',
    alignSelf: 'center',
  },
  typingRow: { flexDirection: 'row' },
  typingHeadCell: {
    flex: 1, fontSize: 8, fontWeight: 700, padding: 2, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#000', backgroundColor: '#F5F5F5',
  },
  typingHeadCellLast: {
    flex: 1, fontSize: 8, fontWeight: 700, padding: 2, textAlign: 'center', backgroundColor: '#F5F5F5',
  },
  typingCell: {
    flex: 1, fontSize: 8, padding: 2, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#000', borderTopWidth: 1, borderTopColor: '#000',
  },
  typingCellLast: {
    flex: 1, fontSize: 8, padding: 2, textAlign: 'center', borderTopWidth: 1, borderTopColor: '#000',
  },

  body3col: { flexDirection: 'row', marginBottom: 4 },
  bodyLeft: { width: 70, alignItems: 'center', justifyContent: 'center' },
  bodyCenter: { flex: 1, alignItems: 'center' },
  bodyRight: { width: 80, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  trainingLogo: { width: 60, height: 60, objectFit: 'contain', borderRadius: 30 },
  studentPhoto: { width: 72, height: 86, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 72, height: 86, borderWidth: 1, borderColor: '#000',
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, alignItems: 'flex-end' },
  bottomLeft: { width: 180 },
  pillRow: { flexDirection: 'row', marginBottom: 3 },
  pillRed: {
    backgroundColor: RED, paddingHorizontal: 7, paddingVertical: 2,
    fontSize: 7.5, fontWeight: 700, color: '#FFFFFF',
  },
  pillBlack: {
    backgroundColor: '#000', paddingHorizontal: 7, paddingVertical: 2,
    fontSize: 7.5, fontWeight: 700, color: '#FFFFFF',
  },
  certNumLabel: { fontSize: 8, fontWeight: 700, color: '#1A1A1A', marginBottom: 1, marginTop: 3 },
  certNum: { fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 },
  qrContactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  qrImg: { width: 58, height: 58, borderWidth: 1, borderColor: '#000' },
  contactBlock: { flex: 1 },
  contactLine: { fontSize: 7.5, color: '#1A1A1A', lineHeight: 1.4 },
  socialRow: { flexDirection: 'row', marginTop: 3 },

  bottomCenter: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  partnerLogo: { height: 34, width: 40, objectFit: 'contain' },

  bottomRight: { width: 190, alignItems: 'center' },
  sigImg: { width: 130, height: 35, objectFit: 'contain' },
  sigLine: { width: 160, borderTopWidth: 1, borderTopColor: '#000', marginTop: 3, marginBottom: 2 },
  sigTitle: { fontSize: 10, fontWeight: 700, color: '#000', textAlign: 'center' },
  sigCompany: { fontSize: 9, color: '#000', textAlign: 'center' },
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
  footerText: { fontSize: 8.5, textAlign: 'center', lineHeight: 1.4, color: '#1A1A1A' },
})

function CornerAccent({
  top, right, bottom, left, flipX, flipY,
}: {
  top?: number; right?: number; bottom?: number; left?: number
  flipX?: boolean; flipY?: boolean
}) {
  const style: Record<string, number | string> = { position: 'absolute', width: 24, height: 24 }
  if (top !== undefined) style.top = top
  if (right !== undefined) style.right = right
  if (bottom !== undefined) style.bottom = bottom
  if (left !== undefined) style.left = left

  const bigX = flipX ? 18 : 0
  const bigY = flipY ? 18 : 0
  const smallX = 10
  const smallY = 10

  return (
    <Svg width="24" height="24" style={style}>
      <Rect x={bigX} y={bigY} width="6" height="6" fill={NAVY} />
      <Rect x={smallX} y={smallY} width="4" height="4" fill={RED} />
    </Svg>
  )
}

function LeftMidEdge() {
  return (
    <Svg width="55" height="170" style={{ position: 'absolute', left: 0, top: 185 }}>
      <Path d="M 0 0 L 45 25 L 45 85 L 0 110 Z" fill={NAVY} />
      <Path d="M 0 28 L 28 46 L 28 64 L 0 82 Z" fill={RED} opacity="0.9" />
    </Svg>
  )
}

function RightMidEdge() {
  return (
    <Svg width="55" height="170" style={{ position: 'absolute', right: 0, top: 185 }}>
      <Path d="M 55 0 L 10 25 L 10 85 L 55 110 Z" fill={NAVY} />
      <Path d="M 55 28 L 27 46 L 27 64 L 55 82 Z" fill={RED} opacity="0.9" />
    </Svg>
  )
}

function NavySquare({ size = 6 }: { size?: number }) {
  return (
    <Svg width={size} height={size} style={{ marginHorizontal: 6 }}>
      <Rect x="0" y="0" width={size} height={size} fill={NAVY} />
    </Svg>
  )
}

function SocialDot() {
  return (
    <Svg width="10" height="10" style={{ marginRight: 3 }}>
      <Rect x="0" y="0" width="10" height="10" rx="2" fill={NAVY} />
    </Svg>
  )
}

export function CertificateOfQualification(p: CertificateOfQualificationProps) {
  const showTyping = Array.isArray(p.typingSubjects) && p.typingSubjects.length > 0
  const logoUrls = p.certificationLogoUrls ?? p.partnerLogoUrls ?? []
  const displayPct = p.percentage != null ? p.percentage : p.marksScored

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.outerFrame}>
          <View style={s.innerFrame}>

            {/* Corner accents */}
            <CornerAccent top={4} left={4} />
            <CornerAccent top={4} right={4} flipX />
            <CornerAccent bottom={4} left={4} flipY />
            <CornerAccent bottom={4} right={4} flipX flipY />

            {/* Mid-edge decorations */}
            <LeftMidEdge />
            <RightMidEdge />

            {/* Top row */}
            <View style={s.topRow}>
              <Text style={s.topText}>Reg. by Govt. of India</Text>
              {p.settings.institute_reg_number ? (
                <Text style={s.topText}>Reg. No.-{p.settings.institute_reg_number}</Text>
              ) : null}
            </View>

            {/* 3-column header: training logo | brand | student photo */}
            <View style={s.body3col}>
              <View style={s.bodyLeft}>
                {p.trainingCenterLogoUrl ? (
                  <PdfImage src={p.trainingCenterLogoUrl} style={s.trainingLogo} />
                ) : p.settings.training_center_logo_url ? (
                  <PdfImage src={p.settings.training_center_logo_url} style={s.trainingLogo} />
                ) : null}
              </View>

              <View style={s.bodyCenter}>
                {/* Brand title */}
                <View style={s.brandRow}>
                  <Text>
                    <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 26, color: '#000', letterSpacing: 1 }}>UN</Text>
                    <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 26, color: RED, letterSpacing: 1 }}>SKILLS</Text>
                    <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 26, color: '#000', letterSpacing: 1 }}> COMPUTER EDUCATION</Text>
                    <Text style={{ fontFamily: 'ArchivoBlack', fontSize: 13, color: '#000' }}>™</Text>
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
                <Text style={s.certTitleScript}>Certificate of Qualification</Text>

                {/* Decorative underline flourish */}
                <Svg width="220" height="8" style={{ alignSelf: 'center', marginBottom: 8 }}>
                  <Rect x="0" y="2" width="4" height="4" fill={NAVY} />
                  <Line x1="8" y1="4" x2="212" y2="4" stroke={NAVY} strokeWidth="0.8" />
                  <Rect x="216" y="2" width="4" height="4" fill={NAVY} />
                </Svg>

                {/* "This Certificate Is Proudly Presented To" */}
                <View style={s.presentedRow}>
                  <NavySquare />
                  <Text style={s.presentedText}>This Certificate Is Proudly Presented To</Text>
                  <NavySquare />
                </View>

                {/* Student name */}
                <Text style={s.studentName}>{p.salutation} {p.studentName}</Text>

                {/* Body copy */}
                <View style={s.bodyBlock}>
                  <Text style={s.bodyLine}>has successfully attended the</Text>
                  <Text style={s.bodyCourseLine}>{p.courseCode} – {p.courseName}</Text>
                  <Text style={s.bodyLine}>
                    learning at UnSkills Computer Education
                    {p.trainingCenterLocation ? ` located in ${p.trainingCenterLocation}` : (p.trainingCenterName ? ` at ${p.trainingCenterName}` : '')}
                  </Text>
                  <Text style={s.bodyLine}>
                    and entitled to all honors and privileges associated with this achievement
                  </Text>
                  <Text style={s.bodyLine}>
                    on {p.issueDate} with Secured{' '}
                    <Text style={{ fontWeight: 700 }}>{displayPct}%</Text> marks and achieved Grade{' '}
                    <Text style={{ fontWeight: 700 }}>{p.grade}</Text>
                  </Text>
                </View>

                {/* Typing table (if applicable) */}
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

              <View style={s.bodyRight}>
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

            {/* Bottom row */}
            <View style={s.bottomRow}>

              {/* Bottom-left: pills + cert number + QR */}
              <View style={s.bottomLeft}>
                {p.courseDuration ? (
                  <View style={s.pillRow}>
                    <View style={{ backgroundColor: RED, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#fff' }}>
                        Duration: {p.courseDuration}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {p.rollNumber ? (
                  <View style={s.pillRow}>
                    <View style={{ backgroundColor: '#000', paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#fff' }}>
                        Roll Number: {p.rollNumber}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Text style={s.certNumLabel}>CERTIFICATE NUMBER</Text>
                <Text style={s.certNum}>{p.certificateNumber}</Text>

                <View style={s.qrContactRow}>
                  {p.qrCodeDataUrl ? (
                    <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} />
                  ) : null}
                  <View style={s.contactBlock}>
                    <Text style={s.contactLine}>info@unskillseducation.com</Text>
                    <Text style={s.contactLine}>www.unskillseducation.com</Text>
                    <View style={s.socialRow}>
                      <SocialDot /><SocialDot /><SocialDot />
                    </View>
                  </View>
                </View>
              </View>

              {/* Bottom-center: partner logos */}
              <View style={s.bottomCenter}>
                {logoUrls.slice(0, 5).map((url, i) => (
                  <PdfImage key={i} src={url} style={s.partnerLogo} />
                ))}
              </View>

              {/* Bottom-right: signature */}
              <View style={s.bottomRight}>
                {p.settings.signature_image_url ? (
                  <PdfImage src={p.settings.signature_image_url} style={s.sigImg} />
                ) : (
                  <View style={{ height: 35 }} />
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

            {/* Spacer pushes badge strip + footer to bottom */}
            <View style={s.spacer} />

            {/* Certification badge strip */}
            {logoUrls.length > 0 ? (
              <View style={s.certStrip}>
                {logoUrls.slice(0, 8).map((url, i) => (
                  <PdfImage key={i} src={url} style={s.certLogo} />
                ))}
              </View>
            ) : null}

            {/* Footer */}
            <View style={s.footer}>
              {p.settings.corporate_office_address ? (
                <Text style={s.footerText}>
                  Corporate Office: {p.settings.corporate_office_address}
                </Text>
              ) : null}
              <Text style={s.footerText}>
                {p.settings.verification_url_base
                  ? `To verify this certificate visit: ${p.settings.verification_url_base}`
                  : ''}
                {p.settings.verification_url_base && p.settings.contact_email ? '  |  ' : ''}
                {p.settings.contact_email ? `Mail us: ${p.settings.contact_email}` : ''}
              </Text>
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
  await registerPdfFonts()
  return await pdf(<CertificateOfQualification {...p} />).toBlob()
}
