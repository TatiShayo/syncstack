import { describe, it, expect, vi } from 'vitest'
import { CRDTManager } from '../src/crdt/crdtManager'
import {
  ArrowConnectorElement,
  CanvasElement,
  EllipseElement,
  RectangleElement,
  StickyNoteElement,
  TextElement
} from '../src/types'
import {
  escapeXml,
  exportToJson,
  exportToSvg,
  exportToPng,
  downloadPng,
  downloadFile
} from '../src/utils/exportUtils'
import { importFromJson } from '../src/utils/importUtils'

describe('Document Export and Import Engine', () => {
  describe('SVG Exporter', () => {
    it('escapes XML special characters to prevent malformed markup / injection', () => {
      expect(escapeXml('<script>alert("xss") & \'test\'</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;) &amp; &apos;test&apos;&lt;/script&gt;'
      )
    })

    it('exports empty canvas with placeholder text', () => {
      const svg = exportToSvg([])
      expect(svg).toContain('<svg')
      expect(svg).toContain('No elements on canvas')
      expect(svg).toContain('</svg>')
    })

    it('exports diverse canvas elements into standards-compliant SVG', () => {
      const elements: CanvasElement[] = [
        {
          id: 'r1',
          type: 'rectangle',
          x: 50,
          y: 60,
          width: 120,
          height: 80,
          fill: '#3b82f6',
          stroke: '#1d4ed8',
          strokeWidth: 2,
          cornerRadius: 8,
          rotation: 45,
          createdAt: 1,
          updatedAt: 1
        } as RectangleElement,
        {
          id: 'e1',
          type: 'ellipse',
          x: 200,
          y: 100,
          width: 80,
          height: 80,
          fill: '#10b981',
          stroke: '#047857',
          strokeWidth: 2,
          createdAt: 2,
          updatedAt: 2
        } as EllipseElement,
        {
          id: 't1',
          type: 'text',
          x: 100,
          y: 200,
          width: 150,
          height: 30,
          text: 'Hello <World> & SyncStack',
          fontSize: 16,
          fontFamily: 'sans-serif',
          fill: '#f8fafc',
          align: 'center',
          createdAt: 3,
          updatedAt: 3
        } as TextElement,
        {
          id: 's1',
          type: 'sticky',
          x: 300,
          y: 200,
          width: 140,
          height: 140,
          text: 'Sticky\nNote\nLine 3',
          color: '#fef08a',
          fontSize: 14,
          author: 'Alice',
          createdAt: 4,
          updatedAt: 4
        } as StickyNoteElement,
        {
          id: 'a1',
          type: 'arrow',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          startPoint: { x: 10, y: 10 },
          endPoint: { x: 100, y: 100 },
          style: 'straight',
          stroke: '#94a3b8',
          strokeWidth: 2,
          arrowHeadEnd: 'arrow',
          createdAt: 5,
          updatedAt: 5
        } as ArrowConnectorElement
      ]

      const svg = exportToSvg(elements)

      expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(svg).toContain('<svg')
      expect(svg).toContain('<rect')
      expect(svg).toContain('rx="8"')
      expect(svg).toContain('transform="rotate(45')
      expect(svg).toContain('<ellipse')
      expect(svg).toContain('<text')
      expect(svg).toContain('Hello &lt;World&gt; &amp; SyncStack')
      expect(svg).toContain('<marker id="arrowhead"')
      expect(svg).toContain('<path')
      expect(svg).toContain('marker-end="url(#arrowhead)"')
      expect(svg).toContain('</svg>')
    })
  })

  describe('PNG Exporter & File Download Helpers', () => {
    it('exports elements to raster PNG representation', async () => {
      const rect: RectangleElement = {
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      const pngResult = await exportToPng([rect], { scale: 2 })
      expect(typeof pngResult).toBe('string')
      expect(pngResult.length).toBeGreaterThan(0)
    })

    it('handles downloadFile in browser / DOM environment without throwing', () => {
      expect(() => {
        downloadFile('test content', 'test.txt', 'text/plain')
      }).not.toThrow()
    })

    it('handles downloadPng without throwing', async () => {
      const rect: RectangleElement = {
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      await expect(downloadPng([rect], 'board.png')).resolves.not.toThrow()
    })
  })

  describe('JSON Snapshot Exporter and Importer', () => {
    it('exports snapshot to valid JSON string', () => {
      const manager = new CRDTManager()
      manager.createElement({
        id: 'rect-1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 100,
        updatedAt: 100
      })
      manager.createCard('Card A', 'Desc A', 'Alice', 'todo')

      const snapshot = manager.exportSnapshot('board-test')
      const json = exportToJson(snapshot)

      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(parsed.schemaVersion).toBe(1)
      expect(parsed.boardId).toBe('board-test')
      expect(parsed.elements).toHaveLength(1)
      expect(Object.keys(parsed.cards)).toHaveLength(1)
      expect(parsed.columns.todo).toHaveLength(1)
    })

    it('rejects invalid or corrupted JSON on import', () => {
      const res1 = importFromJson('not-valid-json { [')
      expect(res1.success).toBe(false)
      expect(res1.error).toContain('Invalid JSON format')

      const res2 = importFromJson('12345')
      expect(res2.success).toBe(false)
      expect(res2.error).toBe('Root snapshot must be a valid JSON object')

      const res3 = importFromJson(JSON.stringify({ schemaVersion: 0 }))
      expect(res3.success).toBe(false)
      expect(res3.error).toBe('Invalid or unsupported schemaVersion')
    })

    it('sanitizes imported elements and cards', () => {
      const dirtySnapshot = {
        schemaVersion: 1,
        boardId: 'dirty-board',
        elements: [
          {
            id: 'e1',
            type: 'rectangle',
            x: 'invalid-number',
            y: 50,
            width: -20, // negative width
            height: 100,
            fill: '#3b82f6',
            stroke: '#1d4ed8'
          },
          {
            id: 'invalid-type-elem',
            type: 'malicious-script-tag'
          }
        ],
        cards: {
          'c-1': {
            id: 'c-1',
            title: 'Card with long text ' + 'x'.repeat(200),
            description: 'Desc',
            assignee: 'Alice'
          }
        },
        columns: {
          todo: ['c-1'],
          'in-progress': [],
          done: []
        }
      }

      const res = importFromJson(JSON.stringify(dirtySnapshot))
      expect(res.success).toBe(true)
      expect(res.snapshot).toBeDefined()

      // Invalid element type should be filtered out
      expect(res.snapshot?.elements).toHaveLength(1)
      const sanitizedRect = res.snapshot?.elements[0] as RectangleElement
      expect(sanitizedRect.x).toBe(0) // Default fallback for invalid number
      expect(sanitizedRect.width).toBe(1) // Clamped to min 1
      expect(sanitizedRect.height).toBe(100)

      // Card title should be truncated to 100 chars
      const card = res.snapshot?.cards['c-1']
      expect(card?.title.length).toBeLessThanOrEqual(100)
    })

    it('round-trips full board state through export and import with 100% fidelity', () => {
      const managerA = new CRDTManager()

      // Populate manager A with canvas shapes & kanban cards
      managerA.createElement({
        id: 'rect-rt',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 150,
        height: 90,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        cornerRadius: 6,
        createdAt: 100,
        updatedAt: 100
      })
      managerA.createElement({
        id: 'sticky-rt',
        type: 'sticky',
        x: 300,
        y: 200,
        width: 150,
        height: 150,
        text: 'Roundtrip Note',
        color: '#fef08a',
        fontSize: 14,
        author: 'Tester',
        createdAt: 101,
        updatedAt: 101
      })
      const { cardId } = managerA.createCard('Task RT', 'Details', 'Alice', 'in-progress', 'high')

      // Export snapshot from A
      const snapshotA = managerA.exportSnapshot('board-rt')
      const jsonA = exportToJson(snapshotA)

      // Import snapshot into manager B
      const importResult = importFromJson(jsonA)
      expect(importResult.success).toBe(true)

      const managerB = new CRDTManager()
      managerB.loadSnapshot(importResult.snapshot!)

      // Compare states
      const elementsB = managerB.getElements()
      expect(elementsB).toHaveLength(2)
      expect(managerB.getElement('rect-rt')?.type).toBe('rectangle')
      expect(managerB.getElement('sticky-rt')?.type).toBe('sticky')

      const inProgressCardsB = managerB.getCardsForColumn('in-progress')
      expect(inProgressCardsB).toHaveLength(1)
      expect(inProgressCardsB[0].id).toBe(cardId)
      expect(inProgressCardsB[0].title).toBe('Task RT')
      expect(inProgressCardsB[0].priority).toBe('high')
    })

    it('exports SVG with custom background color and padding options', () => {
      const rect: RectangleElement = {
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      const svg = exportToSvg([rect], { backgroundColor: '#ffffff', padding: 50 })
      expect(svg).toContain('fill="#ffffff"')
      expect(svg).toContain('viewBox="-41 -41 202 202"')
    })

    it('preserves card tags and priority during JSON import and export', () => {
      const manager = new CRDTManager()
      manager.createCard('Tagged Card', 'Description', 'Alice', 'todo', 'high', ['frontend', 'crdt', 'v6'])
      const snapshot = manager.exportSnapshot('test-board')
      const json = exportToJson(snapshot)

      const res = importFromJson(json)
      expect(res.success).toBe(true)
      const importedCard = Object.values(res.snapshot?.cards || {})[0]
      expect(importedCard.priority).toBe('high')
      expect(importedCard.tags).toEqual(['frontend', 'crdt', 'v6'])
    })
  })
})
