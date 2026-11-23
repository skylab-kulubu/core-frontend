'use client';

import { Button, SkylabLoader, SkylabMark } from '@skylab-kulubu/skylcn-ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { accountCenterUrl } from '@/lib/club-switcher';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { loginErrorMessage } from './login-errors';

const LOGIN_START = '/api/auth/login';

/** The page around every state: the mark and the product's name over a card, as in the sign-in. */
function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3">
        <SkylabMark size={48} />
        <p className="text-foreground-strong text-lg font-semibold tracking-tight">
          SKY LAB <span className="text-muted-foreground font-normal">Yönetim</span>
        </p>
      </div>
      <div className="border-border-subtle bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}

function startLogin() {
  window.location.href = LOGIN_START;
}

/** One title, one line, then "Tekrar giriş yap" and the account center beside it. */
function LoginState({
  title,
  message,
  action,
  onAction,
}: {
  title: string;
  message?: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-foreground-strong text-base font-semibold">{title}</h1>
        {message ? (
          <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>{message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="primary" className="w-full" onClick={onAction}>
          {action}
        </Button>
        <Button variant="ghost" className="w-full" render={<a href={accountCenterUrl()} />}>
          Hesap merkezi
        </Button>
      </div>
    </div>
  );
}

function Redirecting() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-2">
      <SkylabLoader size={40} variant="pulse" />
      <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>Giriş sayfası açılıyor</p>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const logout = searchParams.get('logout');
  const started = useRef(false);

  useEffect(() => {
    if (error || logout || started.current) return;
    started.current = true;
    startLogin();
  }, [error, logout]);

  if (error) {
    return (
      <LoginShell>
        <LoginState
          title="Giriş yapılamadı"
          message={loginErrorMessage(error)}
          action="Tekrar giriş yap"
          onAction={startLogin}
        />
      </LoginShell>
    );
  }

  if (logout) {
    const signInAgain = async () => {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 300));
      startLogin();
    };

    return (
      <LoginShell>
        <LoginState title="Çıkış yapıldı" action="Giriş yap" onAction={() => void signInAgain()} />
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <Redirecting />
    </LoginShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginShell>
          <Redirecting />
        </LoginShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
