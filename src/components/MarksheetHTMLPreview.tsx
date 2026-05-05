import React from 'react'
import { X, Download, Loader2 } from 'lucide-react'

const C = {
  pageBg: '#FDFBF5',
  blockTint: '#FBF7EC',
  borderPrimary: '#8B1A2B',
  borderAccent: '#C8102E',
  borderSoft: '#D4C9B0',
  gradeHighlight: '#F4C430',
  textPrimary: '#0A0A0A',
  textSecondary: '#4A4A4A',
  textLabel: '#6B5E3C',
  semesterTint: '#F4E8D0',
  white: '#FFFFFF',
  green: '#16A34A',
  greenLight: '#22C55E',
  amber: '#EAB308',
  orange: '#F97316',
  red: '#DC2626',
}

const LEGEND_DOT_COLORS = [C.green, C.greenLight, C.amber, C.orange, C.red]

const CERT_LOGOS = [
  { src: '/ISO LOGOs.png', label: 'ISO' },
  { src: '/MSME loogo.png', label: 'MSME' },
  { src: '/Skill India Logo.png', label: 'Skill India' },
  { src: '/NSDC logo.png', label: 'NSDC' },
  { src: '/Digital India logo.png', label: 'Digital India' },
  { src: '/ANSI logo.png', label: 'ANSI' },
  { src: '/IAF LOGO.png', label: 'IAF' },
]

export interface SubjectRow {
  subject_id: string
  code: string | null
  name: string
  semester: number | null
  theory_max: number
  theory_obtained: number | null
  practical_max: number
  practical_obtained: number | null
  total: number
}

export interface GradeBand {
  label: string
  min: number
  max: number
  grade: string
}

export interface MarksheetPreviewData {
  serial_no: string
  issue_date: string | null
  grade: string | null
  result: string | null
  percentage: number | null
  total_obtained: number | null
  total_max: number | null
  is_final: boolean
  roll_no: string
  subjects: SubjectRow[]
  grading_scheme?: GradeBand[]
  session: string | null
  student_name: string
  registration_no: string
  father_name: string
  enrollment_date: string | null
  center_name: string
  center_code: string
  center_address: string
  course_name: string
  course_duration: string
  signer_name: string
  signer_title: string
  signer_org: string
  signature_url?: string | null
  footer_address: string
  website: string
  email?: string | null
  notes?: string | null
  qrDataUrl: string
  logoDataUrl: string
  photoDataUrl: string
}

