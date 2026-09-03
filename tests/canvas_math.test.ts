import { describe, it, expect } from 'vitest'
import {
  clamp,
  degreesToRadians,
  radiansToDegrees,
  rotatePoint,
  distanceBetween,
  distanceToSegment,
  getCurvedControlPoints,
  getOrthogonalPoints,
  calculateConnectorPath,
  getConnectorPoints,
  getAnchorPosition,
  getBoundingBox,
  isPointInElement,
  getElementsInSelection,
  getCombinedBoundingBox
} from '../src/utils/canvasMath'
import {
  ArrowConnectorElement,
  CanvasElement,
  EllipseElement,
  RectangleElement,
  StickyNoteElement,
  TextElement
} from '../src/types'

describe('Canvas Math & Geometry Utilities', () => {
  describe('Basic math and conversion helpers', () => {
    it('clamps numbers within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('converts degrees to radians and back', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI)
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2)
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180)
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90)
    })

    it('rotates a point around a center correctly', () => {
      const center = { x: 100, y: 100 }
      const point = { x: 150, y: 100 } // 50px right

      // Rotate 90 degrees clockwise -> should be 50px down (100, 150)
      const rotated90 = rotatePoint(point, center, 90)
      expect(rotated90.x).toBeCloseTo(100)
      expect(rotated90.y).toBeCloseTo(150)

      // Rotate 180 degrees -> should be 50px left (50, 100)
      const rotated180 = rotatePoint(point, center, 180)
      expect(rotated180.x).toBeCloseTo(50)
      expect(rotated180.y).toBeCloseTo(100)

      // Rotate 0 degrees -> unchanged
      const rotated0 = rotatePoint(point, center, 0)
      expect(rotated0.x).toBe(150)
      expect(rotated0.y).toBe(100)
    })

    it('calculates Euclidean distance between points', () => {
      expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
      expect(distanceBetween({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0)
    })

    it('calculates perpendicular distance from point to segment', () => {
      const a = { x: 0, y: 0 }
      const b = { x: 100, y: 0 }

      // Point directly above middle of segment
      expect(distanceToSegment({ x: 50, y: 20 }, a, b)).toBe(20)

      // Point beyond end of segment (closest to b)
      expect(distanceToSegment({ x: 130, y: 40 }, a, b)).toBe(50)

      // Point before start of segment (closest to a)
      expect(distanceToSegment({ x: -30, y: 40 }, a, b)).toBe(50)

      // Degenerate segment (a === b)
      expect(distanceToSegment({ x: 10, y: 10 }, a, a)).toBeCloseTo(14.142, 2)
    })
  })

  describe('Connector path calculations', () => {
    const start = { x: 0, y: 0 }
    const end = { x: 200, y: 100 }

    it('calculates straight connector path', () => {
      const result = calculateConnectorPath(start, end, 'straight')
      expect(result.path).toBe('M 0 0 L 200 100')
      expect(result.controlPoints).toHaveLength(0)
    })

    it('calculates curved cubic bezier path', () => {
      const result = calculateConnectorPath(start, end, 'curved')
      expect(result.path).toContain('M 0 0 C')
      expect(result.path).toContain('200 100')
      expect(result.controlPoints).toHaveLength(2)
    })

    it('calculates orthogonal Manhattan path', () => {
      const result = calculateConnectorPath(start, end, 'orthogonal')
      expect(result.path).toBe('M 0 0 L 100 0 L 100 100 L 200 100')
      expect(result.controlPoints).toHaveLength(2)
    })
  })

  describe('Connector anchors', () => {
    const rect: RectangleElement = {
      id: 'r1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 0,
      updatedAt: 0
    }

    it('generates 5 anchor points for an unrotated element', () => {
      const anchors = getConnectorPoints(rect)
      expect(anchors).toHaveLength(5)

      const top = anchors.find((a) => a.anchor === 'top')
      expect(top).toEqual({ x: 200, y: 100, anchor: 'top' })

      const bottom = anchors.find((a) => a.anchor === 'bottom')
      expect(bottom).toEqual({ x: 200, y: 200, anchor: 'bottom' })

      const left = anchors.find((a) => a.anchor === 'left')
      expect(left).toEqual({ x: 100, y: 150, anchor: 'left' })

      const right = anchors.find((a) => a.anchor === 'right')
      expect(right).toEqual({ x: 300, y: 150, anchor: 'right' })

      const center = anchors.find((a) => a.anchor === 'center')
      expect(center).toEqual({ x: 200, y: 150, anchor: 'center' })
    })

    it('rotates anchor points when element has rotation', () => {
      const rotatedRect: RectangleElement = {
        ...rect,
        rotation: 90
      }
      const anchors = getConnectorPoints(rotatedRect)
      const top = anchors.find((a) => a.anchor === 'top')
      // Center is (200, 150). Top was (200, 100). Rotated 90 deg -> (250, 150)
      expect(top?.x).toBeCloseTo(250)
      expect(top?.y).toBeCloseTo(150)
    })

    it('gets specific anchor position with getAnchorPosition', () => {
      const pos = getAnchorPosition(rect, 'right')
      expect(pos).toEqual({ x: 300, y: 150 })
    })
  })

  describe('Bounding box calculations', () => {
    it('calculates bounding box for standard rectangle', () => {
      const rect: RectangleElement = {
        id: 'r1',
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 80,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 4,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(rect)
      expect(bb.minX).toBe(48) // 50 - 4/2
      expect(bb.minY).toBe(48) // 50 - 4/2
      expect(bb.maxX).toBe(152) // 50 + 100 + 4/2
      expect(bb.maxY).toBe(132) // 50 + 80 + 4/2
      expect(bb.width).toBe(104)
      expect(bb.height).toBe(84)
    })

    it('calculates bounding box for rotated rectangle', () => {
      const square: RectangleElement = {
        id: 'sq',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 45,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 0,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(square)
      // Diagonal of 100x100 is ~141.42
      expect(bb.width).toBeCloseTo(141.42, 1)
      expect(bb.height).toBeCloseTo(141.42, 1)
    })

    it('calculates bounding box for ellipse', () => {
      const ell: EllipseElement = {
        id: 'e1',
        type: 'ellipse',
        x: 20,
        y: 30,
        width: 80,
        height: 60,
        fill: '#10b981',
        stroke: '#047857',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(ell)
      expect(bb.minX).toBe(19)
      expect(bb.maxX).toBe(101)
      expect(bb.minY).toBe(29)
      expect(bb.maxY).toBe(91)
    })

    it('calculates bounding box for text element', () => {
      const txt: TextElement = {
        id: 't1',
        type: 'text',
        x: 10,
        y: 10,
        width: 120,
        height: 30,
        text: 'Hello SyncStack',
        fontSize: 16,
        fontFamily: 'sans-serif',
        fill: '#ffffff',
        align: 'left',
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(txt)
      expect(bb.minX).toBe(10)
      expect(bb.maxX).toBe(130)
      expect(bb.minY).toBe(10)
      expect(bb.maxY).toBe(40)
    })

    it('calculates bounding box for sticky note', () => {
      const sticky: StickyNoteElement = {
        id: 's1',
        type: 'sticky',
        x: 50,
        y: 50,
        width: 150,
        height: 150,
        text: 'Note Content',
        color: '#fef08a',
        fontSize: 14,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(sticky)
      expect(bb.minX).toBe(50)
      expect(bb.maxX).toBe(200)
      expect(bb.width).toBe(150)
      expect(bb.height).toBe(150)
    })

    it('calculates bounding box for straight arrow', () => {
      const arrow: ArrowConnectorElement = {
        id: 'a1',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startPoint: { x: 10, y: 10 },
        endPoint: { x: 110, y: 80 },
        style: 'straight',
        stroke: '#94a3b8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(arrow)
      expect(bb.minX).toBeLessThanOrEqual(10)
      expect(bb.maxX).toBeGreaterThanOrEqual(110)
      expect(bb.minY).toBeLessThanOrEqual(10)
      expect(bb.maxY).toBeGreaterThanOrEqual(80)
    })

    it('calculates combined bounding box for multiple elements', () => {
      const e1: RectangleElement = {
        id: '1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 0,
        createdAt: 0,
        updatedAt: 0
      }
      const e2: RectangleElement = {
        id: '2',
        type: 'rectangle',
        x: 100,
        y: 80,
        width: 60,
        height: 40,
        fill: '#10b981',
        stroke: '#047857',
        strokeWidth: 0,
        createdAt: 0,
        updatedAt: 0
      }
      const combined = getCombinedBoundingBox([e1, e2])
      expect(combined.minX).toBe(10)
      expect(combined.minY).toBe(10)
      expect(combined.maxX).toBe(160)
      expect(combined.maxY).toBe(120)
      expect(combined.width).toBe(150)
      expect(combined.height).toBe(110)
    })

    it('returns empty bounding box for empty list', () => {
      const combined = getCombinedBoundingBox([])
      expect(combined).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 })
    })
  })

  describe('Hit testing with isPointInElement', () => {
    const rect: RectangleElement = {
      id: 'r1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 2,
      createdAt: 0,
      updatedAt: 0
    }

    it('detects hits inside rectangle', () => {
      expect(isPointInElement({ x: 150, y: 150 }, rect)).toBe(true)
      expect(isPointInElement({ x: 101, y: 101 }, rect)).toBe(true)
    })

    it('detects misses outside rectangle', () => {
      expect(isPointInElement({ x: 50, y: 50 }, rect)).toBe(false)
      expect(isPointInElement({ x: 250, y: 250 }, rect)).toBe(false)
    })

    it('respects hit tolerance near edge', () => {
      expect(isPointInElement({ x: 96, y: 150 }, rect, 6)).toBe(true)
      expect(isPointInElement({ x: 80, y: 150 }, rect, 6)).toBe(false)
    })

    it('hit tests rotated rectangle correctly', () => {
      const rotated: RectangleElement = {
        ...rect,
        rotation: 45
      }
      // Center (150, 150) should hit
      expect(isPointInElement({ x: 150, y: 150 }, rotated)).toBe(true)

      // Top corner of 45-deg diamond is at (150, 150 - 50*sqrt(2)) ~= (150, 79.29)
      expect(isPointInElement({ x: 150, y: 82 }, rotated)).toBe(true)

      // Corner of unrotated box (102, 102) is outside the diamond
      expect(isPointInElement({ x: 102, y: 102 }, rotated, 0)).toBe(false)
    })

    it('hit tests ellipse correctly', () => {
      const ell: EllipseElement = {
        id: 'e1',
        type: 'ellipse',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        fill: '#10b981',
        stroke: '#047857',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      // Center (150, 150) -> Hit
      expect(isPointInElement({ x: 150, y: 150 }, ell)).toBe(true)

      // (102, 102) is inside bounding box but outside circle radius (r = 50)
      expect(isPointInElement({ x: 102, y: 102 }, ell, 0)).toBe(false)
    })

    it('hit tests straight arrow correctly', () => {
      const arrow: ArrowConnectorElement = {
        id: 'a1',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 100 },
        style: 'straight',
        stroke: '#94a3b8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      // Midpoint (50, 50) -> Hit
      expect(isPointInElement({ x: 50, y: 50 }, arrow, 4)).toBe(true)
      // Far point (50, 80) -> Miss
      expect(isPointInElement({ x: 50, y: 80 }, arrow, 4)).toBe(false)
    })
  })

  describe('Selection Box matching with getElementsInSelection', () => {
    const e1: RectangleElement = {
      id: '1',
      type: 'rectangle',
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: '#3b82f6',
      stroke: '#1d4ed8',
      strokeWidth: 0,
      createdAt: 0,
      updatedAt: 0
    }
    const e2: RectangleElement = {
      id: '2',
      type: 'rectangle',
      x: 200,
      y: 200,
      width: 50,
      height: 50,
      fill: '#10b981',
      stroke: '#047857',
      strokeWidth: 0,
      createdAt: 0,
      updatedAt: 0
    }

    it('selects elements intersecting the selection box', () => {
      const selection = { x: 0, y: 0, width: 120, height: 120 }
      const matched = getElementsInSelection([e1, e2], selection)
      expect(matched.map((m) => m.id)).toEqual(['1'])
    })

    it('handles inverted selection box (dragged backwards)', () => {
      const invertedSelection = { x: 260, y: 260, width: -100, height: -100 }
      const matched = getElementsInSelection([e1, e2], invertedSelection)
      expect(matched.map((m) => m.id)).toEqual(['2'])
    })

    it('returns all elements when box encompasses all', () => {
      const bigBox = { x: 0, y: 0, width: 500, height: 500 }
      const matched = getElementsInSelection([e1, e2], bigBox)
      expect(matched).toHaveLength(2)
    })

    it('returns empty array when selection box matches no elements', () => {
      const emptyBox = { x: 1000, y: 1000, width: 100, height: 100 }
      const matched = getElementsInSelection([e1, e2], emptyBox)
      expect(matched).toHaveLength(0)
    })

    it('handles zero-dimension selection box (point selection)', () => {
      const pointBox = { x: 60, y: 60, width: 0, height: 0 }
      const matched = getElementsInSelection([e1, e2], pointBox)
      expect(matched.map((m) => m.id)).toEqual(['1'])
    })
  })

  describe('Edge Case Invariant Tests', () => {
    it('hit tests curved connectors along the bezier path', () => {
      const curvedArrow: ArrowConnectorElement = {
        id: 'ca1',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 200, y: 200 },
        style: 'curved',
        stroke: '#94a3b8',
        strokeWidth: 4,
        createdAt: 0,
        updatedAt: 0
      }

      // Start point and end point should hit
      expect(isPointInElement({ x: 0, y: 0 }, curvedArrow, 6)).toBe(true)
      expect(isPointInElement({ x: 200, y: 200 }, curvedArrow, 6)).toBe(true)

      // Far away point should miss
      expect(isPointInElement({ x: 0, y: 200 }, curvedArrow, 6)).toBe(false)
    })

    it('hit tests orthogonal connectors along rectilinear segments', () => {
      const orthConnector: ArrowConnectorElement = {
        id: 'oc1',
        type: 'connector',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 100 },
        style: 'orthogonal',
        stroke: '#94a3b8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }

      // Points along the Manhattan route (0,0) -> (50,0) -> (50,100) -> (100,100)
      expect(isPointInElement({ x: 25, y: 0 }, orthConnector, 4)).toBe(true)
      expect(isPointInElement({ x: 50, y: 50 }, orthConnector, 4)).toBe(true)
      expect(isPointInElement({ x: 75, y: 100 }, orthConnector, 4)).toBe(true)

      // Point outside the orthogonal routing
      expect(isPointInElement({ x: 10, y: 80 }, orthConnector, 4)).toBe(false)
    })

    it('hit tests rotated text elements', () => {
      const textElem: TextElement = {
        id: 'txt-rot',
        type: 'text',
        x: 100,
        y: 100,
        width: 80,
        height: 30,
        text: 'Sample',
        fontSize: 16,
        fontFamily: 'sans-serif',
        fill: '#ffffff',
        align: 'left',
        rotation: 90,
        createdAt: 0,
        updatedAt: 0
      }
      // Center (140, 115) should hit
      expect(isPointInElement({ x: 140, y: 115 }, textElem)).toBe(true)
    })

    it('hit tests sticky notes with rotation', () => {
      const sticky: StickyNoteElement = {
        id: 'stk-rot',
        type: 'sticky',
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        text: 'Note',
        color: '#fef08a',
        fontSize: 14,
        rotation: 180,
        createdAt: 0,
        updatedAt: 0
      }
      expect(isPointInElement({ x: 250, y: 250 }, sticky)).toBe(true)
      expect(isPointInElement({ x: 100, y: 100 }, sticky)).toBe(false)
    })

    it('calculates bounding box for 270-degree rotated rectangle', () => {
      const rect: RectangleElement = {
        id: 'r-270',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        rotation: 270,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 0,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(rect)
      expect(bb.width).toBeCloseTo(100, 1)
      expect(bb.height).toBeCloseTo(200, 1)
    })

    it('handles negative coordinates properly in getBoundingBox and distance helpers', () => {
      const rect: RectangleElement = {
        id: 'neg-rect',
        type: 'rectangle',
        x: -200,
        y: -150,
        width: 100,
        height: 80,
        fill: '#3b82f6',
        stroke: '#1d4ed8',
        strokeWidth: 2,
        createdAt: 0,
        updatedAt: 0
      }
      const bb = getBoundingBox(rect)
      expect(bb.minX).toBe(-201)
      expect(bb.minY).toBe(-151)
      expect(bb.maxX).toBe(-99)
      expect(bb.maxY).toBe(-69)
      expect(bb.width).toBe(102)
      expect(bb.height).toBe(82)

      expect(isPointInElement({ x: -150, y: -110 }, rect)).toBe(true)
      expect(isPointInElement({ x: 0, y: 0 }, rect)).toBe(false)
    })
  })
})
