/**
 * Auto-issue a certificate as a side-effect of marksheet generation.
 *
 * Flow: admin saves a marksheet → if course is certificate-eligible AND no
 * active certificate already exists for that student+course, we insert a
 * minimal uce_certificates row populated from the marksheet's student/course/
 * marks data. PDF is NOT generated here — staff/students can download it
 * on-demand from the certificate detail page (the registry resolves the right
 * template + generator from course_id at download time).
 *
 * This is best-effort: any failure is logged & swallowed so it never blocks
 * the marksheet flow.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { canIssueCertificate } from '../pdf/certificate-registry'

interface AutoIssueArgs {
  studentId: string
  courseId: string
  /** Final grade from the marksheet ("A+", "A", "B", ... "F") */
  grade: string | null
  /** Result string from marksheet ("pass" | "fail") */
  result: string | null
  /** Marks scored (typically the percentage) */
  marksScored: number
  /** Issuer (auth user id) */
  issuedBy?: string | null
  supabase: SupabaseClient
}

interface AutoIssueResult {
  ok: boolean
  certificateId?: string
  certificateNumber?: string
  skipped?: 'already_exists' | 'failed_result' | 'not_eligible'
  reason?: string
}

const PERFORMANCE_BY_GRADE: Record<string, string> = {
  'A+': 'Excellent',
  'A':  'Very Good',
  'B':  'Good',
  'C':  'Satisfactory',
  'D':  'Pass',
  'F':  'Fail',
}

export async function autoIssueCertificateForMarksheet(
  args: AutoIssueArgs,
): Promise<AutoIssueResult> {
  const { studentId, courseId, grade, result, marksScored, issuedBy, supabase } = args

  try {
    // 0. Don't issue for failed results
    if ((result || '').toLowerCase() === 'fail') {
      return { ok: false, skipped: 'failed_result' }
    }

    // 1. Skip if course/program isn't certificate-eligible
    const eligible = await canIssueCertificate(courseId, supabase)
    if (!eligible.canIssue) {
      return { ok: false, skipped: 'not_eligible', reason: eligible.reason }
    }

    // 2. Skip if an active certificate already exists for this student+course
    const { data: existing } = await supabase
      .from('uce_certificates')
      .select('id, certificate_number')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .maybeSingle()
    if (existing?.id) {
      return {
        ok: true,
        skipped: 'already_exists',
        certificateId: existing.id,
        certificateNumber: existing.certificate_number,
      }
    }

    // 3. Load student + course + branch + settings
    interface LoadedStudent {
      id: string
      registration_no: string
      name: string
      father_name: string | null
      photo_url: string | null
      course_id: string
      branch_id: string | null
      course?: { id: string; code: string | null; name: string } | null
      branch?: { id: string; name: string; b_code: string | null; code: string | null } | null
    }
    const { data: studentRaw } = await supabase
      .from('uce_students')
      .select(
        'id, registration_no, name, father_name, photo_url, course_id, branch_id, ' +
        'course:uce_courses(id, code, name), ' +
        'branch:uce_branches!uce_students_branch_id_fkey(id, name, b_code, code)',
      )
      .eq('id', studentId)
      .single()
    if (!studentRaw) return { ok: false, reason: 'Student not found' }
    const student = studentRaw as unknown as LoadedStudent

    const branch = student.branch
    const course = student.course

    const centerCode = branch?.b_code || branch?.code || ''
    if (!centerCode) {
      return { ok: false, reason: 'Branch has no center code' }
    }

    // 4. Get default certificate template (FK is NOT NULL)
    const { data: tpl } = await supabase
      .from('uce_certificate_templates')
      .select('id')
      .eq('slug', 'certificate-of-qualification')
      .maybeSingle()
    const fallbackTpl = tpl?.id ? null : await supabase
      .from('uce_certificate_templates')
      .select('id')
      .limit(1)
      .maybeSingle()
    const templateId = tpl?.id ?? fallbackTpl?.data?.id ?? null
    if (!templateId) return { ok: false, reason: 'No certificate template configured' }

    // 5. Get certificate settings for verification URL base
    const { data: settings } = await supabase
      .from('uce_certificate_settings')
      .select('verification_url_base')
      .limit(1)
      .maybeSingle()
    const baseUrl = (settings?.verification_url_base || '').replace(/\/+$/, '')

    // 6. Generate certificate number
    const { data: numData, error: numErr } = await supabase.rpc('generate_certificate_number', {
      p_center_code: centerCode,
    })
    if (numErr) return { ok: false, reason: numErr.message }
    const certNumber = numData as string
    const qrTarget = baseUrl ? `${baseUrl}/verify/certificate/${encodeURIComponent(certNumber)}` : ''

    const performanceText = PERFORMANCE_BY_GRADE[grade || ''] || 'Pass'

    // 7. Insert certificate row (no PDF generation here — on-demand later)
    const insertRow = {
      certificate_number: certNumber,
      student_id: studentId,
      template_id: templateId,
      course_id: courseId,
      branch_id: student.branch_id,
      salutation: 'Mr.',
      student_name: student.name,
      father_prefix: 'S/o',
      father_name: student.father_name || '',
      student_photo_url: student.photo_url,
      course_code: course?.code || '',
      course_name: course?.name || '',
      training_center_name: branch?.name || '',
      training_center_code: centerCode,
      enrollment_number: student.registration_no,
      performance_text: performanceText,
      marks_scored: Math.round(marksScored),
      grade: grade || 'A',
      qr_target_url: qrTarget,
      issue_date: new Date().toISOString().slice(0, 10),
      issued_by: issuedBy || null,
      status: 'active',
    }

    const { data: inserted, error: insErr } = await supabase
      .from('uce_certificates')
      .insert(insertRow)
      .select('id')
      .single()
    if (insErr) return { ok: false, reason: insErr.message }

    return { ok: true, certificateId: inserted.id, certificateNumber: certNumber }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Unknown error' }
  }
}
