/**
 * useFieldReport — CRUD hook for field reports in local SQLite.
 *
 * Writes go to local DB first → PowerSync syncs to Supabase in background.
 * All methods return Promises for clean async control flow.
 */

import { usePowerSync } from './usePowerSync';
import type { FieldReportInput, DelayLogInput } from '../types';

/** Simple UUID v4 generator — works on all platforms without deps */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useFieldReport() {
  const { db } = usePowerSync();

  /** Insert a new field report into local SQLite */
  async function createReport(input: FieldReportInput): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO field_reports (
        id, area_id, user_id, trade_name, status, progress_pct,
        reason_code, notes, gps_lat, gps_lng, photo_url, photo_type,
        device_id, app_version, offline_created_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.area_id,
        input.user_id,
        input.trade_name,
        input.status,
        input.progress_pct,
        input.reason_code ?? null,
        input.notes ?? null,
        input.gps_lat ?? null,
        input.gps_lng ?? null,
        input.photo_url ?? null,
        input.photo_type ?? 'progress',
        input.device_id ?? null,
        input.app_version ?? null,
        now,
        now,
      ]
    );

    return id;
  }

  /** Get all field reports for an area, newest first */
  async function getReportsForArea(areaId: string) {
    return db.getAll(
      'SELECT * FROM field_reports WHERE area_id = ? ORDER BY created_at DESC',
      [areaId]
    );
  }

  /** Insert a delay_log for a blocked area (started_at = now, ended_at = null) */
  async function createDelayLog(input: DelayLogInput): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO delay_logs (
        id, area_id, trade_name, reason_code, started_at,
        ended_at, man_hours, daily_cost, cumulative_cost,
        crew_size, nod_draft_id, rea_id, receipt_confirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.area_id,
        input.trade_name,
        input.reason_code,
        now,
        null, // ended_at: delay is ongoing
        null, // man_hours: calculated later
        null, // daily_cost: calculated later
        null, // cumulative_cost: calculated later
        null, // crew_size: not captured in report flow
        null, // nod_draft_id: created by server
        null, // rea_id: created by server
        0,    // receipt_confirmed: false
      ]
    );

    return id;
  }

  return { createReport, createDelayLog, getReportsForArea };
}
