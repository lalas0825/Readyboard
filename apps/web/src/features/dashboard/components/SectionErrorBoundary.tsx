'use client';

import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallbackLabel: string;
};

type State = {
  hasError: boolean;
};

/**
 * Per-section error boundary. If one dashboard section crashes,
 * the others keep rendering. Prevents cascading failures.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
          <p className="text-xs text-red-400">
            {this.props.fallbackLabel} — Error al cargar esta sección
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
