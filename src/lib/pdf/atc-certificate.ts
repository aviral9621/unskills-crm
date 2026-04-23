/**
 * Authorised Training Center (ATC) Certificate generator.
 *
 * PORTRAIT A4 (595.28 × 841.89 pt). The decorative border + greek-key
 * ornamentation is supplied by the fixed template asset at
 *   /public/Branch Certificate.pdf
 * which we embed as the page background — all dynamic text/logos/QR are
 * overlaid inside that template's inner safe zone.
 *
 * Inner safe zone for content: x ∈ [75, W-75], y ∈ [65, H-70].
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

/** Two-colour masthead: UN (black) + SKILLS (red) + ' COMPUTER EDUCATION' (black) + TM. */
function drawMasthead(page: PDFPage, fonts: FontSet, cx: number, y: number, size: number) {
  const un = 'UN'
  const skills = 'SKILLS'
  const rest = ' COMPUTER EDUCATION'
  const tmSize = size * 0.35
  const wUn    = fonts.display.widthOfTextAtSize(un, size)
  const wSkills = fonts.display.widthOfTextAtSize(skills, size)
  const wRest  = fonts.display.widthOfTextAtSize(rest, size)
  const wTm    = fonts.display.widthOfTextAtSize('TM', tmSize)
  const total  = wUn + wSkills + wRest + wTm
  let x = cx - total / 2
  page.drawText(un,    { x, y, size, font: fonts.display, color: C.black })
  x += wUn
  page.drawText(skills, { x, y, size, font: fonts.display, color: C.red })
  x += wSkills
  page.drawText(rest,  { x, y, size, font: fonts.display, color: C.black })
  x += wRest
  page.drawText('TM',  { x, y: y + size * 0.55, size: tmSize, font: fonts.display, color: C.black })
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

  const rowH = 26   // taller rows so NSDC and others are clearly visible
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
  const doc = await makeDocWithTemplate()
  const page = doc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  const cx = W / 2
  const LEFT  = 75
  const RIGHT  = W - 75
  const fonts  = await loadFonts(doc)

  // ── 1. TOP META ──────────────────────────────────────────────────────────
  // Moved inward (LEFT+20 / RIGHT-20) so text never touches the border.
  drawText(page, 'Reg. by Govt. of India', {
    x: LEFT + 20, y: H - 80, size: 8.5, font: fonts.bodyBold, color: C.textDark,
  })
  drawText(page, `Reg. No.: ${data.regNumber || '220102'}`, {
    x: RIGHT - 20, y: H - 80, size: 8.5, font: fonts.bodyBold,
    align: 'right', color: C.textDark,
  })

  // ── 2. BRAND MASTHEAD (no side logo — clean full-width heading) ───────────
  // UN (black) + SKILLS (red) + ' COMPUTER EDUCATION' (black) + TM, size 24.
  drawMasthead(page, fonts, cx, H - 112, 24)
  drawText(page, 'A Unit of: UnSkills FuturePath Tech Pvt. Ltd.  |  Regd. by Govt. of India Reg. No. 220102', {
    x: cx, y: H - 135, size: 7.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'Alliance with Skills India, MSME, NITI Aayog, NSDC, Labour Department', {
    x: cx, y: H - 147, size: 7.5, font: fonts.body, color: C.textDark, align: 'center',
  })

  // ── 3. ISO STRIP ─────────────────────────────────────────────────────────
  const isoText = 'AN ISO 9001:2015 CERTIFIED ORGANIZATION'
  const isoSize = 9
  const isoTextW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize)
  const isoStripW = isoTextW + 28
  drawRect(page, cx - isoStripW / 2, H - 170, isoStripW, 15, C.black)
  drawText(page, isoText, {
    x: cx, y: H - 166, size: isoSize, font: fonts.bodyBold,
    color: C.white, align: 'center', letterSpacing: 0.3,
  })

  // ── 4. CERTIFICATE TITLE ─────────────────────────────────────────────────
  drawText(page, 'Certificate', {
    x: cx, y: H - 210, size: 36, font: fonts.serifItalic, color: C.navy, align: 'center',
  })
  // Gold divider with red diamond accent
  drawLine(page, cx - 90, H - 222, cx - 12, H - 222, 0.8, C.gold)
  drawLine(page, cx + 12, H - 222, cx + 90, H - 222, 0.8, C.gold)
  page.drawRectangle({ x: cx - 3, y: H - 225, width: 6, height: 6, color: C.red, rotate: degrees(45) })

  // ── 5. SIDE LOGOS (branch logo LEFT, UnSkills logo RIGHT) ────────────────
  // These sit in the left/right margins alongside the body text.
  const sideLogoSize = 62
  const sideLogoY    = H - 385
  if (data.branchLogoUrl) {
    const blogo = await embedAny(doc, data.branchLogoUrl)
    if (blogo) {
      const ar = blogo.width / blogo.height
      const w  = Math.min(sideLogoSize * ar, sideLogoSize + 8)
      const h  = w / ar
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
      const w  = Math.min(sideLogoSize * ar, sideLogoSize + 8)
      const h  = w / ar
      page.drawImage(uLogo, {
        x: RIGHT - sideLogoSize - 5 + (sideLogoSize - w) / 2,
        y: sideLogoY + (sideLogoSize - h) / 2,
        width: w, height: h,
      })
    }
  }

  // ── 6. MAIN BODY CONTENT ─────────────────────────────────────────────────
  const bodyCx  = cx
  const bodyMaxW = W - 260   // leaves room for side logos

  // "AUTHORISED TRAINING CENTER (ATC)" — display font, bigger, professional
  drawText(page, 'AUTHORISED TRAINING CENTER (ATC)', {
    x: bodyCx, y: H - 258, size: 14, font: fonts.display,
    color: C.red, align: 'center',
  })

  drawText(page, 'In acceptance to the terms and conditions, certified that', {
    x: bodyCx, y: H - 280, size: 9.5, font: fonts.body, color: C.textDark, align: 'center',
  })

  // Branch name (bold, red, wrapped)
  const nameEndY = drawCenteredWrapped(page, data.branchName.toUpperCase(), {
    cx: bodyCx, y: H - 308, maxWidth: bodyMaxW,
    size: 16, font: fonts.bodyBold, color: C.red, lineStep: 20,
  })

  // Branch address (smaller, wrapped)
  const addrEndY = drawCenteredWrapped(page, data.branchAddress, {
    cx: bodyCx, y: nameEndY - 14, maxWidth: bodyMaxW,
    size: 9.5, font: fonts.body, color: C.textDark, lineStep: 12,
  })

  // Applicant name + ATC code block
  const infoY = Math.min(addrEndY - 24, H - 412)
  drawText(page, `Applicant Name : ${data.ownerName || 'Branch Director'}`, {
    x: bodyCx, y: infoY, size: 10.5, font: fonts.bodyBold, color: C.navy, align: 'center',
  })
  drawText(page, `ATC Code : ${data.atcCode}`, {
    x: bodyCx, y: infoY - 17, size: 10.5, font: fonts.bodyBold, color: C.navy, align: 'center',
  })

  // Ampersand divider
  drawText(page, '&', {
    x: bodyCx, y: infoY - 44, size: 22, font: fonts.serifItalic, color: C.gold, align: 'center',
  })

  // Course-type lines — clean two-line format with proper spacing
  drawText(page, `to conduct ${data.courseType} courses,`, {
    x: bodyCx, y: infoY - 70, size: 10.5, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'designed and developed by', {
    x: bodyCx, y: infoY - 86, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawText(page, 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: bodyCx, y: infoY - 101, size: 11, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // ── 7. BOTTOM ROW: certified logo | QR + dates | signature ───────────────
  //
  // Layout (left → right):
  //   Zone A  x ∈ [LEFT, cx-80]:  certified-logo.png
  //   Zone B  x ≈ cx:             QR code + "Scan to verify" + two date lines
  //   Zone C  x ∈ [cx+80, RIGHT]: signature block

  const qrSize = 72
  const qrX    = cx - qrSize / 2
  const qrY    = 213   // bottom of QR box (rises to 213+72=285)

  // QR code
  const qrDataUrl = await generateQRDataUrl(
    `${(data.verificationUrlBase || '').replace(/\/+$/, '')}/verify/atc/${encodeURIComponent(data.atcCode)}`,
  )
  const qr = await embedAny(doc, qrDataUrl)
  if (qr) {
    drawRect(page, qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, C.white, C.navy, 0.8)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  drawText(page, 'Scan to verify', {
    x: cx, y: qrY - 13, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
  })

  // Date lines centered below QR
  drawText(page, `Date of Issue      :  ${data.issueDate}`, {
    x: cx, y: qrY - 27, size: 9, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  drawText(page, `Date of Renewal :  ${data.renewalDate}`, {
    x: cx, y: qrY - 41, size: 9, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // Certified logo (Zone A — left of QR)
  const certLogo = await embedAny(doc, '/certified-logo.png')
  if (certLogo) {
    const clMaxH = 70
    const clAr   = certLogo.width / certLogo.height
    const clH    = clMaxH
    const clW    = Math.min(clH * clAr, 80)
    const clX    = LEFT + 20
    const clY    = qrY + (qrSize - clH) / 2  // vertically centered with QR
    page.drawImage(certLogo, { x: clX, y: clY, width: clW, height: clH })
  }

  // Signature (Zone C — right of QR)
  const sigRight = RIGHT - 15
  const sigLeft  = sigRight - 140
  const sigLineY = qrY + 24   // signature line at 1/3 height of QR box
  if (data.signatureImageUrl) {
    const sig = await embedAny(doc, data.signatureImageUrl)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: sigLineY + 6, width: 110, height: 32 })
  } else if (data.signatoryName) {
    drawText(page, data.signatoryName, {
      x: sigRight, y: sigLineY + 12, size: 15, font: fonts.serifItalic, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, sigLineY, sigRight, sigLineY, 0.8, C.black)
  drawText(page, 'Signature Authorised', {
    x: sigRight, y: sigLineY - 14, size: 9.5, font: fonts.bodyBold, color: C.navy, align: 'right',
  })

  // ── 8. FOOTER (contact + head office + badges) ───────────────────────────
  const contactPhone = data.contactPhone || '8382898686 / 9838382898'
  const website      = data.website || 'www.unskillseducation.org'
  const headOffice   = data.headOfficeAddress || 'Nomlarr Sector Noida, UnSkills FuturePath Tech Pvt. Ltd.'

  drawText(page, `Contact : ${contactPhone}   |   Website : ${website}`, {
    x: cx, y: 142, size: 8.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  drawCenteredWrapped(page, `Head Office : ${headOffice}`, {
    cx, y: 128, maxWidth: W - 170,
    size: 7.5, font: fonts.body, color: C.textSecondary, lineStep: 10,
  })

  // Footer badges — raised above the bottom ornament, larger so NSDC is visible
  await drawFooterBadges(doc, page, 85, W - 180)

  return doc.save()
}

export async function generateAtcCertificateBlob(data: AtcCertificateData): Promise<Blob> {
  const bytes = await generateAtcCertificate(data)
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}
