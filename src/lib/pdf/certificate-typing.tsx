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
    fontFamily: 'DMSans',
    fontSize: 10,
    color: C.textPrimary,
    backgroundColor: C.frameOuterNavy,
    padding: 14,
  },
  innerCard: {
    backgroundColor: '#FFFFFF',
    flexGrow: 1,
    borderWidth: 2,
    borderColor: C.frameInnerBronze,
    padding: 18,
    position: 'relative',
  },

  cornerSvg: { position: 'absolute', width: 40, height: 40 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  topText: { fontSize: 9, fontWeight: 700 },

  brandTitle: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 2,
  },

  blackBar: {
    alignSelf: 'center',
    backgroundColor: C.titleBlackBar,
    paddingVertical: 3,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  blackBarText: { fontSize: 10.5, fontWeight: 700, color: '#FFFFFF' },

  subHeader: { fontSize: 8.5, textAlign: 'center', color: C.textPrimary, lineHeight: 1.4 },

  certTitle: {
    fontFamily: 'GreatVibes',
    fontSize: 32,
    color: C.titleBlack,
    textAlign: 'center',
    marginVertical: 10,
  },

  infoTable: {
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column',
    marginBottom: 10,
  },
  infoRow: { flexDirection: 'row' },
  infoHeadCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  infoHeadCellLast: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
  },
  infoCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  infoCellLast: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#000',
  },

  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  centerLogoCol: { width: 70, alignItems: 'center' },
  centerLogo: { width: 50, height: 50, objectFit: 'contain', borderRadius: 25 },
  studentCenter: { flex: 1, alignItems: 'center' },
  presentedText: { fontSize: 12, textAlign: 'center', marginBottom: 2 },
  studentName: {
    fontSize: 20,
    fontWeight: 700,
    color: C.studentNameRed,
    textAlign: 'center',
    marginVertical: 2,
  },
  fatherLine: { fontSize: 11, fontWeight: 700, textAlign: 'center' },
  studentPhotoCol: { width: 80, alignItems: 'center' },
  studentPhoto: { width: 70, height: 80, objectFit: 'cover', borderWidth: 1, borderColor: '#000' },
  studentPhotoPlaceholder: {
    width: 70,
    height: 80,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { alignItems: 'center', marginVertical: 4 },
  bodyLine: { fontSize: 11, textAlign: 'center', lineHeight: 1.5 },
  bodyScript: { fontFamily: 'GreatVibes', fontSize: 18, textAlign: 'center', marginVertical: 2 },

  marksTable: { borderWidth: 1, borderColor: '#000', marginTop: 6, marginBottom: 6 },
  mtRow: { flexDirection: 'row' },
  mtHeadCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  mtHeadCellLast: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    backgroundColor: C.tableHeaderBg,
  },
  mtCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  mtCellFirst: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'left',
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  mtCellLast: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    padding: 5,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#000',
  },

  legend: { marginTop: 4, alignItems: 'flex-start' },
  legendHead: { fontSize: 9, fontWeight: 700, marginBottom: 1 },
  legendLine: { fontSize: 8.5, lineHeight: 1.3 },

  bottomRow: { flexDirection: 'row', marginTop: 8, justifyContent: 'space-between', alignItems: 'flex-end' },
  bottomLeft: { width: 180 },
  qrImg: { width: 65, height: 65 },
  pillRow: { flexDirection: 'row', marginTop: 4, alignItems: 'center' },
  pillRed: {
    backgroundColor: C.gradeBadgeRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  pillBlack: {
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: 700,
    color: '#FFFFFF',
  },

  bottomRight: { alignItems: 'center', width: 200 },
  sigImg: { width: 120, height: 30, objectFit: 'contain' },
  sigSig: { fontFamily: 'GreatVibes', fontSize: 18, color: '#000' },
  sigName: { fontSize: 9, fontWeight: 700, color: '#000', borderTopWidth: 1, borderTopColor: '#000', paddingTop: 2, width: 180, textAlign: 'center', marginTop: 2 },
  sigLine: { fontSize: 8, color: '#000', textAlign: 'center' },
  sigReg: { fontSize: 7, color: '#555', textAlign: 'center', marginTop: 1 },

  certStrip: {
    marginTop: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  certLogo: { height: 26, width: 40, objectFit: 'contain' },

  footer: { marginTop: 4, alignItems: 'center' },
  footerText: { fontSize: 9, textAlign: 'center', lineHeight: 1.4 },
})

