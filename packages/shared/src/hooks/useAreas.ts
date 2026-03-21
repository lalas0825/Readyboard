/**
 * useAreas — Foreman assigned areas with derived status.
 *
 * Queries local SQLite via PowerSync:
 *   user_assignments → areas → area_trade_status → delay_logs → nod_drafts
 *
 * Status derivation:
 *   BLOCKED  → active delay_log (ended_at IS NULL) for this area+trade
 *   HELD     → gc_verification_pending on area_trade_status
 *   READY    → effective_pct = 100 AND all_gates_passed
 *   ALMOST   → effective_pct >= 80
 *   WORKING  → default
 *
 * Polls every 2s for reactivity (PowerSync watch not available on all platforms).
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { usePowerSync } from './usePowerSync';
import type { AssignedArea, AreaStatus, PendingNod } from '../types';

type RawAreaRow = {
  id: string;
  name: string | null;
  floor: string | null;
  area_type: string | null;
  project_id: string | null;
  trade_name: string | null;
  effective_pct: number | null;
  all_gates_passed: number | null;
  gc_verification_pending: number | null;
};

type RawDelayRow = {
  area_id: string | null;
  trade_name: string | null;
};

type RawNodRow = {
  nod_id: string | null;
  area_id: string | null;
  area_name: string | null;
  reason_code: string | null;
};

type RawRecentReportRow = {
  area_id: string | null;
  trade_name: string | null;
  last_created_at: string | null;
};

function deriveStatus(
  effectivePct: number,
  allGatesPassed: boolean,
  gcVerificationPending: boolean,
  hasActiveDelay: boolean
): AreaStatus {
  if (hasActiveDelay) return 'blocked';
  if (gcVerificationPending) return 'held';
  if (effectivePct >= 100 && allGatesPassed) return 'ready';
  if (effectivePct >= 80) return 'almost';
  return 'working';
}

/** Sort priority: ready=0, almost=1, working=2, held=3, blocked=4 */
const STATUS_ORDER: Record<AreaStatus, number> = {
  ready: 0,
  almost: 1,
  working: 2,
  held: 3,
  blocked: 4,
};

export function useAreas(userId: string | undefined) {
  const { db, status: syncStatus } = usePowerSync();

  const [areas, setAreas] = useState<AssignedArea[]>([]);
  const [pendingNods, setPendingNods] = useState<PendingNod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAreas = useCallback(async () => {
    if (!userId) {
      setAreas([]);
      setPendingNods([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      // 1. Assigned areas + status in single JOIN
      const rawAreas = await db.getAll<RawAreaRow>(
        `SELECT
          a.id, a.name, a.floor, a.area_type, a.project_id,
          ua.trade_name,
          ats.effective_pct,
          ats.all_gates_passed,
          ats.gc_verification_pending
        FROM user_assignments ua
        JOIN areas a ON a.id = ua.area_id
        LEFT JOIN area_trade_status ats
          ON ats.area_id = a.id AND ats.trade_type = ua.trade_name
        WHERE ua.user_id = ?
        ORDER BY a.floor, a.name`,
        [userId]
      );

      // 2. Active delays (ended_at IS NULL)
      const activeDelays = await db.getAll<RawDelayRow>(
        `SELECT dl.area_id, dl.trade_name
        FROM delay_logs dl
        JOIN user_assignments ua ON ua.area_id = dl.area_id
        WHERE ua.user_id = ? AND dl.ended_at IS NULL`,
        [userId]
      );

      const delaySet = new Set(
        activeDelays
          .filter((d) => d.area_id && d.trade_name)
          .map((d) => `${d.area_id}:${d.trade_name}`)
      );

      // 3. Most recent field_report per area+trade (for "recently reported" indicator)
      const recentReports = await db.getAll<RawRecentReportRow>(
        `SELECT fr.area_id, fr.trade_name, MAX(fr.created_at) as last_created_at
        FROM field_reports fr
        JOIN user_assignments ua ON ua.area_id = fr.area_id AND ua.trade_name = fr.trade_name
        WHERE ua.user_id = ?
        GROUP BY fr.area_id, fr.trade_name`,
        [userId]
      );

      const reportMap = new Map<string, string>();
      for (const r of recentReports) {
        if (r.area_id && r.trade_name && r.last_created_at) {
          reportMap.set(`${r.area_id}:${r.trade_name}`, r.last_created_at);
        }
      }

      // 4. Derive status per area (with null-safe fallbacks)
      const derived: AssignedArea[] = rawAreas
        .filter((row) => row.id) // skip corrupted rows without an id
        .map((row) => {
          const effectivePct = row.effective_pct ?? 0;
          const allGatesPassed = (row.all_gates_passed ?? 1) === 1;
          const gcPending = (row.gc_verification_pending ?? 0) === 1;
          const tradeName = row.trade_name ?? 'unknown';
          const hasDelay = delaySet.has(`${row.id}:${tradeName}`);

          return {
            id: row.id,
            name: row.name ?? 'Unknown',
            floor: row.floor ?? '-',
            area_type: row.area_type ?? 'unknown',
            project_id: row.project_id ?? '',
            trade_name: tradeName,
            effective_pct: effectivePct,
            all_gates_passed: allGatesPassed,
            gc_verification_pending: gcPending,
            status: deriveStatus(effectivePct, allGatesPassed, gcPending, hasDelay),
            last_report_at: reportMap.get(`${row.id}:${tradeName}`) ?? null,
          };
        });

      // Sort by status priority, then floor, then name
      derived.sort((a, b) => {
        const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (orderDiff !== 0) return orderDiff;
        const floorDiff = a.floor.localeCompare(b.floor);
        if (floorDiff !== 0) return floorDiff;
        return a.name.localeCompare(b.name);
      });

      setAreas(derived);

      // 4. Pending NOD drafts (unsent)
      const nods = await db.getAll<RawNodRow>(
        `SELECT nd.id as nod_id, dl.area_id, a.name as area_name, dl.reason_code
        FROM nod_drafts nd
        JOIN delay_logs dl ON dl.id = nd.delay_log_id
        JOIN areas a ON a.id = dl.area_id
        JOIN user_assignments ua ON ua.area_id = dl.area_id
        WHERE ua.user_id = ? AND nd.sent_at IS NULL`,
        [userId]
      );

      setPendingNods(
        nods
          .filter((n) => n.nod_id && n.area_id)
          .map((n) => ({
            nod_id: n.nod_id!,
            area_id: n.area_id!,
            area_name: n.area_name ?? 'Unknown',
            reason_code: n.reason_code ?? 'unknown',
          }))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useAreas] Query failed:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [db, userId]);

  // Poll every 2s for reactivity
  useEffect(() => {
    fetchAreas();
    const interval = setInterval(fetchAreas, 2000);
    return () => clearInterval(interval);
  }, [fetchAreas]);

  // Group areas by status (memoized)
  const grouped = useMemo(() => {
    const groups: Record<AreaStatus, AssignedArea[]> = {
      ready: [],
      almost: [],
      working: [],
      held: [],
      blocked: [],
    };
    for (const area of areas) {
      groups[area.status].push(area);
    }
    return groups;
  }, [areas]);

  return {
    areas,
    grouped,
    pendingNods,
    isLoading,
    isConnected: syncStatus.connected,
    error,
    refresh: fetchAreas,
  };
}
