import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import ws from 'ws'
import { WebsocketProvider } from 'y-websocket'
import { createSyncServer, parseSyncAuth } from '../server.js'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('createSyncServer hardening', () => {
  it('refuses to start without an explicit authorizedAccess map', () => {
    expect(() => createSyncServer()).toThrow(/Refusing to start/)
    expect(() => (createSyncServer as any)({})).toThrow(/Refusing to start/)
  });

  it('refuses an empty board map (no boards must not mean no auth)', () => {
    expect(() => createSyncServer({ authorizedAccess: {} })).toThrow(/empty/)
  })

  it('parses SYNC_AUTH pair and JSON forms, rejecting junk', () => {
    expect(parseSyncAuth('board1:tokenA,board2:tokenB')).toEqual({
      board1: ['tokenA'],
      board2: ['tokenB'],
    })
    expect(parseSyncAuth('{"board1":["tokenA","tokenB"]}')).toEqual({
      board1: ['tokenA', 'tokenB'],
    })
    expect(parseSyncAuth('')).toBeNull()
    expect(parseSyncAuth('garbage')).toBeNull()
    expect(parseSyncAuth('{"broken":')).toBeNull()
  })
})

describe('CSWSH origin allowlist', () => {
  const PORT = 1246

  function originClient(origin: string) {
    return class extends ws {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { origin })
      }
    } as any
  }

  it('rejects a browser Origin that is not on the allowlist', async () => {
    const srv = createSyncServer({
      authorizedAccess: { board1: ['token1'] },
      enableLogging: false,
      allowedOrigins: ['https://allowed.example'],
    })
    await new Promise<void>((resolve) => srv.server.listen(PORT, () => resolve()))

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(
      `ws://localhost:${PORT}?boardId=board1&token=token1`,
      'board1',
      doc,
      { WebSocketPolyfill: originClient('https://evil.example') }
    )
    await delay(600)
    expect(provider.wsconnected).toBe(false)
    provider.destroy()
    await srv.close()
  })

  it('allows a browser Origin that is on the allowlist', async () => {
    const srv = createSyncServer({
      authorizedAccess: { board1: ['token1'] },
      enableLogging: false,
      allowedOrigins: ['https://allowed.example'],
    })
    await new Promise<void>((resolve) => srv.server.listen(PORT, () => resolve()))

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(
      `ws://localhost:${PORT}?boardId=board1&token=token1`,
      'board1',
      doc,
      { WebSocketPolyfill: originClient('https://allowed.example') }
    )
    for (let i = 0; i < 20; i++) {
      if (provider.wsconnected) break
      await delay(100)
    }
    expect(provider.wsconnected).toBe(true)
    provider.destroy()
    await srv.close()
  })
})
