/**
 * useAreas — Foreman assigned areas with derived status.
 *
 * Uses PowerSync's db.watch() for reactive queries instead of polling.
 * watch() handles SQLite lock contention during initial sync gracefully,
 * emitting results as data arrives rather than blocking.
 *
 * Queries local SQLite via PowerSync:
 *   user_assignments → areas → area_trade_status → units
 *
 * Status derivation:
 *   BLOCKED  → active delay_log (ended_at IS NULL) for this area+trade
 *   HELD     → gc_verification_pending on area_trade_status
 *   READY    → effective_pct = 100 AND all_gates_passed
 *   ALMOST   → effective_pct >= 80
 *   WORKING  → default
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { usePowerSync } from './usePowerSync';
import type { AssignedArea, AreaStatus, PendingNod, ReportingMode } from '../types';

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
  reporting_mode: string | null;
  unit_id: string | null;
  unit_name: string | null;
  area_code: string | null;
  description: string | null;
  sort_order: number | null;
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
  unit_name: string | null;
  area_code: string | null;
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


const AREAS_QUERY = `
  SELECT
    a.id, a.name, a.floor, a.area_type, a.project_id,
    ua.trade_name,
    ats.effective_pct,
    ats.all_gates_passed,
    ats.gc_verification_pending,
    ats.reporting_mode,
    a.unit_id,
    a.area_code,
    a.description,
    a.sort_order,
    u.name as unit_name
  FROM user_assignments ua
  JOIN areas a ON a.id = ua.area_id
  LEFT JOIN area_trade_status ats
    ON ats.area_id = a.id AND ats.trade_type = ua.trade_name
  LEFT JOIN units u ON u.id = a.unit_id
  WHERE ua.user_id = ?
  ORDER BY u.sort_order, u.name, a.sort_order, a.name
`;

const DELAYS_QUERY = `
  SELECT dl.area_id, dl.trade_name
  FROM delay_logs dl
  JOIN user_assignments ua ON ua.area_id = dl.area_id
  WHERE ua.user_id = ? AND dl.ended_at IS NULL
`;

const NODS_QUERY = `
  SELECT nd.id as nod_id, dl.area_id, a.name as area_name,
         dl.reason_code, u.name as unit_name, a.area_code
  FROM nod_drafts nd
  JOIN delay_logs dl ON dl.id = nd.delay_log_id
  JOIN areas a ON a.id = dl.area_id
  LEFT JOIN units u ON u.id = a.unit_id
  JOIN user_assignments ua ON ua.area_id = dl.area_id
  WHERE ua.user_id = ? AND nd.sent_at IS NULL
`;

export function useAreas(userId: string | undefined) {
  const { db, status: syncStatus } = usePowerSync();

  const [areas, setAreas] = useState<AssignedArea[]>([]);
  const [pendingNods, setPendingNods] = useState<PendingNod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Manual refresh — runs a one-shot getAll for pull-to-refresh UX
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const rawAreas = await db.getAll<RawAreaRow>(AREAS_QUERY, [userId]);
      const activeDelays = await db.getAll<RawDelayRow>(DELAYS_QUERY, [userId]);
      processAndSetAreas(rawAreas, activeDelays);
    } catch (err) {
      console.warn('[useAreas] refresh error:', err instanceof Error ? err.message : String(err));
    }
  }, [db, userId]);

  function processAndSetAreas(rawAreas: RawAreaRow[], activeDelays: RawDelayRow[]) {
    const delaySet = new Set(
      activeDelays
        .filter((d) => d.area_id && d.trade_name)
        .map((d) => `${d.area_id}:${d.trade_name}`)
    );

    const derived: AssignedArea[] = rawAreas
      .filter((row) => row.id)
      .map((row) => {
        const effectivePct = row.effective_pct ?? 0;
        const allGatesPassed = (row.all_gates_passed ?? 1) === 1;
        const gcPending = (row.gc_verification_pending ?? 0) === 1;
        const tradeName = row.trade_name ?? 'unknown';
        const hasDelay = delaySet.has(`${row.id}:${tradeName}`);
        const reportingMode = (row.reporting_mode === 'checklist' ? 'checklist' : 'percentage') as ReportingMode;

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
          reporting_mode: reportingMode,
          status: deriveStatus(effectivePct, allGatesPassed, gcPending, hasDelay),
          last_report_at: null,
          unit_id: row.unit_id ?? null,
          unit_name: row.unit_name ?? null,
          area_code: row.area_code ?? null,
          description: row.description ?? null,
          sort_order: row.sort_order ?? 0,
        };
      });

    derived.sort((a, b) => {
      const unitA = a.unit_name ?? 'zzz';
      const unitB = b.unit_name ?? 'zzz';
      const unitDiff = unitA.localeCompare(unitB, undefined, { numeric: true });
      if (unitDiff !== 0) return unitDiff;
      const sortDiff = a.sort_order - b.sort_order;
      if (sortDiff !== 0) return sortDiff;
      return a.name.localeCompare(b.name);
    });

    setAreas(derived);
    setIsLoading(false);
    setError(null);
  }

  // Reactive watch — emits immediately when data changes (no polling, no lock issues)
  useEffect(() => {
    if (!userId) {
      setAreas([]);
      setPendingNods([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel any previous watch
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abort = new AbortController();
    abortRef.current = abort;

    setIsLoading(true);

    // Watch areas query — re-runs whenever user_assignments, areas, area_trade_status, or units change
    // watch() returns AsyncIterable<QueryResult> where rows._array has the typed data
    const watchAreas = async () => {
      try {
        for await (const result of db.watch(AREAS_QUERY, [userId], {
          signal: abort.signal,
        })) {
          if (abort.signal.aborted) break;

          const rawAreas = (result.rows?._array ?? []) as RawAreaRow[];

          // Fetch delays one-shot (changes are rare, no need to watch)
          let activeDelays: RawDelayRow[] = [];
          try {
            activeDelays = await db.getAll<RawDelayRow>(DELAYS_QUERY, [userId]);
          } catch {
            // Non-critical — continue without delay data
          }

          processAndSetAreas(rawAreas, activeDelays);
        }
      } catch (err) {
        if (abort.signal.aborted) return; // expected on cleanup
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useAreas] watch error:', msg);
        setError(msg);
        setIsLoading(false);
      }
    };

    // Watch NODs separately
    const watchNods = async () => {
      try {
        for await (const result of db.watch(NODS_QUERY, [userId], {
          signal: abort.signal,
        })) {
          if (abort.signal.aborted) break;
          const nods = (result.rows?._array ?? []) as RawNodRow[];
          setPendingNods(
            nods
              .filter((n) => n.nod_id && n.area_id)
              .map((n) => ({
                nod_id: n.nod_id!,
                area_id: n.area_id!,
                area_name: n.area_name ?? 'Unknown',
                reason_code: n.reason_code ?? 'unknown',
                unit_name: n.unit_name ?? null,
                area_code: n.area_code ?? null,
              }))
          );
        }
      } catch (err) {
        if (abort.signal.aborted) return;
        console.warn('[useAreas] nods watch error:', err instanceof Error ? err.message : String(err));
      }
    };

    watchAreas();
    watchNods();

    return () => {
      abort.abort();
    };
  }, [db, userId]);

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
    refresh,
  };
}
