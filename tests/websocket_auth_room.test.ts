import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as Y from 'yjs'
import ws from 'ws'
import { WebsocketProvider } from 'y-websocket'
import { createSyncServer } from '../server.js'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TEST_PORT = 1245

describe('WebSocket Authentication & Room Memory Management', () => {
  let syncServerInstance: any

  beforeAll(async () => {
    syncServerInstance = createSyncServer({
      authorizedAccess: {
        board1: ['token1', 'admin-token'],
        board2: ['token2', 'admin-token'],
        board3: ['token3', 'admin-token']
      },
      roomCleanupTimeoutMs: 500, // Short timeout for testing
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

  it('rejects connection with 401 when boardId or token is missing', async () => {
    const doc = new Y.Doc()
    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1` // missing token
    const provider = new WebsocketProvider(wsUrl, 'board1', doc, {
      WebSocketPolyfill: ws as any
    })

    await delay(600)
    expect(provider.wsconnected).toBe(false)
    provider.destroy()
  })

  it('rejects connection with 403 when board is unregistered', async () => {
    const doc = new Y.Doc()
    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=unregistered_board&token=token1`
    const provider = new WebsocketProvider(wsUrl, 'unregistered_board', doc, {
      WebSocketPolyfill: ws as any
    })

    await delay(600)
    expect(provider.wsconnected).toBe(false)
    provider.destroy()
  })

  it('rejects connection with 403 when token is invalid for board', async () => {
    const doc = new Y.Doc()
    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1&token=wrong_token`
    const provider = new WebsocketProvider(wsUrl, 'board1', doc, {
      WebSocketPolyfill: ws as any
    })

    await delay(600)
    expect(provider.wsconnected).toBe(false)
    provider.destroy()
  })

  it('connects successfully when valid boardId and token are provided', async () => {
    const doc = new Y.Doc()
    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`
    const provider = new WebsocketProvider(wsUrl, 'board1', doc, {
      WebSocketPolyfill: ws as any
    })

    for (let i = 0; i < 20; i++) {
      if (provider.wsconnected) break
      await delay(100)
    }

    expect(provider.wsconnected).toBe(true)
    provider.destroy()
  })

  it('verifies real-time cross-client syncing on the same board', async () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    const wsUrlA = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`
    const wsUrlB = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`

    const providerA = new WebsocketProvider(wsUrlA, 'board1', docA, { WebSocketPolyfill: ws as any })
    const providerB = new WebsocketProvider(wsUrlB, 'board1', docB, { WebSocketPolyfill: ws as any })

    await delay(600)
    expect(providerA.wsconnected).toBe(true)
    expect(providerB.wsconnected).toBe(true)

    // Client A creates an element
    const elemMapA = docA.getMap('elements')
    const itemMap = new Y.Map()
    itemMap.set('type', 'rectangle')
    itemMap.set('fill', '#3b82f6')
    elemMapA.set('rect-sync-1', itemMap)

    await delay(600)

    // Client B receives it
    const elemMapB = docB.getMap('elements')
    expect(elemMapB.has('rect-sync-1')).toBe(true)
    const syncedItem = elemMapB.get('rect-sync-1') as Y.Map<any>
    expect(syncedItem.get('type')).toBe('rectangle')
    expect(syncedItem.get('fill')).toBe('#3b82f6')

    providerA.destroy()
    providerB.destroy()
  })

  it('maintains strict board isolation (no data leakage between board1 and board2)', async () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()

    const wsUrl1 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`
    const wsUrl2 = `ws://localhost:${TEST_PORT}?boardId=board2&token=token2`

    const provider1 = new WebsocketProvider(wsUrl1, 'board1', doc1, { WebSocketPolyfill: ws as any })
    const provider2 = new WebsocketProvider(wsUrl2, 'board2', doc2, { WebSocketPolyfill: ws as any })

    await delay(600)

    // Add card to board 1
    doc1.getArray('col-todo').push(['isolated-card-board-1'])

    await delay(600)

    // Check board 2
    expect(doc2.getArray('col-todo').length).toBe(0)

    provider1.destroy()
    provider2.destroy()
  })

  it('allows access to multiple boards using admin-token', async () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()

    const wsUrl1 = `ws://localhost:${TEST_PORT}?boardId=board1&token=admin-token`
    const wsUrl2 = `ws://localhost:${TEST_PORT}?boardId=board2&token=admin-token`

    const provider1 = new WebsocketProvider(wsUrl1, 'board1', doc1, { WebSocketPolyfill: ws as any })
    const provider2 = new WebsocketProvider(wsUrl2, 'board2', doc2, { WebSocketPolyfill: ws as any })

    await delay(600)
    expect(provider1.wsconnected).toBe(true)
    expect(provider2.wsconnected).toBe(true)

    provider1.destroy()
    provider2.destroy()
  })

  it('cancels room cleanup if a client reconnects before timeout expires', async () => {
    const doc1 = new Y.Doc()
    const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board2&token=token2`
    const provider1 = new WebsocketProvider(wsUrl, 'board2', doc1, { WebSocketPolyfill: ws as any })

    await delay(500)
    expect(provider1.wsconnected).toBe(true)

    // Disconnect client 1 -> starts cleanup timer (500ms)
    provider1.destroy()
    await delay(200)

    // Connect client 2 before 500ms elapses
    const doc2 = new Y.Doc()
    const provider2 = new WebsocketProvider(wsUrl, 'board2', doc2, { WebSocketPolyfill: ws as any })
    await delay(400)

    // Verify room is STILL preserved because timer was cancelled by client 2
    expect(syncServerInstance.docs.has('board2')).toBe(true)

    provider2.destroy()
  })
})
