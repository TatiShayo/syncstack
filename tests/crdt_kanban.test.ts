import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { CRDTManager } from '../src/crdt/crdtManager'

describe('CRDT Kanban Operations', () => {
  let manager: CRDTManager

  beforeEach(() => {
    manager = new CRDTManager()
  })

  it('initializes with empty columns', () => {
    expect(manager.getCardsForColumn('todo')).toHaveLength(0)
    expect(manager.getCardsForColumn('in-progress')).toHaveLength(0)
    expect(manager.getCardsForColumn('done')).toHaveLength(0)
  })

  it('creates card with valid fields', () => {
    const res = manager.createCard('Task 1', 'Task Description', 'Alice', 'todo', 'high')
    expect(res.error).toBeUndefined()
    expect(res.cardId).toBeDefined()

    const cards = manager.getCardsForColumn('todo')
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe(res.cardId)
    expect(cards[0].title).toBe('Task 1')
    expect(cards[0].description).toBe('Task Description')
    expect(cards[0].assignee).toBe('Alice')
    expect(cards[0].priority).toBe('high')
  })

  describe('Input Validation Rules', () => {
    it('rejects empty title', () => {
      const res = manager.createCard('   ', 'Desc', 'Alice', 'todo')
      expect(res.error).toBe('Title is required.')
    })

    it('rejects title longer than 100 characters', () => {
      const res = manager.createCard('a'.repeat(101), 'Desc', 'Alice', 'todo')
      expect(res.error).toBe('Title must be 100 characters or less.')
    })

    it('rejects description longer than 500 characters', () => {
      const res = manager.createCard('Title', 'a'.repeat(501), 'Alice', 'todo')
      expect(res.error).toBe('Description must be 500 characters or less.')
    })

    it('rejects assignee longer than 50 characters', () => {
      const res = manager.createCard('Title', 'Desc', 'a'.repeat(51), 'todo')
      expect(res.error).toBe('Assignee name must be 50 characters or less.')
    })
  })

  it('updates card fields without column change', () => {
    const { cardId } = manager.createCard('Orig Title', 'Orig Desc', 'Alice', 'todo')
    const updateRes = manager.updateCard(
      cardId!,
      'New Title',
      'New Desc',
      'Bob',
      'todo',
      'low'
    )
    expect(updateRes.success).toBe(true)

    const cards = manager.getCardsForColumn('todo')
    expect(cards[0].title).toBe('New Title')
    expect(cards[0].description).toBe('New Desc')
    expect(cards[0].assignee).toBe('Bob')
    expect(cards[0].priority).toBe('low')
  })

  it('updates card with column change', () => {
    const { cardId } = manager.createCard('Card 1', 'Desc', 'Alice', 'todo')
    manager.updateCard(cardId!, 'Card 1', 'Desc', 'Alice', 'in-progress')

    expect(manager.getCardsForColumn('todo')).toHaveLength(0)
    const inProgress = manager.getCardsForColumn('in-progress')
    expect(inProgress).toHaveLength(1)
    expect(inProgress[0].id).toBe(cardId)
  })

  it('moves card between columns with moveCard', () => {
    const { cardId } = manager.createCard('Card 1', 'Desc', 'Alice', 'todo')
    manager.moveCard(cardId!, 'todo', 'done', 0)

    expect(manager.getCardsForColumn('todo')).toHaveLength(0)
    const done = manager.getCardsForColumn('done')
    expect(done).toHaveLength(1)
    expect(done[0].id).toBe(cardId)
  })

  it('reorders cards within same column: down (srcIndex < destIndex)', () => {
    const { cardId: c1 } = manager.createCard('Card 1', 'D1', 'A', 'todo')
    const { cardId: c2 } = manager.createCard('Card 2', 'D2', 'B', 'todo')
    const { cardId: c3 } = manager.createCard('Card 3', 'D3', 'C', 'todo')

    manager.moveCard(c1!, 'todo', 'todo', 2)

    const cards = manager.getCardsForColumn('todo')
    expect(cards.map((c) => c.id)).toEqual([c2, c3, c1])
  })

  it('reorders cards within same column: up (srcIndex > destIndex)', () => {
    const { cardId: c1 } = manager.createCard('Card 1', 'D1', 'A', 'todo')
    const { cardId: c2 } = manager.createCard('Card 2', 'D2', 'B', 'todo')
    const { cardId: c3 } = manager.createCard('Card 3', 'D3', 'C', 'todo')

    manager.moveCard(c3!, 'todo', 'todo', 0)

    const cards = manager.getCardsForColumn('todo')
    expect(cards.map((c) => c.id)).toEqual([c3, c1, c2])
  })

  it('handles moveCard no-op path (srcIndex === destIndex)', () => {
    const { cardId: c1 } = manager.createCard('Card 1', 'D1', 'A', 'todo')
    manager.moveCard(c1!, 'todo', 'todo', 0)

    const cards = manager.getCardsForColumn('todo')
    expect(cards[0].id).toBe(c1)
  })

  it('deletes card cleanly', () => {
    const { cardId: c1 } = manager.createCard('Card 1', 'D1', 'A', 'todo')
    const { cardId: c2 } = manager.createCard('Card 2', 'D2', 'B', 'todo')

    manager.deleteCard(c1!, 'todo')

    expect(manager.cardsMap.has(c1!)).toBe(false)
    const cards = manager.getCardsForColumn('todo')
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe(c2)
  })

  it('prunes orphaned card reference in getCardsForColumn (RACE-01 defense)', () => {
    const { cardId } = manager.createCard('Card 1', 'D1', 'A', 'todo')

    // Simulate orphaned reference: delete map entry but keep ID in column array
    manager.cardsMap.delete(cardId!)

    const cards = manager.getCardsForColumn('todo')
    expect(cards).toHaveLength(0)

    // Array should be pruned automatically
    expect(manager.colTodo.length).toBe(0)
  })

  it('ignores moveCard for non-existent card', () => {
    expect(() => {
      manager.moveCard('fake_id', 'todo', 'done', 0)
    }).not.toThrow()
    expect(manager.colDone.length).toBe(0)
  })

  describe('Concurrent Kanban Sync Merges', () => {
    it('merges concurrent card movements from two clients with zero data loss', () => {
      const managerA = new CRDTManager()
      const managerB = new CRDTManager()

      // Initial card created on A
      const { cardId } = managerA.createCard('Conflict Card', 'Desc', 'Tester', 'todo')

      // Sync initial state to B
      Y.applyUpdate(managerB.doc, Y.encodeStateAsUpdate(managerA.doc))

      // Disconnected: Client A moves card to in-progress
      managerA.moveCard(cardId!, 'todo', 'in-progress', 0)

      // Disconnected: Client B moves card to done
      managerB.moveCard(cardId!, 'todo', 'done', 0)

      // Reconnect and sync cross-wise
      Y.applyUpdate(managerB.doc, Y.encodeStateAsUpdate(managerA.doc))
      Y.applyUpdate(managerA.doc, Y.encodeStateAsUpdate(managerB.doc))

      const cardsA_inProgress = managerA.getCardsForColumn('in-progress')
      const cardsA_done = managerA.getCardsForColumn('done')
      const cardsB_inProgress = managerB.getCardsForColumn('in-progress')
      const cardsB_done = managerB.getCardsForColumn('done')

      // Card exists and both states converged identically
      const existsInA = cardsA_inProgress.some((c) => c.id === cardId) || cardsA_done.some((c) => c.id === cardId)
      const existsInB = cardsB_inProgress.some((c) => c.id === cardId) || cardsB_done.some((c) => c.id === cardId)

      expect(existsInA).toBe(true)
      expect(existsInB).toBe(true)

      expect(cardsA_inProgress.length).toBe(cardsB_inProgress.length)
      expect(cardsA_done.length).toBe(cardsB_done.length)
    })

    it('handles concurrent card deletion on A and card edit on B deterministically', () => {
      const managerA = new CRDTManager()
      const managerB = new CRDTManager()

      const { cardId } = managerA.createCard('Shared Task', 'Initial Desc', 'Alice', 'todo')
      Y.applyUpdate(managerB.doc, Y.encodeStateAsUpdate(managerA.doc))

      // A deletes card
      managerA.deleteCard(cardId!, 'todo')

      // B edits description
      managerB.updateCard(cardId!, 'Shared Task', 'Updated by B', 'Alice')

      // Cross sync
      Y.applyUpdate(managerB.doc, Y.encodeStateAsUpdate(managerA.doc))
      Y.applyUpdate(managerA.doc, Y.encodeStateAsUpdate(managerB.doc))

      // Both converge
      const cardsA = managerA.getCardsForColumn('todo')
      const cardsB = managerB.getCardsForColumn('todo')
      expect(cardsA.length).toBe(cardsB.length)
    })
  })

  describe('Full Column Lifecycle & Boundary Operations', () => {
    it('moves card through entire lifecycle across all columns', () => {
      const { cardId } = manager.createCard('Lifecycle Task', 'Desc', 'Tester', 'todo')

      // todo -> in-progress
      manager.moveCard(cardId!, 'todo', 'in-progress', 0)
      expect(manager.getCardsForColumn('todo')).toHaveLength(0)
      expect(manager.getCardsForColumn('in-progress')).toHaveLength(1)

      // in-progress -> done
      manager.moveCard(cardId!, 'in-progress', 'done', 0)
      expect(manager.getCardsForColumn('in-progress')).toHaveLength(0)
      expect(manager.getCardsForColumn('done')).toHaveLength(1)

      // done -> todo (reopen)
      manager.moveCard(cardId!, 'done', 'todo', 0)
      expect(manager.getCardsForColumn('done')).toHaveLength(0)
      expect(manager.getCardsForColumn('todo')).toHaveLength(1)
    })

    it('handles invalid or non-string inputs safely in validateCardInputs', () => {
      expect(manager.validateCardInputs(null as any, 'Desc', 'Alice')).toBe('Title is required.')
      expect(manager.validateCardInputs('Title', null as any, 'Alice')).toBeNull()
      expect(manager.validateCardInputs('Title', 'Desc', null as any)).toBeNull()
    })
  })
})
