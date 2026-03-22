'use server';

import Papa from 'papaparse';
import { getSession } from '@/lib/auth/getSession';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ImportResult } from '../types';

type RawScheduleRow = {
  activity_id: string;
  area_name: string;
  trade_name: string;
  planned_start: string;
  planned_finish: string;
  baseline_finish?: string;
  is_critical?: string | boolean;
};

/**
 * Atomic P6/CSV schedule import.
 * Calls `import_schedule_batch` RPC — single DB transaction.
 * If one row fails, the entire batch reverts.
 */
export async function importP6Schedule(
  projectId: string,
  fileContent: string,
  format: 'csv' | 'json',
): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { success: false, upserted: 0, critical: 0, unmappedAreas: [], error: 'Not authenticated' };

  const supabase = session.isDevBypass ? createServiceClient() : await createClient();

  // --- Parse ---
  let rows: RawScheduleRow[];
  try {
    if (format === 'csv') {
      const parsed = Papa.parse<RawScheduleRow>(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      });
      if (parsed.errors.length > 0) {
        return { success: false, upserted: 0, critical: 0, unmappedAreas: [], error: `CSV parse error: ${parsed.errors[0].message}` };
      }
      rows = parsed.data;
    } else {
      rows = JSON.parse(fileContent);
    }
  } catch (e) {
    return { success: false, upserted: 0, critical: 0, unmappedAreas: [], error: `Parse error: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!rows.length) {
    return { success: false, upserted: 0, critical: 0, unmappedAreas: [], error: 'No rows found in file' };
  }

  // --- Validate required fields ---
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.activity_id || !r.area_name || !r.trade_name) {
      return { success: false, upserted: 0, critical: 0, unmappedAreas: [], error: `Row ${i + 1}: missing activity_id, area_name, or trade_name` };
    }
  }

  // --- Normalize for RPC ---
  const items = rows.map((r) => ({
    p6_activity_id: r.activity_id,
    area_name: r.area_name,
    trade_name: r.trade_name,
    planned_start: r.planned_start || null,
    planned_finish: r.planned_finish || null,
    baseline_finish: r.baseline_finish || r.planned_finish || null,
    is_critical: r.is_critical === true || r.is_critical === 'true' || r.is_critical === '1',
  }));

  // --- Atomic RPC call ---
  const { data, error } = await supabase.rpc('import_schedule_batch', {
    p_project_id: projectId,
    p_items: items,
  });

  if (error) {
    return { success: false, upserted: 0, critical: 0, unmappedAreas: [], error: `Import failed (atomic rollback): ${error.message}` };
  }

  // --- Detect unmapped areas ---
  const { data: unmapped } = await supabase
    .from('schedule_items')
    .select('area_name')
    .eq('project_id', projectId)
    .is('area_id', null);

  const unmappedAreas = [...new Set((unmapped ?? []).map((r) => r.area_name))];

  return {
    success: true,
    upserted: (data as { upserted: number })?.upserted ?? rows.length,
    critical: (data as { critical: number })?.critical ?? 0,
    unmappedAreas,
  };
}
