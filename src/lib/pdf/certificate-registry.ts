import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Program-based certificate template registry.
 *
 * WHY HARDCODED: Programs are fixed business entities. Each program has ONE
 * certificate design determined by business decision, not user choice. A DB
 * table or admin UI would be unnecessary overhead for a handful of static rows.
 *
 * TO ADD A NEW PROGRAM TEMPLATE:
 *   1. Design the template PDF (Canva / any editor) in A4 landscape or portrait
 *   2. Place it at /public/certificates/<program-slug>-<orientation>.jpg
 *   3. Add an entry to PROGRAM_CERTIFICATE_REGISTRY below
 *   4. Ensure a generator exists for its `generatorKey` (see cert-generator.ts)
 *   5. Rebuild — no DB migration, no config, no redeploy of Supabase.
 */

export type CertificateOrientation = 'landscape' | 'portrait'

export interface ProgramCertificateConfig {
  programSlug: string
  programName: string
  templatePath: string
  orientation: CertificateOrientation
  generatorKey: string
}

export const PROGRAM_CERTIFICATE_REGISTRY: ProgramCertificateConfig[] = [
  {
    programSlug: 'computer-software',
    programName: 'Computer Software Courses',
    templatePath: '/certificates/computer-software-landscape.jpg',
    orientation: 'landscape',
    generatorKey: 'computer-software-landscape',
  },
  {
    programSlug: 'hardware-networking',
    programName: 'Hardware & Networking',
    templatePath: '/certificates/hardware-networking-landscape.jpg',
    orientation: 'landscape',
    generatorKey: 'hardware-networking-landscape',
  },
  {
    programSlug: 'skills-development',
    programName: 'Skills Development Course',
    templatePath: '/certificates/skills-development-landscape.jpg',
    orientation: 'landscape',
    generatorKey: 'skills-development-landscape',
  },
  {
    programSlug: 'beautician',
    programName: 'Beautician Courses',
    templatePath: '/certificates/beautician-landscape.jpg',
    orientation: 'landscape',
    generatorKey: 'beautician-landscape',
  },
  {
    programSlug: 'summer-training',
    programName: 'Summer Training',
    templatePath: '/certificates/summer-training-landscape.jpg',
    orientation: 'landscape',
    generatorKey: 'summer-training-landscape',
  },
  {
    programSlug: 'typing',
    programName: 'Typing Course',
    templatePath: '/certificates/typing-portrait.jpg',
    orientation: 'portrait',
    generatorKey: 'typing-portrait',
  },

  // ⏳ PENDING (client has not provided designs yet):
  // - nielit-govt
  // - university
  // - diploma
]

/**
 * Given a course ID, find its program slug by following
 * course.program_id → uce_programs.slug. Returns null if not found.
 */
export async function getProgramSlugForCourse(
  courseId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('uce_courses')
    .select('program:uce_programs(slug)')
    .eq('id', courseId)
    .single()
  if (error || !data) return null
  const program = (data as unknown as { program?: { slug?: string } | { slug?: string }[] | null }).program
  if (!program) return null
  if (Array.isArray(program)) return program[0]?.slug ?? null
  return program.slug ?? null
}

/**
 * Get certificate config for a program slug. Returns null if the program has
 * no registered template (callers should surface a clean error).
 */
export function getCertificateConfig(
  programSlug: string,
): ProgramCertificateConfig | null {
  return PROGRAM_CERTIFICATE_REGISTRY.find(c => c.programSlug === programSlug) ?? null
}

/**
 * UI helper: is a certificate available for this course's program?
 * Used to enable/disable the "Issue Certificate" button gracefully.
 */
export async function canIssueCertificate(
  courseId: string,
  supabase: SupabaseClient,
): Promise<{ canIssue: boolean; reason?: string; programName?: string; programSlug?: string }> {
  const slug = await getProgramSlugForCourse(courseId, supabase)
  if (!slug) return { canIssue: false, reason: 'Course has no associated program' }

  const config = getCertificateConfig(slug)
  if (!config) {
    return {
      canIssue: false,
      reason: `Certificate template for this program ("${slug}") is not yet available`,
      programSlug: slug,
    }
  }
  return { canIssue: true, programName: config.programName, programSlug: slug }
}
