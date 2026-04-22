import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getProgramSlugForCourse,
  getCertificateConfig,
} from './certificate-registry'

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
  enrollmentNumber?: string
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

// ─── Color palette ────────────────────────────────────────────────────────────

const C = {
  black: rgb(0, 0, 0),
  navy: rgb(0.043, 0.141, 0.278),
  red: rgb(0.784, 0.063, 0.180),
  gold: rgb(0.722, 0.525, 0.043),
  maroon: rgb(0.357, 0.086, 0.125),       // #5B1620 — beautician border
  roseGold: rgb(0.714, 0.486, 0.400),     // #B67C66 — beautician accent
  orange: rgb(0.980, 0.588, 0.180),       // #FA962E — summer accent
  teal: rgb(0.059, 0.243, 0.282),         // #0F3E48 — skills-dev border
  hnBlue: rgb(0.102, 0.220, 0.412),       // #1A3869 — hardware primary
  hnOrange: rgb(0.925, 0.455, 0.133),     // #EC7422 — hardware accent
  white: rgb(1, 1, 1),
  textDark: rgb(0.039, 0.039, 0.039),
  textSecondary: rgb(0.29, 0.29, 0.29),
}

// ─── Font set ─────────────────────────────────────────────────────────────────

interface FontSet {
  body: PDFFont
  bodyBold: PDFFont
  script: PDFFont
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

/**
 * Draws the "UN SKILLS ..." brand title with the accent word in color.
 * Accepts a theme so each program can use its own accent color and trailing text.
 */
function drawBrandTitle(
  page: PDFPage,
  opts: {
    cx: number; y: number; size: number; font: PDFFont
    leading: string     // e.g., 'UN '
    accent: string      // e.g., 'SKILLS'
    trailing: string    // e.g., ' COMPUTER EDUCATION'
    baseColor: ReturnType<typeof rgb>
    accentColor: ReturnType<typeof rgb>
  },
) {
  const { cx, y, size, font, leading, accent, trailing, baseColor, accentColor } = opts
  const parts = [
    { text: leading, color: baseColor },
    { text: accent, color: accentColor },
    { text: trailing, color: baseColor },
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
  page.drawText('TM', { x: curX, y: y + size * 0.5, size: tmSize, font, color: baseColor })
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, t: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color })
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, borderColor?: ReturnType<typeof rgb>, borderWidth?: number) {
  page.drawRectangle({ x, y, width: w, height: h, color, borderColor, borderWidth })
}

function drawDivider(
  page: PDFPage,
  cx: number,
  y: number,
  halfLen: number,
  lineColor: ReturnType<typeof rgb>,
  diamondColor: ReturnType<typeof rgb>,
) {
  drawLine(page, cx - halfLen, y, cx - 8, y, 0.8, lineColor)
  page.drawRectangle({ x: cx - 3, y: y - 3, width: 6, height: 6, color: diamondColor, rotate: degrees(45) })
  drawLine(page, cx + 8, y, cx + halfLen, y, 0.8, lineColor)
}

// ─── Template loader ──────────────────────────────────────────────────────────

const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
const A4_PORTRAIT: [number, number] = [595.28, 841.89]

/**
 * Builds a fresh doc whose first page is painted with the template PDF's first
 * page (scaled to fill). Falls back to a blank page if the template is missing.
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

// ─── Landscape theme ──────────────────────────────────────────────────────────

/**
 * Theme config for a landscape certificate. Each program's decorative template
 * PDF dictates which zones are "safe" for dynamic content; the theme lets us
 * tune colors, brand text, and positions without duplicating the full layout.
 */
interface LandscapeTheme {
  // Brand title split for multi-color rendering
  brandLeading: string
  brandAccent: string
  brandTrailing: string

  // Color palette
  primary: ReturnType<typeof rgb>    // main accent — cert title, name, signature
  accent: ReturnType<typeof rgb>     // brand accent word color
  gold: ReturnType<typeof rgb>       // divider gold

  // ISO ribbon background/text (some themes invert)
  isoBg: ReturnType<typeof rgb>
  isoText: ReturnType<typeof rgb>

