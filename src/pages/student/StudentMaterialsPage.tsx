import { useEffect, useState } from 'react'
import { FileText, Download, Play, ExternalLink, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { parseVideoUrl } from '../../lib/video-url'

interface Row {
  id: string; title: string
  material_type: 'file' | 'video'
  file_url: string | null
  video_url: string | null
  video_provider: string | null
  uploaded_by_branch_id: string | null
  subject: { name: string } | null
}

export default function StudentMaterialsPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<Row[]>([])
  const [watching, setWatching] = useState<Row | null>(null)

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_study_materials')
      .select('id,title,material_type,file_url,video_url,video_provider,uploaded_by_branch_id,subject:uce_subjects(name)')
      .eq('course_id', rec.course_id).eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []).filter((m: Record<string, unknown>) =>
          m.uploaded_by_branch_id === null || m.uploaded_by_branch_id === rec.branch_id,
        )
        setRows(list as unknown as Row[])
      })
  }, [rec])

  function openMaterial(r: Row) {
    if (r.material_type === 'video') {
      const parsed = parseVideoUrl(r.video_url || '')
      if (parsed.embedUrl) {
        setWatching(r) // YouTube/Vimeo — embed in modal
      } else if (r.video_url) {
        window.open(r.video_url, '_blank', 'noopener,noreferrer')
      }
    } else if (r.file_url) {
      window.open(r.file_url, '_blank', 'noopener,noreferrer')
    }
  }

  const watchingEmbed = watching ? parseVideoUrl(watching.video_url || '').embedUrl : null

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Study Material</h1>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">No material yet.</div>
        ) : rows.map(r => {
          const isVideo = r.material_type === 'video'
          const thumb = isVideo ? parseVideoUrl(r.video_url || '').thumbnailUrl : null
          const parsed = isVideo ? parseVideoUrl(r.video_url || '') : null
          const hasEmbed = !!parsed?.embedUrl
          return (
            <button key={r.id} onClick={() => openMaterial(r)}
              className="w-full text-left rounded-xl border bg-white p-3 sm:p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
              {isVideo && thumb ? (
                <div className="relative h-14 w-20 rounded-lg overflow-hidden bg-black shrink-0">
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play size={18} className="text-white" fill="white" />
                  </div>
                </div>
              ) : (
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isVideo ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                  {isVideo ? <Play size={18} /> : <FileText size={18} />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  {isVideo && <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{r.video_provider}</span>}
                </div>
                {r.subject?.name && <p className="text-xs text-gray-500 truncate">{r.subject.name}</p>}
              </div>
              <span className="p-2 rounded-lg text-gray-500">
                {isVideo
                  ? (hasEmbed ? <Play size={16} /> : <ExternalLink size={16} />)
                  : <Download size={16} />}
              </span>
            </button>
          )
        })}
      </div>

      {watching && watchingEmbed && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3" onClick={() => setWatching(null)}>
          <div className="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <iframe src={watchingEmbed} className="absolute inset-0 w-full h-full" frameBorder="0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={watching.title} />
            <button onClick={() => setWatching(null)} className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
