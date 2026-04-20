import { useEffect, useState } from 'react'
import { Video, PlayCircle, Film } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStudentRecord } from './useStudent'
import { formatDateDDMMYYYY } from '../../lib/utils'

interface ClassRow {
  id: string; class_name: string; platform: string; link: string
  schedule_date: string | null; schedule_time: string | null
  end_time: string | null; is_recording: boolean
  description: string | null; thumbnail_url: string | null
  subject: { name: string } | null
}

function platformIcon(p: string) {
  if (p === 'youtube') return <Film size={14} className="text-red-600" />
  return <Video size={14} className="text-red-600" />
}

function toEmbed(link: string): string | null {
  // Accept youtube watch / youtu.be / embed URLs, return embed src
  const m1 = link.match(/youtu\.be\/([\w-]{6,})/)
  if (m1) return `https://www.youtube.com/embed/${m1[1]}`
  const m2 = link.match(/youtube\.com\/watch\?v=([\w-]{6,})/)
  if (m2) return `https://www.youtube.com/embed/${m2[1]}`
  const m3 = link.match(/youtube\.com\/embed\/([\w-]{6,})/)
  if (m3) return link
  return null
}

export default function StudentClassesPage() {
  const { rec } = useStudentRecord()
  const [rows, setRows] = useState<ClassRow[]>([])

  useEffect(() => {
    if (!rec) return
    supabase.from('uce_online_classes')
      .select('id,class_name,platform,link,schedule_date,schedule_time,end_time,is_recording,description,thumbnail_url,subject:uce_subjects(name)')
      .eq('course_id', rec.course_id)
      .eq('is_active', true)
      .order('schedule_date', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as ClassRow[]))
  }, [rec])

  if (!rec) return null
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = rows.filter(r => !r.is_recording && (r.schedule_date ?? '9999-12-31') >= today)
  const recordings = rows.filter(r => r.is_recording)

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-bold font-heading">Live & Recorded Classes</h1>

      <section>
        <p className="font-semibold mb-2 text-sm">Upcoming & Live</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {upcoming.length === 0 ? (
            <div className="sm:col-span-2 rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
              No upcoming classes scheduled.
            </div>
          ) : upcoming.map(c => (
            <div key={c.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  {platformIcon(c.platform)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold break-words">{c.class_name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {c.platform.replace('_', ' ')}{c.subject?.name && ` · ${c.subject.name}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.schedule_date && formatDateDDMMYYYY(c.schedule_date)} {c.schedule_time && c.schedule_time.slice(0, 5)}
                  </p>
                </div>
              </div>
              {c.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.description}</p>}
              <a href={c.link} target="_blank" rel="noreferrer"
                 className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
                <PlayCircle size={14} /> Join Class
              </a>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-semibold mb-2 text-sm">Recorded Classes</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recordings.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
              No recordings yet.
            </div>
          ) : recordings.map(c => {
            const embed = toEmbed(c.link)
            return (
              <div key={c.id} className="rounded-xl border bg-white overflow-hidden">
                {embed ? (
                  <div className="aspect-video">
                    <iframe src={embed} title={c.class_name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
                  </div>
                ) : c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt="" className="w-full aspect-video object-cover" />
                ) : (
                  <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-300"><PlayCircle size={40} /></div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-sm break-words">{c.class_name}</p>
                  {c.subject?.name && <p className="text-xs text-gray-500">{c.subject.name}</p>}
                  {c.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.description}</p>}
                  <a href={c.link} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs font-semibold text-red-600 hover:underline">Open video →</a>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
