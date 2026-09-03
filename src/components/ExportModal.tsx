import React, { useState } from 'react'
import {
  Download,
  Upload,
  Copy,
  Check,
  FileCode,
  FileJson,
  Image as ImageIcon,
  X,
  AlertCircle
} from 'lucide-react'
import { CanvasElement, CardData, SyncStackDocumentSnapshot } from '../types'
import { downloadFile, downloadPng, exportToJson, exportToSvg } from '../utils/exportUtils'
import { importFromJson } from '../utils/importUtils'

interface Props {
  isOpen: boolean
  onClose: () => void
  boardId: string
  elements: CanvasElement[]
  cards: Record<string, CardData>
  columns: Record<string, string[]>
  onImport: (snapshot: SyncStackDocumentSnapshot) => void
}

export const ExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  boardId,
  elements,
  cards,
  columns,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [copiedType, setCopiedType] = useState<'svg' | 'json' | null>(null)
  const [isExportingPng, setIsExportingPng] = useState(false)
  const [pngScale, setPngScale] = useState<number>(2)
  const [importJsonText, setImportJsonText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  if (!isOpen) return null

  const snapshot: SyncStackDocumentSnapshot = {
    schemaVersion: 1,
    boardId,
    exportedAt: new Date().toISOString(),
    elements,
    cards,
    columns
  }

  const svgContent = exportToSvg(elements)
  const jsonContent = exportToJson(snapshot)

  const handleCopy = (type: 'svg' | 'json', text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2000)
    })
  }

  const handleDownloadSvg = () => {
    downloadFile(svgContent, `${boardId}-canvas.svg`, 'image/svg+xml')
  }

  const handleDownloadPng = async () => {
    setIsExportingPng(true)
    try {
      await downloadPng(elements, `${boardId}-canvas.png`, { scale: pngScale })
    } finally {
      setIsExportingPng(false)
    }
  }

  const handleDownloadJson = () => {
    downloadFile(jsonContent, `${boardId}-backup.json`, 'application/json')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setImportJsonText(text)
      setImportError(null)
    }
    reader.readAsText(file)
  }

  const handleExecuteImport = () => {
    setImportError(null)
    setImportSuccess(false)

    const result = importFromJson(importJsonText)
    if (!result.success || !result.snapshot) {
      setImportError(result.error || 'Failed to parse import data')
      return
    }

    onImport(result.snapshot)
    setImportSuccess(true)
    setTimeout(() => {
      onClose()
    }, 800)
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-100 text-lg">Document Exporter & Importer</h3>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab('export')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'export'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Export
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'import'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Import
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {activeTab === 'export' ? (
            <div className="space-y-6">
              {/* SVG Export Card */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode size={18} className="text-purple-400" />
                    <span className="font-bold text-slate-100">Vector SVG Export</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy('svg', svgContent)}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
                    >
                      {copiedType === 'svg' ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy SVG</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadSvg}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                    >
                      <Download size={12} />
                      Download .svg
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Exports current whiteboard shapes, sticky notes, connectors, and text as a vector graphic.
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 max-h-24 overflow-y-auto">
                  {svgContent.slice(0, 300)}...
                </div>
              </div>

              {/* PNG Export Card */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={18} className="text-emerald-400" />
                    <span className="font-bold text-slate-100">High-Resolution Raster PNG</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={pngScale}
                      onChange={(e) => setPngScale(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 focus:outline-none"
                      title="Resolution Scale"
                    >
                      <option value={1}>1x Standard</option>
                      <option value={2}>2x Retina (HD)</option>
                      <option value={3}>3x Ultra HD</option>
                    </select>
                    <button
                      disabled={isExportingPng}
                      onClick={handleDownloadPng}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                    >
                      <Download size={12} />
                      {isExportingPng ? 'Exporting...' : 'Download .png'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Renders the entire canvas drawing at crisp resolution for presentations and documentation.
                </p>
              </div>

              {/* JSON Export Card */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileJson size={18} className="text-blue-400" />
                    <span className="font-bold text-slate-100">Full JSON Document Snapshot</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy('json', jsonContent)}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
                    >
                      {copiedType === 'json' ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      <Download size={12} />
                      Download .json
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Full backup containing all whiteboard elements, kanban cards, and column states.
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 max-h-24 overflow-y-auto">
                  {jsonContent.slice(0, 300)}...
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Upload Backup File
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-slate-900 border border-slate-700 rounded-lg p-1.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Or Paste JSON Snapshot
                </label>
                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value)
                    setImportError(null)
                  }}
                  placeholder="Paste SyncStack JSON snapshot here..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {importError && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-semibold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-semibold">
                  <Check size={16} className="shrink-0" />
                  <span>Snapshot imported successfully into CRDT document!</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  disabled={!importJsonText.trim()}
                  onClick={handleExecuteImport}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-colors"
                >
                  <Upload size={14} />
                  Restore & Apply Snapshot
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
