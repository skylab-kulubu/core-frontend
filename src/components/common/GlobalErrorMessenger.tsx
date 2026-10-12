'use client';

import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';

type ErrorKind = 'backend' | 'frontend';

type MessageState = {
  visible: boolean;
  kind: ErrorKind | null;
  lastMessage: string | null;
};

type MessageAction =
  | { type: 'show'; payload: { kind: ErrorKind; message: string | null } }
  | { type: 'reset' };

const styles = {
  card: 'mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-foreground',
  layout: 'flex items-start gap-3',
  icon: 'text-xl',
  title: 'font-semibold',
  description: 'text-sm',
  detail: 'mt-1 text-xs opacity-70',
} as const;

const INITIAL_STATE: MessageState = {
  visible: false,
  kind: null,
  lastMessage: null,
};

function classify(message: string | undefined | null): ErrorKind {
  const msg = (message || '').toLowerCase();

  if (
    msg.includes('http 5') ||
    msg.includes(' 500') ||
    msg.includes(' 501') ||
    msg.includes(' 502') ||
    msg.includes(' 503') ||
    msg.includes(' 504') ||
    msg.includes('bad gateway') ||
    msg.includes('backend servisi') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error')
  ) {
    return 'backend';
  }

  return 'frontend';
}

function messageReducer(state: MessageState, action: MessageAction): MessageState {
  switch (action.type) {
    case 'show':
      return {
        visible: true,
        kind: action.payload.kind,
        lastMessage: action.payload.message,
      };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
}

function extractMessage(reason: unknown): string | null {
  // core's title and detail are English: an unhandled refusal is said in Turkish
  if (reason instanceof ProblemError) {
    return coreProblemMessage(reason, 'Sunucu isteği tamamlanamadı.');
  }
  if (typeof reason === 'string') {
    return reason;
  }

  if (
    typeof reason === 'object' &&
    reason !== null &&
    'message' in reason &&
    typeof (reason as { message?: unknown }).message === 'string'
  ) {
    return (reason as { message: string }).message;
  }

  if (typeof reason === 'object' && reason !== null && 'toString' in reason) {
    const fallback = (reason as { toString?: () => string }).toString?.();
    if (fallback && fallback !== '[object Object]') {
      return fallback;
    }
  }

  return null;
}

function createCustomErrorListener(
  kind: ErrorKind,
  dispatch: Dispatch<MessageAction>,
): EventListener {
  return (event) => {
    const customEvent = event as CustomEvent<{ message?: string }>;
    dispatch({
      type: 'show',
      payload: {
        kind,
        message: customEvent.detail?.message ?? null,
      },
    });
  };
}

export function GlobalErrorMessenger() {
  const [state, dispatch] = useReducer(messageReducer, INITIAL_STATE);

  useEffect(() => {
    const onUnhandledRejection: EventListener = (event) => {
      const reason: unknown = (event as PromiseRejectionEvent).reason;
      const message = extractMessage(reason);
      const kind = classify(message);

      dispatch({ type: 'show', payload: { kind, message } });
    };

    const onError: EventListener = (event) => {
      const errorEvent = event as ErrorEvent;
      const message = errorEvent.message || extractMessage(errorEvent.error);
      const kind = classify(message);

      dispatch({ type: 'show', payload: { kind, message } });
    };

    const onFrontendError = createCustomErrorListener('frontend', dispatch);
    const onBackendError: EventListener = (event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const raw = (customEvent.detail?.message ?? '').trim().toLowerCase();
      if (raw === 'http 404') return;
      dispatch({
        type: 'show',
        payload: { kind: 'backend', message: customEvent.detail?.message ?? null },
      });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);
    window.addEventListener('frontend-error', onFrontendError);
    window.addEventListener('backend-error', onBackendError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
      window.removeEventListener('frontend-error', onFrontendError);
      window.removeEventListener('backend-error', onBackendError);
      dispatch({ type: 'reset' });
    };
  }, []);

  if (!state.visible || !state.kind) {
    return null;
  }

  return (
    <div className={styles.card}>
      <div className={styles.layout}>
        <div className={styles.icon}>⚠️</div>
        <div className="flex-1">
          <div className={styles.title}>Beklenmeyen bir hata oluştu</div>
          <div className={styles.description}>Sayfayı yenileyip tekrar dene.</div>
          {state.lastMessage ? (
            <div className={styles.detail}>Detay: {state.lastMessage}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
