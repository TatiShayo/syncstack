import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { CRDTManager } from '../src/crdt/crdtManager'
import { RectangleElement } from '../src/types'

describe('Undo / Redo Manager Integrity', () => {
  let manager: CRDTManager

  beforeEach(() => {
    manager = new CRDTManager()
  })

  it('canUndo and canRedo initial state are false', () => {
    expect(manager.canUndo()).toBe(false)
    expect(manager.canRedo()).toBe(false)
  })

  it('undoes and redoes canvas element creation', () => {
    const rect: RectangleElement = {
      id: 'r1',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 100,
      updatedAt: 100
    }

    manager.createElement(rect)
    expect(manager.getElements()).toHaveLength(1)
    expect(manager.canUndo()).toBe(true)

    // Undo creation
    const undone = manager.undo()
    expect(undone).toBe(true)
    expect(manager.getElements()).toHaveLength(0)
    expect(manager.canRedo()).toBe(true)

    // Redo creation
    const redone = manager.redo()
    expect(redone).toBe(true)
    expect(manager.getElements()).toHaveLength(1)
    expect(manager.getElement('r1')).not.toBeNull()
  })

  it('undoes and redoes element movement', () => {
    const rect: RectangleElement = {
      id: 'r1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 1,
      createdAt: 1,
      updatedAt: 1
    }
    manager.createElement(rect)

    // Move element
    manager.moveElements(['r1'], 50, 50)
    expect(manager.getElement('r1')?.x).toBe(150)
    expect(manager.getElement('r1')?.y).toBe(150)

    // Undo move
    manager.undo()
    expect(manager.getElement('r1')?.x).toBe(100)
    expect(manager.getElement('r1')?.y).toBe(100)

    // Redo move
    manager.redo()
    expect(manager.getElement('r1')?.x).toBe(150)
    expect(manager.getElement('r1')?.y).toBe(150)
  })

  it('undoes and redoes element deletion (restoring deleted element)', () => {
    const rect: RectangleElement = {
      id: 'r1',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 100,
      updatedAt: 100
    }
    manager.createElement(rect)
    manager.deleteElement('r1')
    expect(manager.getElement('r1')).toBeNull()

    // Undo deletion -> element restored
    manager.undo()
    expect(manager.getElement('r1')).not.toBeNull()
    expect((manager.getElement('r1') as RectangleElement)?.fill).toBe('#3b82f6')

    // Redo deletion -> element deleted again
    manager.redo()
    expect(manager.getElement('r1')).toBeNull()
  })

  it('undoes and redoes Kanban card operations', () => {
    const { cardId } = manager.createCard('Card 1', 'Desc', 'Alice', 'todo')
    expect(manager.getCardsForColumn('todo')).toHaveLength(1)

    // Undo card creation
    manager.undo()
    expect(manager.getCardsForColumn('todo')).toHaveLength(0)

    // Redo card creation
    manager.redo()
    expect(manager.getCardsForColumn('todo')).toHaveLength(1)
    expect(manager.getCardsForColumn('todo')[0].id).toBe(cardId)

    // Move card to done
    manager.moveCard(cardId!, 'todo', 'done', 0)
    expect(manager.getCardsForColumn('todo')).toHaveLength(0)
    expect(manager.getCardsForColumn('done')).toHaveLength(1)

    // Undo card move
    manager.undo()
    expect(manager.getCardsForColumn('todo')).toHaveLength(1)
    expect(manager.getCardsForColumn('done')).toHaveLength(0)
  })

  it('handles multiple consecutive undo and redo steps', () => {
    manager.createElement({
      id: 'e1',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 1,
      createdAt: 1,
      updatedAt: 1
    })

    manager.createElement({
      id: 'e2',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      fill: '#10b981',
      stroke: '#047857',
      strokeWidth: 1,
      createdAt: 2,
      updatedAt: 2
    })

    manager.createElement({
      id: 'e3',
      type: 'rectangle',
      x: 20,
      y: 20,
      width: 50,
      height: 50,
      fill: '#f59e0b',
      stroke: '#d97706',
      strokeWidth: 1,
      createdAt: 3,
      updatedAt: 3
    })

    expect(manager.getElements()).toHaveLength(3)

    // Undo e3
    manager.undo()
    expect(manager.getElements()).toHaveLength(2)

    // Undo e2
    manager.undo()
    expect(manager.getElements()).toHaveLength(1)

    // Redo e2
    manager.redo()
    expect(manager.getElements()).toHaveLength(2)

    // Redo e3
    manager.redo()
    expect(manager.getElements()).toHaveLength(3)
  })

  it('isolates remote transactions from local undo/redo stack', () => {
    const managerA = new CRDTManager()
    const managerB = new CRDTManager()

    // Client A creates shape A locally
    managerA.createElement({
      id: 'shape-a',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 100,
      updatedAt: 100
    })

    // Client B creates shape B locally
    managerB.createElement({
      id: 'shape-b',
      type: 'ellipse',
      x: 200,
      y: 200,
      width: 80,
      height: 80,
      fill: '#10b981',
      stroke: '#047857',
      strokeWidth: 2,
      createdAt: 200,
      updatedAt: 200
    })

    // Apply Client B's update to Client A (remote origin)
    const updateB = Y.encodeStateAsUpdate(managerB.doc)
    Y.applyUpdate(managerA.doc, updateB)

    // Client A now has both shapes
    expect(managerA.getElements()).toHaveLength(2)

    // Client A clicks Undo -> It should undo Client A's local shape A, NOT remote shape B!
    managerA.undo()

    const elementsA = managerA.getElements()
    expect(elementsA).toHaveLength(1)
    expect(elementsA[0].id).toBe('shape-b') // Remote shape B remains untouched!
    expect(managerA.getElement('shape-a')).toBeNull() // Local shape A was undone
  })

  it('clearUndoStack clears undo/redo history', () => {
    manager.createElement({
      id: 'r1',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 1,
      createdAt: 1,
      updatedAt: 1
    })

    expect(manager.canUndo()).toBe(true)
    manager.clearUndoStack()
    expect(manager.canUndo()).toBe(false)
    expect(manager.canRedo()).toBe(false)
  })

  it('returns false when attempting to undo or redo with empty stack', () => {
    expect(manager.undo()).toBe(false)
    expect(manager.redo()).toBe(false)
  })

  it('undoes and redoes text edits and styling modifications', () => {
    manager.createElement({
      id: 'txt-undo',
      type: 'text',
      x: 10,
      y: 10,
      width: 100,
      height: 30,
      text: 'Version 1',
      fontSize: 16,
      fontFamily: 'sans-serif',
      fill: '#ffffff',
      align: 'left',
      createdAt: 1,
      updatedAt: 1
    })

    manager.updateElement('txt-undo', { text: 'Version 2', fontSize: 24 })
    expect((manager.getElement('txt-undo') as any).text).toBe('Version 2')
    expect((manager.getElement('txt-undo') as any).fontSize).toBe(24)

    manager.undo()
    expect((manager.getElement('txt-undo') as any).text).toBe('Version 1')
    expect((manager.getElement('txt-undo') as any).fontSize).toBe(16)

    manager.redo()
    expect((manager.getElement('txt-undo') as any).text).toBe('Version 2')
  })
})
