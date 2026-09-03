import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { Header } from '../src/components/Header'
import { Toolbar } from '../src/components/Toolbar'
import { ExportModal } from '../src/components/ExportModal'
import { KanbanWorkspace } from '../src/components/KanbanWorkspace'
import { CanvasWorkspace } from '../src/components/CanvasWorkspace'
import { RectangleElement } from '../src/types'

describe('React UI Components Suite', () => {
  describe('ErrorBoundary', () => {
    const ProblematicComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test boundary crash')
      }
      return <div>Normal Component Content</div>
    }

    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <ProblematicComponent shouldThrow={false} />
        </ErrorBoundary>
      )
      expect(screen.getByText('Normal Component Content')).toBeInTheDocument()
    })

    it('catches render error and displays recovery fallback UI', () => {
      // Suppress console.error during expected throw
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary fallbackTitle="Custom Error Title">
          <ProblematicComponent shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom Error Title')).toBeInTheDocument()
      expect(screen.getByText(/Test boundary crash/)).toBeInTheDocument()
      expect(screen.getByText('Recover State')).toBeInTheDocument()

      spy.mockRestore()
    })
  })

  describe('Header', () => {
    it('renders header elements and interacts with view switchers', () => {
      const onSetViewMode = vi.fn()
      const onSwitchBoard = vi.fn((e) => e.preventDefault())
      const onUndo = vi.fn()
      const onRedo = vi.fn()
      const onOpenExportModal = vi.fn()
      const onToggleConnection = vi.fn()

      render(
        <Header
          boardInput="board1"
          setBoardInput={vi.fn()}
          tokenInput="token1"
          setTokenInput={vi.fn()}
          onSwitchBoard={onSwitchBoard}
          activeBoardId="board1"
          wsStatus="connected"
          pendingChanges={0}
          onToggleConnection={onToggleConnection}
          userName="Alex"
          setUserName={vi.fn()}
          userColor="#3b82f6"
          activeUsers={[{ id: '1', name: 'Alex', color: '#3b82f6' }]}
          viewMode="both"
          onSetViewMode={onSetViewMode}
          canUndo={true}
          canRedo={false}
          onUndo={onUndo}
          onRedo={onRedo}
          onOpenExportModal={onOpenExportModal}
        />
      )

      expect(screen.getByText('SyncStack')).toBeInTheDocument()
      expect(screen.getByText('Synced')).toBeInTheDocument()

      // Click Canvas View
      fireEvent.click(screen.getByTitle('Full Whiteboard Canvas'))
      expect(onSetViewMode).toHaveBeenCalledWith('canvas')

      // Click Undo
      fireEvent.click(screen.getByTitle('Undo (Ctrl+Z)'))
      expect(onUndo).toHaveBeenCalledTimes(1)

      // Click Export / Backup
      fireEvent.click(screen.getByText('Export / Backup'))
      expect(onOpenExportModal).toHaveBeenCalledTimes(1)
    })
  })

  describe('Toolbar', () => {
    it('renders tool buttons and responds to tool selection', () => {
      const onSelectTool = vi.fn()
      const selectedElem: RectangleElement = {
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 1,
        updatedAt: 1
      }

      render(
        <Toolbar
          activeTool="select"
          onSelectTool={onSelectTool}
          selectedElements={[selectedElem]}
          onUpdateSelected={vi.fn()}
          onDeleteSelected={vi.fn()}
          onBringToFront={vi.fn()}
          onSendToBack={vi.fn()}
        />
      )

      // Select rectangle tool
      fireEvent.click(screen.getByTitle('Rectangle (R)'))
      expect(onSelectTool).toHaveBeenCalledWith('rectangle')

      // Delete button appears when element is selected
      expect(screen.getByTitle('Delete Element(s)')).toBeInTheDocument()
    })
  })

  describe('ExportModal', () => {
    it('renders export modal and handles tab switching', () => {
      const onClose = vi.fn()
      const onImport = vi.fn()

      render(
        <ExportModal
          isOpen={true}
          onClose={onClose}
          boardId="test-board"
          elements={[]}
          cards={{}}
          columns={{ todo: [], 'in-progress': [], done: [] }}
          onImport={onImport}
        />
      )

      expect(screen.getByText('Document Exporter & Importer')).toBeInTheDocument()
      expect(screen.getByText('Vector SVG Export')).toBeInTheDocument()
      expect(screen.getByText('High-Resolution Raster PNG')).toBeInTheDocument()
      expect(screen.getByText('Full JSON Document Snapshot')).toBeInTheDocument()
      expect(screen.getByText('Download .png')).toBeInTheDocument()

      // Switch to Import tab
      fireEvent.click(screen.getByRole('button', { name: 'Import' }))
      expect(screen.getByText('Upload Backup File')).toBeInTheDocument()
    })
  })

  describe('KanbanWorkspace', () => {
    it('renders columns and cards', () => {
      const cards = {
        todo: [{ id: 'c1', title: 'Task One', description: 'Desc 1', assignee: 'Alice', priority: 'high' as const }],
        'in-progress': [],
        done: []
      }

      render(
        <KanbanWorkspace
          cardsByColumn={cards}
          onCreateCard={vi.fn()}
          onUpdateCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onMoveCard={vi.fn()}
        />
      )

      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('Task One')).toBeInTheDocument()
      expect(screen.getByText('Desc 1')).toBeInTheDocument()
    })

    it('opens card creation modal and submits new card', () => {
      const onCreateCard = vi.fn()
      const cards = { todo: [], 'in-progress': [], done: [] }

      render(
        <KanbanWorkspace
          cardsByColumn={cards}
          onCreateCard={onCreateCard}
          onUpdateCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onMoveCard={vi.fn()}
        />
      )

      // Click Add Card on first column
      const addButtons = screen.getAllByText('Add Card')
      fireEvent.click(addButtons[0])

      expect(screen.getByText('Create Kanban Card')).toBeInTheDocument()

      // Fill in title
      const titleInput = screen.getByPlaceholderText('Task title...')
      fireEvent.change(titleInput, { target: { value: 'New Feature Task' } })

      // Fill in description
      const descInput = screen.getByPlaceholderText('Task details...')
      fireEvent.change(descInput, { target: { value: 'Feature description' } })

      // Submit
      fireEvent.click(screen.getByText('Create Card'))
      expect(onCreateCard).toHaveBeenCalledWith(
        'New Feature Task',
        'Feature description',
        '',
        'todo',
        'medium'
      )
    })
  })

  describe('CanvasWorkspace', () => {
    it('renders canvas with elements and remote cursors', () => {
      const elements: RectangleElement[] = [
        {
          id: 'rect-1',
          type: 'rectangle',
          x: 50,
          y: 50,
          width: 100,
          height: 80,
          fill: '#3b82f6',
          stroke: '#1d4ed8',
          strokeWidth: 2,
          createdAt: 1,
          updatedAt: 1
        }
      ]

      const remotePresences = [
        {
          id: 'user-2',
          name: 'Dana',
          color: '#ec4899',
          cursor: { x: 250, y: 150 },
          lastActive: Date.now()
        }
      ]

      render(
        <CanvasWorkspace
          elements={elements}
          remotePresences={remotePresences}
          activeTool="select"
          onSelectTool={vi.fn()}
          onCreateElement={vi.fn()}
          onUpdateElement={vi.fn()}
          onDeleteElement={vi.fn()}
          onDeleteElements={vi.fn()}
          onMoveElements={vi.fn()}
          onBringToFront={vi.fn()}
          onSendToBack={vi.fn()}
          onCursorMove={vi.fn()}
          onSelectionChange={vi.fn()}
          userColor="#3b82f6"
          userName="Alex"
        />
      )

      expect(screen.getByText('Dana')).toBeInTheDocument()
      expect(screen.getByTitle('Rectangle (R)')).toBeInTheDocument()
      expect(screen.getByText('Reset')).toBeInTheDocument()
    })

    it('triggers onUndo and onRedo on keyboard shortcuts', () => {
      const onUndo = vi.fn()
      const onRedo = vi.fn()

      render(
        <CanvasWorkspace
          elements={[]}
          remotePresences={[]}
          activeTool="select"
          onSelectTool={vi.fn()}
          onCreateElement={vi.fn()}
          onUpdateElement={vi.fn()}
          onDeleteElement={vi.fn()}
          onDeleteElements={vi.fn()}
          onMoveElements={vi.fn()}
          onBringToFront={vi.fn()}
          onSendToBack={vi.fn()}
          onCursorMove={vi.fn()}
          onSelectionChange={vi.fn()}
          onUndo={onUndo}
          onRedo={onRedo}
          userColor="#3b82f6"
          userName="Alex"
        />
      )

      // Trigger Ctrl+Z
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
      expect(onUndo).toHaveBeenCalledTimes(1)

      // Trigger Ctrl+Y
      fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
      expect(onRedo).toHaveBeenCalledTimes(1)

      // Trigger Ctrl+Shift+Z
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
      expect(onRedo).toHaveBeenCalledTimes(2)
    })
  })
})
