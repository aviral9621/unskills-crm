interface WalletReceiptInput {
  receiptNo: string
  date: string
  amount: number
  mode: string
  txnRef?: string | null
  note?: string | null
  requestId?: string | null
  approvedAt?: string | null
  branch: {
    name: string
    code: string
    b_code?: string | null
    phone?: string | null
    address?: string | null
    society_name?: string | null
    registration_number?: string | null
    logo_url?: string | null
  }
  hq: {
    name: string
    address: string
    phone: string
    website: string
    subtitle?: string
    logo_url?: string | null
  }
}

function inr(n: number): string {
  // U+20B9 (₹) — renders correctly with the Roboto font registered below.
  return '\u20B9 ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })
}

function inWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function twoDig(x: number): string {
    if (x < 20) return ones[x]
    return (tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '')).trim()
  }
  function threeDig(x: number): string {
    const h = Math.floor(x / 100), r = x % 100
    return (h ? ones[h] + ' Hundred ' : '') + (r ? twoDig(r) : '')
  }
  if (!n) return 'Zero'
  const cr = Math.floor(n / 10000000); n %= 10000000
  const lk = Math.floor(n / 100000); n %= 100000
  const th = Math.floor(n / 1000); n %= 1000
  const rest = threeDig(n)
  return [
    cr ? twoDig(cr) + ' Crore' : '',
    lk ? twoDig(lk) + ' Lakh' : '',
    th ? twoDig(th) + ' Thousand' : '',
    rest,
  ].filter(Boolean).join(' ').trim()
}

