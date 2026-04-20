interface FeeReceiptInput {
  receiptNo: string
  date: string
  amount: number
  mode: string
  note?: string
  student: { name: string; registration_no: string; father_name: string; course: string }
  branch: { name: string; code: string; phone: string }
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
  const { pdf, Document, Page, View, Text, StyleSheet } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#111' },
    header: { textAlign: 'center', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#DC2626' },
    title: { fontSize: 20, fontWeight: 700, color: '#DC2626' },
    sub: { fontSize: 10, marginTop: 2, color: '#444' },
    receiptTitle: { textAlign: 'center', fontSize: 14, fontWeight: 700, letterSpacing: 2, marginTop: 16 },
    row: { flexDirection: 'row', marginTop: 6 },
    label: { width: 100, color: '#555' },
    val: { flex: 1, fontWeight: 700 },
    box: { marginTop: 18, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 12 },
    amountBox: { marginTop: 16, padding: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 6 },
    amount: { fontSize: 22, fontWeight: 700, color: '#B91C1C' },
    words: { marginTop: 4, fontSize: 9, color: '#555', fontStyle: 'italic' },
    footer: { position: 'absolute', bottom: 30, left: 36, right: 36, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8 },
    sigBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 36 },
    sigLabel: { fontSize: 9, color: '#666', textAlign: 'center' },
    sigLine: { borderTopWidth: 1, borderTopColor: '#111', width: 140, marginBottom: 4 },
  })

  const Doc = (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.branch.name || 'UnSkills Computer Education'}</Text>
          <Text style={styles.sub}>Branch Code: {data.branch.code} {data.branch.phone ? `\u00B7 ${data.branch.phone}` : ''}</Text>
        </View>

        <Text style={styles.receiptTitle}>FEE RECEIPT</Text>

        <View style={styles.box}>
          <View style={styles.row}><Text style={styles.label}>Receipt No.</Text><Text style={styles.val}>{data.receiptNo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.val}>{new Date(data.date).toLocaleDateString('en-IN')}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Student</Text><Text style={styles.val}>{data.student.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Reg No.</Text><Text style={styles.val}>{data.student.registration_no}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Father</Text><Text style={styles.val}>{data.student.father_name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Course</Text><Text style={styles.val}>{data.student.course}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Mode</Text><Text style={styles.val}>{data.mode.replace(/_/g, ' ').toUpperCase()}</Text></View>
          {data.note ? <View style={styles.row}><Text style={styles.label}>Note</Text><Text style={styles.val}>{data.note}</Text></View> : null}
        </View>

        <View style={styles.amountBox}>
          <Text style={{ fontSize: 10, color: '#555' }}>Amount Paid</Text>
          <Text style={styles.amount}>{inr(data.amount)}</Text>
          <Text style={styles.words}>{inWords(data.amount)} Rupees Only</Text>
        </View>

        <View style={styles.sigBlock}>
          <View style={{ alignItems: 'center' }}><View style={styles.sigLine} /><Text style={styles.sigLabel}>Student Signature</Text></View>
          <View style={{ alignItems: 'center' }}><View style={styles.sigLine} /><Text style={styles.sigLabel}>Authorised Signatory</Text></View>
        </View>

        <View style={styles.footer}>
          <Text style={{ fontSize: 8, textAlign: 'center', color: '#888' }}>
            Computer-generated receipt. Verify authenticity with your branch using the Receipt No.
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
