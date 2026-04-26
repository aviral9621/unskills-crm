import type { CardSettings } from '../cardSettings'

export interface IdCardBranch {
  name: string | null
  center_logo_url: string | null
  address_line1: string | null
  village: string | null
  block: string | null
  district: string | null
  state: string | null
  pincode: string | null
  director_phone: string | null
  director_email: string | null
}

export interface IdCardStudent {
  id: string
  registration_no: string
  name: string
  father_name: string
  dob: string | null
  course?: { name: string } | null
  branch?: IdCardBranch | null
}

export interface IdCardInput {
  student: IdCardStudent
  qrDataUrl: string
  photoDataUrl: string
  logoDataUrl: string
  title: string
  settings: CardSettings
  mainBranch: IdCardBranch | null
}

function fmtDob(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatBranchAddress(b: IdCardBranch | null | undefined): string {
  if (!b) return ''
  return [b.address_line1, b.village, b.block, b.district, b.state, b.pincode]
    .filter(Boolean)
    .join(', ')
}

export async function buildIdCardPdfBlob(cards: IdCardInput[]): Promise<Blob | null> {
  if (cards.length === 0) return null
  const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet } = await import('@react-pdf/renderer')

  const W = 240, H = 380

  const s = StyleSheet.create({
    page:        { width: W, height: H, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
    header:      { height: 62, backgroundColor: '#111111', flexDirection: 'row', alignItems: 'stretch' },
    headerRed:   { flex: 1, backgroundColor: '#B91C1C', padding: 6, justifyContent: 'center' },
    headerTitle: { color: '#FFFFFF', fontSize: 9.5, fontWeight: 'bold', letterSpacing: 0.2 },
    headerSub:   { color: '#FFFFFF', fontSize: 5, marginTop: 2, lineHeight: 1.3 },
    headerLogo:  { width: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111' },
    logoImg:     { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', padding: 2 },
    body:        { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
    photoWrap:   { alignItems: 'center', marginBottom: 5 },
    photo:       { width: 78, height: 78, objectFit: 'cover', borderRadius: 4, border: '1.5px solid #E5E7EB' },
    photoPh:     { width: 78, height: 78, borderRadius: 4, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', border: '1.5px solid #E5E7EB' },
    name:        { color: '#B91C1C', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 6, letterSpacing: 0.3 },
    infoRow:     { flexDirection: 'row', marginBottom: 3 },
    infoLabel:   { width: 74, fontSize: 8, color: '#111827' },
    infoSep:     { width: 6, fontSize: 8, color: '#111827' },
    infoValue:   { flex: 1, fontSize: 8, color: '#111827', fontWeight: 'bold' },
    qrWrap:      { marginTop: 4, alignItems: 'flex-end' },
    qr:          { width: 50, height: 50 },
    footerRed:   { height: 3, backgroundColor: '#B91C1C' },
    footer:      { backgroundColor: '#111111', paddingHorizontal: 8, paddingVertical: 5 },
    ftLine:      { color: '#FFFFFF', fontSize: 6, textAlign: 'center', marginBottom: 1.2, lineHeight: 1.3 },
    ftBold:      { fontWeight: 'bold' },
  })

  const Doc = (
    <Document>
      {cards.map(({ student, qrDataUrl, photoDataUrl, logoDataUrl, title, settings, mainBranch }) => {
        const course = student.course?.name || '—'
        const branchAddr = formatBranchAddress(student.branch) || settings.address
        const headAddr = formatBranchAddress(mainBranch) || settings.address
        const phone = student.branch?.director_phone || settings.phone
        const email = student.branch?.director_email || ''
        return (
          <Page key={student.id} size={[W, H]} wrap={false} style={s.page}>
            <View style={s.header}>
              <View style={s.headerRed}>
                <Text style={s.headerTitle}>{title || settings.header_title}</Text>
                <Text style={s.headerSub}>{settings.header_subtitle}</Text>
              </View>
              <View style={s.headerLogo}>
                {logoDataUrl ? <PdfImage src={logoDataUrl} style={s.logoImg} /> : null}
              </View>
            </View>
            <View style={s.body}>
              <View style={s.photoWrap}>
                {photoDataUrl
                  ? <PdfImage src={photoDataUrl} style={s.photo} />
                  : <View style={s.photoPh}><Text style={{ fontSize: 28, color: '#9CA3AF', fontWeight: 'bold' }}>{student.name.charAt(0).toUpperCase()}</Text></View>}
              </View>
              <Text style={s.name}>{student.name.toUpperCase()}</Text>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Registration No.</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{student.registration_no}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Father&apos;s Name</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{(student.father_name || '—').toUpperCase()}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>D.O.B.</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{student.dob ? fmtDob(student.dob) : '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Course</Text>
                <Text style={s.infoSep}>:</Text>
                <Text style={s.infoValue}>{course}</Text>
              </View>
              {qrDataUrl && (
                <View style={s.qrWrap}>
                  <PdfImage src={qrDataUrl} style={s.qr} />
                </View>
              )}
            </View>
            <View style={s.footerRed} />
            <View style={s.footer}>
              <Text style={s.ftLine}><Text style={s.ftBold}>Branch Address :</Text> {branchAddr}</Text>
              <Text style={s.ftLine}><Text style={s.ftBold}>Head Office :</Text> {headAddr}</Text>
              <Text style={s.ftLine}><Text style={s.ftBold}>Mobile Number :</Text> {phone}</Text>
              {email ? <Text style={s.ftLine}><Text style={s.ftBold}>Email :</Text> {email}</Text> : null}
            </View>
          </Page>
        )
      })}
    </Document>
  )
  return await pdf(Doc).toBlob()
}
