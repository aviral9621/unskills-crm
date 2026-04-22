/**
 * Authorised Training Center (ATC) Certificate generator.
 *
 * Unlike the student certificates (which overlay content on a prepainted
 * JPG template), the ATC certificate is drawn fully programmatically — a
 * decorative navy/gold border, the UnSkills masthead, the "Certificate"
 * title, a body block, the QR block, the signature block, and the badge
 * footer are all rendered with pdf-lib primitives. This keeps the layout
 * deterministic and removes any dependency on an external template file.
 *
 * Page: A4 landscape (841.89 × 595.28 pt).
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
  verificationUrlBase: string  // e.g. https://www.unskillseducation.org
  regNumber?: string       // fallback: 220102
  contactPhone?: string
  contactEmail?: string
  headOfficeAddress?: string
  website?: string
  signatoryName?: string
  signatureImageUrl?: string | null
  unskillsLogoUrl?: string // path under /public, e.g. /MAIN LOGO FOR ALL CARDS.png
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
  serifBold: PDFFont
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
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)

  // Montserrat-ExtraBold replacement via ArchivoBlack (already bundled for the
  // other certs). Falls back to HelveticaBold if the font fetch fails.
  const displayBytes = await fetchBytes('/fonts/ArchivoBlack-Regular.ttf')
  const displayOpts = { features: { liga: false, dlig: false, clig: false } } as const
  const display = displayBytes
    ? await doc.embedFont(displayBytes, displayOpts).catch(() => bodyBold)
    : bodyBold

  return { body, bodyBold, serifItalic, serifBold, display }
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

function strokeRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, borderWidth: number) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth })
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, t: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color })
}

/** Two-colour "UNSKILLS COMPUTER" masthead (red + black). */
function drawMasthead(
  page: PDFPage,
  fonts: FontSet,
  cx: number,
  y: number,
  size: number,
) {
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

/** Red circular CERTIFIED stamp (drawn with pdf-lib — no external image). */
function drawCertifiedStamp(page: PDFPage, fonts: FontSet, cx: number, cy: number, r: number) {
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: C.stampRed, borderWidth: 2 })
  page.drawCircle({ x: cx, y: cy, size: r - 6, borderColor: C.stampRed, borderWidth: 0.8 })
  drawText(page, 'CERTIFIED', {
    x: cx, y: cy + 3, size: 9, font: fonts.bodyBold, color: C.stampRed, align: 'center', letterSpacing: 1,
  })
  drawText(page, 'AUTHENTIC', {
    x: cx, y: cy - 10, size: 5.5, font: fonts.bodyBold, color: C.stampRed, align: 'center', letterSpacing: 0.5,
  })
  // Subtle inner tick
  drawLine(page, cx - 10, cy - 2, cx - 3, cy - 7, 1.2, C.stampRed)
  drawLine(page, cx - 3, cy - 7, cx + 9, cy + 5, 1.2, C.stampRed)
}

/** Wax-seal-style emblem for the bottom-right corner. */
function drawWaxSeal(page: PDFPage, fonts: FontSet, cx: number, cy: number, r: number) {
  // Outer scalloped wax (approximated with two concentric circles + radial ticks)
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
    x: cx, y: cy + 2, size: 7.5, font: fonts.bodyBold, color: C.wax, align: 'center', letterSpacing: 0.8,
  })
  drawText(page, 'ATC', {
    x: cx, y: cy - 9, size: 9, font: fonts.bodyBold, color: C.wax, align: 'center', letterSpacing: 1.5,
  })
}

/** Footer logos row (ISO, MSME, Skill India, NSDC, Digital India, IAF). */
async function drawFooterBadges(
  doc: PDFDocument,
  page: PDFPage,
  y: number,
  width: number,
) {
  const paths = [
    '/ISO LOGOs.png',
    '/MSME loogo.png',
    '/Skill India Logo.png',
    '/NSDC logo.png',
    '/Digital India logo.png',
    '/IAF LOGO.png',
  ]
  const images = await Promise.all(paths.map(p => embedAny(doc, p)))
  const count = images.filter(Boolean).length
  if (count === 0) return

  const rowH = 20
  const slotW = width / count
  let slot = 0
  for (const img of images) {
    if (!img) continue
    const ar = img.width / img.height
    const h = rowH
    const w = Math.min(h * ar, slotW - 8)
    const actualH = w / ar
    const x = (page.getWidth() - width) / 2 + slot * slotW + (slotW - w) / 2
    page.drawImage(img, { x, y: y + (rowH - actualH) / 2, width: w, height: actualH })
    slot++
  }
}

/** Centered text that wraps if longer than maxWidth. Returns the y of the last baseline. */
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

// ─── Main generator ──────────────────────────────────────────────────────────

