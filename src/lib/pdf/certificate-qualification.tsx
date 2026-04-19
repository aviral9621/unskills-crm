import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  Svg,
  Path,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { CertificateSettings, TypingSubject } from '../../types/certificate'
import { registerPdfFonts } from './fonts'
import { certColors as C } from './certificate-tokens'

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
  performanceText: string
  marksScored: number
  grade: string
  typingSubjects?: TypingSubject[] | null
  trainingCenterLogoUrl?: string | null
  partnerLogoUrls?: string[]
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'DMSans',
    fontSize: 10,
    color: C.textPrimary,
    backgroundColor: C.frameHorizontalBlue,
    padding: 6,
  },
  whitePad: { backgroundColor: '#FFFFFF', flexGrow: 1, padding: 2 },
  bronzeFrame: {
    borderWidth: 1,
    borderColor: C.frameInnerBronze,
    flexGrow: 1,
    padding: 14,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },

  cornerStar: { position: 'absolute', width: 46, height: 46 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  topText: { fontSize: 9, fontWeight: 700, color: '#000' },

  brandRow: { alignItems: 'center', marginTop: 2 },
  brandTitle: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#000',
  },

  blackBar: {
    alignSelf: 'center',
    backgroundColor: C.titleBlackBar,
    paddingVertical: 4,
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 4,
  },
  blackBarText: { fontSize: 11, fontWeight: 700, color: '#FFFFFF' },

  subHeader: { fontSize: 8.5, textAlign: 'center', color: C.textPrimary, lineHeight: 1.4 },

  body: { flexDirection: 'row', marginTop: 8, flexGrow: 1 },
  bodyLeft: { width: '18%', alignItems: 'center', justifyContent: 'center' },
  bodyCenter: { width: '64%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bodyRight: { width: '18%', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 },

  trainingLogo: { width: 90, height: 90, objectFit: 'contain', borderRadius: 45 },
  studentPhoto: { width: 85, height: 100, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 85,
    height: 100,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  certTitle: {
    fontFamily: 'GreatVibes',
    fontSize: 38,
    color: C.titleBlack,
    textAlign: 'center',
    marginBottom: 8,
  },
  line: { fontSize: 11, textAlign: 'center', marginBottom: 4 },
  lineBold: { fontSize: 12, fontWeight: 700, textAlign: 'center', marginBottom: 4 },
  lineName: { fontSize: 14, fontWeight: 700, textAlign: 'center', marginBottom: 2 },
  lineUnderline: { textDecoration: 'underline', fontWeight: 700 },

  typingMini: {
    marginTop: 4,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#000',
    width: '92%',
    alignSelf: 'center',
  },
  typingRow: { flexDirection: 'row' },
  typingHeadCell: {
    flex: 1,
    fontSize: 8,
    fontWeight: 700,
    padding: 2,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    backgroundColor: C.tableHeaderBg,
  },
  typingHeadCellLast: {
    flex: 1,
    fontSize: 8,
    fontWeight: 700,
    padding: 2,
    textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
  },
  typingCell: {
    flex: 1,
    fontSize: 8,
    padding: 2,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#000',
  },
  typingCellLast: {
    flex: 1,
    fontSize: 8,
    padding: 2,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#000',
  },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'flex-end' },

  bottomLeft: { alignItems: 'flex-start', width: 170 },
  qrImg: { width: 60, height: 60 },
  pillRow: { flexDirection: 'row', marginTop: 4, alignItems: 'center' },
  pillRed: {
    backgroundColor: C.gradeBadgeRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7.5,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  pillBlack: {
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7.5,
    fontWeight: 700,
    color: '#FFFFFF',
  },

  bottomCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 },
  partnerLogo: { width: 50, height: 30, objectFit: 'contain' },

  bottomRight: { alignItems: 'center', width: 200 },
  sigImg: { width: 120, height: 30, objectFit: 'contain' },
  sigSig: { fontFamily: 'GreatVibes', fontSize: 18, color: '#000', marginTop: -2 },
  sigName: { fontSize: 9, fontWeight: 700, color: '#000', borderTopWidth: 1, borderTopColor: '#000', paddingTop: 2, width: 180, textAlign: 'center', marginTop: 2 },
  sigLine: { fontSize: 8, color: '#000', textAlign: 'center' },
  sigReg: { fontSize: 7, color: '#555', textAlign: 'center', marginTop: 1 },

  footer: { marginTop: 6, alignItems: 'center' },
  footerText: { fontSize: 8.5, textAlign: 'center', lineHeight: 1.4, color: C.footerText },
})

function Star({ style }: { style: any }) {
  return (
    <Svg viewBox="0 0 100 100" style={style}>
      <Path
        d="M50 5 L61 38 L95 38 L67 58 L78 92 L50 72 L22 92 L33 58 L5 38 L39 38 Z"
        fill={C.cornerAccent}
      />
    </Svg>
  )
}