  // Positions (pt from origin, landscape 841.89 × 595.28)
  logoX: number        // training-center logo left edge
  photoX: number       // student photo left edge
  certBlockX: number   // cert number + QR column
  sigRightX: number    // signature right edge
  stripX0: number      // badge strip left
  stripX1: number      // badge strip right
  stripY: number       // badge strip baseline
}

/**
 * Shared landscape drawer. Every landscape program uses the same field set and
 * visual rhythm — only colors, brand text, and safe-zone boundaries vary.
 */
async function drawLandscapeContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  theme: LandscapeTheme,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta
  drawText(page, 'Reg. by Govt. of India', {
    x: 130, y: H - 72, size: 8, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 270, y: H - 72, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title
  drawBrandTitle(page, {
    cx, y: H - 100, size: 21, font: fonts.display,
    leading: theme.brandLeading, accent: theme.brandAccent, trailing: theme.brandTrailing,
    baseColor: C.black, accentColor: theme.accent,
  })

  // 3. ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoFontSize = 9
  const isoTextW = fonts.bodyBold.widthOfTextAtSize(isoText, isoFontSize)
  const isoW = isoTextW + 24
  drawRect(page, cx - isoW / 2, H - 132, isoW, 16, theme.isoBg)
  drawText(page, isoText, {
    x: cx, y: H - 128, size: isoFontSize, font: fonts.bodyBold, color: theme.isoText, align: 'center',
  })

  // 4. Sub-headers
  let subY = H - 152
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) {
      drawText(page, line, {
        x: cx, y: subY, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
      })
    }
    subY -= 11
  }

  // 5. Certificate title
  drawText(page, 'Certificate of Qualification', {
    x: cx, y: H - 212, size: 34, font: fonts.script, color: theme.primary, align: 'center',
  })

  // 6. Divider
  drawDivider(page, cx, H - 224, 95, theme.gold, theme.primary)

  // 7. Presented to
  drawRect(page, cx - 110, H - 247, 4, 4, theme.primary)
  drawText(page, 'This Certificate Is Proudly Presented To', {
    x: cx, y: H - 249, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawRect(page, cx + 106, H - 247, 4, 4, theme.primary)

  // 8. Student name
  const heroName = `${data.salutation} ${data.studentName}`.toUpperCase()
  drawText(page, heroName, {
    x: cx, y: H - 280, size: 18, font: fonts.bodyBold, color: theme.primary, align: 'center', letterSpacing: 1.5,
  })

  // 9. Body
  let bodyY = H - 305
  const bStep = 15
  drawText(page, 'has successfully attended the', { x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center' })
  bodyY -= bStep
  drawText(page, `${data.courseCode} – ${data.courseName}`, {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: theme.primary, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'learning at UnSkills Computer Education', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `at ${data.trainingCenterName}`, {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'and entitled to all honors and privileges associated with this achievement', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `on ${data.issueDate} with Secured ${data.percentage}% marks and achieved Grade ${data.grade}`, {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, align: 'center',
  })

  // 10. Training center logo
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: theme.logoX, y: H - 320, width: 60, height: 60 })
  }

  // 11. Student photo
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const pW = 70, pH = 80, pX = theme.photoX, pY = H - 320
      drawRect(page, pX - 1, pY - 1, pW + 2, pH + 2, C.black)
      page.drawImage(photo, { x: pX, y: pY, width: pW, height: pH })
    }
  }

  // 12. Cert number + QR (left column)
  const qrSize = 54
  const qrY = 108
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, theme.certBlockX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: theme.certBlockX, y: qrY, width: qrSize, height: qrSize })
  }
  drawText(page, data.certificateNumber, {
    x: theme.certBlockX, y: 185, size: 13, font: fonts.bodyBold, color: theme.primary,
  })
  drawText(page, 'CERTIFICATE NUMBER', { x: theme.certBlockX, y: 200, size: 7.5, font: fonts.bodyBold })

  // 13. Signature (right column)
  const sigRight = theme.sigRightX
  const sigLeft = sigRight - 160
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 168, width: 110, height: 30 })
  }
  drawLine(page, sigLeft, 163, sigRight, 163, 0.8, C.black)
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, {
      x: sigRight, y: 148, size: 9.5, font: fonts.bodyBold, align: 'right',
    })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, {
      x: sigRight, y: 135, size: 8.5, font: fonts.body, align: 'right',
    })
  }
  if (settings.signatory_reg_line) {
    drawText(page, settings.signatory_reg_line, {
      x: sigRight, y: 123, size: 7, font: fonts.body, color: C.textSecondary, align: 'right',
    })
  }

  // 14. Badge strip
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const stripH = 22
  const stripX0 = theme.stripX0
  const stripX1 = theme.stripX1
  const stripY = theme.stripY
  const stripSp = (stripX1 - stripX0) / badges.length
  const maxBadgeW = stripSp - 8
  drawLine(page, stripX0, stripY + stripH + 6, stripX1, stripY + stripH + 6, 0.4, theme.gold)
  for (let i = 0; i < badges.length; i++) {
    const img = badges[i]
    if (!img) continue
    const ar = img.width / img.height
    const w = Math.min(stripH * ar, maxBadgeW)
    const h = w / ar
    const bx = stripX0 + i * stripSp + stripSp / 2 - w / 2
    const by = stripY + (stripH - h) / 2
    page.drawImage(img, { x: bx, y: by, width: w, height: h })
  }

  // 15. Footer verify URL
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 44, size: 7.5, font: fonts.body, align: 'center',
    })
  }
}

