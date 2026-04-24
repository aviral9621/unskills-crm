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

export async function downloadWalletReceipt(data: WalletReceiptInput): Promise<void> {
  const { pdf, Document, Page, View, Text, Image, StyleSheet } = await import('@react-pdf/renderer')

  const PRIMARY = '#B91C1C'
  const INK = '#111827'
  const MUTED = '#6B7280'
  const BORDER = '#E5E7EB'

  const styles = StyleSheet.create({
    page: { padding: 28, fontFamily: 'Helvetica', fontSize: 10, color: INK },
    outer: { borderWidth: 1.2, borderColor: PRIMARY, borderRadius: 6, padding: 14, height: '100%' },

    hqHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: PRIMARY, paddingBottom: 10 },
    logoBox: { width: 54, height: 54, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
    logoImg: { width: 54, height: 54, objectFit: 'contain' },
    hqMid: { flex: 1 },
    orgName: { fontSize: 18, fontWeight: 700, color: PRIMARY, letterSpacing: 0.3 },
    orgSub: { fontSize: 9, color: MUTED, marginTop: 2 },
    orgAddr: { fontSize: 8.5, color: MUTED, marginTop: 1 },

    titleWrap: { alignItems: 'center', marginTop: 12 },
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
    kvK: { width: 75, color: MUTED, fontSize: 9 },
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

    sigBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
    sigGroup: { alignItems: 'center' },
    sigLine: { borderTopWidth: 1, borderTopColor: INK, width: 150, marginBottom: 3 },
    sigLabel: { fontSize: 8.5, color: MUTED, textAlign: 'center' },

    branchFooter: { marginTop: 14, borderTopWidth: 0.8, borderTopColor: BORDER, paddingTop: 6 },
    branchFooterRow: { flexDirection: 'row', alignItems: 'center' },
    branchFooterLogo: { width: 24, height: 24, marginRight: 8, objectFit: 'contain' },
    branchFooterTitle: { fontSize: 9, fontWeight: 700, color: PRIMARY },
    branchFooterSub: { fontSize: 7.5, color: MUTED },

    copyNote: { marginTop: 8, fontSize: 7.5, textAlign: 'center', color: MUTED, fontStyle: 'italic' },
  })

  const prettyMode = (data.mode || '').replace(/_/g, ' ').toUpperCase()
  const hqLogoUrl = data.hq.logo_url

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outer}>
          {/* HQ Header */}
          <View style={styles.hqHeader}>
            <View style={styles.logoBox}>
              {hqLogoUrl
                ? <Image src={hqLogoUrl} style={styles.logoImg} />
                : <Text style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>U</Text>}
            </View>
            <View style={styles.hqMid}>
              <Text style={styles.orgName}>{data.hq.name}</Text>
              {data.hq.subtitle ? <Text style={styles.orgSub}>{data.hq.subtitle}</Text> : null}
              <Text style={styles.orgAddr}>{data.hq.address}</Text>
              <Text style={styles.orgAddr}>
                {data.hq.phone ? `Ph: ${data.hq.phone}` : ''}
                {data.hq.website ? `  \u00B7  ${data.hq.website}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.titleWrap}>
            <View style={styles.titleBg}><Text style={styles.titleText}>WALLET RELOAD RECEIPT</Text></View>
            <Text style={styles.subTitleText}>Official acknowledgement of branch wallet payment</Text>
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
              <Text style={styles.cardTitle}>Payer (Branch)</Text>
              <View style={styles.kv}><Text style={styles.kvK}>Branch</Text><Text style={styles.kvV}>{data.branch.name}</Text></View>
              <View style={styles.kv}><Text style={styles.kvK}>Code</Text><Text style={styles.kvV}>{data.branch.code}{data.branch.b_code ? `  \u00B7  ${data.branch.b_code}` : ''}</Text></View>
              {data.branch.society_name ? <View style={styles.kv}><Text style={styles.kvK}>Society</Text><Text style={styles.kvV}>{data.branch.society_name}</Text></View> : null}
              {data.branch.phone ? <View style={styles.kv}><Text style={styles.kvK}>Phone</Text><Text style={styles.kvV}>{data.branch.phone}</Text></View> : null}
              {data.branch.address ? <View style={styles.kv}><Text style={styles.kvK}>Address</Text><Text style={styles.kvV}>{data.branch.address}</Text></View> : null}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment</Text>
              <View style={styles.kv}><Text style={styles.kvK}>Mode</Text><Text style={styles.kvV}>{prettyMode}</Text></View>
              {data.txnRef ? <View style={styles.kv}><Text style={styles.kvK}>Txn Ref</Text><Text style={styles.kvV}>{data.txnRef}</Text></View> : null}
              {data.requestId ? <View style={styles.kv}><Text style={styles.kvK}>Request ID</Text><Text style={styles.kvV}>{data.requestId}</Text></View> : null}
              {data.approvedAt ? <View style={styles.kv}><Text style={styles.kvK}>Approved</Text><Text style={styles.kvV}>{new Date(data.approvedAt).toLocaleString('en-IN')}</Text></View> : null}
              {data.note ? <View style={styles.kv}><Text style={styles.kvK}>Note</Text><Text style={styles.kvV}>{data.note}</Text></View> : null}
            </View>
          </View>

          <View style={styles.amountBox}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>AMOUNT CREDITED</Text>
              <Text style={styles.amountValue}>{inr(data.amount)}</Text>
            </View>
            <Text style={styles.amountWords}>
              In words: <Text style={styles.amountWordsEm}>{inWords(data.amount)} Rupees Only</Text>
            </Text>
          </View>

          <View style={styles.terms}>
            <Text style={styles.termsTitle}>Notes</Text>
            <Text style={styles.termsText}>
              1. This receipt acknowledges credit of the above amount into the branch wallet.
              {'  '}2. Amount once credited is non-refundable and may be used only towards platform-approved debits.
              {'  '}3. Retain this receipt for your records; reference the Receipt No. in all future queries.
            </Text>
          </View>

          <View style={styles.sigBlock}>
            <View style={styles.sigGroup}><View style={styles.sigLine} /><Text style={styles.sigLabel}>Branch Signatory</Text></View>
            <View style={styles.sigGroup}><View style={styles.sigLine} /><Text style={styles.sigLabel}>Authorised Signatory (HQ)</Text></View>
          </View>

          {/* Branch footer */}
          <View style={styles.branchFooter}>
            <View style={styles.branchFooterRow}>
              {data.branch.logo_url ? <Image src={data.branch.logo_url} style={styles.branchFooterLogo} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.branchFooterTitle}>{data.branch.name} ({data.branch.code})</Text>
                <Text style={styles.branchFooterSub}>{[data.branch.address, data.branch.phone].filter(Boolean).join('  \u00B7  ')}</Text>
              </View>
            </View>
            <Text style={styles.copyNote}>
              Computer-generated receipt. Branch copy / Head-office copy.
            </Text>
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
