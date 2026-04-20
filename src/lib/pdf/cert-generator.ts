import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CertificateSettings {
  institute_reg_number?: string | null
  corporate_office_address?: string | null
  verification_url_base?: string | null
  contact_email?: string | null
  website?: string | null
  signatory_name?: string | null
  signatory_designation?: string | null
  signatory_company_line?: string | null
  signatory_reg_line?: string | null
  signature_image_url?: string | null
  sub_header_line_1?: string | null
  sub_header_line_2?: string | null
  sub_header_line_3?: string | null
}

export interface LandscapeCertData {
  settings: CertificateSettings
  certificateNumber: string
  salutation: string
  studentName: string
  fatherPrefix: string
  fatherName: string
  studentPhotoUrl?: string | null
  courseCode: string
  courseName: string
  trainingCenterName: string
  performanceText?: string
  percentage: number
  grade: string
  issueDate: string
  qrCodeDataUrl: string
  trainingCenterLogoUrl?: string | null
  certificationLogoUrls?: string[]
}

export interface PortraitCertData {
  settings: CertificateSettings
  certificateNumber: string
  salutation?: string
  studentName: string
  fatherPrefix: string
  fatherName: string
  studentPhotoUrl?: string | null
  enrollmentNumber: string
  trainingCenterCode: string
  trainingCenterName: string
  trainingCenterLogoUrl?: string | null
  typingSubjects: Array<{ name: string; speed: number; max: number; min: number; obtained: number }>
  grade: string
  issueDate: string
  qrCodeDataUrl: string
  certificationLogoUrls?: string[]
}

// ─── Color palette ────────────────────────────────────────────────────────────

const C = {
  black: rgb(0, 0, 0),
  navy: rgb(0.043, 0.141, 0.278),
  red: rgb(0.784, 0.063, 0.180),
  gold: rgb(0.722, 0.525, 0.043),
  white: rgb(1, 1, 1),
  textDark: rgb(0.039, 0.039, 0.039),
  textSecondary: rgb(0.29, 0.29, 0.29),
  tableHeaderBg: rgb(0.96, 0.96, 0.96),
}

// ─── Font set ─────────────────────────────────────────────────────────────────

interface FontSet {
  body: PDFFont
  bodyBold: PDFFont
  script: PDFFont    // Great Vibes
  display: PDFFont   // Archivo Black
}

async function fetchBytes(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

async function loadFonts(pdfDoc: PDFDocument): Promise<FontSet> {
  pdfDoc.registerFontkit(fontkit)

  const [scriptBytes, displayBytes] = await Promise.all([
    fetchBytes('/fonts/GreatVibes-Regular.ttf'),
    fetchBytes('/fonts/ArchivoBlack-Regular.ttf'),
  ])

  const body = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bodyBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const script = scriptBytes
    ? await pdfDoc.embedFont(scriptBytes)
    : await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const display = displayBytes
    ? await pdfDoc.embedFont(displayBytes)
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  return { body, bodyBold, script, display }
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function embedUrl(pdfDoc: PDFDocument, url: string): Promise<PDFImage | null> {
  const bytes = await fetchBytes(encodeURI(url))
  if (!bytes) return null
  try {
    if (/\.png$/i.test(url) || url.startsWith('data:image/png')) return await pdfDoc.embedPng(bytes)
    if (/\.jpe?g$/i.test(url) || url.startsWith('data:image/jp')) return await pdfDoc.embedJpg(bytes)
    // Try PNG first, then JPG
    try { return await pdfDoc.embedPng(bytes) } catch { return await pdfDoc.embedJpg(bytes) }
  } catch { return null }
}

async function embedAny(pdfDoc: PDFDocument, src: string): Promise<PDFImage | null> {
  if (!src) return null
  if (src.startsWith('data:')) {
    try {
      if (src.includes('image/png')) return await pdfDoc.embedPng(src)
      if (src.includes('image/jp')) return await pdfDoc.embedJpg(src)
      try { return await pdfDoc.embedPng(src) } catch { return await pdfDoc.embedJpg(src) }
    } catch { return null }
  }
  return embedUrl(pdfDoc, src)
}

// Badge paths matching actual files in public/
const BADGE_PATHS = [
  '/ISO LOGOs.png',
  '/MSME loogo.png',
  '/Skill India Logo.png',
  '/NSDC logo.png',
  '/Digital India logo.png',
  '/ANSI logo.png',
  '/IAF LOGO.png',
]

async function loadBadges(pdfDoc: PDFDocument, overrides?: string[]): Promise<(PDFImage | null)[]> {
  const sources = (overrides && overrides.length > 0) ? overrides : BADGE_PATHS
  return Promise.all(sources.map(s => embedAny(pdfDoc, s)))
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number; y: number; size: number; font: PDFFont
    color?: ReturnType<typeof rgb>
    align?: 'left' | 'center' | 'right'
    letterSpacing?: number
  }
) {
  if (!text) return
  const { x, y, size, font, color = C.textDark, align = 'left', letterSpacing = 0 } = opts

  if (letterSpacing > 0) {
    const chars = text.split('')
    const totalW = chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size) + letterSpacing, 0) - letterSpacing
    let cx = align === 'center' ? x - totalW / 2 : align === 'right' ? x - totalW : x
    for (const ch of chars) {
      page.drawText(ch, { x: cx, y, size, font, color })
      cx += font.widthOfTextAtSize(ch, size) + letterSpacing
    }
  } else {
    const w = font.widthOfTextAtSize(text, size)
    const drawX = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
    page.drawText(text, { x: drawX, y, size, font, color })
  }
}

