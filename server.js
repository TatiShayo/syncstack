import http from 'http'
import { WebSocketServer } from 'ws'
import url from 'url'
// Import CommonJS utility from y-websocket
import yUtils from 'y-websocket/bin/utils'
const { setupWSConnection } = yUtils

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Yjs Sync Server Running\n')
})

const wss = new WebSocketServer({ noServer: true })

// Mock board authorization registry
// Only authorized tokens can connect to specific boardIds
const AUTHORIZED_ACCESS = Object.create(null)
AUTHORIZED_ACCESS['board1'] = ['token1', 'admin-token']
AUTHORIZED_ACCESS['board2'] = ['token2', 'admin-token']
AUTHORIZED_ACCESS['board3'] = ['token3', 'admin-token']

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true)
  const boardId = typeof parsedUrl.query.boardId === 'string' ? parsedUrl.query.boardId : ''
  let token = typeof parsedUrl.query.token === 'string' ? parsedUrl.query.token : ''

  // y-websocket appends /roomName to the end of the server URL. If query parameters are present,
  // this results in /roomName being appended to the last query parameter (token). We strip it here.
  if (boardId && token.endsWith('/' + boardId)) {
    token = token.slice(0, -(boardId.length + 1))
  }

  console.log(`Upgrade requested: boardId=${boardId} token=${token ? '<redacted>' : '<missing>'}`)

  // Enforce per-board access control checks
  if (!boardId || !token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nAccess denied: Missing boardId or token.')
    socket.destroy()
    return
  }

  // Safe lookup avoiding prototype pollution crashes (SEC-01)
  if (!Object.prototype.hasOwnProperty.call(AUTHORIZED_ACCESS, boardId)) {
    console.log(`Access denied for boardId=${boardId}: Board not registered`)
    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccess denied: Invalid board.')
    socket.destroy()
    return
  }

  const allowedTokens = AUTHORIZED_ACCESS[boardId]
  if (!allowedTokens || !allowedTokens.includes(token)) {
    console.log(`Access denied for boardId=${boardId}: invalid token`)
    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccess denied: Invalid token for this board.')
    socket.destroy()
    return
  }

  console.log(`Access allowed for boardId=${boardId}`)
  // Upgrade WebSocket connection if authorized
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

wss.on('connection', (conn, req) => {
  const parsedUrl = url.parse(req.url, true)
  const boardId = parsedUrl.query.boardId
  
  // Set up Y.Doc binding mapping connection to the board ID document name
  setupWSConnection(conn, req, { docName: boardId })
})

const port = process.env.PORT || 1234
server.listen(port, () => {
  console.log(`Yjs sync server running on port ${port}`)
  console.log(`Authorized combinations:`)
  console.log(`- board1: token1`)
  console.log(`- board2: token2`)
  console.log(`- board3: token3`)
})
