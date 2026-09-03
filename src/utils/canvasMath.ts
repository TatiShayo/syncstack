import {
  AnchorPosition,
  AnchorPoint,
  ArrowConnectorElement,
  BoundingBox,
  CanvasElement,
  Point,
  SelectionBox
} from '../types'

/**
 * Clamp a number between min and max bounds
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Rotate a 2D point around a specified center point by angle in degrees
 */
export function rotatePoint(point: Point, center: Point, angleDegrees: number): Point {
  if (!angleDegrees || angleDegrees === 0) return { ...point }
  const rad = degreesToRadians(angleDegrees)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos)
  }
}

/**
 * Euclidean distance between two points
 */
export function distanceBetween(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Perpendicular distance from a point to a line segment [a, b]
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)
  if (l2 === 0) return distanceBetween(p, a)
  
  // Projection factor of point p onto line segment ab
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = clamp(t, 0, 1)
  
  const projection: Point = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y)
  }
  return distanceBetween(p, projection)
}

/**
 * Get control points for curved connector
 */
export function getCurvedControlPoints(start: Point, end: Point): [Point, Point] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const cx1 = start.x + dx * 0.25
  const cy1 = start.y + dy * 0.1
  const cx2 = start.x + dx * 0.75
  const cy2 = start.y + dy * 0.9
  return [{ x: cx1, y: cy1 }, { x: cx2, y: cy2 }]
}

/**
 * Generate orthogonal route points between two points
 */
export function getOrthogonalPoints(start: Point, end: Point): Point[] {
  const midX = (start.x + end.x) / 2
  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end
  ]
}

/**
 * Calculate SVG path string and control points for connectors
 */
export function calculateConnectorPath(
  start: Point,
  end: Point,
  style: 'straight' | 'curved' | 'orthogonal'
): { path: string; controlPoints: Point[] } {
  if (style === 'curved') {
    const [cp1, cp2] = getCurvedControlPoints(start, end)
    const path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`
    return { path, controlPoints: [cp1, cp2] }
  }

  if (style === 'orthogonal') {
    const points = getOrthogonalPoints(start, end)
    const path = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`
    return { path, controlPoints: [points[1], points[2]] }
  }

  // Straight
  const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  return { path, controlPoints: [] }
}

/**
 * Get connector anchor points for an element
 */
export function getConnectorPoints(element: CanvasElement): AnchorPoint[] {
  const { x, y, width, height, rotation = 0 } = element
  const center: Point = { x: x + width / 2, y: y + height / 2 }

  const anchors: { anchor: AnchorPosition; point: Point }[] = [
    { anchor: 'top', point: { x: x + width / 2, y } },
    { anchor: 'bottom', point: { x: x + width / 2, y: y + height } },
    { anchor: 'left', point: { x, y: y + height / 2 } },
    { anchor: 'right', point: { x: x + width, y: y + height / 2 } },
    { anchor: 'center', point: center }
  ]

  return anchors.map(({ anchor, point }) => {
    const rotated = rotatePoint(point, center, rotation)
    return {
      x: rotated.x,
      y: rotated.y,
      anchor
    }
  })
}

/**
 * Get a specific anchor position on an element
 */
export function getAnchorPosition(element: CanvasElement, anchor: AnchorPosition): Point {
  const anchors = getConnectorPoints(element)
  const match = anchors.find((a) => a.anchor === anchor)
  if (match) {
    return { x: match.x, y: match.y }
  }
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}

/**
 * Compute Axis-Aligned Bounding Box (AABB) for any canvas element
 */
export function getBoundingBox(element: CanvasElement): BoundingBox {
  if (element.type === 'arrow' || element.type === 'connector') {
    const arrow = element as ArrowConnectorElement
    const strokeWidth = arrow.strokeWidth || 2
    const padding = Math.max(8, strokeWidth * 2)

    let points: Point[] = [arrow.startPoint, arrow.endPoint]

    if (arrow.style === 'curved') {
      const [cp1, cp2] = getCurvedControlPoints(arrow.startPoint, arrow.endPoint)
      points.push(cp1, cp2)
    } else if (arrow.style === 'orthogonal') {
      const orth = getOrthogonalPoints(arrow.startPoint, arrow.endPoint)
      points = orth
    }

    const minX = Math.min(...points.map((p) => p.x)) - padding
    const minY = Math.min(...points.map((p) => p.y)) - padding
    const maxX = Math.max(...points.map((p) => p.x)) + padding
    const maxY = Math.max(...points.map((p) => p.y)) + padding

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    }
  }

  const { x, y, width, height, rotation = 0 } = element
  const strokeWidth = 'strokeWidth' in element && typeof element.strokeWidth === 'number' ? element.strokeWidth : 0
  const halfStroke = strokeWidth / 2

  if (!rotation || rotation === 0) {
    const minX = x - halfStroke
    const minY = y - halfStroke
    const maxX = x + width + halfStroke
    const maxY = y + height + halfStroke
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    }
  }

  // Rotated element corner coordinates
  const center: Point = { x: x + width / 2, y: y + height / 2 }
  const corners: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]

  const rotatedCorners = corners.map((c) => rotatePoint(c, center, rotation))
  const minX = Math.min(...rotatedCorners.map((p) => p.x)) - halfStroke
  const minY = Math.min(...rotatedCorners.map((p) => p.y)) - halfStroke
  const maxX = Math.max(...rotatedCorners.map((p) => p.x)) + halfStroke
  const maxY = Math.max(...rotatedCorners.map((p) => p.y)) + halfStroke

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}

