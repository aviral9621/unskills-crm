import { useBranch } from '../../lib/franchise'
import { useAuth } from '../../contexts/AuthContext'
import { formatINR, formatDateDDMMYYYY } from '../../lib/utils'

export default function FProfilePage() {
  const branch = useBranch()
  const { profile } = useAuth()
  if (!branch || !profile) return <p className="text-sm text-gray-500">Loading…</p>

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Institute Profile</h1>
        <p className="text-sm text-gray-500">Read-only — contact head office to update.</p>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <Row label="Name" value={branch.name} />
        <Row label="Code" value={branch.code} />
        <Row label="Category" value={branch.category} />
        <Row label="Director" value={`${branch.director_name} · ${branch.director_phone}`} />
        <Row label="Address" value={`${branch.address_line1 ?? ''} ${branch.district ?? ''}, ${branch.state ?? ''} ${branch.pincode ?? ''}`} />
        <Row label="Joined" value={formatDateDDMMYYYY(branch.joined_at)} />
        <Row label="Wallet Balance" value={formatINR(branch.wallet_balance)} />
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Logged in as</h2>
        <Row label="Name" value={profile.full_name} />
        <Row label="Email" value={profile.email ?? '—'} />
        <Row label="Role" value={profile.role} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm border-b pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
