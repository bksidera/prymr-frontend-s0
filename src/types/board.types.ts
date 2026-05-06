export type BoardSchemaVersion = '1.0' | '2'

export interface BoardSchema {
  version: BoardSchemaVersion
  id: string
  creatorId: string
  title?: string
  description?: string
  background: string
  aspectRatio: '9:16' | '1:1' | '4:3' | '16:9'
  elements: BoardElement[]
  tappables: TappableZone[]
  metadata: {
    createdAt: string
    publishedAt?: string
    boardStatus: 'draft' | 'published'
    introState?: IntroState | null
  }
}

export interface IntroState {
  zoom: number
  x: number
  y: number
}

export interface BoardElement {
  id: string
  type: 'image' | 'video' | 'gif' | 'text' | 'shape'
  x: number
  y: number
  w: number
  h: number
  rotation: number
  zIndex: number
  initiallyHidden?: boolean
  url?: string
  content?: string
  style?: {
    fontFamily?: string
    fontSize?: number
    color?: string
    backgroundColor?: string
    opacity?: number
    borderRadius?: number
  }
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
}

export interface TappableZone {
  id: string
  x: number
  y: number
  w: number
  h: number
  action: TappableAction
  visible: boolean
  style?: {
    opacity?: number
    borderRadius?: number
    color?: string
  }
}

export type TappableAction =
  | { type: 'appreciation'; suggestedAmount?: number }
  | { type: 'link'; url: string; openIn: 'same' | 'new' }
  | { type: 'reveal'; elementId: string }
  | { type: 'vanish'; elementId: string }
  | { type: 'switch'; fromElementId?: string; toElementId: string }
  | { type: 'follow' }

export function migrateBoardSchema(schema: BoardSchema): BoardSchema {
  if (schema.version === '2') return schema
  if (!schema.metadata) {
    schema.metadata = {
      createdAt: new Date().toISOString(),
      boardStatus: 'draft',
      introState: null,
    }
  } else if (schema.metadata.introState === undefined) {
    schema.metadata.introState = null
  }
  schema.version = '2'
  return schema
}
