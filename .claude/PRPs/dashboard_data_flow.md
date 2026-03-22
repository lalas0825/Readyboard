# Data Flow: Foreman Report → Ready Board Grid

**Date:** 2026-03-21
**Status:** AUDIT COMPLETE — 3 gaps found, migrations proposed

---

## 1. Schema Audit Results

### What EXISTS and WORKS

| Component | Status | Notes |
|-----------|--------|-------|
| `areas` table | ✅ | `floor` (text), `name`, `area_type`, `project_id` |
| `areas` indexes | ✅ | `idx_areas_project`, `idx_areas_floor(project_id, floor)` |
| `area_trade_status` table | ✅ | `effective_pct`, `all_gates_passed`, `gc_verification_pending` |
| `area_trade_status` UNIQUE | ✅ | `(area_id, trade_type)` — prevents duplicates |
| `area_trade_status` indexes | ✅ | `idx_ats_area`, `idx_ats_pending_gc` |
| `trade_sequences` | ✅ | 14 trades × bathroom, ordered by `sequence_order` |
| `calculate_effective_pct()` trigger | ✅ | Fires on INSERT/UPDATE of `area_trade_status`, handles both percentage + checklist modes |
| `field_reports` | ✅ | GPS, timestamp, reason_code, progress_pct |
| `delay_logs` | ✅ | Cost tracking, reason_code, ended_at for active detection |
| `corrective_actions` | ✅ | Full lifecycle timestamps |

### GAP 1 — CRITICAL: No propagation trigger `field_reports` → `area_trade_status`

**Problem:** When a foreman submits a report with `progress_pct = 65`, nothing updates `area_trade_status.manual_pct`. The `calculate_effective_pct` trigger only fires when `area_trade_status` itself is modified. The Ready Board grid reads from `area_trade_status` — if it never updates, the grid shows stale data.

**Current flow (broken):**
```
Foreman report → field_reports INSERT → ??? → area_trade_status NEVER UPDATES
```

**Fix:** `AFTER INSERT` trigger on `field_reports`:
```sql
CREATE OR REPLACE FUNCTION propagate_report_to_ats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE area_trade_status
  SET manual_pct = NEW.progress_pct,
      updated_at = NOW()
  WHERE area_id = NEW.area_id
    AND trade_type = NEW.trade_name;
  -- calculate_effective_pct trigger fires automatically on this UPDATE
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_propagate_report
  AFTER INSERT ON field_reports
  FOR EACH ROW
  EXECUTE FUNCTION propagate_report_to_ats();
```

**Why this works:** The UPDATE triggers `calculate_effective_pct`, which sets `effective_pct = manual_pct` (percentage mode). Two triggers, one chain: `field_reports INSERT → area_trade_status UPDATE → calculate_effective_pct → Realtime broadcasts`.

### GAP 2 — CRITICAL: Supabase Realtime not enabled

**Problem:** `supabase_realtime` publication has **0 tables**. The GC Dashboard cannot receive live updates.

**Fix:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE area_trade_status;
ALTER PUBLICATION supabase_realtime ADD TABLE delay_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE corrective_actions;
```

Only these 3 tables need Realtime for Week 3:
- `area_trade_status` — grid cells update when foremen report
- `delay_logs` — alerts section shows active delays with costs
- `corrective_actions` — action lifecycle updates in real-time

### GAP 3 — SEED DATA: Only 30 of 420 rows in `area_trade_status`

**Problem:** Only "Tile / Stone" entries exist (Jantile's trade). The grid needs ALL 14 trades × 30 areas = 420 rows.

**Fix:** INSERT remaining 390 rows with realistic demo data:
- Trades 1-3 (Plumbing, Framing, MEP): 100% on floors 20-22, varied on 23-24
- Trades 4-6 (Fire Stop, Drywall, Waterproof): 100% on floor 20, progressing on 21-22
- Trades 7+ (Tile onward): 0% except floor 20

This creates a realistic "wave" pattern in the grid — lower floors ahead, upper floors behind.

---

## 2. Realtime Contract

### Subscription Design

```typescript
// GC Dashboard subscribes to area_trade_status changes for their project
const channel = supabase
  .channel('readyboard-grid')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'area_trade_status',
  }, (payload) => {
    // payload.new contains updated row
    // Client checks if area_id belongs to current project
    updateGridCell(payload.new)
  })
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'delay_logs',
  }, (payload) => {
    // New delay → update alerts section
    addAlert(payload.new)
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'corrective_actions',
  }, (payload) => {
    // CA lifecycle update → refresh action status
    updateAction(payload.new)
  })
  .subscribe()
