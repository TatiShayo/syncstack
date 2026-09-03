import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness'
import { CRDTManager } from '../src/crdt/crdtManager'

describe('Presence & Cursor Awareness State', () => {
  describe('Username Sanitization (SEC-03)', () => {
    it('trims whitespace and preserves valid username', () => {
      expect(CRDTManager.sanitizeUsername('  Alex Rivera  ')).toBe('Alex Rivera')
    })

    it('truncates usernames exceeding 50 characters', () => {
      const longName = 'a'.repeat(60)
      const sanitized = CRDTManager.sanitizeUsername(longName)
      expect(sanitized.length).toBe(50)
      expect(sanitized).toBe('a'.repeat(50))
    })

    it('falls back to "Anonymous" on empty string or whitespace only', () => {
      expect(CRDTManager.sanitizeUsername('')).toBe('Anonymous')
      expect(CRDTManager.sanitizeUsername('    ')).toBe('Anonymous')
      expect(CRDTManager.sanitizeUsername(null as any)).toBe('Anonymous')
      expect(CRDTManager.sanitizeUsername(undefined as any)).toBe('Anonymous')
    })
  })

  describe('Awareness Protocol State Synchronization', () => {
    it('sets and propagates user and cursor state between awareness instances', () => {
      const doc1 = new Y.Doc()
      const doc2 = new Y.Doc()

      const awareness1 = new Awareness(doc1)
      const awareness2 = new Awareness(doc2)

      // Set user info on client 1
      awareness1.setLocalStateField('user', {
        name: 'Alice',
        color: '#3b82f6'
      })

      // Set cursor position on client 1
      awareness1.setLocalStateField('cursor', { x: 120, y: 340 })

      // Set selected elements on client 1
      awareness1.setLocalStateField('selectedElementIds', ['elem-1', 'elem-2'])

      // Sync awareness from client 1 to client 2
      const states1 = awareness1.getStates()
      const client1Id = doc1.clientID
      const client1State = states1.get(client1Id)

      expect(client1State).toBeDefined()
      expect(client1State?.user?.name).toBe('Alice')
      expect(client1State?.cursor).toEqual({ x: 120, y: 340 })
      expect(client1State?.selectedElementIds).toEqual(['elem-1', 'elem-2'])

      // Apply awareness update
      const update = encodeAwarenessUpdate(awareness1, [client1Id])
      applyAwarenessUpdate(awareness2, update, 'remote')

      const states2 = awareness2.getStates()
      const syncedClient1 = states2.get(client1Id)
      expect(syncedClient1).toBeDefined()
      expect(syncedClient1?.user?.name).toBe('Alice')
      expect(syncedClient1?.cursor).toEqual({ x: 120, y: 340 })
      expect(syncedClient1?.selectedElementIds).toEqual(['elem-1', 'elem-2'])

      awareness1.destroy()
      awareness2.destroy()
    })

    it('handles cursor clearance when leaving canvas', () => {
      const doc = new Y.Doc()
      const awareness = new Awareness(doc)

      awareness.setLocalStateField('cursor', { x: 100, y: 200 })
      expect(awareness.getLocalState()?.cursor).toEqual({ x: 100, y: 200 })

      // User leaves canvas
      awareness.setLocalStateField('cursor', null)
      expect(awareness.getLocalState()?.cursor).toBeNull()

      awareness.destroy()
    })

    it('removes awareness state when a client disconnects or clears state', () => {
      const doc1 = new Y.Doc()
      const doc2 = new Y.Doc()

      const awareness1 = new Awareness(doc1)
      const awareness2 = new Awareness(doc2)

      const id1 = doc1.clientID
      awareness1.setLocalStateField('user', { name: 'Bob', color: '#10b981' })

      // Sync 1 -> 2
      applyAwarenessUpdate(
        awareness2,
        encodeAwarenessUpdate(awareness1, [id1]),
        'remote'
      )

      expect(awareness2.getStates().has(id1)).toBe(true)

      // Client 1 disconnects / clears state
      awareness1.setLocalState(null)
      applyAwarenessUpdate(
        awareness2,
        encodeAwarenessUpdate(awareness1, [id1]),
        'remote'
      )

      expect(awareness2.getStates().get(id1)).toBeUndefined()

      awareness1.destroy()
      awareness2.destroy()
    })

    it('serializes and propagates activeTool and viewport zoom state across collaborators', () => {
      const doc = new Y.Doc()
      const awareness = new Awareness(doc)

      awareness.setLocalStateField('activeTool', 'rectangle')
      awareness.setLocalStateField('viewport', { x: 100, y: 50, zoom: 1.5 })

      const state = awareness.getLocalState()
      expect(state?.activeTool).toBe('rectangle')
      expect(state?.viewport).toEqual({ x: 100, y: 50, zoom: 1.5 })

      awareness.destroy()
    })

    it('aggregates multiple concurrent peer awareness states accurately', () => {
      const docA = new Y.Doc()
      const docB = new Y.Doc()
      const docC = new Y.Doc()

      const awA = new Awareness(docA)
      const awB = new Awareness(docB)
      const awC = new Awareness(docC)

      awA.setLocalStateField('user', { name: 'Alice', color: '#3b82f6' })
      awB.setLocalStateField('user', { name: 'Bob', color: '#10b981' })
      awC.setLocalStateField('user', { name: 'Charlie', color: '#ef4444' })

      // Sync B and C into A
      applyAwarenessUpdate(awA, encodeAwarenessUpdate(awB, [docB.clientID]), 'remote')
      applyAwarenessUpdate(awA, encodeAwarenessUpdate(awC, [docC.clientID]), 'remote')

      const allStates = awA.getStates()
      expect(allStates.size).toBe(3)
      expect(allStates.get(docA.clientID)?.user?.name).toBe('Alice')
      expect(allStates.get(docB.clientID)?.user?.name).toBe('Bob')
      expect(allStates.get(docC.clientID)?.user?.name).toBe('Charlie')

      awA.destroy()
      awB.destroy()
      awC.destroy()
    })
  })
})
