import { useEffect, useLayoutEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../lib/utils'

export type SelectOption = { value: string; label: string; disabled?: boolean }

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  name?: string
  id?: string
  className?: string
  error?: boolean
}

/**
 * Modern, accessible dropdown.
 * - Trigger matches the app's input styling.
 * - Popup is portal-rendered so it never gets clipped by a parent overflow.
 * - Keyboard: ArrowUp/Down to move, Enter to pick, Esc to close, type-ahead.
 * - Optional search box (auto-enabled when options > 7).
 * - On touch devices a native <select> still works if you render one alongside;
 *   the popup itself is built to be tap-friendly too.
 */
export default function Select({
  value, onChange, options, placeholder = 'Select…', disabled, searchable,
  name, id, className, error,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placement: 'below' as 'below' | 'above' })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const effSearchable = searchable ?? options.length > 7
  const selected = options.find(o => o.value === value)

  const filtered = q.trim()
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    : options

  const computePos = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vh = window.innerHeight
    const popupH = Math.min(320, 44 * Math.max(filtered.length, 3) + (effSearchable ? 48 : 0) + 16)
    const spaceBelow = vh - rect.bottom
    const placement = spaceBelow >= popupH + 8 ? 'below' : 'above'
    const top = placement === 'below' ? rect.bottom + 4 : Math.max(8, rect.top - popupH - 4)
    setPos({ top, left: rect.left, width: rect.width, placement })
  }, [filtered.length, effSearchable])

  useLayoutEffect(() => { if (open) computePos() }, [open, computePos])

  useEffect(() => {
    if (!open) return
    const onScroll = () => computePos()
    const onResize = () => computePos()
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (popupRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('mousedown', onDocClick)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [open, computePos])

  useEffect(() => {
    if (!open) return
    // Focus search or list, and highlight the current value.
    setQ('')
    const idx = Math.max(0, options.findIndex(o => o.value === value))
    setHighlight(idx)
    queueMicrotask(() => {
      if (effSearchable) searchRef.current?.focus()
    })
  }, [open, effSearchable, options, value])

  function pick(opt: SelectOption) {
    if (opt.disabled) return
    onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      setOpen(true)
      return
    }
  }

  function onPopupKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(filtered.length - 1, h + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) pick(opt)
      return
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        name={name}
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onTriggerKey}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-lg border bg-white px-3.5 py-2.5 text-sm text-left transition-colors',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-gray-300 focus:border-red-500 focus:ring-red-500/20',
          disabled && 'bg-gray-100 cursor-not-allowed text-gray-500',
          !selected && 'text-gray-400',
          className,
        )}
      >
        <span className={cn('truncate', selected && 'text-gray-900')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onPopupKey}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className={cn(
            'fixed z-[60] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden',
            'animate-in fade-in duration-100',
            pos.placement === 'above' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1',
          )}
        >
          {effSearchable && (
            <div className="relative border-b border-gray-100 p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={q}
                onChange={e => { setQ(e.target.value); setHighlight(0) }}
                placeholder="Search…"
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg bg-gray-50 border border-transparent focus:bg-white focus:border-red-300 focus:outline-none"
                onKeyDown={e => onPopupKey(e as unknown as KeyboardEvent<HTMLDivElement>)}
              />
            </div>
          )}
          <ul ref={listRef} className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-sm text-gray-400">No options</li>
            ) : filtered.map((opt, i) => {
              const isSelected = opt.value === value
              const isHi = i === highlight
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3.5 py-2 text-sm cursor-pointer select-none',
                    opt.disabled && 'opacity-40 cursor-not-allowed',
                    isHi && !opt.disabled && 'bg-red-50 text-red-900',
                    !isHi && isSelected && 'bg-gray-50',
                    !isHi && !isSelected && 'text-gray-700',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-red-600" />}
                </li>
              )
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