// ─── Program-specific landscape themes ────────────────────────────────────────

// Computer Software — original tech-themed template (navy + red + gold)
const THEME_COMPUTER_SOFTWARE: LandscapeTheme = {
  brandLeading: 'UN ',
  brandAccent: 'SKILLS',
  brandTrailing: ' COMPUTER EDUCATION',
  primary: C.navy, accent: C.red, gold: C.gold,
  isoBg: C.black, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 285,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 62,
}

// Hardware & Networking — blueprint style with big corner circuits
// Decorations: network-graph (TL), RJ45 cable (TR), circuit board (BL), server rack (BR)
// Content zone is tighter — badge strip pulled in on both sides.
const THEME_HARDWARE_NETWORKING: LandscapeTheme = {
  brandLeading: 'UN ',
  brandAccent: 'SKILLS',
  brandTrailing: ' HARDWARE & NETWORKING',
  primary: C.hnBlue, accent: C.hnOrange, gold: C.hnOrange,
  isoBg: C.hnBlue, isoText: C.white,
  logoX: 250, photoX: 841.89 - 310,
  certBlockX: 320, sigRightX: 841.89 - 360,
  stripX0: 300, stripX1: 841.89 - 340, stripY: 70,
}

// Skills Development — double-frame navy/gold with red diamonds
const THEME_SKILLS_DEVELOPMENT: LandscapeTheme = {
  brandLeading: 'UN ',
  brandAccent: 'SKILLS',
  brandTrailing: ' DEVELOPMENT CENTER',
  primary: C.teal, accent: C.red, gold: C.gold,
  isoBg: C.teal, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 285,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 62,
}

// Beautician — maroon & rose-gold elegance
const THEME_BEAUTICIAN: LandscapeTheme = {
  brandLeading: 'UN ',
  brandAccent: 'SKILLS',
  brandTrailing: ' BEAUTICIAN ACADEMY',
  primary: C.maroon, accent: C.maroon, gold: C.roseGold,
  isoBg: C.maroon, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 285,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 62,
}

// Summer Training — navy + orange energetic frame
const THEME_SUMMER_TRAINING: LandscapeTheme = {
  brandLeading: 'UN ',
  brandAccent: 'SKILLS',
  brandTrailing: ' SUMMER TRAINING',
  primary: C.navy, accent: C.orange, gold: C.orange,
  isoBg: C.navy, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 285,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 62,
}

// ─── Landscape generator factory ──────────────────────────────────────────────

async function generateLandscapeCertificate(
  data: LandscapeCertData,
  theme: LandscapeTheme,
  templatePath: string,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate(templatePath, A4_LANDSCAPE)
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawLandscapeContent(pdfDoc, page, fonts, data, theme, W, H)
  return pdfDoc.save()
}

// Exported for legacy imports (unchanged name).
export async function generateComputerSoftwareLandscapeCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  return generateLandscapeCertificate(
    data,
    THEME_COMPUTER_SOFTWARE,
    '/certificates/computer-software-landscape.pdf',
  )
}

