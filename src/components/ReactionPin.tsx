import type { OptimisticPin } from '../hooks/useBoardReactions'

interface Props {
  pin: OptimisticPin
  scale: number
  onClick: (rect: DOMRect) => void
}

export function ReactionPin({ pin, scale, onClick }: Props) {
  // Backend stores top/left as strings of normalized 0–1 floats.
  const top = pin.normalizedY ?? (pin.top ? parseFloat(pin.top) : null)
  const left = pin.normalizedX ?? (pin.left ? parseFloat(pin.left) : null)
  if (top === null || left === null || Number.isNaN(top) || Number.isNaN(left)) return null

  const hasPayment = pin.hasPayment || (pin._pendingAmount ?? 0) > 0
  const avatar = pin.user?.profileIcon ?? pin.user?.initialProfileIcon ?? null
  const initial = (pin.user?.userName ?? '?').slice(0, 1).toUpperCase()

  // Counter-scale the pin so it stays the same on-screen size as the user zooms.
  const inv = 1 / scale

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
      <span
        className={`block w-6 h-6 rounded-full overflow-hidden border-2 ${
          hasPayment
            ? 'border-amber-300 shadow-[0_0_12px_rgba(255,200,80,0.7)]'
            : 'border-white/80'
        } bg-neutral-800 flex items-center justify-center text-[10px] font-medium`}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : pin.emoji ? (
          <span className="text-sm leading-none">{pin.emoji}</span>
        ) : (
          initial
        )}
      </span>
    </button>
  )
}
