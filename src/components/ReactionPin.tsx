import { motion } from 'framer-motion'
import type { OptimisticPin } from '../hooks/useBoardReactions'

interface Props {
  pin: OptimisticPin
  scale: number
  onClick: (rect: DOMRect) => void
}

function HeartGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-3 h-3 text-rose-100"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

export function ReactionPin({ pin, scale, onClick }: Props) {
  // Backend stores top/left as strings of normalized 0–1 floats.
  const top = pin.normalizedY ?? (pin.top ? parseFloat(pin.top) : null)
  const left = pin.normalizedX ?? (pin.left ? parseFloat(pin.left) : null)
  if (top === null || left === null || Number.isNaN(top) || Number.isNaN(left)) return null

  const hasPayment = pin.hasPayment || (pin._pendingAmount ?? 0) > 0
  const initial = (pin.user?.userName ?? '?').slice(0, 1).toUpperCase()

  // Counter-scale so pin stays a constant on-screen size as the image zooms.
  const inv = 1 / scale

  // Pin content priority: payment glyph > emoji > username initial.
  // (Avatars intentionally not shown in s0 — the placeholder URL we use at
  // signup doesn't exist, and avatar upload isn't a feature here yet.)
  let content: React.ReactNode
  if (hasPayment) {
    content = <HeartGlyph />
  } else if (pin.emoji) {
    content = <span className="text-sm leading-none">{pin.emoji}</span>
  } else {
    content = <span className="text-[10px] font-medium text-neutral-200">{initial}</span>
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick((e.currentTarget as HTMLElement).getBoundingClientRect())
      }}
      className="absolute"
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        transform: `translate(-50%, -50%) scale(${inv})`,
        transformOrigin: 'center center',
      }}
    >
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 320 }}
        className={`block w-6 h-6 rounded-full border-2 flex items-center justify-center ${
          hasPayment
            ? 'bg-gradient-to-br from-rose-400 to-amber-300 border-amber-200 shadow-[0_0_14px_rgba(255,200,80,0.65)]'
            : 'bg-neutral-800/90 border-white/70'
        }`}
      >
        {content}
      </motion.span>
    </button>
  )
}
