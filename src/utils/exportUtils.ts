import {
  ArrowConnectorElement,
  CanvasElement,
  EllipseElement,
  RectangleElement,
  StickyNoteElement,
  SyncStackDocumentSnapshot,
  TextElement
} from '../types'
import { calculateConnectorPath, getCombinedBoundingBox } from './canvasMath'

/**
 * Escape XML/SVG special characters to prevent injection/malformed markup
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface SvgExportOptions {
  padding?: number
  backgroundColor?: string
  width?: number
  height?: number
}

/**
 * Export canvas elements to a clean, standards-compliant SVG string
 */
export function exportToSvg(
  elements: CanvasElement[],
  options: SvgExportOptions = {}
): string {
  const padding = options.padding ?? 40
  const backgroundColor = options.backgroundColor ?? '#0f172a'

  if (elements.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="100%" height="100%" fill="${backgroundColor}" />
  <text x="50%" y="50%" fill="#64748b" font-family="sans-serif" font-size="16" text-anchor="middle">No elements on canvas</text>
</svg>`
  }

  const bounds = getCombinedBoundingBox(elements)
  const viewBoxX = bounds.minX - padding
  const viewBoxY = bounds.minY - padding
  const viewBoxWidth = Math.max(100, bounds.width + padding * 2)
  const viewBoxHeight = Math.max(100, bounds.height + padding * 2)

  let svgElements = ''

  for (const elem of elements) {
    const rotation = elem.rotation || 0
    const opacity = elem.opacity !== undefined ? elem.opacity : 1
    const transform =
      rotation !== 0
        ? ` transform="rotate(${rotation} ${elem.x + elem.width / 2} ${elem.y + elem.height / 2})"`
        : ''

    switch (elem.type) {
      case 'rectangle': {
        const rect = elem as RectangleElement
        const rx = rect.cornerRadius ? ` rx="${rect.cornerRadius}" ry="${rect.cornerRadius}"` : ''
        svgElements += `  <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${rect.fill}" stroke="${rect.stroke}" stroke-width="${rect.strokeWidth}" opacity="${opacity}"${rx}${transform} />\n`
        break
      }

      case 'ellipse': {
        const ell = elem as EllipseElement
        const cx = ell.x + ell.width / 2
        const cy = ell.y + ell.height / 2
        const rx = ell.width / 2
        const ry = ell.height / 2
        svgElements += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${ell.fill}" stroke="${ell.stroke}" stroke-width="${ell.strokeWidth}" opacity="${opacity}"${transform} />\n`
        break
      }

      case 'text': {
        const text = elem as TextElement
        const textAnchor =
          text.align === 'center' ? 'middle' : text.align === 'right' ? 'end' : 'start'
        const textX =
          text.align === 'center'
            ? text.x + text.width / 2
            : text.align === 'right'
            ? text.x + text.width
            : text.x
        const textY = text.y + text.fontSize

        svgElements += `  <text x="${textX}" y="${textY}" fill="${text.fill}" font-size="${text.fontSize}" font-family="${escapeXml(
          text.fontFamily || 'sans-serif'
        )}" text-anchor="${textAnchor}" opacity="${opacity}"${transform}>${escapeXml(
          text.text || ''
        )}</text>\n`
        break
      }

      case 'sticky': {
        const sticky = elem as StickyNoteElement
        const textLines = (sticky.text || '').split('\n')
        const fontSize = sticky.fontSize || 14
        const lineHeight = fontSize * 1.3

        let linesMarkup = ''
        textLines.forEach((line, idx) => {
          linesMarkup += `<tspan x="${sticky.x + 12}" y="${sticky.y + 24 + idx * lineHeight}">${escapeXml(
            line
          )}</tspan>`
        })

        svgElements += `  <g opacity="${opacity}"${transform}>
    <rect x="${sticky.x}" y="${sticky.y}" width="${sticky.width}" height="${sticky.height}" rx="6" ry="6" fill="${sticky.color}" filter="url(#sticky-shadow)" />
    <text font-size="${fontSize}" font-family="sans-serif" fill="#1e293b">${linesMarkup}</text>
  </g>\n`
        break
      }

      case 'arrow':
      case 'connector': {
        const arrow = elem as ArrowConnectorElement
        const { path } = calculateConnectorPath(arrow.startPoint, arrow.endPoint, arrow.style)
        const markerEnd =
          arrow.arrowHeadEnd !== 'none' ? ` marker-end="url(#arrowhead)"` : ''
        const markerStart =
          arrow.arrowHeadStart === 'arrow' ? ` marker-start="url(#arrowhead-start)"` : ''

        svgElements += `  <path d="${path}" fill="none" stroke="${arrow.stroke}" stroke-width="${arrow.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${markerStart}${markerEnd} />\n`
        break
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">
  <defs>
    <filter id="sticky-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.25" />
    </filter>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
    <marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
      <polygon points="10 0, 0 3.5, 10 7" fill="#94a3b8" />
    </marker>
  </defs>
  <rect x="${viewBoxX}" y="${viewBoxY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="${backgroundColor}" />
${svgElements}</svg>`
}

/**
 * Export canvas elements to a PNG Data URL or Blob using browser Canvas API
 */
export async function exportToPng(
  elements: CanvasElement[],
  options: SvgExportOptions & { scale?: number } = {}
): Promise<string> {
  const svgString = exportToSvg(elements, options)
  const scale = options.scale ?? 2 // Default 2x for high resolution

  // In Node / jsdom or headless test environments without full canvas rasterization
  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  if (typeof document === 'undefined' || isJsdom || typeof window === 'undefined') {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`
  }

  return new Promise((resolve) => {
    try {
      const img = new Image()
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const fallbackTimer = setTimeout(() => {
        URL.revokeObjectURL(url)
        resolve(`data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`)
      }, 1000)

      img.onload = () => {
        clearTimeout(fallbackTimer)
        try {
          const canvas = document.createElement('canvas')
          const bounds = getCombinedBoundingBox(elements)
          const padding = options.padding ?? 40
          const width = Math.max(100, bounds.width + padding * 2)
          const height = Math.max(100, bounds.height + padding * 2)

          canvas.width = width * scale
          canvas.height = height * scale
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(url)
            resolve(url)
            return
          }
          ctx.scale(scale, scale)
          ctx.drawImage(img, 0, 0)
          URL.revokeObjectURL(url)
          const pngDataUrl = canvas.toDataURL('image/png')
          resolve(pngDataUrl)
        } catch (err) {
          URL.revokeObjectURL(url)
          resolve(`data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`)
        }
      }

      img.onerror = () => {
        clearTimeout(fallbackTimer)
        URL.revokeObjectURL(url)
        resolve(`data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`)
      }

      img.src = url
    } catch (e) {
      resolve(`data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`)
    }
  })
}

/**
 * Download PNG file directly
 */
export async function downloadPng(
  elements: CanvasElement[],
  filename: string,
  options?: SvgExportOptions & { scale?: number }
): Promise<void> {
  if (typeof document === 'undefined') return
  try {
    const dataUrl = await exportToPng(elements, options)
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (e) {
    console.error('Failed to export PNG:', e)
  }
}

/**
 * Export document snapshot to formatted JSON
 */
export function exportToJson(snapshot: SyncStackDocumentSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
