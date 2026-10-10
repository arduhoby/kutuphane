import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full rounded-xl border border-destructive bg-card p-6 shadow-lg">
            <h1 className="text-xl font-bold text-destructive mb-2">Bir hata oluştu</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Uygulama yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                {this.state.error.toString()}
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
