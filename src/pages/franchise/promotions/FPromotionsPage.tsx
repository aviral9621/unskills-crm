import { useEffect, useState } from 'react'
import { Download, Megaphone, FileText } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatDateDDMMYYYY } from '../../../lib/utils'

interface Row {
  id: string; title: string; description: string | null
  file_url: string; file_name: string | null; file_type: string | null
  thumbnail_url: string | null; created_at: string
}

export default function FPromotionsPage() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    supabase.from('uce_promotional_materials').select('*').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">Promotion Material</h1>
        <p className="text-sm text-gray-500">Marketing assets shared by the head office.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-400 sm:col-span-2 lg:col-span-3">
            <Megaphone size={28} className="mx-auto mb-2 text-gray-300" />Nothing shared yet.
          </div>
        ) : rows.map(r => {
          const isImage = r.file_type?.startsWith('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(r.file_name || '')
          return (
            <div key={r.id} className="rounded-xl border bg-white overflow-hidden">
              {r.thumbnail_url || isImage ? (
                <img src={r.thumbnail_url || r.file_url} alt={r.title} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-gray-50 text-gray-300">
                  <FileText size={36} />
                </div>
              )}
              <div className="p-4">
                <p className="font-semibold truncate">{r.title}</p>
                {r.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{r.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{formatDateDDMMYYYY(r.created_at)}</span>
                  <a href={r.file_url} target="_blank" rel="noreferrer" download
                     className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
                    <Download size={12} /> Download
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
