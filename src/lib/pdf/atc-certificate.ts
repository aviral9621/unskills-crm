/**
 * Authorised Training Center (ATC) Certificate generator.
 *
 * PORTRAIT A4 (595.28 × 841.89 pt). The decorative border + greek-key
 * ornamentation is supplied by the fixed template asset at
 *   /public/Branch Certificate.pdf
 * which we embed as the page background — all dynamic text/logos/QR are
 * overlaid inside that template's inner safe zone.
 *
 * The template has:
 *   • Thick navy outer border (~35pt from page edge)
 *   • Gold inner rectangular frame (~55pt in)
 *   • Greek-key ornament at top-center and bottom-center
 *   • Small navy corner squares and gold corner brackets
 * Inner safe zone for content: x ∈ [75, W-75], y ∈ [60, H-70].
 */
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { generateQRDataUrl } from './generate-qr'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AtcCertificateData {
  atcCode: string
  branchName: string
  branchAddress: string
  branchLogoUrl?: string | null
  ownerName: string
  courseType: string
  issueDate: string        // DD-MM-YYYY
  renewalDate: string      // DD-MM-YYYY
  verificationUrlBase: string
  regNumber?: string
  contactPhone?: string
  contactEmail?: string
  headOfficeAddress?: string
  website?: string
  signatoryName?: string
  signatureImageUrl?: string | null
  unskillsLogoUrl?: string
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const C = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  navy: rgb(0.043, 0.141, 0.278),
  red: rgb(0.784, 0.063, 0.180),
  gold: rgb(0.722, 0.525, 0.043),
  textDark: rgb(0.04, 0.04, 0.04),
  textSecondary: rgb(0.29, 0.29, 0.29),
  stampRed: rgb(0.74, 0.11, 0.16),
  wax: rgb(0.60, 0.14, 0.14),
  waxHighlight: rgb(0.88, 0.62, 0.24),
}

interface FontSet {
  body: PDFFont
  bodyBold: PDFFont
  serifItalic: PDFFont
  display: PDFFont
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

async function loadFonts(doc: PDFDocument): Promise<FontSet> {
  doc.registerFontkit(fontkit)
  const body = await doc.embedFont(StandardFonts.Helvetica)
  const bodyBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)

  const displayBytes = await fetchBytes('/fonts/ArchivoBlack-Regular.ttf')
  const displayOpts = { features: { liga: false, dlig: false, clig: false } } as const
  const display = displayBytes
    ? await doc.embedFont(displayBytes, displayOpts).catch(() => bodyBold)
    : bodyBold

  return { body, bodyBold, serifItalic, display }
}

async function embedAny(doc: PDFDocument, src: string): Promise<PDFImage | null> {
  if (!src) return null
  try {
    if (src.startsWith('data:')) {
      if (src.includes('image/png')) return await doc.embedPng(src)
      if (src.includes('image/jp')) return await doc.embedJpg(src)
      try { return await doc.embedPng(src) } catch { return await doc.embedJpg(src) }
    }
    const bytes = await fetchBytes(encodeURI(src))
    if (!bytes) return null
    if (/\.png$/i.test(src)) return await doc.embedPng(bytes)
    if (/\.jpe?g$/i.test(src)) return await doc.embedJpg(bytes)
    try { return await doc.embedPng(bytes) } catch { return await doc.embedJpg(bytes) }
  } catch {
    return null
  }
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number; y: number; size: number; font: PDFFont
    color?: ReturnType<typeof rgb>
    align?: 'left' | 'center' | 'right'
    letterSpacing?: number
  },
) {
  if (!text) return
  const { x, y, size, font, color = C.textDark, align = 'left', letterSpacing = 0 } = opts
  if (letterSpacing > 0) {
    const chars = text.split('')
    const totalW = chars.reduce((s, ch) => s + font.widthOfTextAtSize(ch, size) + letterSpacing, 0) - letterSpacing
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

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>, borderWidth?: number) {
  page.drawRectangle({ x, y, width: w, height: h, color, borderColor: border, borderWidth })
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, t: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color })
}

