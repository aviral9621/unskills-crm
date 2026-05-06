import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, degrees } from 'pdf-lib'
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

// Brand palette (matches the reference UI guide)
const C = {
  navy:        rgb(0.027, 0.114, 0.286),  // #071D49 — institute brand navy
  navyDeep:    rgb(0.043, 0.122, 0.302),  // #0B1F4D — title navy
  gold:        rgb(0.831, 0.686, 0.235),  // #D4AF37
  goldSoft:    rgb(0.784, 0.608, 0.235),  // #C89B3C — border gold
  red:         rgb(0.722, 0.106, 0.094),  // #B91B18 — registration accent
  ink:         rgb(0.133, 0.133, 0.133),  // #222222
  inkSoft:     rgb(0.267, 0.267, 0.267),  // #444
  hairline:    rgb(0.83, 0.83, 0.86),
  panel:       rgb(0.978, 0.978, 0.984),  // very faint card fill
  panelStrong: rgb(0.953, 0.953, 0.965),
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

/**
 * pdf-lib's Standard fonts are WinAnsi-only, but we're embedding TTFs via
 * fontkit which gives full Unicode. Most issues come from the rupee sign which
 * is missing from many Latin-only fonts — convert it pre-emptively.
 */
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
  let str = normalize(text)
  if (maxWidth) {
    while (font.widthOfTextAtSize(str, size) > maxWidth && str.length > 1) {
      str = str.slice(0, -1)
    }
    if (str.length < normalize(text).length) str = str.slice(0, Math.max(1, str.length - 1)) + '…'
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
  const pillW = 240, pillH = 22
  const x = cx - pillW / 2
  // Body
  page.drawRectangle({ x, y, width: pillW, height: pillH, color: C.navy })
  // Gold chevron caps (diamond shapes flanking the pill)
  const capW = 14
  page.drawRectangle({ x: x - capW, y: y + 4, width: capW, height: pillH - 8, color: C.gold })
  page.drawRectangle({ x: x + pillW, y: y + 4, width: capW, height: pillH - 8, color: C.gold })
  drawText(page, label.toUpperCase(), {
    x: cx, y: y + 7, size: 11, font, color: C.white, align: 'center', letterSpacing: 1.2,
  })
}

/** Gold horizontal divider with a centred diamond. */
function drawGoldDivider(page: PDFPage, cx: number, y: number, halfLen: number) {
  page.drawLine({ start: { x: cx - halfLen, y }, end: { x: cx - 8, y }, thickness: 0.8, color: C.gold })
  page.drawLine({ start: { x: cx + 8, y }, end: { x: cx + halfLen, y }, thickness: 0.8, color: C.gold })
  // Diamond at the centre — drawn as a rotated 6×6 square.
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
      const ts = embedded.size()
      const scale = Math.max(W / ts.width, H / ts.height)
      page.drawPage(embedded, {
        x: (W - ts.width * scale) / 2,
        y: (H - ts.height * scale) / 2,
        width: ts.width * scale,
        height: ts.height * scale,
      })
    }
  } catch { /* template optional */ }
  return doc
}

interface FontSet {
  /** Cinzel Bold — main certificate title. */
  serif: PDFFont
  /** PlayfairDisplay italic — "This is to certify…" subtitle. */
  serifItalic: PDFFont
  /** Montserrat Bold — institute name + emphasis. */
  brand: PDFFont
  /** Montserrat SemiBold — section pills. */
  pill: PDFFont
  /** Poppins SemiBold — labels. */
  label: PDFFont
  /** Poppins Regular — values & body. */
  body: PDFFont
  /** Poppins Medium — sub-emphasis. */
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
    cinzelBold,
    playfairItalic,
    montserratBold,
    montserratSemi,
    poppinsSemi,
    poppinsReg,
    poppinsMed,
  ] = await Promise.all([
    tryEmbed('/fonts/Cinzel-Bold.ttf'),
    tryEmbed('/fonts/PlayfairDisplay-Italic-VF.ttf'),
    tryEmbed('/fonts/Montserrat-Bold.ttf'),
    tryEmbed('/fonts/Montserrat-SemiBold.ttf'),
    tryEmbed('/fonts/Poppins-SemiBold.ttf'),
    tryEmbed('/fonts/Poppins-Regular.ttf'),
    tryEmbed('/fonts/Poppins-Medium.ttf'),
  ])

  // Fall back to standard fonts if any TTF failed to load — better degraded
  // typography than a broken document.
  const { StandardFonts } = await import('pdf-lib')
  const fallbackBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fallbackReg  = await doc.embedFont(StandardFonts.Helvetica)
  const fallbackItalic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fallbackSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold)

  return {
    serif:       cinzelBold      ?? fallbackSerifBold,
    serifItalic: playfairItalic  ?? fallbackItalic,
    brand:       montserratBold  ?? fallbackBold,
    pill:        montserratSemi  ?? fallbackBold,
    label:       poppinsSemi     ?? fallbackBold,
    body:        poppinsReg      ?? fallbackReg,
    bodyMedium:  poppinsMed      ?? fallbackReg,
  }
}

