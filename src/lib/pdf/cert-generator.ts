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

/**
 * Builds a fresh A4 doc whose first page is painted with the template PDF's
 * first page (scaled to fill). Our Canva exports are 2631×1860 — this
 * normalizes them to A4 so the hardcoded layout coordinates remain valid.
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

// ─── Computer Software Courses — landscape ────────────────────────────────────

/**
 * Layout respects the template's tech-themed decorations:
 *   - Top-left: 2 blue squares (small zone)
 *   - Top-right: circuit traces + blue dots (~H*0.42 × ~H*0.34 in native size,
 *     normalized to x > W-250, y > H-200 in A4 terms)
 *   - Bottom-left: circuit traces (x < 200, y < 200)
 *   - Bottom-right: hexagon cluster (x > W-260, y < 220)
 *
 * All dynamic content stays inside the "safe window" bounded by these zones.
 */
async function drawComputerSoftwareContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: LandscapeCertData,
  W: number,
  H: number,
) {
  const { settings } = data
  const cx = W / 2

  // 1. Top meta — inside top bar but clear of TR circuit (x < W - 260)
  drawText(page, 'Reg. by Govt. of India', {
    x: 130, y: H - 72, size: 8, font: fonts.bodyBold,
  })
  drawText(page, `Reg. No.-${settings.institute_reg_number ?? '—'}`, {
    x: W - 270, y: H - 72, size: 8, font: fonts.bodyBold, align: 'right',
  })

  // 2. Brand title
  drawBrandTitle(page, { cx, y: H - 100, size: 21, font: fonts.display })

  // 3. ISO ribbon
  const isoText = 'An ISO 9001:2015 Certified Organization'
  const isoFontSize = 9
  const isoTextW = fonts.bodyBold.widthOfTextAtSize(isoText, isoFontSize)
  const isoW = isoTextW + 24
  drawRect(page, cx - isoW / 2, H - 132, isoW, 16, C.black)
  drawText(page, isoText, {
    x: cx, y: H - 128, size: isoFontSize, font: fonts.bodyBold, color: C.white, align: 'center',
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
    x: cx, y: H - 212, size: 34, font: fonts.script, color: C.navy, align: 'center',
  })

  // 6. Divider
  drawDivider(page, cx, H - 224, 95)

  // 7. Presented to
  drawRect(page, cx - 110, H - 247, 4, 4, C.navy)
  drawText(page, 'This Certificate Is Proudly Presented To', {
    x: cx, y: H - 249, size: 10, font: fonts.body, color: C.textDark, align: 'center',
  })
  drawRect(page, cx + 106, H - 247, 4, 4, C.navy)

  // 8. Student name
  const heroName = `${data.salutation} ${data.studentName}`.toUpperCase()
  drawText(page, heroName, {
    x: cx, y: H - 280, size: 18, font: fonts.bodyBold, color: C.navy, align: 'center', letterSpacing: 1.5,
  })

  // 9. Body — keep narrow so it clears side decorations
  let bodyY = H - 305
  const bStep = 15
  drawText(page, 'has successfully attended the', { x: cx, y: bodyY, size: 10, font: fonts.body, align: 'center' })
  bodyY -= bStep
  drawText(page, `${data.courseCode} – ${data.courseName}`, {
    x: cx, y: bodyY, size: 11, font: fonts.bodyBold, color: C.navy, align: 'center',
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

  // 10. Training center logo (left, below header meta, above bottom-left circuit)
  if (data.trainingCenterLogoUrl) {
    const logo = await embedAny(pdfDoc, data.trainingCenterLogoUrl)
    if (logo) page.drawImage(logo, { x: 140, y: H - 320, width: 60, height: 60 })
  }

  // 11. Student photo (right) — kept clear of TR circuit (y < H - 200) and BR hexagons (y > 220)
  if (data.studentPhotoUrl) {
    const photo = await embedAny(pdfDoc, data.studentPhotoUrl)
    if (photo) {
      const pW = 70, pH = 80, pX = W - 205, pY = H - 320
      drawRect(page, pX - 1, pY - 1, pW + 2, pH + 2, C.black)
      page.drawImage(photo, { x: pX, y: pY, width: pW, height: pH })
    }
  }

  // 12. Certificate number + QR (bottom-left) — starts at x=220 to clear BL circuit
  const certBlockX = 220
  drawText(page, 'CERTIFICATE NUMBER', { x: certBlockX, y: 165, size: 8, font: fonts.bodyBold })
  drawText(page, data.certificateNumber, {
    x: certBlockX, y: 148, size: 13, font: fonts.bodyBold, color: C.navy,
  })
  const qr = await embedAny(pdfDoc, data.qrCodeDataUrl)
  if (qr) {
    drawRect(page, certBlockX - 1, 99, 52, 52, C.white, C.black, 0.5)
    page.drawImage(qr, { x: certBlockX, y: 100, width: 50, height: 50 })
  }
  if (settings.contact_email) drawText(page, settings.contact_email, {
    x: certBlockX + 60, y: 135, size: 8, font: fonts.body,
  })
  if (settings.website) drawText(page, settings.website, {
    x: certBlockX + 60, y: 122, size: 8, font: fonts.body,
  })

  // 13. Partner logos — strip between cert block and signature block, away from bottom decorations
  const badges = await loadBadges(pdfDoc, data.certificationLogoUrls)
  const partnerBadges = badges.slice(0, 5)
  const partnerAreaX = 400
  const partnerAreaEnd = W - 300
  const partnerAreaW = partnerAreaEnd - partnerAreaX
  const pStep = partnerAreaW / 5
  const pHeight = 28
  const pY = 115
  for (let i = 0; i < partnerBadges.length; i++) {
    const img = partnerBadges[i]
    if (!img) continue
    const ar = img.width / img.height
    const w = pHeight * ar
    const bx = partnerAreaX + i * pStep + pStep / 2 - w / 2
    page.drawImage(img, { x: bx, y: pY, width: w, height: pHeight })
  }

  // 14. Signature (right) — right edge at W - 280 so it clears BR hexagons
  const sigRight = W - 280
  const sigW = 180
  if (settings.signature_image_url) {
    const sig = await embedAny(pdfDoc, settings.signature_image_url)
    if (sig) page.drawImage(sig, { x: sigRight - 110, y: 150, width: 110, height: 28 })
  }
  drawLine(page, sigRight - sigW + 30, 145, sigRight, 145, 0.8, C.black)
  if (settings.signatory_designation) {
    drawText(page, settings.signatory_designation, {
      x: sigRight, y: 130, size: 9.5, font: fonts.bodyBold, align: 'right',
    })
  }
  if (settings.signatory_company_line) {
    drawText(page, settings.signatory_company_line, {
      x: sigRight, y: 117, size: 8.5, font: fonts.body, align: 'right',
    })
  }
  if (settings.signatory_reg_line) {
    drawText(page, settings.signatory_reg_line, {
      x: sigRight, y: 105, size: 7, font: fonts.body, color: C.textSecondary, align: 'right',
    })
  }

  // 15. Badge strip — between x=220 (right of BL circuit) and W-280 (left of BR hexagons)
  const stripY = 72
  const stripH = 18
  const stripX0 = 220
  const stripX1 = W - 280
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

  // 16. Footer — centered, narrow, within safe horizontal band
  if (settings.verification_url_base) {
    drawText(page, `To verify this certificate visit: ${settings.verification_url_base}`, {
      x: cx, y: 55, size: 7.5, font: fonts.body, align: 'center',
    })
  }
}

/**
 * Generator for the Computer Software Courses landscape certificate.
 */
export async function generateComputerSoftwareLandscapeCertificate(
  data: LandscapeCertData,
): Promise<Uint8Array> {
  const pdfDoc = await makeDocWithTemplate(
    '/certificates/computer-software-landscape.pdf',
    A4_LANDSCAPE,
  )
  const fonts = await loadFonts(pdfDoc)
  const page = pdfDoc.getPages()[0]
  const { width: W, height: H } = page.getSize()
  await drawComputerSoftwareContent(pdfDoc, page, fonts, data, W, H)
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
      return generateComputerSoftwareLandscapeCertificate(certData)
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