```

### Why no project_id filter on Realtime?

`area_trade_status` doesn't have `project_id` directly — it's through `areas.project_id`. Supabase Realtime filters only work on direct columns. Two options:

1. **Client-side filter** (recommended for V1): Subscribe to all changes, filter in `updateGridCell()` by checking if `area_id` belongs to the loaded project's area list. With <500 rows per project, this is negligible overhead.

2. **Denormalize** (future): Add `project_id` to `area_trade_status` for server-side filtering. Only needed at scale (50+ simultaneous projects).

---

## 3. Data Flow: End-to-End

```
┌──────────────────┐
│  Foreman Phone   │
│  (Offline-First) │
└────────┬─────────┘
         │ 1. Creates field_report in local SQLite
         │    (progress_pct, status, reason_code, GPS)
         │
         ▼
┌──────────────────┐
│    PowerSync     │
│  (Background)    │
└────────┬─────────┘
         │ 2. Syncs field_report INSERT to Supabase
         │    (when connectivity available)
         │
         ▼
┌──────────────────┐
│    Supabase      │
│  field_reports   │
└────────┬─────────┘
         │ 3. trg_propagate_report fires (NEW trigger)
         │    → UPDATE area_trade_status SET manual_pct = progress_pct
         │
         ▼
┌──────────────────────┐
│      Supabase        │
│  area_trade_status   │
└────────┬─────────────┘
         │ 4. trg_calculate_effective_pct fires (existing)
         │    → effective_pct = manual_pct (percentage mode)
         │
         │ 5. Supabase Realtime broadcasts UPDATE event
         │
         ▼
┌──────────────────┐
│  GC Dashboard    │
│  (Next.js Web)   │
└──────────────────┘
  6. Realtime subscription receives payload
  7. Client computes derived status (READY/ALMOST/BLOCKED/HELD/DONE)
  8. Grid cell updates with new color + percentage
```

### Status Derivation (Client-Side)

The derived status for each cell `(area, trade)` is computed by the client using all `area_trade_status` rows for that area + the `trade_sequences` order:

```typescript
function deriveStatus(
  currentTrade: AreaTradeStatus,
  priorTrades: AreaTradeStatus[], // all trades with lower sequence_order
  activeDelays: DelayLog[]        // delay_logs where ended_at IS NULL
): GridStatus {
  // 1. DONE: this trade is complete
  if (currentTrade.effective_pct >= 100 && currentTrade.all_gates_passed) {
    return 'done';
  }

  // 2. HELD: active external blocker on this area+trade
  const hasActiveDelay = activeDelays.some(
    d => d.area_id === currentTrade.area_id
      && d.trade_name === currentTrade.trade_type
      && d.ended_at === null
  );
  if (hasActiveDelay) {
    return 'held';
  }

  // 3. First trade in sequence: always READY (no prior deps)
  if (priorTrades.length === 0) {
    return currentTrade.effective_pct > 0 ? 'working' : 'ready';
  }

  // 4. Check ALL prior trades
  const allPriorDone = priorTrades.every(
    t => t.effective_pct >= 100 && t.all_gates_passed
  );
  if (allPriorDone) {
    return 'ready';
  }

  // 5. Check IMMEDIATE prior trade
  const immediatePrior = priorTrades[priorTrades.length - 1];
  if (immediatePrior.effective_pct >= 80) {
    return 'almost';
  }

  // 6. Default
  return 'blocked';
}
```

**Why client-side, not DB trigger?**
- Avoids cascade triggers (updating trade N would re-trigger trades N+1..14)
- The grid already has all the data loaded (single query)
- Status is a view concern, not a storage concern
- Simpler to test and debug

### Grid Query (Single Query, No N+1)

```sql
SELECT
  a.id AS area_id,
  a.name AS area_name,
  a.floor,
  a.area_type,
  ats.trade_type,
  ats.effective_pct,
  ats.all_gates_passed,
  ats.gc_verification_pending,
  ats.reporting_mode,
  ts.sequence_order,
  dl.id AS active_delay_id,
  dl.reason_code AS delay_reason,
  dl.cumulative_cost AS delay_cost,
  dl.started_at AS delay_started
FROM areas a
JOIN area_trade_status ats ON ats.area_id = a.id
JOIN trade_sequences ts
  ON ts.trade_name = ats.trade_type
  AND ts.project_id = a.project_id
  AND ts.area_type = a.area_type
LEFT JOIN delay_logs dl
  ON dl.area_id = a.id
  AND dl.trade_name = ats.trade_type
  AND dl.ended_at IS NULL
WHERE a.project_id = $1
ORDER BY a.floor, a.name, ts.sequence_order;
```

This returns the full grid in ONE query. No N+1. Client groups by floor, then by area, then maps trades to columns.

---

## 4. Proposed Migration Summary

| # | Migration | Type | Why |
|---|-----------|------|-----|
| 1 | `propagate_report_to_ats` trigger | DDL | Links field_reports → area_trade_status |
| 2 | Enable Realtime on 3 tables | DDL | Live dashboard updates |
| 3 | Seed 390 `area_trade_status` rows | DML | Full grid demo data with wave pattern |

**No schema changes to existing tables.** No new columns needed. The existing schema supports the grid — it just needs the trigger to connect the data flow.

---

*Golden Path: field_report → trigger → area_trade_status → Realtime → grid.*
