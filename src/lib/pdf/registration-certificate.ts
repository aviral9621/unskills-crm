import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RegCertBranch {
  name: string | null
  center_logo_url: string | null
  address_line1: string | null
  village: string | null
  block: string | null
  district: string | null
  state: string | null
  pincode: string | null
  director_phone: string | null
}

export interface RegCertStudent {
  registration_no: string
  name: string
  father_name: string | null
  mother_name: string | null
  address: string | null
  village: string | null
  block: string | null
  district: string | null
  state: string | null
  pincode: string | null
  dob: string | null
  gender: string | null
  category: string | null
  religion: string | null
  phone: string | null
  email: string | null
  identity_type: string | null
  aadhar_number: string | null
  admission_date: string | null
  enrollment_date: string | null
  session: string | null
  total_fee: number | null
  net_fee: number | null
  monthly_fee: number | null
  installment_count: number | null
  fee_start_month: string | null
  photo_url: string | null
}

export interface RegCertCourse {
  name: string | null
  duration_label: string | null
  duration_months: number | null
}

export interface RegCertFees {
  amountPaid: number
  paymentDate: string | null
  nextInstallmentDue: string | null
}

export interface BuildRegCertInput {
  student: RegCertStudent
  course: RegCertCourse | null
  branch: RegCertBranch | null
  fees: RegCertFees
  qrDataUrl: string
  /** Resolved branch logo (data URL). */
  branchLogoDataUrl: string
  /** Quality Education seal (data URL). */
  sealDataUrl: string
  /** Optional signatory image (data URL). */
  signatureDataUrl: string
  /** Constant Head Office address line. */
  headOfficeAddress: string
  /** Two contact numbers shown in the header band. */
  headOfficeContacts: string
  /** Top brand title (always reads "UnSkills Computer Education" — institute brand, not branch). */
  brandTitle: string
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  navy:   rgb(0.043, 0.106, 0.247), // #0B1B3F  matches the reference border
  gold:   rgb(0.722, 0.525, 0.043),
  red:    rgb(0.784, 0.063, 0.180),
  ink:    rgb(0.094, 0.094, 0.094),
  muted:  rgb(0.39,  0.39,  0.39),
  hairline: rgb(0.78, 0.78, 0.82),
  panel:  rgb(0.972, 0.972, 0.978),
  white:  rgb(1, 1, 1),
}

// ─── Constants ────────────────────────────────────────────────────────────────

const A4: [number, number] = [595.28, 841.89]   // A4 portrait
const TEMPLATE_PATH = '/registration certificate .pdf'
const SEAL_PATH = '/quality education.png'
const FALLBACK_LOGO = '/MAIN LOGO FOR ALL CARDS.png'

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