/**
 * Hit test to determine if a point hits a given canvas element
 */
export function isPointInElement(point: Point, element: CanvasElement, hitTolerance = 6): boolean {
  if (element.type === 'arrow' || element.type === 'connector') {
    const arrow = element as ArrowConnectorElement
    const threshold = (arrow.strokeWidth || 2) / 2 + hitTolerance

    if (arrow.style === 'curved') {
      const [cp1, cp2] = getCurvedControlPoints(arrow.startPoint, arrow.endPoint)
      // Approximate cubic bezier curve with sampled segments
      const STEPS = 20
      let prev = arrow.startPoint
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS
        const it = 1 - t
        const curr: Point = {
          x: it * it * it * arrow.startPoint.x + 3 * it * it * t * cp1.x + 3 * it * t * t * cp2.x + t * t * t * arrow.endPoint.x,
          y: it * it * it * arrow.startPoint.y + 3 * it * it * t * cp1.y + 3 * it * t * t * cp2.y + t * t * t * arrow.endPoint.y
        }
        if (distanceToSegment(point, prev, curr) <= threshold) {
          return true
        }
        prev = curr
      }
      return false
    }

    if (arrow.style === 'orthogonal') {
      const points = getOrthogonalPoints(arrow.startPoint, arrow.endPoint)
      for (let i = 0; i < points.length - 1; i++) {
        if (distanceToSegment(point, points[i], points[i + 1]) <= threshold) {
          return true
        }
      }
      return false
    }

    // Straight arrow/connector
    return distanceToSegment(point, arrow.startPoint, arrow.endPoint) <= threshold
  }

  const { x, y, width, height, rotation = 0 } = element
  const center: Point = { x: x + width / 2, y: y + height / 2 }
  
  // Transform test point into element's local unrotated coordinate space
  const localPoint = rotation ? rotatePoint(point, center, -rotation) : point

  if (element.type === 'ellipse') {
    const rx = width / 2 + hitTolerance
    const ry = height / 2 + hitTolerance
    if (rx <= 0 || ry <= 0) return false
    const dx = localPoint.x - center.x
    const dy = localPoint.y - center.y
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
  }

  // Rectangles, Text, Sticky Notes
  return (
    localPoint.x >= x - hitTolerance &&
    localPoint.x <= x + width + hitTolerance &&
    localPoint.y >= y - hitTolerance &&
    localPoint.y <= y + height + hitTolerance
  )
}

/**
 * Determine which elements intersect or are contained inside a selection box
 */
export function getElementsInSelection(
  elements: CanvasElement[],
  selectionBox: SelectionBox
): CanvasElement[] {
  const normMinX = Math.min(selectionBox.x, selectionBox.x + selectionBox.width)
  const normMaxX = Math.max(selectionBox.x, selectionBox.x + selectionBox.width)
  const normMinY = Math.min(selectionBox.y, selectionBox.y + selectionBox.height)
  const normMaxY = Math.max(selectionBox.y, selectionBox.y + selectionBox.height)

  return elements.filter((elem) => {
    const bb = getBoundingBox(elem)
    // Check if bounding box overlaps selection box
    return !(
      bb.maxX < normMinX ||
      bb.minX > normMaxX ||
      bb.maxY < normMinY ||
      bb.minY > normMaxY
    )
  })
}

/**
 * Get combined bounding box for a set of elements
 */
export function getCombinedBoundingBox(elements: CanvasElement[]): BoundingBox {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const elem of elements) {
    const bb = getBoundingBox(elem)
    minX = Math.min(minX, bb.minX)
    minY = Math.min(minY, bb.minY)
    maxX = Math.max(maxX, bb.maxX)
    maxY = Math.max(maxY, bb.maxY)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}
