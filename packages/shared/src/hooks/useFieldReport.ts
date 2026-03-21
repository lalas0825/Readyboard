/**
 * useFieldReport — CRUD hook for field reports in local SQLite.
 *
 * Writes go to local DB first → PowerSync syncs to Supabase in background.
 * All methods return Promises for clean async control flow.
 */

import { usePowerSync } from './usePowerSync';
import type { FieldReportInput } from '../types';

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
        reason_code, gps_lat, gps_lng, photo_url,
        device_id, app_version, offline_created_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.area_id,
        input.user_id,
        input.trade_name,
        input.status,
        input.progress_pct,
        input.reason_code ?? null,
        input.gps_lat ?? null,
        input.gps_lng ?? null,
        input.photo_url ?? null,
        input.device_id ?? null,
        input.app_version ?? null,
        now,
        now,
      ]
    );

    console.log(
      `[FieldReport] Created: ${id} area=${input.area_id} status=${input.status} pct=${input.progress_pct}`
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

  return { createReport, getReportsForArea };
}