/** Two-colour "UNSKILLS COMPUTER" masthead (red + black) + TM. */
function drawMasthead(page: PDFPage, fonts: FontSet, cx: number, y: number, size: number) {
  const redWord = 'UNSKILLS'
  const blackWord = ' COMPUTER'
  const tmSize = size * 0.35
  const wRed = fonts.display.widthOfTextAtSize(redWord, size)
  const wBlack = fonts.display.widthOfTextAtSize(blackWord, size)
  const wTm = fonts.display.widthOfTextAtSize('TM', tmSize)
  const total = wRed + wBlack + wTm
  let x = cx - total / 2
  page.drawText(redWord, { x, y, size, font: fonts.display, color: C.red })
  x += wRed
  page.drawText(blackWord, { x, y, size, font: fonts.display, color: C.black })
  x += wBlack
  page.drawText('TM', { x, y: y + size * 0.55, size: tmSize, font: fonts.display, color: C.black })
}

/** Red circular CERTIFIED stamp. */
function drawCertifiedStamp(page: PDFPage, fonts: FontSet, cx: number, cy: number, r: number) {
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: C.stampRed, borderWidth: 2 })
  page.drawCircle({ x: cx, y: cy, size: r - 6, borderColor: C.stampRed, borderWidth: 0.8 })
  drawText(page, 'CERTIFIED', {
    x: cx, y: cy + 3, size: 8.5, font: fonts.bodyBold, color: C.stampRed, align: 'center', letterSpacing: 1,
  })
  drawText(page, 'AUTHENTIC', {
    x: cx, y: cy - 10, size: 5.5, font: fonts.bodyBold, color: C.stampRed, align: 'center', letterSpacing: 0.5,
  })
  drawLine(page, cx - 10, cy - 2, cx - 3, cy - 7, 1.2, C.stampRed)
  drawLine(page, cx - 3, cy - 7, cx + 9, cy + 5, 1.2, C.stampRed)
}

/** Wax-seal emblem for the bottom-right corner. */
function drawWaxSeal(page: PDFPage, fonts: FontSet, cx: number, cy: number, r: number) {
  page.drawCircle({ x: cx, y: cy, size: r + 4, color: C.wax })
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6
    const tipX = cx + Math.cos(ang) * (r + 7)
    const tipY = cy + Math.sin(ang) * (r + 7)
    page.drawCircle({ x: tipX, y: tipY, size: 3.5, color: C.wax })
  }
  page.drawCircle({ x: cx, y: cy, size: r, color: C.waxHighlight })
  page.drawCircle({ x: cx, y: cy, size: r - 4, borderColor: C.wax, borderWidth: 0.8 })
  drawText(page, 'UNSKILLS', {
    x: cx, y: cy + 2, size: 7, font: fonts.bodyBold, color: C.wax, align: 'center', letterSpacing: 0.6,
  })
  drawText(page, 'ATC', {
    x: cx, y: cy - 9, size: 9, font: fonts.bodyBold, color: C.wax, align: 'center', letterSpacing: 1.5,
  })
}

/** Footer badges row (small logos centred in a given width). */
async function drawFooterBadges(doc: PDFDocument, page: PDFPage, y: number, totalWidth: number) {
  const paths = [
    '/ISO LOGOs.png',
    '/MSME loogo.png',
    '/Skill India Logo.png',
    '/NSDC logo.png',
    '/Digital India logo.png',
    '/IAF LOGO.png',
  ]
  const images = await Promise.all(paths.map(p => embedAny(doc, p)))
  const W = page.getWidth()
  const count = images.filter(Boolean).length
  if (count === 0) return

  const rowH = 18
  const slotW = totalWidth / count
  let slot = 0
  for (const img of images) {
    if (!img) continue
    const ar = img.width / img.height
    const maxW = slotW - 6
    const h = rowH
    let w = h * ar
    let actualH = h
    if (w > maxW) {
      w = maxW
      actualH = w / ar
    }
    const x = (W - totalWidth) / 2 + slot * slotW + (slotW - w) / 2
    page.drawImage(img, { x, y: y + (rowH - actualH) / 2, width: w, height: actualH })
    slot++
  }
}