function drawBrandTitle(page: PDFPage, opts: { cx: number; y: number; size: number; font: PDFFont }) {
  const { cx, y, size, font } = opts
  const parts = [
    { text: 'UN', color: C.black },
    { text: 'SKILLS', color: C.red },
    { text: ' COMPUTER EDUCATION', color: C.black },
  ]
  const tmSize = size * 0.4
  let totalW = 0
  for (const p of parts) totalW += font.widthOfTextAtSize(p.text, size)
  totalW += font.widthOfTextAtSize('TM', tmSize)

  let curX = cx - totalW / 2
  for (const p of parts) {
    page.drawText(p.text, { x: curX, y, size, font, color: p.color })
    curX += font.widthOfTextAtSize(p.text, size)
  }
  page.drawText('TM', { x: curX, y: y + size * 0.5, size: tmSize, font, color: C.black })
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, t: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color })
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, borderColor?: ReturnType<typeof rgb>, borderWidth?: number) {
  page.drawRectangle({ x, y, width: w, height: h, color, borderColor, borderWidth })
}

function drawDivider(page: PDFPage, cx: number, y: number, halfLen: number) {
  drawLine(page, cx - halfLen, y, cx - 8, y, 0.8, C.gold)
  page.drawRectangle({ x: cx - 3, y: y - 3, width: 6, height: 6, color: C.navy, rotate: degrees(45) })
  drawLine(page, cx + 8, y, cx + halfLen, y, 0.8, C.gold)
}

// ─── Template loader ──────────────────────────────────────────────────────────

const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
const A4_PORTRAIT: [number, number] = [595.28, 841.89]

/**
 * Builds a fresh A4 doc whose first page is painted with the template PDF's
 * first page (scaled to fill). This normalizes whatever size Canva exported at
 * (e.g. 2631×1860) down to A4 so the hardcoded layout coordinates remain valid.
 * Falls back to a blank A4 page if the template is missing or unparseable.
 */
async function makeDocWithTemplate(
  templatePath: string,
  size: [number, number],
): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(size)
  const [W, H] = size

  const templateBytes = await fetchBytes(templatePath)
  if (!templateBytes) return doc
  try {
    const [embedded] = await doc.embedPdf(templateBytes, [0])
    if (embedded) {
      const ts = embedded.size()
      const scale = Math.max(W / ts.width, H / ts.height)
      const drawW = ts.width * scale
      const drawH = ts.height * scale
      page.drawPage(embedded, {
        x: (W - drawW) / 2,
        y: (H - drawH) / 2,
        width: drawW,
        height: drawH,
      })
    }
  } catch { /* leave blank */ }
  return doc
}

async function loadOrBlankLandscape(): Promise<PDFDocument> {
  return makeDocWithTemplate('/certificate-landscape-template.pdf', A4_LANDSCAPE)
}

