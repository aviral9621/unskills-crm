/**
 * Static catalog of admin pages for the global Cmd+K search.
 * Keep titles + keywords lowercase-friendly. Paths match routes in App.tsx.
 */
export interface SearchEntry {
  title: string
  path: string
  category: 'Main' | 'Academics' | 'Management' | 'Website' | 'Settings'
  keywords?: string   // extra search terms (synonyms / abbreviations)
}

export const SEARCH_CATALOG: SearchEntry[] = [
  // Main
  { title: 'Dashboard', path: '/admin/dashboard', category: 'Main', keywords: 'home overview stats' },
  { title: 'Branches', path: '/admin/branches', category: 'Main', keywords: 'centers franchise branch' },
  { title: 'Users', path: '/admin/users', category: 'Main', keywords: 'staff admins permissions' },
  { title: 'Inquiries', path: '/admin/inquiries', category: 'Main', keywords: 'enquiries website contact' },
  { title: 'Leads Management', path: '/admin/leads', category: 'Main', keywords: 'whatsapp lead chat botbee' },
  { title: 'Wallet Requests', path: '/admin/branches/wallet-requests', category: 'Main', keywords: 'branch recharge reload approve' },

  // Academics
  { title: 'All Students', path: '/admin/students', category: 'Academics', keywords: 'registration enrolled learner' },
  { title: 'Register New Student', path: '/admin/students/register', category: 'Academics', keywords: 'new admission enrol' },
  { title: 'Student ID Card', path: '/admin/students/id-card', category: 'Academics', keywords: 'identity card' },
  { title: 'Admit Card', path: '/admin/students/admit-card', category: 'Academics', keywords: 'exam hall ticket' },
  { title: 'Programs', path: '/admin/courses/programs', category: 'Academics', keywords: 'course groups' },
  { title: 'All Courses', path: '/admin/courses', category: 'Academics' },
  { title: 'Subjects', path: '/admin/courses/subjects', category: 'Academics', keywords: 'papers topics' },
  { title: 'Batches', path: '/admin/courses/batches', category: 'Academics' },
  { title: 'Study Material', path: '/admin/study-material', category: 'Academics', keywords: 'notes pdf resources' },
  { title: 'Syllabus', path: '/admin/study-material/syllabus', category: 'Academics' },
  { title: 'Online Classes', path: '/admin/online-classes', category: 'Academics', keywords: 'live video zoom meet' },
  { title: 'Exam Paper Sets', path: '/admin/exams/paper-sets', category: 'Academics', keywords: 'tests question paper' },
  { title: 'Exam Results', path: '/admin/exams/results', category: 'Academics' },
  { title: 'Exam Forms', path: '/admin/exams/forms', category: 'Academics' },
  { title: 'Marksheets', path: '/admin/marksheets', category: 'Academics', keywords: 'mark sheet grade' },
  { title: 'Certificates', path: '/admin/certificates', category: 'Academics', keywords: 'certificate' },
  { title: 'Issue Certificate', path: '/admin/certificates/issue', category: 'Academics' },

  // Management
  { title: 'Departments', path: '/admin/staff/departments', category: 'Management' },
  { title: 'Employees', path: '/admin/staff/employees', category: 'Management' },
  { title: 'Attendance', path: '/admin/staff/attendance', category: 'Management' },
  { title: 'Salary Advances', path: '/admin/staff/advances', category: 'Management' },
  { title: 'Salary Slips', path: '/admin/staff/salary-slips', category: 'Management' },
  { title: 'Student Report', path: '/admin/reports/students', category: 'Management' },
  { title: 'Fees Report', path: '/admin/reports/fees', category: 'Management' },
  { title: 'Due Fees', path: '/admin/reports/due-fees', category: 'Management' },
  { title: 'Income Report', path: '/admin/reports/income', category: 'Management', keywords: 'revenue earnings' },
  { title: 'Expenses', path: '/admin/reports/expenses', category: 'Management', keywords: 'spend costs' },
  { title: 'Profit & Loss', path: '/admin/reports/profit-loss', category: 'Management', keywords: 'pnl p&l margin' },
  { title: 'Announcements', path: '/admin/announcements', category: 'Management' },
  { title: 'Support Tickets', path: '/admin/support/tickets', category: 'Management', keywords: 'help complaints' },
  { title: 'Promotions', path: '/admin/promotions', category: 'Management', keywords: 'marketing posters' },

  // Website
  { title: 'Photo Gallery', path: '/admin/website/gallery', category: 'Website' },
  { title: 'Banners', path: '/admin/website/banners', category: 'Website' },
  { title: 'Videos', path: '/admin/website/videos', category: 'Website' },
  { title: 'Newsletters', path: '/admin/website/newsletters', category: 'Website' },

  // Settings
  { title: 'Settings', path: '/admin/settings', category: 'Settings' },
  { title: 'My Profile', path: '/admin/profile', category: 'Settings' },
  { title: 'Certificate Settings', path: '/admin/certificates/settings', category: 'Settings' },
  { title: 'Marksheet Settings', path: '/admin/marksheets/settings', category: 'Settings' },
  { title: 'Admit Card Settings', path: '/admin/students/admit-card-settings', category: 'Settings' },
  { title: 'ID Card Settings', path: '/admin/students/id-card-settings', category: 'Settings' },
]

export function searchCatalog(query: string): SearchEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/)
  const scored: { entry: SearchEntry; score: number }[] = []
  for (const e of SEARCH_CATALOG) {
    const hay = (e.title + ' ' + (e.keywords || '') + ' ' + e.category).toLowerCase()
    let score = 0
    let matchedAll = true
    for (const t of tokens) {
      if (!hay.includes(t)) { matchedAll = false; break }
      if (e.title.toLowerCase().startsWith(t)) score += 3
      else if (e.title.toLowerCase().includes(t)) score += 2
      else score += 1
    }
    if (matchedAll) scored.push({ entry: e, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 25).map(s => s.entry)
}
