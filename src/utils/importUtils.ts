import {
  CanvasElement,
  CardData,
  SyncStackDocumentSnapshot
} from '../types'

export interface ImportResult {
  success: boolean
  snapshot?: SyncStackDocumentSnapshot
  error?: string
}

/**
 * Validate and sanitize an imported JSON snapshot
 */
export function importFromJson(jsonString: string): ImportResult {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Input must be a non-empty string' }
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonString)
  } catch (err: any) {
    return { success: false, error: `Invalid JSON format: ${err.message}` }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, error: 'Root snapshot must be a valid JSON object' }
  }

  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion < 1) {
    return { success: false, error: 'Invalid or unsupported schemaVersion' }
  }

  const boardId = typeof parsed.boardId === 'string' && parsed.boardId.trim() ? parsed.boardId.trim() : 'imported-board'
  const title = typeof parsed.title === 'string' ? parsed.title.slice(0, 100) : 'Imported Board'
  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString()

  // Sanitize elements
  const validElements: CanvasElement[] = []
  if (Array.isArray(parsed.elements)) {
    for (const rawElem of parsed.elements) {
      if (!rawElem || typeof rawElem !== 'object') continue

      const id = typeof rawElem.id === 'string' && rawElem.id.trim()
        ? rawElem.id.trim()
        : 'elem_' + Math.random().toString(36).substring(2, 9)
      const type = rawElem.type

      if (!['rectangle', 'ellipse', 'text', 'sticky', 'arrow', 'connector'].includes(type)) {
        continue
      }

      const x = typeof rawElem.x === 'number' && !isNaN(rawElem.x) ? rawElem.x : 0
      const y = typeof rawElem.y === 'number' && !isNaN(rawElem.y) ? rawElem.y : 0
      const width = typeof rawElem.width === 'number' && !isNaN(rawElem.width) ? Math.max(1, rawElem.width) : 100
      const height = typeof rawElem.height === 'number' && !isNaN(rawElem.height) ? Math.max(1, rawElem.height) : 100
      const rotation = typeof rawElem.rotation === 'number' && !isNaN(rawElem.rotation) ? rawElem.rotation : 0
      const opacity = typeof rawElem.opacity === 'number' && !isNaN(rawElem.opacity) ? Math.max(0, Math.min(1, rawElem.opacity)) : 1
      const zIndex = typeof rawElem.zIndex === 'number' && !isNaN(rawElem.zIndex) ? rawElem.zIndex : 0
      const createdAt = typeof rawElem.createdAt === 'number' ? rawElem.createdAt : Date.now()
      const updatedAt = typeof rawElem.updatedAt === 'number' ? rawElem.updatedAt : Date.now()

      const base = {
        id,
        type,
        x,
        y,
        width,
        height,
        rotation,
        opacity,
        zIndex,
        createdAt,
        updatedAt
      }

      if (type === 'rectangle') {
        validElements.push({
          ...base,
          type: 'rectangle',
          fill: typeof rawElem.fill === 'string' ? rawElem.fill : '#3b82f6',
          stroke: typeof rawElem.stroke === 'string' ? rawElem.stroke : '#1d4ed8',
          strokeWidth: typeof rawElem.strokeWidth === 'number' ? Math.max(0, rawElem.strokeWidth) : 2,
          cornerRadius: typeof rawElem.cornerRadius === 'number' ? Math.max(0, rawElem.cornerRadius) : 0
        })
      } else if (type === 'ellipse') {
        validElements.push({
          ...base,
          type: 'ellipse',
          fill: typeof rawElem.fill === 'string' ? rawElem.fill : '#10b981',
          stroke: typeof rawElem.stroke === 'string' ? rawElem.stroke : '#047857',
          strokeWidth: typeof rawElem.strokeWidth === 'number' ? Math.max(0, rawElem.strokeWidth) : 2
        })
      } else if (type === 'text') {
        validElements.push({
          ...base,
          type: 'text',
          text: typeof rawElem.text === 'string' ? rawElem.text : 'Text',
          fontSize: typeof rawElem.fontSize === 'number' ? Math.max(8, Math.min(144, rawElem.fontSize)) : 16,
          fontFamily: typeof rawElem.fontFamily === 'string' ? rawElem.fontFamily : 'sans-serif',
          fill: typeof rawElem.fill === 'string' ? rawElem.fill : '#f8fafc',
          stroke: typeof rawElem.stroke === 'string' ? rawElem.stroke : undefined,
          strokeWidth: typeof rawElem.strokeWidth === 'number' ? rawElem.strokeWidth : undefined,
          align: ['left', 'center', 'right'].includes(rawElem.align) ? rawElem.align : 'left'
        })
      } else if (type === 'sticky') {
        validElements.push({
          ...base,
          type: 'sticky',
          text: typeof rawElem.text === 'string' ? rawElem.text : '',
          color: typeof rawElem.color === 'string' ? rawElem.color : '#fef08a',
          fontSize: typeof rawElem.fontSize === 'number' ? Math.max(8, Math.min(48, rawElem.fontSize)) : 14,
          author: typeof rawElem.author === 'string' ? rawElem.author : undefined
        })
      } else if (type === 'arrow' || type === 'connector') {
        const startPoint =
          rawElem.startPoint && typeof rawElem.startPoint.x === 'number' && typeof rawElem.startPoint.y === 'number'
            ? { x: rawElem.startPoint.x, y: rawElem.startPoint.y }
            : { x: 0, y: 0 }
        const endPoint =
          rawElem.endPoint && typeof rawElem.endPoint.x === 'number' && typeof rawElem.endPoint.y === 'number'
            ? { x: rawElem.endPoint.x, y: rawElem.endPoint.y }
            : { x: 100, y: 100 }

        validElements.push({
          ...base,
          type: type as 'arrow' | 'connector',
          startPoint,
          endPoint,
          style: ['straight', 'curved', 'orthogonal'].includes(rawElem.style) ? rawElem.style : 'straight',
          stroke: typeof rawElem.stroke === 'string' ? rawElem.stroke : '#94a3b8',
          strokeWidth: typeof rawElem.strokeWidth === 'number' ? Math.max(1, rawElem.strokeWidth) : 2,
          arrowHeadStart: ['none', 'arrow', 'circle', 'diamond'].includes(rawElem.arrowHeadStart)
            ? rawElem.arrowHeadStart
            : 'none',
          arrowHeadEnd: ['none', 'arrow', 'circle', 'diamond'].includes(rawElem.arrowHeadEnd)
            ? rawElem.arrowHeadEnd
            : 'arrow',
          label: typeof rawElem.label === 'string' ? rawElem.label : undefined,
          startBinding: rawElem.startBinding,
          endBinding: rawElem.endBinding
        })
      }
    }
  }

  // Sanitize cards
  const validCards: Record<string, CardData> = {}
  if (parsed.cards && typeof parsed.cards === 'object' && !Array.isArray(parsed.cards)) {
    for (const [cardId, rawCard] of Object.entries(parsed.cards)) {
      if (!rawCard || typeof rawCard !== 'object') continue
      const card = rawCard as any
      validCards[cardId] = {
        id: cardId,
        title: typeof card.title === 'string' ? card.title.slice(0, 100) : 'Untitled Card',
        description: typeof card.description === 'string' ? card.description.slice(0, 500) : '',
        assignee: typeof card.assignee === 'string' ? card.assignee.slice(0, 50) : '',
        priority: ['low', 'medium', 'high'].includes(card.priority) ? card.priority : 'medium',
        tags: Array.isArray(card.tags) ? card.tags.filter((t: any) => typeof t === 'string') : []
      }
    }
  }

  // Sanitize columns
  const validColumns: Record<string, string[]> = {
    todo: Array.isArray(parsed.columns?.todo) ? parsed.columns.todo.filter((id: any) => typeof id === 'string') : [],
    'in-progress': Array.isArray(parsed.columns?.['in-progress'])
      ? parsed.columns['in-progress'].filter((id: any) => typeof id === 'string')
      : [],
    done: Array.isArray(parsed.columns?.done) ? parsed.columns.done.filter((id: any) => typeof id === 'string') : []
  }

  return {
    success: true,
    snapshot: {
      schemaVersion: parsed.schemaVersion,
      boardId,
      title,
      exportedAt,
      elements: validElements,
      cards: validCards,
      columns: validColumns
    }
  }
}
