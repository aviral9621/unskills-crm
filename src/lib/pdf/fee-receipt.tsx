interface FeeReceiptInput {
  receiptNo: string
  date: string
  amount: number
  mode: string
  note?: string
  monthsPaid?: string[] // e.g. ['May 2026', 'Jun 2026']
  txnRef?: string
  student: {
    name: string
    registration_no: string
    father_name: string
    course: string
  }
  branch: {
    name: string
    code: string
    phone: string
    address?: string
    society_name?: string | null
    registration_number?: string | null
    logo_url?: string | null
  }
}

function inr(n: number): string {
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
    // Already registered.
  }
}

export async function downloadFeeReceipt(data: FeeReceiptInput): Promise<void> {
  await registerRoboto()
  const { pdf, Document, Page, View, Text, Image, StyleSheet } = await import('@react-pdf/renderer')

  const SIZE = 560
  const PRIMARY = '#B91C1C'
  const INK = '#111827'
  const MUTED = '#6B7280'
  const BORDER = '#E5E7EB'
  const RED_BG = '#FEF2F2'

  const styles = StyleSheet.create({
    page: { padding: 18, fontFamily: 'Roboto', fontSize: 9, color: INK, backgroundColor: '#FFFFFF' },
    outer: { borderWidth: 1, borderColor: '#F3D8D8', borderRadius: 10, padding: 16, height: '100%' },

    // Brand header — UnSkills lockup + branch-specific details
    brandWrap: { alignItems: 'center', paddingBottom: 6 },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    logo: { width: 38, height: 38, marginRight: 10, objectFit: 'contain' },
    brandUn: { fontSize: 22, fontWeight: 700, color: INK, letterSpacing: 0.3 },
    brandSk: { fontSize: 22, fontWeight: 700, color: PRIMARY, letterSpacing: 0.3 },
    brandTail: { fontSize: 16, fontWeight: 700, color: INK, letterSpacing: 0.4, marginLeft: 6 },
    branchName: { fontSize: 9, color: MUTED, marginTop: 3, textAlign: 'center' },
    branchMeta: { fontSize: 8, color: MUTED, textAlign: 'center' },
    hr: { height: 1, backgroundColor: BORDER, marginTop: 10 },

    titleWrap: { alignItems: 'center', marginTop: 10 },
    titlePill: { backgroundColor: PRIMARY, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 999 },
    titleText: { color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: 2 },
    titleSub: { fontSize: 8, color: MUTED, marginTop: 4 },

    metaRow: { flexDirection: 'row', marginTop: 12, paddingBottom: 6, borderBottomWidth: 0.6, borderBottomColor: BORDER },
    metaCol: { flex: 1 },
    metaLabel: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 },
    metaValue: { fontSize: 12, fontWeight: 700, marginTop: 2, color: PRIMARY },

    twoCol: { flexDirection: 'row', marginTop: 12, gap: 10 },
    card: { flex: 1, borderWidth: 0.8, borderColor: BORDER, borderRadius: 6, padding: 9 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    cardDot: { width: 12, height: 12, backgroundColor: PRIMARY, borderRadius: 3, marginRight: 6 },
    cardTitle: { fontSize: 7.5, color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 },
    kv: { flexDirection: 'row', marginTop: 3 },
    kvK: { width: 60, color: MUTED, fontSize: 8 },
    kvV: { flex: 1, fontSize: 9, fontWeight: 700 },

    amountBox: { marginTop: 12, padding: 12, backgroundColor: RED_BG, borderLeftWidth: 4, borderLeftColor: PRIMARY, borderRadius: 4 },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    amountLeft: { flex: 1 },
    amountLabel: { fontSize: 9, color: PRIMARY, fontWeight: 700, letterSpacing: 0.5 },
    amountWords: { fontSize: 8.5, color: '#4B5563', marginTop: 4 },
    amountValue: { fontSize: 26, fontWeight: 700, color: PRIMARY },

    terms: { marginTop: 10, padding: 8, borderWidth: 0.8, borderStyle: 'dashed', borderColor: '#F3C7C7', borderRadius: 4 },
    termsTitle: { fontSize: 7.5, color: PRIMARY, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 3 },
    termsText: { fontSize: 8, color: '#555', lineHeight: 1.45 },

    footer: { marginTop: 'auto', paddingTop: 10, borderTopWidth: 0.6, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center' },
    footerTitle: { fontSize: 9, fontWeight: 700, color: INK },
    footerSub: { fontSize: 7.5, color: MUTED, marginTop: 1 },
    footerRight: { alignItems: 'flex-end' },
    footerRightText: { fontSize: 7, color: MUTED },
  })

  const prettyMode = (data.mode || '').replace(/_/g, ' ').toUpperCase()
  const logoUrl = data.branch.logo_url
  const branchMeta = [
    `Branch Code: ${data.branch.code}`,
    data.branch.phone ? `Ph: ${data.branch.phone}` : '',
    data.branch.registration_number ? `Reg: ${data.branch.registration_number}` : '',
  ].filter(Boolean).join('  \u00B7  ')

  const feesForLine = data.monthsPaid && data.monthsPaid.length > 0
    ? data.monthsPaid.join(', ')
    : null

  const Doc = (
    <Document>
      <Page size={[SIZE, SIZE]} style={styles.page}>
        <View style={styles.outer}>
          {/* Brand header */}
          <View style={styles.brandWrap}>
            <View style={styles.brandRow}>
              {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
              <Text style={styles.brandUn}>UN</Text>
              <Text style={styles.brandSk}>SKILLS</Text>
              <Text style={styles.brandTail}>COMPUTER EDUCATION</Text>
            </View>
            {data.branch.society_name
              ? <Text style={styles.branchName}>{data.branch.society_name}</Text>
              : null}
            <Text style={styles.branchMeta}>{branchMeta}</Text>
            {data.branch.address ? <Text style={styles.branchMeta}>{data.branch.address}</Text> : null}
          </View>
          <View style={styles.hr} />

          <View style={styles.titleWrap}>
            <View style={styles.titlePill}><Text style={styles.titleText}>FEE RECEIPT</Text></View>
            <Text style={styles.titleSub}>Official receipt of fee payment</Text>
          </View>

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

          <View style={styles.twoCol}>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardDot} />
                <Text style={styles.cardTitle}>Student Details</Text>
              </View>
              <View style={styles.kv}><Text style={styles.kvK}>Name</Text><Text style={styles.kvV}>{data.student.name}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Reg No.</Text><Text style={styles.kvV}>{data.student.registration_no}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Father</Text><Text style={styles.kvV}>{data.student.father_name}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Course</Text><Text style={styles.kvV}>{data.student.course}</Text></View>
            </View>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardDot} />
                <Text style={styles.cardTitle}>Payment Details</Text>
              </View>
              <View style={styles.kv}><Text style={styles.kvK}>Mode</Text><Text style={styles.kvV}>{prettyMode}</Text></View>
              {feesForLine ? <View style={styles.kv}><Text style={styles.kvK}>Fees For</Text><Text style={styles.kvV}>{feesForLine}</Text></View> : null}
              {data.txnRef ? <View style={styles.kv}><Text style={styles.kvK}>Txn Ref</Text><Text style={styles.kvV}>{data.txnRef}</Text></View> : null}
              {data.note ? <View style={styles.kv}><Text style={styles.kvK}>Note</Text><Text style={styles.kvV}>{data.note}</Text></View> : null}
            </View>
          </View>

          <View style={styles.amountBox}>
            <View style={styles.amountRow}>
              <View style={styles.amountLeft}>
                <Text style={styles.amountLabel}>AMOUNT PAID</Text>
                <Text style={styles.amountWords}>In words: {inWords(data.amount)} Rupees Only</Text>
              </View>
              <Text style={styles.amountValue}>{inr(data.amount)}</Text>
            </View>
          </View>

          <View style={styles.terms}>
            <Text style={styles.termsTitle}>Terms</Text>
            <Text style={styles.termsText}>1. Fees once paid are non-refundable and non-transferable.</Text>
            <Text style={styles.termsText}>2. This receipt is valid subject to realisation of payment.</Text>
            <Text style={styles.termsText}>3. Keep this receipt for your records; it may be required for future verification.</Text>
          </View>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.footerTitle}>{data.branch.name} ({data.branch.code})</Text>
              <Text style={styles.footerSub}>Thank you for your payment.</Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerRightText}>Computer-generated receipt.</Text>
              <Text style={styles.footerRightText}>Does not require signature.</Text>
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
  a.download = `Receipt-${data.receiptNo}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
