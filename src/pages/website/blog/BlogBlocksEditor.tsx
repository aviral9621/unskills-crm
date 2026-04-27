import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, Plus, Image as ImageIcon, Heading2, Pilcrow, List, Quote, Minus, Code2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { BlogBlock } from '../../../lib/blog'
import { uploadBlogImage, validateImageFile } from '../../../lib/blog'

interface Props {
  blocks: BlogBlock[]
  onChange: (next: BlogBlock[]) => void
}

const BLOCK_OPTIONS: { type: BlogBlock['type']; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { type: 'paragraph', label: 'Paragraph', icon: Pilcrow },
  { type: 'heading',   label: 'Heading',   icon: Heading2 },
  { type: 'image',     label: 'Image',     icon: ImageIcon },
  { type: 'list',      label: 'List',      icon: List },
  { type: 'quote',     label: 'Quote',     icon: Quote },
  { type: 'code',      label: 'Code',      icon: Code2 },
  { type: 'divider',   label: 'Divider',   icon: Minus },
]

function blank(type: BlogBlock['type']): BlogBlock {
  switch (type) {
    case 'heading':   return { type: 'heading', level: 2, text: '' }
    case 'paragraph': return { type: 'paragraph', text: '', align: 'left' }
    case 'image':     return { type: 'image', url: '', alt: '', caption: '' }
    case 'list':      return { type: 'list', style: 'bullet', items: [''] }
    case 'quote':     return { type: 'quote', text: '', cite: '' }
    case 'divider':   return { type: 'divider' }
    case 'code':      return { type: 'code', lang: '', code: '' }
  }
}

