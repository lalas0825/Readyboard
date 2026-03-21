/**
 * SupabaseConnector — PowerSync ↔ Supabase Bridge
 *
 * Handles:
 * 1. Authentication: fetches JWT credentials for PowerSync Cloud
 * 2. Upload: applies local CRUD operations to Supabase on sync
 *
 * Observability: console.log on every credential fetch, upload batch,
 * and error. Essential for debugging offline→online sync issues.
 */

import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Tables that PowerSync syncs (matches schema.ts) */
const WRITABLE_TABLES = [
  'field_reports',
  'area_trade_status',
  'area_tasks',
] as const;

const READONLY_TABLES = [
  'projects',
  'areas',
  'trade_sequences',
  'users',
  'user_assignments',
  'delay_logs',
  'nod_drafts',
  'corrective_actions',
] as const;

const ALL_SYNCED_TABLES = [...WRITABLE_TABLES, ...READONLY_TABLES] as const;
type SyncedTable = (typeof ALL_SYNCED_TABLES)[number];

export type SupabaseConnectorConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  powersyncUrl: string;
};

export class SupabaseConnector implements PowerSyncBackendConnector {
  private client: SupabaseClient;
  private config: SupabaseConnectorConfig;

  constructor(config: SupabaseConnectorConfig) {
    this.config = config;
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
      },
    });
  }

  /** Expose the Supabase client for auth operations (signIn, signOut, etc.) */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Called by PowerSync before every sync cycle.
   * Returns JWT credentials for the PowerSync Cloud endpoint.
   *
   * OBSERVABILITY: Logs credential fetch attempts and token expiry.
   * If session is expired, Supabase SDK auto-refreshes before returning.
   */
  async fetchCredentials() {
    console.log('[PowerSync] fetchCredentials: requesting session...');

    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      console.error('[PowerSync] fetchCredentials: auth error:', error.message);
      throw new Error(`Auth error: ${error.message}`);
    }

    if (!session) {
      console.warn('[PowerSync] fetchCredentials: no active session');
      throw new Error('Not authenticated. Call supabase.auth.signIn* first.');
    }

    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000)
      : undefined;

    // Proactive refresh: if token expires in less than 60s, force refresh
    if (expiresAt && expiresAt.getTime() - Date.now() < 60_000) {
      console.log('[PowerSync] fetchCredentials: token expiring soon, refreshing...');
      const { data: refreshData, error: refreshError } =
        await this.client.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        console.error('[PowerSync] fetchCredentials: refresh failed:', refreshError?.message);
        throw new Error(`Session refresh failed: ${refreshError?.message}`);
      }

      console.log('[PowerSync] fetchCredentials: session refreshed successfully');
      return {
        endpoint: this.config.powersyncUrl,
        token: refreshData.session.access_token,
        expiresAt: refreshData.session.expires_at
          ? new Date(refreshData.session.expires_at * 1000)
          : undefined,
      };
    }

    console.log(
      '[PowerSync] fetchCredentials: OK — expires:',
      expiresAt?.toISOString() ?? 'unknown'
    );

    return {
      endpoint: this.config.powersyncUrl,
      token: session.access_token,
      expiresAt,
    };
  }

  /**
   * Called by PowerSync when local writes need to be pushed to Supabase.
   * Processes each CRUD operation sequentially within a transaction.
   *
   * OBSERVABILITY: Logs batch size, each operation, and errors.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    console.log(
      `[PowerSync] uploadData: processing ${transaction.crud.length} operation(s)`
    );

    let successCount = 0;

    try {
      for (const op of transaction.crud) {
        const startTime = Date.now();
        await this.applyOperation(op);
        successCount++;
        console.log(
          `[PowerSync] uploadData: ${op.op} ${op.table}/${op.id} — ${Date.now() - startTime}ms`
        );
      }

      await transaction.complete();
      console.log(
        `[PowerSync] uploadData: batch complete — ${successCount}/${transaction.crud.length} ops`
      );
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      console.error(
        `[PowerSync] uploadData: FAILED at op ${successCount + 1}/${transaction.crud.length}:`,
        {
          message: err.message ?? String(error),
          code: err.code,
          details: err.details,
          hint: err.hint,
          context: `batch=${transaction.crud.length} completed=${successCount}`,
        }
      );
      // Do NOT call transaction.complete() — record stays in pending queue
      // PowerSync will retry automatically on next sync cycle
      throw error;
    }
  }

  /**
   * Apply a single CRUD operation to Supabase.
   * RLS policies on Supabase will validate the write server-side.
   */
  private async applyOperation(op: CrudEntry): Promise<void> {
    const table = op.table;

    // Validate table is one we sync
    if (!ALL_SYNCED_TABLES.includes(table as SyncedTable)) {
      console.warn(`[PowerSync] applyOperation: skipping unknown table "${table}"`);
      return;
    }

    const opType = op.op as unknown as string;

    switch (opType) {
      case 'PUT': {
        const record = { ...op.opData, id: op.id };
        const { error } = await this.client.from(table).upsert(record);
        if (error) {
          console.error(`[PowerSync] PUT ${table}/${op.id} failed:`, { message: error.message, code: error.code, details: error.details });
          throw error;
        }
        break;
      }
      case 'PATCH': {
        const { error } = await this.client
          .from(table)
          .update(op.opData!)
          .eq('id', op.id);
        if (error) {
          console.error(`[PowerSync] PATCH ${table}/${op.id} failed:`, { message: error.message, code: error.code, details: error.details });
          throw error;
        }
        break;
      }
      case 'DELETE': {
        const { error } = await this.client
          .from(table)
          .delete()
          .eq('id', op.id);
        if (error) {
          console.error(`[PowerSync] DELETE ${table}/${op.id} failed:`, { message: error.message, code: error.code, details: error.details });
          throw error;
        }
        break;
      }
      default:
        console.warn(`[PowerSync] applyOperation: unknown op type "${opType}"`);
    }
  }
}
