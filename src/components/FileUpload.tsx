import { useRef, useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '../lib/utils'

interface FileUploadProps {
  value?: string | null
  onChange: (url: string | null, file: File | null) => void
  accept?: string
  maxSizeKB?: number
  previewSize?: number
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
}

export default function FileUpload({
  value,
  onChange,
  accept = 'image/jpeg,image/png',
  maxSizeKB = 200,
  previewSize = 120,
  label = 'Click to upload or drag & drop',
  hint,
  error,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const preview = localPreview || value

  const handleFile = useCallback((file: File) => {
    setLocalError(null)

    // Validate type
    const allowedTypes = accept.split(',').map(t => t.trim())
    if (!allowedTypes.includes(file.type)) {
      setLocalError('Only JPG and PNG files are allowed')
      return
    }

    // Validate size
    if (file.size > maxSizeKB * 1024) {
      setLocalError(`File must be less than ${maxSizeKB} KB`)
      return
    }

    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    onChange(url, file)
  }, [accept, maxSizeKB, onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [disabled, handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const clearFile = useCallback(() => {
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(null)
    setLocalError(null)
    onChange(null, null)
  }, [localPreview, onChange])

  const displayError = error || localError

  return (
    <div>
      {preview ? (
        <div className="relative inline-block group">
          <img
            src={preview}
            alt="Upload preview"
            className="rounded-xl border border-gray-200 object-cover"
            style={{ width: previewSize, height: previewSize }}
          />
          {!disabled && (
            <button
              type="button"
              onClick={clearFile}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all',
            dragActive ? 'border-red-400 bg-red-50/50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          style={{ minHeight: previewSize }}
        >
          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
            {dragActive ? <ImageIcon size={20} className="text-red-500" /> : <Upload size={20} className="text-gray-400" />}
          </div>
          <p className="text-xs text-gray-500 text-center">{label}</p>
          <p className="text-[10px] text-gray-400">Max {maxSizeKB} KB &middot; JPG, PNG</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      {hint && !displayError && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {displayError && <p className="mt-1 text-xs text-red-500">{displayError}</p>}
    </div>
  )
}
