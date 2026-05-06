import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, degrees, StandardFonts } from 'pdf-lib'
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
  branchLogoDataUrl: string
  sealDataUrl: string
  signatureDataUrl: string
  headOfficeAddress: string
  headOfficeContacts: string
  brandTitle: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const A4: [number, number] = [595.28, 841.89]
const TEMPLATE_PATH = '/registration certificate .pdf'
const SEAL_PATH = '/quality education.png'
const FALLBACK_LOGO = '/MAIN LOGO FOR ALL CARDS.png'
const NA = 'NA'

const C = {
  navy:        rgb(0.027, 0.114, 0.286),  // #071D49
  navyDeep:    rgb(0.043, 0.122, 0.302),  // #0B1F4D
  gold:        rgb(0.831, 0.686, 0.235),  // #D4AF37
  red:         rgb(0.722, 0.106, 0.094),  // brand red
  ink:         rgb(0.133, 0.133, 0.133),
  inkSoft:     rgb(0.32,  0.32,  0.32),
  hairline:    rgb(0.83,  0.83,  0.86),
  panel:       rgb(0.978, 0.978, 0.984),
  white:       rgb(1, 1, 1),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export async function toDataUrl(url: string): Promise<string> {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (res.ok) return await blobToDataUrl(await res.blob())
  } catch { /* fall through */ }
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
  } catch { return null }
}

