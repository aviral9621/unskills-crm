import { useEffect, useState } from 'react'
import { Image, Plus, Trash2, Power, Monitor, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { uploadPublicFile, STORAGE_BUCKETS } from '../../lib/uploads'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Banner {
  id: string; image_url: string; type: 'desktop' | 'mobile'; link_url: string | null
  display_order: number; is_active: boolean; created_at: string
}

export default function BannerManagePage() {
  const { user } = useAuth()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ type: 'desktop' as 'desktop' | 'mobile', link_url: '', file: null as File | null, preview: '' })
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'desktop' | 'mobile'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('uce_banners').select('*').order('display_order').order('created_at', { ascending: false })
      if (error) throw error
      setBanners(data ?? [])
    } catch { toast.error('Failed to load banners') }
    finally { setLoading(false) }
  }

  async function handleUpload() {
    if (!form.file) { toast.error('Select a banner image'); return }
    setUploading(true)
    try {
      const ext = form.file.name.split('.').pop() || 'jpg'
      const path = `banners/${form.type}-${Date.now()}.${ext}`
      const url = await uploadPublicFile(STORAGE_BUCKETS.website, path, form.file)

      const { error } = await supabase.from('uce_banners').insert({
        image_url: url, type: form.type, link_url: form.link_url || null,
        display_order: banners.filter(b => b.type === form.type).length,
        uploaded_by: user?.id,
      })
      if (error) throw error
      toast.success('Banner added')
      setShowModal(false); setForm({ type: 'desktop', link_url: '', file: null, preview: '' })
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  async function toggleActive(banner: Banner) {
    try {
      const { error } = await supabase.from('uce_banners').update({ is_active: !banner.is_active }).eq('id', banner.id)
      if (error) throw error
      setBanners(p => p.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
      toast.success(banner.is_active ? 'Banner hidden' : 'Banner visible')
    } catch { toast.error('Failed to update') }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const { error } = await supabase.from('uce_banners').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setBanners(p => p.filter(b => b.id !== deleteTarget.id))
      toast.success('Banner deleted')
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(false); setDeleteTarget(null) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Max size: 3MB'); return }
    setForm(p => ({ ...p, file, preview: URL.createObjectURL(file) }))
  }

  const filtered = typeFilter === 'all' ? banners : banners.filter(b => b.type === typeFilter)
  const desktopCount = banners.filter(b => b.type === 'desktop').length
  const mobileCount = banners.filter(b => b.type === 'mobile').length

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Banners</h1><p className="text-xs sm:text-sm text-gray-500 mt-0.5">Homepage hero banners ({desktopCount} desktop, {mobileCount} mobile)</p></div>
        <button onClick={() => { setForm({ type: 'desktop', link_url: '', file: null, preview: '' }); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 shadow-sm shrink-0"><Plus size={16} /> Add Banner</button>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        <div className="flex gap-2">
          {[{ v: 'all' as const, l: 'All' }, { v: 'desktop' as const, l: 'Desktop', icon: Monitor }, { v: 'mobile' as const, l: 'Mobile', icon: Smartphone }].map(t => (
            <button key={t.v} onClick={() => setTypeFilter(t.v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${typeFilter === t.v ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.icon && <t.icon size={14} />}{t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Banner list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Image size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No banners yet. Add your first banner.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(banner => (
            <div key={banner.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!banner.is_active ? 'opacity-50' : ''}`}>
              <div className="flex flex-col sm:flex-row">
                <div className={`${banner.type === 'desktop' ? 'sm:w-80 aspect-[16/5]' : 'sm:w-48 aspect-[9/16] max-h-48'} bg-gray-100 shrink-0`}>
                  <img src={banner.image_url} alt="Banner" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${banner.type === 'desktop' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {banner.type === 'desktop' ? <Monitor size={12} /> : <Smartphone size={12} />}
                        {banner.type === 'desktop' ? 'Desktop' : 'Mobile'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${banner.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{banner.is_active ? 'Active' : 'Hidden'}</span>
                    </div>
                    {banner.link_url && <p className="text-xs text-gray-400 truncate">Link: {banner.link_url}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => toggleActive(banner)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${banner.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      <Power size={12} /> {banner.is_active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => setDeleteTarget(banner)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Banner">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner Type <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              {[{ v: 'desktop' as const, l: 'Desktop', icon: Monitor, hint: '1920x600 recommended' }, { v: 'mobile' as const, l: 'Mobile', icon: Smartphone, hint: '750x1200 recommended' }].map(t => (
                <button key={t.v} onClick={() => setForm(p => ({ ...p, type: t.v }))} className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition ${form.type === t.v ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <t.icon size={20} className={form.type === t.v ? 'text-red-600' : 'text-gray-400'} />
                  <div className="text-left"><p className="text-sm font-medium text-gray-900">{t.l}</p><p className="text-[10px] text-gray-400">{t.hint}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image <span className="text-red-500">*</span></label>
            {form.preview ? (
              <div className="relative">
                <img src={form.preview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                <button onClick={() => setForm(p => ({ ...p, file: null, preview: '' }))} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full text-xs">x</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-red-400 transition">
                <Image size={28} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to select image</span>
                <span className="text-xs text-gray-400 mt-1">JPG, PNG, max 3MB</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link URL (optional)</label>
            <input type="url" value={form.link_url} onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleUpload} disabled={uploading || !form.file} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload Banner'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Banner?" message="This banner will be permanently removed from the website."
        confirmText="Delete" variant="danger" loading={deleting} />
    </div>
  )
}
