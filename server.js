import http from 'http'
import { WebSocketServer } from 'ws'
import url from 'url'
import yUtils from 'y-websocket/bin/utils'

const { setupWSConnection, docs } = yUtils

export function createSyncServer(options = {}) {
  const {
    authorizedAccess = {
      board1: ['token1', 'admin-token'],
      board2: ['token2', 'admin-token'],
      board3: ['token3', 'admin-token']
    },
    roomCleanupTimeoutMs = 30000,
    enableLogging = true
  } = options

  // Safe registry object with null prototype to prevent prototype pollution (SEC-01)
  const AUTHORIZED_ACCESS = Object.create(null)
  for (const [k, v] of Object.entries(authorizedAccess)) {
    AUTHORIZED_ACCESS[k] = Array.isArray(v) ? [...v] : [v]
  }

  // Active room tracking and cleanup timers
  const roomConnections = new Map() // boardId -> Set of ws conns
  const roomCleanupTimers = new Map() // boardId -> Timeout

  const log = (...args) => {
    if (enableLogging) {
      console.log(...args)
    }
  }

  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' })
    response.end('Yjs Sync Server Running\n')
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = url.parse(request.url || '', true)
      const boardId = typeof parsedUrl.query.boardId === 'string' ? parsedUrl.query.boardId.trim() : ''
      let token = typeof parsedUrl.query.token === 'string' ? parsedUrl.query.token.trim() : ''

      // y-websocket appends /roomName to the end of the server URL. If query parameters are present,
      // this results in /roomName being appended to the last query parameter (token). We strip it here.
      if (boardId && token.endsWith('/' + boardId)) {
        token = token.slice(0, -(boardId.length + 1))
      }

      // Token is NEVER logged in plaintext (SEC-02)
      log(`Upgrade requested: boardId=${boardId} token=${token ? '<redacted>' : '<missing>'}`)

      // Enforce per-board access control checks
      if (!boardId || !token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nAccess denied: Missing boardId or token.')
        socket.destroy()
        return
      }

      // Safe lookup avoiding prototype pollution crashes (SEC-01)
      if (!Object.prototype.hasOwnProperty.call(AUTHORIZED_ACCESS, boardId)) {
        log(`Access denied for boardId=${boardId}: Board not registered`)
        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccess denied: Invalid board.')
        socket.destroy()
        return
      }

      const allowedTokens = AUTHORIZED_ACCESS[boardId]
      if (!allowedTokens || !allowedTokens.includes(token)) {
        log(`Access denied for boardId=${boardId}: Invalid token`)
        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccess denied: Invalid token for this board.')
        socket.destroy()
        return
      }

      log(`Access allowed for boardId=${boardId}`)
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } catch (err) {
      log('Error during websocket upgrade:', err)
      socket.write('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nBad Request')
      socket.destroy()
    }
  })

  wss.on('connection', (conn, req) => {
    const parsedUrl = url.parse(req.url || '', true)
    const boardId = typeof parsedUrl.query.boardId === 'string' ? parsedUrl.query.boardId.trim() : ''

    // Cancel pending room cleanup if a client connected
    if (roomCleanupTimers.has(boardId)) {
      clearTimeout(roomCleanupTimers.get(boardId))
      roomCleanupTimers.delete(boardId)
      log(`Cancelled room cleanup for boardId=${boardId} due to new connection`)
    }

    // Track active connection
    if (!roomConnections.has(boardId)) {
      roomConnections.set(boardId, new Set())
    }
    roomConnections.get(boardId).add(conn)

    // Set up Y.Doc binding mapping connection to the board ID document name
    setupWSConnection(conn, req, { docName: boardId })

    conn.on('close', () => {
      const conns = roomConnections.get(boardId)
      if (conns) {
        conns.delete(conn)
        if (conns.size === 0) {
          roomConnections.delete(boardId)

          // Schedule room memory cleanup when all clients disconnect
          if (roomCleanupTimeoutMs > 0) {
            const timer = setTimeout(() => {
              if (!roomConnections.has(boardId)) {
                // Free room Y.Doc and awareness from memory if empty
                if (docs.has(boardId)) {
                  const doc = docs.get(boardId)
                  if (doc) {
                    try {
                      doc.destroy()
                    } catch (e) {
                      // ignore
                    }
                    docs.delete(boardId)
                  }
                  log(`Cleaned up empty room memory for boardId=${boardId}`)
                }
              }
              roomCleanupTimers.delete(boardId)
            }, roomCleanupTimeoutMs)

            roomCleanupTimers.set(boardId, timer)
          }
        }
      }
    })
  })

  return {
    server,
    wss,
    docs,
    roomConnections,
    roomCleanupTimers,
    close: () => {
      for (const timer of roomCleanupTimers.values()) {
        clearTimeout(timer)
      }
      roomCleanupTimers.clear()
      for (const client of wss.clients) {
        try {
          client.terminate()
        } catch (e) {
          // ignore
        }
      }
      return new Promise((resolve) => {
        wss.close(() => {
          server.close(resolve)
        })
      })
    }
  }
}

// Execute directly when run as script
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server.js') || 
  process.argv[1].endsWith('server')
)

if (isDirectRun) {
  const port = process.env.PORT || 1234
  const syncServer = createSyncServer()
  syncServer.server.listen(port, () => {
    console.log(`Yjs sync server running on port ${port}`)
    console.log(`Authorized combinations:`)
    console.log(`- board1: token1`)
    console.log(`- board2: token2`)
    console.log(`- board3: token3`)
  })
}

export default createSyncServer
