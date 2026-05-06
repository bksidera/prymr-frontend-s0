import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onDone: () => void
}

const DURATION_MS = 2000

/** Brief warm confirmation that an appreciation payment landed. */
export function AppreciationToast({ onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, DURATION_MS)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -8, opacity: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-neutral-900/85 backdrop-blur-md border border-amber-300/30 text-sm text-amber-100 shadow-xl pointer-events-none"
      aria-live="polite"
    >
      Your appreciation was sent <span className="ml-1">💛</span>
    </motion.div>
  )
}
