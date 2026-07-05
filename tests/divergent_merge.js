import http from 'http'
import { WebSocketServer } from 'ws'
import url from 'url'
import yUtils from 'y-websocket/bin/utils'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import ws from 'ws'

const { setupWSConnection } = yUtils

// 1. Helper to start a test WebSocket server
function startTestServer(port) {
  const server = http.createServer((req, res) => {
    res.writeHead(200)
    res.end('Test server')
  })
  const wss = new WebSocketServer({ noServer: true })
  
  const authorized = Object.create(null)
  authorized['test-board'] = ['test-token']

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = url.parse(request.url, true)
    const boardId = parsedUrl.query.boardId
    const token = parsedUrl.query.token

    if (!boardId || !token || !authorized[boardId] || !authorized[boardId].includes(token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (wsConn) => {
      wss.emit('connection', wsConn, request)
    })
  })

  wss.on('connection', (conn, req) => {
    const parsedUrl = url.parse(req.url, true)
    const boardId = parsedUrl.query.boardId
    setupWSConnection(conn, req, { docName: boardId })
  })

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        close: () => new Promise((res) => server.close(res))
      })
    })
  })
}

// Helper to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 2. Main test runner
async function runTest() {
  const PORT = 1235
  console.log(`Starting test server on port ${PORT}...`)
  const testServer = await startTestServer(PORT)

  const RUNS = 5
  let successCount = 0

  try {
    for (let run = 1; run <= RUNS; run++) {
      console.log(`\n--- RUN ${run} / ${RUNS} ---`)
      
      const docA = new Y.Doc()
      const docB = new Y.Doc()

      const wsUrl = `ws://localhost:${PORT}?boardId=test-board&token=test-token`
      
      // Connect both clients using ws polyfill
      const providerA = new WebsocketProvider(wsUrl, 'test-board', docA, { WebSocketPolyfill: ws })
      const providerB = new WebsocketProvider(wsUrl, 'test-board', docB, { WebSocketPolyfill: ws })

      // Wait for connection and initial sync
      await delay(500)

      // Create a test card on Client A
      console.log('Client A: Creating card-x in "todo"...')
      docA.transact(() => {
        const cardsMap = docA.getMap('cards')
        const cardMap = new Y.Map()
        cardMap.set('title', 'Conflict Card X')
        cardMap.set('description', 'Test Description')
        cardMap.set('assignee', 'Test User')
        cardsMap.set('card-x', cardMap)

        const todoArray = docA.getArray('col-todo')
        todoArray.push(['card-x'])
      })

      // Wait for sync to propagate to B
      await delay(500)

      // Verify B received the card
      const todoB = docB.getArray('col-todo')
      if (!todoB.toArray().includes('card-x')) {
        throw new Error('Initial card synchronization failed.')
      }
      console.log('Initial synchronization confirmed on Client B.')

      // Disconnect both clients
      console.log('Disconnecting both clients (Simulating Offline Mode)...')
      providerA.disconnect()
      providerB.disconnect()
      await delay(200)

      // Client A moves card-x to 'in-progress'
      console.log('Client A (Offline): Moving card-x to "in-progress"...')
      docA.transact(() => {
        const todo = docA.getArray('col-todo')
        const inProgress = docA.getArray('col-in-progress')
        const idx = todo.toArray().indexOf('card-x')
        if (idx !== -1) {
          todo.delete(idx, 1)
        }
        inProgress.push(['card-x'])
      })

      // Client B moves card-x to 'done'
      console.log('Client B (Offline): Moving card-x to "done"...')
      docB.transact(() => {
        const todo = docB.getArray('col-todo')
        const done = docB.getArray('col-done')
        const idx = todo.toArray().indexOf('card-x')
        if (idx !== -1) {
          todo.delete(idx, 1)
        }
        done.push(['card-x'])
      })

      // Reconnect both clients
      console.log('Reconnecting both clients (Online)...')
      providerA.connect()
      providerB.connect()

      // Wait for merge sync
      await delay(1000)

      // Extract final column states
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

      console.log('Client A final state:', JSON.stringify(colsA))
      console.log('Client B final state:', JSON.stringify(colsB))

      // Assert state convergence
      const matchesTodo = JSON.stringify(colsA.todo) === JSON.stringify(colsB.todo)
      const matchesInProgress = JSON.stringify(colsA.inProgress) === JSON.stringify(colsB.inProgress)
      const matchesDone = JSON.stringify(colsA.done) === JSON.stringify(colsB.done)

      if (!matchesTodo || !matchesInProgress || !matchesDone) {
        throw new Error('Divergence detected: States did not converge!')
      }

      // Assert no data loss (card-x exists somewhere)
      const existsA = colsA.inProgress.includes('card-x') || colsA.done.includes('card-x')
      const existsB = colsB.inProgress.includes('card-x') || colsB.done.includes('card-x')

      if (!existsA || !existsB) {
        throw new Error('Data loss detected: card-x is missing!')
      }

      console.log('Assertion Passed: States converged deterministically with zero data loss.')
      
      providerA.destroy()
      providerB.destroy()
      docA.destroy()
      docB.destroy()
      
      successCount++
    }

    console.log(`\nSuccess: All ${successCount} / ${RUNS} runs completed successfully with consistent outcomes!`);
  } catch (error) {
    console.error('Test failed with error:', error)
    process.exit(1)
  } finally {
    console.log('Shutting down test server...')
    await testServer.close()
  }
}

runTest()
