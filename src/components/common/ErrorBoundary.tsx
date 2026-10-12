'use client';

import React from 'react';
import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';

/** core's English title never reaches the reader; other errors keep their message. */
function readableMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemError) return coreProblemMessage(error, fallback);
  return error instanceof Error ? error.message : fallback;
}

interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: readableMessage(error, 'Bilinmeyen bir hata oluştu'),
    };
  }

  componentDidCatch(error: unknown, _errorInfo: unknown) {
    // İleriye dönük: burada bir log servisine gönderebiliriz
    if (typeof window !== 'undefined') {
      const message = readableMessage(error, 'Bilinmeyen bir hata');
      window.dispatchEvent(new CustomEvent('frontend-error', { detail: { message } }));
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="border-destructive/30 bg-destructive/10 text-foreground rounded-md border p-4">
            <div className="mb-1 font-semibold">Beklenmeyen bir hata oluştu</div>
            <div className="text-sm opacity-80">{this.state.errorMessage}</div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