function fmtDate(iso: string | null): string {
  if (!iso) return NA
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function fmtINR(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return NA
  return `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.map(p => (p || '').trim()).filter(Boolean).join(', ')
}

function formatBranchAddress(b: RegCertBranch | null | undefined): string {
  if (!b) return ''
  return joinAddress([b.address_line1, b.village, b.block, b.district, b.state, b.pincode])
}

function valueOrNA(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  return s ? s : NA
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function normalize(s: string): string {
  if (!s) return s
  return s.replace(/₹\s*/g, 'Rs. ')
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

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
  const original = normalize(text)
  let str = original
  if (maxWidth) {
    while (font.widthOfTextAtSize(str, size) > maxWidth && str.length > 1) str = str.slice(0, -1)
    if (str.length < original.length) str = str.slice(0, Math.max(1, str.length - 1)) + '…'
  }
  if (letterSpacing > 0) {
    const chars = Array.from(str)
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

/** Section pill — navy ribbon with gold chevron caps. */
function drawSectionPill(page: PDFPage, cx: number, y: number, label: string, font: PDFFont) {
  const pillW = 240, pillH = 20
  const x = cx - pillW / 2
  page.drawRectangle({ x, y, width: pillW, height: pillH, color: C.navy })
  const capW = 12
  page.drawRectangle({ x: x - capW, y: y + 4, width: capW, height: pillH - 8, color: C.gold })
  page.drawRectangle({ x: x + pillW, y: y + 4, width: capW, height: pillH - 8, color: C.gold })
  drawText(page, label.toUpperCase(), {
    x: cx, y: y + 6, size: 10, font, color: C.white, align: 'center', letterSpacing: 1.2,
  })
}

function drawGoldDivider(page: PDFPage, cx: number, y: number, halfLen: number) {
  page.drawLine({ start: { x: cx - halfLen, y }, end: { x: cx - 8, y }, thickness: 0.7, color: C.gold })
  page.drawLine({ start: { x: cx + 8, y }, end: { x: cx + halfLen, y }, thickness: 0.7, color: C.gold })
  page.drawRectangle({ x: cx - 3, y: y - 3, width: 6, height: 6, color: C.gold, rotate: degrees(45) })
}

// ─── Template + fonts ─────────────────────────────────────────────────────────

async function makeDocWithTemplate(): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(A4)
  const [W, H] = A4
  const bytes = await fetchBytes(TEMPLATE_PATH)
  if (!bytes) return doc
  try {
    const [embedded] = await doc.embedPdf(bytes, [0])
    if (embedded) {
      // Stretch the template to the exact page rectangle. Previously we used
      // Math.max(W/tw, H/th) which cropped the top + bottom edges whenever the
      // source PDF wasn't a perfect A4. The decorative border isn't sensitive
      // to a fraction-of-a-percent aspect change but IS sensitive to clipping.
      page.drawPage(embedded, { x: 0, y: 0, width: W, height: H })
    }
  } catch { /* template optional */ }
  return doc
}

interface FontSet {
  serif: PDFFont
  serifItalic: PDFFont
  brand: PDFFont
  pill: PDFFont
  label: PDFFont
  body: PDFFont
  bodyMedium: PDFFont
}

async function loadFonts(doc: PDFDocument): Promise<FontSet> {
  doc.registerFontkit(fontkit)
  async function tryEmbed(path: string): Promise<PDFFont | null> {
    const bytes = await fetchBytes(path)
    if (!bytes) return null
    try { return await doc.embedFont(bytes, { features: { liga: false, dlig: false, clig: false } }) }
    catch { return null }
  }
  const [
    cinzelBold, playfairItalic, montserratBold, montserratSemi,
    poppinsSemi, poppinsReg, poppinsMed,
  ] = await Promise.all([
    tryEmbed('/fonts/Cinzel-Bold.ttf'),
    tryEmbed('/fonts/PlayfairDisplay-Italic-VF.ttf'),
    tryEmbed('/fonts/Montserrat-Bold.ttf'),
    tryEmbed('/fonts/Montserrat-SemiBold.ttf'),
    tryEmbed('/fonts/Poppins-SemiBold.ttf'),
    tryEmbed('/fonts/Poppins-Regular.ttf'),
    tryEmbed('/fonts/Poppins-Medium.ttf'),
  ])
  const fbBold       = await doc.embedFont(StandardFonts.HelveticaBold)
  const fbReg        = await doc.embedFont(StandardFonts.Helvetica)
  const fbItalic     = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fbSerifBold  = await doc.embedFont(StandardFonts.TimesRomanBold)
  return {
    serif:       cinzelBold     ?? fbSerifBold,
    serifItalic: playfairItalic ?? fbItalic,
    brand:       montserratBold ?? fbBold,
    pill:        montserratSemi ?? fbBold,
    label:       poppinsSemi    ?? fbBold,
    body:        poppinsReg     ?? fbReg,
    bodyMedium:  poppinsMed     ?? fbReg,
  }
}

// ─── Content layout ───────────────────────────────────────────────────────────

async function paintContent(doc: PDFDocument, page: PDFPage, f: FontSet, data: BuildRegCertInput) {
  const [W, H] = A4
  const cx = W / 2
  const stu = data.student

  // Safe content area — keeps content well clear of the gold/navy template border.
  const SAFE_X1 = 60
  const SAFE_X2 = W - 60        // 535.28

  /*
   * Y-budget (top → bottom). Numbers add up to 802 < 841.89, so there's
   * comfortable breathing room and the bottom border is never overrun.
   *
   *   30   top margin
   *   88   header band (logo · institute info · reg no)
   *   12   gold rule + gap
   *   80   title + 3-line subtitle
   *   16   gap
   *  204   STUDENT INFORMATION pill (16) + card (188)
   *   16   gap
   *   76   COURSE INFORMATION pill (16) + card (60)
   *   18   gap
   *   84   FEE DETAILS pill (16) + card (68)
   *   22   gap
   *   76   footer (QR · seal · signature)
   *   30   bottom margin
   */

  // ───────── 1. HEADER ─────────────────────────────────────────────────────
  const HEAD_TOP = H - 30                       // 811.89
  const HEAD_H   = 108
  const HEAD_BOT = HEAD_TOP - HEAD_H            // 703.89

  // 1a. Logo (left). Soft gold ring around the brand mark.
  const LOGO_CX = SAFE_X1 + 38
  const LOGO_CY = HEAD_TOP - HEAD_H / 2 - 2
  const logoImg = data.branchLogoDataUrl ? await embedAny(doc, data.branchLogoDataUrl) : null
  if (logoImg) {
    page.drawCircle({ x: LOGO_CX, y: LOGO_CY, size: 33, color: C.gold })
    page.drawCircle({ x: LOGO_CX, y: LOGO_CY, size: 31, color: C.white })
    page.drawImage(logoImg, { x: LOGO_CX - 26, y: LOGO_CY - 26, width: 52, height: 52 })
  }

  // 1b. Institute name — full-width banner across the centre + right area
  //     so "UNSKILLS COMPUTER EDUCATION" never gets truncated.
  const HEADER_TEXT_X1 = SAFE_X1 + 88           // just right of the logo column
  const HEADER_TEXT_X2 = SAFE_X2                // up to the right edge of safe zone
  const HEADER_TEXT_CX = (HEADER_TEXT_X1 + HEADER_TEXT_X2) / 2
  drawText(page, data.brandTitle.toUpperCase(), {
    x: HEADER_TEXT_CX, y: HEAD_TOP - 18, size: 16, font: f.brand, color: C.navy,
    align: 'center', letterSpacing: 0.3, maxWidth: HEADER_TEXT_X2 - HEADER_TEXT_X1 - 4,
  })

  // 1c. Address rows + Registration No. — two columns under the banner.
  //     Head Office / Branch Office can wrap to 2 lines so long addresses
  //     always render in full instead of being truncated with an ellipsis.
  const ADDR_X        = HEADER_TEXT_X1 + 14
  const ADDR_LBL_W    = 68
  const ADDR_VAL_X    = ADDR_X + ADDR_LBL_W + 6
  const REGNO_BLOCK_X = SAFE_X2 - 96
  const ADDR_VAL_W    = REGNO_BLOCK_X - 14 - ADDR_VAL_X
  const ADDR_TOP_Y    = HEAD_TOP - 40
  const ADDR_LINE_H   = 10
  const ADDR_ROW_GAP  = 3
  const ADDR_SIZE     = 8

  const branchAddr = formatBranchAddress(data.branch) || data.headOfficeAddress
  const phoneText = data.branch?.director_phone
    ? `${data.branch.director_phone}, ${data.headOfficeContacts}`
    : data.headOfficeContacts

  let addrCursorY = ADDR_TOP_Y
  addrCursorY = drawWrappedAddrRow(page, f, 'Head Office',   data.headOfficeAddress, ADDR_X, ADDR_LBL_W, ADDR_VAL_X, ADDR_VAL_W, addrCursorY, ADDR_SIZE, ADDR_LINE_H)
  addrCursorY -= ADDR_ROW_GAP
  addrCursorY = drawWrappedAddrRow(page, f, 'Branch Office', branchAddr,             ADDR_X, ADDR_LBL_W, ADDR_VAL_X, ADDR_VAL_W, addrCursorY, ADDR_SIZE, ADDR_LINE_H)
  addrCursorY -= ADDR_ROW_GAP
  drawWrappedAddrRow(page, f, 'Contact No.',  phoneText,              ADDR_X, ADDR_LBL_W, ADDR_VAL_X, ADDR_VAL_W, addrCursorY, ADDR_SIZE, ADDR_LINE_H, 1)

  // Vertical separator between address rows and reg-no column
  page.drawLine({
    start: { x: REGNO_BLOCK_X - 4, y: HEAD_BOT + 10 },
    end:   { x: REGNO_BLOCK_X - 4, y: HEAD_TOP - 30 },
    thickness: 0.5, color: C.hairline,
  })

  drawText(page, 'Registration No.', {
    x: REGNO_BLOCK_X + 48, y: ADDR_TOP_Y, size: 10, font: f.label, color: C.ink, align: 'center',
  })
  drawText(page, valueOrNA(stu.registration_no), {
    x: REGNO_BLOCK_X + 48, y: ADDR_TOP_Y - 18, size: 14, font: f.brand, color: C.red, align: 'center',
  })

  // ───────── 2. GOLD DIVIDER + TITLE BLOCK ─────────────────────────────────
  drawGoldDivider(page, cx, HEAD_BOT - 6, 220)

  const TITLE_Y = HEAD_BOT - 38
  drawText(page, 'REGISTRATION CERTIFICATE', {
    x: cx, y: TITLE_Y, size: 26, font: f.serif, color: C.navyDeep, align: 'center', letterSpacing: 1.2,
  })

  // 3-line subtitle
  drawText(page, 'This is to certify that the following student has been registered with', {
    x: cx, y: TITLE_Y - 24, size: 10, font: f.serifItalic, color: C.inkSoft, align: 'center',
  })
  drawText(page, data.brandTitle, {
    x: cx, y: TITLE_Y - 38, size: 11, font: f.brand, color: C.ink, align: 'center',
  })
  drawText(page, 'for the selected course and academic session.', {
    x: cx, y: TITLE_Y - 52, size: 10, font: f.serifItalic, color: C.inkSoft, align: 'center',
  })

  // ───────── 3. STUDENT INFORMATION ────────────────────────────────────────
  const STU_PILL_Y    = TITLE_Y - 80                      // ~16pt gap below subtitle
  drawSectionPill(page, cx, STU_PILL_Y, 'Student Information', f.pill)

  const STU_CARD_TOP  = STU_PILL_Y - 8
  const STU_CARD_H    = 188
  const STU_CARD_BOT  = STU_CARD_TOP - STU_CARD_H
  page.drawRectangle({
    x: SAFE_X1, y: STU_CARD_BOT, width: SAFE_X2 - SAFE_X1, height: STU_CARD_H,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.7,
  })

  // Photo — passport-ish ratio (35×45mm ≈ 99×127pt). 80×100 keeps the photo
  // visually substantial without crowding the field grid.
  const PHOTO_W = 80, PHOTO_H = 100
  const PHOTO_X = SAFE_X2 - PHOTO_W - 14
  const PHOTO_Y = STU_CARD_TOP - 14 - PHOTO_H
  page.drawRectangle({
    x: PHOTO_X, y: PHOTO_Y, width: PHOTO_W, height: PHOTO_H,
    color: C.white, borderColor: C.hairline, borderWidth: 0.7,
  })
  if (stu.photo_url) {
    const photoImg = await embedAny(doc, await toDataUrl(stu.photo_url))
    if (photoImg) page.drawImage(photoImg, { x: PHOTO_X + 1, y: PHOTO_Y + 1, width: PHOTO_W - 2, height: PHOTO_H - 2 })
  }

  /*
   * Field grid — absolute coordinates, 11 rows × ~15pt = 165pt. The photo only
   * occupies rows 0-4 (PHOTO_H ≈ 5.3 rows tall starting at y = STU_CARD_TOP-14).
   * From row 5 onwards we get the full content width back.
   */
  const ROW_H        = 15
  const FIRST_ROW_Y  = STU_CARD_TOP - 18
  const LBL_X        = SAFE_X1 + 14
  const SEP_X        = LBL_X + 86
  const VAL_X        = SEP_X + 6                              // 166
  const SPLIT_R_LBL  = SAFE_X1 + 178                          // 238
  const SPLIT_R_SEP  = SPLIT_R_LBL + 78                       // 316
  const SPLIT_R_VAL  = SPLIT_R_SEP + 6                        // 322
  const VAL_W_FREE   = SAFE_X2 - 14 - VAL_X                   // when photo not in the way
  const VAL_W_PHOTO  = (PHOTO_X - 10) - VAL_X
  const SPLIT_L_W    = SPLIT_R_LBL - 12 - VAL_X               // ≈ 60pt, fits short tokens
  const SPLIT_R_W_FREE  = SAFE_X2 - 14 - SPLIT_R_VAL          // ≈ 199pt
  const SPLIT_R_W_PHOTO = (PHOTO_X - 10) - SPLIT_R_VAL        // ≈ 137pt
  const FONT_SIZE = 8.5

  // Photo bottom y → which row index the photo no longer overlaps.
  const PHOTO_BOTTOM_Y = PHOTO_Y
  function valWidth(rowIndex: number): number {
    const rowY = FIRST_ROW_Y - rowIndex * ROW_H
    return rowY < PHOTO_BOTTOM_Y ? VAL_W_FREE : VAL_W_PHOTO
  }
  function splitRWidth(rowIndex: number): number {
    const rowY = FIRST_ROW_Y - rowIndex * ROW_H
    return rowY < PHOTO_BOTTOM_Y ? SPLIT_R_W_FREE : SPLIT_R_W_PHOTO
  }

  function row(i: number, label: string, value: string) {
    const ly = FIRST_ROW_Y - i * ROW_H
    drawText(page, label,            { x: LBL_X, y: ly, size: FONT_SIZE, font: f.label, color: C.ink })
    drawText(page, ':',              { x: SEP_X, y: ly, size: FONT_SIZE, font: f.body,  color: C.ink })
    drawText(page, valueOrNA(value), { x: VAL_X, y: ly, size: FONT_SIZE, font: f.body,  color: C.ink, maxWidth: valWidth(i) })
  }
  function splitRow(i: number, lL: string, lV: string, rL: string, rV: string) {
    const ly = FIRST_ROW_Y - i * ROW_H
    drawText(page, lL,             { x: LBL_X, y: ly, size: FONT_SIZE, font: f.label, color: C.ink })
    drawText(page, ':',            { x: SEP_X, y: ly, size: FONT_SIZE, font: f.body,  color: C.ink })
    drawText(page, valueOrNA(lV),  { x: VAL_X, y: ly, size: FONT_SIZE, font: f.body,  color: C.ink, maxWidth: SPLIT_L_W })
    drawText(page, rL,             { x: SPLIT_R_LBL, y: ly, size: FONT_SIZE, font: f.label, color: C.ink })
    drawText(page, ':',            { x: SPLIT_R_SEP, y: ly, size: FONT_SIZE, font: f.body,  color: C.ink })
    drawText(page, valueOrNA(rV),  { x: SPLIT_R_VAL, y: ly, size: FONT_SIZE, font: f.body,  color: C.ink, maxWidth: splitRWidth(i) })
  }

  const studentAddress = joinAddress([stu.address, stu.village, stu.block])
  const stateValue    = stu.state    ? titleCase(stu.state)    : NA
  const districtValue = stu.district ? titleCase(stu.district) : NA
  const genderValue   = stu.gender   ? titleCase(stu.gender)   : NA
  const religionValue = stu.religion ? titleCase(stu.religion) : NA

  row(0, "Student's Name", stu.name)
  row(1, "Father's Name",  stu.father_name || '')
  row(2, "Mother's Name",  stu.mother_name || '')
  row(3, 'Address',        studentAddress)
  splitRow(4, 'State',         stateValue,                'District', districtValue)
  splitRow(5, 'Date of Birth', fmtDate(stu.dob),          'Gender',   genderValue)
  splitRow(6, 'Category',      stu.category || '',         'Religion', religionValue)
  splitRow(7, 'Mobile No.',    stu.phone || '',            'Email',    stu.email || '')
  row(8, 'Qualification',  '')
  splitRow(9, 'Identity Type', stu.identity_type || 'Aadhar Card', 'ID Number', stu.aadhar_number || '')
  row(10, 'Admission Date', fmtDate(stu.admission_date || stu.enrollment_date))

  // ───────── 4. COURSE INFORMATION ─────────────────────────────────────────
  const COURSE_PILL_Y = STU_CARD_BOT - 22
  drawSectionPill(page, cx, COURSE_PILL_Y, 'Course Information', f.pill)
  const COURSE_CARD_TOP = COURSE_PILL_Y - 8
  const COURSE_CARD_H = 60
  const COURSE_CARD_BOT = COURSE_CARD_TOP - COURSE_CARD_H
  page.drawRectangle({
    x: SAFE_X1, y: COURSE_CARD_BOT, width: SAFE_X2 - SAFE_X1, height: COURSE_CARD_H,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.7,
  })

  const courseRowY = COURSE_CARD_TOP - 16
  const courseDuration = data.course?.duration_label
    || (data.course?.duration_months ? `${data.course.duration_months} Months` : '')
  drawText(page, 'Course Name',     { x: LBL_X, y: courseRowY,      size: FONT_SIZE, font: f.label, color: C.ink })
  drawText(page, ':',               { x: SEP_X, y: courseRowY,      size: FONT_SIZE, font: f.body,  color: C.ink })
  drawText(page, valueOrNA(data.course?.name), { x: VAL_X, y: courseRowY, size: FONT_SIZE, font: f.body, color: C.ink, maxWidth: VAL_W_FREE })

  drawText(page, 'Course Duration', { x: LBL_X, y: courseRowY - 16, size: FONT_SIZE, font: f.label, color: C.ink })
  drawText(page, ':',               { x: SEP_X, y: courseRowY - 16, size: FONT_SIZE, font: f.body,  color: C.ink })
  drawText(page, valueOrNA(courseDuration), { x: VAL_X, y: courseRowY - 16, size: FONT_SIZE, font: f.body, color: C.ink })

  drawText(page, 'Session',         { x: LBL_X, y: courseRowY - 32, size: FONT_SIZE, font: f.label, color: C.ink })
  drawText(page, ':',               { x: SEP_X, y: courseRowY - 32, size: FONT_SIZE, font: f.body,  color: C.ink })
  drawText(page, valueOrNA(stu.session), { x: VAL_X, y: courseRowY - 32, size: FONT_SIZE, font: f.body, color: C.ink })

  // ───────── 5. FEE DETAILS ────────────────────────────────────────────────
  const FEE_PILL_Y = COURSE_CARD_BOT - 22
  drawSectionPill(page, cx, FEE_PILL_Y, 'Fee Details', f.pill)
  const FEE_CARD_TOP = FEE_PILL_Y - 8
  const FEE_CARD_H = 68
  const FEE_CARD_BOT = FEE_CARD_TOP - FEE_CARD_H
  page.drawRectangle({
    x: SAFE_X1, y: FEE_CARD_BOT, width: SAFE_X2 - SAFE_X1, height: FEE_CARD_H,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.7,
  })

  const totalFee = stu.net_fee ?? stu.total_fee ?? 0
  const due = Math.max(totalFee - data.fees.amountPaid, 0)
  const monthsLabel = stu.installment_count ? `${stu.installment_count} Months` : NA

  const FEE_TOP_Y = FEE_CARD_TOP - 14
  const FEE_ROW_H = 14
  const FEE_R_LBL = SAFE_X1 + 250
  const FEE_R_SEP = FEE_R_LBL + 100
  const FEE_R_VAL = FEE_R_SEP + 6

  function feeRow(i: number, side: 'L' | 'R', label: string, value: string) {
    const ly = FEE_TOP_Y - i * FEE_ROW_H
    const lblX = side === 'L' ? LBL_X     : FEE_R_LBL
    const sepX = side === 'L' ? SEP_X     : FEE_R_SEP
    const valX = side === 'L' ? VAL_X     : FEE_R_VAL
    drawText(page, label, { x: lblX, y: ly, size: FONT_SIZE, font: f.label,      color: C.ink })
    drawText(page, ':',   { x: sepX, y: ly, size: FONT_SIZE, font: f.body,       color: C.ink })
    drawText(page, value, { x: valX, y: ly, size: FONT_SIZE, font: f.bodyMedium, color: C.ink, maxWidth: 130 })
  }
  feeRow(0, 'L', 'Total Fees',         fmtINR(totalFee))
  feeRow(1, 'L', 'Fee Start Date',     fmtDate(stu.fee_start_month))
  feeRow(2, 'L', 'Total Installments', monthsLabel)
  feeRow(3, 'L', 'Monthly Fee',        fmtINR(stu.monthly_fee))
  feeRow(0, 'R', 'Amount Paid',        fmtINR(data.fees.amountPaid))
  feeRow(1, 'R', 'Payment Date',       fmtDate(data.fees.paymentDate))
  feeRow(2, 'R', 'Due Amount',         fmtINR(due))
  feeRow(3, 'R', 'Next Installment Due', fmtDate(data.fees.nextInstallmentDue))

  // ───────── 6. FOOTER ─────────────────────────────────────────────────────
  // All three columns share a common BOTTOM baseline (FOOTER_BASE) so the
  // QR + caption stack, the seal, and the signature stack all visually anchor
  // to the same horizontal line. The seal is intentionally a touch larger so
  // it reads as the visual centerpiece.
  const FOOTER_BASE = 72                           // bottom y where all stacks land

  // ── Left column: QR + caption stacked vertically ──
  const QR_SIZE = 50
  const QR_X = SAFE_X1 + 18
  const CAP_LINE2_Y = FOOTER_BASE                  // 72
  const CAP_LINE1_Y = CAP_LINE2_Y + 9              // 81
  const QR_Y = CAP_LINE1_Y + 7                     // 88 — QR sits 7pt above the caption
  const qrImg = await embedAny(doc, data.qrDataUrl)
  if (qrImg) page.drawImage(qrImg, { x: QR_X, y: QR_Y, width: QR_SIZE, height: QR_SIZE })
  // Caption sits BELOW the QR, centred horizontally on the QR
  drawText(page, 'This certificate is system generated', {
    x: QR_X + QR_SIZE / 2, y: CAP_LINE1_Y, size: 6.5, font: f.body, color: C.inkSoft, align: 'center',
  })
  drawText(page, 'and does not require any signature.', {
    x: QR_X + QR_SIZE / 2, y: CAP_LINE2_Y, size: 6.5, font: f.body, color: C.inkSoft, align: 'center',
  })

  // ── Centre column: Quality Education seal — slightly bigger ──
  const SEAL_SIZE = 84
  const SEAL_Y = FOOTER_BASE - 4                   // sits 4pt below the baseline
  const sealImg = await embedAny(doc, data.sealDataUrl)
  if (sealImg) {
    page.drawImage(sealImg, {
      x: cx - SEAL_SIZE / 2, y: SEAL_Y,
      width: SEAL_SIZE, height: SEAL_SIZE,
    })
  }

  // ── Right column: signature image · line · "Authorised Signatory" · brand ──
  const SIG_RIGHT = SAFE_X2 - 14
  const SIG_LEFT  = SIG_RIGHT - 160
  const SIG_BRAND_Y = FOOTER_BASE                  // 72 — aligns with QR caption line 2
  const SIG_AUTH_Y  = SIG_BRAND_Y + 12             // 84
  const SIG_LINE_Y  = SIG_AUTH_Y + 9               // 93 — line just above the labels
  const SIG_IMG_BOTTOM = SIG_LINE_Y + 3            // 96 — image bottom 3pt above the line
  const SIG_IMG_HEIGHT = 28
  const sigImg = await embedAny(doc, data.signatureDataUrl)
  if (sigImg) {
    page.drawImage(sigImg, {
      x: SIG_LEFT + 28, y: SIG_IMG_BOTTOM,
      width: 104, height: SIG_IMG_HEIGHT,
    })
  }
  page.drawLine({
    start: { x: SIG_LEFT + 6,  y: SIG_LINE_Y },
    end:   { x: SIG_RIGHT - 6, y: SIG_LINE_Y },
    thickness: 0.7, color: C.ink,
  })
  drawText(page, 'Authorised Signatory', {
    x: (SIG_LEFT + SIG_RIGHT) / 2, y: SIG_AUTH_Y, size: 9, font: f.label, color: C.ink, align: 'center',
  })
  drawText(page, `( ${data.brandTitle} )`, {
    x: (SIG_LEFT + SIG_RIGHT) / 2, y: SIG_BRAND_Y, size: 7.5, font: f.body, color: C.inkSoft, align: 'center',
  })
}

/**
 * Draws a header address row that wraps its value to up to `maxLines` lines.
 * Returns the y position immediately below the rendered block so callers can
 * stack subsequent rows directly underneath.
 */
function drawWrappedAddrRow(
  page: PDFPage,
  f: FontSet,
  label: string,
  value: string,
  labelX: number,
  labelW: number,
  valueX: number,
  valueW: number,
  topY: number,
  size: number,
  lineH: number,
  maxLines = 2,
): number {
  drawText(page, label, { x: labelX,            y: topY, size, font: f.label, color: C.ink })
  drawText(page, ':',   { x: labelX + labelW,   y: topY, size, font: f.body,  color: C.ink })

  const text = value || NA
  // Word-wrap the value into up to `maxLines` lines.
  const norm = text.replace(/₹\s*/g, 'Rs. ')
  const words = norm.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (f.body.widthOfTextAtSize(test, size) <= valueW) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
    if (lines.length >= maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)

  // If we still have leftover text, append "…" to the last visible line.
  const consumed = lines.join(' ').length + (lines.length - 1)
  if (consumed < norm.length && lines.length > 0) {
    let last = lines[lines.length - 1]
    while (f.body.widthOfTextAtSize(last + '…', size) > valueW && last.length > 1) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }

  let cy = topY
  for (const line of lines) {
    page.drawText(line, { x: valueX, y: cy, size, font: f.body, color: C.ink })
    cy -= lineH
  }
  return cy
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildRegistrationCertificatePdf(input: BuildRegCertInput): Promise<Blob> {
  const doc = await makeDocWithTemplate()
  const fonts = await loadFonts(doc)
  const page = doc.getPages()[0]
  await paintContent(doc, page, fonts, input)
  const bytes = await doc.save()
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buf], { type: 'application/pdf' })
}

export const REG_CERT_ASSETS = {
  TEMPLATE_PATH,
  SEAL_PATH,
  FALLBACK_LOGO,
} as const
