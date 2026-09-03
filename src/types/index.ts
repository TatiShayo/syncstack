export type CanvasElementType = 'rectangle' | 'ellipse' | 'text' | 'sticky' | 'arrow' | 'connector'

export interface Point {
  x: number
  y: number
}

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export interface SelectionBox {
  x: number
  y: number
  width: number
  height: number
}

export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface AnchorPoint extends Point {
  anchor: AnchorPosition
}

export interface BaseElement {
  id: string
  type: CanvasElementType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  zIndex?: number
  createdAt: number
  updatedAt: number
  locked?: boolean
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle'
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius?: number
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  stroke?: string
  strokeWidth?: number
  align: 'left' | 'center' | 'right'
}

export interface StickyNoteElement extends BaseElement {
  type: 'sticky'
  text: string
  color: string
  fontSize: number
  author?: string
}

export interface ArrowConnectorElement extends BaseElement {
  type: 'arrow' | 'connector'
  startPoint: Point
  endPoint: Point
  startBinding?: {
    elementId: string
    anchor: AnchorPosition
  }
  endBinding?: {
    elementId: string
    anchor: AnchorPosition
  }
  style: 'straight' | 'curved' | 'orthogonal'
  stroke: string
  strokeWidth: number
  arrowHeadStart?: 'none' | 'arrow' | 'circle' | 'diamond'
  arrowHeadEnd?: 'none' | 'arrow' | 'circle' | 'diamond'
  label?: string
}

export type CanvasElement =
  | RectangleElement
  | EllipseElement
  | TextElement
  | StickyNoteElement
  | ArrowConnectorElement

export type ElementUpdate = Partial<CanvasElement>

export interface CardData {
  id: string
  title: string
  description: string
  assignee: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
}

export interface ColumnData {
  id: string
  name: string
  cardIds: string[]
}

export interface ActiveUser {
  id: string
  name: string
  color: string
}

export interface UserPresence {
  id: string
  name: string
  color: string
  cursor?: Point | null
  selectedElementIds?: string[]
  activeTool?: string
  viewport?: {
    x: number
    y: number
    zoom: number
  }
  lastActive: number
}

export interface BoardCredentials {
  id: string
  token: string
}

export type ViewMode = 'both' | 'canvas' | 'kanban'

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'sticky'
  | 'arrow'
  | 'connector'

export interface SyncStackDocumentSnapshot {
  schemaVersion: number
  boardId: string
  title?: string
  exportedAt: string
  elements: CanvasElement[]
  cards: Record<string, CardData>
  columns: Record<string, string[]>
}
