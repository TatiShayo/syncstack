import * as Y from 'yjs'
import {
  CanvasElement,
  CardData,
  Point,
  SyncStackDocumentSnapshot,
  ArrowConnectorElement
} from '../types'

export class CRDTManager {
  public doc: Y.Doc
  public elementsMap: Y.Map<CanvasElement>
  public cardsMap: Y.Map<CardData>
  public colTodo: Y.Array<string>
  public colInProgress: Y.Array<string>
  public colDone: Y.Array<string>
  public metaMap: Y.Map<any>
  public undoManager: Y.UndoManager

  private changeListeners: Set<() => void> = new Set()
  private pendingChanges = 0
  private isOnline = false
  public readonly clientId: string

  constructor(existingDoc?: Y.Doc) {
    this.doc = existingDoc || new Y.Doc()
    this.clientId = this.doc.clientID.toString()

    this.elementsMap = this.doc.getMap<CanvasElement>('elements')
    this.cardsMap = this.doc.getMap<CardData>('cards')
    this.colTodo = this.doc.getArray<string>('col-todo')
    this.colInProgress = this.doc.getArray<string>('col-in-progress')
    this.colDone = this.doc.getArray<string>('col-done')
    this.metaMap = this.doc.getMap<any>('meta')

    // Initialize UndoManager scoped to local operations with discrete steps (captureTimeout: 0)
    this.undoManager = new Y.UndoManager(
      [this.elementsMap, this.cardsMap, this.colTodo, this.colInProgress, this.colDone],
      {
        trackedOrigins: new Set(['local']),
        captureTimeout: 0
      }
    )

    // Listen for doc updates to notify subscribers and track pending changes
    this.doc.on('update', (_update: Uint8Array, origin: any) => {
      if (!this.isOnline && origin === 'local') {
        this.pendingChanges++
      }
      this.notifyListeners()
    })
  }