// Register Roboto from the app's own /public/fonts so the ₹ glyph (U+20B9) renders
// correctly in the PDF. Served from our own origin to avoid CORS / stale CDN 404s.
// Idempotent: subsequent calls are no-ops.
let FONT_REGISTERED = false
async function registerRoboto() {
  if (FONT_REGISTERED) return
  const { Font } = await import('@react-pdf/renderer')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  try {
    Font.register({
      family: 'Roboto',
      fonts: [
        { src: `${origin}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
        { src: `${origin}/fonts/Roboto-Bold.ttf`,    fontWeight: 700 },
      ],
    })
    FONT_REGISTERED = true
  } catch {
    // Font already registered — ignore.
  }
}

export async function downloadWalletReceipt(data: WalletReceiptInput): Promise<void> {
  await registerRoboto()
  const { pdf, Document, Page, View, Text, Image, StyleSheet } = await import('@react-pdf/renderer')

  // Square 1:1 canvas. 560×560 pt gives an A5-ish printable size with room for the branded layout.
  const SIZE = 560
  const PRIMARY = '#B91C1C'
  const INK = '#111827'
  const MUTED = '#6B7280'
  const BORDER = '#E5E7EB'
  const RED_BG = '#FEF2F2'

  const styles = StyleSheet.create({
    page: { padding: 18, fontFamily: 'Roboto', fontSize: 9, color: INK, backgroundColor: '#FFFFFF' },
    outer: { borderWidth: 1, borderColor: '#F3D8D8', borderRadius: 10, padding: 16, height: '100%' },

    // Brand header
    brandWrap: { alignItems: 'center', paddingBottom: 6 },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    logo: { width: 38, height: 38, marginRight: 10, objectFit: 'contain' },
    brandUn: { fontSize: 22, fontWeight: 700, color: INK, letterSpacing: 0.3 },
    brandSk: { fontSize: 22, fontWeight: 700, color: PRIMARY, letterSpacing: 0.3 },
    brandTail: { fontSize: 16, fontWeight: 700, color: INK, letterSpacing: 0.4, marginLeft: 6 },
    hqLine: { fontSize: 8, color: MUTED, marginTop: 3, textAlign: 'center' },
    hqAddr: { fontSize: 8, color: MUTED, textAlign: 'center' },
    hr: { height: 1, backgroundColor: BORDER, marginTop: 10 },

    // Title pill
    titleWrap: { alignItems: 'center', marginTop: 10 },
    titlePill: { backgroundColor: PRIMARY, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 999 },
    titleText: { color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: 2 },
    titleSub: { fontSize: 8, color: MUTED, marginTop: 4 },

    // Meta row: receipt no & date
    metaRow: { flexDirection: 'row', marginTop: 12, paddingBottom: 6, borderBottomWidth: 0.6, borderBottomColor: BORDER },
    metaCol: { flex: 1 },
    metaLabel: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
    metaValue: { fontSize: 12, fontWeight: 700, marginTop: 2, color: PRIMARY },

    // Two cards
    twoCol: { flexDirection: 'row', marginTop: 12, gap: 10 },
    card: { flex: 1, borderWidth: 0.8, borderColor: BORDER, borderRadius: 6, padding: 9 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    cardDot: { width: 12, height: 12, backgroundColor: PRIMARY, borderRadius: 3, marginRight: 6 },
    cardTitle: { fontSize: 7.5, color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 },
    kv: { flexDirection: 'row', marginTop: 3 },
    kvK: { width: 60, color: MUTED, fontSize: 8 },
    kvV: { flex: 1, fontSize: 9, fontWeight: 700 },

    // Amount pill
    amountBox: { marginTop: 12, padding: 12, backgroundColor: RED_BG, borderLeftWidth: 4, borderLeftColor: PRIMARY, borderRadius: 4 },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    amountLeft: { flex: 1 },
    amountLabel: { fontSize: 9, color: PRIMARY, fontWeight: 700, letterSpacing: 0.5 },
    amountWords: { fontSize: 8.5, color: '#4B5563', marginTop: 4 },
    amountValue: { fontSize: 26, fontWeight: 700, color: PRIMARY },

    // Notes
    notes: { marginTop: 10, padding: 8, borderWidth: 0.8, borderStyle: 'dashed', borderColor: '#F3C7C7', borderRadius: 4 },
    notesTitle: { fontSize: 7.5, color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 3 },
    notesText: { fontSize: 8, color: '#555', lineHeight: 1.45 },

    // Footer branch bar
    footer: { marginTop: 'auto', paddingTop: 10, borderTopWidth: 0.6, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center' },
    initial: { width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY, color: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    initialLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 8, objectFit: 'cover' },
    initialText: { color: '#FFFFFF', fontSize: 10, fontWeight: 700 },
    footerTitle: { fontSize: 9, fontWeight: 700, color: INK },
    footerSub: { fontSize: 7.5, color: MUTED, marginTop: 1 },
    footerRight: { alignItems: 'flex-end' },
    footerRightText: { fontSize: 7, color: MUTED },
  })

  const prettyMode = (data.mode || '').replace(/_/g, ' ').toUpperCase()
  const hqLogoUrl = data.hq.logo_url
  const branchLogoUrl = data.branch.logo_url
  const branchInitial = (data.branch.code || data.branch.name || 'B').slice(0, 4).toUpperCase()

  const Doc = (
    <Document>
      <Page size={[SIZE, SIZE]} style={styles.page}>
        <View style={styles.outer}>
          {/* Brand header — UN (black) + SKILLS (red) + COMPUTER EDUCATION */}
          <View style={styles.brandWrap}>
            <View style={styles.brandRow}>
              {hqLogoUrl ? <Image src={hqLogoUrl} style={styles.logo} /> : null}
              <Text style={styles.brandUn}>UN</Text>
              <Text style={styles.brandSk}>SKILLS</Text>
              <Text style={styles.brandTail}>COMPUTER EDUCATION</Text>
            </View>
            {data.hq.subtitle ? <Text style={styles.hqLine}>{data.hq.subtitle}</Text> : null}
            <Text style={styles.hqAddr}>{data.hq.address}</Text>
            <Text style={styles.hqLine}>Ph: {data.hq.phone} \u00B7 {data.hq.website}</Text>
          </View>
          <View style={styles.hr} />

          {/* Title pill */}
          <View style={styles.titleWrap}>
            <View style={styles.titlePill}><Text style={styles.titleText}>WALLET RELOAD RECEIPT</Text></View>
            <Text style={styles.titleSub}>Official acknowledgement of branch wallet payment</Text>
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Receipt No.</Text>
              <Text style={styles.metaValue}>{data.receiptNo}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={[styles.metaValue, { color: INK }]}>{new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </View>
          </View>

          {/* Two cards */}
          <View style={styles.twoCol}>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardDot} />
                <Text style={styles.cardTitle}>Payer (Branch)</Text>
              </View>
              <View style={styles.kv}><Text style={styles.kvK}>Branch</Text><Text style={styles.kvV}>{data.branch.name}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Code</Text><Text style={styles.kvV}>{data.branch.code}{data.branch.b_code ? `  \u00B7  ${data.branch.b_code}` : ''}</Text></View>
              {data.branch.society_name ? <View style={styles.kv}><Text style={styles.kvK}>Society</Text><Text style={styles.kvV}>{data.branch.society_name}</Text></View> : null}
              {data.branch.phone ? <View style={styles.kv}><Text style={styles.kvK}>Phone</Text><Text style={styles.kvV}>{data.branch.phone}</Text></View> : null}
              {data.branch.address ? <View style={styles.kv}><Text style={styles.kvK}>Address</Text><Text style={styles.kvV}>{data.branch.address}</Text></View> : null}
            </View>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardDot} />
                <Text style={styles.cardTitle}>Payment Details</Text>
              </View>
              <View style={styles.kv}><Text style={styles.kvK}>Mode</Text><Text style={styles.kvV}>{prettyMode}</Text></View>
              {data.txnRef ? <View style={styles.kv}><Text style={styles.kvK}>Txn Ref</Text><Text style={styles.kvV}>{data.txnRef}</Text></View> : null}
              {data.approvedAt ? <View style={styles.kv}><Text style={styles.kvK}>Approved</Text><Text style={styles.kvV}>{new Date(data.approvedAt).toLocaleString('en-IN')}</Text></View> : null}
              {data.note ? <View style={styles.kv}><Text style={styles.kvK}>Note</Text><Text style={styles.kvV}>{data.note}</Text></View> : null}
            </View>
          </View>

          {/* Amount */}
          <View style={styles.amountBox}>
            <View style={styles.amountRow}>
              <View style={styles.amountLeft}>
                <Text style={styles.amountLabel}>AMOUNT CREDITED</Text>
                <Text style={styles.amountWords}>In words: {inWords(data.amount)} Rupees Only</Text>
              </View>
              <Text style={styles.amountValue}>{inr(data.amount)}</Text>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>1. This receipt acknowledges credit of the above amount into the branch wallet.</Text>
            <Text style={styles.notesText}>2. Amount once credited is non-refundable and may be used only towards platform-approved debits.</Text>
            <Text style={styles.notesText}>3. Retain this receipt for your records; reference the Receipt No. in all future queries.</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {branchLogoUrl
              ? <Image src={branchLogoUrl} style={styles.initialLogo} />
              : <View style={styles.initial}><Text style={styles.initialText}>{branchInitial.slice(0, 3)}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={styles.footerTitle}>{data.branch.name} ({data.branch.code})</Text>
              <Text style={styles.footerSub}>{data.branch.address || ''}</Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerRightText}>Computer-generated receipt.</Text>
              <Text style={styles.footerRightText}>Branch copy.</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )

  const blob = await pdf(Doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Wallet-Receipt-${data.receiptNo}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

/** Fetch HQ details from site settings for wallet receipt payee block. */
export async function getHqDetailsForReceipt(): Promise<WalletReceiptInput['hq']> {
  const { supabase } = await import('../supabase')
  const { data } = await supabase.from('uce_site_settings').select('key, value')
    .in('key', [
      'card_header_title', 'card_header_subtitle',
      'card_address', 'card_phone', 'card_website',
      'marksheet_footer_address', 'site_institute_logo_url',
    ])
  const map = new Map<string, string>((data ?? []).map(r => [r.key, (r.value as string) ?? '']))
  return {
    name: map.get('card_header_title') || 'UNSKILLS COMPUTER EDUCATION',
    subtitle: map.get('card_header_subtitle') || undefined,
    address: map.get('card_address') || map.get('marksheet_footer_address') || '',
    phone: map.get('card_phone') || '',
    website: map.get('card_website') || '',
    logo_url: map.get('site_institute_logo_url') || null,
  }
}
