import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-lg shadow-sm max-w-lg">
            <h2 className="text-lg font-semibold text-red-600 mb-2">页面出错</h2>
            <p className="text-sm text-gray-500 mb-4">
              请刷新页面重试，或联系管理员。
            </p>
            <pre className="text-xs text-red-800 bg-red-50 p-3 rounded whitespace-pre-wrap max-h-48 overflow-y-auto">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700"
            >
              重试
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
