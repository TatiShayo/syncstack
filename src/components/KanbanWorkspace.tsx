import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  Edit3,
  ArrowRight,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Tag
} from 'lucide-react'
import { CardData } from '../types'

interface Props {
  cardsByColumn: Record<string, CardData[]>
  onCreateCard: (title: string, description: string, assignee: string, columnId: string, priority?: 'low' | 'medium' | 'high') => void
  onUpdateCard: (id: string, title: string, description: string, assignee: string, columnId?: string, priority?: 'low' | 'medium' | 'high') => void
  onDeleteCard: (id: string, columnId: string) => void
  onMoveCard: (cardId: string, sourceColId: string, destColId: string, destIndex: number) => void
}

const COLUMN_CONFIG: { id: string; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-indigo-500' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500' }
]

const PRIORITY_BADGES = {
  low: 'bg-slate-700/60 text-slate-300 border-slate-600/50',
  medium: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  high: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
}

export const KanbanWorkspace: React.FC<Props> = ({
  cardsByColumn,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onMoveCard
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CardData | null>(null)
  const [modalColumn, setModalColumn] = useState('todo')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [validationError, setValidationError] = useState<string | null>(null)

  const openCreateModal = (columnId: string) => {
    setEditingCard(null)
    setModalColumn(columnId)
    setTitle('')
    setDescription('')
    setAssignee('')
    setPriority('medium')
    setValidationError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (card: CardData, columnId: string) => {
    setEditingCard(card)
    setModalColumn(columnId)
    setTitle(card.title)
    setDescription(card.description)
    setAssignee(card.assignee)
    setPriority(card.priority || 'medium')
    setValidationError(null)
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedAssignee = assignee.trim()

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

    if (editingCard) {
      onUpdateCard(editingCard.id, trimmedTitle, trimmedDescription, trimmedAssignee, modalColumn, priority)
    } else {
      onCreateCard(trimmedTitle, trimmedDescription, trimmedAssignee, modalColumn, priority)
    }

    setIsModalOpen(false)
  }

  // HTML5 Drag and drop
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

    const destCards = cardsByColumn[destColId] || []
    onMoveCard(cardId, sourceColId, destColId, destCards.length)
  }

  const handleDropOnCard = (e: React.DragEvent, destColId: string, destIndex: number) => {
    e.stopPropagation()
    e.preventDefault()
    const cardId = e.dataTransfer.getData('text/plain')
    const sourceColId = e.dataTransfer.getData('sourceColId')
    if (!cardId || !sourceColId) return

    onMoveCard(cardId, sourceColId, destColId, destIndex)
  }

  const handleShiftColumn = (cardId: string, currentColId: string, direction: 'left' | 'right') => {
    const colIds = COLUMN_CONFIG.map((c) => c.id)
    const idx = colIds.indexOf(currentColId)
    const nextIdx = direction === 'left' ? idx - 1 : idx + 1
    if (nextIdx >= 0 && nextIdx < colIds.length) {
      const destColId = colIds[nextIdx]
      const destCards = cardsByColumn[destColId] || []
      onMoveCard(cardId, currentColId, destColId, destCards.length)
    }
  }

  const handleShiftPosition = (cardId: string, colId: string, direction: 'up' | 'down') => {
    const cards = cardsByColumn[colId] || []
    const idx = cards.findIndex((c) => c.id === cardId)
    if (idx === -1) return
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1
    if (nextIdx >= 0 && nextIdx < cards.length) {
      onMoveCard(cardId, colId, colId, nextIdx)
    }
  }

  return (
    <div className="w-full h-full p-4 md:p-6 overflow-y-auto bg-slate-900">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto h-full">
        {COLUMN_CONFIG.map((col) => {
          const cards = cardsByColumn[col.id] || []
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col h-full min-h-[480px] shadow-sm"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <h2 className="font-bold text-slate-100 text-sm tracking-wide">{col.label}</h2>
                </div>
                <span className="bg-slate-700/60 text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {cards.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4">
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, col.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnCard(e, col.id, index)}
                    className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className="font-semibold text-slate-100 text-sm leading-snug break-words pr-12">
                        {card.title}
                      </h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-3 bg-slate-800/90 rounded-lg p-0.5">
                        <button
                          onClick={() => openEditModal(card, col.id)}
                          title="Edit Card"
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => onDeleteCard(card.id, col.id)}
                          title="Delete Card"
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {card.description && (
                      <p className="text-xs text-slate-400 mb-3 break-words line-clamp-3">
                        {card.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-700/60 pt-2.5 text-xs">
                      {/* Priority tag & Assignee */}
                      <div className="flex items-center gap-2">
                        {card.priority && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              PRIORITY_BADGES[card.priority]
                            }`}
                          >
                            {card.priority}
                          </span>
                        )}
                        <span className="text-slate-400 text-[11px] truncate max-w-[90px]">
                          {card.assignee || 'Unassigned'}
                        </span>
                      </div>

                      {/* Position Shifting controls */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={col.id === 'todo'}
                          onClick={() => handleShiftColumn(card.id, col.id, 'left')}
                          className="p-1 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400"
                          title="Move column left"
                        >
                          <ArrowLeft size={12} />
                        </button>
                        <button
                          disabled={col.id === 'done'}
                          onClick={() => handleShiftColumn(card.id, col.id, 'right')}
                          className="p-1 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400"
                          title="Move column right"
                        >
                          <ArrowRight size={12} />
                        </button>
                        <button
                          disabled={index === 0}
                          onClick={() => handleShiftPosition(card.id, col.id, 'up')}
                          className="p-1 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400"
                          title="Move up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          disabled={index === cards.length - 1}
                          onClick={() => handleShiftPosition(card.id, col.id, 'down')}
                          className="p-1 hover:bg-slate-700 disabled:opacity-20 rounded text-slate-400"
                          title="Move down"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700/50 rounded-xl p-6 text-slate-500 text-center">
                    <p className="text-xs">No cards yet</p>
                  </div>
                )}
              </div>

              {/* Column Add Card Button */}
              <button
                onClick={() => openCreateModal(col.id)}
                className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all hover:bg-slate-700/30"
              >
                <Plus size={14} />
                Add Card
              </button>
            </div>
          )
        })}
      </div>

      {/* Card Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90">
              <h3 className="font-bold text-slate-100 text-base">
                {editingCard ? 'Edit Kanban Card' : 'Create Kanban Card'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 text-xs">
                {validationError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 font-semibold">
                    {validationError}
                  </div>
                )}

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task details..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Assignee
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder="Name..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Column
                  </label>
                  <select
                    value={modalColumn}
                    onChange={(e) => setModalColumn(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
                  className="px-4 py-2 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-500/20"
                >
                  {editingCard ? 'Save Changes' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
