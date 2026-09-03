import React from 'react'
import {
  Wifi,
  WifiOff,
  Undo2,
  Redo2,
  Download,
  Users,
  Edit2,
  Layers,
  Trello,
  Columns
} from 'lucide-react'
import { ActiveUser, ViewMode } from '../types'

interface Props {
  boardInput: string
  setBoardInput: (val: string) => void
  tokenInput: string
  setTokenInput: (val: string) => void
  onSwitchBoard: (e: React.FormEvent) => void
  activeBoardId: string
  wsStatus: 'connected' | 'connecting' | 'disconnected'
  pendingChanges: number
  onToggleConnection: () => void
  userName: string
  setUserName: (name: string) => void
  userColor: string
  activeUsers: ActiveUser[]
  viewMode: ViewMode
  onSetViewMode: (mode: ViewMode) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onOpenExportModal: () => void
}

export const Header: React.FC<Props> = ({
  boardInput,
  setBoardInput,
  tokenInput,
  setTokenInput,
  onSwitchBoard,
  activeBoardId,
  wsStatus,
  pendingChanges,
  onToggleConnection,
  userName,
  setUserName,
  userColor,
  activeUsers,
  viewMode,
  onSetViewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExportModal
}) => {
  return (
    <header className="bg-slate-800 border-b border-slate-700 py-2.5 px-6 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-md select-none">
      {/* Brand & View Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 text-white font-black px-2.5 py-1 rounded-lg text-base tracking-wider shadow-sm shadow-blue-500/30">
            SS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                SyncStack
              </h1>
              <span className="text-[10px] bg-slate-700/80 text-blue-300 font-bold px-1.5 py-0.5 rounded">
                v6
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Local-First CRDT Workspace
            </p>
          </div>
        </div>

        {/* View Switcher: Split | Canvas | Kanban */}
        <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700 text-xs">
          <button
            onClick={() => onSetViewMode('both')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              viewMode === 'both'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Split Workspace View"
          >
            <Columns size={13} />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => onSetViewMode('canvas')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              viewMode === 'canvas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Full Whiteboard Canvas"
          >
            <Layers size={13} />
            <span className="hidden sm:inline">Canvas</span>
          </button>
          <button
            onClick={() => onSetViewMode('kanban')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              viewMode === 'kanban'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Full Kanban Board"
          >
            <Trello size={13} />
            <span className="hidden sm:inline">Kanban</span>
          </button>
        </div>
      </div>

      {/* Center Controls: Undo/Redo, Collaborator profile, Active board */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/80">
          <button
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 size={14} />
          </button>
          <button
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* User Presence Editor */}
        <div className="flex items-center gap-2 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-xs">
          <Edit2 size={12} className="text-slate-400 shrink-0" />
          <input
            type="text"
            maxLength={50}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-slate-200 focus:outline-none w-24 placeholder-slate-500"
            placeholder="Username..."
            title="Edit your collaborator display name"
          />
          <div
            className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0"
            style={{ backgroundColor: userColor }}
            title="Your cursor color"
          />
        </div>

        {/* Board Switcher Form */}
        <form
          onSubmit={onSwitchBoard}
          className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-700 text-xs"
        >
          <input
            type="text"
            placeholder="Board ID"
            value={boardInput}
            onChange={(e) => setBoardInput(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 w-20 text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 w-20 text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold px-2.5 py-1 rounded transition-colors"
          >
            Switch
          </button>
        </form>
      </div>

      {/* Right Controls: Presence list, Sync status, Export */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Collaborators Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/40 px-2.5 py-1 rounded-lg border border-slate-800">
          <Users size={12} className="text-slate-400" />
          <span>{activeUsers.length} Online</span>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 text-xs font-semibold">
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
                {pendingChanges > 0 && ` (${pendingChanges})`}
              </span>
            </>
          )}
        </div>

        {/* Connection Toggle */}
        <button
          onClick={onToggleConnection}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
            wsStatus === 'connected'
              ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300'
          }`}
        >
          {wsStatus === 'connected' ? 'Disconnect' : 'Connect'}
        </button>

        {/* Export / Import Button */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-blue-500/20"
        >
          <Download size={13} />
          Export / Backup
        </button>
      </div>
    </header>
  )
}
export default Header