// ─── Typing — portrait ────────────────────────────────────────────────────────

/**
 * Typing Course portrait. Template is a tall decorative frame with small corner
 * icons (keyboard TL, document TR, pencil BL, clock BR) and side diamonds at
 * y ≈ H/2. The full central rectangle (x: 75–520, y: 90–770) is clear.
 *
 * Layout (A4 portrait, 595.28 × 841.89):
 *   y = H - 70 .. H - 210  header block (reg line, brand, ISO, sub-headers)
 *   y = H - 240 .. H - 280  certificate title + divider + "presented to"
 *   y = H - 310             student name
 *   y = H - 340 .. H - 470  logo / photo / body text stacked vertically
 *   y =  200 .. 260         cert number + QR (centered)
 *   y =  120 .. 180         signature block (centered)
 *   y =   70 .. 100         badge strip (horizontal, 7 badges) + divider
 *   y =   40                footer verify URL
 */
async function drawTypingPortraitContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta
  drawText(page, 'Reg. by Govt. of India', {
    x: 80, y: H - 80, size: 8, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 80, y: H - 80, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title
  drawBrandTitle(page, {
    cx, y: H - 112, size: 18, font: fonts.display,
    leading: 'UN ', accent: 'SKILLS', trailing: ' TYPING INSTITUTE',
    baseColor: C.black, accentColor: C.red,
  })

  // 3. ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoFontSize = 9
  const isoTextW = fonts.bodyBold.widthOfTextAtSize(isoText, isoFontSize)
  const isoW = isoTextW + 24
  drawRect(page, cx - isoW / 2, H - 142, isoW, 16, C.navy)
  drawText(page, isoText, {
    x: cx, y: H - 138, size: isoFontSize, font: fonts.bodyBold, color: C.white, align: 'center',
  })

  // 4. Sub-headers
  let subY = H - 162
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) {
      drawText(page, line, {
        x: cx, y: subY, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
      })
    }
    subY -= 11
  }

  // 5. Certificate title
  drawText(page, 'Certificate of Qualification', {
    x: cx, y: H - 225, size: 32, font: fonts.script, color: C.navy, align: 'center',
  })

  // 6. Divider
  drawDivider(page, cx, H - 237, 90, C.gold, C.navy)

  // 7. Presented to
  drawRect(page, cx - 110, H - 258, 4, 4, C.navy)
  drawText(page, 'This Certificate Is Proudly Presented To', {
    x: cx, y: H - 260, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawRect(page, cx + 106, H - 258, 4, 4, C.navy)

  // 8. Student name
  const heroName = `${data.salutation} ${data.studentName}`.toUpperCase()
  drawText(page, heroName, {
    x: cx, y: H - 295, size: 18, font: fonts.bodyBold, color: C.navy, align: 'center', letterSpacing: 1.5,
  })

  // 9. Training center logo (left of photo row)
  const photoRowY = H - 400
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 90, y: photoRowY, width: 60, height: 60 })
  }

  // 10. Student photo (right)
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const pW = 70, pH = 80, pX = W - 160, pY = photoRowY - 10
      drawRect(page, pX - 1, pY - 1, pW + 2, pH + 2, C.black)
      page.drawImage(photo, { x: pX, y: pY, width: pW, height: pH })
    }
  }

  // 11. Body (centered between logo and photo)
  let bodyY = H - 335
  const bStep = 14
  drawText(page, 'has successfully attended the', { x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center' })
  bodyY -= bStep
  drawText(page, `${data.courseCode} – ${data.courseName}`, {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: C.navy, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'learning at UnSkills Typing Institute', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `at ${data.trainingCenterName}`, {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'and entitled to all honors and privileges', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'associated with this achievement', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `on ${data.issueDate} with Secured ${data.percentage}% marks and achieved Grade ${data.grade}`, {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, align: 'center',
  })

  // 12. Cert number + QR (center, below body)
  const qrSize = 52
  const qrY = 160
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    const qrX = cx - qrSize - 6
    drawRect(page, qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  drawText(page, data.certificateNumber, {
    x: cx + 4, y: qrY + 32, size: 12, font: fonts.bodyBold, color: C.navy,
  })
  drawText(page, 'CERTIFICATE NUMBER', {
    x: cx + 4, y: qrY + 46, size: 7.5, font: fonts.bodyBold,
  })

  // 13. Signature (centered, below QR row)
  const sigCenterX = cx
  const sigY = 125
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigCenterX - 55, y: sigY + 2, width: 110, height: 28 })
  }
  drawLine(page, sigCenterX - 80, sigY - 2, sigCenterX + 80, sigY - 2, 0.8, C.black)
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, {
      x: sigCenterX, y: sigY - 14, size: 9, font: fonts.bodyBold, align: 'center',
    })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, {
      x: sigCenterX, y: sigY - 24, size: 8, font: fonts.body, align: 'center',
    })
  }

  // 14. Badge strip — 7 logos, thin row above footer (tight below signature)
  // Move badges slightly higher so they don't overlap bottom frame — y = 82 with stripH 18
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const stripY = 78
  const stripH = 18
  const stripX0 = 95
  const stripX1 = W - 95
  const stripSp = (stripX1 - stripX0) / badges.length
  const maxBadgeW = stripSp - 4
  drawLine(page, stripX0, stripY + stripH + 4, stripX1, stripY + stripH + 4, 0.4, C.gold)
  for (let i = 0; i < badges.length; i++) {
    const img = badges[i]
    if (!img) continue
    const ar = img.width / img.height
    const w = Math.min(stripH * ar, maxBadgeW)
    const h = w / ar
    const bx = stripX0 + i * stripSp + stripSp / 2 - w / 2
    const by = stripY + (stripH - h) / 2
    page.drawImage(img, { x: bx, y: by, width: w, height: h })
  }

  // 15. Footer verify URL
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 54, size: 7, font: fonts.body, align: 'center',
    })
  }
}

