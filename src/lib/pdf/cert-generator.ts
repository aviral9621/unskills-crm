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

export interface TypingSubjectRow {
  subject: string          // "Hindi Typing", "English Typing", etc.
  speedWpm: number         // Words per minute
  maxMarks: number         // Max marks for the subject
  minMarks: number         // Passing marks
  obtainedMarks: number    // Marks scored
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
  trainingCenterCode?: string
  performanceText?: string
  percentage: number
  grade: string
  issueDate: string
  qrCodeDataUrl: string
  trainingCenterLogoUrl?: string | null
  certificationLogoUrls?: string[]
  /** Typing-program only: list of subjects + marks rendered as a table. */
  typingSubjects?: TypingSubjectRow[]
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
  tableHeaderBg: rgb(0.92, 0.92, 0.92),
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

  const [scriptBytes, displayBytes, sansBytes, sansBoldBytes] = await Promise.all([
    fetchBytes('/fonts/GreatVibes-Regular.ttf'),
    fetchBytes('/fonts/ArchivoBlack-Regular.ttf'),
    fetchBytes('/fonts/dm-sans-400.woff'),
    fetchBytes('/fonts/dm-sans-700.woff'),
  ])

  // DM Sans (body) + Archivo Black (display) + Great Vibes (script) — client
  // wants a "professional modern" typographic feel. Ligatures are disabled
  // on every custom font because pdf-lib's subsetter does not round-trip the
  // "fi" glyph ID correctly (renders it as "{" in viewers). Standard fonts
  // have no ligatures so the flag is ignored there.
  const opts = { features: { liga: false, dlig: false, clig: false } } as const
  async function tryEmbed(bytes: ArrayBuffer | null, fallback: StandardFonts) {
    if (!bytes) return pdfDoc.embedFont(fallback)
    try { return await pdfDoc.embedFont(bytes, opts) } catch { return pdfDoc.embedFont(fallback) }
  }