async function loadOrBlankPortrait(): Promise<PDFDocument> {
  return makeDocWithTemplate('/certificate-portrait-template.pdf', A4_PORTRAIT)
}

// ─── Landscape content ────────────────────────────────────────────────────────

async function drawLandscapeContent(
  pdfDoc: PDFDocument, page: PDFPage, fonts: FontSet,
  data: LandscapeCertData, W: number, H: number
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta
  drawText(page, 'Reg. by Govt. of India', { x: 70, y: H - 70, size: 8, font: fonts.bodyBold })
  drawText(page, `Reg. No.-${settings.institute_reg_number ?? '—'}`, {
    x: W - 70, y: H - 70, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title
  drawBrandTitle(page, { cx, y: H - 98, size: 22, font: fonts.display })

  // 3. ISO bar
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, 9) + 24
  const isoX = cx - isoW / 2
  const isoY = H - 130
  drawRect(page, isoX, isoY, isoW, 16, C.black)
  drawText(page, isoText, { x: cx, y: isoY + 4, size: 9, font: fonts.bodyBold, color: C.white, align: 'center' })

  // 4. Sub-headers
  const subs = [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]
  let subY = H - 150
  for (const line of subs) {
    if (line) {
      drawText(page, line, { x: cx, y: subY, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center' })
    }
    subY -= 11
  }

  // 5. Certificate title
  drawText(page, 'Certificate of Qualification', {
    x: cx, y: H - 210, size: 34, font: fonts.script, color: C.navy, align: 'center',
  })

  // 6. Divider
  drawDivider(page, cx, H - 222, 95)

  // 7. Presented to line
  drawRect(page, cx - 110, H - 245, 4, 4, C.navy)
  drawText(page, 'This Certificate Is Proudly Presented To', {
    x: cx, y: H - 247, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawRect(page, cx + 106, H - 245, 4, 4, C.navy)

  // 8. Student name
  const heroName = `${data.salutation} ${data.studentName}`.toUpperCase()
  drawText(page, heroName, {
    x: cx, y: H - 278, size: 18, font: fonts.bodyBold, color: C.navy, align: 'center', letterSpacing: 1.5,
  })

  // 9. Body text
  let bodyY = H - 305
  const bSize = 10
  const bStep = 15

  drawText(page, 'has successfully attended the', { x: cx, y: bodyY, size: bSize, font: fonts.body, align: 'center' })
  bodyY -= bStep

  const courseLine = `${data.courseCode} – ${data.courseName}`
  drawText(page, courseLine, { x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: C.navy, align: 'center' })
  bodyY -= bStep

  drawText(page, 'learning at UnSkills Computer Education', { x: cx, y: bodyY, size: bSize, font: fonts.body, align: 'center' })
  bodyY -= bStep

  drawText(page, `at ${data.trainingCenterName}`, { x: cx, y: bodyY, size: bSize, font: fonts.bodyBold, align: 'center' })
  bodyY -= bStep

  drawText(page, 'and entitled to all honors and privileges associated with this achievement', {
    x: cx, y: bodyY, size: bSize, font: fonts.body, align: 'center',
  })
  bodyY -= bStep

  drawText(page, `on ${data.issueDate} with Secured ${data.percentage}% marks and achieved Grade ${data.grade}`, {
    x: cx, y: bodyY, size: bSize, font: fonts.bodyBold, align: 'center',
  })

  // 10. Student photo
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const pW = 70, pH = 80, pX = W - 140, pY = H - 320
      drawRect(page, pX - 1, pY - 1, pW + 2, pH + 2, C.black)
      page.drawImage(photo, { x: pX, y: pY, width: pW, height: pH })
    }
  }

  // 11. Training center logo
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 80, y: H - 310, width: 60, height: 60 })
  }

  // 12. Cert number + QR (bottom-left)
  drawText(page, 'CERTIFICATE NUMBER', { x: 80, y: 165, size: 8, font: fonts.bodyBold })
  drawText(page, data.certificateNumber, { x: 80, y: 148, size: 13, font: fonts.bodyBold, color: C.navy })

  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, 79, 99, 52, 52, C.white, C.black, 0.5)
    page.drawImage(qr, { x: 80, y: 100, width: 50, height: 50 })
  }
  if (settings.contact_email) drawText(page, settings.contact_email, { x: 140, y: 135, size: 8, font: fonts.body })
  if (settings.website) drawText(page, settings.website, { x: 140, y: 122, size: 8, font: fonts.body })

  // 13. Partner logos (center)
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const partnerBadges = badges.slice(0, 5)
  const pAreaX = 310, pAreaW = 220, pStep = pAreaW / 5, pHeight = 28, pY = 115
  for (let i = 0; i < partnerBadges.length; i++) {
    const img = partnerBadges[i]
    if (!img) continue
    const ar = img.width / img.height
    const w = pHeight * ar
    const bx = pAreaX + i * pStep + pStep / 2 - w / 2
    page.drawImage(img, { x: bx, y: pY, width: w, height: pHeight })
  }

  // 14. Signature (right)
  const sigRight = W - 70, sigW = 180
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 150, width: 110, height: 28 })
  }
  drawLine(page, sigRight - sigW + 30, 145, sigRight, 145, 0.8, C.black)
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, { x: sigRight, y: 130, size: 9.5, font: fonts.bodyBold, align: 'right' })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, { x: sigRight, y: 117, size: 8.5, font: fonts.body, align: 'right' })
  }
  if (settings.signatory_reg_line) {
    drawText(page, settings.signatory_reg_line, { x: sigRight, y: 105, size: 7, font: fonts.body, color: C.textSecondary, align: 'right' })
  }

  // 15. Badge strip
  const stripY = 72, stripH = 18, stripX0 = 80, stripX1 = W - 80
  const stripSp = (stripX1 - stripX0) / badges.length
  drawLine(page, stripX0, stripY + stripH + 3, stripX1, stripY + stripH + 3, 0.4, C.gold)
  for (let i = 0; i < badges.length; i++) {
    const img = badges[i]
    if (!img) continue
    const ar = img.width / img.height
    const w = stripH * ar
    const bx = stripX0 + i * stripSp + stripSp / 2 - w / 2
    page.drawImage(img, { x: bx, y: stripY, width: w, height: stripH })
  }

  // 16. Footer
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 55, size: 7.5, font: fonts.body, align: 'center',
    })
  }
}

