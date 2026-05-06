import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { ImageUploader } from '../components/ImageUploader'
import { MyBoardsList } from '../components/MyBoardsList'
import { boardsService } from '../services/boards.service'
import { authStore, useAuth } from '../stores/authStore'
import { createEmptyBoard } from '../utils/boardSchema'
import type { BoardSchema } from '../types/board.types'

type Phase = 'idle' | 'uploaded' | 'publishing' | 'published' | 'error'

export function CreatorPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function buildSchemaFor(creatorId: string, url: string): BoardSchema {
    const board = createEmptyBoard(creatorId)
    board.elements = [
      {
        id: uuidv4(),
        type: 'image',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        rotation: 0,
        zIndex: 0,
        url,
      },
    ]
    return board
  }

  async function publish() {
    if (!user || !imageUrl) return
    setPhase('publishing')
    setError(null)
    try {
      const schema = buildSchemaFor(user.id, imageUrl)
      const { boardId, boardImageId } = await boardsService.createBoard(schema)
      schema.id = boardId
      await boardsService.saveBoard(boardImageId, schema)
      const url = await boardsService.publishBoard(boardId, boardImageId)
      setShareUrl(url)
      setPhase('published')
      // Refresh the "Your boards" list so the new one shows up immediately.
      void queryClient.invalidateQueries({ queryKey: ['my-boards'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
      setPhase('error')
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function reset() {
    setPhase('idle')
    setImageUrl(null)
    setShareUrl(null)
    setError(null)
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">New board</h1>
        <button
          onClick={() => authStore.getState().logout()}
          className="text-sm text-neutral-400 hover:text-white"
        >
          Sign out
        </button>
      </div>

      <div className="w-full max-w-md">
        {phase === 'idle' && (
          <ImageUploader
            onUploaded={(url) => {
              setImageUrl(url)
              setPhase('uploaded')
            }}
          />
        )}

        {phase === 'uploaded' && imageUrl && (
          <div className="space-y-4">
            <div className="w-full aspect-[9/16] max-h-[70vh] bg-neutral-900 rounded-2xl overflow-hidden flex items-center justify-center">
              <img src={imageUrl} alt="" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 border border-neutral-700 rounded-lg text-neutral-300"
              >
                Replace
              </button>
              <button
                onClick={publish}
                className="flex-1 py-3 bg-white text-black rounded-lg font-medium"
              >
                Publish
              </button>
            </div>
          </div>
        )}

        {phase === 'publishing' && (
          <p className="text-center text-neutral-400 py-12">Publishing…</p>
        )}

        {phase === 'published' && shareUrl && (
          <div className="space-y-4">
            <p className="text-neutral-400 text-sm">Your board is live</p>
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3">
              <code className="flex-1 text-sm break-all">{shareUrl}</code>
              <button
                onClick={copyShareUrl}
                className="px-3 py-1 bg-white text-black rounded text-sm font-medium"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full py-3 text-center border border-neutral-700 rounded-lg"
            >
              Open
            </a>
            <button
              onClick={reset}
              className="block w-full py-3 text-center text-neutral-400"
            >
              Create another
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <p className="text-red-400">{error}</p>
            <button
              onClick={reset}
              className="w-full py-3 border border-neutral-700 rounded-lg"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <MyBoardsList />
    </div>
  )
}
