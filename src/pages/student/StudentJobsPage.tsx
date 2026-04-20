import { useEffect, useState } from 'react'
import { Briefcase, MapPin, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface Row {
  id: string; title: string; company: string | null; location: string | null
  description: string | null; apply_url: string | null; contact_info: string | null
  deadline: string | null
}

export default function StudentJobsPage() {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    supabase.from('uce_jobs').select('id,title,company,location,description,apply_url,contact_info,deadline').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }, [])
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Jobs</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.length === 0 ? (
          <div className="sm:col-span-2 rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
            <Briefcase size={28} className="mx-auto mb-2 text-gray-300" />No jobs posted.
          </div>
        ) : rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white p-4">
            <p className="font-semibold break-words">{r.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
              {r.company && <span>{r.company}</span>}
              {r.location && <span className="flex items-center gap-1"><MapPin size={10} />{r.location}</span>}
            </p>
            {r.description && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{r.description}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                {r.deadline && <><Clock size={10} /> By {formatDateDDMMYYYY(r.deadline)}</>}
              </span>
              {r.apply_url && <a href={r.apply_url} target="_blank" rel="noreferrer" className="font-semibold text-red-600 hover:underline">Apply →</a>}
            </div>
            {r.contact_info && <p className="mt-2 text-xs text-gray-500 break-words">Contact: {r.contact_info}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
