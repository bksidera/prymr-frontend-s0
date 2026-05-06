import apiClient from './apiClient'
import type {
  ApiResponse,
  PublicBoardResponse,
  ReactionPin,
  ReactionDetail,
} from '../types/api.types'
import type { BoardSchema } from '../types/board.types'
import { serializeBoard, deserializeBoard } from '../utils/boardSchema'

export interface CreateBoardResult {
  boardId: string
  boardImageId: string
}

/** Flattened shape consumed by the dashboard list. */
export interface MyBoard {
  boardId: string
  boardImageId: string
  imageUrl: string | null
  lastEdited: string
}

/** Raw shape returned by /board/fetchSavedBoard (one entry per Board, each
 * with a `.board` array of BoardImages). */
interface RawSavedBoardItem {
  board: Array<{
    boardId: string
    boardImageId: string
    boardImage: string | null
    lastEdited: string
  }>
}

export interface AddReactionInput {
  boardImageId: string
  reactionType: 'emoji' | 'photo' | 'video' | 'text'
  emoji?: string
  contentText?: string
  contentUrl?: string
  backgroundCapture: string
  top: string
  left: string
  paymentIntentId?: string
}

export const boardsService = {
  async createBoard(board: BoardSchema): Promise<CreateBoardResult> {
    const imageUrl =
      board.elements.find((el) => el.url)?.url ??
      'https://prymr-media.s3.us-east-1.amazonaws.com/defaults/board-placeholder.png'
    const res = await apiClient.post<ApiResponse<{ data: CreateBoardResult }>>(
      `/board/createBoard?imageUrl=${encodeURIComponent(imageUrl)}`,
      {},
    )
    return res.data.data.data
  },

  async saveBoard(boardImageId: string, board: BoardSchema): Promise<void> {
    await apiClient.put('/board/saveBoardSchema', {
      boardImageId,
      jsonElement: serializeBoard(board),
    })
  },

  async fetchMyCollections(): Promise<Array<{ id: string; collectionName: string }>> {
    const res = await apiClient.get<
      ApiResponse<{ data: Array<{ id: string; collectionName: string }> }>
    >('/board/fetchMyCollections')
    return res.data.data.data
  },

  async publishBoard(boardId: string, boardImageId: string): Promise<string> {
    const collections = await this.fetchMyCollections()
    const collectionId = collections[0]?.id
    if (!collectionId) throw new Error('No collection available to publish into')
    await apiClient.post('/board/publishBoard', {
      boardImageId,
      collectionId,
      isPrivateBoard: false,
      boardStatus: 'published',
    })
    return `${window.location.origin}/b/${boardId}`
  },

  async getPublicBoard(
    boardId: string,
  ): Promise<{ schema: BoardSchema; meta: PublicBoardResponse; boardImageId: string }> {
    const res = await apiClient.get<ApiResponse<{ data: PublicBoardResponse }>>(
      `/board/fetchPublicUserBoardDetails?boardId=${boardId}`,
    )
    const meta = res.data.data.data
    const image = meta.images[0]
    if (!image?.jsonElement) throw new Error('Board has no content')
    return { schema: deserializeBoard(image.jsonElement), meta, boardImageId: image.id }
  },

  async addReaction(input: AddReactionInput): Promise<{ id: string }> {
    const res = await apiClient.post<ApiResponse<{ id: string }>>('/board/addReaction', input)
    return res.data.data
  },

  async getReactionPins(boardImageId: string): Promise<ReactionPin[]> {
    const res = await apiClient.get<ApiResponse<{ data: ReactionPin[] }>>(
      `/board/fetchBoardReactionPins?boardImageId=${boardImageId}`,
    )
    return res.data.data.data
  },

  async getMyBoards(page = 1, pageSize = 20): Promise<MyBoard[]> {
    // Note: backend's filterBy=published / draft path crashes because it
    // dereferences customWhereClause.BoardImages.every on an empty object
    // (board.service.ts:2717). Use filterBy=all. Backend's response shape
    // is { count, data: [{ board: [...] }, ...] } — not the PaginatedData
    // shape the old type claimed. Flatten the nested arrays on the way out.
    const res = await apiClient.get<
      ApiResponse<{ count: number; data: RawSavedBoardItem[] }>
    >(
      `/board/fetchSavedBoard?page=${page}&pageSize=${pageSize}&filterBy=all&tappablePageSize=1`,
    )
    const items = res.data.data.data ?? []
    return items.flatMap((entry) =>
      (entry.board ?? []).map((b) => ({
        boardId: b.boardId,
        boardImageId: b.boardImageId,
        imageUrl: b.boardImage ?? null,
        lastEdited: b.lastEdited,
      })),
    )
  },

  async getReactionDetail(reactionId: string): Promise<ReactionDetail> {
    const res = await apiClient.get<ApiResponse<{ data: ReactionDetail }>>(
      `/board/fetchReactionInfo?reactionId=${reactionId}`,
    )
    return res.data.data.data
  },
}
