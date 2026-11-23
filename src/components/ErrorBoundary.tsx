import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Dhruv Tales ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0B0E] text-[#F5F3EE] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl bg-[#141418] border border-white/10 p-8 space-y-4">
            <h1 className="font-display text-2xl font-semibold text-[#F5F3EE]">
              Something interrupted playback
            </h1>
            <p className="text-sm text-[#A39E93] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-[#E5A93C] text-[#0B0B0E] text-sm font-semibold hover:bg-[#F3C669] transition-colors"
            >
              Reload Dhruv Tales
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
