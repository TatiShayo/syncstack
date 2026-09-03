import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as Y from 'yjs'
import ws from 'ws'
import { WebsocketProvider } from 'y-websocket'
import { createSyncServer } from '../server.js'
import { CRDTManager } from '../src/crdt/crdtManager'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TEST_PORT = 1246

describe('Offline Disconnect Recovery & State Reconciliation', () => {
  let syncServerInstance: any

  beforeAll(async () => {
    syncServerInstance = createSyncServer({
      authorizedAccess: {
        'recovery-board': ['recovery-token']
      },
      roomCleanupTimeoutMs: 30000,
      enableLogging: false
    })

    await new Promise<void>((resolve) => {
      syncServerInstance.server.listen(TEST_PORT, () => resolve())
    })
  })

  afterAll(async () => {
    if (syncServerInstance) {
      await syncServerInstance.close()
    }
  })

  it('increments pending changes counter while offline and resets upon sync', async () => {
    const manager = new CRDTManager()
    manager.setOnlineStatus(false)

    expect(manager.getPendingChanges()).toBe(0)

    // Make offline mutations
    manager.createElement({
      id: 'offline-r1',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 1,
      updatedAt: 1
    })
    expect(manager.getPendingChanges()).toBe(1)

    manager.createCard('Offline Task', 'Desc', 'Alice', 'todo')
    expect(manager.getPendingChanges()).toBe(2)

    // Transition back to online
    manager.setOnlineStatus(true)
    expect(manager.getPendingChanges()).toBe(0)
  })

  it('merges divergent offline edits between two clients without data loss upon reconnect', async () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=recovery-board&token=recovery-token`
    const providerA = new WebsocketProvider(wsUrl, 'recovery-board', docA, {
      WebSocketPolyfill: ws as any
    })
    const providerB = new WebsocketProvider(wsUrl, 'recovery-board', docB, {
      WebSocketPolyfill: ws as any
    })

    // Wait for initial connection
    await delay(600)
    expect(providerA.wsconnected).toBe(true)
    expect(providerB.wsconnected).toBe(true)

    // Create a shared card while online
    const cardId = 'conflict-task-1'
    docA.transact(() => {
      const cardsMap = docA.getMap('cards')
      const cardMap = new Y.Map()
      cardMap.set('id', cardId)
      cardMap.set('title', 'Concurrent Task')
      cardsMap.set(cardId, cardMap)
      docA.getArray('col-todo').push([cardId])
    })

    await delay(600)
    expect(docB.getArray('col-todo').toArray()).toContain(cardId)

    // Disconnect both clients (Simulate Offline)
    providerA.disconnect()
    providerB.disconnect()
    await delay(300)
    expect(providerA.wsconnected).toBe(false)
    expect(providerB.wsconnected).toBe(false)

    // Client A moves card to 'in-progress' and adds a shape
    docA.transact(() => {
      const todo = docA.getArray('col-todo')
      const inProgress = docA.getArray('col-in-progress')
      const idx = todo.toArray().indexOf(cardId)
      if (idx !== -1) todo.delete(idx, 1)
      inProgress.push([cardId])

      const elemMap = docA.getMap('elements')
      const rect = new Y.Map()
      rect.set('type', 'rectangle')
      rect.set('fill', '#3b82f6')
      elemMap.set('shape-a', rect)
    })

    // Client B moves card to 'done' and adds a sticky note
    docB.transact(() => {
      const todo = docB.getArray('col-todo')
      const done = docB.getArray('col-done')
      const idx = todo.toArray().indexOf(cardId)
      if (idx !== -1) todo.delete(idx, 1)
      done.push([cardId])

      const elemMap = docB.getMap('elements')
      const sticky = new Y.Map()
      sticky.set('type', 'sticky')
      sticky.set('text', 'Offline Note B')
      elemMap.set('sticky-b', sticky)
    })

    // Reconnect both clients (Online)
    providerA.connect()
    providerB.connect()
    await delay(1200)

    // Both documents must converge with zero data loss
    const elementsA = Array.from(docA.getMap('elements').keys())
    const elementsB = Array.from(docB.getMap('elements').keys())

    expect(elementsA).toContain('shape-a')
    expect(elementsA).toContain('sticky-b')
    expect(elementsB).toContain('shape-a')
    expect(elementsB).toContain('sticky-b')

    const colsA = {
      todo: docA.getArray('col-todo').toArray(),
      inProgress: docA.getArray('col-in-progress').toArray(),
      done: docA.getArray('col-done').toArray()
    }
    const colsB = {
      todo: docB.getArray('col-todo').toArray(),
      inProgress: docB.getArray('col-in-progress').toArray(),
      done: docB.getArray('col-done').toArray()
    }

    expect(colsA.todo).toEqual(colsB.todo)
    expect(colsA.inProgress).toEqual(colsB.inProgress)
    expect(colsA.done).toEqual(colsB.done)

    providerA.destroy()
    providerB.destroy()
  })

  it('reconciles multiple consecutive offline updates without dropping transactions', async () => {
    const docA = new Y.Doc()
    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=recovery-board&token=recovery-token`
    const providerA = new WebsocketProvider(wsUrl, 'recovery-board', docA, {
      WebSocketPolyfill: ws as any
    })

    await delay(500)
    expect(providerA.wsconnected).toBe(true)

    // Disconnect
    providerA.disconnect()
    await delay(200)

    // Make 5 distinct transactions while offline
    for (let i = 1; i <= 5; i++) {
      docA.transact(() => {
        docA.getArray('col-todo').push([`offline-task-${i}`])
      })
    }

    // Reconnect
    providerA.connect()
    await delay(600)
    expect(providerA.wsconnected).toBe(true)

    // Verify all 5 tasks are intact
    const tasks = docA.getArray('col-todo').toArray()
    for (let i = 1; i <= 5; i++) {
      expect(tasks).toContain(`offline-task-${i}`)
    }

    providerA.destroy()
  })
})
