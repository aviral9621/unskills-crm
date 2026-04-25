/**
 * Authorised Training Center (ATC) Certificate generator.
 *
 * PORTRAIT A4 (595.28 × 841.89 pt). Border + ornamentation comes from the
 * template asset at `/public/Branch Certificate.pdf` (embedded as the page
 * background). The round UnSkills logo is also baked into the template, so we
 * don't draw side logos any more — content sits inside the inner safe zone.
 *
 * Fonts (per design guide):
 *   - Montserrat 400 / 500 / 600 / 700  → almost everything
 *   - Playfair Display Italic           → "Certificate" heading + "&"
 *
 * Static TTFs sit in /public/fonts/. If a font fetch fails (network, etc.)
 * the loader falls back to the closest PDF standard font so generation never
 * crashes mid-flight.
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
}

// ─── Font loading ────────────────────────────────────────────────────────────

interface FontSet {
  m400: PDFFont       // Montserrat Regular
  m500: PDFFont       // Montserrat Medium
  m600: PDFFont       // Montserrat SemiBold
  m700: PDFFont       // Montserrat Bold
  pfdItalic: PDFFont  // Playfair Display Italic (variable, default ~400)
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
  // Standard PDF fallbacks — used only if a fetch fails.
  const fbBody    = await doc.embedFont(StandardFonts.Helvetica)
  const fbBold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const fbItalic  = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const opts = { features: { liga: false, dlig: false, clig: false } } as const

  async function tryLoad(path: string, fb: PDFFont): Promise<PDFFont> {
    const bytes = await fetchBytes(path)
    if (!bytes) return fb
    try { return await doc.embedFont(bytes, opts) } catch { return fb }
  }

  const [m400, m500, m600, m700, pfdItalic] = await Promise.all([
    tryLoad('/fonts/Montserrat-Regular.ttf',         fbBody),
    tryLoad('/fonts/Montserrat-Medium.ttf',          fbBody),
    tryLoad('/fonts/Montserrat-SemiBold.ttf',        fbBold),
    tryLoad('/fonts/Montserrat-Bold.ttf',            fbBold),
    tryLoad('/fonts/PlayfairDisplay-Italic-VF.ttf',  fbItalic),
  ])
  return { m400, m500, m600, m700, pfdItalic }
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

/**
 * Draw "Label : Value" in two different fonts/weights, centered as one line.
 * Used for "Applicant Name : ..." and "ATC Code : ..." rows where the label
 * is SemiBold and the value is Medium (per design guide).
 */
function drawLabelValue(
  page: PDFPage,
  label: string,
  value: string,
  opts: {
    cx: number; y: number; size: number
    labelFont: PDFFont; valueFont: PDFFont
    labelColor?: ReturnType<typeof rgb>; valueColor?: ReturnType<typeof rgb>
  },
) {
  const { cx, y, size, labelFont, valueFont } = opts
  const labelColor = opts.labelColor ?? C.textDark
  const valueColor = opts.valueColor ?? C.textDark
  const wLabel = labelFont.widthOfTextAtSize(label, size)
  const wValue = valueFont.widthOfTextAtSize(value, size)
  const total  = wLabel + wValue
  let x = cx - total / 2
  page.drawText(label, { x, y, size, font: labelFont, color: labelColor })
  x += wLabel
  page.drawText(value, { x, y, size, font: valueFont, color: valueColor })
}

/** Two-colour masthead: UN (black) + SKILLS (red) + ' COMPUTER EDUCATION' (black) + TM. */
function drawMasthead(page: PDFPage, font: PDFFont, cx: number, y: number, size: number) {
  const un     = 'UN'
  const skills = 'SKILLS'
  const rest   = ' COMPUTER EDUCATION'
  const tmSize = size * 0.35
  const wUn    = font.widthOfTextAtSize(un, size)
  const wSkills = font.widthOfTextAtSize(skills, size)
  const wRest  = font.widthOfTextAtSize(rest, size)
  const wTm    = font.widthOfTextAtSize('TM', tmSize)
  const total  = wUn + wSkills + wRest + wTm
  let x = cx - total / 2
  page.drawText(un,     { x, y, size, font, color: C.black })
  x += wUn
  page.drawText(skills, { x, y, size, font, color: C.red })
  x += wSkills
  page.drawText(rest,   { x, y, size, font, color: C.black })
  x += wRest
  page.drawText('TM',   { x, y: y + size * 0.55, size: tmSize, font, color: C.black })
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

/** Footer badges row (logos centred in a given width). */
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

  const rowH = 26
  const slotW = totalWidth / count
  let slot = 0
  for (const img of images) {
    if (!img) continue
    const ar = img.width / img.height
    const maxW = slotW - 6
    let w = rowH * ar
    let actualH = rowH
    if (w > maxW) { w = maxW; actualH = w / ar }
    const x = (W - totalWidth) / 2 + slot * slotW + (slotW - w) / 2
    page.drawImage(img, { x, y: y + (rowH - actualH) / 2, width: w, height: actualH })
    slot++
  }
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
    } catch { /* blank page fallback */ }
  }
  return doc
}

