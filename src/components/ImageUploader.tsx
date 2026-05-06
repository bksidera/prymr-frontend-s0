import { useState, type ChangeEvent, type DragEvent } from 'react'
import { uploadsService } from '../services/uploads.service'

interface Props {
  onUploaded: (url: string) => void
}

export function ImageUploader({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const url = await uploadsService.upload(file)
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <div className="w-full">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center w-full aspect-[9/16] max-h-[70vh] border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
          dragOver
            ? 'border-white bg-neutral-900'
            : 'border-neutral-700 hover:border-neutral-500'
        }`}
      >
        <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        <span className="text-neutral-400">
          {uploading ? 'Uploading…' : 'Drop or tap to choose an image'}
        </span>
      </label>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}