/** Wrap centered text, returns baseline of last line. */
function drawCenteredWrapped(
  page: PDFPage,
  text: string,
  opts: {
    cx: number; y: number; maxWidth: number; size: number; font: PDFFont
    color?: ReturnType<typeof rgb>; lineStep?: number
  },
): number {
  const { cx, y, maxWidth, size, font, color = C.textDark, lineStep } = opts
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const tryLine = current ? current + ' ' + w : w
    if (font.widthOfTextAtSize(tryLine, size) > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = tryLine
    }
  }
  if (current) lines.push(current)
  const step = lineStep ?? size + 3
  let yy = y
  for (const line of lines) {
    drawText(page, line, { x: cx, y: yy, size, font, color, align: 'center' })
    yy -= step
  }
  return yy + step
}

// ─── Portrait template loader ────────────────────────────────────────────────

const A4_PORTRAIT: [number, number] = [595.28, 841.89]
const TEMPLATE_PATH = '/Branch Certificate.pdf'

async function makeDocWithTemplate(): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(A4_PORTRAIT)
  const [W, H] = A4_PORTRAIT

  const bytes = await fetchBytes(TEMPLATE_PATH)
  if (bytes) {
    try {
      const [embedded] = await doc.embedPdf(bytes, [0])
      if (embedded) {
        const s = embedded.size()
        const scale = Math.max(W / s.width, H / s.height)
        page.drawPage(embedded, {
          x: (W - s.width * scale) / 2,
          y: (H - s.height * scale) / 2,
          width: s.width * scale,
          height: s.height * scale,
        })
      }
    } catch {
      // If the template fails to embed for any reason, we still return a blank
      // A4 portrait page so the rest of the generator keeps working.
    }
  }
  return doc
}

// ─── Main generator ──────────────────────────────────────────────────────────

