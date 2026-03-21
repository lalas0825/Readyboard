/**
 * PowerSyncProvider — React Native specific initialization.
 *
 * Creates the platform-specific PowerSyncDatabase (SQLite via quick-sqlite),
 * connects to PowerSync Cloud, and provides the db via shared context.
 *
 * Uses PowerSyncContext directly (not the shared JSX Provider) to avoid
 * @types/react version conflicts between React 18 (RN) and React 19 (web).
 *
 * Observability: logs init, connection, and status changes to console.
 */

import { createElement, useEffect, useState, type ReactNode } from 'react';
import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema, SupabaseConnector } from '@readyboard/db';
import { PowerSyncContext } from '@readyboard/shared';
import type { PowerSyncStatus, PowerSyncContextValue } from '@readyboard/shared';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL!;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let _connector: SupabaseConnector | null = null;

/** Get the singleton Supabase connector (for auth operations outside the provider) */
export function getSupabaseConnector(): SupabaseConnector {
  if (!_connector) {
    _connector = new SupabaseConnector({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      powersyncUrl: POWERSYNC_URL,
    });
  }
  return _connector;
}

export function PowerSyncMobileProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [status, setStatus] = useState<PowerSyncStatus>({
    connected: false,
    lastSyncedAt: null,
    hasSynced: false,
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      console.log('[PowerSync] Initializing React Native database...');

      const connector = getSupabaseConnector();

      const database = new PowerSyncDatabase({
        schema: AppSchema,
        database: { dbFilename: 'readyboard.db' },
      });

      await database.init();
      console.log('[PowerSync] Database initialized (readyboard.db)');

      // Observability: log every sync status change
      database.registerListener({
        statusChanged: (syncStatus) => {
          const next: PowerSyncStatus = {
            connected: syncStatus.connected,
            lastSyncedAt: syncStatus.lastSyncedAt ?? null,
            hasSynced: syncStatus.lastSyncedAt != null,
          };
          console.log('[PowerSync] syncStatus:', JSON.stringify(next));
          if (mounted) setStatus(next);
        },
      });

      // Attempt connection — will fail gracefully if no auth session yet
      try {
        await database.connect(connector);
        console.log('[PowerSync] Connected to PowerSync Cloud');
      } catch (error) {
        console.warn('[PowerSync] Connection deferred (auth session required):', error);
      }

      if (mounted) {
        setDb(database);
      }
    };

    init().catch((error) => {
      console.error('[PowerSync] Init failed:', error);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!db) {
    return null; // PowerSync initializing — render nothing until ready
  }

  // createElement avoids JSX @types/react version conflict (React 18 ↔ 19)
  const value: PowerSyncContextValue = { db, status };
  return createElement(PowerSyncContext.Provider, { value }, children);
}