async function generateTypingPortraitCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate('/certificates/typing-portrait.pdf', A4_PORTRAIT)
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawTypingPortraitContent(pdfDoc, page, fonts, data, W, H)
  return pdfDoc.save()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point. Resolves a student's course to its program, then dispatches
 * to the matching program-specific generator. Throws with a clear message if the
 * program isn't registered yet (so admins/students see a graceful error, not a
 * broken PDF).
 */
export async function generateCertificate(
  courseId: string,
  certData: LandscapeCertData,
  supabase: SupabaseClient,
): Promise<Uint8Array> {
  const programSlug = await getProgramSlugForCourse(courseId, supabase)
  if (!programSlug) {
    throw new Error(`Course ${courseId} has no associated program`)
  }

  const config = getCertificateConfig(programSlug)
  if (!config) {
    throw new Error(
      `Certificate template for program "${programSlug}" is not yet available. ` +
      `See certificate-registry.ts for the list of pending programs.`,
    )
  }

  switch (config.generatorKey) {
    case 'computer-software-landscape':
      return generateLandscapeCertificate(
        certData, THEME_COMPUTER_SOFTWARE,
        '/certificates/computer-software-landscape.pdf',
      )
    case 'hardware-networking-landscape':
      return generateLandscapeCertificate(
        certData, THEME_HARDWARE_NETWORKING,
        '/certificates/hardware-networking-landscape.pdf',
      )
    case 'skills-development-landscape':
      return generateLandscapeCertificate(
        certData, THEME_SKILLS_DEVELOPMENT,
        '/certificates/skills-development-landscape.pdf',
      )
    case 'beautician-landscape':
      return generateLandscapeCertificate(
        certData, THEME_BEAUTICIAN,
        '/certificates/beautician-landscape.pdf',
      )
    case 'summer-training-landscape':
      return generateLandscapeCertificate(
        certData, THEME_SUMMER_TRAINING,
        '/certificates/summer-training-landscape.pdf',
      )
    case 'typing-portrait':
      return generateTypingPortraitCertificate(certData)
    default:
      throw new Error(`Unknown generator key: ${config.generatorKey}`)
  }
}

function toBlob(bytes: Uint8Array): Blob {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}

export async function generateCertificateBlob(
  courseId: string,
  certData: LandscapeCertData,
  supabase: SupabaseClient,
): Promise<Blob> {
  return toBlob(await generateCertificate(courseId, certData, supabase))
}
