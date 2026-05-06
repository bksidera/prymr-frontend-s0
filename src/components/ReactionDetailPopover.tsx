import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { boardsService } from '../services/boards.service'

interface Props {
  reactionId: string
  anchorX: number
  anchorY: number
  onClose: () => void
}

export function ReactionDetailPopover({ reactionId, anchorX, anchorY, onClose }: Props) {
  const isOptimistic = reactionId.startsWith('optimistic-')
  const { data, isLoading, error } = useQuery({
    queryKey: ['reaction', reactionId],
    queryFn: () => boardsService.getReactionDetail(reactionId),
    enabled: !isOptimistic,
  })

  const PAD = 12
  const W = 280
  const H_EST = 160
  const left = Math.max(PAD, Math.min(window.innerWidth - W - PAD, anchorX - W / 2))
  const top = Math.max(PAD, Math.min(window.innerHeight - H_EST - PAD, anchorY + 16))

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.12 }}
        className="fixed z-50 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-4 space-y-2"
        style={{ left, top, width: W }}
        onClick={(e) => e.stopPropagation()}
      >
        {isOptimistic && <p className="text-sm text-neutral-400">Just sent</p>}
        {!isOptimistic && isLoading && <p className="text-sm text-neutral-400">Loading…</p>}
        {error && <p className="text-sm text-red-400">Couldn’t load reaction</p>}
        {data && (
          <>
            <p className="text-xs text-neutral-500">@{data.user?.userName ?? 'guest'}</p>
            {data.emoji && <div className="text-2xl">{data.emoji}</div>}
            {data.contentText && <p className="text-sm">{data.contentText}</p>}
            {data.contentUrl && data.contentType === 'photo' && (
              <img src={data.contentUrl} alt="" className="w-full rounded-lg" />
            )}
            {data.contentUrl && data.contentType === 'video' && (
              <video
                src={data.contentUrl}
                controls
                playsInline
                className="w-full rounded-lg"
              />
            )}
          </>
        )}
      </motion.div>
    </>
  )
}
