import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import {
  ActiveTool,
  ActiveUser,
  CanvasElement,
  CardData,
  Point,
  SyncStackDocumentSnapshot,
  UserPresence,
  ViewMode
} from './types'
import { CRDTManager } from './crdt/crdtManager'
import { Header } from './components/Header'
import { CanvasWorkspace } from './components/CanvasWorkspace'
import { KanbanWorkspace } from './components/KanbanWorkspace'
import { ExportModal } from './components/ExportModal'
import { ErrorBoundary } from './components/ErrorBoundary'

const NAMES = [
  'Alex',
  'Bailey',
  'Charlie',
  'Dana',
  'Eli',
  'Finley',
  'Glenn',
  'Harlow',
  'Indigo',
  'Jordan'
]

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316'
]

const initialName =
  NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + Math.floor(Math.random() * 100)
const initialColor = COLORS[Math.floor(Math.random() * COLORS.length)]

export default function App() {
  // Board Configuration State
  const [boardInput, setBoardInput] = useState('board1')
  const [tokenInput, setTokenInput] = useState('token1')
  const [activeBoard, setActiveBoard] = useState({ id: 'board1', token: 'token1' })

  // Workspace View Mode & Tool
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Version counter to trigger re-renders on CRDT mutations
  const [, setVersion] = useState(0)
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')

  // Presence State
  const [userName, setUserName] = useState(initialName)
  const [userColor] = useState(initialColor)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [remotePresences, setRemotePresences] = useState<UserPresence[]>([])

  // CRDT Manager instance reference
  const crdtManagerRef = useRef<CRDTManager>(new CRDTManager())
  const providerRef = useRef<WebsocketProvider | null>(null)

  // Re-render trigger callback
  const triggerUpdate = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  // Update local awareness when username or color changes
  useEffect(() => {
    if (providerRef.current) {
      const sanitized = CRDTManager.sanitizeUsername(userName)
      providerRef.current.awareness.setLocalStateField('user', {
        name: sanitized,
        color: userColor
      })
    }
  }, [userName, userColor])

  // Manage Yjs Document, IndexedDB Persistence, and WebSocket Provider
  useEffect(() => {
    const manager = new CRDTManager()
    crdtManagerRef.current = manager
    setWsStatus('connecting')

    const unsubscribe = manager.subscribe(triggerUpdate)

    // Local IndexedDB persistence
    const persistence = new IndexeddbPersistence(`syncstack-board-${activeBoard.id}`, manager.doc)

    // Remote WebSocket provider with credentials in query params
    const baseUrl =
      (typeof import.meta !== 'undefined' &&
        (import.meta as any).env &&
        typeof (import.meta as any).env.VITE_WS_URL === 'string' &&
        (import.meta as any).env.VITE_WS_URL.trim()) ||
      'ws://localhost:1234'
    const wsUrl = `${baseUrl}?boardId=${encodeURIComponent(
      activeBoard.id
    )}&token=${encodeURIComponent(activeBoard.token)}`
    const wsProvider = new WebsocketProvider(wsUrl, activeBoard.id, manager.doc)
    providerRef.current = wsProvider

    // Initial awareness state
    wsProvider.awareness.setLocalStateField('user', {
      name: CRDTManager.sanitizeUsername(userName),
      color: userColor
    })

    const onSync = () => {
      triggerUpdate()
    }

    const onWsStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setWsStatus(event.status)
      manager.setOnlineStatus(event.status === 'connected')
      triggerUpdate()
    }

    const onWsSync = (isSynced: boolean) => {
      if (isSynced) {
        manager.resetPendingChanges()
      }
      triggerUpdate()
    }

    const onAwarenessChange = () => {
      const states = Array.from(wsProvider.awareness.getStates().entries())
      const users: ActiveUser[] = []
      const presences: UserPresence[] = []

      for (const [clientId, state] of states) {
        if (!state) continue
        const u = (state as any).user
        if (u && u.name) {
          users.push({
            id: clientId.toString(),
            name: u.name,
            color: u.color || '#3b82f6'
          })
        }

        // Only include remote collaborator presences for canvas cursor overlays
        if (clientId !== manager.doc.clientID) {
          presences.push({
            id: clientId.toString(),
            name: u?.name || 'Collaborator',
            color: u?.color || '#3b82f6',
            cursor: (state as any).cursor || null,
            selectedElementIds: (state as any).selectedElementIds || [],
            activeTool: (state as any).activeTool,
            lastActive: Date.now()
          })
        }
      }

      setActiveUsers(users)
      setRemotePresences(presences)
    }

    persistence.on('synced', onSync)
    wsProvider.on('status', onWsStatus)
    wsProvider.on('sync', onWsSync)
    wsProvider.awareness.on('change', onAwarenessChange)

    if (persistence.synced) {
      onSync()
    }

    return () => {
      unsubscribe()
      persistence.destroy()
      wsProvider.destroy()
      manager.destroy()
      providerRef.current = null
    }
  }, [activeBoard, triggerUpdate, userColor, userName])

  // Board switcher handler
  const handleSwitchBoard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!boardInput.trim() || !tokenInput.trim()) return
    setActiveBoard({ id: boardInput.trim(), token: tokenInput.trim() })
  }

  // WebSocket toggle
  const handleToggleConnection = () => {
    if (!providerRef.current) return
    if (providerRef.current.wsconnected) {
      providerRef.current.disconnect()
    } else {
      providerRef.current.connect()
    }
    triggerUpdate()
  }

  // Cursor and Selection awareness updates
  const handleCursorMove = useCallback((cursor: Point | null) => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('cursor', cursor)
    }
  }, [])

  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('selectedElementIds', selectedIds)
    }
  }, [])

  // Canvas element actions
  const handleCreateElement = useCallback((elem: CanvasElement) => {
    crdtManagerRef.current.createElement(elem)
  }, [])

  const handleUpdateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    crdtManagerRef.current.updateElement(id, updates)
  }, [])

  const handleDeleteElement = useCallback((id: string) => {
    crdtManagerRef.current.deleteElement(id)
  }, [])

  const handleDeleteElements = useCallback((ids: string[]) => {
    crdtManagerRef.current.deleteElements(ids)
  }, [])

  const handleMoveElements = useCallback((ids: string[], dx: number, dy: number) => {
    crdtManagerRef.current.moveElements(ids, dx, dy)
  }, [])

  const handleBringToFront = useCallback((id: string) => {
    crdtManagerRef.current.bringToFront(id)
  }, [])

  const handleSendToBack = useCallback((id: string) => {
    crdtManagerRef.current.sendToBack(id)
  }, [])

  // Kanban card actions
  const handleCreateCard = useCallback(
    (
      title: string,
      description: string,
      assignee: string,
      columnId: string,
      priority?: 'low' | 'medium' | 'high'
    ) => {
      crdtManagerRef.current.createCard(title, description, assignee, columnId, priority)
    },
    []
  )

  const handleUpdateCard = useCallback(
    (
      id: string,
      title: string,
      description: string,
      assignee: string,
      columnId?: string,
      priority?: 'low' | 'medium' | 'high'
    ) => {
      crdtManagerRef.current.updateCard(id, title, description, assignee, columnId, priority)
    },
    []
  )

  const handleDeleteCard = useCallback((id: string, columnId: string) => {
    crdtManagerRef.current.deleteCard(id, columnId)
  }, [])

  const handleMoveCard = useCallback(
    (cardId: string, sourceColId: string, destColId: string, destIndex: number) => {
      crdtManagerRef.current.moveCard(cardId, sourceColId, destColId, destIndex)
    },
    []
  )

  // Undo / Redo
  const handleUndo = useCallback(() => {
    crdtManagerRef.current.undo()
  }, [])

  const handleRedo = useCallback(() => {
    crdtManagerRef.current.redo()
  }, [])

  // Snapshot import
  const handleImportSnapshot = useCallback((snapshot: SyncStackDocumentSnapshot) => {
    crdtManagerRef.current.loadSnapshot(snapshot)
  }, [])

  // Data Selectors
  const elements = crdtManagerRef.current.getElements()
  const cardsByColumn: Record<string, CardData[]> = useMemo(
    () => ({
      todo: crdtManagerRef.current.getCardsForColumn('todo'),
      'in-progress': crdtManagerRef.current.getCardsForColumn('in-progress'),
      done: crdtManagerRef.current.getCardsForColumn('done')
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [triggerUpdate, crdtManagerRef.current.cardsMap.size, elements.length]
  )

  const snapshot = crdtManagerRef.current.exportSnapshot(activeBoard.id)

  return (
    <ErrorBoundary fallbackTitle="SyncStack Workspace Error">
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* Header Navigation & Workspace Controls */}
        <Header
          boardInput={boardInput}
          setBoardInput={setBoardInput}
          tokenInput={tokenInput}
          setTokenInput={setTokenInput}
          onSwitchBoard={handleSwitchBoard}
          activeBoardId={activeBoard.id}
          wsStatus={wsStatus}
          pendingChanges={crdtManagerRef.current.getPendingChanges()}
          onToggleConnection={handleToggleConnection}
          userName={userName}
          setUserName={setUserName}
          userColor={userColor}
          activeUsers={activeUsers}
          viewMode={viewMode}
          onSetViewMode={setViewMode}
          canUndo={crdtManagerRef.current.canUndo()}
          canRedo={crdtManagerRef.current.canRedo()}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onOpenExportModal={() => setIsExportModalOpen(true)}
        />

        {/* Workspace Body */}
        <main className="flex-1 flex overflow-hidden relative">
          {/* Canvas Whiteboard Panel */}
          {(viewMode === 'canvas' || viewMode === 'both') && (
            <div
              className={`h-full flex flex-col border-r border-slate-800 ${
                viewMode === 'both' ? 'w-full lg:w-7/12' : 'w-full'
              }`}
            >
              <CanvasWorkspace
                elements={elements}
                remotePresences={remotePresences}
                activeTool={activeTool}
                onSelectTool={setActiveTool}
                onCreateElement={handleCreateElement}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onDeleteElements={handleDeleteElements}
                onMoveElements={handleMoveElements}
                onBringToFront={handleBringToFront}
                onSendToBack={handleSendToBack}
                onCursorMove={handleCursorMove}
                onSelectionChange={handleSelectionChange}
                onUndo={handleUndo}
                onRedo={handleRedo}
                userColor={userColor}
                userName={userName}
              />
            </div>
          )}

          {/* Kanban Board Panel */}
          {(viewMode === 'kanban' || viewMode === 'both') && (
            <div
              className={`h-full overflow-y-auto flex flex-col ${
                viewMode === 'both' ? 'hidden lg:flex lg:w-5/12' : 'w-full'
              }`}
            >
              <KanbanWorkspace
                cardsByColumn={cardsByColumn}
                onCreateCard={handleCreateCard}
                onUpdateCard={handleUpdateCard}
                onDeleteCard={handleDeleteCard}
                onMoveCard={handleMoveCard}
              />
            </div>
          )}
        </main>

        {/* Export / Import Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          boardId={activeBoard.id}
          elements={snapshot.elements}
          cards={snapshot.cards}
          columns={snapshot.columns}
          onImport={handleImportSnapshot}
        />
      </div>
    </ErrorBoundary>
  )
}