// ─── Main generator ──────────────────────────────────────────────────────────

export async function generateAtcCertificate(data: AtcCertificateData): Promise<Uint8Array> {
  const doc   = await makeDocWithTemplate()
  const page  = doc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  const cx    = W / 2
  const LEFT  = 75
  const RIGHT = W - 75
  const fonts = await loadFonts(doc)

  // ── 1. TOP META — Montserrat 500 (Medium) ─────────────────────────────────
  drawText(page, 'Reg. by Govt. of India', {
    x: LEFT + 20, y: H - 80, size: 8.5, font: fonts.m500, color: C.textDark,
  })
  drawText(page, `Reg. No.: ${data.regNumber || '220102'}`, {
    x: RIGHT - 20, y: H - 80, size: 8.5, font: fonts.m500,
    align: 'right', color: C.textDark,
  })

  // ── 2. BRAND MASTHEAD — Montserrat 700 (Bold), SKILLS in red ──────────────
  drawMasthead(page, fonts.m700, cx, H - 112, 22)

  // ── 3. SUB-HEADING LINES — Montserrat 400 (Regular) ───────────────────────
  drawText(page, 'A Unit of: UnSkills FuturePath Tech Pvt. Ltd.  |  Regd. by Govt. of India Reg. No. 220102', {
    x: cx, y: H - 134, size: 7.5, font: fonts.m400, color: C.textDark, align: 'center',
  })
  drawText(page, 'Alliance with Skills India, MSME, NITI Aayog, NSDC, Labour Department', {
    x: cx, y: H - 146, size: 7.5, font: fonts.m400, color: C.textDark, align: 'center',
  })

  // ── 4. ISO STRIP — Montserrat 600 (SemiBold), white on dark navy bar ──────
  const isoText  = 'AN ISO 9001:2015 CERTIFIED ORGANIZATION'
  const isoSize  = 9
  const isoTextW = fonts.m600.widthOfTextAtSize(isoText, isoSize)
  const isoStripW = isoTextW + 28
  drawRect(page, cx - isoStripW / 2, H - 170, isoStripW, 15, C.navy)
  drawText(page, isoText, {
    x: cx, y: H - 166, size: isoSize, font: fonts.m600,
    color: C.white, align: 'center', letterSpacing: 0.3,
  })

  // (Round logo is baked into the template at this position — no overlay needed.)

  // ── 5. CERTIFICATE TITLE — Playfair Display Italic ────────────────────────
  // The user's font guide specifies "Playfair Display 500 Italic"; we use the
  // Italic variable font (default instance ≈ 400, visually similar to 500).
  drawText(page, 'Certificate', {
    x: cx, y: H - 245, size: 38, font: fonts.pfdItalic, color: C.navy, align: 'center',
  })
  // Gold divider with red diamond accent
  drawLine(page, cx - 90, H - 257, cx - 12, H - 257, 0.8, C.gold)
  drawLine(page, cx + 12, H - 257, cx + 90, H - 257, 0.8, C.gold)
  page.drawRectangle({ x: cx - 3, y: H - 260, width: 6, height: 6, color: C.red, rotate: degrees(45) })

  // ── 6. SECTION HEADING — Montserrat 700 (Bold), red ───────────────────────
  drawText(page, 'AUTHORISED TRAINING CENTER (ATC)', {
    x: cx, y: H - 290, size: 13, font: fonts.m700, color: C.red, align: 'center', letterSpacing: 0.3,
  })

  // ── 7. SUPPORTING SENTENCE — Montserrat 400 (Regular) ─────────────────────
  drawText(page, 'In acceptance to the terms and conditions, certified that', {
    x: cx, y: H - 312, size: 9.5, font: fonts.m400, color: C.textDark, align: 'center',
  })

  // ── 8. ORGANISATION NAME — Montserrat 700 (Bold), red, wrapped ───────────
  const bodyMaxW = W - 200
  const nameEndY = drawCenteredWrapped(page, data.branchName.toUpperCase(), {
    cx, y: H - 340, maxWidth: bodyMaxW,
    size: 16, font: fonts.m700, color: C.red, lineStep: 20,
  })

  // ── 9. ADDRESS — Montserrat 400 (Regular) ─────────────────────────────────
  const addrEndY = drawCenteredWrapped(page, data.branchAddress, {
    cx, y: nameEndY - 14, maxWidth: bodyMaxW,
    size: 9.5, font: fonts.m400, color: C.textDark, lineStep: 12,
  })

  // ── 10/11. APPLICANT NAME + ATC CODE ──────────────────────────────────────
  // Label: Montserrat 600 (SemiBold) · Value: Montserrat 500 (Medium)
  const infoY = Math.min(addrEndY - 26, H - 432)
  drawLabelValue(page, 'Applicant Name : ', data.ownerName || 'Branch Director', {
    cx, y: infoY, size: 11,
    labelFont: fonts.m600, valueFont: fonts.m500,
    labelColor: C.textDark, valueColor: C.textDark,
  })
  drawLabelValue(page, 'ATC Code : ', data.atcCode, {
    cx, y: infoY - 17, size: 11,
    labelFont: fonts.m600, valueFont: fonts.m500,
    labelColor: C.textDark, valueColor: C.textDark,
  })

  // ── 12. AMPERSAND — Playfair Display Italic, gold ─────────────────────────
  drawText(page, '&', {
    x: cx, y: infoY - 46, size: 24, font: fonts.pfdItalic, color: C.gold, align: 'center',
  })

  // ── 13. DESCRIPTION — Montserrat 400 (Regular) ────────────────────────────
  drawText(page, `to conduct ${data.courseType} courses,`, {
    x: cx, y: infoY - 72, size: 10.5, font: fonts.m400, color: C.textDark, align: 'center',
  })
  drawText(page, 'designed and developed by', {
    x: cx, y: infoY - 88, size: 10, font: fonts.m400, color: C.textDark, align: 'center',
  })

  // ── 14. COMPANY NAME — Montserrat 600 (SemiBold) ──────────────────────────
  drawText(page, 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: cx, y: infoY - 105, size: 11.5, font: fonts.m600, color: C.textDark, align: 'center',
  })

  // ── 15. QR + 16. DATES (centered bottom block) ────────────────────────────
  const qrSize = 72
  const qrX    = LEFT + 20
  const qrY    = 200

  const qrDataUrl = await generateQRDataUrl(
    `${(data.verificationUrlBase || '').replace(/\/+$/, '')}/verify/atc/${encodeURIComponent(data.atcCode)}`,
  )
  const qr = await embedAny(doc, qrDataUrl)
  if (qr) {
    drawRect(page, qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, C.white, C.navy, 0.8)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  // QR caption — Montserrat 400 (Regular)
  drawText(page, 'Scan to verify', {
    x: qrX + qrSize / 2, y: qrY - 13, size: 8, font: fonts.m400, color: C.textSecondary, align: 'center',
  })

  // Date lines under QR — Montserrat 500 (Medium)
  const dateY = qrY - 30
  drawText(page, `Date of Issue     :  ${data.issueDate}`, {
    x: qrX, y: dateY, size: 9, font: fonts.m500, color: C.textDark,
  })
  drawText(page, `Date of Renewal :  ${data.renewalDate}`, {
    x: qrX, y: dateY - 14, size: 9, font: fonts.m500, color: C.textDark,
  })

  // ── 17. SIGNATURE BLOCK (right side) ─────────────────────────────────────
  const sigRight = RIGHT - 15
  const sigLeft  = sigRight - 150
  const sigLineY = qrY + 22
  if (data.signatureImageUrl) {
    const sig = await embedAny(doc, data.signatureImageUrl)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: sigLineY + 6, width: 110, height: 32 })
  } else if (data.signatoryName) {
    drawText(page, data.signatoryName, {
      x: sigRight, y: sigLineY + 12, size: 15, font: fonts.pfdItalic, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, sigLineY, sigRight, sigLineY, 0.8, C.black)
  drawText(page, 'Signature Authorised', {
    x: (sigLeft + sigRight) / 2, y: sigLineY - 14, size: 10, font: fonts.m500,
    color: C.textDark, align: 'center',
  })

  // ── 18. FOOTER — Montserrat 400 (Regular) ────────────────────────────────
  const contactPhone = data.contactPhone || '8382898686 / 9838382898'
  const website      = data.website || 'www.unskillseducation.org'
  const headOffice   = data.headOfficeAddress || 'Nomlarr Sector Noida, UnSkills FuturePath Tech Pvt. Ltd.'

  drawText(page, `Contact : ${contactPhone}   |   Website : ${website}`, {
    x: cx, y: 142, size: 8.5, font: fonts.m400, color: C.textDark, align: 'center',
  })
  drawCenteredWrapped(page, `Head Office : ${headOffice}`, {
    cx, y: 128, maxWidth: W - 170,
    size: 7.5, font: fonts.m400, color: C.textSecondary, lineStep: 10,
  })

  await drawFooterBadges(doc, page, 85, W - 180)

  return doc.save()
}

export async function generateAtcCertificateBlob(data: AtcCertificateData): Promise<Blob> {
  const bytes = await generateAtcCertificate(data)
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}
