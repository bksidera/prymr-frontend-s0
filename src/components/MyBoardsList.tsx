import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { boardsService, type BoardSummary } from '../services/boards.service'

function shareUrlFor(boardId: string): string {
  return `${window.location.origin}/b/${boardId}`
}

interface RowProps {
  board: BoardSummary
}

function BoardRow({ board }: RowProps) {
  const image = board.BoardImages[0]
  const url = shareUrlFor(board.id)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-neutral-900 border border-neutral-800 rounded-xl">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 w-12 h-16 bg-neutral-800 rounded-md overflow-hidden flex items-center justify-center"
        title="Open board"
      >
        {image?.imageUrl ? (
          <img
            src={image.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xs text-neutral-600">no img</span>
        )}
      </a>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex-1 min-w-0 text-xs text-neutral-300 truncate hover:text-white"
        title={url}
      >
        {url.replace(/^https?:\/\//, '')}
      </a>

      <button
        onClick={copy}
        className="shrink-0 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-200"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function MyBoardsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-boards', 'published'],
    queryFn: () => boardsService.getMyBoards(1, 50, 'published'),
  })

  return (
    <section className="w-full max-w-md mt-10">
      <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-3">
        Your boards
      </h2>

      {isLoading && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          {error instanceof Error ? error.message : 'Could not load your boards'}
        </p>
      )}

      {data && data.items.length === 0 && (
        <p className="text-sm text-neutral-500">
          You haven't published anything yet. Upload an image above to make your first board.
        </p>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((board) => (
            <li key={board.id}>
              <BoardRow board={board} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
