import { useEffect, useState, useMemo } from 'react'
import { Monitor, Smartphone, Plus, Trash2, Power, Image, AlertCircle } from 'lucide-react'
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

interface Slide {
  index: number
  desktop: Banner | null
  mobile: Banner | null
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

  const slides: Slide[] = useMemo(() => {
    const desktops = banners.filter(b => b.type === 'desktop').sort((a, b) => a.display_order - b.display_order)
    const mobiles  = banners.filter(b => b.type === 'mobile').sort((a, b) => a.display_order - b.display_order)
    const len = Math.max(desktops.length, mobiles.length)
    return Array.from({ length: len }, (_, i) => ({
      index: i + 1,
      desktop: desktops[i] ?? null,
      mobile:  mobiles[i]  ?? null,
    }))
  }, [banners])

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
      setShowModal(false)
      setForm({ type: 'desktop', link_url: '', file: null, preview: '' })
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
    if (!deleteTarget) return
    setDeleting(true)
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

  function openAdd(type: 'desktop' | 'mobile') {
    setForm({ type, link_url: '', file: null, preview: '' })
    setShowModal(true)
  }

  const desktopCount = banners.filter(b => b.type === 'desktop').length
  const mobileCount  = banners.filter(b => b.type === 'mobile').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-heading">Hero Banners</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {slides.length} slide{slides.length !== 1 ? 's' : ''} &middot; {desktopCount} desktop &middot; {mobileCount} mobile
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAdd('desktop')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm"
          >
            <Monitor size={14} /> Desktop
          </button>
          <button
            onClick={() => openAdd('mobile')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 shadow-sm"
          >
            <Smartphone size={14} /> Mobile
          </button>
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>Slides are paired by position — Slide 1 desktop + Slide 1 mobile display together. Upload matching counts for best results.</span>
      </div>

      {/* Slide list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : slides.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Image size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400 mb-4">No banners yet. Add your first banner.</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => openAdd('desktop')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"><Monitor size={13} /> Add Desktop</button>
            <button onClick={() => openAdd('mobile')}  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700"><Smartphone size={13} /> Add Mobile</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map(slide => (
            <div key={slide.index} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Slide header */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Slide {slide.index}</span>
                <div className="flex items-center gap-1.5">
                  {[slide.desktop, slide.mobile].filter(Boolean).map(b => b && (
                    <span key={b.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.type === 'desktop' ? 'Desktop ' : 'Mobile '}{b.is_active ? 'on' : 'off'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Thumbnails row */}
              <div className="flex items-stretch divide-x divide-gray-100">

                {/* Desktop slot */}
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Monitor size={12} className="text-blue-600" />
                    <span className="text-[11px] font-semibold text-gray-600">Desktop</span>
                  </div>
                  {slide.desktop ? (
                    <div className={`relative rounded-lg overflow-hidden ${!slide.desktop.is_active ? 'opacity-50' : ''}`}>
                      <img
                        src={slide.desktop.image_url}
                        alt="Desktop banner"
                        className="w-full h-16 sm:h-20 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                        <button
                          onClick={() => toggleActive(slide.desktop!)}
                          className={`p-1 rounded-md text-white text-[10px] shadow ${slide.desktop.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'}`}
                          title={slide.desktop.is_active ? 'Hide' : 'Show'}
                        >
                          <Power size={11} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(slide.desktop)}
                          className="p-1 rounded-md bg-red-500 hover:bg-red-600 text-white shadow"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openAdd('desktop')}
                      className="w-full h-16 sm:h-20 border-2 border-dashed border-blue-200 rounded-lg flex flex-col items-center justify-center gap-1 text-blue-400 hover:border-blue-400 hover:bg-blue-50/50 transition text-[11px]"
                    >
                      <Plus size={16} />
                      Add desktop
                    </button>
                  )}
                </div>

                {/* Mobile slot */}
                <div className="w-28 sm:w-36 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Smartphone size={12} className="text-purple-600" />
                    <span className="text-[11px] font-semibold text-gray-600">Mobile</span>
                  </div>
                  {slide.mobile ? (
                    <div className={`relative rounded-lg overflow-hidden ${!slide.mobile.is_active ? 'opacity-50' : ''}`}>
                      <img
                        src={slide.mobile.image_url}
                        alt="Mobile banner"
                        className="w-full h-16 sm:h-20 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                        <button
                          onClick={() => toggleActive(slide.mobile!)}
                          className={`p-1 rounded-md text-white shadow ${slide.mobile.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'}`}
                          title={slide.mobile.is_active ? 'Hide' : 'Show'}
                        >
                          <Power size={11} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(slide.mobile)}
                          className="p-1 rounded-md bg-red-500 hover:bg-red-600 text-white shadow"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openAdd('mobile')}
                      className="w-full h-16 sm:h-20 border-2 border-dashed border-purple-200 rounded-lg flex flex-col items-center justify-center gap-1 text-purple-400 hover:border-purple-400 hover:bg-purple-50/50 transition text-[11px]"
                    >
                      <Plus size={16} />
                      Add mobile
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Add ${form.type === 'desktop' ? 'Desktop' : 'Mobile'} Banner`}>
        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(['desktop', 'mobile'] as const).map(t => (
              <button
                key={t}
                onClick={() => setForm(p => ({ ...p, type: t, file: null, preview: '' }))}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition text-sm font-medium ${
                  form.type === t
                    ? t === 'desktop' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t === 'desktop' ? <Monitor size={16} /> : <Smartphone size={16} />}
                {t === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">
            {form.type === 'desktop' ? 'Recommended: 1920×600px, max 3MB' : 'Recommended: 750×1200px, max 3MB'}
          </p>

          {/* Image upload */}
          {form.preview ? (
            <div className="relative rounded-lg overflow-hidden">
              <img src={form.preview} alt="Preview" className={`w-full object-cover ${form.type === 'desktop' ? 'h-28' : 'h-48 max-w-[140px] mx-auto block'}`} />
              <button
                onClick={() => setForm(p => ({ ...p, file: null, preview: '' }))}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full text-xs leading-none w-5 h-5 flex items-center justify-center"
              >×</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition">
              <Image size={28} className="text-gray-300 mb-2" />
              <span className="text-sm text-gray-500">Click to select image</span>
              <span className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · max 3MB</span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          )}

          {/* Link URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Link URL <span className="text-gray-400">(optional)</span></label>
            <input
              type="url"
              value={form.link_url}
              onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button
              onClick={handleUpload}
              disabled={uploading || !form.file}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${form.type === 'desktop' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {uploading ? 'Uploading…' : 'Upload Banner'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Banner?"
        message={`Remove this ${deleteTarget?.type} banner permanently from the website.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
