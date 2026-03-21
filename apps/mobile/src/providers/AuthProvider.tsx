/**
 * AuthProvider — Supabase Auth for React Native.
 *
 * Manages auth session state. Foremen authenticate via SMS magic link,
 * Sub PMs via email. This provider exposes the session and a Supabase client.
 *
 * Observability: logs auth state changes to console.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { getSupabaseConnector } from './PowerSyncProvider';

type AuthContextValue = {
  session: Session | null;
  supabase: SupabaseClient;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-use the Supabase client from the connector (single instance)
  const supabase = getSupabaseConnector().getClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      console.log('[Auth] Initial session:', session ? 'active' : 'none');
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      console.log('[Auth] State changed:', event);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, supabase, isLoading }}>
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
