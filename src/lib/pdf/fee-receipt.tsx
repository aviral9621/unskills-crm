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

export async function downloadFeeReceipt(data: FeeReceiptInput): Promise<void> {
  const { pdf, Document, Page, View, Text, Image, StyleSheet } = await import('@react-pdf/renderer')

  const PRIMARY = '#B91C1C'
  const INK = '#111827'
  const MUTED = '#6B7280'
  const BORDER = '#E5E7EB'

  const styles = StyleSheet.create({
    page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: INK },
    outer: { borderWidth: 1.2, borderColor: PRIMARY, borderRadius: 6, padding: 16, height: '100%' },

    header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: PRIMARY, paddingBottom: 10 },
    logoBox: { width: 54, height: 54, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
    logoImg: { width: 54, height: 54, objectFit: 'contain' },
    headerMid: { flex: 1 },
    orgName: { fontSize: 18, fontWeight: 700, color: PRIMARY, letterSpacing: 0.3 },
    orgSub: { fontSize: 9, color: MUTED, marginTop: 2 },
    orgAddr: { fontSize: 8.5, color: MUTED, marginTop: 1 },

    titleWrap: { alignItems: 'center', marginTop: 14 },
    titleBg: { backgroundColor: PRIMARY, color: '#fff', paddingHorizontal: 22, paddingVertical: 5, borderRadius: 3 },
    titleText: { color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 3 },
    subTitleText: { fontSize: 8.5, color: MUTED, marginTop: 4 },

    metaRow: { flexDirection: 'row', marginTop: 14 },
    metaCol: { flex: 1 },
    metaLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
    metaValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },

    twoCol: { flexDirection: 'row', marginTop: 14, gap: 12 },
    card: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 10 },
    cardTitle: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    kv: { flexDirection: 'row', marginTop: 3 },
    kvK: { width: 70, color: MUTED, fontSize: 9 },
    kvV: { flex: 1, fontSize: 10, fontWeight: 700 },

    amountBox: { marginTop: 14, padding: 12, backgroundColor: '#FEF2F2', borderLeftWidth: 4, borderLeftColor: PRIMARY, borderRadius: 3 },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    amountLabel: { flex: 1, fontSize: 10, color: MUTED },
    amountValue: { fontSize: 22, fontWeight: 700, color: PRIMARY },
    amountWords: { marginTop: 6, fontSize: 9.5, color: INK },
    amountWordsEm: { fontStyle: 'italic', fontWeight: 700 },

    terms: { marginTop: 14, padding: 9, borderWidth: 1, borderColor: BORDER, borderRadius: 3, borderStyle: 'dashed' },
    termsTitle: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
    termsText: { fontSize: 8.5, color: '#444', lineHeight: 1.4 },

    sigBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
    sigGroup: { alignItems: 'center' },
    sigLine: { borderTopWidth: 1, borderTopColor: INK, width: 150, marginBottom: 3 },
    sigLabel: { fontSize: 8.5, color: MUTED, textAlign: 'center' },

    footer: { position: 'absolute', bottom: 18, left: 32, right: 32, borderTopWidth: 0.8, borderTopColor: BORDER, paddingTop: 6 },
    footerText: { fontSize: 7.5, textAlign: 'center', color: MUTED },
  })

  const prettyMode = (data.mode || '').replace(/_/g, ' ').toUpperCase()
  const logoUrl = data.branch.logo_url

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outer}>
          <View style={styles.header}>
            <View style={styles.logoBox}>
              {logoUrl
                ? <Image src={logoUrl} style={styles.logoImg} />
                : <Text style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>U</Text>}
            </View>
            <View style={styles.headerMid}>
              <Text style={styles.orgName}>{data.branch.name || 'UnSkills Computer Education'}</Text>
              {data.branch.society_name ? <Text style={styles.orgSub}>{data.branch.society_name}</Text> : null}
              <Text style={styles.orgAddr}>
                Branch Code: {data.branch.code}
                {data.branch.phone ? ` \u00B7 Ph: ${data.branch.phone}` : ''}
                {data.branch.registration_number ? ` \u00B7 Reg: ${data.branch.registration_number}` : ''}
              </Text>
              {data.branch.address ? <Text style={styles.orgAddr}>{data.branch.address}</Text> : null}
            </View>
          </View>

          <View style={styles.titleWrap}>
            <View style={styles.titleBg}><Text style={styles.titleText}>FEE RECEIPT</Text></View>
            <Text style={styles.subTitleText}>Official receipt of fee payment</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Receipt No.</Text>
              <Text style={styles.metaValue}>{data.receiptNo}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Student</Text>
              <View style={styles.kv}><Text style={styles.kvK}>Name</Text><Text style={styles.kvV}>{data.student.name}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Reg No.</Text><Text style={styles.kvV}>{data.student.registration_no}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Father</Text><Text style={styles.kvV}>{data.student.father_name}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Course</Text><Text style={styles.kvV}>{data.student.course}</Text></View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment</Text>
              <View style={styles.kv}><Text style={styles.kvK}>Mode</Text><Text style={styles.kvV}>{prettyMode}</Text></View>
              {data.txnRef ? <View style={styles.kv}><Text style={styles.kvK}>Txn Ref</Text><Text style={styles.kvV}>{data.txnRef}</Text></View> : null}
              {data.monthsPaid && data.monthsPaid.length > 0 ? (
                <View style={styles.kv}><Text style={styles.kvK}>For</Text><Text style={styles.kvV}>{data.monthsPaid.join(', ')}</Text></View>
              ) : null}
              {data.note ? <View style={styles.kv}><Text style={styles.kvK}>Note</Text><Text style={styles.kvV}>{data.note}</Text></View> : null}
            </View>
          </View>

          <View style={styles.amountBox}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>AMOUNT PAID</Text>
              <Text style={styles.amountValue}>{inr(data.amount)}</Text>
            </View>
            <Text style={styles.amountWords}>
              In words: <Text style={styles.amountWordsEm}>{inWords(data.amount)} Rupees Only</Text>
            </Text>
          </View>

          <View style={styles.terms}>
            <Text style={styles.termsTitle}>Terms</Text>
            <Text style={styles.termsText}>
              1. Fees once paid are non-refundable and non-transferable.
              {'  '}2. This receipt is valid subject to realisation of payment.
              {'  '}3. Keep this receipt for your records; it may be required for future verification.
            </Text>
          </View>

          <View style={styles.sigBlock}>
            <View style={styles.sigGroup}><View style={styles.sigLine} /><Text style={styles.sigLabel}>Student Signature</Text></View>
            <View style={styles.sigGroup}><View style={styles.sigLine} /><Text style={styles.sigLabel}>Authorised Signatory</Text></View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {`Computer-generated receipt \u00B7 Verify authenticity with your branch using the Receipt No. \u00B7 ${data.branch.name || 'UnSkills'}`}
          </Text>
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
