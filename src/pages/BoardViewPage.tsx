import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { boardsService } from '../services/boards.service'
import { useGuestAuth } from '../hooks/useGuestAuth'
import { useBoardReactions } from '../hooks/useBoardReactions'
import { BoardFrame } from '../components/BoardFrame'
import { ReactionComposer, type ComposerSubmit } from '../components/ReactionComposer'
import { ReactionPin } from '../components/ReactionPin'
import { ReactionDetailPopover } from '../components/ReactionDetailPopover'
import { PinSparkle } from '../components/PinSparkle'
import { AppreciationToast } from '../components/AppreciationToast'
import type { TapEvent } from '../hooks/usePanZoom'

interface ComposerState {
  clientX: number
  clientY: number
  imageX: number
  imageY: number
}

interface DetailState {
  reactionId: string
  clientX: number
  clientY: number
}

export function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { ready: authReady, error: authError } = useGuestAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-board', boardId],
    queryFn: () => boardsService.getPublicBoard(boardId as string),
    enabled: !!boardId && authReady,
  })

  const boardImageId = data?.boardImageId
  const { pinsQuery, addReaction } = useBoardReactions(boardImageId)

  const [composer, setComposer] = useState<ComposerState | null>(null)
  const [detail, setDetail] = useState<DetailState | null>(null)
  // Celebration state for paid-reaction submissions. Sparkle and toast each
  // clear their own state when their animations finish.
  const [sparkle, setSparkle] = useState<{ x: number; y: number; key: number } | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  function onTap(e: TapEvent) {
    setDetail(null)
    setComposer({ clientX: e.clientX, clientY: e.clientY, imageX: e.imageX, imageY: e.imageY })
  }

  async function handleSubmit(c: ComposerSubmit) {
    if (!boardImageId || !composer) return

    const reactionType: 'emoji' | 'photo' | 'video' | 'text' =
      c.contentType === 'photo'
        ? 'photo'
        : c.contentType === 'video'
          ? 'video'
          : c.emoji
            ? 'emoji'
            : 'text'

    await addReaction.mutateAsync({
      input: {
        boardImageId,
        reactionType,
        emoji: c.emoji ?? undefined,
        contentText: c.text || undefined,
        contentUrl: c.contentUrl ?? undefined,
        backgroundCapture: '',
        top: composer.imageY.toString(),
        left: composer.imageX.toString(),
      },
      pendingAmount: c.paymentAmount ?? undefined,
    })

    // Celebrate paid reactions. Use the tap coordinates as the sparkle origin
    // (slightly offset upward so the burst centers visually on the new pin).
    if (c.paymentAmount && c.paymentAmount > 0) {
      setSparkle({ x: composer.clientX, y: composer.clientY, key: Date.now() })
      setToastVisible(true)
    }

    setComposer(null)
  }

  if (authError) {
    return (
      <Centered>
        <p className="text-red-400">Couldn’t start a session: {authError}</p>
      </Centered>
    )
  }

  if (!authReady || isLoading) {
    return (
      <Centered>
        <p className="text-neutral-500 text-sm">Loading…</p>
      </Centered>
    )
  }

  if (error || !data) {
    return (
      <Centered>
        <p className="text-red-400">
          {error instanceof Error ? error.message : 'Board not found'}
        </p>
      </Centered>
    )
  }

  const imageElement = data.schema.elements.find((el) => el.type === 'image' && el.url)
  if (!imageElement?.url) {
    return (
      <Centered>
        <p className="text-neutral-400">This board has no image yet.</p>
      </Centered>
    )
  }

  const pins = pinsQuery.data ?? []

  return (
    <div className="fixed inset-0 bg-black">
      <BoardFrame
        imageUrl={imageElement.url}
        onTap={onTap}
        overlay={({ scale }) => (
          <>
            {pins.map((pin) => (
              <ReactionPin
                key={pin.id}
                pin={pin}
                scale={scale}
                onClick={(rect) => {
                  setComposer(null)
                  setDetail({
                    reactionId: pin.id,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                  })
                }}
              />
            ))}
          </>
        )}
      />

      {composer && (
        <ReactionComposer
          anchorX={composer.clientX}
          anchorY={composer.clientY}
          onSubmit={handleSubmit}
          onClose={() => setComposer(null)}
        />
      )}

      {detail && (
        <ReactionDetailPopover
          reactionId={detail.reactionId}
          anchorX={detail.clientX}
          anchorY={detail.clientY}
          onClose={() => setDetail(null)}
        />
      )}

      {sparkle && (
        <PinSparkle
          key={sparkle.key}
          x={sparkle.x}
          y={sparkle.y}
          onDone={() => setSparkle(null)}
        />
      )}

      {toastVisible && <AppreciationToast onDone={() => setToastVisible(false)} />}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center px-6">{children}</div>
}
