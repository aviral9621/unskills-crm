import { useEffect, useState } from 'react'
import { Image, Plus, Trash2, Power } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Photo {
  id: string; image_url: string; caption: string | null; category: string | null
  display_order: number; is_active: boolean; created_at: string
}

const CATEGORIES = ['event', 'campus', 'students', 'achievements', 'other']

export default function GalleryManagePage() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ caption: '', category: '', file: null as File | null, preview: '' })
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_gallery_photos').select('*').order('display_order').order('created_at', { ascending: false })
      if (error) throw error
      setPhotos(data ?? [])
    } catch { toast.error('Failed to load gallery') }
    finally { setLoading(false) }
  }

  async function handleUpload() {
    if (!form.file) { toast.error('Select a photo'); return }
    setUploading(true)
    try {
      const ext = form.file.name.split('.').pop() || 'jpg'
      const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const url = await uploadPublicFile(STORAGE_BUCKETS.website, path, form.file)

      const { error } = await supabase.from('uce_gallery_photos').insert({
        image_url: url, caption: form.caption || null,
        category: form.category || null,
        display_order: photos.length, uploaded_by: user?.id,
      })
      if (error) throw error
      toast.success('Photo added')
      setShowModal(false); setForm({ caption: '', category: '', file: null, preview: '' })
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  async function toggleActive(photo: Photo) {
    try {
      const { error } = await supabase.from('uce_gallery_photos').update({ is_active: !photo.is_active }).eq('id', photo.id)
      if (error) throw error
      setPhotos(p => p.map(ph => ph.id === photo.id ? { ...ph, is_active: !ph.is_active } : ph))
      toast.success(photo.is_active ? 'Hidden from website' : 'Visible on website')
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_gallery_photos').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setPhotos(p => p.filter(ph => ph.id !== deleteTarget.id))
      toast.success('Photo deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max size: 2MB'); return }
    setForm(p => ({ ...p, file, preview: URL.createObjectURL(file) }))
  }

  const filtered = categoryFilter ? photos.filter(p => p.category === categoryFilter) : photos

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Photo Gallery</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">{photos.length} photos, displayed on website gallery</p></div>
        <button onClick={() => { setForm({ caption: '', category: '', file: null, preview: '' }); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Photo</button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCategoryFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!categoryFilter ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${categoryFilter === c ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton aspect-square rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Image size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No photos yet. Add your first photo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(photo => (
            <div key={photo.id} className={`group relative bg-white rounded-xl border border-gray-200 overflow-hidden ${!photo.is_active ? 'opacity-50' : ''}`}>
              <div className="aspect-square bg-gray-100">
                <img src={photo.image_url} alt={photo.caption || 'Gallery photo'} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-gray-900 truncate">{photo.caption || 'No caption'}</p>
                {photo.category && <span className="text-[10px] text-gray-400 uppercase">{photo.category}</span>}
              </div>
              {/* Overlay actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggleActive(photo)} className={`p-1.5 rounded-lg ${photo.is_active ? 'bg-green-500' : 'bg-gray-400'} text-white shadow-sm hover:scale-105 transition`}><Power size={12} /></button>
                <button onClick={() => setDeleteTarget(photo)} className="p-1.5 rounded-lg bg-red-500 text-white shadow-sm hover:scale-105 transition"><Trash2 size={12} /></button>
              </div>
              {/* Mobile actions */}
              <div className="md:hidden absolute top-2 right-2 flex gap-1">
                <button onClick={() => toggleActive(photo)} className={`p-1.5 rounded-lg ${photo.is_active ? 'bg-green-500' : 'bg-gray-400'} text-white shadow-sm`}><Power size={12} /></button>
                <button onClick={() => setDeleteTarget(photo)} className="p-1.5 rounded-lg bg-red-500 text-white shadow-sm"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Photo">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo <span className="text-red-500">*</span></label>
            {form.preview ? (
              <div className="relative">
                <img src={form.preview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                <button onClick={() => setForm(p => ({ ...p, file: null, preview: '' }))} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full text-xs">x</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-red-400 hover:bg-red-50/50 transition">
                <Image size={32} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to select photo</span>
                <span className="text-xs text-gray-400 mt-1">JPG, PNG, max 2MB</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
            <input type="text" value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))} placeholder="Optional caption..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none">
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleUpload} disabled={uploading || !form.file} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Photo?" message="This photo will be removed from the gallery permanently."
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
