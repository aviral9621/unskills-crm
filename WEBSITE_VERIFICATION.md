# UnSkills — ID Card QR Verification: Website Setup

The QR code printed on every student ID card encodes a URL like:

```
https://www.unskillseducation.org/verify/id-card/UCE%2F0001
```

When this URL is opened, the **website** (unskillseducation.org, a separate
Next.js project) is responsible for fetching the student from Supabase and
showing a public "Student Verified" page.

Right now scanning the QR lands on the website but shows nothing — that route
doesn't exist yet on the website repo. This document gives a working drop-in
implementation.

---

## Prerequisites

Install the Supabase JS client on the **website** repo (not this CRM repo):

```bash
npm install @supabase/supabase-js
```

Add two env vars in the website's `.env.local` and Vercel project settings:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://srjcskpdpleggaheobid.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the legacy anon JWT (or a publishable key) from the Supabase dashboard → Settings → API |

> ⚠️ **Do not** paste the service role key here — this page is public.

---

## Make the student row publicly readable (one-time)

The `uce_students` table has RLS. Run this migration in the Supabase SQL editor
**once**, so the public verification endpoint can read the handful of fields
needed for the verification card (name, photo, course, reg no) — and nothing
else:

```sql
-- Public, read-only view with ONLY the fields safe to show on a verification page.
create or replace view public.v_public_student_verify as
select
  s.id,
  s.registration_no,
  s.name,
  s.father_name,
  s.dob,
  s.photo_url,
  s.session,
  s.admission_year,
  s.is_active,
  c.name  as course_name,
  b.name  as branch_name,
  b.code  as branch_code,
  b.center_logo_url as branch_logo_url
from public.uce_students s
left join public.uce_courses  c on c.id = s.course_id
left join public.uce_branches b on b.id = s.branch_id
where s.is_active = true;

grant select on public.v_public_student_verify to anon, authenticated;
```

The view intentionally excludes phone, email, Aadhaar, address, fees — those
never reach the public page.

---

## The verification page (Next.js App Router)

Create `app/verify/id-card/[regno]/page.tsx` on the **website** repo:

```tsx
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Params = { params: { regno: string } }

export default async function VerifyIdCard({ params }: Params) {
  const regno = decodeURIComponent(params.regno)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data: student } = await supabase
    .from('v_public_student_verify')
    .select('*')
    .eq('registration_no', regno)
    .maybeSingle()

  if (!student) notFound()

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-700 text-white px-5 py-4 flex items-center gap-3">
          {student.branch_logo_url && (
            <Image
              src={student.branch_logo_url}
              alt=""
              width={44}
              height={44}
              className="rounded-full bg-white p-1"
              unoptimized
            />
          )}
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">Verified Student</p>
            <p className="text-base font-bold leading-tight">{student.branch_name}</p>
          </div>
        </div>

        {/* Photo + name */}
        <div className="px-5 pt-5 pb-4 flex flex-col items-center">
          {student.photo_url ? (
            <Image
              src={student.photo_url}
              alt=""
              width={112}
              height={112}
              className="rounded-xl border border-gray-200 object-cover"
              unoptimized
            />
          ) : (
            <div className="h-28 w-28 rounded-xl bg-gray-100 flex items-center justify-center text-3xl text-gray-400">
              {student.name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="mt-3 text-lg font-bold text-red-700 uppercase text-center">
            {student.name}
          </p>
        </div>

        {/* Fields */}
        <dl className="px-5 pb-5 text-sm">
          <Row k="Registration No." v={student.registration_no} />
          <Row k="Father's Name" v={student.father_name?.toUpperCase() || '—'} />
          <Row k="D.O.B." v={student.dob ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
          <Row k="Course" v={student.course_name || '—'} />
          <Row k="Session" v={student.session || '—'} />
        </dl>

        <div className="bg-green-50 border-t border-green-200 px-5 py-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <p className="text-xs text-green-800">This ID card is genuine and active.</p>
        </div>
      </div>
    </main>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex py-1.5 border-b border-gray-100 last:border-0">
      <dt className="w-32 text-gray-500">{k}</dt>
      <dd className="flex-1 font-semibold text-gray-900">: {v}</dd>
    </div>
  )
}
```

Create `app/verify/id-card/[regno]/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl p-8">
        <p className="text-red-600 font-bold text-lg">Student Not Found</p>
        <p className="text-sm text-gray-500 mt-2">
          This ID card could not be verified. Either the registration number is
          wrong, or the student's account is no longer active.
        </p>
      </div>
    </main>
  )
}
```

---

## Verifying it works

1. On the CRM (this repo), download any ID card.
2. Scan the QR with any phone camera.
3. The browser should open `https://www.unskillseducation.org/verify/id-card/UCE%2F0001`.
4. You should see the verification card above with the student's photo, name,
   course, reg no, and a green "genuine" strip.

If you see a 404 you landed on a working route but the student row is missing
or inactive. Re-check the `registration_no` and the `is_active` flag.

If you see a blank page, the route itself doesn't exist yet on the website
repo — add the two files above, commit, and redeploy.

---

## How the URL is built (CRM side)

The QR URL pattern is centralized in `src/lib/cardSettings.ts` on the CRM repo:

```ts
export function idCardVerifyUrl(registrationNo: string, base?: string) {
  const b = (base || 'https://www.unskillseducation.org').replace(/\/$/, '')
  return `${b}/verify/id-card/${encodeURIComponent(registrationNo)}`
}
```

The base URL can be overridden per-branch via ID-card Settings in the CRM.
If you ever move verification to a new domain, change it once there — the QR
codes on all future ID cards will follow.
