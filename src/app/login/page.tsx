'use client';

import { useEffect, useState, Suspense, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SaveButton } from '@/components/chrome/SaveButton';

const LOGIN_START = '/api/auth/login';

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-white/5 bg-neutral-900 p-6 text-center">
        {children}
      </div>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const details = searchParams.get('details');
  const logout = searchParams.get('logout');
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (error || logout) return;
    if (!hasRedirected) {
      setHasRedirected(true);
      window.location.href = LOGIN_START;
    }
  }, [error, logout, hasRedirected]);

  if (error) {
    const message =
      error === 'token_exchange_failed'
        ? 'Giriş tamamlanamadı. Tekrar dene.'
        : error === 'no_code'
          ? 'Yetkilendirme kodu alınamadı. Tekrar dene.'
          : error === 'config_missing'
            ? 'Giriş ayarı eksik. Yöneticiye yaz.'
            : `Hata: ${error}`;
    return (
      <LoginShell>
        <h1 className="text-skylab-300 mb-3 text-xl font-semibold">Giriş hatası</h1>
        <p className="mb-4 text-sm text-neutral-300">{message}</p>
        {details ? (
          <p className="mb-4 break-all rounded-md border border-white/10 bg-white/3 p-3 text-left text-xs text-neutral-400">
            {details}
          </p>
        ) : null}
        <SaveButton
          type="button"
          onClick={() => {
            setHasRedirected(false);
            window.location.href = LOGIN_START;
          }}
        >
          Tekrar dene
        </SaveButton>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-2xs h-8 rounded-md border border-white/10 px-3 font-medium text-neutral-400"
          >
            Sayfayı yenile
          </button>
        </div>
      </LoginShell>
    );
  }

  if (logout) {
    const handleLogin = async () => {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 300));
      window.location.href = LOGIN_START;
    };

    return (
      <LoginShell>
        <h1 className="text-skylab-300 mb-3 text-xl font-semibold">Çıkış yapıldı</h1>
        <p className="mb-4 text-sm text-neutral-400">Tekrar girmek için aşağıdaki düğmeye bas.</p>
        <SaveButton type="button" onClick={() => void handleLogin()}>
          Giriş yap
        </SaveButton>
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <h1 className="text-skylab-300 mb-3 text-xl font-semibold">Yönlendiriliyor…</h1>
      <p className="text-sm text-neutral-500">Giriş sayfasına gidiyorsun.</p>
    </LoginShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginShell>
          <h1 className="text-skylab-300 text-xl font-semibold">Yükleniyor…</h1>
        </LoginShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
