import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

interface Props {
  /** Viewport coordinates of the burst origin. */
  x: number
  y: number
  onDone: () => void
}

const PARTICLE_COUNT = 9
const DURATION_MS = 900

/**
 * Brief celebratory burst rendered at viewport coordinates.
 * Used for paid reactions only. Auto-dismisses after DURATION_MS.
 */
export function PinSparkle({ x, y, onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, DURATION_MS)
    return () => window.clearTimeout(t)
  }, [onDone])

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
      const angle =
        (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4
      const dist = 32 + Math.random() * 22
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 0.06,
        size: 4 + Math.random() * 4,
      }
    })
  }, [])

  return (
    <div
      className="fixed pointer-events-none z-[45]"
      style={{ left: x, top: y }}
      aria-hidden
    >
      {/* Soft warm halo */}
      <motion.span
        initial={{ scale: 0.4, opacity: 0.9 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-amber-300/40 blur-md"
      />
      {/* Sparkle particles */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.3 }}
          transition={{
            duration: 0.75,
            delay: p.delay,
            ease: [0.22, 0.7, 0.32, 1], // ease-out-quart-ish
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(253,224,71,0.8)]"
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  )
}
