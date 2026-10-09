import http from 'http'
import crypto from 'crypto'
import { WebSocketServer } from 'ws'
import url from 'url'
import yUtils from 'y-websocket/bin/utils'

const { setupWSConnection, docs } = yUtils

/**
 * Parse a SYNC_AUTH credential map.
 *
 * Accepted forms:
 *   "board1:tokenA,board2:tokenB"       simple pairs (comma separated)
 *   '{"board1":["tokenA","tokenB"]}'    full JSON map
 *
 * There is deliberately NO default. createSyncServer() used to ship with
 * hardcoded demo tokens (board1/token1, …) AND print them to stdout at
 * boot, so any deployment that forgot to configure anything ran with
 * publicly-known credentials. It now refuses to run unconfigured.
 */
export function parseSyncAuth(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const map = Object.create(null)
      for (const [k, v] of Object.entries(parsed)) {
        map[k] = Array.isArray(v) ? [...v] : [v]
      }
      return Object.keys(map).length > 0 ? map : null
    } catch {
      return null
    }
  }

  const map = Object.create(null)
  for (const pair of trimmed.split(',')) {
    const sep = pair.indexOf(':')
    if (sep <= 0 || sep === pair.length - 1) continue
    const board = pair.slice(0, sep).trim()
    const token = pair.slice(sep + 1).trim()
    if (!board || !token) continue
    if (map[board]) map[board].push(token)
    else map[board] = [token]
  }
  return Object.keys(map).length > 0 ? map : null
}

/** Constant-time token comparison over SHA-256 of both sides. */
function tokensMatchConstantTime(supplied, allowed) {
  const a = crypto.createHash('sha256').update(String(supplied)).digest()
  const b = crypto.createHash('sha256').update(String(allowed)).digest()
  return crypto.timingSafeEqual(a, b)
}

export function createSyncServer(options = {}) {
  const {
    authorizedAccess = null,
    roomCleanupTimeoutMs = 30000,
    enableLogging = true,
    allowedOrigins = null,
    maxPayloadBytes = 1024 * 1024
  } = options

  // Fail closed: no credentials, no server. An explicit empty map is also
  // refused — "no boards configured" must not silently mean "no auth".
  if (!authorizedAccess || typeof authorizedAccess !== 'object') {
    throw new Error(
      'createSyncServer requires an explicit authorizedAccess map (pass SYNC_AUTH). Refusing to start with default credentials.'
    )
  }
  if (Object.keys(authorizedAccess).length === 0) {
    throw new Error('createSyncServer: authorizedAccess is empty — refusing to start an unauthenticated sync server.')
  }

  // Safe registry object with null prototype to prevent prototype pollution (SEC-01)
  const AUTHORIZED_ACCESS = Object.create(null)
  for (const [k, v] of Object.entries(authorizedAccess)) {
    if (!Array.isArray(v) || v.length === 0 || v.some((t) => typeof t !== 'string' || !t)) {
      throw new Error(`createSyncServer: invalid token list for board "${k}"`)
    }
    AUTHORIZED_ACCESS[k] = [...v]
  }

  // Cross-site WebSocket hijacking (CSWSH) allowlist. Browser WebSocket
  // handshakes always carry an Origin header; non-browser clients (native
  // apps, the y-websocket server-side tests, curl) do not, and are still
  // allowed — the CSWSH threat is specifically a browser page opening a
  // socket to this server with the victim's ambient credentials/tokens.
  // An empty/missing allowlist rejects every browser origin.
  const ORIGIN_ALLOWLIST = Array.isArray(allowedOrigins)
    ? new Set(allowedOrigins.map((o) => String(o).toLowerCase()))
    : new Set()

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

  const wss = new WebSocketServer({ noServer: true, maxPayload: maxPayloadBytes })

  server.on('upgrade', (request, socket, head) => {
    try {
      // CSWSH guard: reject browser origins that are not on the allowlist.
      // Absent Origin is allowed (non-browser clients never send it).
      const origin = request.headers.origin
      if (origin && !ORIGIN_ALLOWLIST.has(String(origin).toLowerCase())) {
        log(`Upgrade rejected: origin not allowed (${origin})`)
        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccess denied: Origin not allowed.')
        socket.destroy()
        return
      }

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
      // Constant-time comparison (hash both sides) so a token cannot be
      // recovered byte-by-byte through response-time differences.
      if (!allowedTokens || !allowedTokens.some((t) => tokensMatchConstantTime(token, t))) {
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
  const authorizedAccess = parseSyncAuth(process.env.SYNC_AUTH)

  if (!authorizedAccess) {
    // Fail closed. The previous build booted with hardcoded demo tokens and
    // printed them to stdout — anyone with the source (or the logs) had valid
    // credentials for every deployment that forgot to configure.
    console.error(
      'SYNC_AUTH is required. Format: "boardId:token,boardId:token" or a JSON map. Refusing to start.'
    )
    process.exit(1)
  }

  const allowedOrigins = (process.env.SYNC_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  const syncServer = createSyncServer({
    authorizedAccess,
    allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : [],
  })

  syncServer.server.listen(port, () => {
    console.log(`Yjs sync server running on port ${port}`)
    // Board names only — tokens are never printed.
    console.log(`Authorized boards: ${Object.keys(authorizedAccess).join(', ') || '(none)'}`)
    console.log(
      allowedOrigins.length > 0
        ? `Allowed browser origins: ${allowedOrigins.join(', ')}`
        : 'No browser origins allowed (non-browser clients only; set SYNC_ALLOWED_ORIGINS to allow web clients).'
    )
  })
}

export default createSyncServer
