import { useEffect, useState, useRef } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import { Plus, Trash2, Edit3, ArrowRight, ArrowLeft, Wifi, WifiOff, Users, Edit2 } from 'lucide-react'

const COLUMN_NAMES: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done'
}

interface CardData {
  id: string
  title: string
  description: string
  assignee: string
}

interface ActiveUser {
  name: string
  color: string
}

// Random name & color helpers for user presence
const NAMES = ['Alex', 'Bailey', 'Charlie', 'Dana', 'Eli', 'Finley', 'Glenn', 'Harlow', 'Indigo', 'Jordan']
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const initialName = NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + Math.floor(Math.random() * 100)
const initialColor = COLORS[Math.floor(Math.random() * COLORS.length)]

export default function App() {
  // Board configuration state
  const [boardInput, setBoardInput] = useState('board1')
  const [tokenInput, setTokenInput] = useState('token1')
  const [activeBoard, setActiveBoard] = useState({ id: 'board1', token: 'token1' })

  // Active Yjs instances
  const [currentDoc, setCurrentDoc] = useState<Y.Doc>(() => new Y.Doc())
  const [version, setVersion] = useState(0)
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  
  // Pending changes count (Phase 4)
  const [pendingChanges, setPendingChanges] = useState(0)
  
  // Presence awareness state (Phase 4)
  const [userName, setUserName] = useState(initialName)
  const [userColor] = useState(initialColor)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])

  // References to active provider and persistence
  const providerRef = useRef<WebsocketProvider | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [modalDescription, setModalDescription] = useState('')
  const [modalAssignee, setModalAssignee] = useState('')
  const [modalColumn, setModalColumn] = useState('todo')
  
  // Validation feedback
  const [validationError, setValidationError] = useState<string | null>(null)

  // Update local user details in the awareness state whenever name changes (SEC-03)
  useEffect(() => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('user', {
        name: userName.slice(0, 50).trim() || 'Anonymous',
        color: userColor
      })
    }
  }, [userName, userColor])

  // Dynamically manage IndexedDB and WebSocket connection per active board
  useEffect(() => {
    const doc = new Y.Doc()
    setCurrentDoc(doc)
    setWsStatus('connecting')
    setPendingChanges(0)

    // Local IndexedDB persistence
    const persistence = new IndexeddbPersistence(`syncstack-board-${activeBoard.id}`, doc)
    
    // Remote WebSocket provider with access credentials in query parameters (SEC-02)
    const wsUrl = `ws://localhost:1234?boardId=${encodeURIComponent(activeBoard.id)}&token=${encodeURIComponent(activeBoard.token)}`
    const wsProvider = new WebsocketProvider(wsUrl, activeBoard.id, doc)
    providerRef.current = wsProvider

    // Set initial awareness state (SEC-03)
    wsProvider.awareness.setLocalStateField('user', {
      name: userName.slice(0, 50).trim() || 'Anonymous',
      color: userColor
    })

    const onSync = () => {
      setVersion(v => v + 1)
    }

    // Monitor document updates to count pending local changes while offline
    const onUpdate = (_update: Uint8Array, origin: any) => {
      setVersion(v => v + 1)
      
      // If disconnected and the transaction originated locally (not from the websocket sync) (Phase 4)
      if (!wsProvider.wsconnected && origin !== wsProvider) {
        setPendingChanges(p => p + 1)
      }
    }

    const onWsStatus = (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      setWsStatus(event.status)
      setVersion(v => v + 1)
    }

    const onWsSync = (isSynced: boolean) => {
      if (isSynced) {
        // Reset local changes count once fully synced online
        setPendingChanges(0)
      }
      setVersion(v => v + 1)
    }

    const onAwarenessChange = () => {
      const states = Array.from(wsProvider.awareness.getStates().values())
      const active = states.map((s: any) => s.user).filter(Boolean) as ActiveUser[]
      setActiveUsers(active)
    }

    persistence.on('synced', onSync)
    doc.on('update', onUpdate)
    wsProvider.on('status', onWsStatus)
    wsProvider.on('sync', onWsSync)
    wsProvider.awareness.on('change', onAwarenessChange)

    if (persistence.synced) {
      onSync()
    }

    return () => {
      persistence.destroy()
      wsProvider.destroy()
      doc.destroy()
      providerRef.current = null
    }
  }, [activeBoard])

  // Get active shared types
  const cardsMap = currentDoc.getMap('cards')
  const getColumnArray = (columnId: string): Y.Array<string> => {
    return currentDoc.getArray(`col-${columnId}`)
  }

  const getCardsForColumn = (columnId: string): CardData[] => {
    const columnArray = getColumnArray(columnId)
    const cards: CardData[] = []
    const toRemove: number[] = []

    columnArray.toArray().forEach((cardId, index) => {
      const cardMap = cardsMap.get(cardId) as Y.Map<any>
      if (!cardMap) {
        // RACE-01: Prune or ignore orphaned card IDs during rendering
        toRemove.push(index)
      } else {
        cards.push({
          id: cardId,
          title: cardMap.get('title') || '',
          description: cardMap.get('description') || '',
          assignee: cardMap.get('assignee') || ''
        })
      }
    })

    if (toRemove.length > 0) {
      currentDoc.transact(() => {
        for (let i = toRemove.length - 1; i >= 0; i--) {
          columnArray.delete(toRemove[i], 1)
        }
      })
    }

    return cards
  }

  // Open modal for creating a new card
  const handleOpenCreateModal = (columnId: string) => {
    setEditingCardId(null)
    setModalTitle('')
    setModalDescription('')
    setModalAssignee('')
    setModalColumn(columnId)
    setValidationError(null)
    setIsModalOpen(true)
  }

  // Open modal for editing a card
  const handleOpenEditModal = (card: CardData, columnId: string) => {
    setEditingCardId(card.id)
    setModalTitle(card.title)
    setModalDescription(card.description)
    setModalAssignee(card.assignee)
    setModalColumn(columnId)
    setValidationError(null)
    setIsModalOpen(true)
  }

  // Save card (create or update) with validation (VAL-01)
  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedTitle = modalTitle.trim()
    const trimmedDescription = modalDescription.trim()
    const trimmedAssignee = modalAssignee.trim()

    // VAL-01: Input Validation
    if (!trimmedTitle) {
      setValidationError('Title is required.')
      return
    }
    if (trimmedTitle.length > 100) {
      setValidationError('Title must be 100 characters or less.')
      return
    }
    if (trimmedDescription.length > 500) {
      setValidationError('Description must be 500 characters or less.')
      return
    }
    if (trimmedAssignee.length > 50) {
      setValidationError('Assignee name must be 50 characters or less.')
      return
    }

    currentDoc.transact(() => {
      if (editingCardId) {
        // RACE-01: Ensure card exists in the card map before editing
        const cardMap = cardsMap.get(editingCardId) as Y.Map<any>
        if (cardMap) {
          cardMap.set('title', trimmedTitle)
          cardMap.set('description', trimmedDescription)
          cardMap.set('assignee', trimmedAssignee)
          
          // Check if the column changed
          let currentColumnId = ''
          for (const colId of ['todo', 'in-progress', 'done']) {
            const colArray = getColumnArray(colId)
            if (colArray.toArray().includes(editingCardId)) {
              currentColumnId = colId
              break
            }
          }

          if (currentColumnId && currentColumnId !== modalColumn) {
            const oldArray = getColumnArray(currentColumnId)
            const oldIndex = oldArray.toArray().indexOf(editingCardId)
            if (oldIndex !== -1) {
              oldArray.delete(oldIndex, 1)
            }
            const newArray = getColumnArray(modalColumn)
            newArray.push([editingCardId])
          }
        }
      } else {
        // Create new card
        const cardId = 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
        const cardMap = new Y.Map()
        cardMap.set('title', trimmedTitle)
        cardMap.set('description', trimmedDescription)
        cardMap.set('assignee', trimmedAssignee)

        cardsMap.set(cardId, cardMap)
        const columnArray = getColumnArray(modalColumn)
        columnArray.push([cardId])
      }
    })

    setIsModalOpen(false)
  }

  // Delete card
  const handleDeleteCard = (cardId: string, columnId: string) => {
    if (!confirm('Are you sure you want to delete this card?')) return

    currentDoc.transact(() => {
      cardsMap.delete(cardId)
      const columnArray = getColumnArray(columnId)
      const index = columnArray.toArray().indexOf(cardId)
      if (index !== -1) {
        columnArray.delete(index, 1)
      }
    })
  }

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceColId: string) => {
    e.dataTransfer.setData('text/plain', cardId)
    e.dataTransfer.setData('sourceColId', sourceColId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDropOnColumn = (e: React.DragEvent, destColId: string) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData('text/plain')
    const sourceColId = e.dataTransfer.getData('sourceColId')

    if (!cardId || !sourceColId) return

    const destArray = getColumnArray(destColId)
    const destIndex = destArray ? destArray.length : 0

    moveCard(cardId, sourceColId, destColId, destIndex)
  }

  const handleDropOnCard = (e: React.DragEvent, destColId: string, destIndex: number) => {
    e.stopPropagation()
    e.preventDefault()
    const cardId = e.dataTransfer.getData('text/plain')
    const sourceColId = e.dataTransfer.getData('sourceColId')

    if (!cardId || !sourceColId) return

    moveCard(cardId, sourceColId, destColId, destIndex)
  }

  const moveCard = (cardId: string, sourceColId: string, destColId: string, destIndex: number) => {
    // RACE-01: Ensure card actually exists before moving
    if (!cardsMap.has(cardId)) return

    currentDoc.transact(() => {
      const sourceArray = getColumnArray(sourceColId)
      const destArray = getColumnArray(destColId)

      const srcIndex = sourceArray.toArray().indexOf(cardId)
      if (srcIndex === -1) return

      if (sourceColId === destColId) {
        if (srcIndex === destIndex) return
        
        sourceArray.delete(srcIndex, 1)
        const insertIndex = Math.min(destIndex, sourceArray.length)
        sourceArray.insert(insertIndex, [cardId])
      } else {
        sourceArray.delete(srcIndex, 1)
        const insertIndex = Math.min(destIndex, destArray.length)
        destArray.insert(insertIndex, [cardId])
      }
    })
  }

  // Move card manually with buttons
  const handleMoveColumn = (cardId: string, currentColId: string, direction: 'left' | 'right') => {
    const colOrder = ['todo', 'in-progress', 'done']
    const currentIndex = colOrder.indexOf(currentColId)
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
    
    if (newIndex >= 0 && newIndex < colOrder.length) {
      const destColId = colOrder[newIndex]
      const destArray = getColumnArray(destColId)
      const destIndex = destArray ? destArray.length : 0
      moveCard(cardId, currentColId, destColId, destIndex)
    }
  }

  const handleMovePosition = (cardId: string, columnId: string, direction: 'up' | 'down') => {
    const colArray = getColumnArray(columnId)
    const srcIndex = colArray.toArray().indexOf(cardId)
    if (srcIndex === -1) return

    const destIndex = direction === 'up' ? srcIndex - 1 : srcIndex + 1
    if (destIndex >= 0 && destIndex < colArray.length) {
      moveCard(cardId, columnId, columnId, destIndex)
    }
  }

  const handleSwitchBoard = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveBoard({ id: boardInput.trim(), token: tokenInput.trim() })
  }

  // Manual WebSocket connection toggler (Phase 4)
  const toggleConnection = () => {
    if (!providerRef.current) return
    if (providerRef.current.wsconnected) {
      providerRef.current.disconnect()
    } else {
      providerRef.current.connect()
    }
    setVersion(v => v + 1)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header data-version={version} className="bg-slate-800 border-b border-slate-700 py-4 px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white font-bold p-2 rounded-lg text-lg tracking-wider">SS</div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">SyncStack</h1>
            <p className="text-xs text-slate-400">Collaborative Local-First Kanban</p>
          </div>
        </div>

        {/* User Presence Info */}
        <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg border border-slate-700/60 max-w-sm">
          <Edit2 size={12} className="text-slate-400" />
          <input
            type="text"
            maxLength={50}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-slate-200 focus:outline-none w-28 placeholder-slate-500"
            placeholder="Edit Username..."
            title="Edit your collaborator display name"
          />
          <div className="w-3.5 h-3.5 rounded-full border border-slate-600" style={{ backgroundColor: userColor }} title="Your presence color" />
        </div>

        {/* Board switcher form */}
        <form onSubmit={handleSwitchBoard} className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-700">
          <div>
            <input
              type="text"
              placeholder="Board ID"
              value={boardInput}
              onChange={(e) => setBoardInput(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 w-24 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Auth Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 w-24 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold px-3 py-1 rounded transition-colors"
          >
            Switch Board
          </button>
        </form>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Sync / Connection Status Indicator */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 text-xs font-semibold text-slate-300">
            {wsStatus === 'connected' ? (
              <>
                <Wifi size={12} className="text-emerald-500" />
                <span className="text-emerald-400">Synced</span>
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-amber-500" />
                <span className="text-amber-400">
                  Offline
                  {pendingChanges > 0 && ` (${pendingChanges} pending local changes)`}
                </span>
              </>
            )}
          </div>

          {/* Connection Toggle */}
          <button
            onClick={toggleConnection}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all duration-150 ${
              wsStatus === 'connected'
                ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {wsStatus === 'connected' ? 'Disconnect' : 'Connect'}
          </button>

          <button
            onClick={() => handleOpenCreateModal('todo')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
          >
            <Plus size={14} />
            Add Card
          </button>
        </div>
      </header>

      {/* Board info & Active Collaborators Subheader */}
      <div className="bg-slate-800/40 border-b border-slate-800 px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-slate-400">
        <div>
          Active Board: <span className="font-semibold text-blue-400">{activeBoard.id}</span>
        </div>
        
        {/* Render Collaborators (Phase 4) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-slate-500">
            <Users size={12} />
            <span>Collaborators ({activeUsers.length}):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeUsers.map((user, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700/60 text-slate-200"
                style={{ borderLeftColor: user.color, borderLeftWidth: '3px' }}
              >
                {user.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Kanban Content */}
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto h-full min-h-[70vh]">
          {Object.keys(COLUMN_NAMES).map((columnId) => {
            const cards = getCardsForColumn(columnId)
            return (
              <div
                key={columnId}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnColumn(e, columnId)}
                className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 flex flex-col h-full min-h-[400px] transition-colors duration-200"
              >
                {/* Column Header */}
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700/40">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      columnId === 'todo' ? 'bg-indigo-400' :
                      columnId === 'in-progress' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    <h2 className="font-bold text-slate-200 tracking-wide text-base">{COLUMN_NAMES[columnId]}</h2>
                  </div>
                  <span className="bg-slate-700/60 text-slate-300 text-xs px-2 py-0.5 rounded-full font-bold">
                    {cards.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-[150px] pb-8">
                  {cards.map((card, index) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id, columnId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnCard(e, columnId, index)}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-slate-600 transition-all duration-200 group cursor-grab active:cursor-grabbing relative"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-semibold text-slate-100 text-sm leading-tight break-words pr-12">
                          {card.title}
                        </h3>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute right-3 top-3">
                          <button
                            onClick={() => handleOpenEditModal(card, columnId)}
                            title="Edit Card"
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card.id, columnId)}
                            title="Delete Card"
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {card.description && (
                        <p className="text-xs text-slate-400 mb-3 break-words line-clamp-3">
                          {card.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-700/50 pt-2.5 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          {card.assignee ? (
                            <>
                              <div className="bg-blue-600/30 text-blue-400 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]">
                                {card.assignee.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-400 truncate max-w-[100px]">{card.assignee}</span>
                            </>
                          ) : (
                            <span className="italic text-slate-500">Unassigned</span>
                          )}
                        </div>
                        {/* YJS-02: Rely entirely on array index for position info */}
                        <span className="bg-slate-700/40 text-slate-400 px-1.5 py-0.5 rounded text-[10px]">
                          Pos: {index}
                        </span>
                      </div>

                      {/* Manual Reordering Controls */}
                      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-700/30 opacity-40 group-hover:opacity-100 transition-opacity duration-150">
                        <div className="flex gap-1">
                          <button
                            disabled={columnId === 'todo'}
                            onClick={() => handleMoveColumn(card.id, columnId, 'left')}
                            className="p-0.5 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400 transition-colors"
                            title="Move column left"
                          >
                            <ArrowLeft size={12} />
                          </button>
                          <button
                            disabled={columnId === 'done'}
                            onClick={() => handleMoveColumn(card.id, columnId, 'right')}
                            className="p-0.5 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400 transition-colors"
                            title="Move column right"
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <button
                            disabled={index === 0}
                            onClick={() => handleMovePosition(card.id, columnId, 'up')}
                            className="px-1 py-0.5 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400 text-[10px] transition-colors"
                            title="Move card up"
                          >
                            ▲ Up
                          </button>
                          <button
                            disabled={index === cards.length - 1}
                            onClick={() => handleMovePosition(card.id, columnId, 'down')}
                            className="px-1 py-0.5 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400 text-[10px] transition-colors"
                            title="Move card down"
                          >
                            ▼ Down
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700/50 rounded-lg p-6 text-slate-500 text-center">
                      <p className="text-xs">Drag cards here or click add card</p>
                    </div>
                  )}
                </div>

                {/* Column footer button */}
                <button
                  onClick={() => handleOpenCreateModal(columnId)}
                  className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all hover:bg-slate-700/30"
                >
                  <Plus size={14} />
                  Add Card
                </button>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
              <h3 className="font-bold text-slate-100 text-lg">
                {editingCardId ? 'Edit Kanban Card' : 'Create New Card'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCard}>
              <div className="p-6 space-y-4">
                {validationError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-semibold">
                    {validationError}
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Title *
                    </label>
                    <span className="text-[10px] text-slate-500">{modalTitle.length}/100</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="Enter card title..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Description
                    </label>
                    <span className="text-[10px] text-slate-500">{modalDescription.length}/500</span>
                  </div>
                  <textarea
                    maxLength={500}
                    value={modalDescription}
                    onChange={(e) => setModalDescription(e.target.value)}
                    placeholder="Enter card description..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Assignee
                    </label>
                    <span className="text-[10px] text-slate-500">{modalAssignee.length}/50</span>
                  </div>
                  <input
                    type="text"
                    maxLength={50}
                    value={modalAssignee}
                    onChange={(e) => setModalAssignee(e.target.value)}
                    placeholder="Assignee name..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Column
                  </label>
                  <select
                    value={modalColumn}
                    onChange={(e) => setModalColumn(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-900 border-t border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-slate-100 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-md shadow-blue-500/10"
                >
                  {editingCardId ? 'Save Changes' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