const A4_LANDSCAPE: [number, number] = [841.89, 595.28]

export async function generateAtcCertificate(
  data: AtcCertificateData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(A4_LANDSCAPE)
  const [W, H] = A4_LANDSCAPE
  const cx = W / 2
  const fonts = await loadFonts(doc)

  // ── Background + decorative borders ───────────────────────────────────────
  drawRect(page, 0, 0, W, H, C.white)
  // Outer navy frame
  strokeRect(page, 22, 22, W - 44, H - 44, C.navy, 6)
  // Thin inner gold frame
  strokeRect(page, 38, 38, W - 76, H - 76, C.gold, 1.2)
  // Corner gold ticks for visual refinement
  const tickLen = 14
  for (const [cornerX, cornerY, dx, dy] of [
    [38, H - 38, 1, -1], [W - 38, H - 38, -1, -1],
    [38, 38, 1, 1], [W - 38, 38, -1, 1],
  ] as const) {
    drawLine(page, cornerX + dx * 3, cornerY, cornerX + dx * tickLen, cornerY, 1.5, C.gold)
    drawLine(page, cornerX, cornerY + dy * 3, cornerX, cornerY + dy * tickLen, 1.5, C.gold)
  }

  // ── TOP HEADER ────────────────────────────────────────────────────────────
  // Top-left fixed UnSkills logo
  if (data.unskillsLogoUrl) {
    const logo = await embedAny(doc, data.unskillsLogoUrl)
    if (logo) {
      const ar = logo.width / logo.height
      const lh = 52
      const lw = Math.min(lh * ar, 80)
      page.drawImage(logo, { x: 58, y: H - 110, width: lw, height: lh })
    }
  }

  // Top-left / top-right reg lines
  drawText(page, 'Reg. by Govt. of India', {
    x: 150, y: H - 70, size: 9, font: fonts.bodyBold, color: C.textDark,
  })
  drawText(page, `Reg. No.: ${data.regNumber || '220102'}`, {
    x: W - 60, y: H - 70, size: 9, font: fonts.bodyBold, align: 'right', color: C.textDark,
  })

  // Masthead
  drawMasthead(page, fonts, cx, H - 100, 26)

  // Unit / alliance / ISO lines
  drawText(page, 'A Unit of: UnSkills FuturePath Tech Pvt. Ltd.  |  Regd. by Govt. of India Reg. No. 220102', {
    x: cx, y: H - 125, size: 8.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'Alliance with Skills India, MSME, NITI Aayog, NSDC, Labour Department', {
    x: cx, y: H - 138, size: 8.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  // Black ISO strip
  const isoText = 'AN ISO 9001:2015 CERTIFIED ORGANIZATION'
  const isoSize = 10
  const isoTextW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize)
  const isoStripW = isoTextW + 30
  drawRect(page, cx - isoStripW / 2, H - 162, isoStripW, 16, C.black)
  drawText(page, isoText, {
    x: cx, y: H - 158, size: isoSize, font: fonts.bodyBold, color: C.white, align: 'center', letterSpacing: 0.4,
  })

  // ── CERTIFICATE TITLE ─────────────────────────────────────────────────────
  drawText(page, 'Certificate', {
    x: cx, y: H - 205, size: 40, font: fonts.serifItalic, color: C.navy, align: 'center',
  })
  drawLine(page, cx - 110, H - 215, cx - 15, H - 215, 0.8, C.gold)
  drawLine(page, cx + 15, H - 215, cx + 110, H - 215, 0.8, C.gold)
  page.drawRectangle({ x: cx - 3, y: H - 218, width: 6, height: 6, color: C.red, rotate: degrees(45) })

  // ── MIDDLE CONTENT — left/right logos flank the body ──────────────────────
  // Left body: branch logo (dynamic)
  if (data.branchLogoUrl) {
    const blogo = await embedAny(doc, data.branchLogoUrl)
    if (blogo) {
      const ar = blogo.width / blogo.height
      const size = 70
      page.drawImage(blogo, {
        x: 75, y: H - 340,
        width: size, height: size / ar,
      })
    }
  }
  // Right body: UnSkills logo (fixed branding)
  if (data.unskillsLogoUrl) {
    const uLogo = await embedAny(doc, data.unskillsLogoUrl)
    if (uLogo) {
      const ar = uLogo.width / uLogo.height
      const size = 70
      page.drawImage(uLogo, {
        x: W - 75 - size, y: H - 340,
        width: size, height: size / ar,
      })
    }
  }

  // Body text (between the logos, centred)
  drawText(page, 'AUTHORISED TRAINING CENTER (ATC)', {
    x: cx, y: H - 240, size: 14, font: fonts.bodyBold, color: C.red, align: 'center', letterSpacing: 1,
  })
  drawText(page, 'In acceptance to the terms and conditions, certified that', {
    x: cx, y: H - 260, size: 10.5, font: fonts.body, color: C.textDark, align: 'center',
  })

  // Branch name — big bold red, wrapped if long
  const nameEndY = drawCenteredWrapped(page, data.branchName.toUpperCase(), {
    cx, y: H - 288, maxWidth: W - 320,
    size: 20, font: fonts.bodyBold, color: C.red, lineStep: 23,
  })

  // Address (wrapped)
  drawCenteredWrapped(page, data.branchAddress, {
    cx, y: nameEndY - 18, maxWidth: W - 340,
    size: 10, font: fonts.body, color: C.textDark, lineStep: 12,
  })

  // Applicant Name + ATC Code (single line, two fields)
  const infoY = H - 348
  drawText(page, `Applicant Name : ${data.ownerName || 'Branch Director'}`, {
    x: cx - 12, y: infoY, size: 11, font: fonts.bodyBold, color: C.navy, align: 'right',
  })
  drawText(page, '|', {
    x: cx, y: infoY, size: 12, font: fonts.bodyBold, color: C.gold, align: 'center',
  })
  drawText(page, `ATC Code : ${data.atcCode}`, {
    x: cx + 12, y: infoY, size: 11, font: fonts.bodyBold, color: C.navy,
  })

  // Ampersand
  drawText(page, '&', {
    x: cx, y: H - 378, size: 22, font: fonts.serifItalic, color: C.gold, align: 'center',
  })

  // Course type line
  drawText(page, `to conduct ${data.courseType} courses,`, {
    x: cx, y: H - 404, size: 11, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'designed and developed by UnSkills FuturePath Tech Pvt. Ltd.', {
    x: cx, y: H - 418, size: 11, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // ── BOTTOM ROW: dates | stamp | QR | seal | signature ─────────────────────

  // Dates (bottom-left)
  drawText(page, `Date of Issue      :  ${data.issueDate}`, {
    x: 72, y: 175, size: 9.5, font: fonts.bodyBold, color: C.textDark,
  })
  drawText(page, `Date of Renewal :  ${data.renewalDate}`, {
    x: 72, y: 160, size: 9.5, font: fonts.bodyBold, color: C.textDark,
  })

  // Certified stamp (left of centre)
  drawCertifiedStamp(page, fonts, 195, 125, 32)

  // QR code (centre-bottom)
  const qrDataUrl = await generateQRDataUrl(
    `${(data.verificationUrlBase || '').replace(/\/+$/, '')}/verify/atc/${encodeURIComponent(data.atcCode)}`,
  )
  const qr = await embedAny(doc, qrDataUrl)
  if (qr) {
    const qrSize = 72
    drawRect(page, cx - qrSize / 2 - 2, 92 - 2, qrSize + 4, qrSize + 4, C.white, C.navy, 0.6)
    page.drawImage(qr, { x: cx - qrSize / 2, y: 92, width: qrSize, height: qrSize })
    drawText(page, 'Scan to verify', {
      x: cx, y: 80, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
    })
  }

  // Wax seal (right of centre)
  drawWaxSeal(page, fonts, W - 195, 125, 28)

  // Signature (bottom-right)
  const sigRight = W - 72
  if (data.signatureImageUrl) {
    const sig = await embedAny(doc, data.signatureImageUrl)
    if (sig) {
      page.drawImage(sig, { x: sigRight - 110, y: 170, width: 110, height: 32 })
    }
  } else if (data.signatoryName) {
    drawText(page, data.signatoryName, {
      x: sigRight, y: 178, size: 18, font: fonts.serifItalic, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigRight - 150, 167, sigRight, 167, 0.8, C.black)
  drawText(page, 'Signature Authorised', {
    x: sigRight, y: 153, size: 10, font: fonts.bodyBold, color: C.navy, align: 'right',
  })

  // ── FOOTER: contact line + logo row ───────────────────────────────────────
  const contactPhone = data.contactPhone || '8382898686 / 9838382898'
  const website = data.website || 'www.unskillseducation.org'
  const headOffice = data.headOfficeAddress || '2nd Floor Ranipur Road Mariahu Jaunpur Uttar Pradesh, India - 222161'

  drawText(page, `Contact : ${contactPhone}   |   Website : ${website}`, {
    x: cx, y: 70, size: 8.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  drawText(page, `Head Office : ${headOffice}`, {
    x: cx, y: 58, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
  })

  // Small footer badges row (kept clear of the decorative bottom border)
  await drawFooterBadges(doc, page, 44, W - 240)

  return doc.save()
}

export async function generateAtcCertificateBlob(
  data: AtcCertificateData,
): Promise<Blob> {
  const bytes = await generateAtcCertificate(data)
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}
