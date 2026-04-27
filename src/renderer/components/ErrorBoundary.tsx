import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle: string;
  retryLabel: string;
  className?: string;
}

interface ErrorBoundaryState {
  message: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Mindline renderer error boundary caught an error', error, info);
  }

  render() {
    if (this.state.message) {
      return (
        <section className={`empty-state error-boundary-state ${this.props.className ?? ''}`.trim()}>
          <h2>{this.props.fallbackTitle}</h2>
          <p>{this.state.message}</p>
          <button type="button" onClick={() => this.setState({ message: null })}>
            {this.props.retryLabel}
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
