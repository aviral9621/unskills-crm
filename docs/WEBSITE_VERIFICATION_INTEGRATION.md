# UnSkills Website — Verification Integration Prompt

Hand this entire document to the website AI agent (the one working on
`github.com/aviral9621/Unskill-Computer-Education`). It gives the agent
exactly what it needs to make QR-code verification work end-to-end with
the CRM.

---

## 1. What we are building

Every ID Card, Admit Card, Marksheet, and Certificate issued by the
CRM contains a QR code. When a visitor scans that QR code with any
phone camera, it opens a URL on the UnSkills website that displays
the live student/document details pulled directly from the CRM's
Supabase database, with a **"Verified"** badge.

This document covers **Student ID Card verification** first. Admit
Card / Marksheet / Certificate endpoints will follow the same pattern
and are stubbed below.

---

## 2. URL structure (what the QR codes encode)

| Document          | URL                                                         |
|-------------------|-------------------------------------------------------------|
| Student ID Card   | `{WEBSITE_URL}/verify/id-card/{registrationNo}`             |
| Admit Card        | `{WEBSITE_URL}/verify/admit-card/{registrationNo}`          |
| Marksheet         | `{WEBSITE_URL}/verify/marksheet/{registrationNo}`           |
| Certificate       | `{WEBSITE_URL}/verify/certificate/{certificateNo}`          |

`WEBSITE_URL` is configurable in the CRM at
`Admin → Students → ID Card Settings → Verify Base URL`
(default: `https://www.unskillseducation.org`).

`registrationNo` in the URL may contain a forward slash (e.g.
`UCE/0001`). The CRM URL-encodes it to `UCE%2F0001`. Your route must
accept the decoded value.

Recommended route pattern: `/verify/id-card/*` (catch-all) or use
`encodeURIComponent`-aware routing so the slash survives.

---

## 3. Supabase connection

- **Project URL:** `https://srjcskpdpleggaheobid.supabase.co`
- **Anon (publishable) key:** `sb_publishable_Gnq1s4EwGz6B1V0yirGIAQ_cI9WiAVt`
  - This is safe to ship in the browser bundle; RLS protects the data.

Add these to your website `.env` as:
```
SUPABASE_URL=https://srjcskpdpleggaheobid.supabase.co
SUPABASE_ANON_KEY=sb_publishable_Gnq1s4EwGz6B1V0yirGIAQ_cI9WiAVt
```

Install `@supabase/supabase-js` and create a shared client.

---

## 4. Data source for verification

The CRM exposes a **public, read-only view** for ID-card verification:

```
uce_public_student_verification
```

Columns returned:

| column           | type        | notes                                        |
|------------------|-------------|----------------------------------------------|
| id               | uuid        |                                              |
| registration_no  | text        | primary lookup key (e.g. `UCE/0001`)         |
| name             | text        |                                              |
| father_name      | text        |                                              |
| mother_name      | text        |                                              |
| dob              | date        |                                              |
| gender           | text        |                                              |
| photo_url        | text        | full public URL on Supabase storage          |
| enrollment_date  | date        |                                              |
| session          | text        | e.g. `2024-2025`                             |
| is_active        | boolean     | already filtered to `true` in the view       |
| course_name      | text        |                                              |
| course_code      | text        |                                              |
| branch_name      | text        |                                              |
| branch_district  | text        |                                              |
| branch_state     | text        |                                              |

The view already hides deactivated students, so any row you get back
means the student record is **valid and active**.

### Example query

```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function getStudentByRegNo(regNo: string) {
  const { data, error } = await supabase
    .from('uce_public_student_verification')
    .select('*')
    .eq('registration_no', regNo)
    .maybeSingle()
  if (error) throw error
  return data  // null if not found / inactive
}
```

No auth needed — the view is granted `SELECT` to `anon` and
`authenticated` roles.

---

## 5. Page to build: `/verify/id-card/:registrationNo`

Render this UX (adapt to existing site theme):

- **If found (record returned):**
  - Big green "✓ Student Verified" badge at the top
  - Photo (from `photo_url`, fallback avatar if null)
  - Name (large), Registration No (monospace)
  - Two-column grid: Father's Name, Mother's Name, D.O.B., Gender,
    Course (name + code), Branch, District/State, Session,
    Enrollment Date
  - Small "Verified against UnSkills CRM at {timestamp}" line at
    bottom
- **If not found (data is null):**
  - Red "✗ Not a valid UnSkills ID" panel
  - "This registration number is not in our active student records."

Cache the page server-side for ~60 seconds max, or render fully at
request time — do **not** cache for longer, because a deactivated
student must stop verifying quickly.

---

## 6. Future endpoints (stubs — same pattern)

When the CRM next ships Admit Card / Marksheet / Certificate support,
these additional read-only views will be added and this document will
be updated:

- `uce_public_admit_card_verification` — for `/verify/admit-card/:regNo`
- `uce_public_marksheet_verification` — for `/verify/marksheet/:regNo`
- `uce_public_certificate_verification` — for `/verify/certificate/:certNo`

For now, route these paths to a generic "Coming soon" page or a 404.

---

## 7. What the CRM agent needs **from you** (reply with this)

Please reply with:

1. The exact **production website URL** (so we can set the default
   `Verify Base URL` in the CRM to match — currently set to
   `https://www.unskillseducation.org`).
2. The **framework** you're building the website in (Next.js app
   router? Pages router? Plain React + Vite? Astro?) so we can be
   precise in future integration steps.
3. Whether you'd prefer the QR to point to a verification page URL
   (current plan) or to encode a **signed JSON blob** directly
   (offline verifiable) — default plan is URL.
4. Whether the website's existing verification pages (ID card,
   marksheet, admit card, certificate) already exist at specific
   paths — if yes, share the paths, and we'll match them. If not,
   we'll use the `/verify/{type}/{id}` scheme above.

Once you confirm, we'll test end-to-end by:
- Issuing an ID card in the CRM,
- Scanning its QR with a phone,
- Expecting your page to load the live student record from the view
  above and render the "Verified" UI.

---

## 8. Quick smoke test you can run now

Before building the UI, confirm the view is reachable:

```bash
curl "https://srjcskpdpleggaheobid.supabase.co/rest/v1/uce_public_student_verification?select=*&limit=1" \
  -H "apikey: sb_publishable_Gnq1s4EwGz6B1V0yirGIAQ_cI9WiAVt"
```

Expected: HTTP 200 with a JSON array (empty `[]` is fine if no
students have been registered yet in the CRM).