  // Subscribe to changes
  public subscribe(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    for (const listener of this.changeListeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in CRDTManager change listener:', err)
      }
    }
  }

  public setOnlineStatus(online: boolean): void {
    this.isOnline = online
    if (online) {
      this.pendingChanges = 0
    }
    this.notifyListeners()
  }

  public getPendingChanges(): number {
    return this.pendingChanges
  }

  public resetPendingChanges(): void {
    this.pendingChanges = 0
    this.notifyListeners()
  }

  // ---------------- CANVAS ELEMENT OPERATIONS ----------------

  public createElement(element: CanvasElement): void {
    this.doc.transact(() => {
      this.elementsMap.set(element.id, { ...element })
    }, 'local')
  }

  public updateElement(id: string, updates: Partial<CanvasElement>): void {
    const existing = this.elementsMap.get(id)
    if (!existing) return

    this.doc.transact(() => {
      this.elementsMap.set(id, {
        ...existing,
        ...updates,
        updatedAt: Date.now()
      } as CanvasElement)
    }, 'local')
  }

  public deleteElement(id: string): void {
    if (!this.elementsMap.has(id)) return
    this.doc.transact(() => {
      this.elementsMap.delete(id)
    }, 'local')
  }

  public deleteElements(ids: string[]): void {
    this.doc.transact(() => {
      for (const id of ids) {
        this.elementsMap.delete(id)
      }
    }, 'local')
  }

  public moveElements(ids: string[], dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    this.doc.transact(() => {
      for (const id of ids) {
        const existing = this.elementsMap.get(id)
        if (!existing) continue

        if (existing.type === 'arrow' || existing.type === 'connector') {
          const arrow = existing as ArrowConnectorElement
          this.elementsMap.set(id, {
            ...arrow,
            startPoint: { x: arrow.startPoint.x + dx, y: arrow.startPoint.y + dy },
            endPoint: { x: arrow.endPoint.x + dx, y: arrow.endPoint.y + dy },
            updatedAt: Date.now()
          })
        } else {
          this.elementsMap.set(id, {
            ...existing,
            x: existing.x + dx,
            y: existing.y + dy,
            updatedAt: Date.now()
          } as CanvasElement)
        }
      }
    }, 'local')
  }

  public getElements(): CanvasElement[] {
    const elements: CanvasElement[] = []
    this.elementsMap.forEach((elem, id) => {
      if (elem) {
        elements.push({ ...elem, id })
      }
    })
    return elements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0) || a.createdAt - b.createdAt)
  }

  public getElement(id: string): CanvasElement | null {
    const elem = this.elementsMap.get(id)
    if (!elem) return null
    return { ...elem, id }
  }

  public bringToFront(id: string): void {
    const elements = this.getElements()
    if (elements.length === 0) return
    const maxZ = elements.reduce((max, e) => Math.max(max, e.zIndex || 0), elements[0].zIndex || 0)
    this.updateElement(id, { zIndex: maxZ + 1 })
  }

  public sendToBack(id: string): void {
    const elements = this.getElements()
    if (elements.length === 0) return
    const minZ = elements.reduce((min, e) => Math.min(min, e.zIndex || 0), elements[0].zIndex || 0)
    this.updateElement(id, { zIndex: minZ - 1 })
  }

  public bringForward(id: string): void {
    const elem = this.getElement(id)
    if (!elem) return
    const currentZ = elem.zIndex || 0
    this.updateElement(id, { zIndex: currentZ + 1 })
  }

  public sendBackward(id: string): void {
    const elem = this.getElement(id)
    if (!elem) return
    const currentZ = elem.zIndex || 0
    this.updateElement(id, { zIndex: currentZ - 1 })
  }

  // ---------------- KANBAN CARD OPERATIONS ----------------

  public getColumnArray(columnId: string): Y.Array<string> {
    if (columnId === 'in-progress') return this.colInProgress
    if (columnId === 'done') return this.colDone
    return this.colTodo
  }

  public validateCardInputs(title: string, description: string, assignee: string): string | null {
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    const trimmedDescription = typeof description === 'string' ? description.trim() : ''
    const trimmedAssignee = typeof assignee === 'string' ? assignee.trim() : ''

    if (!trimmedTitle) {
      return 'Title is required.'
    }
    if (trimmedTitle.length > 100) {
      return 'Title must be 100 characters or less.'
    }
    if (trimmedDescription.length > 500) {
      return 'Description must be 500 characters or less.'
    }
    if (trimmedAssignee.length > 50) {
      return 'Assignee name must be 50 characters or less.'
    }
    return null
  }

  public createCard(
    title: string,
    description: string,
    assignee: string,
    columnId: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    tags: string[] = []
  ): { cardId?: string; error?: string } {
    const valError = this.validateCardInputs(title, description, assignee)
    if (valError) {
      return { error: valError }
    }

    const cardId = 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
    const cardData: CardData = {
      id: cardId,
      title: title.trim(),
      description: description.trim(),
      assignee: assignee.trim(),
      priority,
      tags
    }

    this.doc.transact(() => {
      this.cardsMap.set(cardId, cardData)
      const columnArray = this.getColumnArray(columnId)
      columnArray.push([cardId])
    }, 'local')

    return { cardId }
  }

  public updateCard(
    cardId: string,
    title: string,
    description: string,
    assignee: string,
    modalColumn?: string,
    priority?: 'low' | 'medium' | 'high',
    tags?: string[]
  ): { success: boolean; error?: string } {
    const valError = this.validateCardInputs(title, description, assignee)
    if (valError) {
      return { success: false, error: valError }
    }

    const existing = this.cardsMap.get(cardId)
    if (!existing) {
      return { success: false, error: 'Card not found' }
    }

    this.doc.transact(() => {
      this.cardsMap.set(cardId, {
        ...existing,
        title: title.trim(),
        description: description.trim(),
        assignee: assignee.trim(),
        priority: priority || existing.priority,
        tags: tags || existing.tags
      })

      if (modalColumn) {
        let currentColumnId = ''
        for (const colId of ['todo', 'in-progress', 'done']) {
          const colArray = this.getColumnArray(colId)
          if (colArray.toArray().includes(cardId)) {
            currentColumnId = colId
            break
          }
        }

        if (currentColumnId && currentColumnId !== modalColumn) {
          const oldArray = this.getColumnArray(currentColumnId)
          const oldIndex = oldArray.toArray().indexOf(cardId)
          if (oldIndex !== -1) {
            oldArray.delete(oldIndex, 1)
          }
          const newArray = this.getColumnArray(modalColumn)
          newArray.push([cardId])
        } else if (!currentColumnId) {
          const newArray = this.getColumnArray(modalColumn)
          newArray.push([cardId])
        }
      }
    }, 'local')

    return { success: true }
  }

  public deleteCard(cardId: string, columnId: string): void {
    this.doc.transact(() => {
      this.cardsMap.delete(cardId)
      const colArray = this.getColumnArray(columnId)
      const idx = colArray.toArray().indexOf(cardId)
      if (idx !== -1) {
        colArray.delete(idx, 1)
      }
    }, 'local')
  }

  public moveCard(
    cardId: string,
    sourceColId: string,
    destColId: string,
    destIndex: number
  ): void {
    if (!this.cardsMap.has(cardId)) return

    this.doc.transact(() => {
      const sourceArray = this.getColumnArray(sourceColId)
      const destArray = this.getColumnArray(destColId)

      const srcIndex = sourceArray.toArray().indexOf(cardId)
      if (srcIndex === -1) return

      const safeDestIndex = Math.max(0, destIndex)

      if (sourceColId === destColId) {
        if (srcIndex === safeDestIndex) return
        sourceArray.delete(srcIndex, 1)
        const insertIndex = Math.min(safeDestIndex, sourceArray.length)
        sourceArray.insert(insertIndex, [cardId])
      } else {
        sourceArray.delete(srcIndex, 1)
        const insertIndex = Math.min(safeDestIndex, destArray.length)
        destArray.insert(insertIndex, [cardId])
      }
    }, 'local')
  }

  public getCardsForColumn(columnId: string): CardData[] {
    const columnArray = this.getColumnArray(columnId)
    const cards: CardData[] = []
    const toRemove: number[] = []

    columnArray.toArray().forEach((cardId, index) => {
      const card = this.cardsMap.get(cardId)
      if (!card) {
        // Prune orphaned card IDs during read
        toRemove.push(index)
      } else {
        cards.push({ ...card })
      }
    })

    if (toRemove.length > 0) {
      this.doc.transact(() => {
        for (let i = toRemove.length - 1; i >= 0; i--) {
          columnArray.delete(toRemove[i], 1)
        }
      }, 'local')
    }

    return cards
  }

  // ---------------- UNDO / REDO OPERATIONS ----------------

  public undo(): boolean {
    if (this.canUndo()) {
      this.undoManager.undo()
      this.notifyListeners()
      return true
    }
    return false
  }

  public redo(): boolean {
    if (this.canRedo()) {
      this.undoManager.redo()
      this.notifyListeners()
      return true
    }
    return false
  }

  public canUndo(): boolean {
    return this.undoManager.canUndo()
  }

  public canRedo(): boolean {
    return this.undoManager.canRedo()
  }

  public clearUndoStack(): void {
    this.undoManager.clear()
    this.notifyListeners()
  }

  // ---------------- SNAPSHOT & EXPORT / IMPORT ----------------

  public exportSnapshot(boardId = 'board1'): SyncStackDocumentSnapshot {
    const elements = this.getElements()
    const cards: Record<string, CardData> = {}
    this.cardsMap.forEach((card, id) => {
      if (card) {
        cards[id] = { ...card }
      }
    })

    const columns: Record<string, string[]> = {
      todo: this.colTodo.toArray(),
      'in-progress': this.colInProgress.toArray(),
      done: this.colDone.toArray()
    }

    return {
      schemaVersion: 1,
      boardId,
      title: this.metaMap.get('title') || 'SyncStack Board',
      exportedAt: new Date().toISOString(),
      elements,
      cards,
      columns
    }
  }

  public loadSnapshot(snapshot: SyncStackDocumentSnapshot): void {
    this.doc.transact(() => {
      // Clear existing elements
      const currentElementKeys = Array.from(this.elementsMap.keys())
      for (const key of currentElementKeys) {
        this.elementsMap.delete(key)
      }

      // Load elements
      for (const elem of snapshot.elements || []) {
        this.elementsMap.set(elem.id, { ...elem })
      }

      // Clear existing cards
      const currentCardKeys = Array.from(this.cardsMap.keys())
      for (const key of currentCardKeys) {
        this.cardsMap.delete(key)
      }

      // Load cards
      for (const [cardId, cardData] of Object.entries(snapshot.cards || {})) {
        this.cardsMap.set(cardId, { ...cardData })
      }

      // Clear columns
      if (this.colTodo.length > 0) this.colTodo.delete(0, this.colTodo.length)
      if (this.colInProgress.length > 0) this.colInProgress.delete(0, this.colInProgress.length)
      if (this.colDone.length > 0) this.colDone.delete(0, this.colDone.length)

      // Load columns
      if (snapshot.columns?.todo?.length) {
        this.colTodo.push(snapshot.columns.todo)
      }
      if (snapshot.columns?.['in-progress']?.length) {
        this.colInProgress.push(snapshot.columns['in-progress'])
      }
      if (snapshot.columns?.done?.length) {
        this.colDone.push(snapshot.columns.done)
      }

      // Load metadata
      if (snapshot.title) {
        this.metaMap.set('title', snapshot.title)
      }
    }, 'local')

    this.undoManager.clear()
    this.notifyListeners()
  }

  // ---------------- USERNAME SANITIZATION HELPER (SEC-03) ----------------

  public static sanitizeUsername(name: string): string {
    if (typeof name !== 'string') return 'Anonymous'
    const trimmed = name.slice(0, 50).trim()
    return trimmed.length > 0 ? trimmed : 'Anonymous'
  }

  public destroy(): void {
    this.changeListeners.clear()
    this.undoManager.destroy()
  }
}