export async function generateAtcCertificate(data: AtcCertificateData): Promise<Uint8Array> {
  const doc = await makeDocWithTemplate()
  const page = doc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  const cx = W / 2
  const LEFT = 75
  const RIGHT = W - 75
  const fonts = await loadFonts(doc)

  // ── 1. TOP META (just below the top greek-key ornament) ──────────────────
  drawText(page, 'Reg. by Govt. of India', {
    x: LEFT + 10, y: H - 80, size: 8.5, font: fonts.bodyBold, color: C.textDark,
  })
  drawText(page, `Reg. No.: ${data.regNumber || '220102'}`, {
    x: RIGHT - 10, y: H - 80, size: 8.5, font: fonts.bodyBold, align: 'right', color: C.textDark,
  })

  // ── 2. TOP-LEFT UNSKILLS LOGO (fixed branding) ───────────────────────────
  if (data.unskillsLogoUrl) {
    const logo = await embedAny(doc, data.unskillsLogoUrl)
    if (logo) {
      const ar = logo.width / logo.height
      const h = 46
      const w = Math.min(h * ar, 70)
      page.drawImage(logo, { x: LEFT + 5, y: H - 138, width: w, height: h })
    }
  }

  // ── 3. BRAND MASTHEAD + AFFILIATION LINES ────────────────────────────────
  drawMasthead(page, fonts, cx, H - 112, 20)
  drawText(page, 'A Unit of: UnSkills FuturePath Tech Pvt. Ltd.  |  Regd. by Govt. of India Reg. No. 220102', {
    x: cx, y: H - 135, size: 7.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'Alliance with Skills India, MSME, NITI Aayog, NSDC, Labour Department', {
    x: cx, y: H - 147, size: 7.5, font: fonts.body, color: C.textDark, align: 'center',
  })

  // ── 4. ISO STRIP (black/navy ribbon) ─────────────────────────────────────
  const isoText = 'AN ISO 9001:2015 CERTIFIED ORGANIZATION'
  const isoSize = 9
  const isoTextW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize)
  const isoStripW = isoTextW + 28
  drawRect(page, cx - isoStripW / 2, H - 170, isoStripW, 15, C.black)
  drawText(page, isoText, {
    x: cx, y: H - 166, size: isoSize, font: fonts.bodyBold, color: C.white, align: 'center', letterSpacing: 0.3,
  })

  // ── 5. CERTIFICATE TITLE ─────────────────────────────────────────────────
  drawText(page, 'Certificate', {
    x: cx, y: H - 210, size: 36, font: fonts.serifItalic, color: C.navy, align: 'center',
  })
  // Gold divider with red diamond accent
  drawLine(page, cx - 90, H - 222, cx - 12, H - 222, 0.8, C.gold)
  drawLine(page, cx + 12, H - 222, cx + 90, H - 222, 0.8, C.gold)
  page.drawRectangle({
    x: cx - 3, y: H - 225, width: 6, height: 6, color: C.red, rotate: degrees(45),
  })

  // ── 6. SIDE LOGOS (flanking the body) ────────────────────────────────────
  // Branch logo on the LEFT, UnSkills logo on the RIGHT.
  const sideLogoSize = 60
  const sideLogoY = H - 375
  if (data.branchLogoUrl) {
    const blogo = await embedAny(doc, data.branchLogoUrl)
    if (blogo) {
      const ar = blogo.width / blogo.height
      const w = Math.min(sideLogoSize * ar, sideLogoSize + 8)
      const h = w / ar
      page.drawImage(blogo, {
        x: LEFT + (sideLogoSize - w) / 2 + 5,
        y: sideLogoY + (sideLogoSize - h) / 2,
        width: w, height: h,
      })
    }
  }
  if (data.unskillsLogoUrl) {
    const uLogo = await embedAny(doc, data.unskillsLogoUrl)
    if (uLogo) {
      const ar = uLogo.width / uLogo.height
      const w = Math.min(sideLogoSize * ar, sideLogoSize + 8)
      const h = w / ar
      page.drawImage(uLogo, {
        x: RIGHT - sideLogoSize - 5 + (sideLogoSize - w) / 2,
        y: sideLogoY + (sideLogoSize - h) / 2,
        width: w, height: h,
      })
    }
  }

  // ── 7. MAIN BODY CONTENT ─────────────────────────────────────────────────
  const bodyCx = cx
  const bodyMaxW = W - 260    // leave room for side logos
  drawText(page, 'AUTHORISED TRAINING CENTER (ATC)', {
    x: bodyCx, y: H - 260, size: 12.5, font: fonts.bodyBold, color: C.red, align: 'center', letterSpacing: 0.9,
  })
  drawText(page, 'In acceptance to the terms and conditions, certified that', {
    x: bodyCx, y: H - 280, size: 9.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  // Branch name (wrapped if long)
  const nameEndY = drawCenteredWrapped(page, data.branchName.toUpperCase(), {
    cx: bodyCx, y: H - 310, maxWidth: bodyMaxW,
    size: 16, font: fonts.bodyBold, color: C.red, lineStep: 19,
  })
  // Address (wrapped)
  const addrEndY = drawCenteredWrapped(page, data.branchAddress, {
    cx: bodyCx, y: nameEndY - 16, maxWidth: bodyMaxW,
    size: 9.5, font: fonts.body, color: C.textDark, lineStep: 11.5,
  })

  // Applicant Name + ATC Code (two-line block, centered)
  const infoY = Math.min(addrEndY - 22, H - 410)
  drawText(page, `Applicant Name : ${data.ownerName || 'Branch Director'}`, {
    x: bodyCx, y: infoY, size: 10.5, font: fonts.bodyBold, color: C.navy, align: 'center',
  })
  drawText(page, `ATC Code : ${data.atcCode}`, {
    x: bodyCx, y: infoY - 16, size: 10.5, font: fonts.bodyBold, color: C.navy, align: 'center',
  })

  // Ampersand
  drawText(page, '&', {
    x: bodyCx, y: infoY - 42, size: 20, font: fonts.serifItalic, color: C.gold, align: 'center',
  })

  // Course type
  drawText(page, `to conduct ${data.courseType} courses,`, {
    x: bodyCx, y: infoY - 68, size: 10.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'designed and developed by UnSkills FuturePath Tech Pvt. Ltd.', {
    x: bodyCx, y: infoY - 82, size: 10.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // ── 8. QR CODE (centered, below body) ────────────────────────────────────
  const qrDataUrl = await generateQRDataUrl(
    `${(data.verificationUrlBase || '').replace(/\/+$/, '')}/verify/atc/${encodeURIComponent(data.atcCode)}`,
  )
  const qr = await embedAny(doc, qrDataUrl)
  const qrSize = 78
  const qrY = 265
  if (qr) {
    drawRect(page, cx - qrSize / 2 - 2, qrY - 2, qrSize + 4, qrSize + 4, C.white, C.navy, 0.6)
    page.drawImage(qr, { x: cx - qrSize / 2, y: qrY, width: qrSize, height: qrSize })
  }
  drawText(page, 'Scan to verify', {
    x: cx, y: qrY - 12, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
  })

  // ── 9. STAMP (bottom-left) + SEAL (bottom-right) ─────────────────────────
  drawCertifiedStamp(page, fonts, LEFT + 55, 235, 30)
  drawWaxSeal(page, fonts, RIGHT - 55, 235, 28)

  // ── 10. DATES (left) + SIGNATURE (right) ─────────────────────────────────
  drawText(page, `Date of Issue      :  ${data.issueDate}`, {
    x: LEFT + 5, y: 175, size: 9, font: fonts.bodyBold, color: C.textDark,
  })
  drawText(page, `Date of Renewal :  ${data.renewalDate}`, {
    x: LEFT + 5, y: 161, size: 9, font: fonts.bodyBold, color: C.textDark,
  })

  // Signature block (right)
  const sigRight = RIGHT - 5
  const sigLeft = sigRight - 140
  if (data.signatureImageUrl) {
    const sig = await embedAny(doc, data.signatureImageUrl)
    if (sig) {
      page.drawImage(sig, { x: sigRight - 100, y: 175, width: 100, height: 28 })
    }
  } else if (data.signatoryName) {
    drawText(page, data.signatoryName, {
      x: sigRight, y: 180, size: 16, font: fonts.serifItalic, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, 170, sigRight, 170, 0.8, C.black)
  drawText(page, 'Signature Authorised', {
    x: sigRight, y: 158, size: 9.5, font: fonts.bodyBold, color: C.navy, align: 'right',
  })

  // ── 11. FOOTER (contact + head office + badges) ──────────────────────────
  const contactPhone = data.contactPhone || '8382898686 / 9838382898'
  const website = data.website || 'www.unskillseducation.org'
  const headOffice = data.headOfficeAddress || '2nd Floor Ranipur Road Mariahu Jaunpur Uttar Pradesh, India - 222161'

  drawText(page, `Contact : ${contactPhone}   |   Website : ${website}`, {
    x: cx, y: 128, size: 8.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  drawCenteredWrapped(page, `Head Office : ${headOffice}`, {
    cx, y: 114, maxWidth: W - 170,
    size: 7.5, font: fonts.body, color: C.textSecondary, lineStep: 10,
  })

  // Small footer badges row (above the bottom greek-key ornament)
  await drawFooterBadges(doc, page, 68, W - 200)

  return doc.save()
}

export async function generateAtcCertificateBlob(data: AtcCertificateData): Promise<Blob> {
  const bytes = await generateAtcCertificate(data)
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}
