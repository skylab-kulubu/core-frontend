'use client';

import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';

type ErrorKind = 'backend' | 'frontend';

type MessageState = {
  visible: boolean;
  kind: ErrorKind | null;
  lastMessage: string | null;
};

type MessageAction =
  | { type: 'show'; payload: { kind: ErrorKind; message: string | null } }
  | { type: 'reset' };

type ContactInfo = {
  icon: string;
  title: string;
  instruction: string;
  name: string;
  phone: string;
};

const styles = {
  card: 'mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-foreground',
  layout: 'flex items-start gap-3',
  icon: 'text-xl',
  title: 'font-semibold',
  description: 'text-sm',
  contactLink: 'block font-medium hover:underline',
  detail: 'mt-1 text-xs opacity-70',
} as const;

const ERROR_CONTACTS: Record<ErrorKind, ContactInfo> = {
  backend: {
    icon: '⚠️',
    title: 'Backend sorunu tespit edildi.',
    instruction: 'Lütfen hemen backend developerı açana kadar arayın.',
    name: 'Yusuf Açmacı',
    phone: '+90 552 491 35 25',
  },
  frontend: {
    icon: '🐞',
    title: 'Frontend sorunu tespit edildi.',
    instruction: 'Lütfen 15.00-23.00 arasında frontend developera WhatsApp üzerinden haber verin.',
    name: 'Yusuf Ersel Kara',
    phone: '+90 505 006 71 11',
  },
};

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

function formatPhoneHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, '')}`;
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

  const contact = ERROR_CONTACTS[state.kind];

  return (
    <div className={styles.card}>
      <div className={styles.layout}>
        <div className={styles.icon}>{contact.icon}</div>
        <div className="flex-1">
          <div className={styles.title}>{contact.title}</div>
          <div className={styles.description}>
            {contact.instruction}
            <a className={styles.contactLink} href={formatPhoneHref(contact.phone)}>
              <span className="block">{contact.name}</span>
              {contact.phone}
            </a>
          </div>
          {state.lastMessage ? (
            <div className={styles.detail}>Detay: {state.lastMessage}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
