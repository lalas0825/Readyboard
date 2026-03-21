/**
 * AuthProvider — Supabase Auth for React Native.
 *
 * Manages auth session state. Foremen authenticate via SMS magic link,
 * Sub PMs via email. Exposes signInWithPhone, verifyOtp, signOut.
 *
 * Resilience: If token expires offline, session state persists locally
 * so PowerSync can continue serving cached data. Sync resumes on reconnect.
 *
 * Observability: logs full auth lifecycle (login, refresh, logout, errors).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { getSupabaseConnector } from './PowerSyncProvider';

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  signInWithPhone: (phone: string) => Promise<AuthResult>;
  verifyOtp: (phone: string, token: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-use the Supabase client from the connector (single instance)
  const supabase = getSupabaseConnector().getClient();

  useEffect(() => {
    // Get initial session (resolves from stored tokens even if offline)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
      console.log('[AuthProvider] Initialized | session:', s ? 'active' : 'none');
    });

    // Listen for auth state changes with detailed logging
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      const userId = s?.user.id?.slice(0, 8) ?? 'none';
      const expiresIn = s?.expires_at
        ? Math.round((s.expires_at * 1000 - Date.now()) / 1000)
        : null;

      console.log(
        `[AuthProvider] ${event} | user=${userId} | expiresIn=${expiresIn ?? 'n/a'}s`
      );

      // Offline resilience: if token refresh returned null but we had a session,
      // keep the local session so PowerSync can serve cached data
      if (event === 'TOKEN_REFRESHED' && !s && session) {
        console.warn('[AuthProvider] Token refresh returned null — keeping local session for offline access');
        return;
      }

      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPhone = useCallback(
    async (phone: string): Promise<AuthResult> => {
      console.log('[AuthProvider] signInWithOtp: sending OTP to', phone.slice(0, 4) + '****');
      try {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) {
          console.error('[AuthProvider] signInWithOtp failed:', error.message);
          return { error: error.message };
        }
        console.log('[AuthProvider] signInWithOtp: OTP sent successfully');
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        console.error('[AuthProvider] signInWithOtp network error:', msg);
        return { error: msg };
      }
    },
    [supabase]
  );

  const verifyOtp = useCallback(
    async (phone: string, token: string): Promise<AuthResult> => {
      console.log('[AuthProvider] verifyOtp: verifying code for', phone.slice(0, 4) + '****');
      try {
        const { error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });
        if (error) {
          console.error('[AuthProvider] verifyOtp failed:', error.message);
          return { error: error.message };
        }
        console.log('[AuthProvider] verifyOtp: session established');
        return { error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        console.error('[AuthProvider] verifyOtp network error:', msg);
        return { error: msg };
      }
    },
    [supabase]
  );

  const signOut = useCallback(async (): Promise<void> => {
    console.log('[AuthProvider] signOut: clearing session');
    try {
      await supabase.auth.signOut();
      console.log('[AuthProvider] signOut: complete');
    } catch (err) {
      // If offline, clear local session state anyway
      console.warn('[AuthProvider] signOut error (clearing locally):', err);
      setSession(null);
    }
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ session, supabase, isLoading, signInWithPhone, verifyOtp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