// ─── Content layout ───────────────────────────────────────────────────────────

async function paintContent(
  doc: PDFDocument,
  page: PDFPage,
  f: FontSet,
  data: BuildRegCertInput,
) {
  const [W, H] = A4
  const cx = W / 2
  const stu = data.student

  // Safe content margins: leave 60pt on left/right, 50pt top, 40pt bottom so we
  // never run into the navy + gold border the template paints.
  const SAFE_X1 = 60
  const SAFE_X2 = W - 60

  // ─── 1. HEADER (3 columns: logo · institute info · reg no) ───────────────
  const HEAD_TOP = H - 50          // top of the header band
  const HEAD_BOT = H - 152         // bottom of the header band
  const HEAD_HEIGHT = HEAD_TOP - HEAD_BOT

  // Column boundaries
  const COL1_X = SAFE_X1 + 5                    // logo column
  const COL2_X = SAFE_X1 + 110                  // institute info column starts here
  const COL3_X = SAFE_X2 - 130                  // reg no column starts here

  // Vertical separators between columns
  page.drawLine({ start: { x: COL2_X - 8, y: HEAD_BOT + 8 }, end: { x: COL2_X - 8, y: HEAD_TOP }, thickness: 0.6, color: C.hairline })
  page.drawLine({ start: { x: COL3_X - 8, y: HEAD_BOT + 8 }, end: { x: COL3_X - 8, y: HEAD_TOP }, thickness: 0.6, color: C.hairline })

  // 1a. Logo (left column, vertically centred)
  const logoImg = data.branchLogoDataUrl ? await embedAny(doc, data.branchLogoDataUrl) : null
  const logoCx = COL1_X + 40
  const logoCy = HEAD_BOT + HEAD_HEIGHT / 2
  if (logoImg) {
    const r = 36
    page.drawCircle({ x: logoCx, y: logoCy, size: r + 2, color: C.gold })            // gold ring
    page.drawCircle({ x: logoCx, y: logoCy, size: r,     color: C.white })           // white inset
    const dim = r * 1.55
    page.drawImage(logoImg, { x: logoCx - dim / 2, y: logoCy - dim / 2, width: dim, height: dim })
  }

  // 1b. Institute info (centre column)
  drawText(page, data.brandTitle.toUpperCase(), {
    x: COL2_X, y: HEAD_TOP - 22, size: 18, font: f.brand, color: C.navy,
    maxWidth: COL3_X - COL2_X - 24, letterSpacing: 0.2,
  })
  // Address rows — label : value, label gold-bold, value black
  const ADDR_LABEL_W = 78
  const ADDR_X = COL2_X
  const branchAddr = formatBranchAddress(data.branch) || data.headOfficeAddress
  const headLines = wrapToLines(data.headOfficeAddress, f.body, 9, COL3_X - (ADDR_X + ADDR_LABEL_W + 8) - 4, 2)
  const branchLines = wrapToLines(branchAddr, f.body, 9, COL3_X - (ADDR_X + ADDR_LABEL_W + 8) - 4, 2)
  const phoneText = data.branch?.director_phone
    ? `${data.branch.director_phone}, ${data.headOfficeContacts}`
    : data.headOfficeContacts

  // Render the two-line address block tightly (each label paints opposite the
  // first wrapped line of its value).
  let curY = HEAD_TOP - 46
  curY = renderHeaderField(page, f, 'Head Office', headLines, ADDR_X, ADDR_LABEL_W, curY)
  curY = renderHeaderField(page, f, 'Branch Office', branchLines, ADDR_X, ADDR_LABEL_W, curY)
  curY = renderHeaderField(page, f, 'Contact No.', [phoneText], ADDR_X, ADDR_LABEL_W, curY)

  // 1c. Registration No (right column)
  drawText(page, 'Registration No.', {
    x: COL3_X + 60, y: HEAD_TOP - 36, size: 11, font: f.label, color: C.ink, align: 'center',
  })
  drawText(page, valueOrNA(stu.registration_no), {
    x: COL3_X + 60, y: HEAD_TOP - 56, size: 16, font: f.brand, color: C.red, align: 'center',
  })

  // ─── 2. Title section ────────────────────────────────────────────────────
  drawGoldDivider(page, cx, HEAD_BOT - 10, 230)

  drawText(page, 'REGISTRATION CERTIFICATE', {
    x: cx, y: HEAD_BOT - 60, size: 30, font: f.serif, color: C.navyDeep, align: 'center', letterSpacing: 1.2,
  })

  drawText(page, 'This is to certify that the following student has been registered with', {
    x: cx, y: HEAD_BOT - 92, size: 11, font: f.serifItalic, color: C.inkSoft, align: 'center',
  })
  drawText(page, data.brandTitle, {
    x: cx, y: HEAD_BOT - 108, size: 12, font: f.brand, color: C.ink, align: 'center',
  })
  drawText(page, 'for the selected course and academic session.', {
    x: cx, y: HEAD_BOT - 124, size: 11, font: f.serifItalic, color: C.inkSoft, align: 'center',
  })

  // ─── 3. STUDENT INFORMATION ──────────────────────────────────────────────
  const STU_PILL_Y = HEAD_BOT - 154
  drawSectionPill(page, cx, STU_PILL_Y, 'Student Information', f.pill)

  // Card geometry
  const STU_CARD_TOP = STU_PILL_Y - 8
  const STU_CARD_H = 230
  const STU_CARD_BOT = STU_CARD_TOP - STU_CARD_H
  page.drawRectangle({
    x: SAFE_X1, y: STU_CARD_BOT, width: SAFE_X2 - SAFE_X1, height: STU_CARD_H,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.7,
  })

  // Photo (right side)
  const PHOTO_W = 84, PHOTO_H = 108
  const PHOTO_X = SAFE_X2 - PHOTO_W - 18
  const PHOTO_Y = STU_CARD_TOP - 18 - PHOTO_H
  page.drawRectangle({
    x: PHOTO_X, y: PHOTO_Y, width: PHOTO_W, height: PHOTO_H,
    color: C.white, borderColor: C.hairline, borderWidth: 0.8,
  })
  if (stu.photo_url) {
    const photoData = await toDataUrl(stu.photo_url)
    const photoImg = await embedAny(doc, photoData)
    if (photoImg) {
      page.drawImage(photoImg, { x: PHOTO_X + 1, y: PHOTO_Y + 1, width: PHOTO_W - 2, height: PHOTO_H - 2 })
    } else {
      drawText(page, 'PHOTO', { x: PHOTO_X + PHOTO_W / 2, y: PHOTO_Y + PHOTO_H / 2 - 4, size: 8, font: f.label, color: C.hairline, align: 'center' })
    }
  } else {
    drawText(page, 'PHOTO', { x: PHOTO_X + PHOTO_W / 2, y: PHOTO_Y + PHOTO_H / 2 - 4, size: 8, font: f.label, color: C.hairline, align: 'center' })
  }

  // Field grid — split layout to mirror the reference exactly.
  // Single-row fields span left + middle col; split rows show two label/value
  // pairs (left half + right half). The right column ends before the photo
  // (at PHOTO_X - 12) so values never collide with the photo.
  const FIELD_LEFT  = SAFE_X1 + 14
  const LBL1_X = FIELD_LEFT
  const SEP1_X = FIELD_LEFT + 100
  const VAL1_X = FIELD_LEFT + 108
  const VAL1_W = (PHOTO_X - 12) - VAL1_X     // single-col rows extend to photo
  const SPLIT_RIGHT_LBL = FIELD_LEFT + 248
  const SPLIT_RIGHT_SEP = FIELD_LEFT + 318
  const SPLIT_RIGHT_VAL = FIELD_LEFT + 326
  const SPLIT_LEFT_VAL_W = SPLIT_RIGHT_LBL - VAL1_X - 8
  const SPLIT_RIGHT_VAL_W = (PHOTO_X - 12) - SPLIT_RIGHT_VAL

  const ROW_H = 17
  const FIRST_ROW_Y = STU_CARD_TOP - 22

  function row(i: number, label: string, value: string): void {
    const ly = FIRST_ROW_Y - i * ROW_H
    drawText(page, label,           { x: LBL1_X, y: ly, size: 9.5, font: f.label, color: C.ink })
    drawText(page, ':',             { x: SEP1_X, y: ly, size: 9.5, font: f.body,  color: C.ink })
    drawText(page, valueOrNA(value),{ x: VAL1_X, y: ly, size: 9.5, font: f.body,  color: C.ink, maxWidth: VAL1_W })
  }
  function splitRow(i: number, lLbl: string, lVal: string, rLbl: string, rVal: string): void {
    const ly = FIRST_ROW_Y - i * ROW_H
    drawText(page, lLbl,            { x: LBL1_X, y: ly, size: 9.5, font: f.label, color: C.ink })
    drawText(page, ':',             { x: SEP1_X, y: ly, size: 9.5, font: f.body,  color: C.ink })
    drawText(page, valueOrNA(lVal), { x: VAL1_X, y: ly, size: 9.5, font: f.body,  color: C.ink, maxWidth: SPLIT_LEFT_VAL_W })
    drawText(page, rLbl,            { x: SPLIT_RIGHT_LBL, y: ly, size: 9.5, font: f.label, color: C.ink })
    drawText(page, ':',             { x: SPLIT_RIGHT_SEP, y: ly, size: 9.5, font: f.body,  color: C.ink })
    drawText(page, valueOrNA(rVal), { x: SPLIT_RIGHT_VAL, y: ly, size: 9.5, font: f.body,  color: C.ink, maxWidth: SPLIT_RIGHT_VAL_W })
  }

  const studentAddress = joinAddress([stu.address, stu.village, stu.block])
  const stateValue = stu.state ? titleCase(stu.state) : NA
  const districtValue = stu.district ? titleCase(stu.district) : NA
  const genderValue = stu.gender ? titleCase(stu.gender) : NA
  const religionValue = stu.religion ? titleCase(stu.religion) : NA

  row(0, "Student's Name", stu.name)
  row(1, "Father's Name", stu.father_name || '')
  row(2, "Mother's Name", stu.mother_name || '')
  row(3, 'Address', studentAddress)
  splitRow(4, 'State',         stateValue,                 'District',    districtValue)
  splitRow(5, 'Date of Birth', fmtDate(stu.dob),           'Gender',      genderValue)
  splitRow(6, 'Category',      stu.category || '',          'Religion',    religionValue)
  splitRow(7, 'Mobile No.',    stu.phone || '',             'Email',       stu.email || '')
  row(8, 'Qualification', '')
  splitRow(9, 'Identity Type', stu.identity_type || 'Aadhar Card', 'ID Number', stu.aadhar_number || '')
  row(10, 'Admission Date', fmtDate(stu.admission_date || stu.enrollment_date))

  // ─── 4. COURSE INFORMATION ───────────────────────────────────────────────
  const COURSE_PILL_Y = STU_CARD_BOT - 26
  drawSectionPill(page, cx, COURSE_PILL_Y, 'Course Information', f.pill)
  const COURSE_CARD_TOP = COURSE_PILL_Y - 8
  const COURSE_CARD_H = 78
  const COURSE_CARD_BOT = COURSE_CARD_TOP - COURSE_CARD_H
  page.drawRectangle({
    x: SAFE_X1, y: COURSE_CARD_BOT, width: SAFE_X2 - SAFE_X1, height: COURSE_CARD_H,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.7,
  })

  const courseName = data.course?.name || ''
  const courseDuration = data.course?.duration_label
    || (data.course?.duration_months ? `${data.course.duration_months} Months` : '')
  const courseRowY = COURSE_CARD_TOP - 22
  // Course Name might be long — render it on a single row with wide maxWidth.
  drawText(page, 'Course Name',     { x: LBL1_X, y: courseRowY,      size: 10, font: f.label, color: C.ink })
  drawText(page, ':',               { x: SEP1_X, y: courseRowY,      size: 10, font: f.body,  color: C.ink })
  drawText(page, valueOrNA(courseName), {
    x: VAL1_X, y: courseRowY, size: 10, font: f.body, color: C.ink,
    maxWidth: SAFE_X2 - VAL1_X - 14,
  })
  drawText(page, 'Course Duration', { x: LBL1_X, y: courseRowY - 22, size: 10, font: f.label, color: C.ink })
  drawText(page, ':',               { x: SEP1_X, y: courseRowY - 22, size: 10, font: f.body,  color: C.ink })
  drawText(page, valueOrNA(courseDuration), { x: VAL1_X, y: courseRowY - 22, size: 10, font: f.body, color: C.ink })
  drawText(page, 'Session',         { x: LBL1_X, y: courseRowY - 44, size: 10, font: f.label, color: C.ink })
  drawText(page, ':',               { x: SEP1_X, y: courseRowY - 44, size: 10, font: f.body,  color: C.ink })
  drawText(page, valueOrNA(stu.session), { x: VAL1_X, y: courseRowY - 44, size: 10, font: f.body, color: C.ink })

  // ─── 5. FEE DETAILS ──────────────────────────────────────────────────────
  const FEE_PILL_Y = COURSE_CARD_BOT - 24
  drawSectionPill(page, cx, FEE_PILL_Y, 'Fee Details', f.pill)
  const FEE_CARD_TOP = FEE_PILL_Y - 8
  const FEE_CARD_H = 88
  const FEE_CARD_BOT = FEE_CARD_TOP - FEE_CARD_H
  page.drawRectangle({
    x: SAFE_X1, y: FEE_CARD_BOT, width: SAFE_X2 - SAFE_X1, height: FEE_CARD_H,
    color: C.panel, borderColor: C.hairline, borderWidth: 0.7,
  })

  const totalFee = stu.net_fee ?? stu.total_fee ?? 0
  const due = Math.max(totalFee - data.fees.amountPaid, 0)
  const monthsLabel = stu.installment_count ? `${stu.installment_count} Months` : NA

  // 4×2 grid
  const FEE_ROW_H = 18
  const FEE_TOP_Y = FEE_CARD_TOP - 20
  const FEE_LEFT_LBL_X = LBL1_X
  const FEE_LEFT_SEP_X = SEP1_X
  const FEE_LEFT_VAL_X = VAL1_X
  const FEE_RIGHT_LBL_X = SPLIT_RIGHT_LBL
  const FEE_RIGHT_SEP_X = SPLIT_RIGHT_SEP
  const FEE_RIGHT_VAL_X = SPLIT_RIGHT_VAL

  function feeRow(i: number, side: 'L' | 'R', label: string, value: string) {
    const lblX = side === 'L' ? FEE_LEFT_LBL_X : FEE_RIGHT_LBL_X
    const sepX = side === 'L' ? FEE_LEFT_SEP_X : FEE_RIGHT_SEP_X
    const valX = side === 'L' ? FEE_LEFT_VAL_X : FEE_RIGHT_VAL_X
    const ly = FEE_TOP_Y - i * FEE_ROW_H
    drawText(page, label, { x: lblX, y: ly, size: 9.5, font: f.label, color: C.ink })
    drawText(page, ':',   { x: sepX, y: ly, size: 9.5, font: f.body,  color: C.ink })
    drawText(page, value, { x: valX, y: ly, size: 9.5, font: f.bodyMedium, color: C.ink, maxWidth: 150 })
  }

  feeRow(0, 'L', 'Total Fees',         fmtINR(totalFee))
  feeRow(1, 'L', 'Fee Start Date',     fmtDate(stu.fee_start_month))
  feeRow(2, 'L', 'Total Installments', monthsLabel)
  feeRow(3, 'L', 'Monthly Fee',        fmtINR(stu.monthly_fee))
  feeRow(0, 'R', 'Amount Paid',        fmtINR(data.fees.amountPaid))
  feeRow(1, 'R', 'Payment Date',       fmtDate(data.fees.paymentDate))
  feeRow(2, 'R', 'Due Amount',         fmtINR(due))
  feeRow(3, 'R', 'Next Installment Due', fmtDate(data.fees.nextInstallmentDue))

  // ─── 6. FOOTER (3 columns: QR · seal · signature) ────────────────────────
  // Footer sits inside the safe zone, well clear of the bottom border.
  const FOOTER_TOP = FEE_CARD_BOT - 18
  const FOOTER_BOT = 56                       // ≥ 30pt above the bottom border
  const FOOTER_H = FOOTER_TOP - FOOTER_BOT

  // Column 1: QR + caption (LEFT)
  const QR_SIZE = 70
  const QR_X = SAFE_X1 + 10
  const QR_Y = FOOTER_BOT + (FOOTER_H - QR_SIZE) / 2
  const qrImg = await embedAny(doc, data.qrDataUrl)
  if (qrImg) page.drawImage(qrImg, { x: QR_X, y: QR_Y, width: QR_SIZE, height: QR_SIZE })

  drawText(page, 'This certificate is system generated', {
    x: QR_X + QR_SIZE + 6, y: QR_Y + 30, size: 7.5, font: f.body, color: C.inkSoft,
  })
  drawText(page, 'and does not require any signature.', {
    x: QR_X + QR_SIZE + 6, y: QR_Y + 18, size: 7.5, font: f.body, color: C.inkSoft,
  })

  // Column 2: Quality Education seal (CENTRE)
  const SEAL_SIZE = 80
  const sealImg = await embedAny(doc, data.sealDataUrl)
  if (sealImg) {
    page.drawImage(sealImg, {
      x: cx - SEAL_SIZE / 2,
      y: FOOTER_BOT + (FOOTER_H - SEAL_SIZE) / 2,
      width: SEAL_SIZE, height: SEAL_SIZE,
    })
  }

  // Column 3: Signature (RIGHT)
  const SIG_BOX_W = 160
  const SIG_RIGHT = SAFE_X2 - 10
  const SIG_LEFT = SIG_RIGHT - SIG_BOX_W
  const SIG_LINE_Y = FOOTER_BOT + 26
  const sigImg = await embedAny(doc, data.signatureDataUrl)
  if (sigImg) {
    page.drawImage(sigImg, {
      x: SIG_LEFT + 20, y: SIG_LINE_Y + 4,
      width: SIG_BOX_W - 40, height: 26,
    })
  }
  page.drawLine({
    start: { x: SIG_LEFT + 8,  y: SIG_LINE_Y },
    end:   { x: SIG_RIGHT - 8, y: SIG_LINE_Y },
    thickness: 0.7, color: C.ink,
  })
  drawText(page, 'Authorised Signatory', {
    x: (SIG_LEFT + SIG_RIGHT) / 2, y: SIG_LINE_Y - 12, size: 9.5, font: f.label, color: C.ink, align: 'center',
  })
  drawText(page, `( ${data.brandTitle} )`, {
    x: (SIG_LEFT + SIG_RIGHT) / 2, y: SIG_LINE_Y - 24, size: 8, font: f.body, color: C.inkSoft, align: 'center',
  })
}

/**
 * Render a Head Office / Branch Office / Contact No. row in the header. Returns
 * the next y position so subsequent rows can flow naturally below.
 */
function renderHeaderField(
  page: PDFPage,
  f: FontSet,
  label: string,
  valueLines: string[],
  x: number,
  labelW: number,
  y: number,
): number {
  const SIZE = 9
  drawText(page, label,     { x: x,            y, size: SIZE, font: f.label, color: C.ink })
  drawText(page, ':',       { x: x + labelW,   y, size: SIZE, font: f.body,  color: C.ink })
  let cy = y
  for (const line of valueLines) {
    drawText(page, line, { x: x + labelW + 8, y: cy, size: SIZE, font: f.body, color: C.ink })
    cy -= SIZE * 1.35
  }
  return cy - 2
}

function wrapToLines(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  if (!text) return ['']
  const norm = text
  const words = norm.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
    if (lines.length >= maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines.length === 0 ? [''] : lines
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
