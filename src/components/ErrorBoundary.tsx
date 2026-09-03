import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] w-full p-6 flex items-center justify-center bg-slate-900 text-slate-100">
          <div className="max-w-lg w-full bg-slate-800 border border-rose-500/40 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={28} className="shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  {this.props.fallbackTitle || 'Something went wrong'}
                </h2>
                <p className="text-xs text-slate-400">
                  An unexpected error was caught gracefully by the SyncStack Error Boundary.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 text-xs font-mono text-rose-300 overflow-x-auto max-h-36">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                <RefreshCw size={14} />
                Reload App
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors shadow-md shadow-blue-500/20"
              >
                <RotateCcw size={14} />
                Recover State
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
export default ErrorBoundary
