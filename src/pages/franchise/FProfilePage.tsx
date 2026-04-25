import { useEffect, useState, useCallback } from 'react'
import {
  UserCircle, Building2, KeyRound, Save, Loader2, Upload,
  FileBadge2, CreditCard, Download, Phone, Mail, MapPin, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import FormField, { inputClass } from '../../components/FormField'
import { useAuth } from '../../contexts/AuthContext'
import { useBranch, useBranchId } from '../../lib/franchise'
import { supabase } from '../../lib/supabase'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import { downloadAtcCertificate } from '../../lib/atcCertificate'
import { getMarksheetSettings } from '../../lib/marksheetSettings'
import { getCardSettings } from '../../lib/cardSettings'

// ── Shared image-upload widget ────────────────────────────────────────────────

function ImgUpload({
  value, label, onFile, uploading, shape = 'square',
}: {
  value: string | null
  label: string
  onFile: (f: File) => void
  uploading: boolean
  shape?: 'circle' | 'square'
}) {
  const [error, setError] = useState('')
  const handle = useCallback((file: File) => {
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP'); return
    }
    if (file.size > 500 * 1024) { setError('Max 500 KB'); return }
    onFile(file)
  }, [onFile])

  const base = shape === 'circle'
    ? 'h-20 w-20 rounded-full'
    : 'h-20 w-20 rounded-xl'

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        {value
          ? <img src={value} alt={label}
              className={`${base} object-cover border-2 border-white shadow ring-2 ring-red-100`} />
          : <div className={`${base} bg-gray-100 flex items-center justify-center border border-gray-200`}>
              <Upload size={20} className="text-gray-400" />
            </div>
        }
        {uploading && (
          <div className={`absolute inset-0 ${base} bg-black/50 flex items-center justify-center`}>
            <Loader2 className="animate-spin text-white" size={18} />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
          <Upload size={13} />
          <span>{value ? 'Change' : 'Upload'} {label}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }} />
        </label>
        <p className="text-[11px] text-gray-400">JPG, PNG, WebP · max 500 KB</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

// ── Utility helpers ───────────────────────────────────────────────────────────

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'D'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const branchId = useBranchId()
  const branch = useBranch()
  const isAdmin = profile?.role === 'branch_admin'

  // Editable branch fields
  const [directorName, setDirectorName] = useState('')
  const [directorPhone, setDirectorPhone] = useState('')
  const [directorEmail, setDirectorEmail] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [village, setVillage] = useState('')
  const [block, setBlock] = useState('')
  const [district, setDistrict] = useState('')
  const [stateName, setStateName] = useState('')
  const [pincode, setPincode] = useState('')
  const [directorImageUrl, setDirectorImageUrl] = useState<string | null>(null)
  const [centerLogoUrl, setCenterLogoUrl] = useState<string | null>(null)

  // Personal info (from uce_profiles)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Loading states
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingBranch, setSavingBranch] = useState(false)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [downloadingCert, setDownloadingCert] = useState(false)
  const [downloadingIdCard, setDownloadingIdCard] = useState(false)

  // Password change
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  useEffect(() => {
    if (!branch) return
    setDirectorName(branch.director_name ?? '')
    setDirectorPhone(branch.director_phone ?? '')
    setDirectorEmail(branch.director_email ?? '')
    setAddressLine1(branch.address_line1 ?? '')
    setVillage(branch.village ?? '')
    setBlock(branch.block ?? '')
    setDistrict(branch.district ?? '')
    setStateName(branch.state ?? '')
    setPincode(branch.pincode ?? '')
    setDirectorImageUrl(branch.director_image_url)
    setCenterLogoUrl(branch.center_logo_url)
  }, [branch])

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setPhone(profile.phone ?? '')
  }, [profile])

  // ── Upload handlers ───────────────────────────────────────────────────────

  async function handlePhotoUpload(file: File) {
    if (!branchId) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const url = await uploadPublicFile(
        STORAGE_BUCKETS.branchAssets,
        `${branchId}/director-photo-${Date.now()}.${ext}`,
        file,
      )
      const { error } = await supabase.from('uce_branches')
        .update({ director_image_url: url }).eq('id', branchId)
      if (error) throw error
      setDirectorImageUrl(url)
      toast.success('Director photo updated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploadingPhoto(false) }
  }

  async function handleLogoUpload(file: File) {
    if (!branchId) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const url = await uploadPublicFile(
        STORAGE_BUCKETS.branchAssets,
        `${branchId}/center-logo-${Date.now()}.${ext}`,
        file,
      )
      const { error } = await supabase.from('uce_branches')
        .update({ center_logo_url: url }).eq('id', branchId)
      if (error) throw error
      setCenterLogoUrl(url)
      toast.success('Institute logo updated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploadingLogo(false) }
  }

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function handleSaveBranch() {
    if (!branchId) return
    if (!directorName.trim()) { toast.error('Director name is required'); return }
    if (!district.trim() || !stateName.trim()) { toast.error('District and state are required'); return }
    setSavingBranch(true)
    try {
      const { error } = await supabase.from('uce_branches').update({
        director_name: directorName.trim(),
        director_phone: directorPhone.trim() || null,
        director_email: directorEmail.trim() || null,
        address_line1: addressLine1.trim() || null,
        village: village.trim() || null,
        block: block.trim() || null,
        district: district.trim(),
        state: stateName.trim(),
        pincode: pincode.trim() || null,
      }).eq('id', branchId)
      if (error) throw error
      toast.success('Branch details updated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSavingBranch(false) }
  }

  async function handleSavePersonal() {
    if (!profile) return
    if (!fullName.trim()) { toast.error('Full name is required'); return }
    setSavingPersonal(true)
    try {
      const { error } = await supabase.from('uce_profiles').update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Personal info updated')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSavingPersonal(false) }
  }

  // ── Download: ATC Certificate ─────────────────────────────────────────────

  async function handleDownloadAtcCert() {
    if (!branchId || !branch) return
    setDownloadingCert(true)
    try {
      await downloadAtcCertificate(branchId, branch.name)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Download failed') }
    finally { setDownloadingCert(false) }
  }

  // ── Download: Director ID Card ────────────────────────────────────────────

  async function handleDownloadDirectorIdCard() {
    if (!branchId || !branch) return
    setDownloadingIdCard(true)
    try {
      const { data: cert } = await supabase
        .from('uce_atc_certificates')
        .select('atc_code')
        .eq('branch_id', branchId)
        .single()

      const [msSettings, cardSettings] = await Promise.all([
        getMarksheetSettings().catch(() => null),
        getCardSettings(),
      ])

      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      const [masterLogoData, photoData, logoData] = await Promise.all([
        toDataUrl(`${origin}/MAIN LOGO FOR ALL CARDS.png`).catch(() => ''),
        (directorImageUrl || branch.director_image_url)
          ? toDataUrl((directorImageUrl || branch.director_image_url)!).catch(() => '')
          : Promise.resolve(''),
        (centerLogoUrl || branch.center_logo_url)
          ? toDataUrl((centerLogoUrl || branch.center_logo_url)!).catch(() => '')
          : Promise.resolve(''),
      ])

      const atcCode = cert?.atc_code || branch.code
      const verifyBase = msSettings?.verify_base_url || 'https://www.unskillseducation.org'
      const qrData = await QRCode.toDataURL(`${verifyBase}/verify/branch/${atcCode}`, {
        margin: 1, width: 320, color: { dark: '#111827', light: '#ffffff' },
      })

      let sigData = ''
      const sigSrc = msSettings?.left_signature_url
      if (sigSrc) {
        sigData = sigSrc.startsWith('data:') ? sigSrc : await toDataUrl(sigSrc).catch(() => '')
      }

      const { pdf, Document, Page, View, Text, Image: PdfImage, StyleSheet, Font } =
        await import('@react-pdf/renderer')
      try {
        Font.register({
          family: 'Roboto',
          fonts: [
            { src: `${origin}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
            { src: `${origin}/fonts/Roboto-Bold.ttf`,    fontWeight: 700 },
          ],
        })
      } catch { /* already registered */ }

      const PRIMARY = '#B91C1C'
      const INK = '#111827'
      const MUTED = '#6B7280'
      const BORDER = '#E5E7EB'

      const s = StyleSheet.create({
        page:         { fontFamily: 'Roboto', padding: 36, backgroundColor: '#FFFFFF', color: INK, fontSize: 10 },
        brandWrap:    { alignItems: 'center', paddingBottom: 8 },
        brandRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        brandLogo:    { width: 40, height: 40, marginRight: 10, objectFit: 'contain' },
        brandUn:      { fontSize: 24, fontWeight: 700, color: INK, letterSpacing: 0.3 },
        brandSk:      { fontSize: 24, fontWeight: 700, color: PRIMARY, letterSpacing: 0.3 },
        brandTail:    { fontSize: 18, fontWeight: 700, color: INK, letterSpacing: 0.5, marginLeft: 6 },
        hqLine:       { fontSize: 8.5, color: MUTED, marginTop: 3, textAlign: 'center' },
        hr:           { height: 1, backgroundColor: BORDER, marginTop: 10 },
        titleWrap:    { alignItems: 'center', marginTop: 16 },
        titlePill:    { backgroundColor: PRIMARY, paddingHorizontal: 22, paddingVertical: 7, borderRadius: 999 },
        titleText:    { color: '#FFFFFF', fontSize: 12, fontWeight: 700, letterSpacing: 3 },
        cardWrap:     { marginTop: 20, borderWidth: 1.2, borderColor: BORDER, borderRadius: 10, padding: 22 },
        topRow:       { flexDirection: 'row', alignItems: 'center' },
        photo:        { width: 130, height: 150, objectFit: 'cover', borderRadius: 6, borderWidth: 1.5, borderColor: BORDER },
        photoPh:      { width: 130, height: 150, borderRadius: 6, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
        photoPhText:  { fontSize: 64, color: '#FFFFFF', fontWeight: 700 },
        topRight:     { flex: 1, paddingLeft: 20 },
        nameText:     { fontSize: 24, fontWeight: 700, color: INK, letterSpacing: 0.4 },
        desigText:    { fontSize: 14, fontWeight: 700, color: PRIMARY, marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
        codeRow:      { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
        codeLabel:    { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
        codePill:     { marginLeft: 6, backgroundColor: '#FEF2F2', borderWidth: 0.8, borderColor: '#F3C7C7', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, color: PRIMARY, fontSize: 11, fontWeight: 700 },
        infoGrid:     { marginTop: 18, flexDirection: 'row', gap: 18 },
        infoCol:      { flex: 1 },
        infoRow:      { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.6, borderBottomColor: BORDER },
        infoKey:      { width: 90, fontSize: 9, color: MUTED },
        infoVal:      { flex: 1, fontSize: 10, fontWeight: 700, color: INK },
        qrRow:        { flexDirection: 'row', marginTop: 22, alignItems: 'flex-end' },
        qrCol:        { alignItems: 'center' },
        qrImg:        { width: 110, height: 110 },
        qrCaption:    { fontSize: 7.5, color: MUTED, marginTop: 4, textAlign: 'center', maxWidth: 130 },
        sigCol:       { flex: 1, alignItems: 'flex-end' },
        sigImg:       { width: 140, height: 45, objectFit: 'contain' },
        sigLine:      { borderTopWidth: 0.8, borderTopColor: INK, width: 170, marginTop: 2, marginBottom: 3 },
        sigAuth:      { fontSize: 10, fontWeight: 700, color: INK },
        sigDesig:     { fontSize: 8, color: MUTED },
        branchFooter: { marginTop: 22, paddingTop: 10, borderTopWidth: 0.6, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center' },
        branchLogo:   { width: 34, height: 34, borderRadius: 17, marginRight: 10, objectFit: 'cover' },
        branchTitle:  { fontSize: 11, fontWeight: 700, color: INK },
        branchSub:    { fontSize: 8, color: MUTED, marginTop: 1 },
        validityBox:  { marginTop: 10, padding: 6, borderWidth: 0.6, borderStyle: 'dashed', borderColor: '#F3C7C7', borderRadius: 4 },
        validityText: { fontSize: 8, color: '#555', textAlign: 'center' },
      })

      const dName = directorName || branch.director_name
      const dPhone = directorPhone || branch.director_phone
      const dEmail = directorEmail || branch.director_email
      const branchAddr = [
        addressLine1 || branch.address_line1,
        village      || branch.village,
        block        || branch.block,
        district     || branch.district,
        stateName    || branch.state,
        pincode      || branch.pincode,
      ].filter(Boolean).join(', ')
      const initials = getInitials(dName)
      const effectiveLogo = logoData || masterLogoData

      const Doc = (
        <Document>
          <Page size="A4" style={s.page}>
            {/* Brand header */}
            <View style={s.brandWrap}>
              <View style={s.brandRow}>
                {masterLogoData ? <PdfImage src={masterLogoData} style={s.brandLogo} /> : null}
                <Text style={s.brandUn}>UN</Text>
                <Text style={s.brandSk}>SKILLS</Text>
                <Text style={s.brandTail}>COMPUTER EDUCATION</Text>
              </View>
              <Text style={s.hqLine}>{cardSettings.header_subtitle}</Text>
              <Text style={s.hqLine}>{cardSettings.address}</Text>
              <Text style={s.hqLine}>Ph: {cardSettings.phone} · {cardSettings.website}</Text>
            </View>
            <View style={s.hr} />

            <View style={s.titleWrap}>
              <View style={s.titlePill}>
                <Text style={s.titleText}>BRANCH DIRECTOR IDENTITY CARD</Text>
              </View>
            </View>

            <View style={s.cardWrap}>
              <View style={s.topRow}>
                {photoData
                  ? <PdfImage src={photoData} style={s.photo} />
                  : <View style={s.photoPh}><Text style={s.photoPhText}>{initials}</Text></View>}
                <View style={s.topRight}>
                  <Text style={s.nameText}>{dName.toUpperCase()}</Text>
                  <Text style={s.desigText}>Branch Director</Text>
                  <View style={s.codeRow}>
                    <Text style={s.codeLabel}>ATC Code</Text>
                    <Text style={s.codePill}>{atcCode}</Text>
                  </View>
                </View>
              </View>

              <View style={s.infoGrid}>
                <View style={s.infoCol}>
                  <View style={s.infoRow}><Text style={s.infoKey}>Branch Name</Text><Text style={s.infoVal}>{branch.name}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Branch Code</Text><Text style={s.infoVal}>{branch.code}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Category</Text><Text style={s.infoVal}>{branch.category.toUpperCase()}</Text></View>
                </View>
                <View style={s.infoCol}>
                  <View style={s.infoRow}><Text style={s.infoKey}>Mobile No.</Text><Text style={s.infoVal}>{dPhone || '—'}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Email</Text><Text style={s.infoVal}>{dEmail || '—'}</Text></View>
                  <View style={s.infoRow}><Text style={s.infoKey}>Qualification</Text><Text style={s.infoVal}>{branch.director_qualification || '—'}</Text></View>
                </View>
              </View>

              <View style={s.qrRow}>
                <View style={s.qrCol}>
                  {qrData
                    ? <PdfImage src={qrData} style={s.qrImg} />
                    : <View style={[s.qrImg, { backgroundColor: '#F3F4F6' }]} />}
                  <Text style={s.qrCaption}>Scan to verify authorization</Text>
                </View>
                <View style={s.sigCol}>
                  {sigData ? <PdfImage src={sigData} style={s.sigImg} /> : null}
                  <View style={s.sigLine} />
                  <Text style={s.sigAuth}>{msSettings?.left_signer_name || 'Er. Ankit Vishwakarma'}</Text>
                  <Text style={s.sigDesig}>{msSettings?.left_signer_title || 'Chief Executive Officer'}</Text>
                </View>
              </View>

              <View style={s.validityBox}>
                <Text style={s.validityText}>
                  This card is the property of UnSkills Computer Education. If found, please return to the issuing branch.
                </Text>
              </View>
            </View>

            {/* Branch footer */}
            <View style={s.branchFooter}>
              {effectiveLogo
                ? <PdfImage src={effectiveLogo} style={s.branchLogo} />
                : <View style={[s.branchLogo, { backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 700 }}>{branch.name.charAt(0).toUpperCase()}</Text>
                  </View>}
              <View style={{ flex: 1 }}>
                <Text style={s.branchTitle}>{branch.name}</Text>
                <Text style={s.branchSub}>{branchAddr}</Text>
              </View>
            </View>
          </Page>
        </Document>
      )

      const blob = await pdf(Doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Director-ID-Card-${(branch.code || branch.id).replace(/[^\w-]/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Director ID Card downloaded')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Failed to generate ID card')
    } finally {
      setDownloadingIdCard(false)
    }
  }

  // ── Change Password ───────────────────────────────────────────────────────

  async function handleChangePassword() {
    if (!user?.email) { toast.error('No email on session'); return }
    if (!currentPwd) { toast.error('Enter your current password'); return }
    if (newPwd.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match'); return }
    if (newPwd === currentPwd) { toast.error('New password must be different from current'); return }
    setChangingPwd(true)
    try {
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email, password: currentPwd,
      })
      if (reauthErr) { toast.error('Current password is incorrect'); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
      if (updateErr) { toast.error(updateErr.message); return }
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      toast.success('Password updated successfully')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to change password') }
    finally { setChangingPwd(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!branch) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" /></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <UserCircle size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Institute Profile</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage your institute details, documents, and account</p>
        </div>
      </div>

      {/* ── Photos & Logo ── */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Photos &amp; Logo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Director / Owner Photo</p>
              <ImgUpload
                value={directorImageUrl}
                label="Photo"
                onFile={handlePhotoUpload}
                uploading={uploadingPhoto}
                shape="circle"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Institute Logo</p>
              <ImgUpload
                value={centerLogoUrl}
                label="Logo"
                onFile={handleLogoUpload}
                uploading={uploadingLogo}
                shape="square"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Branch Details ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <Building2 size={14} className="text-red-600" /> Branch Details
        </h2>

        {/* Read-only overview chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Branch Name', value: branch.name },
            { label: 'Branch Code', value: branch.code },
            { label: 'Category', value: branch.category },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-gray-900 capitalize truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Editable contact + address */}
        <div className="pt-1 space-y-4">
          <FormField label="Director / Owner Name" required>
            <input
              value={directorName}
              onChange={e => setDirectorName(e.target.value)}
              disabled={!isAdmin}
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Mobile Number">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={directorPhone}
                  onChange={e => setDirectorPhone(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="+91 9876543210"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </FormField>
            <FormField label="Email">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={directorEmail}
                  onChange={e => setDirectorEmail(e.target.value)}
                  disabled={!isAdmin}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </FormField>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <MapPin size={12} className="text-gray-400" /> Address
            </p>
            <div className="space-y-3">
              <FormField label="Address Line 1">
                <input
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="House/Plot No., Street, Area"
                  className={inputClass}
                />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Village / Locality">
                  <input value={village} onChange={e => setVillage(e.target.value)} disabled={!isAdmin} className={inputClass} />
                </FormField>
                <FormField label="Block / Tehsil">
                  <input value={block} onChange={e => setBlock(e.target.value)} disabled={!isAdmin} className={inputClass} />
                </FormField>
                <FormField label="District" required>
                  <input value={district} onChange={e => setDistrict(e.target.value)} disabled={!isAdmin} className={inputClass} />
                </FormField>
                <FormField label="State" required>
                  <input value={stateName} onChange={e => setStateName(e.target.value)} disabled={!isAdmin} className={inputClass} />
                </FormField>
                <FormField label="Pincode">
                  <input value={pincode} onChange={e => setPincode(e.target.value)} disabled={!isAdmin} className={inputClass} />
                </FormField>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveBranch}
              disabled={savingBranch}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
            >
              {savingBranch ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {savingBranch ? 'Saving…' : 'Save Branch Details'}
            </button>
          </div>
        )}
      </div>

      {/* ── Personal Info (logged-in user) ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Personal Information</h2>
        <FormField label="Full Name" required>
          <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email" hint="Contact head office to change">
            <input value={user?.email ?? profile?.email ?? ''} disabled className={inputClass} />
          </FormField>
          <FormField label="Phone">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" className={`${inputClass} pl-9`} />
            </div>
          </FormField>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSavePersonal}
            disabled={savingPersonal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
          >
            {savingPersonal ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {savingPersonal ? 'Saving…' : 'Save Personal Info'}
          </button>
        </div>
      </div>

      {/* ── Documents ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <FileBadge2 size={14} className="text-red-600" /> Documents
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ATC Certificate */}
          <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <FileBadge2 size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Authorization Certificate</p>
                <p className="text-xs text-gray-500">ATC certificate issued by head office</p>
              </div>
            </div>
            <button
              onClick={handleDownloadAtcCert}
              disabled={downloadingCert}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {downloadingCert ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloadingCert ? 'Generating…' : 'Download Certificate'}
            </button>
          </div>

          {/* Director ID Card */}
          <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <CreditCard size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Director ID Card</p>
                <p className="text-xs text-gray-500">Official identity card for branch director</p>
              </div>
            </div>
            <button
              onClick={handleDownloadDirectorIdCard}
              disabled={downloadingIdCard}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {downloadingIdCard ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloadingIdCard ? 'Generating…' : 'Download ID Card'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Change Password</h2>
        </div>
        <FormField label="Current Password" required>
          <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} autoComplete="current-password" className={inputClass} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="New Password" required hint="Minimum 8 characters">
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoComplete="new-password" className={inputClass} />
          </FormField>
          <FormField label="Confirm New Password" required>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password" className={inputClass} />
          </FormField>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleChangePassword}
            disabled={changingPwd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 shadow-sm"
          >
            {changingPwd ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {changingPwd ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="pb-6" />
    </div>
  )
}
