import { v4 as uuidv4 } from 'uuid'
import { migrateBoardSchema } from '../types/board.types'
import type { BoardSchema } from '../types/board.types'

export function createEmptyBoard(
  creatorId: string,
  aspectRatio: BoardSchema['aspectRatio'] = '9:16',
  id: string = uuidv4(),
): BoardSchema {
  return {
    version: '2',
    id,
    creatorId,
    background: '#000000',
    aspectRatio,
    elements: [],
    tappables: [],
    metadata: {
      createdAt: new Date().toISOString(),
      boardStatus: 'draft',
      introState: null,
    },
  }
}

export function serializeBoard(board: BoardSchema): string {
  return JSON.stringify(board)
}

export function deserializeBoard(json: string): BoardSchema {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error('Invalid board schema')
  }
  const v = (parsed as { version: unknown }).version
  if (v !== '1.0' && v !== '2') {
    throw new Error(`Unsupported board schema version: ${String(v)}`)
  }
  return migrateBoardSchema(parsed as BoardSchema)
}
