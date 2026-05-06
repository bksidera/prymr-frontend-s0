import { useRef, useState, type ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { uploadsService } from '../services/uploads.service'

const EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '🥲', '✨', '🙏']

/** Heart-count pills: 1/2/3/4 hearts → $1/$3/$5/$10. */
const APPRECIATION_LEVELS: Array<{ count: number; amount: number }> = [
  { count: 1, amount: 1 },
  { count: 2, amount: 3 },
  { count: 3, amount: 5 },
  { count: 4, amount: 10 },
]

const BUBBLE_W = 320
const BUBBLE_H_EST = 340
const PAD = 12
const TAIL_SIZE = 12

export interface ComposerSubmit {
  text: string
  emoji: string | null
  contentUrl: string | null
  contentType: 'photo' | 'video' | null
  paymentAmount: number | null
}

interface Props {
  // viewport coordinates of the tap point — anchors the bubble + tail
  anchorX: number
  anchorY: number
  onSubmit: (data: ComposerSubmit) => void | Promise<void>
  onClose: () => void
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-3 h-3 ${active ? 'text-rose-400' : 'text-neutral-700'}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function HeartPill({
  count,
  amount,
  selected,
  onClick,
}: {
  count: number
  amount: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: selected ? 1.04 : 1 }}
      transition={{ type: 'spring', damping: 14, stiffness: 320 }}
      className={`flex-1 px-1 py-2 rounded-xl flex flex-col items-center gap-1 border transition-colors ${
        selected
          ? 'bg-rose-400/10 border-rose-400/50'
          : 'bg-neutral-800/60 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <span className="flex items-center gap-[1px]">
        {Array.from({ length: count }).map((_, i) => (
          <HeartIcon key={i} active={selected} />
        ))}
      </span>
      <span
        className={`text-[10px] tracking-wide ${
          selected ? 'text-rose-200' : 'text-neutral-500'
        }`}
      >
        ${amount}
      </span>
    </motion.button>
  )
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

  // Position bubble near the tap, clamped into viewport. Default to BELOW the
  // tap; flip ABOVE if there isn't room. Tail points back toward the tap.
  const flipAbove = anchorY + 16 + BUBBLE_H_EST > window.innerHeight - PAD
  const top = flipAbove
    ? Math.max(PAD, anchorY - 16 - BUBBLE_H_EST)
    : Math.min(window.innerHeight - BUBBLE_H_EST - PAD, anchorY + 16)
  const left = Math.max(
    PAD,
    Math.min(window.innerWidth - BUBBLE_W - PAD, anchorX - BUBBLE_W / 2),
  )

  // Tail x position relative to bubble (so it points to the actual tap, not
  // bubble center, when the bubble has been clamped sideways).
  const tailX = Math.max(20, Math.min(BUBBLE_W - 20, anchorX - left))

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

  const submitLabel = submitting
    ? 'Sending…'
    : paymentAmount
      ? `Appreciate · $${paymentAmount}`
      : 'Send'

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 360 }}
        className="fixed z-50 bg-neutral-900/95 backdrop-blur-md border border-white/[0.08] rounded-3xl shadow-2xl p-3.5 space-y-3"
        style={{
          left,
          top,
          width: BUBBLE_W,
          // Origin = where the tail attaches, so bubble feels like it
          // emerges from the tapped spot.
          transformOrigin: flipAbove
            ? `${tailX}px ${BUBBLE_H_EST}px`
            : `${tailX}px 0px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Speech-bubble tail */}
        <div
          aria-hidden
          className="absolute bg-neutral-900/95 border-white/[0.08]"
          style={{
            left: tailX - TAIL_SIZE / 2,
            top: flipAbove ? undefined : -TAIL_SIZE / 2,
            bottom: flipAbove ? -TAIL_SIZE / 2 : undefined,
            width: TAIL_SIZE,
            height: TAIL_SIZE,
            transform: 'rotate(45deg)',
            borderTopWidth: flipAbove ? 0 : 1,
            borderLeftWidth: flipAbove ? 0 : 1,
            borderRightWidth: flipAbove ? 1 : 0,
            borderBottomWidth: flipAbove ? 1 : 0,
            borderStyle: 'solid',
          }}
        />

        <input
          autoFocus
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What moved you?"
          className="w-full px-3 py-2.5 bg-neutral-800/60 rounded-xl outline-none text-sm placeholder:text-neutral-500 focus:bg-neutral-800"
        />

        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(emoji === e ? null : e)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-colors ${
                emoji === e ? 'bg-white/15' : 'hover:bg-white/5'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="flex gap-2 text-xs">
          <button
            onClick={() => fileRef.current?.click()}
            className={`flex-1 py-2 rounded-lg border transition-colors ${
              contentType === 'photo'
                ? 'border-white/40 text-white'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            {contentType === 'photo' ? 'Photo ✓' : '+ Photo'}
          </button>
          <button
            onClick={() => videoRef.current?.click()}
            className={`flex-1 py-2 rounded-lg border transition-colors ${
              contentType === 'video'
                ? 'border-white/40 text-white'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
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

        {/* Heart-count pills — intensity ladder, not price tags */}
        <div className="flex gap-1.5">
          {APPRECIATION_LEVELS.map((level) => (
            <HeartPill
              key={level.amount}
              count={level.count}
              amount={level.amount}
              selected={paymentAmount === level.amount}
              onClick={() =>
                setPaymentAmount(paymentAmount === level.amount ? null : level.amount)
              }
            />
          ))}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {uploading && <p className="text-xs text-neutral-400">Uploading…</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <motion.button
            disabled={submitting || uploading}
            onClick={submit}
            whileTap={{ scale: 0.97 }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              paymentAmount
                ? 'bg-gradient-to-br from-rose-400 to-amber-300 text-black shadow-[0_8px_20px_-8px_rgba(244,114,182,0.6)]'
                : 'bg-white text-black'
            }`}
          >
            {submitLabel}
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}