  const body = await tryEmbed(sansBytes, StandardFonts.Helvetica)
  const bodyBold = await tryEmbed(sansBoldBytes, StandardFonts.HelveticaBold)
  const script = await tryEmbed(scriptBytes, StandardFonts.TimesRoman)
  const display = await tryEmbed(displayBytes, StandardFonts.HelveticaBold)

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
 * Builds a fresh doc whose first page is painted with the template background.
 * Templates are stored as JPGs (pre-rasterized from the Canva PDFs at ~130 DPI
 * by scripts/compress-templates.mjs) so each cert ends up ~500 KB instead of
 * ~4 MB. Still accepts PDFs as a fallback for any legacy paths.
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
    if (/\.pdf$/i.test(templatePath)) {
      const [embedded] = await doc.embedPdf(templateBytes, [0])
      if (embedded) {
        const ts = embedded.size()
        const scale = Math.max(W / ts.width, H / ts.height)
        page.drawPage(embedded, {
          x: (W - ts.width * scale) / 2,
          y: (H - ts.height * scale) / 2,
          width: ts.width * scale,
          height: ts.height * scale,
        })
      }
    } else {
      // JPG / PNG raster template — embed as image and draw to fill the page.
      const isJpg = /\.jpe?g$/i.test(templatePath)
      const img = isJpg
        ? await doc.embedJpg(templateBytes)
        : await doc.embedPng(templateBytes)
      const { width: iw, height: ih } = img
      const scale = Math.max(W / iw, H / ih)
      page.drawImage(img, {
        x: (W - iw * scale) / 2,
        y: (H - ih * scale) / 2,
        width: iw * scale,
        height: ih * scale,
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
  // Color palette
  primary: ReturnType<typeof rgb>    // main accent — cert title, name, signature
  accent: ReturnType<typeof rgb>     // "SKILLS" accent word + diamond + grade badge
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

  // 1. Top meta — inset so the decorative border doesn't clip it
  drawText(page, 'Reg. by Govt. of India', {
    x: 130, y: H - 88, size: 8, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 270, y: H - 88, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title — fixed company name across every program (client directive).
  drawBrandTitle(page, {
    cx, y: H - 110, size: 21, font: fonts.display,
    leading: 'UN ', accent: 'SKILLS', trailing: ' COMPUTER EDUCATION',
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

  // 9. Body — compact 5-line block so nothing overlaps the raised footer band.
  let bodyY = H - 293
  const bStep = 13
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

  // 12. Cert number + QR (left column) — raised so nothing sits on the
  // decorative bottom border of Beautician / Skills-Dev frames.
  const qrSize = 52
  const qrY = 145
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, theme.certBlockX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: theme.certBlockX, y: qrY, width: qrSize, height: qrSize })
  }
  drawText(page, data.certificateNumber, {
    x: theme.certBlockX, y: 218, size: 13, font: fonts.bodyBold, color: theme.primary,
  })
  drawText(page, 'CERTIFICATE NUMBER', { x: theme.certBlockX, y: 232, size: 7.5, font: fonts.bodyBold })

  // 13. Signature (right column) — aligned with the QR band above.
  const sigRight = theme.sigRightX
  const sigLeft = sigRight - 160
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 195, width: 110, height: 30 })
  }
  drawLine(page, sigLeft, 190, sigRight, 190, 0.8, C.black)
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, {
      x: sigRight, y: 175, size: 9.5, font: fonts.bodyBold, align: 'right',
    })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, {
      x: sigRight, y: 162, size: 8.5, font: fonts.body, align: 'right',
    })
  }
  if (settings.signatory_reg_line) {
    drawText(page, settings.signatory_reg_line, {
      x: sigRight, y: 150, size: 7, font: fonts.body, color: C.textSecondary, align: 'right',
    })
  }

  // 14. Badge strip — kept inside the white area on all templates.
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const stripH = 20
  const stripX0 = theme.stripX0
  const stripX1 = theme.stripX1
  const stripY = theme.stripY
  const stripSp = (stripX1 - stripX0) / badges.length
  const maxBadgeW = stripSp - 8
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

  // 15. Footer verify URL — above the badge row so the decorative bottom
  // border never clips it.
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: stripY - 14, size: 7.5, font: fonts.body, align: 'center',
    })
  }
}

// ─── Program-specific landscape themes ────────────────────────────────────────

// Computer Software — original tech-themed template (navy + red + gold)
const THEME_COMPUTER_SOFTWARE: LandscapeTheme = {
  primary: C.navy, accent: C.red, gold: C.gold,
  isoBg: C.black, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 285,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 95,
}

// NOTE: Hardware & Networking uses a bespoke drawer (see
// generateHardwareNetworkingCertificate below) — not the generic landscape
// theme — because the client specified a completely different layout.

// Skills Development — double-frame navy/gold with red diamonds
const THEME_SKILLS_DEVELOPMENT: LandscapeTheme = {
  primary: C.teal, accent: C.red, gold: C.gold,
  isoBg: C.teal, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 265,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 95,
}

// Beautician — maroon & rose-gold elegance
const THEME_BEAUTICIAN: LandscapeTheme = {
  primary: C.maroon, accent: C.maroon, gold: C.roseGold,
  isoBg: C.maroon, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 265,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 95,
}

// Summer Training — navy + orange energetic frame
const THEME_SUMMER_TRAINING: LandscapeTheme = {
  primary: C.navy, accent: C.orange, gold: C.orange,
  isoBg: C.navy, isoText: C.white,
  logoX: 140, photoX: 841.89 - 205,
  certBlockX: 215, sigRightX: 841.89 - 265,
  stripX0: 205, stripX1: 841.89 - 265, stripY: 95,
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
    '/certificates/computer-software-landscape.jpg',
  )
}

// ─── Hardware & Networking — bespoke landscape layout ─────────────────────────

