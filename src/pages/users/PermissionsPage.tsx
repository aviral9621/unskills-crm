import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import type { Profile } from '../../types'
import StatusBadge from '../../components/StatusBadge'

/* ─── Permission Module Definitions ─── */
interface PermModule {
  key: string
  label: string
  permissions: { key: string; label: string }[]
}

const PERMISSION_MODULES: PermModule[] = [
  { key: 'dashboard', label: 'Dashboard', permissions: [
    { key: 'dashboard.view', label: 'View Dashboard' },
  ]},
  { key: 'branch', label: 'Branches', permissions: [
    { key: 'branch.view', label: 'View Branches' },
    { key: 'branch.add', label: 'Add Branch' },
    { key: 'branch.edit', label: 'Edit Branch' },
    { key: 'branch.delete', label: 'Delete Branch' },
    { key: 'branch.wallet', label: 'Manage Wallet' },
  ]},
  { key: 'user', label: 'Users', permissions: [
    { key: 'user.view', label: 'View Users' },
    { key: 'user.add', label: 'Add User' },
    { key: 'user.edit', label: 'Edit User' },
    { key: 'user.delete', label: 'Delete User' },
    { key: 'user.permissions', label: 'Manage Permissions' },
  ]},
  { key: 'student', label: 'Students', permissions: [
    { key: 'student.view', label: 'View Students' },
    { key: 'student.register', label: 'Register Student' },
    { key: 'student.edit', label: 'Edit Student' },
    { key: 'student.delete', label: 'Delete Student' },
    { key: 'student.print', label: 'Print Application' },
    { key: 'student.idcard', label: 'Manage ID Cards' },
  ]},
  { key: 'course', label: 'Courses', permissions: [
    { key: 'course.view', label: 'View Courses' },
    { key: 'course.add', label: 'Add Course' },
    { key: 'course.edit', label: 'Edit Course' },
    { key: 'course.delete', label: 'Delete Course' },
  ]},
  { key: 'staff', label: 'Staff / Employees', permissions: [
    { key: 'staff.view', label: 'View Staff' },
    { key: 'staff.add', label: 'Add Employee' },
    { key: 'staff.edit', label: 'Edit Employee' },
    { key: 'staff.delete', label: 'Delete Employee' },
    { key: 'staff.attendance', label: 'Manage Attendance' },
    { key: 'staff.salary', label: 'Salary Slips' },
  ]},
  { key: 'inquiry', label: 'Inquiries', permissions: [
    { key: 'inquiry.view', label: 'View Inquiries' },
    { key: 'inquiry.respond', label: 'Respond' },
    { key: 'inquiry.delete', label: 'Delete' },
  ]},
  { key: 'material', label: 'Study Material', permissions: [
    { key: 'material.view', label: 'View Materials' },
    { key: 'material.add', label: 'Upload Material' },
    { key: 'material.delete', label: 'Delete Material' },
  ]},
  { key: 'class', label: 'Online Classes', permissions: [
    { key: 'class.view', label: 'View Classes' },
    { key: 'class.add', label: 'Add Class' },
    { key: 'class.edit', label: 'Edit Class' },
    { key: 'class.delete', label: 'Delete Class' },
  ]},
  { key: 'exam', label: 'Online Exam', permissions: [
    { key: 'exam.view', label: 'View Exams' },
    { key: 'exam.create', label: 'Create Paper Set' },
    { key: 'exam.edit', label: 'Edit Paper Set' },
    { key: 'exam.questions', label: 'Manage Questions' },
    { key: 'exam.results', label: 'Manage Results' },
  ]},
  { key: 'marksheet', label: 'Marksheet', permissions: [
    { key: 'marksheet.view', label: 'View' },
    { key: 'marksheet.generate', label: 'Generate' },
    { key: 'marksheet.download', label: 'Download' },
  ]},
  { key: 'certificate', label: 'Certificate', permissions: [
    { key: 'certificate.view', label: 'View' },
    { key: 'certificate.generate', label: 'Generate' },
    { key: 'certificate.download', label: 'Download' },
  ]},
  { key: 'admitcard', label: 'Admit Card', permissions: [
    { key: 'admitcard.view', label: 'View' },
    { key: 'admitcard.generate', label: 'Generate' },
    { key: 'admitcard.download', label: 'Download' },
  ]},
  { key: 'report', label: 'Reports', permissions: [
    { key: 'report.student', label: 'Student Report' },
    { key: 'report.fees', label: 'Fees Report' },
    { key: 'report.duefees', label: 'Due Fees' },
  ]},
  { key: 'finance', label: 'Finance', permissions: [
    { key: 'finance.income', label: 'Income Report' },
    { key: 'finance.expense', label: 'Expenses' },
    { key: 'finance.pnl', label: 'Profit & Loss' },
  ]},
  { key: 'website', label: 'Website', permissions: [
    { key: 'website.gallery', label: 'Photo Gallery' },
    { key: 'website.banner', label: 'Banners' },
    { key: 'website.video', label: 'Videos' },
    { key: 'website.newsletter', label: 'Newsletters' },
  ]},
]