export function CertificateOfQualification(p: CertificateOfQualificationProps) {
  const showTyping = Array.isArray(p.typingSubjects) && p.typingSubjects.length > 0
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.whitePad}>
          <View style={s.bronzeFrame}>
            <Star style={[s.cornerStar, { top: -8, left: -8 }]} />
            <Star style={[s.cornerStar, { top: -8, right: -8 }]} />
            <Star style={[s.cornerStar, { bottom: -8, left: -8 }]} />
            <Star style={[s.cornerStar, { bottom: -8, right: -8 }]} />

            <View style={s.topRow}>
              <Text style={s.topText}>Reg. by Govt. of India</Text>
              <Text style={s.topText}>Reg. No.-{p.settings.institute_reg_number || '—'}</Text>
            </View>

            <View style={s.brandRow}>
              <Text style={s.brandTitle}>
                <Text style={{ color: '#000' }}>UN</Text>
                <Text style={{ color: C.headerRed }}>SKILLS</Text>
                <Text style={{ color: '#000' }}> COMPUTER EDUCATION</Text>
                <Text style={{ fontSize: 12 }}>™</Text>
              </Text>
            </View>

            {p.settings.tagline ? (
              <View style={s.blackBar}>
                <Text style={s.blackBarText}>{p.settings.tagline}</Text>
              </View>
            ) : null}

            {p.settings.sub_header_line_1 ? <Text style={s.subHeader}>{p.settings.sub_header_line_1}</Text> : null}
            {p.settings.sub_header_line_2 ? <Text style={s.subHeader}>{p.settings.sub_header_line_2}</Text> : null}
            {p.settings.sub_header_line_3 ? <Text style={s.subHeader}>{p.settings.sub_header_line_3}</Text> : null}

            <View style={s.body}>
              <View style={s.bodyLeft}>
                {p.trainingCenterLogoUrl ? (
                  <PdfImage src={p.trainingCenterLogoUrl} style={s.trainingLogo} />
                ) : p.settings.training_center_logo_url ? (
                  <PdfImage src={p.settings.training_center_logo_url} style={s.trainingLogo} />
                ) : null}
              </View>

              <View style={s.bodyCenter}>
                <Text style={s.certTitle}>Certificate of Qualification</Text>
                <Text style={s.line}>This is to certify that</Text>
                <Text style={s.lineName}>
                  {p.salutation} {p.studentName}
                </Text>
                <Text style={s.lineBold}>
                  {p.fatherPrefix} {p.fatherName}
                </Text>
                <Text style={s.line}>
                  has successfully completed the{' '}
                  {p.courseLevel ? <Text style={{ fontWeight: 700 }}>{p.courseLevel}</Text> : null}
                </Text>
                <Text style={s.lineBold}>
                  {p.courseCode} - {p.courseName}
                </Text>
                <Text style={s.line}>
                  his/her performance during the course{' '}
                  <Text style={s.lineUnderline}>{p.performanceText}</Text>
                </Text>
                <Text style={s.line}>
                  He/She scored <Text style={{ fontWeight: 700 }}>{p.marksScored}</Text> marks &amp;
                  secured the Grade &ldquo;<Text style={{ fontWeight: 700 }}>{p.grade}</Text>&rdquo;
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

                <Text style={s.line}>We wish him/her for bright future</Text>
                <Text style={s.line}>Held at {p.trainingCenterName}</Text>
              </View>

              <View style={s.bodyRight}>
                {p.studentPhotoUrl ? (
                  <PdfImage src={p.studentPhotoUrl} style={s.studentPhoto} />
                ) : (
                  <View style={s.studentPhotoPlaceholder}>
                    <Text style={{ fontSize: 24, color: '#9CA3AF' }}>
                      {p.studentName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={s.bottomRow}>
              <View style={s.bottomLeft}>
                {p.qrCodeDataUrl ? <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} /> : null}
                <View style={s.pillRow}>
                  <Text style={s.pillRed}>Certificate No.</Text>
                  <Text style={s.pillBlack}>{p.certificateNumber}</Text>
                </View>
                <View style={s.pillRow}>
                  <Text style={s.pillRed}>Date of Issue</Text>
                  <Text style={s.pillBlack}>{p.issueDate}</Text>
                </View>
              </View>

              <View style={s.bottomCenter}>
                {(p.partnerLogoUrls ?? []).slice(0, 3).map((url, i) => (
                  <PdfImage key={i} src={url} style={s.partnerLogo} />
                ))}
              </View>

              <View style={s.bottomRight}>
                {p.settings.signature_image_url ? (
                  <PdfImage src={p.settings.signature_image_url} style={s.sigImg} />
                ) : null}
                <Text style={s.sigSig}>{p.settings.signatory_name || ''}</Text>
                <Text style={s.sigName}>{p.settings.signatory_name || '—'}</Text>
                {p.settings.signatory_designation ? <Text style={s.sigLine}>{p.settings.signatory_designation}</Text> : null}
                {p.settings.signatory_company_line ? <Text style={s.sigLine}>{p.settings.signatory_company_line}</Text> : null}
                {p.settings.signatory_reg_line ? <Text style={s.sigReg}>{p.settings.signatory_reg_line}</Text> : null}
              </View>
            </View>

            <View style={s.footer}>
              {p.settings.corporate_office_address ? (
                <Text style={s.footerText}>{p.settings.corporate_office_address}</Text>
              ) : null}
              {p.settings.verification_url_base ? (
                <Text style={s.footerText}>To verify: {p.settings.verification_url_base}</Text>
              ) : null}
              {p.settings.contact_email ? (
                <Text style={s.footerText}>Mail: {p.settings.contact_email}</Text>
              ) : null}
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
