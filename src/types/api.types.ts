export interface ApiResponse<T = unknown> {
  status: boolean
  message: string
  data: T
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ReactionPin {
  id: string
  top: string | null
  left: string | null
  normalizedX: number | null
  normalizedY: number | null
  emoji: string | null
  contentType: string | null
  hasPayment?: boolean
  user: {
    profileIcon: string | null
    initialProfileIcon: string | null
    userName: string
  } | null
}

export interface ReactionDetail {
  contentText: string | null
  contentType: string | null
  contentUrl: string | null
  emoji: string | null
  createdAt: string
  totalLikes: number
  backgroundCapture: string | null
  user: {
    userName: string
    profileIcon: string | null
    id: string
  } | null
  newTransaction: Array<{
    totalAmount: string
    price: string
  }>
}

export interface PublicBoardImage {
  id: string
  url: string
  status: string
  title?: string
  description?: string
  jsonElement: string
  allowComments: boolean
  lastEditedAt: string
}

export interface PublicBoardResponse {
  boardId: string
  createdAt: string
  user: { name: string; icon: string | null; username?: string | null }
  images: PublicBoardImage[]
}
