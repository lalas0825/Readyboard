/**
 * PowerSync Context + Hook — Platform-agnostic
 *
 * Wraps AbstractPowerSyncDatabase so UI doesn't know
 * if it's running on Web (IndexedDB) or Mobile (SQLite).
 *
 * Usage:
 *   <PowerSyncProvider db={myDatabase}>
 *     <App />
 *   </PowerSyncProvider>
 *
 *   const { db, status } = usePowerSync();
 */

import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import type { PowerSyncStatus } from '../types';

export type PowerSyncContextValue = {
  db: AbstractPowerSyncDatabase;
  status: PowerSyncStatus;
};

const PowerSyncContext = createContext<PowerSyncContextValue | null>(null);

export function PowerSyncProvider({
  db,
  children,
}: {
  db: AbstractPowerSyncDatabase;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<PowerSyncStatus>({
    connected: false,
    lastSyncedAt: null,
    hasSynced: false,
  });

  useEffect(() => {
    // Observability: log every sync status change
    const dispose = db.registerListener({
      statusChanged: (syncStatus) => {
        const next: PowerSyncStatus = {
          connected: syncStatus.connected,
          lastSyncedAt: syncStatus.lastSyncedAt ?? null,
          hasSynced: syncStatus.lastSyncedAt != null,
        };
        console.log('[PowerSync] syncStatus:', JSON.stringify(next));
        setStatus(next);
      },
    });

    return () => {
      if (typeof dispose === 'function') dispose();
    };
  }, [db]);

  // createElement instead of JSX — avoids @types/react version conflicts
  // between React 18 (mobile) and React 19 (web) in the monorepo
  return createElement(PowerSyncContext.Provider, { value: { db, status } }, children);
}

export function usePowerSync(): PowerSyncContextValue {
  const ctx = useContext(PowerSyncContext);
  if (!ctx) {
    throw new Error('usePowerSync must be used within a PowerSyncProvider');
  }
  return ctx;
}

export { PowerSyncContext };
