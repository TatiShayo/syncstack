import React from 'react'
import {
  MousePointer,
  Hand,
  Square,
  Circle,
  Type,
  StickyNote,
  ArrowUpRight,
  GitCommit,
  Trash2,
  BringToFront,
  SendToBack,
  Palette
} from 'lucide-react'
import { ActiveTool, CanvasElement } from '../types'

interface Props {
  activeTool: ActiveTool
  onSelectTool: (tool: ActiveTool) => void
  selectedElements: CanvasElement[]
  onUpdateSelected: (updates: Partial<CanvasElement>) => void
  onDeleteSelected: () => void
  onBringToFront: () => void
  onSendToBack: () => void
}

const FILL_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#64748b', // Slate
  'transparent'
]

const STICKY_COLORS = [
  '#fef08a', // Yellow
  '#bbf7d0', // Green
  '#bfdbfe', // Blue
  '#fbcfe8', // Pink
  '#fed7aa', // Orange
  '#ddd6fe'  // Purple
]

export const Toolbar: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  selectedElements,
  onUpdateSelected,
  onDeleteSelected,
  onBringToFront,
  onSendToBack
}) => {
  const isSingle = selectedElements.length === 1
  const firstElem = selectedElements[0]

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1.5 z-30 transition-all">
      {/* Primary Tool Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSelectTool('select')}
          title="Select tool (V)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'select'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <MousePointer size={16} />
        </button>

        <button
          onClick={() => onSelectTool('pan')}
          title="Pan tool (H)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'pan'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <Hand size={16} />
        </button>

        <div className="w-px h-6 bg-slate-700/80 mx-1" />

        <button
          onClick={() => onSelectTool('rectangle')}
          title="Rectangle (R)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'rectangle'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <Square size={16} />
        </button>

        <button
          onClick={() => onSelectTool('ellipse')}
          title="Ellipse (O)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'ellipse'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <Circle size={16} />
        </button>

        <button
          onClick={() => onSelectTool('text')}
          title="Text (T)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'text'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <Type size={16} />
        </button>

        <button
          onClick={() => onSelectTool('sticky')}
          title="Sticky Note (S)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'sticky'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <StickyNote size={16} />
        </button>

        <button
          onClick={() => onSelectTool('arrow')}
          title="Arrow (A)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'arrow'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <ArrowUpRight size={16} />
        </button>

        <button
          onClick={() => onSelectTool('connector')}
          title="Connector (C)"
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
            activeTool === 'connector'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
          }`}
        >
          <GitCommit size={16} />
        </button>
      </div>

      {/* Selected Element Quick Style Controls */}
      {selectedElements.length > 0 && (
        <>
          <div className="w-px h-6 bg-slate-700/80 mx-1" />

          <div className="flex items-center gap-1.5">
            {/* Fill or Sticky Color presets */}
            {firstElem.type === 'sticky' ? (
              <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl">
                {STICKY_COLORS.map((col) => (
                  <button
                    key={col}
                    onClick={() => onUpdateSelected({ color: col } as any)}
                    className="w-4 h-4 rounded-full border border-slate-700 hover:scale-110 transition-transform"
                    style={{ backgroundColor: col }}
                    title={`Set color: ${col}`}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl">
                <Palette size={13} className="text-slate-400 ml-1" />
                {FILL_COLORS.slice(0, 5).map((col) => (
                  <button
                    key={col}
                    onClick={() => onUpdateSelected({ fill: col } as any)}
                    className="w-4 h-4 rounded-full border border-slate-700 hover:scale-110 transition-transform"
                    style={{ backgroundColor: col === 'transparent' ? '#1e293b' : col }}
                    title={`Set fill: ${col}`}
                  />
                ))}
              </div>
            )}

            {/* Stroke Width Toggle */}
            {'strokeWidth' in firstElem && (
              <select
                value={(firstElem as any).strokeWidth || 2}
                onChange={(e) => onUpdateSelected({ strokeWidth: Number(e.target.value) } as any)}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg text-xs px-2 py-1 focus:outline-none"
                title="Stroke Width"
              >
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={4}>4px</option>
                <option value={8}>8px</option>
              </select>
            )}

            {/* Font Size Toggle for Text */}
            {firstElem.type === 'text' && (
              <select
                value={(firstElem as any).fontSize || 16}
                onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) } as any)}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg text-xs px-2 py-1 focus:outline-none"
                title="Font Size"
              >
                <option value={12}>12pt</option>
                <option value={16}>16pt</option>
                <option value={20}>20pt</option>
                <option value={28}>28pt</option>
                <option value={36}>36pt</option>
              </select>
            )}

            {/* Layering buttons */}
            <button
              onClick={onBringToFront}
              title="Bring to Front"
              className="p-1.5 hover:bg-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <BringToFront size={14} />
            </button>
            <button
              onClick={onSendToBack}
              title="Send to Back"
              className="p-1.5 hover:bg-slate-700/80 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <SendToBack size={14} />
            </button>

            {/* Delete button */}
            <button
              onClick={onDeleteSelected}
              title="Delete Element(s)"
              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors ml-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
