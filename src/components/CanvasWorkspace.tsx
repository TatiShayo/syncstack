import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  ActiveTool,
  CanvasElement,
  Point,
  SelectionBox,
  UserPresence,
  RectangleElement,
  EllipseElement,
  TextElement,
  StickyNoteElement,
  ArrowConnectorElement
} from '../types'
import {
  calculateConnectorPath,
  getCombinedBoundingBox,
  getElementsInSelection,
  isPointInElement
} from '../utils/canvasMath'
import { Toolbar } from './Toolbar'

interface Props {
  elements: CanvasElement[]
  remotePresences: UserPresence[]
  activeTool: ActiveTool
  onSelectTool: (tool: ActiveTool) => void
  onCreateElement: (elem: CanvasElement) => void
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void
  onDeleteElement: (id: string) => void
  onDeleteElements: (ids: string[]) => void
  onMoveElements: (ids: string[], dx: number, dy: number) => void
  onBringToFront: (id: string) => void
  onSendToBack: (id: string) => void
  onCursorMove: (cursor: Point | null) => void
  onSelectionChange: (selectedIds: string[]) => void
  onUndo?: () => void
  onRedo?: () => void
  userColor: string
  userName: string
}

export const CanvasWorkspace: React.FC<Props> = ({
  elements,
  remotePresences,
  activeTool,
  onSelectTool,
  onCreateElement,
  onUpdateElement,
  onDeleteElement,
  onDeleteElements,
  onMoveElements,
  onBringToFront,
  onSendToBack,
  onCursorMove,
  onSelectionChange,
  onUndo,
  onRedo,
  userColor,
  userName
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport State
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

  // Interaction State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isInteracting, setIsInteracting] = useState(false)
  const [interactionType, setInteractionType] = useState<
    'none' | 'pan' | 'selectBox' | 'dragElements' | 'createShape'
  >('none')
  const [dragStartPoint, setDragStartPoint] = useState<Point>({ x: 0, y: 0 })
  const [currentMousePoint, setCurrentMousePoint] = useState<Point>({ x: 0, y: 0 })
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')

  // Convert screen client coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      if (!containerRef.current) return { x: screenX, y: screenY }
      const rect = containerRef.current.getBoundingClientRect()
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom
      }
    },
    [pan, zoom]
  )

  // Sync selectedIds with parent presence
  useEffect(() => {
    onSelectionChange(selectedIds)
  }, [selectedIds, onSelectionChange])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return // Don't trigger shortcuts during text edit
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          if (onRedo) onRedo()
        } else {
          if (onUndo) onUndo()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        if (onRedo) onRedo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          onDeleteElements(selectedIds)
          setSelectedIds([])
        }
      } else if (e.key === 'Escape') {
        setSelectedIds([])
        onSelectTool('select')
      } else if (e.key.toLowerCase() === 'v') {
        onSelectTool('select')
      } else if (e.key.toLowerCase() === 'h') {
        onSelectTool('pan')
      } else if (e.key.toLowerCase() === 'r') {
        onSelectTool('rectangle')
      } else if (e.key.toLowerCase() === 'o') {
        onSelectTool('ellipse')
      } else if (e.key.toLowerCase() === 't') {
        onSelectTool('text')
      } else if (e.key.toLowerCase() === 's') {
        onSelectTool('sticky')
      } else if (e.key.toLowerCase() === 'a') {
        onSelectTool('arrow')
      } else if (e.key.toLowerCase() === 'c') {
        onSelectTool('connector')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, editingTextId, onDeleteElements, onSelectTool, onUndo, onRedo])

  // Mouse Down Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingTextId) return
    const worldPoint = screenToWorld(e.clientX, e.clientY)
    setDragStartPoint(worldPoint)
    setCurrentMousePoint(worldPoint)

    // Middle-click or space+click starts panning
    if (e.button === 1 || activeTool === 'pan') {
      setIsInteracting(true)
      setInteractionType('pan')
      return
    }

    if (e.button !== 0) return

    if (activeTool === 'select') {
      // Hit-test elements from top to bottom
      const reversed = [...elements].reverse()
      const hit = reversed.find((elem) => isPointInElement(worldPoint, elem))

      if (hit) {
        if (e.shiftKey) {
          // Toggle selection
          setSelectedIds((prev) =>
            prev.includes(hit.id) ? prev.filter((id) => id !== hit.id) : [...prev, hit.id]
          )
        } else {
          if (!selectedIds.includes(hit.id)) {
            setSelectedIds([hit.id])
          }
        }
        setIsInteracting(true)
        setInteractionType('dragElements')
      } else {
        // Clicked on empty canvas -> Start rubber-band selection box
        if (!e.shiftKey) {
          setSelectedIds([])
        }
        setIsInteracting(true)
        setInteractionType('selectBox')
      }
    } else {
      // Shape Creation Tool
      setIsInteracting(true)
      setInteractionType('createShape')
    }
  }

  // Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY)
    setCurrentMousePoint(worldPoint)
    onCursorMove(worldPoint)

    if (!isInteracting) return

    if (interactionType === 'pan') {
      setPan((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }))
    } else if (interactionType === 'dragElements') {
      const dx = worldPoint.x - dragStartPoint.x
      const dy = worldPoint.y - dragStartPoint.y
      if (dx !== 0 || dy !== 0) {
        onMoveElements(selectedIds, dx, dy)
        setDragStartPoint(worldPoint)
      }
    } else if (interactionType === 'selectBox') {
      const selectBox: SelectionBox = {
        x: Math.min(dragStartPoint.x, worldPoint.x),
        y: Math.min(dragStartPoint.y, worldPoint.y),
        width: Math.abs(worldPoint.x - dragStartPoint.x),
        height: Math.abs(worldPoint.y - dragStartPoint.y)
      }
      const matched = getElementsInSelection(elements, selectBox)
      setSelectedIds(matched.map((m) => m.id))
    }
  }

  // Mouse Up Handler
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isInteracting) return
    const worldPoint = screenToWorld(e.clientX, e.clientY)

    if (interactionType === 'createShape') {
      const width = Math.max(20, Math.abs(worldPoint.x - dragStartPoint.x))
      const height = Math.max(20, Math.abs(worldPoint.y - dragStartPoint.y))
      const x = Math.min(dragStartPoint.x, worldPoint.x)
      const y = Math.min(dragStartPoint.y, worldPoint.y)
      const elemId = 'elem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
      const now = Date.now()

      if (activeTool === 'rectangle') {
        const newRect: RectangleElement = {
          id: elemId,
          type: 'rectangle',
          x,
          y,
          width: Math.max(width, 100),
          height: Math.max(height, 60),
          fill: '#3b82f6',
          stroke: '#1d4ed8',
          strokeWidth: 2,
          cornerRadius: 8,
          createdAt: now,
          updatedAt: now
        }
        onCreateElement(newRect)
        setSelectedIds([elemId])
        onSelectTool('select')
      } else if (activeTool === 'ellipse') {
        const newEllipse: EllipseElement = {
          id: elemId,
          type: 'ellipse',
          x,
          y,
          width: Math.max(width, 90),
          height: Math.max(height, 90),
          fill: '#10b981',
          stroke: '#047857',
          strokeWidth: 2,
          createdAt: now,
          updatedAt: now
        }
        onCreateElement(newEllipse)
        setSelectedIds([elemId])
        onSelectTool('select')
      } else if (activeTool === 'text') {
        const newText: TextElement = {
          id: elemId,
          type: 'text',
          x: worldPoint.x,
          y: worldPoint.y,
          width: 140,
          height: 32,
          text: 'Double click to edit',
          fontSize: 16,
          fontFamily: 'sans-serif',
          fill: '#f8fafc',
          align: 'left',
          createdAt: now,
          updatedAt: now
        }
        onCreateElement(newText)
        setSelectedIds([elemId])
        onSelectTool('select')
      } else if (activeTool === 'sticky') {
        const newSticky: StickyNoteElement = {
          id: elemId,
          type: 'sticky',
          x: worldPoint.x - 70,
          y: worldPoint.y - 70,
          width: 150,
          height: 150,
          text: 'New Note',
          color: '#fef08a',
          fontSize: 14,
          author: userName,
          createdAt: now,
          updatedAt: now
        }
        onCreateElement(newSticky)
        setSelectedIds([elemId])
        onSelectTool('select')
      } else if (activeTool === 'arrow' || activeTool === 'connector') {
        const newArrow: ArrowConnectorElement = {
          id: elemId,
          type: activeTool,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          startPoint: dragStartPoint,
          endPoint: worldPoint,
          style: activeTool === 'connector' ? 'orthogonal' : 'straight',
          stroke: '#94a3b8',
          strokeWidth: 2,
          arrowHeadStart: 'none',
          arrowHeadEnd: 'arrow',
          createdAt: now,
          updatedAt: now
        }
        onCreateElement(newArrow)
        setSelectedIds([elemId])
        onSelectTool('select')
      }
    }

    setIsInteracting(false)
    setInteractionType('none')
  }

  // Wheel Handler for Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      const newZoom = Math.min(3, Math.max(0.2, zoom * zoomFactor))
      setZoom(newZoom)
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }))
    }
  }

  // Double Click for Text Editing
  const handleDoubleClick = (elem: CanvasElement) => {
    if (elem.type === 'text') {
      setEditingTextId(elem.id)
      setEditingTextValue((elem as TextElement).text)
    } else if (elem.type === 'sticky') {
      setEditingTextId(elem.id)
      setEditingTextValue((elem as StickyNoteElement).text)
    }
  }

  const handleFinishTextEdit = () => {
    if (editingTextId) {
      const elem = elements.find((e) => e.id === editingTextId)
      if (elem) {
        if (elem.type === 'text' || elem.type === 'sticky') {
          onUpdateElement(editingTextId, { text: editingTextValue })
        }
      }
      setEditingTextId(null)
      setEditingTextValue('')
    }
  }

  // Render Selected Elements Bounding Box
  const selectedElements = elements.filter((e) => selectedIds.includes(e.id))
  const selectionCombinedBox = getCombinedBoundingBox(selectedElements)

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => onCursorMove(null)}
      onWheel={handleWheel}
      className={`relative w-full h-full min-h-[550px] bg-slate-950 overflow-hidden select-none ${
        activeTool === 'pan' || interactionType === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'select'
          ? 'cursor-default'
          : 'cursor-crosshair'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, #334155 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
    >
      {/* Floating Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        selectedElements={selectedElements}
        onUpdateSelected={(updates) => {
          for (const id of selectedIds) {
            onUpdateElement(id, updates)
          }
        }}
        onDeleteSelected={() => {
          onDeleteElements(selectedIds)
          setSelectedIds([])
        }}
        onBringToFront={() => {
          for (const id of selectedIds) {
            onBringToFront(id)
          }
        }}
        onSendToBack={() => {
          for (const id of selectedIds) {
            onSendToBack(id)
          }
        }}
      />

      {/* SVG Canvas Layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <defs>
          <filter id="canvas-sticky-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.3" />
          </filter>
          <marker id="canvas-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Render Canvas Elements */}
        {elements.map((elem) => {
          const isSelected = selectedIds.includes(elem.id)
          const rotation = elem.rotation || 0
          const transform =
            rotation !== 0
              ? `rotate(${rotation} ${elem.x + elem.width / 2} ${elem.y + elem.height / 2})`
              : undefined

          switch (elem.type) {
            case 'rectangle': {
              const rect = elem as RectangleElement
              return (
                <rect
                  key={rect.id}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={rect.cornerRadius || 0}
                  ry={rect.cornerRadius || 0}
                  fill={rect.fill}
                  stroke={isSelected ? '#60a5fa' : rect.stroke}
                  strokeWidth={isSelected ? (rect.strokeWidth || 2) + 2 : rect.strokeWidth || 2}
                  opacity={rect.opacity ?? 1}
                  transform={transform}
                />
              )
            }

            case 'ellipse': {
              const ell = elem as EllipseElement
              return (
                <ellipse
                  key={ell.id}
                  cx={ell.x + ell.width / 2}
                  cy={ell.y + ell.height / 2}
                  rx={ell.width / 2}
                  ry={ell.height / 2}
                  fill={ell.fill}
                  stroke={isSelected ? '#60a5fa' : ell.stroke}
                  strokeWidth={isSelected ? (ell.strokeWidth || 2) + 2 : ell.strokeWidth || 2}
                  opacity={ell.opacity ?? 1}
                  transform={transform}
                />
              )
            }

            case 'text': {
              const textElem = elem as TextElement
              const textX =
                textElem.align === 'center'
                  ? textElem.x + textElem.width / 2
                  : textElem.align === 'right'
                  ? textElem.x + textElem.width
                  : textElem.x
              const textAnchor =
                textElem.align === 'center' ? 'middle' : textElem.align === 'right' ? 'end' : 'start'

              return (
                <g key={textElem.id} transform={transform} onDoubleClick={() => handleDoubleClick(textElem)}>
                  {isSelected && (
                    <rect
                      x={textElem.x - 4}
                      y={textElem.y - 4}
                      width={textElem.width + 8}
                      height={textElem.height + 8}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                  )}
                  <text
                    x={textX}
                    y={textElem.y + textElem.fontSize}
                    fill={textElem.fill}
                    fontSize={textElem.fontSize}
                    fontFamily={textElem.fontFamily}
                    textAnchor={textAnchor}
                    opacity={textElem.opacity ?? 1}
                    className="select-none"
                  >
                    {textElem.text}
                  </text>
                </g>
              )
            }

            case 'sticky': {
              const sticky = elem as StickyNoteElement
              const textLines = (sticky.text || '').split('\n')
              const fontSize = sticky.fontSize || 14
              const lineHeight = fontSize * 1.35

              return (
                <g
                  key={sticky.id}
                  transform={transform}
                  onDoubleClick={() => handleDoubleClick(sticky)}
                  className="cursor-pointer"
                >
                  <rect
                    x={sticky.x}
                    y={sticky.y}
                    width={sticky.width}
                    height={sticky.height}
                    rx={8}
                    ry={8}
                    fill={sticky.color}
                    stroke={isSelected ? '#60a5fa' : 'transparent'}
                    strokeWidth={isSelected ? 3 : 0}
                    filter="url(#canvas-sticky-shadow)"
                  />
                  {/* Sticky Header Pin Bar */}
                  <rect
                    x={sticky.x}
                    y={sticky.y}
                    width={sticky.width}
                    height={18}
                    rx={8}
                    fill="rgba(0,0,0,0.06)"
                  />
                  {sticky.author && (
                    <text
                      x={sticky.x + 8}
                      y={sticky.y + 13}
                      fontSize="9"
                      fontWeight="bold"
                      fill="rgba(0,0,0,0.4)"
                    >
                      {sticky.author}
                    </text>
                  )}
                  <text
                    fontSize={fontSize}
                    fontFamily="sans-serif"
                    fill="#1e293b"
                    className="select-none"
                  >
                    {textLines.map((line, idx) => (
                      <tspan key={idx} x={sticky.x + 10} y={sticky.y + 36 + idx * lineHeight}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              )
            }

            case 'arrow':
            case 'connector': {
              const arrow = elem as ArrowConnectorElement
              const { path } = calculateConnectorPath(arrow.startPoint, arrow.endPoint, arrow.style)
              return (
                <g key={arrow.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isSelected ? '#60a5fa' : arrow.stroke}
                    strokeWidth={isSelected ? arrow.strokeWidth + 2 : arrow.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd="url(#canvas-arrowhead)"
                  />
                </g>
              )
            }

            default:
              return null
          }
        })}

        {/* Selection Bounding Box Overlay */}
        {selectedElements.length > 0 && (
          <rect
            x={selectionCombinedBox.minX - 4}
            y={selectionCombinedBox.minY - 4}
            width={selectionCombinedBox.width + 8}
            height={selectionCombinedBox.height + 8}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {/* Live Rubber-Band Selection Box */}
        {isInteracting && interactionType === 'selectBox' && (
          <rect
            x={Math.min(dragStartPoint.x, currentMousePoint.x)}
            y={Math.min(dragStartPoint.y, currentMousePoint.y)}
            width={Math.abs(currentMousePoint.x - dragStartPoint.x)}
            height={Math.abs(currentMousePoint.y - dragStartPoint.y)}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Shape Creation Preview */}
        {isInteracting && interactionType === 'createShape' && (
          <rect
            x={Math.min(dragStartPoint.x, currentMousePoint.x)}
            y={Math.min(dragStartPoint.y, currentMousePoint.y)}
            width={Math.max(10, Math.abs(currentMousePoint.x - dragStartPoint.x))}
            height={Math.max(10, Math.abs(currentMousePoint.y - dragStartPoint.y))}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#60a5fa"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
        )}
      </svg>

      {/* Remote User Cursors Overlay */}
      {remotePresences.map((user) => {
        if (!user.cursor) return null
        const screenX = user.cursor.x * zoom + pan.x
        const screenY = user.cursor.y * zoom + pan.y

        return (
          <div
            key={user.id}
            className="absolute pointer-events-none transition-transform duration-75 flex items-start gap-1 z-20"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5.65 2.14a1 1 0 0 1 1.34-.37l13 7.5a1 1 0 0 1 .1 1.67l-5.6 4.3 3.6 6.2a1 1 0 1 1-1.73 1l-3.6-6.2-4.9 3.8a1 1 0 0 1-1.61-.79V2.14z"
                fill={user.color || '#3b82f6'}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </svg>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow text-white whitespace-nowrap"
              style={{ backgroundColor: user.color || '#3b82f6' }}
            >
              {user.name || 'Collaborator'}
            </span>
          </div>
        )
      })}

      {/* Inline Text Editor for Text & Sticky Notes */}
      {editingTextId && (() => {
        const editingElem = elements.find((e) => e.id === editingTextId)
        const posX = editingElem ? editingElem.x * zoom + pan.x : currentMousePoint.x * zoom + pan.x
        const posY = editingElem ? editingElem.y * zoom + pan.y : currentMousePoint.y * zoom + pan.y
        return (
          <div
            className="absolute z-40 bg-slate-900 border border-blue-500 rounded-lg p-2 shadow-2xl"
            style={{
              left: `${posX}px`,
              top: `${posY}px`
            }}
          >
            <textarea
              autoFocus
              rows={3}
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={handleFinishTextEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleFinishTextEdit()
                }
              }}
              className="bg-transparent text-slate-100 text-xs font-sans outline-none w-48 resize-none"
              placeholder="Type text..."
            />
            <div className="text-[10px] text-slate-400 text-right">Ctrl+Enter to save</div>
          </div>
        )
      })()}

      {/* Zoom / Pan Controls Overlay */}
      <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl p-1 flex items-center gap-1 shadow-lg text-xs font-semibold text-slate-300 z-20">
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
          className="px-2 py-1 hover:bg-slate-700 rounded-lg transition-colors"
          title="Zoom out"
        >
          -
        </button>
        <span className="px-2">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
          className="px-2 py-1 hover:bg-slate-700 rounded-lg transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
          className="px-2 py-1 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors text-[11px]"
          title="Reset View"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
