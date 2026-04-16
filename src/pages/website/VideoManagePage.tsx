import { useEffect, useState } from 'react'
import { Video, Plus, Trash2, Power, Pencil, ExternalLink, Play } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface VideoLink {
  id: string; title: string; youtube_url: string; display_order: number
  is_active: boolean; created_at: string
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function VideoManagePage() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<VideoLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', youtube_url: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VideoLink | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_video_links').select('*').order('display_order').order('created_at', { ascending: false })
      if (error) throw error
      setVideos(data ?? [])
    } catch { toast.error('Failed to load videos') }
    finally { setLoading(false) }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.youtube_url.trim()) { toast.error('Fill all fields'); return }
    if (!getYouTubeId(form.youtube_url)) { toast.error('Invalid YouTube URL'); return }
    setSaving(true)
    try {
      const payload = { title: form.title.trim(), youtube_url: form.youtube_url.trim(), uploaded_by: user?.id }
      if (editId) {
        const { error } = await supabase.from('uce_video_links').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Video updated')
      } else {
        const { error } = await supabase.from('uce_video_links').insert({ ...payload, display_order: videos.length })
        if (error) throw error
        toast.success('Video added')
      }
      setShowModal(false); setEditId(null); setForm({ title: '', youtube_url: '' })
      load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function toggleActive(video: VideoLink) {
    try {
      const { error } = await supabase.from('uce_video_links').update({ is_active: !video.is_active }).eq('id', video.id)
      if (error) throw error
      setVideos(p => p.map(v => v.id === video.id ? { ...v, is_active: !v.is_active } : v))
      toast.success(video.is_active ? 'Hidden from website' : 'Visible on website')
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_video_links').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setVideos(p => p.filter(v => v.id !== deleteTarget.id))
      toast.success('Video deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  function openEdit(v: VideoLink) {
    setEditId(v.id); setForm({ title: v.title, youtube_url: v.youtube_url }); setShowModal(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Video Links</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{videos.length} videos, displayed on website gallery</p></div>
        <button onClick={() => { setEditId(null); setForm({ title: '', youtube_url: '' }); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Video</button>
      </div>

      {/* Video grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-56 rounded-xl" />)}
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Video size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No videos yet. Add your first YouTube video.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(video => {
            const ytId = getYouTubeId(video.youtube_url)
            return (
              <div key={video.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!video.is_active ? 'opacity-50' : ''}`}>
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100">
                  {ytId ? (
                    <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Video size={32} className="text-gray-300" /></div>
                  )}
                  <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition">
                    <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg"><Play size={20} className="text-white ml-0.5" /></div>
                  </a>
                </div>
                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{video.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${video.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{video.is_active ? 'Active' : 'Hidden'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3">
                    <button onClick={() => openEdit(video)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={14} /></button>
                    <button onClick={() => toggleActive(video)} className={`p-1.5 rounded-lg ${video.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}><Power size={14} /></button>
                    <button onClick={() => setDeleteTarget(video)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                    <a href={video.youtube_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-auto"><ExternalLink size={14} /></a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Video' : 'Add Video'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Video title..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL <span className="text-red-500">*</span></label>
            <input type="url" value={form.youtube_url} onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
            {form.youtube_url && getYouTubeId(form.youtube_url) && (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                <img src={`https://img.youtube.com/vi/${getYouTubeId(form.youtube_url)}/mqdefault.jpg`} alt="Preview" className="w-full h-32 object-cover" />
              </div>
            )}
            {form.youtube_url && !getYouTubeId(form.youtube_url) && <p className="text-xs text-red-500 mt-1">Invalid YouTube URL</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{saving ? 'Saving...' : editId ? 'Update' : 'Add Video'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Video?" message={`Remove "${deleteTarget?.title}" from the video gallery?`}
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
