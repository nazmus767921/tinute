import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCw } from '@/icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Granular React Error Boundary with accessible visual cues,
 * retry trigger, and isolation from breaking the rest of the application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error cleanly without leaking user payload data
    console.error('ErrorBoundary caught UI exception:', error.message, errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? 'An unexpected interface error occurred';
      const errorMessage = this.state.error?.message || 'Component failed to render properly.';

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 sm:p-5 rounded-comic border-2 border-lossy bg-surface shadow-comic flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-lossy/15 border-2 border-lossy/40 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-comic-sm">
              <AlertOctagon className="w-5 h-5 text-lossy" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-text text-sm mb-1 text-balance">{title}</h3>
              <p className="text-muted leading-relaxed text-pretty max-w-xl text-xs font-medium">
                {errorMessage}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={this.handleReset}
            className="pl-3 pr-3.5 py-1.5 bg-canvas hover:bg-surface border-2 border-border text-text rounded-xl text-xs font-bold shadow-comic-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5 text-muted" strokeWidth={2.2} aria-hidden="true" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