const DEFAULT_GRADES: GradeBand[] = [
  { label: 'Excellent', min: 85, max: 100, grade: 'A+' },
  { label: 'Very Good', min: 75, max: 84, grade: 'A' },
  { label: 'Good', min: 60, max: 74, grade: 'B' },
  { label: 'Pass', min: 40, max: 59, grade: 'C' },
  { label: 'Fail', min: 0, max: 39, grade: 'F' },
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function semLabel(n: number) {
  const sfx = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${sfx} Semester`
}

interface Props {
  data: MarksheetPreviewData
  onClose: () => void
  onDownload?: () => Promise<void>
  downloading?: boolean
}

export default function MarksheetHTMLPreview({ data, onClose, onDownload, downloading }: Props) {
  const subjects = data.subjects ?? []
  const semesters = Array.from(new Set(subjects.map(r => r.semester ?? 0))).sort((a, b) => a - b)
  const grading: GradeBand[] = data.grading_scheme?.length ? data.grading_scheme : DEFAULT_GRADES

  let zebraIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{data.student_name}</p>
          <p className="text-xs text-gray-400 font-mono truncate">{data.serial_no || '—'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {data.is_final && onDownload && (
            <button
              onClick={onDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download PDF
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-4 sm:py-6 px-2 sm:px-4" style={{ backgroundColor: '#EFE9D6' }}>
        {/* Document */}
        <div className="max-w-3xl mx-auto p-1 shadow-2xl" style={{ backgroundColor: C.pageBg }}>
          <div className="p-1" style={{ border: `2px solid ${C.borderPrimary}` }}>
            <div className="p-3 sm:p-5" style={{ border: `1px solid ${C.borderAccent}` }}>

              {/* Header */}
              <div className="flex items-start gap-2 sm:gap-4">
                <div className="shrink-0">
                  {data.logoDataUrl
                    ? <img src={data.logoDataUrl} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                    : <img src="/MAIN LOGO FOR ALL CARDS.png" alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />}
                </div>
                <div className="flex-1 min-w-0 text-center px-1">
                  <h1
                    className="font-bold tracking-wider uppercase leading-tight text-[13px] sm:text-[17px]"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    <span style={{ color: C.textPrimary }}>UN</span>
                    <span style={{ color: C.borderAccent }}>SKILLS</span>
                    <span style={{ color: C.textPrimary }}> COMPUTER EDUCATION</span>
                  </h1>
                  <p className="text-[8px] sm:text-[9px] mt-1 leading-snug" style={{ color: C.textSecondary }}>
                    An ISO 9001:2015 Certified Organization
                    <span className="font-bold mx-1" style={{ color: C.borderPrimary }}>•</span>
                    Run by UnSkills FuturePath Tech Pvt. Ltd.
                  </p>
                  <p className="text-[8px] sm:text-[9px] leading-snug" style={{ color: C.textSecondary }}>
                    Alliance with Skill India, MSME, NSDC
                    <span className="font-bold mx-1" style={{ color: C.borderPrimary }}>•</span>
                    Registered under Company Act 2013
                  </p>
                </div>
                <div className="shrink-0 text-right text-[8px] sm:text-[9px] font-bold" style={{ color: C.textPrimary, maxWidth: 110 }}>
                  <p className="font-mono break-all">Reg. No.: {data.serial_no || '—'}</p>
                </div>
              </div>

              {/* Title + diamond divider */}
              <div className="flex flex-col items-center mt-3 sm:mt-4">
                <h2
                  className="font-bold uppercase text-[13px] sm:text-[16px]"
                  style={{ color: C.textPrimary, letterSpacing: '0.22em' }}
                >
                  Statement of Marks
                </h2>
                <svg width="80" height="10" className="my-1" aria-hidden>
                  <line x1="0" y1="5" x2="32" y2="5" stroke={C.borderPrimary} strokeWidth="1" />
                  <path d="M 40 1 L 45 5 L 40 9 L 35 5 Z" fill={C.borderPrimary} />
                  <line x1="48" y1="5" x2="80" y2="5" stroke={C.borderPrimary} strokeWidth="1" />
                </svg>
                {data.session && (
                  <p className="text-[9px] sm:text-[11px]" style={{ color: C.textSecondary }}>
                    Session: {data.session}
                  </p>
                )}
              </div>

              {/* Mobile photo */}
              <div className="sm:hidden mt-3 flex justify-center">
                {data.photoDataUrl ? (
                  <img src={data.photoDataUrl} alt="" className="object-cover"
                    style={{ width: 90, height: 104, border: `2px solid ${C.borderPrimary}`, borderRadius: 2 }} />
                ) : (
                  <div className="flex items-center justify-center text-2xl font-bold"
                    style={{ width: 90, height: 104, border: `2px solid ${C.borderPrimary}`, borderRadius: 2, backgroundColor: '#EDE5D0', color: C.textLabel }}>
                    {data.student_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>

              {/* Student info block */}
              <div className="mt-3 sm:mt-4 flex" style={{ border: `1px solid ${C.borderSoft}`, backgroundColor: C.blockTint }}>
                <div className="flex-1 text-[10px] sm:text-[11px]">
                  <InfoRow dividerBelow>
                    <InfoCell label="Candidate Name" value={data.student_name} />
                    <InfoCell label="Enrollment No" value={data.registration_no} />
                  </InfoRow>
                  <InfoRow dividerBelow>
                    <InfoCell label="Father's Name" value={data.father_name || '—'} />
                    <InfoCell label="Roll No" value={data.roll_no || '—'} />
                  </InfoRow>
                  <InfoRow dividerBelow>
                    <InfoCell label="Training Center" value={data.center_name} />
                    <InfoCell label="Center Code" value={data.center_code} />
                  </InfoRow>
                  <InfoRow dividerBelow>
                    <InfoCell label="Course Name" value={data.course_name} />
                    <InfoCell label="Course Duration" value={data.course_duration} />
                  </InfoRow>
                  <InfoRow>
                    <InfoCell label="Date of Registration" value={fmtDate(data.enrollment_date)} />
                    <InfoCell label="Center Address" value={data.center_address || '—'} />
                  </InfoRow>
                </div>
                {/* Desktop photo */}
                <div className="hidden sm:flex shrink-0 items-center justify-center p-2"
                  style={{ borderLeft: `1px solid ${C.borderSoft}`, backgroundColor: C.pageBg, width: 80 }}>
                  {data.photoDataUrl ? (
                    <img src={data.photoDataUrl} alt="" className="object-cover"
                      style={{ width: 64, height: 74, border: `2px solid ${C.borderPrimary}`, borderRadius: 2 }} />
                  ) : (
                    <div className="flex items-center justify-center text-lg font-bold"
                      style={{ width: 64, height: 74, border: `2px solid ${C.borderPrimary}`, borderRadius: 2, backgroundColor: '#EDE5D0', color: C.textLabel }}>
                      {data.student_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              </div>

              {/* Marks table */}
              <div className="mt-3 sm:mt-4" style={{ border: `1px solid ${C.borderSoft}` }}>
                <table className="w-full border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: '44%' }} />
                    <col style={{ width: '21%' }} />
                    <col style={{ width: '21%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: C.borderPrimary }}>
                      <th className="text-center py-1.5 px-1.5 uppercase text-[9px] sm:text-[10px] font-bold"
                        style={{ color: C.white, letterSpacing: '0.04em', borderRight: '1px solid rgba(255,255,255,0.4)' }}>
                        Subject
                      </th>
                      <th className="text-center py-1 px-1 uppercase text-[9px] sm:text-[10px] font-bold"
                        style={{ color: C.white, letterSpacing: '0.04em', borderRight: '1px solid rgba(255,255,255,0.4)' }}>
                        Theory
                        <div className="text-[7px] sm:text-[8px] font-normal opacity-80 normal-case tracking-normal">Max | Obt</div>
                      </th>
                      <th className="text-center py-1 px-1 uppercase text-[9px] sm:text-[10px] font-bold"
                        style={{ color: C.white, letterSpacing: '0.04em', borderRight: '1px solid rgba(255,255,255,0.4)' }}>
                        Practical
                        <div className="text-[7px] sm:text-[8px] font-normal opacity-80 normal-case tracking-normal">Max | Obt</div>
                      </th>
                      <th className="text-center py-1.5 px-1 uppercase text-[9px] sm:text-[10px] font-bold"
                        style={{ color: C.white, letterSpacing: '0.04em' }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesters.map(sem => {
                      const list = subjects.filter(r => (r.semester ?? 0) === sem)
                      if (list.length === 0) return null
                      return (
                        <React.Fragment key={`sem-${sem}`}>
                          {sem > 0 && (
                            <tr style={{ backgroundColor: C.semesterTint }}>
                              <td colSpan={4} className="px-2 py-1 text-center font-bold text-[9px] sm:text-[10px]"
                                style={{ color: C.textLabel, borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}>
                                {semLabel(sem)}
                              </td>
                            </tr>
                          )}
                          {list.map(row => {
                            const bg = zebraIdx % 2 === 0 ? C.white : C.blockTint
                            zebraIdx++
                            return (
                              <tr key={row.subject_id} style={{ backgroundColor: bg }}>
                                <td className="px-2 py-1.5 text-[9px] sm:text-[10px] text-left break-words"
                                  style={{ color: '#1A1A1A', borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}` }}>
                                  {row.code ? `${row.code} — ${row.name}` : row.name}
                                </td>
                                <td className="px-1.5 py-1.5 text-[9px] sm:text-[10px] font-bold text-center whitespace-nowrap"
                                  style={{ color: C.textPrimary, borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}` }}>
                                  {row.theory_max || '—'} | {row.theory_obtained ?? '—'}
                                </td>
                                <td className="px-1.5 py-1.5 text-[9px] sm:text-[10px] font-bold text-center whitespace-nowrap"
                                  style={{ color: C.textPrimary, borderBottom: `1px solid ${C.borderSoft}`, borderRight: `1px solid ${C.borderSoft}` }}>
                                  {row.practical_max || '—'} | {row.practical_obtained ?? '—'}
                                </td>
                                <td className="px-1.5 py-1.5 text-[9px] sm:text-[10px] font-bold text-center"
                                  style={{ color: C.textPrimary, borderBottom: `1px solid ${C.borderSoft}` }}>
                                  {row.total || '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                    {/* Total row */}
                    <tr style={{ backgroundColor: C.borderPrimary }}>
                      <td className="px-2 py-1.5 text-[10px] sm:text-[11px] font-bold text-left uppercase"
                        style={{ color: C.white, letterSpacing: '0.04em', borderRight: '1px solid rgba(255,255,255,0.4)' }}>
                        Total
                      </td>
                      <td className="px-1.5 py-1.5 text-[10px] sm:text-[11px] font-bold text-center" style={{ color: C.white, borderRight: '1px solid rgba(255,255,255,0.4)' }}>—</td>
                      <td className="px-1.5 py-1.5 text-[10px] sm:text-[11px] font-bold text-center" style={{ color: C.white, borderRight: '1px solid rgba(255,255,255,0.4)' }}>—</td>
                      <td className="px-1.5 py-1.5 text-[10px] sm:text-[11px] font-bold text-center" style={{ color: C.white }}>
                        {data.total_obtained ?? '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Grade legend */}
              <div className="mt-3 sm:mt-4 flex justify-between gap-1 py-1.5 px-2 sm:px-3"
                style={{ border: `1px solid ${C.borderSoft}`, backgroundColor: C.blockTint }}>
                {grading.map((band, i) => (
                  <div key={band.label} className="flex-1 flex flex-col items-center">
                    <div className="flex items-center">
                      <svg width="8" height="8" aria-hidden>
                        <circle cx="4" cy="4" r="3" fill={LEGEND_DOT_COLORS[i] || C.green} />
                      </svg>
                      <span className="ml-1 text-[8px] sm:text-[9px] font-bold" style={{ color: C.textPrimary }}>{band.label}</span>
                    </div>
                    <span className="text-[7px] sm:text-[8px]" style={{ color: C.textSecondary }}>
                      {band.min}%–{band.max}% – {band.grade}
                    </span>
                  </div>
                ))}
              </div>

              {/* Final grade banner */}
              <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 py-2" style={{ backgroundColor: C.borderPrimary }}>
                <span className="text-[11px] sm:text-[13px] font-bold uppercase" style={{ color: C.white, letterSpacing: '0.12em' }}>
                  Final Grade:
                </span>
                <span className="text-[15px] sm:text-[18px] font-bold" style={{ color: C.gradeHighlight }}>
                  {data.grade || '—'}
                </span>
              </div>

              {data.notes && (
                <p className="mt-1 text-[8px] text-center" style={{ color: C.textSecondary }}>{data.notes}</p>
              )}

              {/* QR + Signature */}
              <div className="mt-3 sm:mt-4 flex items-start justify-between gap-3">
                <div className="flex flex-col items-start">
                  <div className="p-1 bg-white" style={{ border: `1px solid ${C.borderSoft}` }}>
                    {data.qrDataUrl ? (
                      <img src={data.qrDataUrl} alt="Scan to verify" style={{ width: 60, height: 60, display: 'block' }} />
                    ) : (
                      <div className="flex items-center justify-center text-[9px] font-bold"
                        style={{ width: 60, height: 60, color: C.textLabel }}>QR</div>
                    )}
                  </div>
                  <p className="text-[8px] sm:text-[9px] font-bold mt-1" style={{ color: C.textLabel, width: 62, textAlign: 'center' }}>
                    Scan to verify
                  </p>
                  <p className="text-[8px] sm:text-[9px] font-bold mt-1.5" style={{ color: C.textLabel }}>
                    Date of Issue: {fmtDate(data.issue_date)}
                  </p>
                </div>

                <div className="flex flex-col items-end max-w-[220px]">
                  {data.signature_url && (
                    <img src={data.signature_url} alt="Signature" className="object-contain mb-1"
                      style={{ height: 36, maxWidth: 150, alignSelf: 'flex-end' }} />
                  )}
                  <div className="w-[140px] border-t" style={{ borderColor: C.borderPrimary, borderTopWidth: 1, marginBottom: 4 }} />
                  <p className="text-[10px] sm:text-[11px] font-bold text-right" style={{ color: C.textPrimary }}>
                    {data.signer_name || '—'}
                  </p>
                  <p className="text-[8px] sm:text-[9px] text-right" style={{ color: C.textSecondary }}>{data.signer_title}</p>
                  <p className="text-[8px] sm:text-[9px] text-right" style={{ color: C.textSecondary }}>{data.signer_org}</p>
                </div>
              </div>

              {/* Cert strip */}
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-2 px-2 sm:px-3"
                style={{ backgroundColor: C.blockTint, borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}>
                {CERT_LOGOS.map(l => (
                  <img key={l.label} src={l.src} alt={l.label} className="object-contain shrink-0" style={{ height: 22, maxWidth: 52 }} />
                ))}
              </div>

              {/* Footer */}
              <div className="mt-3 sm:mt-4 text-center leading-snug">
                <p className="text-[8px] sm:text-[9px]" style={{ color: C.textSecondary }}>
                  <span className="font-bold" style={{ color: C.textPrimary }}>Head Office: </span>
                  {data.footer_address}
                </p>
                <p className="text-[8px] sm:text-[9px] mt-0.5" style={{ color: C.textSecondary }}>
                  Website for verification: <span className="font-bold" style={{ color: C.textPrimary }}>{data.website}</span>
                  {data.email && (
                    <>
                      <span className="font-bold mx-1.5" style={{ color: C.borderPrimary }}>•</span>
                      Email: <span className="font-bold" style={{ color: C.textPrimary }}>{data.email}</span>
                    </>
                  )}
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ children, dividerBelow }: { children: React.ReactNode; dividerBelow?: boolean }) {
  return (
    <div className="flex" style={dividerBelow ? { borderBottom: `1px solid ${C.borderSoft}` } : undefined}>
      {children}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 py-1.5 px-2 sm:px-2.5 first:border-r" style={{ borderRightColor: C.borderSoft, borderRightWidth: 1 }}>
      <span className="font-bold" style={{ color: C.textLabel }}>{label} : </span>
      <span className="font-bold break-words" style={{ color: C.textPrimary }}>{value}</span>
    </div>
  )
}