async function fetchBytes(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(encodeURI(path))
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/**
 * Fetch any URL (http/https or relative) into a data URL. Falls back to the
 * existing Supabase image-proxy edge function if a CORS error is thrown by the
 * remote host (mirrors the pattern in lib/pdf/marksheet.tsx).
 */
export async function toDataUrl(url: string): Promise<string> {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (res.ok) return await blobToDataUrl(await res.blob())
  } catch { /* fall through to proxy */ }
  const supaUrl = (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL
  if (supaUrl) {
    try {
      const proxied = `${supaUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`
      const res = await fetch(proxied)
      if (res.ok) return await blobToDataUrl(await res.blob())
    } catch { /* ignore */ }
  }
  return ''
}

async function embedAny(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  if (!dataUrl) return null
  try {
    if (dataUrl.includes('image/png')) return await doc.embedPng(dataUrl)
    if (dataUrl.includes('image/jp')) return await doc.embedJpg(dataUrl)
    try { return await doc.embedPng(dataUrl) } catch { return await doc.embedJpg(dataUrl) }
  } catch {
    return null
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  // dd-mm-yyyy to match the reference image (05-11-2011).
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function fmtINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  // pdf-lib's Standard fonts (Helvetica) are WinAnsi-only — the ₹ glyph (U+20B9)
  // would throw "WinAnsi cannot encode". Use "Rs." which renders cleanly.
  return `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.map(p => (p || '').trim()).filter(Boolean).join(', ')
}

function formatBranchAddress(b: RegCertBranch | null | undefined): string {
  if (!b) return ''
  return joinAddress([b.address_line1, b.village, b.block, b.district, b.state, b.pincode])
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

/**
 * Strip characters outside the WinAnsi range (Standard PDF fonts can't encode
 * them and would throw at draw time). We replace the rupee sign explicitly and
 * fall back to "?" for anything else exotic — far better than the entire PDF
 * failing to render because a student's name has a Devanagari character.
 */
function sanitizeWinAnsi(s: string): string {
  if (!s) return s
  return s
    .replace(/₹/g, 'Rs.')          // ₹ → Rs.
    .replace(/[ऀ-ॿ]/g, '')    // strip Devanagari
    .replace(/[^\x00-\xFF]/g, '?')      // any other non-Latin1 → ?
}

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number; y: number; size: number; font: PDFFont
    color?: ReturnType<typeof rgb>
    align?: 'left' | 'center' | 'right'
    maxWidth?: number
    letterSpacing?: number
  },
) {
  if (!text) return
  const { x, y, size, font, color = C.ink, align = 'left', maxWidth, letterSpacing = 0 } = opts
  let str = sanitizeWinAnsi(text)
  if (maxWidth) {
    while (font.widthOfTextAtSize(str, size) > maxWidth && str.length > 1) {
      str = str.slice(0, -1)
    }
    if (str !== text) str = str.slice(0, Math.max(1, str.length - 1)) + '…'
  }
  if (letterSpacing > 0) {
    const chars = str.split('')
    const totalW = chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size) + letterSpacing, 0) - letterSpacing
    let cx = align === 'center' ? x - totalW / 2 : align === 'right' ? x - totalW : x
    for (const ch of chars) {
      page.drawText(ch, { x: cx, y, size, font, color })
      cx += font.widthOfTextAtSize(ch, size) + letterSpacing
    }
    return
  }
  const w = font.widthOfTextAtSize(str, size)
  const drawX = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  page.drawText(str, { x: drawX, y, size, font, color })
}

function drawDivider(page: PDFPage, cx: number, y: number, halfLen: number) {
  page.drawLine({ start: { x: cx - halfLen, y }, end: { x: cx - 8, y }, thickness: 0.7, color: C.gold })
  page.drawRectangle({ x: cx - 3, y: y - 3, width: 6, height: 6, color: C.gold, rotate: degrees(45) })
  page.drawLine({ start: { x: cx + 8, y }, end: { x: cx + halfLen, y }, thickness: 0.7, color: C.gold })
}

/**
 * Section pill — navy rounded ribbon with gold borders, used for STUDENT
 * INFORMATION / COURSE INFORMATION / FEE DETAILS headers.
 */
function drawSectionPill(page: PDFPage, cx: number, y: number, label: string, font: PDFFont) {
  const pillW = 220, pillH = 22
  const x = cx - pillW / 2
  page.drawRectangle({ x, y, width: pillW, height: pillH, color: C.navy })
  // Gold side caps to evoke the chevron look in the reference
  const cap = pillH
  page.drawRectangle({ x: x - 4, y: y + 2, width: 4, height: pillH - 4, color: C.gold })
  page.drawRectangle({ x: x + pillW, y: y + 2, width: 4, height: pillH - 4, color: C.gold })
  page.drawLine({ start: { x, y: y + cap }, end: { x: x + pillW, y: y + cap }, thickness: 0.5, color: C.gold })
  drawText(page, label, {
    x: cx, y: y + 6, size: 10.5, font, color: C.white, align: 'center', letterSpacing: 1,
  })
}

// ─── Template / fonts ─────────────────────────────────────────────────────────

async function makeDocWithTemplate(): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(A4)
  const [W, H] = A4
  const bytes = await fetchBytes(TEMPLATE_PATH)
  if (!bytes) return doc
  try {
    const [embedded] = await doc.embedPdf(bytes, [0])
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
  } catch { /* leave blank — content still renders */ }
  return doc
}

interface FontSet {
  body: PDFFont
  bodyBold: PDFFont
  serifBold: PDFFont
  serifItalicBold: PDFFont
}

async function loadFonts(doc: PDFDocument): Promise<FontSet> {
  doc.registerFontkit(fontkit)
  const body = await doc.embedFont(StandardFonts.Helvetica)
  const bodyBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const serifItalicBold = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  return { body, bodyBold, serifBold, serifItalicBold }
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * The supplied `registration certificate .pdf` template already paints the
 * navy + gold border. We draw all the content INSIDE the safe zone:
 *   x ∈ [50, W-50], y ∈ [40, H-40]
 *
 * The Y-coordinates below are picked to land neatly on top of the template's
 * decorative bands. If the template is ever swapped, only these constants need
 * to move.
 */
async function paintContent(
  doc: PDFDocument,
  page: PDFPage,
  fonts: FontSet,
  data: BuildRegCertInput,
) {
  const [W, H] = A4
  const cx = W / 2

  // ─── Header band (navy backdrop matches the template) ────────────────────
  // Logo circle (left, ~ x:60 y: H-110, d:80)
  const logoImg = data.branchLogoDataUrl
    ? await embedAny(doc, data.branchLogoDataUrl)
    : null
  if (logoImg) {
    // The template already has a gold ring; we draw a white circle inside,
    // then the logo so transparency works.
    const r = 36
    const lx = 92, ly = H - 95
    page.drawCircle({ x: lx, y: ly, size: r, color: C.white })
    const dim = r * 1.65
    page.drawImage(logoImg, { x: lx - dim / 2, y: ly - dim / 2, width: dim, height: dim })
  }

  // Centre brand block
  const brandY = H - 70
  drawText(page, data.brandTitle.toUpperCase(), {
    x: cx + 18, y: brandY, size: 17, font: fonts.bodyBold, color: C.navy, align: 'center', letterSpacing: 0.3,
  })
  // 3-line address block (left-aligned within centre column)
  const addrX = 175
  const branchAddrLine = formatBranchAddress(data.branch) || data.headOfficeAddress
  drawText(page, 'Head Office', { x: addrX, y: brandY - 16, size: 7.5, font: fonts.bodyBold, color: C.ink })
  drawText(page, ':', { x: addrX + 60, y: brandY - 16, size: 7.5, font: fonts.body, color: C.ink })
  drawText(page, data.headOfficeAddress, { x: addrX + 68, y: brandY - 16, size: 7.5, font: fonts.body, color: C.ink, maxWidth: 240 })

  drawText(page, 'Branch Office', { x: addrX, y: brandY - 28, size: 7.5, font: fonts.bodyBold, color: C.ink })
  drawText(page, ':', { x: addrX + 60, y: brandY - 28, size: 7.5, font: fonts.body, color: C.ink })
  drawText(page, branchAddrLine, { x: addrX + 68, y: brandY - 28, size: 7.5, font: fonts.body, color: C.ink, maxWidth: 240 })

  drawText(page, 'Contact No.', { x: addrX, y: brandY - 40, size: 7.5, font: fonts.bodyBold, color: C.ink })
  drawText(page, ':', { x: addrX + 60, y: brandY - 40, size: 7.5, font: fonts.body, color: C.ink })
  const contacts = data.branch?.director_phone
    ? `${data.branch.director_phone}${data.headOfficeContacts ? `, ${data.headOfficeContacts}` : ''}`
    : data.headOfficeContacts
  drawText(page, contacts, { x: addrX + 68, y: brandY - 40, size: 7.5, font: fonts.body, color: C.ink, maxWidth: 240 })

  // Right meta — Registration No.
  const metaX = W - 120
  drawText(page, 'Registration No.', { x: metaX, y: brandY - 12, size: 9, font: fonts.bodyBold, color: C.ink, align: 'center' })
  drawText(page, data.student.registration_no || '—', {
    x: metaX, y: brandY - 28, size: 11.5, font: fonts.bodyBold, color: C.red, align: 'center',
  })

  // Divider with diamond, just under the header
  drawDivider(page, cx, H - 145, 200)

  // ─── Title ───────────────────────────────────────────────────────────────
  drawText(page, 'REGISTRATION CERTIFICATE', {
    x: cx, y: H - 195, size: 30, font: fonts.serifItalicBold, color: C.navy, align: 'center', letterSpacing: 0.5,
  })
  drawText(page, 'This is to certify that the following student has been registered with', {
    x: cx, y: H - 220, size: 9.5, font: fonts.body, color: C.muted, align: 'center',
  })
  drawText(page, data.brandTitle, {
    x: cx, y: H - 234, size: 11, font: fonts.bodyBold, color: C.ink, align: 'center',
  })
  drawText(page, 'for the selected course and academic session.', {
    x: cx, y: H - 248, size: 9, font: fonts.body, color: C.muted, align: 'center',
  })

  // ─── STUDENT INFORMATION ─────────────────────────────────────────────────
  const studentBoxTop = H - 270
  drawSectionPill(page, cx, studentBoxTop - 14, 'STUDENT INFORMATION', fonts.bodyBold)

  const studentBoxY = studentBoxTop - 200
  // Outer panel
  page.drawRectangle({
    x: 55, y: studentBoxY, width: W - 110, height: 192,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.6,
  })

  // Photo box (right)
  const photoX = W - 130, photoY = studentBoxY + 30
  const photoW = 70, photoH = 90
  page.drawRectangle({
    x: photoX, y: photoY, width: photoW, height: photoH,
    color: C.white, borderColor: C.hairline, borderWidth: 0.6,
  })
  if (data.student.photo_url) {
    const photoData = await toDataUrl(data.student.photo_url)
    const photoImg = await embedAny(doc, photoData)
    if (photoImg) {
      page.drawImage(photoImg, { x: photoX + 1, y: photoY + 1, width: photoW - 2, height: photoH - 2 })
    } else {
      drawText(page, 'PHOTO', { x: photoX + photoW / 2, y: photoY + photoH / 2 - 4, size: 8, font: fonts.body, color: C.muted, align: 'center' })
    }
  } else {
    drawText(page, 'PHOTO', { x: photoX + photoW / 2, y: photoY + photoH / 2 - 4, size: 8, font: fonts.body, color: C.muted, align: 'center' })
  }

  // Two-column field grid (left half single col, right half two-up)
  const labelX = 70
  const sepX = 175
  const valueX = 180
  const lineH = 17
  const fieldsTop = studentBoxY + 175

  function row(i: number, label: string, value: string, fullWidth = false): void {
    const ly = fieldsTop - i * lineH
    drawText(page, label, { x: labelX, y: ly, size: 8.5, font: fonts.bodyBold, color: C.ink })
    drawText(page, ':', { x: sepX, y: ly, size: 8.5, font: fonts.body, color: C.ink })
    drawText(page, value || '—', {
      x: valueX, y: ly, size: 8.5, font: fonts.body, color: C.ink,
      maxWidth: fullWidth ? W - 250 : 200,
    })
  }

  // Split row helper — value column on left + a second label/value to the right.
  function splitRow(
    i: number,
    leftLabel: string, leftValue: string,
    rightLabel: string, rightValue: string,
  ): void {
    const ly = fieldsTop - i * lineH
    drawText(page, leftLabel, { x: labelX, y: ly, size: 8.5, font: fonts.bodyBold, color: C.ink })
    drawText(page, ':', { x: sepX, y: ly, size: 8.5, font: fonts.body, color: C.ink })
    drawText(page, leftValue || '—', { x: valueX, y: ly, size: 8.5, font: fonts.body, color: C.ink, maxWidth: 90 })

    const r1 = 290, r2 = 360, r3 = 365
    drawText(page, rightLabel, { x: r1, y: ly, size: 8.5, font: fonts.bodyBold, color: C.ink })
    drawText(page, ':', { x: r2, y: ly, size: 8.5, font: fonts.body, color: C.ink })
    drawText(page, rightValue || '—', { x: r3, y: ly, size: 8.5, font: fonts.body, color: C.ink, maxWidth: 100 })
  }

  const stu = data.student
  const studentAddress = joinAddress([stu.address, stu.village, stu.block])
  row(0, "Student's Name", stu.name)
  row(1, "Father's Name", stu.father_name || '—')
  row(2, "Mother's Name", stu.mother_name || '—')
  row(3, 'Address', studentAddress, true)
  splitRow(4, 'State', stu.state || 'Uttar Pradesh', 'District', stu.district || '—')
  splitRow(5, 'Date of Birth', fmtDate(stu.dob), 'Gender', stu.gender || '—')
  splitRow(6, 'Category', stu.category || '—', 'Religion', stu.religion || '—')
  splitRow(7, 'Mobile No.', stu.phone || '—', 'Email', stu.email || '—')
  row(8, 'Qualification', '—')
  splitRow(9, 'Identity Type', stu.identity_type || 'Aadhar Card', 'ID Number', stu.aadhar_number || '—')
  row(10, 'Admission Date', fmtDate(stu.admission_date || stu.enrollment_date))

  // Horizontal divider before COURSE INFORMATION
  page.drawLine({ start: { x: 55, y: studentBoxY }, end: { x: W - 55, y: studentBoxY }, thickness: 0.6, color: C.hairline })

  // ─── COURSE INFORMATION ──────────────────────────────────────────────────
  const courseY = studentBoxY - 36
  drawSectionPill(page, cx, courseY, 'COURSE INFORMATION', fonts.bodyBold)
  const courseTop = courseY - 22
  page.drawRectangle({
    x: 55, y: courseTop - 60, width: W - 110, height: 60,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.6,
  })
  drawText(page, 'Course Name', { x: 70, y: courseTop - 18, size: 8.5, font: fonts.bodyBold, color: C.ink })
  drawText(page, ':', { x: 175, y: courseTop - 18, size: 8.5, font: fonts.body, color: C.ink })
  drawText(page, data.course?.name || '—', { x: 180, y: courseTop - 18, size: 8.5, font: fonts.body, color: C.ink, maxWidth: W - 250 })

  drawText(page, 'Course Duration', { x: 70, y: courseTop - 35, size: 8.5, font: fonts.bodyBold, color: C.ink })
  drawText(page, ':', { x: 175, y: courseTop - 35, size: 8.5, font: fonts.body, color: C.ink })
  drawText(page, data.course?.duration_label || (data.course?.duration_months ? `${data.course.duration_months} Months` : '—'), {
    x: 180, y: courseTop - 35, size: 8.5, font: fonts.body, color: C.ink,
  })

  drawText(page, 'Session', { x: 70, y: courseTop - 52, size: 8.5, font: fonts.bodyBold, color: C.ink })
  drawText(page, ':', { x: 175, y: courseTop - 52, size: 8.5, font: fonts.body, color: C.ink })
  drawText(page, stu.session || '—', { x: 180, y: courseTop - 52, size: 8.5, font: fonts.body, color: C.ink })

  // ─── FEE DETAILS ─────────────────────────────────────────────────────────
  const feeY = courseTop - 60 - 30
  drawSectionPill(page, cx, feeY, 'FEE DETAILS', fonts.bodyBold)
  const feeTop = feeY - 22
  const feeBoxH = 78
  page.drawRectangle({
    x: 55, y: feeTop - feeBoxH, width: W - 110, height: feeBoxH,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.6,
  })

  // Two columns of 4 rows each
  const colL = { label: 70, sep: 175, value: 180 }
  const colR = { label: 320, sep: 425, value: 430 }
  const fLineH = 16
  const fy = feeTop - 14

  function feeRow(i: number, c: { label: number; sep: number; value: number }, label: string, value: string) {
    const ly = fy - i * fLineH
    drawText(page, label, { x: c.label, y: ly, size: 8.5, font: fonts.bodyBold, color: C.ink })
    drawText(page, ':', { x: c.sep, y: ly, size: 8.5, font: fonts.body, color: C.ink })
    drawText(page, value || '—', { x: c.value, y: ly, size: 8.5, font: fonts.body, color: C.ink, maxWidth: 150 })
  }

  const totalFee = stu.net_fee ?? stu.total_fee ?? 0
  const due = Math.max(totalFee - data.fees.amountPaid, 0)
  const months = stu.installment_count ? `${stu.installment_count} Months` : '—'

  feeRow(0, colL, 'Total Fees', fmtINR(totalFee))
  feeRow(1, colL, 'Fee Start Date', fmtDate(stu.fee_start_month))
  feeRow(2, colL, 'Total Installments', months)
  feeRow(3, colL, 'Monthly Fee', fmtINR(stu.monthly_fee))

  feeRow(0, colR, 'Amount Paid', fmtINR(data.fees.amountPaid))
  feeRow(1, colR, 'Payment Date', fmtDate(data.fees.paymentDate))
  feeRow(2, colR, 'Due Amount', fmtINR(due))
  feeRow(3, colR, 'Next Installment Due', fmtDate(data.fees.nextInstallmentDue))

  // ─── Footer ──────────────────────────────────────────────────────────────
  const footerY = 70

  // QR (left)
  const qrImg = await embedAny(doc, data.qrDataUrl)
  if (qrImg) {
    page.drawImage(qrImg, { x: 70, y: footerY - 8, width: 60, height: 60 })
  }
  drawText(page, 'This certificate is system generated', {
    x: 100, y: footerY - 22, size: 7.2, font: fonts.body, color: C.muted, align: 'center',
  })
  drawText(page, 'and does not require any signature.', {
    x: 100, y: footerY - 32, size: 7.2, font: fonts.body, color: C.muted, align: 'center',
  })

  // Seal (centre)
  const sealImg = await embedAny(doc, data.sealDataUrl)
  if (sealImg) {
    const sd = 64
    page.drawImage(sealImg, { x: cx - sd / 2, y: footerY - 12, width: sd, height: sd })
  }

  // Signatory (right)
  const sigCx = W - 130
  const sigImg = await embedAny(doc, data.signatureDataUrl)
  if (sigImg) {
    page.drawImage(sigImg, { x: sigCx - 55, y: footerY + 12, width: 110, height: 30 })
  }
  page.drawLine({ start: { x: sigCx - 60, y: footerY + 8 }, end: { x: sigCx + 60, y: footerY + 8 }, thickness: 0.7, color: C.ink })
  drawText(page, 'Authorised Signatory', {
    x: sigCx, y: footerY - 4, size: 9, font: fonts.bodyBold, color: C.ink, align: 'center',
  })
  drawText(page, `( ${data.brandTitle} )`, {
    x: sigCx, y: footerY - 16, size: 8, font: fonts.body, color: C.muted, align: 'center',
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildRegistrationCertificatePdf(input: BuildRegCertInput): Promise<Blob> {
  const doc = await makeDocWithTemplate()
  const fonts = await loadFonts(doc)
  const page = doc.getPages()[0]
  await paintContent(doc, page, fonts, input)
  const bytes = await doc.save()
  // pdf-lib returns Uint8Array — wrap in a Blob for a stable download URL.
  // Slice the buffer so we hand Blob a plain ArrayBuffer (TS lib types reject SharedArrayBuffer / Uint8Array<ArrayBufferLike>).
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}

export const REG_CERT_ASSETS = {
  TEMPLATE_PATH,
  SEAL_PATH,
  FALLBACK_LOGO,
} as const
