/**
 * IMAGE FORMAT POLICY:
 * @react-pdf/renderer only supports PNG and JPG for <Image> components.
 * WEBP / AVIF / SVG / GIF will fail silently or cascade errors.
 * All images referenced here must be PNG or JPG.
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
import { registerPdfFonts, FONTS } from './register-fonts'

// Ensure fonts are registered before any PDF component is rendered
registerPdfFonts()

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

const NAVY = '#0B2447'
const RED = '#C8102E'
const GOLD = '#B8860B'

const s = StyleSheet.create({
  page: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    position: 'absolute',
    top: 85,
    left: 100,
    right: 100,
    bottom: 85,
    flexDirection: 'column',
  },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  topText: { fontSize: 8, fontWeight: 700, color: '#1A1A1A' },

  brandLine: { textAlign: 'center', marginBottom: 3 },

  blackBar: {
    alignSelf: 'center',
    backgroundColor: '#000000',
    paddingVertical: 3,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  blackBarText: { fontSize: 9, fontWeight: 700, color: '#FFFFFF' },

  certTitle: {
    fontFamily: FONTS.script,
    fontSize: 38,
    color: NAVY,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },

  presentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  presentedText: { fontSize: 10, color: '#1A1A1A' },
  smallSquare: { width: 3, height: 3, backgroundColor: NAVY, marginHorizontal: 6 },

  bodyRow: { flexDirection: 'row', marginBottom: 4 },
  bodyLeft: { width: 90, alignItems: 'center', justifyContent: 'center' },
  bodyCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  bodyRight: { width: 90, alignItems: 'center', justifyContent: 'flex-start' },

  trainingLogo: { width: 70, height: 70, objectFit: 'contain', borderRadius: 35 },
  studentPhoto: { width: 75, height: 85, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 75, height: 85, borderWidth: 1, borderColor: '#000',
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },

  studentName: {
    fontSize: 16, fontWeight: 700, color: NAVY, textAlign: 'center',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  bodyLine: { fontSize: 10, textAlign: 'center', lineHeight: 1.6, color: '#1A1A1A' },
  bodyCourse: { fontSize: 11, fontWeight: 700, color: NAVY, textAlign: 'center', marginVertical: 2 },

  typingMini: {
    marginTop: 3, borderWidth: 1, borderColor: '#000',
    width: '70%', alignSelf: 'center',
  },
  typingRow: { flexDirection: 'row' },
  typingHeadCell: {
    flex: 1, fontSize: 7, fontWeight: 700, padding: 2, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#000', backgroundColor: '#F5F5F5',
  },
  typingHeadCellLast: {
    flex: 1, fontSize: 7, fontWeight: 700, padding: 2, textAlign: 'center', backgroundColor: '#F5F5F5',
  },
  typingCell: {
    flex: 1, fontSize: 7, padding: 2, textAlign: 'center',
    borderRightWidth: 1, borderRightColor: '#000', borderTopWidth: 1, borderTopColor: '#000',
  },
  typingCellLast: {
    flex: 1, fontSize: 7, padding: 2, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: '#000',
  },

  bottomRow: { flexDirection: 'row', marginTop: 4, alignItems: 'flex-start' },
  bottomLeft: { width: 180 },
  certNumLabel: { fontSize: 8, fontWeight: 700, color: '#1A1A1A' },
  certNum: { fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 },
  qrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  qrImg: { width: 50, height: 50, borderWidth: 1, borderColor: '#000' },
  contactCol: { flex: 1 },
  contactLine: { fontSize: 8, color: '#1A1A1A', lineHeight: 1.4 },

  bottomCenter: { flex: 1, paddingHorizontal: 10, justifyContent: 'center' },
  partnerRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    alignItems: 'center', marginTop: 20,
  },
  partnerLogo: { height: 30, width: 38, objectFit: 'contain' },

  bottomRight: { width: 200, alignItems: 'flex-end' },
  sigImg: { width: 130, height: 30, objectFit: 'contain' },
  sigHLine: { width: 150, borderTopWidth: 1, borderTopColor: '#000', marginTop: 3, marginBottom: 2 },
  sigTitle: { fontSize: 10, fontWeight: 700, color: '#000', textAlign: 'right' },
  sigCompany: { fontSize: 9, color: '#000', textAlign: 'right' },
  sigReg: { fontSize: 7, color: '#555', textAlign: 'right', marginTop: 1 },

  spacer: { flexGrow: 1 },

  certStrip: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: GOLD,
  },
  certLogo: { height: 22, objectFit: 'contain' },

  footer: { alignItems: 'center', marginTop: 4 },
  footerText: { fontSize: 8, textAlign: 'center', color: '#1A1A1A' },
})

export function CertificateOfQualification(p: CertificateOfQualificationProps) {
  const showTyping = Array.isArray(p.typingSubjects) && p.typingSubjects.length > 0
  const logoUrls = p.certificationLogoUrls ?? p.partnerLogoUrls ?? []
  const displayPct = p.percentage != null ? p.percentage : p.marksScored

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page} wrap={false}>
        {/* Fixed background — renders on every page without flowing */}
        <View style={s.backgroundContainer} fixed>
          <PdfImage src="/Landscape.png" style={s.backgroundImage} />
        </View>

        {/* Content overlay inside safe zone */}
        <View style={s.contentContainer}>

          <View style={s.topRow}>
            <Text style={s.topText}>Reg. by Govt. of India</Text>
            {p.settings.institute_reg_number ? (
              <Text style={s.topText}>Reg. No.-{p.settings.institute_reg_number}</Text>
            ) : null}
          </View>

          <Text style={s.brandLine}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#000', letterSpacing: 1 }}>UN</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: RED, letterSpacing: 1 }}>SKILLS</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#000', letterSpacing: 1 }}> COMPUTER EDUCATION</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: '#000' }}>™</Text>
          </Text>

          {p.settings.tagline ? (
            <View style={s.blackBar}>
              <Text style={s.blackBarText}>{p.settings.tagline}</Text>
            </View>
          ) : null}

          <Text style={s.certTitle}>Certificate of Qualification</Text>

          <View style={s.presentedRow}>
            <View style={s.smallSquare} />
            <Text style={s.presentedText}>This Certificate Is Proudly Presented To</Text>
            <View style={s.smallSquare} />
          </View>

          <View style={s.bodyRow}>
            <View style={s.bodyLeft}>
              {p.trainingCenterLogoUrl ? (
                <PdfImage src={p.trainingCenterLogoUrl} style={s.trainingLogo} />
              ) : p.settings.training_center_logo_url ? (
                <PdfImage src={p.settings.training_center_logo_url} style={s.trainingLogo} />
              ) : null}
            </View>

            <View style={s.bodyCenter}>
              <Text style={s.studentName}>{p.salutation} {p.studentName}</Text>
              <Text style={s.bodyLine}>has successfully attended the</Text>
              <Text style={s.bodyCourse}>{p.courseCode} – {p.courseName}</Text>
              <Text style={s.bodyLine}>learning at UnSkills Computer Education</Text>
              <Text style={s.bodyLine}>
                at <Text style={{ fontWeight: 700 }}>{p.trainingCenterName}</Text>
              </Text>
              <Text style={s.bodyLine}>
                and entitled to all honors and privileges associated with this achievement
              </Text>
              <Text style={s.bodyLine}>
                on <Text style={{ fontWeight: 700 }}>{p.issueDate}</Text> with Secured{' '}
                <Text style={{ fontWeight: 700 }}>{displayPct}%</Text> marks and achieved Grade{' '}
                <Text style={{ fontWeight: 700 }}>{p.grade}</Text>
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

          <View style={s.spacer} />

          <View style={s.bottomRow}>
            <View style={s.bottomLeft}>
              <Text style={s.certNumLabel}>CERTIFICATE NUMBER</Text>
              <Text style={s.certNum}>{p.certificateNumber}</Text>
              <View style={s.qrRow}>
                {p.qrCodeDataUrl ? (
                  <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} />
                ) : null}
                <View style={s.contactCol}>
                  {p.settings.contact_email ? (
                    <Text style={s.contactLine}>{p.settings.contact_email}</Text>
                  ) : null}
                  {p.settings.verification_url_base ? (
                    <Text style={s.contactLine}>
                      {p.settings.verification_url_base.replace(/^https?:\/\//, '')}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={s.bottomCenter}>
              <View style={s.partnerRow}>
                {logoUrls.slice(0, 5).map((url, i) => (
                  <PdfImage key={i} src={url} style={s.partnerLogo} />
                ))}
              </View>
            </View>

            <View style={s.bottomRight}>
              {p.settings.signature_image_url ? (
                <PdfImage src={p.settings.signature_image_url} style={s.sigImg} />
              ) : (
                <View style={{ height: 30 }} />
              )}
              <View style={s.sigHLine} />
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
            <View style={s.certStrip}>
              {logoUrls.slice(0, 7).map((url, i) => (
                <PdfImage key={i} src={url} style={s.certLogo} />
              ))}
            </View>
          ) : null}

          <View style={s.footer}>
            <Text style={s.footerText}>
              {p.settings.verification_url_base
                ? `To verify this certificate visit: ${p.settings.verification_url_base}`
                : ''}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function buildCertificateOfQualificationBlob(
  p: CertificateOfQualificationProps,
): Promise<Blob> {
  registerPdfFonts()
  return await pdf(<CertificateOfQualification {...p} />).toBlob()
}