export default function BlogBlocksEditor({ blocks, onChange }: Props) {
  const [showAdd, setShowAdd] = useState<number | null>(null)

  function add(type: BlogBlock['type'], at: number) {
    const next = [...blocks]
    next.splice(at, 0, blank(type))
    onChange(next)
    setShowAdd(null)
  }
  function update(i: number, patch: Partial<BlogBlock>) {
    const next = [...blocks]
    next[i] = { ...next[i], ...patch } as BlogBlock
    onChange(next)
  }
  function remove(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const AddRow = ({ at }: { at: number }) => (
    <div className="relative my-2 group">
      <div className="border-t border-dashed border-gray-200 group-hover:border-red-300 transition-colors" />
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={() => setShowAdd(showAdd === at ? null : at)}
          className="bg-white px-2 py-0.5 rounded-full text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 inline-flex items-center gap-1 transition-colors"
        >
          <Plus size={12} /> Add block
        </button>
      </div>
      {showAdd === at && (
        <div className="relative z-10 mt-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {BLOCK_OPTIONS.map(opt => {
            const Icon = opt.icon
            return (
              <button
                key={opt.type}
                onClick={() => add(opt.type, at)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded hover:bg-red-50 hover:text-red-700"
              >
                <Icon size={15} /> {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-1">
      <AddRow at={0} />
      {blocks.map((block, i) => (
        <div key={i}>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{block.type}</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => remove(i)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete block">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="p-3">
              <BlockEditor block={block} onChange={p => update(i, p)} />
            </div>
          </div>
          <AddRow at={i + 1} />
        </div>
      ))}
      {blocks.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-200 rounded-lg">
          Empty post. Click "Add block" above to start.
        </div>
      )}
    </div>
  )
}

function BlockEditor({ block, onChange }: { block: BlogBlock; onChange: (p: Partial<BlogBlock>) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="flex gap-2">
          <select
            value={block.level}
            onChange={e => onChange({ level: Number(e.target.value) as 2 | 3 } as Partial<BlogBlock>)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            value={block.text}
            onChange={e => onChange({ text: e.target.value } as Partial<BlogBlock>)}
            placeholder="Heading text"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
        </div>
      )
    case 'paragraph':
      return (
        <div className="space-y-2">
          <textarea
            value={block.text}
            onChange={e => onChange({ text: e.target.value } as Partial<BlogBlock>)}
            rows={4}
            placeholder="Write your paragraph…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
          <div className="flex gap-1.5">
            {(['left', 'center'] as const).map(a => (
              <button
                key={a}
                onClick={() => onChange({ align: a } as Partial<BlogBlock>)}
                className={`px-2.5 py-1 text-xs rounded-md border ${(block.align ?? 'left') === a ? 'bg-red-50 text-red-700 border-red-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {a === 'left' ? 'Align left' : 'Center'}
              </button>
            ))}
          </div>
        </div>
      )
    case 'image':
      return <ImageBlockEditor block={block} onChange={onChange} />
    case 'list':
      return (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {(['bullet', 'number'] as const).map(s => (
              <button
                key={s}
                onClick={() => onChange({ style: s } as Partial<BlogBlock>)}
                className={`px-2.5 py-1 text-xs rounded-md border ${block.style === s ? 'bg-red-50 text-red-700 border-red-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {s === 'bullet' ? 'Bulleted' : 'Numbered'}
              </button>
            ))}
          </div>
          <textarea
            value={block.items.join('\n')}
            onChange={e => onChange({ items: e.target.value.split('\n') } as Partial<BlogBlock>)}
            rows={Math.max(3, block.items.length)}
            placeholder="One item per line"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
        </div>
      )
    case 'quote':
      return (
        <div className="space-y-2">
          <textarea
            value={block.text}
            onChange={e => onChange({ text: e.target.value } as Partial<BlogBlock>)}
            rows={3}
            placeholder="Quote text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm italic focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
          <input
            value={block.cite ?? ''}
            onChange={e => onChange({ cite: e.target.value } as Partial<BlogBlock>)}
            placeholder="— Citation (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
        </div>
      )
    case 'divider':
      return <div className="text-center text-gray-300 select-none">— horizontal rule —</div>
    case 'code':
      return (
        <div className="space-y-2">
          <input
            value={block.lang ?? ''}
            onChange={e => onChange({ lang: e.target.value } as Partial<BlogBlock>)}
            placeholder="Language (e.g. ts, py)"
            className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
          <textarea
            value={block.code}
            onChange={e => onChange({ code: e.target.value } as Partial<BlogBlock>)}
            rows={6}
            placeholder="Code…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono bg-gray-50 focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
          />
        </div>
      )
  }
}

function ImageBlockEditor({ block, onChange }: { block: Extract<BlogBlock, { type: 'image' }>; onChange: (p: Partial<BlogBlock>) => void }) {
  const [uploading, setUploading] = useState(false)

  async function pick(file: File | null) {
    if (!file) return
    const err = validateImageFile(file)
    if (err) { toast.error(err); return }
    setUploading(true)
    try {
      const url = await uploadBlogImage(file, 'inline')
      onChange({ url } as Partial<BlogBlock>)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-2">
      {block.url ? (
        <div className="relative">
          <img src={block.url} alt={block.alt || ''} className="max-h-72 rounded-lg border border-gray-200 object-contain bg-gray-50 mx-auto" />
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-red-300">
          {uploading ? <Loader2 size={28} className="text-red-500 animate-spin" /> : <ImageIcon size={28} className="text-gray-400" />}
          <span className="text-sm text-gray-600">{uploading ? 'Uploading…' : 'Click to upload image'}</span>
          <span className="text-xs text-gray-400">PNG, JPG, WEBP — max 2 MB</span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => pick(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {block.url && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 cursor-pointer">
            Replace
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => pick(e.target.files?.[0] ?? null)} />
          </label>
          <button onClick={() => onChange({ url: '' } as Partial<BlogBlock>)} className="text-xs text-gray-500 hover:text-red-600">Remove</button>
        </div>
      )}
      <input
        value={block.alt ?? ''}
        onChange={e => onChange({ alt: e.target.value } as Partial<BlogBlock>)}
        placeholder="Alt text (for accessibility & SEO)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
      />
      <input
        value={block.caption ?? ''}
        onChange={e => onChange({ caption: e.target.value } as Partial<BlogBlock>)}
        placeholder="Caption (optional, shown under the image)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
      />
    </div>
  )
}