function CornerL({ style, flipX = false, flipY = false }: { style: any; flipX?: boolean; flipY?: boolean }) {
  let d: string
  if (flipX && flipY) d = 'M40 40 L40 12 Q40 2 30 2 L12 2'
  else if (flipX) d = 'M40 0 L40 28 Q40 38 30 38 L12 38'
  else if (flipY) d = 'M0 40 L0 12 Q0 2 10 2 L28 2'
  else d = 'M0 0 L0 28 Q0 38 10 38 L28 38'
  return (
    <Svg viewBox="0 0 40 40" style={style}>
      <Path d={d} stroke={C.frameInnerBronze} strokeWidth={2} fill="none" />
    </Svg>
  )
}

export function ComputerBasedTypingCertificate(p: ComputerBasedTypingCertificateProps) {
  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        <View style={s.innerCard}>
          <CornerL style={[s.cornerSvg, { top: -4, left: -4 }]} />
          <CornerL style={[s.cornerSvg, { top: -4, right: -4 }]} flipX />
          <CornerL style={[s.cornerSvg, { bottom: -4, left: -4 }]} flipY />
          <CornerL style={[s.cornerSvg, { bottom: -4, right: -4 }]} flipX flipY />

          <View style={s.topRow}>
            <Text style={s.topText}>Certificate No : {p.certificateNumber}</Text>
            <Text style={s.topText}>Reg. No.-{p.settings.institute_reg_number || '—'}</Text>
          </View>

          <Text style={s.brandTitle}>
            <Text style={{ color: '#000' }}>UN</Text>
            <Text style={{ color: C.headerRed }}>SKILLS</Text>
            <Text style={{ color: '#000' }}> COMPUTER EDUCATION</Text>
            <Text style={{ fontSize: 10 }}>™</Text>
          </Text>

          {p.settings.tagline ? (
            <View style={s.blackBar}>
              <Text style={s.blackBarText}>{p.settings.tagline}</Text>
            </View>
          ) : null}

          {p.settings.sub_header_line_1 ? <Text style={s.subHeader}>{p.settings.sub_header_line_1}</Text> : null}
          {p.settings.sub_header_line_2 ? <Text style={s.subHeader}>{p.settings.sub_header_line_2}</Text> : null}
          {p.settings.sub_header_line_3 ? <Text style={s.subHeader}>{p.settings.sub_header_line_3}</Text> : null}

          <Text style={s.certTitle}>Computer Based Typing Examination</Text>

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
                  <Text style={{ fontSize: 24, color: '#9CA3AF' }}>{p.studentName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.body}>
            <Text style={s.bodyLine}>has passed in the following subject of the</Text>
            <Text style={s.bodyScript}>Computer Based Typing Examination</Text>
            <Text style={s.bodyLine}>Designed and developed as per the standard of</Text>
            <Text style={s.bodyScript}>{p.settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.'}</Text>
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

          <View style={s.bottomRow}>
            <View style={s.bottomLeft}>
              {p.qrCodeDataUrl ? <PdfImage src={p.qrCodeDataUrl} style={s.qrImg} /> : null}
              <View style={s.pillRow}>
                <Text style={s.pillRed}>Grade</Text>
                <Text style={s.pillBlack}>{p.grade}</Text>
              </View>
              <View style={s.pillRow}>
                <Text style={s.pillRed}>Date of Issue</Text>
                <Text style={s.pillBlack}>{p.issueDate}</Text>
              </View>
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

          {(p.certificationLogoUrls ?? []).length > 0 ? (
            <View style={s.certStrip}>
              {(p.certificationLogoUrls ?? []).slice(0, 8).map((url, i) => (
                <PdfImage key={i} src={url} style={s.certLogo} />
              ))}
            </View>
          ) : null}

          <View style={s.footer}>
            {p.settings.corporate_office_address ? (
              <Text style={s.footerText}>Head Office : {p.settings.corporate_office_address}</Text>
            ) : null}
            {p.settings.verification_url_base ? (
              <Text style={s.footerText}>To verify this certificate visit : {p.settings.verification_url_base}</Text>
            ) : null}
            {p.settings.contact_email ? (
              <Text style={s.footerText}>Mail us : {p.settings.contact_email}</Text>
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