const ALL_KEYS = PERMISSION_MODULES.flatMap(m => m.permissions.map(p => p.key))

export default function PermissionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()

  const [user, setUser] = useState<Profile | null>(null)
  const [branchName, setBranchName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [granted, setGranted] = useState<Set<string>>(new Set())

  useEffect(() => { if (id) fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    try {
      const [profileRes, permsRes] = await Promise.all([
        supabase.from('uce_profiles').select('*, branch:uce_branches(name)').eq('id', id).single(),
        supabase.from('uce_permissions').select('permission_key, granted').eq('user_id', id),
      ])
      if (profileRes.error) throw profileRes.error
      if (!profileRes.data) { toast.error('User not found'); navigate('/admin/users'); return }

      setUser(profileRes.data as unknown as Profile)
      setBranchName((profileRes.data as unknown as { branch?: { name: string } }).branch?.name || 'All')

      const grantedKeys = new Set<string>()
      permsRes.data?.forEach(p => { if (p.granted) grantedKeys.add(p.permission_key) })
      setGranted(grantedKeys)
    } catch { toast.error('Failed to load permissions') }
    finally { setLoading(false) }
  }

  function toggle(key: string) {
    setGranted(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function toggleModule(mod: PermModule) {
    const keys = mod.permissions.map(p => p.key)
    const allChecked = keys.every(k => granted.has(k))
    setGranted(prev => {
      const next = new Set(prev)
      keys.forEach(k => { if (allChecked) next.delete(k); else next.add(k) })
      return next
    })
  }

  function selectAll() { setGranted(new Set(ALL_KEYS)) }
  function deselectAll() { setGranted(new Set()) }

  async function handleSave() {
    if (!id || !authUser) return
    setSaving(true)
    try {
      // Delete existing permissions then insert new
      await supabase.from('uce_permissions').delete().eq('user_id', id)

      const rows = ALL_KEYS.map(key => ({
        user_id: id,
        permission_key: key,
        granted: granted.has(key),
        granted_by: authUser.id,
      }))

      const { error } = await supabase.from('uce_permissions').insert(rows)
      if (error) throw error
      toast.success('Permissions saved successfully')
    } catch { toast.error('Failed to save permissions') }
    finally { setSaving(false) }
  }

  const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', branch_admin: 'Branch Admin', branch_staff: 'Branch Staff' }

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="skeleton h-8 w-64 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => navigate('/admin/users')} className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-gray-900 font-heading truncate">Permissions — {user?.full_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge label={ROLE_LABELS[user?.role || ''] || user?.role || ''} variant="info" />
              <span className="text-xs text-gray-400">{branchName}</span>
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm shrink-0">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-3">
        <button onClick={selectAll} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1">
          <CheckSquare size={14} /> Select All
        </button>
        <button onClick={deselectAll} className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <Square size={14} /> Deselect All
        </button>
        <span className="text-xs text-gray-400 ml-auto">{granted.size} of {ALL_KEYS.length} selected</span>
      </div>

      {/* Permission Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PERMISSION_MODULES.map(mod => {
          const modKeys = mod.permissions.map(p => p.key)
          const checkedCount = modKeys.filter(k => granted.has(k)).length
          const allChecked = checkedCount === modKeys.length
          const someChecked = checkedCount > 0 && !allChecked

          return (
            <div key={mod.key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Module header */}
              <button onClick={() => toggleModule(mod)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left">
                <div className="w-1 h-5 rounded-full bg-red-500 shrink-0" />
                <span className="text-sm font-semibold text-gray-900 flex-1">{mod.label}</span>
                <div className={cn(
                  'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                  allChecked ? 'bg-red-600 border-red-600' : someChecked ? 'bg-red-200 border-red-400' : 'border-gray-300'
                )}>
                  {(allChecked || someChecked) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d={allChecked ? 'M5 13l4 4L19 7' : 'M5 12h14'} /></svg>}
                </div>
              </button>
              {/* Permission checkboxes */}
              <div className="p-3 space-y-1">
                {mod.permissions.map(perm => {
                  const checked = granted.has(perm.key)
                  return (
                    <label key={perm.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={checked} onChange={() => toggle(perm.key)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 focus:ring-offset-0 cursor-pointer" />
                      <span className={cn('text-sm', checked ? 'text-gray-900 font-medium' : 'text-gray-500')}>{perm.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom save */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 flex items-center justify-between">
        <span className="text-xs text-gray-500">{granted.size} permissions selected</span>
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