// ─── Portrait content ─────────────────────────────────────────────────────────

async function drawPortraitContent(
  pdfDoc: PDFDocument, page: PDFPage, fonts: FontSet,
  data: PortraitCertData, W: number, H: number
) {
  const { settings } = data
  const cx = W / 2
  const safeLeft = 85, safeRight = W - 85
  const safeW = safeRight - safeLeft

  // 1. Top meta
  drawText(page, `Certificate No : ${data.certificateNumber}`, { x: safeLeft, y: H - 105, size: 8, font: fonts.bodyBold })
  drawText(page, `Reg. No.-${settings.institute_reg_number ?? '—'}`, {
    x: safeRight, y: H - 105, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title
  drawBrandTitle(page, { cx, y: H - 130, size: 16, font: fonts.display })

  // 3. ISO bar
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, 8.5) + 20
  drawRect(page, cx - isoW / 2, H - 162, isoW, 14, C.black)
  drawText(page, isoText, { x: cx, y: H - 158, size: 8.5, font: fonts.bodyBold, color: C.white, align: 'center' })

  // 4. Sub-headers
  let subY = H - 180
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) drawText(page, line, { x: cx, y: subY, size: 7, font: fonts.body, color: C.textSecondary, align: 'center' })
    subY -= 10
  }

  // 5. Cert title
  drawText(page, 'Computer Based Typing Examination', {
    x: cx, y: H - 228, size: 24, font: fonts.script, color: C.navy, align: 'center',
  })
  drawDivider(page, cx, H - 240, 70)

  // 6. Info table
  const tY = H - 280, tH = 44
  const c1 = safeLeft, c2 = safeLeft + safeW * 0.30, c3 = safeLeft + safeW * 0.55, cE = safeRight
  drawRect(page, c1, tY + 22, safeW, 22, C.tableHeaderBg)
  page.drawRectangle({ x: c1, y: tY, width: safeW, height: tH, borderColor: C.black, borderWidth: 0.8 })
  drawLine(page, c1, tY + 22, cE, tY + 22, 0.8, C.black)
  drawLine(page, c2, tY, c2, tY + tH, 0.8, C.black)
  drawLine(page, c3, tY, c3, tY + tH, 0.8, C.black)

  // Header row
  drawText(page, 'Enrollment No.', { x: (c1 + c2) / 2, y: tY + 29, size: 9, font: fonts.bodyBold, align: 'center' })
  drawText(page, 'Center Code', { x: (c2 + c3) / 2, y: tY + 29, size: 9, font: fonts.bodyBold, align: 'center' })
  drawText(page, 'Authorised Training Center Name', { x: (c3 + cE) / 2, y: tY + 29, size: 8.5, font: fonts.bodyBold, align: 'center' })

  // Data row
  drawText(page, data.enrollmentNumber, { x: (c1 + c2) / 2, y: tY + 8, size: 9, font: fonts.bodyBold, align: 'center' })
  drawText(page, data.trainingCenterCode, { x: (c2 + c3) / 2, y: tY + 8, size: 9, font: fonts.bodyBold, align: 'center' })
  drawText(page, data.trainingCenterName, { x: (c3 + cE) / 2, y: tY + 8, size: 8.5, font: fonts.bodyBold, align: 'center' })

  // 7. Student row
  const sRowY = H - 340

  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: safeLeft + 5, y: sRowY - 40, width: 45, height: 45 })
  }

  drawText(page, 'This certificate is Proudly Presented to', {
    x: cx, y: sRowY - 5, size: 11, font: fonts.body, align: 'center',
  })
  drawText(page, `${data.salutation ?? ''} ${data.studentName}`.trim(), {
    x: cx, y: sRowY - 25, size: 17, font: fonts.bodyBold, color: C.red, align: 'center',
  })
  drawText(page, `${data.fatherPrefix} ${data.fatherName}`, {
    x: cx, y: sRowY - 42, size: 10, font: fonts.bodyBold, align: 'center',
  })

  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const px = safeRight - 60, py = sRowY - 55
      drawRect(page, px - 1, py - 1, 62, 72, C.black)
      page.drawImage(photo, { x: px, y: py, width: 60, height: 70 })
    }
  }

  // 8. Body paragraph
  let bY = H - 420
  const bStep = 18
  drawText(page, 'has passed in the following subject of the', { x: cx, y: bY, size: 10, font: fonts.body, align: 'center' })
  bY -= bStep
  drawText(page, 'Computer Based Typing Examination', { x: cx, y: bY, size: 15, font: fonts.script, color: C.navy, align: 'center' })
  bY -= bStep
  drawText(page, 'Designed and developed as per the standard of', { x: cx, y: bY, size: 10, font: fonts.body, align: 'center' })
  bY -= bStep
  drawText(page, 'UnSkills FuturePath Tech Pvt. Ltd.', { x: cx, y: bY, size: 13, font: fonts.script, color: C.navy, align: 'center' })
  bY -= 16
  drawText(page, `held at ${data.trainingCenterName}`, { x: cx, y: bY, size: 10, font: fonts.body, align: 'center' })

  // 9. Typing marks table
  const subjects = data.typingSubjects ?? []
  const numRows = subjects.length + 1
  const rowH = 20
  const ttY = H - 540
  const ttH = rowH * numRows
  const colFrac = [0.32, 0.18, 0.18, 0.16, 0.16]
  const colX: number[] = [safeLeft]
  for (const f of colFrac) colX.push(colX[colX.length - 1] + f * safeW)

  drawRect(page, safeLeft, ttY + (numRows - 1) * rowH, safeW, rowH, C.tableHeaderBg)
  page.drawRectangle({ x: safeLeft, y: ttY, width: safeW, height: ttH, borderColor: C.black, borderWidth: 0.6 })
  for (let i = 1; i < colX.length - 1; i++) drawLine(page, colX[i], ttY, colX[i], ttY + ttH, 0.6, C.black)
  for (let i = 1; i < numRows; i++) drawLine(page, safeLeft, ttY + i * rowH, safeRight, ttY + i * rowH, 0.6, C.black)

  const headers = ['Name of the Subject', 'Speed W.P.M.', 'Maximum Marks', 'Minimum Marks', 'Marks Obtained']
  const hY = ttY + (numRows - 1) * rowH + 7
  for (let i = 0; i < headers.length; i++) {
    drawText(page, headers[i], { x: (colX[i] + colX[i + 1]) / 2, y: hY, size: 8.5, font: fonts.bodyBold, align: 'center' })
  }
  for (let r = 0; r < subjects.length; r++) {
    const sub = subjects[r]
    const rowY = ttY + (numRows - 2 - r) * rowH + 7
    const vals = [sub.name, String(sub.speed), String(sub.max), String(sub.min), String(sub.obtained)]
    for (let i = 0; i < vals.length; i++) {
      drawText(page, vals[i], { x: (colX[i] + colX[i + 1]) / 2, y: rowY, size: 8.5, font: fonts.bodyBold, align: 'center' })
    }
  }

  // 10. Grade legend
  let gY = ttY - 18
  drawText(page, 'Grade System', { x: safeLeft, y: gY, size: 8.5, font: fonts.bodyBold })
  for (const g of ['A+ : 85% & Above', 'A : 75% to 84%', 'B : 60% to 74%', 'C : 40% to 69%']) {
    gY -= 10
    drawText(page, g, { x: safeLeft, y: gY, size: 8, font: fonts.body })
  }

  // 11. QR + grade pills (bottom-left)
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, safeLeft - 1, 205, 52, 52, C.white, C.black, 0.4)
    page.drawImage(qr, { x: safeLeft, y: 206, width: 50, height: 50 })
  }

  // Grade pill
  drawRect(page, safeLeft, 185, 44, 14, C.red)
  drawText(page, 'Grade', { x: safeLeft + 22, y: 189, size: 8, font: fonts.bodyBold, color: C.white, align: 'center' })
  drawRect(page, safeLeft + 44, 185, 40, 14, C.black)
  drawText(page, data.grade, { x: safeLeft + 64, y: 189, size: 8, font: fonts.bodyBold, color: C.white, align: 'center' })

  // Date pill
  drawRect(page, safeLeft, 165, 74, 14, C.red)
  drawText(page, 'Date of Issue', { x: safeLeft + 37, y: 169, size: 8, font: fonts.bodyBold, color: C.white, align: 'center' })
  drawRect(page, safeLeft + 74, 165, 60, 14, C.black)
  drawText(page, data.issueDate, { x: safeLeft + 104, y: 169, size: 8, font: fonts.bodyBold, color: C.white, align: 'center' })

  // 12. Signature (right)
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: safeRight - 100, y: 220, width: 90, height: 26 })
  }
  drawLine(page, safeRight - 130, 215, safeRight, 215, 0.7, C.black)
  if (settings.signatory_name) {
    drawText(page, settings.signatory_name, { x: safeRight, y: 200, size: 9.5, font: fonts.bodyBold, align: 'right' })
  }
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, { x: safeRight, y: 188, size: 8.5, font: fonts.body, align: 'right' })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, { x: safeRight, y: 176, size: 8.5, font: fonts.body, align: 'right' })
  }

  // 13. Badge strip
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const stH = 16, stSp = safeW / badges.length
  for (let i = 0; i < badges.length; i++) {
    const img = badges[i]
    if (!img) continue
    const ar = img.width / img.height
    const w = stH * ar
    const bx = safeLeft + i * stSp + stSp / 2 - w / 2
    page.drawImage(img, { x: bx, y: 140, width: w, height: stH })
  }

  // 14. Footer
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 118, size: 7.5, font: fonts.body, align: 'center',
    })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateLandscapeCertificate(data: LandscapeCertData): Promise<Uint8Array> {
  const pdfDoc = await loadOrBlankLandscape()
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawLandscapeContent(pdfDoc, page, fonts, data, W, H)
  return pdfDoc.save()
}

export async function generatePortraitCertificate(data: PortraitCertData): Promise<Uint8Array> {
  const pdfDoc = await loadOrBlankPortrait()
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawPortraitContent(pdfDoc, page, fonts, data, W, H)
  return pdfDoc.save()
}

/** Convenience: returns a Blob for URL.createObjectURL() */
function toBlob(bytes: Uint8Array): Blob {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}

export async function generateLandscapeBlob(data: LandscapeCertData): Promise<Blob> {
  return toBlob(await generateLandscapeCertificate(data))
}

export async function generatePortraitBlob(data: PortraitCertData): Promise<Blob> {
  return toBlob(await generatePortraitCertificate(data))
}
