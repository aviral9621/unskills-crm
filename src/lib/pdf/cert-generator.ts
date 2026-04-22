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
  /** Elegant serif italic for decorative certificate titles. */
  serifItalic: PDFFont
  serifBold: PDFFont
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

  // Body uses the Standard PDF Helvetica set so every viewer renders it
  // correctly without subsetting — previous DM Sans WOFF embed triggered
  // Acrobat's "cannot extract embedded font" warning.
  const body = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bodyBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Custom decorative fonts: brand title + cert title. Ligatures disabled so
  // "fi" doesn't render as "{" (pdf-lib subset name table quirk).
  const opts = { features: { liga: false, dlig: false, clig: false } } as const
  const [scriptBytes, displayBytes] = await Promise.all([
    fetchBytes('/fonts/GreatVibes-Regular.ttf'),
    fetchBytes('/fonts/ArchivoBlack-Regular.ttf'),
  ])
  const script = scriptBytes
    ? await pdfDoc.embedFont(scriptBytes, opts).catch(() => pdfDoc.embedFont(StandardFonts.TimesRomanItalic))
    : await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
  const display = displayBytes
    ? await pdfDoc.embedFont(displayBytes, opts).catch(() => pdfDoc.embedFont(StandardFonts.HelveticaBold))
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Standard-14 serif faces for elegant decorative titles (e.g. Skills
  // Development "Certificate of Qualification"). Always embeddable — no
  // external font fetches to fail.
  const serifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  return { body, bodyBold, script, display, serifItalic, serifBold }
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

// NOTE: Skills Development uses a bespoke drawer (see
// generateSkillsDevelopmentCertificate below) — not the generic landscape
// theme — so the client's elegant serif title + strict layout hierarchy
// matches the Hardware & Networking standard.

// NOTE: Beautician and Summer Training use bespoke drawers (see below) — not
// the generic landscape theme — so layout precision matches the H&N standard.

// NOTE: Summer Training uses a bespoke drawer (see generateSummerTrainingCertificate).

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
  // Only draw the photo frame if there's actually a photo — no placeholder.
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      drawRect(page, photoX - 1, photoY - 1, photoW + 2, photoH + 2, C.white, C.hnBlue, 1)
      page.drawImage(photo, { x: photoX, y: photoY, width: photoW, height: photoH })
    }
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

  // 11. Bottom footer stack. Measured bar positions on this template:
  //     navy bar ..... y = 39 .. 57  (19 pt thick)
  //     orange line .. y = 63 .. 67  (thin separator)
  //     clear zone ... y = 68 .. ~105
  // Corporate address at y≈100 (dark), Mail us at y≈80 (dark, above orange
  // separator), verify URL at y≈48 (white text centered inside navy bar).
  if (settings.corporate_office_address) {
    drawText(page, `Corporate Office : ${settings.corporate_office_address}`, {
      x: cx, y: 100, size: 9.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
    })
  }
  if (settings.contact_email) {
    drawText(page, `Mail us : ${settings.contact_email}`, {
      x: cx, y: 82, size: 8.5, font: fonts.body, color: C.textDark, align: 'center',
    })
  }
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit : ${settings.verification_url_base}`, {
      x: cx, y: 44, size: 9, font: fonts.bodyBold, color: C.white, align: 'center',
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

// ─── Skills Development — bespoke landscape layout ────────────────────────────

/**
 * Dedicated Skills Development landscape certificate. Matches the visual
 * hierarchy, spacing, and precision of the Hardware & Networking layout but
 * restyled for the teal/gold/maroon frame template: elegant serif italic
 * "Certificate of Qualification" title, teal ISO ribbon, teal photo border,
 * teal "Certificate No." pill, and a painted teal verify strip at the bottom
 * (template has no built-in bottom bar).
 *
 * Safe-zone (measured from the template's inner decorative border + L-corner
 * bracket extent — brackets reach ~25pt along each edge from the corners):
 *   x ∈ [120, W-120]  (≈ 120..722)
 *   y ∈ [100, H-115]  (≈ 100..480)
 */
async function drawSkillsDevelopmentContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta — placed in the OUTER white band that sits between the outer
  //    tan/gold border and the thin inner navy frame line (per client spec).
  //    y=H-62 puts the text cleanly in that 25pt-tall gap, well above all L-
  //    corner brackets and the brand title below.
  drawText(page, 'Reg. by Govt. of India', {
    x: 100, y: H - 62, size: 9, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 100, y: H - 62, size: 9, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title "UNSKILLS COMPUTER EDUCATION" — UNSKILLS red, rest black.
  drawBrandTitle(page, {
    cx, y: H - 128, size: 26, font: fonts.display,
    leading: '', accent: 'UNSKILLS', trailing: ' COMPUTER EDUCATION',
    baseColor: C.black, accentColor: C.red,
  })

  // 3. Teal ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoSize = 11
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize) + 28
  drawRect(page, cx - isoW / 2, H - 170, isoW, 18, C.teal)
  drawText(page, isoText, {
    x: cx, y: H - 165, size: isoSize, font: fonts.bodyBold, color: C.white, align: 'center',
  })

  // 4. Three sub-header lines (govt + affiliation text block)
  let subY = H - 188
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) {
      drawText(page, line, {
        x: cx, y: subY, size: 8, font: fonts.body, color: C.textDark, align: 'center',
      })
    }
    subY -= 11
  }

  // 5. Branch logo (left) + student photo (right)
  const logoY = H - 300
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 120, y: logoY, width: 80, height: 80 })
  }
  const photoW = 80, photoH = 95
  const photoX = W - 120 - photoW
  const photoY = H - 310
  // Only draw the photo frame if there's actually a photo — no placeholder.
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      drawRect(page, photoX - 1, photoY - 1, photoW + 2, photoH + 2, C.white, C.teal, 1)
      page.drawImage(photo, { x: photoX, y: photoY, width: photoW, height: photoH })
    }
  }

  // 6. Certificate title — elegant serif italic (Times Roman Bold Italic,
  // Standard PDF font so there's no external embed to fail). Client directive:
  // "professional cursive / calligraphic serif" — NOT handwritten script.
  drawText(page, 'Certificate of Qualification', {
    x: cx, y: H - 238, size: 30, font: fonts.serifItalic, color: C.teal, align: 'center',
  })
  // Gold diamond divider echoes the frame's accent diamonds.
  drawDivider(page, cx, H - 252, 95, C.gold, C.red)

  // 7. Body — 9 lines with breathing room (bStep=15). Starts at H-265 so the
  // last line lands at ~207, leaving a comfortable 10pt gap above the sig line.
  let bodyY = H - 265
  const bStep = 15
  drawText(page, 'This is to certify that', {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
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
    x: cx, y: bodyY, size: 12.5, font: fonts.bodyBold, color: C.teal, align: 'center',
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

  // 8. QR + "Certificate No." teal pill (auto-width) + "Date of Issue"
  const qrSize = 52
  const qrX = 128
  const qrY = 155
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  const pillX = qrX + qrSize + 8
  const pillY = qrY + qrSize - 24
  const certNoText = `Certificate No. : ${data.certificateNumber}`
  const pillW = fonts.bodyBold.widthOfTextAtSize(certNoText, 10) + 20
  const pillH = 22
  drawRect(page, pillX, pillY, pillW, pillH, C.teal)
  drawText(page, certNoText, {
    x: pillX + pillW / 2, y: pillY + 7, size: 10, font: fonts.bodyBold, color: C.white, align: 'center',
  })
  drawText(page, `Date of Issue : ${data.issueDate}`, {
    x: pillX, y: pillY - 16, size: 10, font: fonts.bodyBold, color: C.textDark,
  })

  // 9. Badge row (bottom-center) — first 4 configured badges, evenly spaced.
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const visibleBadges = badges.slice(0, Math.min(4, badges.length))
  if (visibleBadges.length > 0) {
    const badgeY = 160
    const badgeH = 30
    const badgeX0 = 370
    const badgeX1 = W - 270
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
  const sigRight = W - 120
  const sigLeft = sigRight - 150
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 200, width: 110, height: 30 })
  } else if (settings.signatory_name) {
    drawText(page, settings.signatory_name, {
      x: sigRight, y: 207, size: 18, font: fonts.script, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, 197, sigRight, 197, 0.8, C.black)
  drawText(page, settings.signatory_name || 'Er. Ankitvish', {
    x: sigRight, y: 184, size: 10.5, font: fonts.bodyBold, color: C.teal, align: 'right',
  })
  drawText(page, settings.signatory_designation || 'Chief Executive Officer', {
    x: sigRight, y: 171, size: 9.5, font: fonts.bodyBold, align: 'right',
  })
  drawText(page, settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: sigRight, y: 159, size: 8.5, font: fonts.body, align: 'right',
  })

  // 11. Bottom footer stack. This template has no built-in bottom bar, so we
  // paint our own teal verify strip flanked by the corporate address above and
  // the mail line below — keeping everything inside the inner safe zone so the
  // decorative navy/tan border never clips the footer text.
  // Bottom footer: corporate (above strip) → teal verify strip → mail us (below strip).
  // Strip sits at y=113..131 so corporate at y=138 is 7pt above strip top,
  // mail us baseline at y=100 is 13pt below strip bottom — both clear the
  // inner border + L-corner brackets that end at ~y=90.
  const verifyStripH = 18
  const verifyStripY = 113
  if (settings.corporate_office_address) {
    drawText(page, `Corporate Office : ${settings.corporate_office_address}`, {
      x: cx, y: 138, size: 9.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
    })
  }
  // Teal verify strip — echoes the ISO ribbon at top for visual symmetry.
  drawRect(page, 120, verifyStripY, W - 240, verifyStripH, C.teal)
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit : ${settings.verification_url_base}`, {
      x: cx, y: verifyStripY + 5, size: 9, font: fonts.bodyBold, color: C.white, align: 'center',
    })
  }
  if (settings.contact_email) {
    drawText(page, `Mail us : ${settings.contact_email}`, {
      x: cx, y: 100, size: 8.5, font: fonts.body, color: C.textDark, align: 'center',
    })
  }
}

async function generateSkillsDevelopmentCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate(
    '/certificates/skills-development-landscape.jpg',
    A4_LANDSCAPE,
  )
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawSkillsDevelopmentContent(pdfDoc, page, fonts, data, W, H)
  return pdfDoc.save()
}

// ─── Beautician — bespoke landscape layout ────────────────────────────────────

/**
 * Dedicated Beautician landscape certificate. Template has the same structural
 * elements as Skills Development (outer maroon border, rose-gold inner band,
 * thin maroon decorative frame, corner L-brackets, side diamonds) but uses the
 * maroon/rose-gold palette. All content respects the same safe zone so nothing
 * touches the L-corner brackets or inner border lines.
 *
 * Safe-zone: x ∈ [120, W-120], y ∈ [100, H-115]
 */
async function drawBeauticianContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta — placed in the OUTER white band between the rose-gold border
  //    and the inner thin maroon frame line, per client spec ("on the top").
  drawText(page, 'Reg. by Govt. of India', {
    x: 100, y: H - 62, size: 9, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 100, y: H - 62, size: 9, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title — UNSKILLS in maroon, rest black. Lifted to H-128 since
  //    the reg meta is now out of the way in the outer band.
  drawBrandTitle(page, {
    cx, y: H - 128, size: 26, font: fonts.display,
    leading: '', accent: 'UNSKILLS', trailing: ' COMPUTER EDUCATION',
    baseColor: C.black, accentColor: C.maroon,
  })

  // 3. Maroon ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoSize = 11
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize) + 28
  drawRect(page, cx - isoW / 2, H - 170, isoW, 18, C.maroon)
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

  // 5. Branch logo (left) + student photo (right)
  const logoY = H - 300
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 120, y: logoY, width: 80, height: 80 })
  }
  const photoW = 80, photoH = 95
  const photoX = W - 120 - photoW
  const photoY = H - 310
  // Only draw the photo frame if there's actually a photo — no placeholder.
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      drawRect(page, photoX - 1, photoY - 1, photoW + 2, photoH + 2, C.white, C.maroon, 1)
      page.drawImage(photo, { x: photoX, y: photoY, width: photoW, height: photoH })
    }
  }

  // 6. Certificate title — elegant serif italic in maroon.
  drawText(page, 'Certificate of Qualification', {
    x: cx, y: H - 238, size: 30, font: fonts.serifItalic, color: C.maroon, align: 'center',
  })
  drawDivider(page, cx, H - 252, 95, C.roseGold, C.maroon)

  // 7. Body — 9 lines with breathing room (bStep=15, start H-265).
  let bodyY = H - 265
  const bStep = 15
  drawText(page, 'This is to certify that', {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
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
    x: cx, y: bodyY, size: 12.5, font: fonts.bodyBold, color: C.maroon, align: 'center',
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

  // 8. QR + maroon pill (auto-width) + Date of Issue (bottom-left cluster)
  const qrSize = 52
  const qrX = 128
  const qrY = 155
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  const pillX = qrX + qrSize + 8
  const pillY = qrY + qrSize - 24
  const certNoText = `Certificate No. : ${data.certificateNumber}`
  const pillW = fonts.bodyBold.widthOfTextAtSize(certNoText, 10) + 20
  const pillH = 22
  drawRect(page, pillX, pillY, pillW, pillH, C.maroon)
  drawText(page, certNoText, {
    x: pillX + pillW / 2, y: pillY + 7, size: 10, font: fonts.bodyBold, color: C.white, align: 'center',
  })
  drawText(page, `Date of Issue : ${data.issueDate}`, {
    x: pillX, y: pillY - 16, size: 10, font: fonts.bodyBold, color: C.textDark,
  })

  // 9. Badge row (bottom-center)
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const visibleBadges = badges.slice(0, Math.min(4, badges.length))
  if (visibleBadges.length > 0) {
    const badgeY = 160
    const badgeH = 30
    const badgeX0 = 370
    const badgeX1 = W - 270
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
  const sigRight = W - 120
  const sigLeft = sigRight - 150
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 200, width: 110, height: 30 })
  } else if (settings.signatory_name) {
    drawText(page, settings.signatory_name, {
      x: sigRight, y: 207, size: 18, font: fonts.script, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, 197, sigRight, 197, 0.8, C.black)
  drawText(page, settings.signatory_name || 'Er. Ankitvish', {
    x: sigRight, y: 184, size: 10.5, font: fonts.bodyBold, color: C.maroon, align: 'right',
  })
  drawText(page, settings.signatory_designation || 'Chief Executive Officer', {
    x: sigRight, y: 171, size: 9.5, font: fonts.bodyBold, align: 'right',
  })
  drawText(page, settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: sigRight, y: 159, size: 8.5, font: fonts.body, align: 'right',
  })

  // 11. Bottom footer: corporate → maroon verify strip → mail us.
  // All items clear the inner border + L-corner brackets (end at ~y=95).
  const verifyStripH = 18
  const verifyStripY = 113
  if (settings.corporate_office_address) {
    drawText(page, `Corporate Office : ${settings.corporate_office_address}`, {
      x: cx, y: 138, size: 9.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
    })
  }
  drawRect(page, 120, verifyStripY, W - 240, verifyStripH, C.maroon)
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit : ${settings.verification_url_base}`, {
      x: cx, y: verifyStripY + 5, size: 9, font: fonts.bodyBold, color: C.white, align: 'center',
    })
  }
  if (settings.contact_email) {
    drawText(page, `Mail us : ${settings.contact_email}`, {
      x: cx, y: 100, size: 8.5, font: fonts.body, color: C.textDark, align: 'center',
    })
  }
}

async function generateBeauticianCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate(
    '/certificates/beautician-landscape.jpg',
    A4_LANDSCAPE,
  )
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawBeauticianContent(pdfDoc, page, fonts, data, W, H)
  return pdfDoc.save()
}

// ─── Summer Training — bespoke landscape layout ───────────────────────────────

/**
 * Dedicated Summer Training landscape certificate. Template has thick orange/
 * yellow horizontal bands at top and bottom, corner icons ({}, calendar,
 * lightbulb, rocket) on the frame, and orange diamonds at the side midpoints.
 * Content uses the navy + orange palette; a painted navy verify strip at the
 * bottom mirrors the H&N design.
 *
 * Safe-zone: x ∈ [105, W-105], y ∈ [105, H-110]
 */
async function drawSummerTrainingContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta — placed at the very top, just inside the inner white zone
  //    above the corner icons ({} + calendar). Matches the "on the top" spec.
  drawText(page, 'Reg. by Govt. of India', {
    x: 100, y: H - 68, size: 9, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.-${regNoValue}`, {
    x: W - 100, y: H - 68, size: 9, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title — UNSKILLS orange, rest black. Lifted since reg meta now
  //    sits above the corner icons.
  drawBrandTitle(page, {
    cx, y: H - 128, size: 26, font: fonts.display,
    leading: '', accent: 'UNSKILLS', trailing: ' COMPUTER EDUCATION',
    baseColor: C.black, accentColor: C.orange,
  })

  // 3. Navy ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoSize = 11
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize) + 28
  drawRect(page, cx - isoW / 2, H - 170, isoW, 18, C.navy)
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

  // 5. Branch logo (left) + student photo (right)
  const logoY = H - 300
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 115, y: logoY, width: 80, height: 80 })
  }
  const photoW = 80, photoH = 95
  const photoX = W - 115 - photoW
  const photoY = H - 310
  // Only draw the photo frame if there's actually a photo — no placeholder.
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      drawRect(page, photoX - 1, photoY - 1, photoW + 2, photoH + 2, C.white, C.navy, 1)
      page.drawImage(photo, { x: photoX, y: photoY, width: photoW, height: photoH })
    }
  }

  // 6. Certificate title — elegant serif italic in navy.
  drawText(page, 'Certificate of Qualification', {
    x: cx, y: H - 238, size: 30, font: fonts.serifItalic, color: C.navy, align: 'center',
  })
  drawDivider(page, cx, H - 252, 95, C.orange, C.orange)

  // 7. Body — 9 lines with breathing room.
  let bodyY = H - 265
  const bStep = 15
  drawText(page, 'This is to certify that', {
    x: cx, y: bodyY, size: 10.5, font: fonts.body, align: 'center',
  })
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
    x: cx, y: bodyY, size: 12.5, font: fonts.bodyBold, color: C.orange, align: 'center',
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

  // 8. QR + orange pill (auto-width) + Date of Issue (bottom-left cluster)
  const qrSize = 52
  const qrX = 115
  const qrY = 155
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  }
  const pillX = qrX + qrSize + 8
  const pillY = qrY + qrSize - 24
  const certNoText = `Certificate No. : ${data.certificateNumber}`
  const pillW = fonts.bodyBold.widthOfTextAtSize(certNoText, 10) + 20
  const pillH = 22
  drawRect(page, pillX, pillY, pillW, pillH, C.orange)
  drawText(page, certNoText, {
    x: pillX + pillW / 2, y: pillY + 7, size: 10, font: fonts.bodyBold, color: C.white, align: 'center',
  })
  drawText(page, `Date of Issue : ${data.issueDate}`, {
    x: pillX, y: pillY - 16, size: 10, font: fonts.bodyBold, color: C.textDark,
  })

  // 9. Badge row (bottom-center)
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const visibleBadges = badges.slice(0, Math.min(4, badges.length))
  if (visibleBadges.length > 0) {
    const badgeY = 160
    const badgeH = 30
    const badgeX0 = 370
    const badgeX1 = W - 270
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
  const sigRight = W - 115
  const sigLeft = sigRight - 150
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 200, width: 110, height: 30 })
  } else if (settings.signatory_name) {
    drawText(page, settings.signatory_name, {
      x: sigRight, y: 207, size: 18, font: fonts.script, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, 197, sigRight, 197, 0.8, C.black)
  drawText(page, settings.signatory_name || 'Er. Ankitvish', {
    x: sigRight, y: 184, size: 10.5, font: fonts.bodyBold, color: C.navy, align: 'right',
  })
  drawText(page, settings.signatory_designation || 'Chief Executive Officer', {
    x: sigRight, y: 171, size: 9.5, font: fonts.bodyBold, align: 'right',
  })
  drawText(page, settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: sigRight, y: 159, size: 8.5, font: fonts.body, align: 'right',
  })

  // 11. Bottom footer: corporate → navy verify strip → mail us.
  const verifyStripH = 18
  const verifyStripY = 113
  if (settings.corporate_office_address) {
    drawText(page, `Corporate Office : ${settings.corporate_office_address}`, {
      x: cx, y: 138, size: 9.5, font: fonts.bodyBold, color: C.textDark, align: 'center',
    })
  }
  drawRect(page, 115, verifyStripY, W - 230, verifyStripH, C.navy)
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit : ${settings.verification_url_base}`, {
      x: cx, y: verifyStripY + 5, size: 9, font: fonts.bodyBold, color: C.white, align: 'center',
    })
  }
  if (settings.contact_email) {
    drawText(page, `Mail us : ${settings.contact_email}`, {
      x: cx, y: 100, size: 8.5, font: fonts.body, color: C.textDark, align: 'center',
    })
  }
}

async function generateSummerTrainingCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate(
    '/certificates/summer-training-landscape.jpg',
    A4_LANDSCAPE,
  )
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawSummerTrainingContent(pdfDoc, page, fonts, data, W, H)
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

/**
 * Typing Portrait — rebuilt with precise, balanced layout.
 *
 * Safe zone (inside the inner navy frame, clear of the L-corner brackets):
 *   x ∈ [90, W-90], y ∈ [85, H-95]
 *
 * Vertical rhythm (descending y, H = 841.89):
 *   H-100  top meta (Cert No / Reg No)
 *   H-128  brand title (UN SKILLS COMPUTER EDUCATION™)
 *   H-158  ISO ribbon (navy bg, white text)
 *   H-178+ three sub-header lines
 *   H-238  cursive main title "Computer Based Typing Examination"
 *   H-258  gold divider
 *   H-320  candidate 3-column info table (data row bottom)
 *   H-355  "This certificate is Proudly Presented to"
 *   H-378  student name (red bold)
 *   H-400  father name
 *   H-425..H-477  5-line body block (bStep=13)
 *   H-505..H-549  marks table (header + 2 rows)
 *   y=270..226    grade legend (left) + Grade/Date boxes (right)
 *   y=135..205    QR (left) + badges (center) + signature (right)
 *   y=90, 105     footer (mail us + verify URL)
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
  const LEFT = 90
  const RIGHT = W - 90

  // 1. Top meta — safely below the inner frame + L-corner brackets.
  drawText(page, `Certificate No.: ${data.certificateNumber}`, {
    x: LEFT, y: H - 100, size: 8, font: fonts.bodyBold,
  })
  const regNoValue = data.enrollmentNumber || settings.institute_reg_number || '—'
  drawText(page, `Reg. No.: ${regNoValue}`, {
    x: RIGHT, y: H - 100, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title "UN SKILLS COMPUTER EDUCATION™"
  drawBrandTitle(page, {
    cx, y: H - 128, size: 20, font: fonts.display,
    leading: 'UN ', accent: 'SKILLS', trailing: ' COMPUTER EDUCATION',
    baseColor: C.black, accentColor: C.red,
  })

  // 3. ISO ribbon — navy bg, white bold text.
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoSize = 10
  const isoW = fonts.bodyBold.widthOfTextAtSize(isoText, isoSize) + 26
  drawRect(page, cx - isoW / 2, H - 162, isoW, 17, C.navy)
  drawText(page, isoText, {
    x: cx, y: H - 157, size: isoSize, font: fonts.bodyBold, color: C.white, align: 'center',
  })

  // 4. Sub-headers (3 lines)
  let subY = H - 178
  for (const line of [settings.sub_header_line_1, settings.sub_header_line_2, settings.sub_header_line_3]) {
    if (line) {
      drawText(page, line, {
        x: cx, y: subY, size: 8, font: fonts.body, color: C.textDark, align: 'center',
      })
    }
    subY -= 11
  }

  // 5. Main cursive title — GreatVibes (fonts.script). Elegant and readable.
  drawText(page, 'Computer Based Typing Examination', {
    x: cx, y: H - 238, size: 28, font: fonts.script, color: C.navy, align: 'center',
  })
  drawLine(page, cx - 130, H - 258, cx + 130, H - 258, 0.8, C.gold)

  // 6. Candidate 3-column info table
  const tbl1DataY = H - 320   // bottom of data row
  const tbl1H = 22
  const tbl1TotalW = RIGHT - LEFT
  const tbl1Cols = [
    { w: 130, label: 'Enrollment No.', value: data.enrollmentNumber || '—' },
    { w: 110, label: 'Center Code', value: data.trainingCenterCode || '—' },
    { w: tbl1TotalW - 240, label: 'Authorised Training Center Name', value: data.trainingCenterName || '—' },
  ]
  // header row (above data row, gray bg)
  let tbl1X = LEFT
  for (const c of tbl1Cols) {
    drawTableCell(page, {
      x: tbl1X, y: tbl1DataY + tbl1H, w: c.w, h: tbl1H,
      bg: C.tableHeaderBg, borderColor: C.black, borderWidth: 0.6,
      text: c.label, textFont: fonts.bodyBold, textSize: 9,
    })
    tbl1X += c.w
  }
  // data row
  tbl1X = LEFT
  for (const c of tbl1Cols) {
    drawTableCell(page, {
      x: tbl1X, y: tbl1DataY, w: c.w, h: tbl1H,
      borderColor: C.black, borderWidth: 0.6,
      text: c.value, textFont: fonts.bodyBold, textSize: 9, textColor: C.navy,
    })
    tbl1X += c.w
  }

  // 7. Student section intro
  drawText(page, 'This certificate is Proudly Presented to', {
    x: cx, y: H - 355, size: 11, font: fonts.body, color: C.textDark, align: 'center',
  })

  // 8. Student name (red bold, letter-spaced)
  drawText(page, data.studentName.toUpperCase(), {
    x: cx, y: H - 378, size: 18, font: fonts.bodyBold, color: C.red, align: 'center', letterSpacing: 1,
  })

  // 9. Father name
  drawText(page, `${data.fatherPrefix} Mr. ${data.fatherName.toUpperCase()}`, {
    x: cx, y: H - 400, size: 11, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // 10. Branch logo (left) + student photo (right) — flanking the body text.
  const logoSize = 58
  const logoY = 385
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: LEFT, y: logoY, width: logoSize, height: logoSize })
  }
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const pW = 58, pH = 72, pX = RIGHT - pW, pY = 380
      drawRect(page, pX - 1, pY - 1, pW + 2, pH + 2, C.white, C.navy, 1)
      page.drawImage(photo, { x: pX, y: pY, width: pW, height: pH })
    }
  }

  // 11. Body text (5 lines, centered between logo and photo)
  let bodyY = H - 425
  const bStep = 13
  drawText(page, 'has passed in the following subject of the', {
    x: cx, y: bodyY, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'Computer Based Typing Examination', {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: C.navy, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'Designed and developed as per the standard of', {
    x: cx, y: bodyY, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  bodyY -= bStep
  drawText(page, 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })
  bodyY -= bStep
  drawText(page, `held at ${data.trainingCenterName}`, {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: C.textDark, align: 'center',
  })

  // 12. Marks table (5 cols) — falls back to a single row if typingSubjects
  //     wasn't supplied by the caller.
  const subjects: TypingSubjectRow[] = data.typingSubjects && data.typingSubjects.length > 0
    ? data.typingSubjects
    : [{
        subject: data.courseName || 'Typing',
        speedWpm: 0,
        maxMarks: 100,
        minMarks: 30,
        obtainedMarks: data.percentage,
      }]

  const tbl2HeaderY = H - 505   // bottom of header row (spans H-505..H-483)
  const tbl2RowH = 22
  const tbl2TotalW = RIGHT - LEFT
  const tbl2Cols = [
    { w: tbl2TotalW - 4 * 68, label: 'Name of the Subject', key: 'subject', align: 'left' as const },
    { w: 68, label: 'Speed W.P.M.', key: 'speedWpm', align: 'center' as const },
    { w: 68, label: 'Maximum Marks', key: 'maxMarks', align: 'center' as const },
    { w: 68, label: 'Minimum Marks', key: 'minMarks', align: 'center' as const },
    { w: 68, label: 'Marks Obtained', key: 'obtainedMarks', align: 'center' as const },
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
        textSize: 9.5, textColor: c.key === 'subject' ? C.navy : C.textDark,
        textAlign: c.align, padX: 6,
      })
      x += c.w
    }
  }

  // 13. Grade legend (left) + Grade/Date boxes (right)
  //     Positioned between the marks table and the bottom cluster.
  const gradeLegendTop = 270
  const legendLines = [
    'Grade System',
    'A+ : 85% & Above',
    'A  : 75% to 84%',
    'B  : 60% to 74%',
    'C  : 40% to 59%',
  ]
  for (let i = 0; i < legendLines.length; i++) {
    drawText(page, legendLines[i], {
      x: LEFT, y: gradeLegendTop - i * 11, size: 8.5,
      font: i === 0 ? fonts.bodyBold : fonts.body,
      color: C.textDark,
    })
  }
  // Grade + Date boxes on the right
  const boxW = 180
  const boxH = 22
  const boxX = RIGHT - boxW
  const gradeBoxY = 248
  const dateBoxY = 222
  drawTableCell(page, {
    x: boxX, y: gradeBoxY, w: 80, h: boxH,
    bg: C.red, borderColor: C.black, borderWidth: 0.6,
    text: 'Grade', textFont: fonts.bodyBold, textSize: 10, textColor: C.white,
  })
  drawTableCell(page, {
    x: boxX + 80, y: gradeBoxY, w: boxW - 80, h: boxH,
    borderColor: C.black, borderWidth: 0.6,
    text: data.grade, textFont: fonts.bodyBold, textSize: 12, textColor: C.navy,
  })
  drawTableCell(page, {
    x: boxX, y: dateBoxY, w: 80, h: boxH,
    bg: C.red, borderColor: C.black, borderWidth: 0.6,
    text: 'Date of Issue', textFont: fonts.bodyBold, textSize: 10, textColor: C.white,
  })
  drawTableCell(page, {
    x: boxX + 80, y: dateBoxY, w: boxW - 80, h: boxH,
    borderColor: C.black, borderWidth: 0.6,
    text: data.issueDate, textFont: fonts.bodyBold, textSize: 10, textColor: C.navy,
  })

  // 14. QR (bottom-left) + signature (bottom-right) + badges (center).
  const qrSize = 55
  const qrY = 135
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, LEFT - 1, qrY - 1, qrSize + 2, qrSize + 2, C.white, C.black, 0.5)
    page.drawImage(qr, { x: LEFT, y: qrY, width: qrSize, height: qrSize })
  }

  // Signature block — right side
  const sigRight = RIGHT
  const sigLeft = sigRight - 150
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 178, width: 110, height: 30 })
  } else if (settings.signatory_name) {
    drawText(page, settings.signatory_name, {
      x: sigRight, y: 185, size: 16, font: fonts.script, color: C.textDark, align: 'right',
    })
  }
  drawLine(page, sigLeft, 172, sigRight, 172, 0.8, C.black)
  drawText(page, settings.signatory_name || 'Er. Ankitvish', {
    x: sigRight, y: 160, size: 10, font: fonts.bodyBold, color: C.navy, align: 'right',
  })
  drawText(page, settings.signatory_designation || 'Chief Executive Officer', {
    x: sigRight, y: 148, size: 9, font: fonts.bodyBold, align: 'right',
  })
  drawText(page, settings.signatory_company_line || 'UnSkills FuturePath Tech Pvt. Ltd.', {
    x: sigRight, y: 137, size: 8, font: fonts.body, color: C.textSecondary, align: 'right',
  })

  // 15. Badge row — centered between QR and signature block.
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const visibleBadges = badges.slice(0, Math.min(5, badges.length))
  if (visibleBadges.length > 0) {
    const badgeH = 22
    const badgeY = 152
    const badgeX0 = LEFT + qrSize + 15
    const badgeX1 = sigLeft - 15
    const badgeSp = (badgeX1 - badgeX0) / visibleBadges.length
    for (let i = 0; i < visibleBadges.length; i++) {
      const img = visibleBadges[i]
      if (!img) continue
      const ar = img.width / img.height
      const w = Math.min(badgeH * ar, badgeSp - 4)
      const h = w / ar
      const bx = badgeX0 + i * badgeSp + badgeSp / 2 - w / 2
      const by = badgeY + (badgeH - h) / 2
      page.drawImage(img, { x: bx, y: by, width: w, height: h })
    }
  }

  // 16. Footer — verify URL + mail us. Sits above the bottom inner frame line
  //     and the pencil/clock corner icons.
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 108, size: 8, font: fonts.bodyBold, color: C.textDark, align: 'center',
    })
  }
  if (settings.contact_email) {
    drawText(page, `Mail us: ${settings.contact_email}`, {
      x: cx, y: 95, size: 7.5, font: fonts.body, color: C.textSecondary, align: 'center',
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
      return generateSkillsDevelopmentCertificate(certData)
    case 'beautician-landscape':
      return generateBeauticianCertificate(certData)
    case 'summer-training-landscape':
      return generateSummerTrainingCertificate(certData)
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
