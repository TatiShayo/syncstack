import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { CRDTManager } from '../src/crdt/crdtManager'
import {
  ArrowConnectorElement,
  EllipseElement,
  RectangleElement,
  StickyNoteElement,
  TextElement
} from '../src/types'

describe('CRDT Canvas Elements Operations', () => {
  let manager: CRDTManager

  beforeEach(() => {
    manager = new CRDTManager()
  })

  it('creates and retrieves a rectangle element', () => {
    const rect: RectangleElement = {
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 150,
      width: 200,
      height: 120,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      cornerRadius: 6,
      createdAt: 1000,
      updatedAt: 1000
    }

    manager.createElement(rect)
    expect(manager.elementsMap.has('rect-1')).toBe(true)

    const retrieved = manager.getElement('rect-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.type).toBe('rectangle')
    expect(retrieved?.x).toBe(100)
    expect(retrieved?.y).toBe(150)
    expect(retrieved?.width).toBe(200)
    expect(retrieved?.height).toBe(120)
  })

  it('creates and retrieves all canvas element types', () => {
    const ellipse: EllipseElement = {
      id: 'ell-1',
      type: 'ellipse',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: '#10b981',
      stroke: '#047857',
      strokeWidth: 2,
      createdAt: 1001,
      updatedAt: 1001
    }
    const text: TextElement = {
      id: 'txt-1',
      type: 'text',
      x: 20,
      y: 30,
      width: 100,
      height: 25,
      text: 'Title Text',
      fontSize: 18,
      fontFamily: 'sans-serif',
      fill: '#ffffff',
      align: 'left',
      createdAt: 1002,
      updatedAt: 1002
    }
    const sticky: StickyNoteElement = {
      id: 'stk-1',
      type: 'sticky',
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      text: 'Sticky Note Text',
      color: '#fef08a',
      fontSize: 14,
      author: 'Tester',
      createdAt: 1003,
      updatedAt: 1003
    }
    const arrow: ArrowConnectorElement = {
      id: 'arr-1',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 100, y: 100 },
      style: 'straight',
      stroke: '#94a3b8',
      strokeWidth: 2,
      arrowHeadStart: 'none',
      arrowHeadEnd: 'arrow',
      createdAt: 1004,
      updatedAt: 1004
    }

    manager.createElement(ellipse)
    manager.createElement(text)
    manager.createElement(sticky)
    manager.createElement(arrow)

    const all = manager.getElements()
    expect(all).toHaveLength(4)
    expect(manager.getElement('ell-1')?.type).toBe('ellipse')
    expect(manager.getElement('txt-1')?.type).toBe('text')
    expect(manager.getElement('stk-1')?.type).toBe('sticky')
    expect(manager.getElement('arr-1')?.type).toBe('arrow')
  })

  it('updates an existing element properties', () => {
    const rect: RectangleElement = {
      id: 'rect-1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 1000,
      updatedAt: 1000
    }
    manager.createElement(rect)

    manager.updateElement('rect-1', {
      x: 50,
      fill: '#ef4444',
      rotation: 45
    })

    const updated = manager.getElement('rect-1') as RectangleElement
    expect(updated?.x).toBe(50)
    expect(updated?.y).toBe(20) // unchanged
    expect(updated?.fill).toBe('#ef4444')
    expect(updated?.rotation).toBe(45)
  })

  it('ignores update for non-existent element', () => {
    expect(() => {
      manager.updateElement('non-existent', { x: 100 })
    }).not.toThrow()
    expect(manager.getElement('non-existent')).toBeNull()
  })

  it('deletes a single element and multiple elements', () => {
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

    manager.deleteElement('e1')
    expect(manager.getElement('e1')).toBeNull()
    expect(manager.getElements()).toHaveLength(2)

    manager.deleteElements(['e2', 'e3'])
    expect(manager.getElements()).toHaveLength(0)
  })

  it('moves regular elements by dx and dy', () => {
    manager.createElement({
      id: 'e1',
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
    })

    manager.moveElements(['e1'], 25, -15)
    const elem = manager.getElement('e1')
    expect(elem?.x).toBe(125)
    expect(elem?.y).toBe(85)
  })

  it('moves arrow/connector endpoints by dx and dy', () => {
    const arrow: ArrowConnectorElement = {
      id: 'arr-1',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      startPoint: { x: 10, y: 20 },
      endPoint: { x: 110, y: 120 },
      style: 'straight',
      stroke: '#94a3b8',
      strokeWidth: 2,
      createdAt: 1,
      updatedAt: 1
    }
    manager.createElement(arrow)

    manager.moveElements(['arr-1'], 30, 40)
    const moved = manager.getElement('arr-1') as ArrowConnectorElement
    expect(moved.startPoint).toEqual({ x: 40, y: 60 })
    expect(moved.endPoint).toEqual({ x: 140, y: 160 })
  })

  it('reorders z-index layering (bringToFront, sendToBack, bringForward, sendBackward)', () => {
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
      zIndex: 1,
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
      zIndex: 2,
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
      zIndex: 3,
      createdAt: 3,
      updatedAt: 3
    })

    // Bring e1 to front (max z is 3 -> e1 becomes 4)
    manager.bringToFront('e1')
    expect(manager.getElement('e1')?.zIndex).toBe(4)

    // Send e3 to back (min z is 2 -> e3 becomes 1)
    manager.sendToBack('e3')
    expect(manager.getElement('e3')?.zIndex).toBe(1)

    // Send backward
    manager.sendBackward('e1')
    expect(manager.getElement('e1')?.zIndex).toBe(3)

    // Bring forward
    manager.bringForward('e3')
    expect(manager.getElement('e3')?.zIndex).toBe(2)
  })

  describe('Concurrent CRDT Merging', () => {
    it('merges concurrent element creations from two documents deterministically', () => {
      const managerA = new CRDTManager()
      const managerB = new CRDTManager()

      // Client A creates shape A
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

      // Client B creates shape B
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

      // Sync A -> B and B -> A
      const updateA = Y.encodeStateAsUpdate(managerA.doc)
      const updateB = Y.encodeStateAsUpdate(managerB.doc)

      Y.applyUpdate(managerB.doc, updateA)
      Y.applyUpdate(managerA.doc, updateB)

      // Both managers have both elements
      expect(managerA.getElements()).toHaveLength(2)
      expect(managerB.getElements()).toHaveLength(2)
      expect(managerA.getElement('shape-b')?.type).toBe('ellipse')
      expect(managerB.getElement('shape-a')?.type).toBe('rectangle')
    })

    it('resolves concurrent mutations deterministically using Last-Write-Wins', () => {
      const managerA = new CRDTManager()
      const managerB = new CRDTManager()

      // Initial shared element
      managerA.createElement({
        id: 'shared-elem',
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 100,
        updatedAt: 100
      })

      // Sync initial state to B
      Y.applyUpdate(managerB.doc, Y.encodeStateAsUpdate(managerA.doc))

      // Client A changes color
      managerA.updateElement('shared-elem', { fill: '#ec4899' })

      // Client B moves position
      managerB.updateElement('shared-elem', { x: 300, y: 400 })

      // Cross sync
      Y.applyUpdate(managerB.doc, Y.encodeStateAsUpdate(managerA.doc))
      Y.applyUpdate(managerA.doc, Y.encodeStateAsUpdate(managerB.doc))

      const finalA = managerA.getElement('shared-elem')
      const finalB = managerB.getElement('shared-elem')

      // Both documents deterministically converge to the exact same state
      expect(finalA).toEqual(finalB)
      expect(finalA).not.toBeNull()
    })

    it('converges across 3 concurrent peer clients (A, B, C) editing simultaneously', () => {
      const clientA = new CRDTManager()
      const clientB = new CRDTManager()
      const clientC = new CRDTManager()

      // Peer A adds a sticky note
      clientA.createElement({
        id: 'peer-sticky',
        type: 'sticky',
        x: 10,
        y: 20,
        width: 150,
        height: 150,
        text: 'From A',
        color: '#fef08a',
        fontSize: 14,
        createdAt: 10,
        updatedAt: 10
      })

      // Peer B adds an arrow connector
      clientB.createElement({
        id: 'peer-arrow',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startPoint: { x: 50, y: 50 },
        endPoint: { x: 250, y: 250 },
        style: 'curved',
        stroke: '#3b82f6',
        strokeWidth: 3,
        createdAt: 20,
        updatedAt: 20
      })

      // Peer C adds a text element
      clientC.createElement({
        id: 'peer-text',
        type: 'text',
        x: 100,
        y: 100,
        width: 120,
        height: 30,
        text: 'Header from C',
        fontSize: 20,
        fontFamily: 'sans-serif',
        fill: '#ffffff',
        align: 'left',
        createdAt: 30,
        updatedAt: 30
      })

      // Encode updates from all peers
      const uA = Y.encodeStateAsUpdate(clientA.doc)
      const uB = Y.encodeStateAsUpdate(clientB.doc)
      const uC = Y.encodeStateAsUpdate(clientC.doc)

      // Apply all updates to all clients
      Y.applyUpdate(clientA.doc, uB)
      Y.applyUpdate(clientA.doc, uC)

      Y.applyUpdate(clientB.doc, uA)
      Y.applyUpdate(clientB.doc, uC)

      Y.applyUpdate(clientC.doc, uA)
      Y.applyUpdate(clientC.doc, uB)

      // All 3 peers must have 3 elements with identical IDs and properties
      const elemsA = clientA.getElements()
      const elemsB = clientB.getElements()
      const elemsC = clientC.getElements()

      expect(elemsA).toHaveLength(3)
      expect(elemsB).toHaveLength(3)
      expect(elemsC).toHaveLength(3)

      expect(elemsA.map((e) => e.id).sort()).toEqual(['peer-arrow', 'peer-sticky', 'peer-text'])
      expect(elemsB.map((e) => e.id).sort()).toEqual(['peer-arrow', 'peer-sticky', 'peer-text'])
      expect(elemsC.map((e) => e.id).sort()).toEqual(['peer-arrow', 'peer-sticky', 'peer-text'])
    })
  })

  describe('Subscription and Listener Resilience', () => {
    it('notifies subscribers on mutation and cleans up on unsubscribe', () => {
      let callCount = 0
      const unsubscribe = manager.subscribe(() => {
        callCount++
      })

      manager.createElement({
        id: 'e-sub',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        createdAt: 1,
        updatedAt: 1
      })
      expect(callCount).toBeGreaterThan(0)

      const prevCount = callCount
      unsubscribe()

      manager.updateElement('e-sub', { x: 50 })
      expect(callCount).toBe(prevCount)
    })
  })
})