/**
 * Dedicated Hardware & Networking landscape certificate. Layout is specified
 * by the client separately from the other programs: big "UNSKILLS COMPUTER
 * EDUCATION" brand, large serif "CERTIFICATE OF QUALIFICATION" title, 9-line
 * body paragraph, branch logo on the left + student photo on the right, red
 * "Certificate No." pill next to the QR, horizontal badge row in the middle,
 * script signature on the right, corporate-office line, and the verify URL
 * painted on top of the template's own bottom navy bar.
 *
 * Coordinates fit inside the template's inner white zone:
 *   x ∈ [85, W-85]  (≈ 85..757)
 *   y ∈ [90, H-90]  (≈ 90..505)
 */
async function drawHardwareNetworkingContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta row — inside the inner white zone, just below the top bar.
  drawText(page, 'Reg. by Govt. of India', {
    x: 95, y: H - 105, size: 10, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 95, y: H - 105, size: 10, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title "UNSKILLS COMPUTER EDUCATION" — UNSKILLS red, rest black.
  drawBrandTitle(page, {
    cx, y: H - 138, size: 26, font: fonts.display,
    leading: '', accent: 'UNSKILLS', trailing: ' COMPUTER EDUCATION',
    baseColor: C.black, accentColor: C.red,
  })

  // 3. Black ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoSize = 11
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize) + 28
  drawRect(page, cx - isoW / 2, H - 170, isoW, 18, C.black)
  drawText(page, isoText, {
    x: cx, y: H - 165, size: isoSize, font: fonts.bodyBold, color: C.white, align: 'center',
  })

  // 4. Three sub-header lines
  let subY = H - 188
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) {
      drawText(page, line, {
        x: cx, y: subY, size: 8, font: fonts.body, color: C.textDark, align: 'center',
      })
    }
    subY -= 11
  }

  // 5. Branch logo (left) + student photo box (right), positioned below the
  // sub-headers on either side of the cert title.
  const logoY = H - 300
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 95, y: logoY, width: 80, height: 80 })
  }
  const photoW = 80, photoH = 95
  const photoX = W - 95 - photoW
  const photoY = H - 310
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      drawRect(page, photoX - 1, photoY - 1, photoW + 2, photoH + 2, C.white, C.hnBlue, 1)
      page.drawImage(photo, { x: photoX, y: photoY, width: photoW, height: photoH })
    }
  } else {
    drawRect(page, photoX, photoY, photoW, photoH, C.white, C.hnBlue, 1)
  }

  // 6. Certificate title — big serif caps, centered between the logo + photo.
  drawText(page, 'CERTIFICATE OF QUALIFICATION', {
    x: cx, y: H - 240, size: 22, font: fonts.bodyBold, color: C.textDark, align: 'center', letterSpacing: 0.8,
  })

  // 7. Body — 9 lines, tight 14pt step.
  let bodyY = H - 270
  const bStep = 14
  drawText(page, 'This is to certify that', { x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center' })
  bodyY -= bStep
  drawText(page, `Mr./Miss/Mrs  ${data.studentName.toUpperCase()}`, {
    x: cx, y: bodyY, size: 12, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `${data.fatherPrefix}/ Mr. ${data.fatherName.toUpperCase()}`, {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'has successfully completed the', {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `${data.courseCode} - ${data.courseName}`, {
    x: cx, y: bodyY, size: 13, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `his/her performance during the course has been ${data.performanceText || 'Excellent'}`, {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `He/She scored ${data.percentage} marks & secured the Grade "${data.grade}"`, {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'We wish him/her for bright future', {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `Held at ${data.trainingCenterName}`, {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, align: 'center',
  })

  // 8. QR + "Certificate No." red pill + "Date of Issue" (bottom-left cluster)
  const qrSize = 52
  const qrX = 100
  const qrY = 130
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  const pillX = qrX + qrSize + 8
  const pillY = qrY + qrSize - 24
  const pillW = 200
  const pillH = 22
  drawRect(page, pillX, pillY, pillW, pillH, C.red)
  drawText(page, `Certificate No. : ${data.certificateNumber}`, {
    x: pillX + pillW / 2, y: pillY + 7, size: 10, font: fonts.bodyBold, color: C.white, align: 'center',
  })
  drawText(page, `Date of Issue : ${data.issueDate}`, {
    x: pillX, y: pillY - 16, size: 10, font: fonts.bodyBold, color: C.textDark,
  })

  // 9. Badge row (bottom-center) — sits between the QR cluster and the
  // signature. Uses the first 4 configured badges so logos don't crowd.
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const visibleBadges = badges.slice(0, Math.min(4, badges.length))
  if (visibleBadges.length > 0) {
    const badgeY = 135
    const badgeH = 30
    const badgeX0 = 360
    const badgeX1 = W - 255
    const badgeSp = (badgeX1 - badgeX0) / visibleBadges.length
    for (let i = 0; i < visibleBadges.length; i++) {
      const img = visibleBadges[i]
      if (!img) continue
      const ar = img.width / img.height
      const w = Math.min(badgeH * ar, badgeSp - 6)
      const h = w / ar
      const bx = badgeX0 + i * badgeSp + badgeSp / 2 - w / 2
      const by = badgeY + (badgeH - h) / 2
      page.drawImage(img, { x: bx, y: by, width: w, height: h })
    }
  }

  // 10. Signature (bottom-right)
  const sigRight = W - 95
  const sigLeft = sigRight - 150
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 175, width: 110, height: 30 })
  } else if (settings.signatory_name) {
    drawText(page, settings.signatory_name, {
      x: sigRight, y: 182, size: 18, font: fonts.script, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, 172, sigRight, 172, 0.8, C.black)
  drawText(page, settings.signatory_designation || 'Chief Executive Officer', {
    x: sigRight, y: 158, size: 10, font: fonts.bodyBold, align: 'right',
  })
  drawText(page, settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: sigRight, y: 145, size: 9, font: fonts.body, align: 'right',
  })

  // 11. Corporate office (above the bottom navy bar)
  if (settings.corporate_office_address) {
    drawText(page, `Corporate Office : ${settings.corporate_office_address}`, {
      x: cx, y: 108, size: 9.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
    })
  }

  // 12. Verify URL + email — painted in white on top of the template's navy
  // bottom bar so it reads like a single integrated strip.
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit : ${settings.verification_url_base}`, {
      x: cx, y: 75, size: 9.5, font: fonts.bodyBold, color: C.white, align: 'center',
    })
  }
  if (settings.contact_email) {
    drawText(page, `Mail us : ${settings.contact_email}`, {
      x: cx, y: 60, size: 8.5, font: fonts.body, color: C.white, align: 'center',
    })
  }
}

async function generateHardwareNetworkingCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate(
    '/certificates/hardware-networking-landscape.jpg',
    A4_LANDSCAPE,
  )
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawHardwareNetworkingContent(pdfDoc, page, fonts, data, W, H)
  return pdfDoc.save()
}

// ─── Typing — portrait ────────────────────────────────────────────────────────

/**
 * Typing Course portrait. Matches the reference "Computer Based Typing
 * Examination" certificate from the legacy CRM — dense, table-driven layout
 * showing per-subject speed (WPM) + max/min/obtained marks, grade box, date
 * of issue box, and a 3-column enrollment/center/training-center strip.
 *
 * A4 portrait: 595.28 × 841.89. Inner frame (template decoration) ≈ 60pt on
 * each side, so we confine all content to x: 60..535, y: 55..785.
 */

function drawTableCell(
  page: PDFPage,
  opts: {
    x: number; y: number; w: number; h: number
    bg?: ReturnType<typeof rgb>
    borderColor: ReturnType<typeof rgb>
    borderWidth: number
    text?: string
    textSize?: number
    textFont?: PDFFont
    textColor?: ReturnType<typeof rgb>
    textAlign?: 'left' | 'center' | 'right'
    padX?: number
  },
) {
  const {
    x, y, w, h, bg, borderColor, borderWidth,
    text, textSize = 9, textFont, textColor = C.textDark,
    textAlign = 'center', padX = 4,
  } = opts
  if (bg) drawRect(page, x, y, w, h, bg, borderColor, borderWidth)
  else page.drawRectangle({ x, y, width: w, height: h, borderColor, borderWidth })
  if (text && textFont) {
    const tx = textAlign === 'center' ? x + w / 2
      : textAlign === 'right' ? x + w - padX
      : x + padX
    drawText(page, text, {
      x: tx, y: y + h / 2 - textSize * 0.35, size: textSize,
      font: textFont, color: textColor, align: textAlign,
    })
  }
}

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
  // Pull content inward from the decorative corner icons (keyboard TL, document
  // TR, pencil BL, clock BR) so nothing sits on them.
  const LEFT = 95
  const RIGHT = W - 95

  // 1. Top meta — Certificate No (left) | Reg. No (right), dropped below the
  // top-left keyboard icon and top-right document icon.
  drawText(page, `Certificate No.: ${data.certificateNumber}`, {
    x: LEFT, y: H - 95, size: 8, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.: ${regNoValue}`, {
    x: RIGHT, y: H - 95, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title — fixed company name across every program.
  drawBrandTitle(page, {
    cx, y: H - 123, size: 22, font: fonts.display,
    leading: 'UN ', accent: 'SKILLS', trailing: ' COMPUTER EDUCATION',
    baseColor: C.black, accentColor: C.red,
  })

  // 3. ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoFontSize = 9
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, isoFontSize) + 24
  drawRect(page, cx - isoW / 2, H - 153, isoW, 16, C.navy)
  drawText(page, isoText, {
    x: cx, y: H - 149, size: isoFontSize, font: fonts.bodyBold, color: C.white, align: 'center',
  })

  // 4. Sub-headers
  let subY = H - 172
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) {
      drawText(page, line, {
        x: cx, y: subY, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
      })
    }
    subY -= 11
  }

  // 5. Title — "Computer Based Typing Examination"
  drawText(page, 'Computer Based Typing Examination', {
    x: cx, y: H - 220, size: 18, font: fonts.bodyBold, color: C.navy, align: 'center',
  })
  drawLine(page, cx - 140, H - 227, cx + 140, H - 227, 0.8, C.gold)

  // 6. 3-column header table — Enrollment | Center Code | Training Center
  const tbl1Y = H - 268
  const tbl1H = 22
  const tbl1Cols = [
    { w: 125, label: 'Enrollment No.', value: data.enrollmentNumber || '—' },
    { w: 105, label: 'Center Code',    value: data.trainingCenterCode || '—' },
    { w: RIGHT - LEFT - 230, label: 'Authorised Training Center Name', value: data.trainingCenterName || '—' },
  ]
  let tbl1X = LEFT
  // header row (gray bg)
  for (const c of tbl1Cols) {
    drawTableCell(page, {
      x: tbl1X, y: tbl1Y + tbl1H, w: c.w, h: tbl1H,
      bg: C.tableHeaderBg, borderColor: C.black, borderWidth: 0.6,
      text: c.label, textFont: fonts.bodyBold, textSize: 8.5,
    })
    tbl1X += c.w
  }
  // data row
  tbl1X = LEFT
  for (const c of tbl1Cols) {
    drawTableCell(page, {
      x: tbl1X, y: tbl1Y, w: c.w, h: tbl1H,
      borderColor: C.black, borderWidth: 0.6,
      text: c.value, textFont: fonts.body, textSize: 9, textColor: C.navy,
    })
    tbl1X += c.w
  }

  // 7. "This certificate is Proudly Presented to"
  drawText(page, 'This certificate is Proudly Presented to', {
    x: cx, y: H - 330, size: 11, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // 8. Branch logo (left) + Student name (center, red) + Student photo (right)
  const rowY = H - 395
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: LEFT, y: rowY - 5, width: 60, height: 60 })
  }
  const heroName = data.studentName.toUpperCase()
  drawText(page, heroName, {
    x: cx, y: H - 368, size: 20, font: fonts.bodyBold, color: C.red, align: 'center', letterSpacing: 1,
  })
  drawText(page, `${data.fatherPrefix} Mr. ${data.fatherName.toUpperCase()}`, {
    x: cx, y: H - 392, size: 10.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const pW = 60, pH = 70, pX = RIGHT - pW, pY = rowY - 5
      drawRect(page, pX - 1, pY - 1, pW + 2, pH + 2, C.black)
      page.drawImage(photo, { x: pX, y: pY, width: pW, height: pH })
    }
  }

  // 9. Body (5 lines)
  let bodyY = H - 420
  const bStep = 13
  drawText(page, 'has passed in the following subject of the', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'Computer Based Typing Examination', {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, color: C.navy, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'Designed and developed as per the standard of', {
    x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `held at ${data.trainingCenterName}`, {
    x: cx, y: bodyY, size: 10, font: fonts.bodyBold, align: 'center',
  })

  // 10. Subject marks table (5 cols) — falls back to a single row from
  // percentage if typingSubjects wasn't supplied.
  const subjects: TypingSubjectRow[] = data.typingSubjects && data.typingSubjects.length > 0
    ? data.typingSubjects
    : [{
        subject: data.courseName || 'Typing',
        speedWpm: 0,
        maxMarks: 100,
        minMarks: 30,
        obtainedMarks: data.percentage,
      }]

  const tbl2HeaderY = H - 500
  const tbl2RowH = 22
  const tbl2TotalW = RIGHT - LEFT
  const tbl2Cols = [
    { w: tbl2TotalW - 4 * 72, label: 'Name of the Subject', key: 'subject',       align: 'left'   as const },
    { w: 72, label: 'Speed W.P.M.',   key: 'speedWpm',      align: 'center' as const },
    { w: 72, label: 'Maximum Marks',  key: 'maxMarks',      align: 'center' as const },
    { w: 72, label: 'Minimum Marks',  key: 'minMarks',      align: 'center' as const },
    { w: 72, label: 'Marks Obtained', key: 'obtainedMarks', align: 'center' as const },
  ]
  // header
  let tbl2X = LEFT
  for (const c of tbl2Cols) {
    drawTableCell(page, {
      x: tbl2X, y: tbl2HeaderY, w: c.w, h: tbl2RowH,
      bg: C.tableHeaderBg, borderColor: C.black, borderWidth: 0.6,
      text: c.label, textFont: fonts.bodyBold, textSize: 8.5,
      textAlign: c.align, padX: 4,
    })
    tbl2X += c.w
  }
  // data rows
  for (let r = 0; r < subjects.length; r++) {
    const row = subjects[r]
    let x = LEFT
    const y = tbl2HeaderY - tbl2RowH * (r + 1)
    for (const c of tbl2Cols) {
      const raw = row[c.key as keyof TypingSubjectRow]
      const text = typeof raw === 'number' ? String(raw) : (raw || '—')
      drawTableCell(page, {
        x, y, w: c.w, h: tbl2RowH,
        borderColor: C.black, borderWidth: 0.6,
        text, textFont: c.key === 'subject' ? fonts.bodyBold : fonts.body,
        textSize: 9, textColor: c.key === 'subject' ? C.navy : C.textDark,
        textAlign: c.align, padX: 6,
      })
      x += c.w
    }
  }

  // 11. Grade system legend (left) + Grade & Date boxes (right)
  //     Anchored below the marks table; keep above the QR / signature row.
  const gradeRowTop = tbl2HeaderY - tbl2RowH * (subjects.length + 1) - 10
  // Legend
  const legendLines = [
    'Grade System',
    'A+ : 85% & Above',
    'A  : 75% to 84%',
    'B  : 60% to 74%',
    'C  : 40% to 59%',
  ]
  for (let i = 0; i < legendLines.length; i++) {
    const y = gradeRowTop - i * 11
    const bold = i === 0
    drawText(page, legendLines[i], {
      x: LEFT, y, size: 8.5, font: bold ? fonts.bodyBold : fonts.body,
      color: C.textDark,
    })
  }
  // Grade + Date of Issue boxes — right side
  const boxW = 180
  const boxH = 20
  const boxX = RIGHT - boxW
  // Grade row
  drawTableCell(page, {
    x: boxX, y: gradeRowTop - 8, w: 70, h: boxH,
    bg: C.red, borderColor: C.black, borderWidth: 0.6,
    text: 'Grade', textFont: fonts.bodyBold, textSize: 9.5, textColor: C.white,
  })
  drawTableCell(page, {
    x: boxX + 70, y: gradeRowTop - 8, w: boxW - 70, h: boxH,
    borderColor: C.black, borderWidth: 0.6,
    text: data.grade, textFont: fonts.bodyBold, textSize: 11, textColor: C.navy,
  })
  // Date of Issue row
  drawTableCell(page, {
    x: boxX, y: gradeRowTop - 8 - boxH - 4, w: 100, h: boxH,
    bg: C.red, borderColor: C.black, borderWidth: 0.6,
    text: 'Date of Issue', textFont: fonts.bodyBold, textSize: 9.5, textColor: C.white,
  })
  drawTableCell(page, {
    x: boxX + 100, y: gradeRowTop - 8 - boxH - 4, w: boxW - 100, h: boxH,
    borderColor: C.black, borderWidth: 0.6,
    text: data.issueDate, textFont: fonts.bodyBold, textSize: 10, textColor: C.navy,
  })

  // 12. QR (left-bottom) + Signature (right-bottom) — raised so the bottom-
  // corner pencil/clock icons don't clip them.
  const qrSize = 58
  const qrY = 165
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, LEFT - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: LEFT, y: qrY, width: qrSize, height: qrSize })
  }
  // Signature block, right side
  const sigRight = RIGHT
  const sigLeft = sigRight - 160
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 115, y: 210, width: 115, height: 30 })
  }
  drawLine(page, sigLeft, 205, sigRight, 205, 0.8, C.black)
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, {
      x: sigRight, y: 190, size: 9.5, font: fonts.bodyBold, align: 'right',
    })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, {
      x: sigRight, y: 177, size: 8.5, font: fonts.body, align: 'right',
    })
  }
  if (settings.signatory_reg_line) {
    drawText(page, settings.signatory_reg_line, {
      x: sigRight, y: 165, size: 7, font: fonts.body, color: C.textSecondary, align: 'right',
    })
  }

  // 13. Badge strip — 7 logos in a horizontal band above the verify URL,
  // pulled inward so the pencil / clock corner icons don't clip them.
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const stripY = 125
  const stripH = 18
  const stripX0 = LEFT + 50
  const stripX1 = RIGHT - 50
  const stripSp = (stripX1 - stripX0) / Math.max(badges.length, 1)
  const maxBadgeW = stripSp - 4
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

  // 14. Footer verify URL — above the bottom decorative border
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 105, size: 7.5, font: fonts.body, align: 'center',
    })
  }
}

async function generateTypingPortraitCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate('/certificates/typing-portrait.jpg', A4_PORTRAIT)
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
        '/certificates/computer-software-landscape.jpg',
      )
    case 'hardware-networking-landscape':
      return generateHardwareNetworkingCertificate(certData)
    case 'skills-development-landscape':
      return generateLandscapeCertificate(
        certData, THEME_SKILLS_DEVELOPMENT,
        '/certificates/skills-development-landscape.jpg',
      )
    case 'beautician-landscape':
      return generateLandscapeCertificate(
        certData, THEME_BEAUTICIAN,
        '/certificates/beautician-landscape.jpg',
      )
    case 'summer-training-landscape':
      return generateLandscapeCertificate(
        certData, THEME_SUMMER_TRAINING,
        '/certificates/summer-training-landscape.jpg',
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
