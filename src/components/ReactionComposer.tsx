import { useRef, useState, type ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { uploadsService } from '../services/uploads.service'

const EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '🥲', '✨', '🙏']
const PAYMENT_AMOUNTS = [1, 3, 5, 10] as const

export interface ComposerSubmit {
  text: string
  emoji: string | null
  contentUrl: string | null
  contentType: 'photo' | 'video' | null
  paymentAmount: number | null
}

interface Props {
  // viewport coordinates of the tap point — used to anchor the bubble
  anchorX: number
  anchorY: number
  onSubmit: (data: ComposerSubmit) => void | Promise<void>
  onClose: () => void
}

export function ReactionComposer({ anchorX, anchorY, onSubmit, onClose }: Props) {
  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState<string | null>(null)
  const [contentUrl, setContentUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState<'photo' | 'video' | null>(null)
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)

  // Bubble position: clamp into viewport with some padding.
  const PAD = 12
  const BUBBLE_W = 320
  const BUBBLE_H_EST = 280
  const left = Math.max(
    PAD,
    Math.min(window.innerWidth - BUBBLE_W - PAD, anchorX - BUBBLE_W / 2),
  )
  const top = Math.max(PAD, Math.min(window.innerHeight - BUBBLE_H_EST - PAD, anchorY + 16))

  async function handleFile(file: File, kind: 'photo' | 'video') {
    setError(null)
    setUploading(true)
    try {
      const url = await uploadsService.upload(file)
      setContentUrl(url)
      setContentType(kind)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void handleFile(f, 'photo')
  }
  function onVideoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void handleFile(f, 'video')
  }

  async function submit() {
    if (!text.trim() && !emoji && !contentUrl && paymentAmount === null) {
      setError('Add something to your reaction')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        text: text.trim(),
        emoji,
        contentUrl,
        contentType,
        paymentAmount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-3 space-y-3"
        style={{ left, top, width: BUBBLE_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          className="w-full px-3 py-2 bg-neutral-800 rounded-lg outline-none text-sm placeholder:text-neutral-500"
        />

        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(emoji === e ? null : e)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-colors ${
                emoji === e ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="flex gap-2 text-xs">
          <button
            onClick={() => fileRef.current?.click()}
            className={`flex-1 py-2 rounded-lg border ${
              contentType === 'photo' ? 'border-white' : 'border-neutral-700'
            }`}
          >
            {contentType === 'photo' ? 'Photo ✓' : '+ Photo'}
          </button>
          <button
            onClick={() => videoRef.current?.click()}
            className={`flex-1 py-2 rounded-lg border ${
              contentType === 'video' ? 'border-white' : 'border-neutral-700'
            }`}
          >
            {contentType === 'video' ? 'Video ✓' : '+ Video'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPhotoChange}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onVideoChange}
          />
        </div>

        <div className="flex gap-1.5">
          {PAYMENT_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => setPaymentAmount(paymentAmount === amt ? null : amt)}
              className={`flex-1 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                paymentAmount === amt
                  ? 'bg-amber-300 text-black border-amber-300'
                  : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {uploading && <p className="text-xs text-neutral-400">Uploading…</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={submitting || uploading}
            onClick={submit}
            className="flex-1 py-2 bg-white text-black rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Sending…' : paymentAmount ? `Send · $${paymentAmount}` : 'Send'}
          </button>
        </div>
      </motion.div>
    </>
  )
}
