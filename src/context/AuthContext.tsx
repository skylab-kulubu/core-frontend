'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
  useLayoutEffect,
} from 'react';
import type { UserDto } from '@/types/api';
import { useRouter, usePathname } from 'next/navigation';
import { useSessionDeadline } from '@/lib/auth/use-session-deadline';

interface AuthContextType {
  user: UserDto | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_USER_STORAGE_KEY = 'auth_user';
let memoryUserCache: UserDto | null = null;
let memoryAuthBootstrapped = false;

type AuthProviderProps = Readonly<{
  children: ReactNode;
  initialUser?: UserDto;
  /** Seconds until the session's sign-in is too old for the panel; the page then signs in again. */
  sessionExpiresIn?: number;
}>;

function readCachedUser(): UserDto | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserDto;
  } catch {
    return null;
  }
}

export function AuthProvider({ children, initialUser, sessionExpiresIn }: AuthProviderProps) {
  useSessionDeadline(sessionExpiresIn);
  const [user, setUser] = useState<UserDto | null>(() => initialUser ?? memoryUserCache ?? null);
  const [loading, setLoading] = useState(() => {
    const boot = !!(initialUser ?? memoryUserCache ?? readCachedUser());
    return !(memoryAuthBootstrapped || boot);
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const didInit = useRef(false);

  const fetchUser = useCallback(async () => {
    try {
      // Cache'ten doldurulmuş oturumlarda gereksiz loading / login'e flush olmasın
      if (!user && !memoryUserCache) {
        setLoading(true);
      }
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          memoryUserCache = data.user;
          memoryAuthBootstrapped = true;
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(data.user));
          }
          setError(null);
        } else if (
          data.authenticated &&
          !data.user &&
          typeof data.error === 'string' &&
          data.error.length > 0
        ) {
          // /api/auth/me bazen backend 502 iken kullanıcıyı null dönüyor; çıkışa zorlamayız.
          const fallback = memoryUserCache ?? readCachedUser();
          if (fallback) {
            setUser(fallback);
            memoryUserCache = fallback;
          }
          setError(data.error);
        } else {
          setUser(null);
          memoryUserCache = null;
          memoryAuthBootstrapped = true;
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
          }
        }
      } else {
        setUser(null);
        memoryUserCache = null;
        memoryAuthBootstrapped = true;
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
        setError('Kullanıcı bilgileri alınamadı');
      }
    } catch (err) {
      console.error('Auth fetch error:', err);
      setError('Bağlantı hatası');
      setUser(null);
      memoryUserCache = null;
      memoryAuthBootstrapped = true;
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useLayoutEffect(() => {
    // İlk client render ile server render uyumlu olsun diye cache'i mount'tan sonra oku.
    if (didInit.current) return;
    didInit.current = true;

    if (initialUser) {
      memoryUserCache = initialUser;
      memoryAuthBootstrapped = true;
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(initialUser));
      }
      setLoading(false);
      void fetchUser();
      return;
    }

    const cachedUser = readCachedUser();
    if (cachedUser) {
      setUser(cachedUser);
      memoryUserCache = cachedUser;
      memoryAuthBootstrapped = true;
      setLoading(false);
      void fetchUser();
      return;
    }

    if (memoryAuthBootstrapped) {
      setLoading(false);
      return;
    }

    fetchUser();
  }, [fetchUser, initialUser]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (pathname && !pathname.startsWith('/login')) {
        router.replace('/login');
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
