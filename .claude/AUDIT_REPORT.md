# ReadyBoard — Structural Integrity Audit

**Date:** 2026-03-22
**Scope:** Weeks 1-6 (Full Stack)
**Tables audited:** 22 | **RLS policies:** 42 | **Helper functions:** 6

---

## Executive Summary

| Severity | RLS & Security | Flow Integrity | Technical Debt | TOTAL |
|----------|:-:|:-:|:-:|:-:|
| **HIGH** | 5 | 5 | 1 | **11** |
| **MEDIUM** | 8 | 3 | 10 | **21** |
| **LOW** | 3 | 1 | 9 | **13** |
| **TOTAL** | 16 | 9 | 20 | **45** |

### The Three Systemic Patterns

1. **The Foreman Leak** — Foremen can read cost data, audit logs, legal docs, and financial records across 6+ tables. Root cause: RLS policies use `get_accessible_area_ids()` or `get_user_org_id()` without role restrictions.

2. **The Audit Void** — Only 2 code paths (both in `scheduleOverride.ts`) write to `audit_log`. The entire legal lifecycle (NOD sent, published), change order lifecycle (create, approve, reject), and corrective action lifecycle are completely unaudited.

3. **The Disconnected Forecast** — Change order approvals and scope changes have zero impact on forecast projections. The `scope_changes` table is a schema placeholder with no implementation.

---

## PART 1: RLS & Security Findings

### HIGH Severity

#### S-1: Foreman reads ALL cost data in `delay_logs`
- **Table:** `delay_logs`
- **Policy:** `"Users see project delay logs"` — uses `get_accessible_area_ids()` with no role filter
- **Impact:** Foreman sees `daily_cost`, `cumulative_cost`, `man_hours` — per CLAUDE.md this is prohibited
- **Fix:** Add `AND get_user_role() != 'foreman'` or create `is_sub_management()` helper

#### S-2: Foreman reads `change_orders` (financial data)
- **Table:** `change_orders`
- **Policy:** `"Project members can view change orders"` — org-only check
- **Impact:** Foreman sees CO `amount` column — contractual financial data
- **Fix:** Restrict SELECT to management roles

#### S-3: Foreman reads `audit_log` (sensitive JSONB data)
- **Table:** `audit_log`
- **Policy:** `"audit_log_select"` — only checks org membership via `changed_by`
- **Impact:** Foreman sees `old_value`/`new_value` JSONB containing costs, legal changes, overrides
- **Fix:** Restrict to `sub_pm`, `superintendent`, `gc_admin`, `gc_pm`, `owner`

#### S-4: Foreman reads `legal_documents` (SHA-256, PDFs, signatures)
- **Table:** `legal_documents`
- **Policy:** `"Sub sees own legal docs"` — checks `org_id = get_user_org_id()` with no role filter
- **Impact:** Foreman sees all org legal docs including SHA-256 hashes, PDF URLs, tracking data
- **Fix:** Add `AND get_user_role() IN ('sub_pm', 'superintendent')`

#### S-5: `import_schedule_batch()` RPC has ZERO authorization
- **Function:** `import_schedule_batch()` — `SECURITY DEFINER` (bypasses all RLS)
- **Impact:** ANY authenticated user (any org, any role) can INSERT/UPDATE schedule items on ANY project
- **Fix:** Add authorization check at function top: validate caller's org owns the project AND role is `gc_admin` or `owner`

### MEDIUM Severity

| ID | Table | Issue | Fix |
|----|-------|-------|-----|
| S-6 | `scope_changes` | Foreman reads `delta_sqft`, `forecast_impact_days` | Add management role filter |
| S-7 | `forecast_snapshots` | Foreman reads `actual_rate`, `benchmark_rate` | Add management role filter |
| S-8 | `production_benchmarks` | Foreman reads expected production rates | Add management role filter |
| S-9 | `audit_log` | ANY authenticated user can INSERT arbitrary entries | Restrict to management roles or service-role only |
| S-10 | `change_orders` | Foreman can INSERT (propose) change orders | Add management role filter on INSERT |
| S-11 | `receipt_events` | No INSERT policy — tracking pixel may be broken | Add INSERT policy or confirm service-role only |
| S-12 | `nod_drafts` | No INSERT or UPDATE policy — superintendent can't mark as sent | Add UPDATE policy for `sub_pm`/`superintendent` |
| S-13 | `delay_logs` | No INSERT policy — mobile sync may be silently blocked | Add INSERT policy for foreman on assigned areas OR confirm service-role |

### LOW Severity

| ID | Issue | Note |
|----|-------|------|
| S-14 | `corrective_actions` UPDATE has no org isolation | Uses `assigned_to = auth.uid()` only — UUID collision risk is theoretical |
| S-15 | `projects` exposes `labor_rate_per_hour` to foremen | Column-level security needed (VIEW approach) |
| S-16 | 17/22 tables have no DELETE policy | Acceptable for append-only audit system; add for `notifications` cleanup |
| S-17 | `get_accessible_area_ids()` doesn't handle multi-sub | Not exploitable today (single `sub_org_id`) |

### Recommended New Helper Function

```sql
CREATE OR REPLACE FUNCTION is_sub_management()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role IN ('sub_pm', 'superintendent')
  FROM public.users WHERE id = auth.uid();
$$;
```

This fixes S-1 through S-4 and S-6 through S-8 by replacing org-only checks with `is_sub_management()` on sensitive tables.

---

## PART 2: Flow Integrity Findings

### HIGH Severity

#### F-1: Change Order approval has NO forecast impact
- **File:** `features/finance/services/changeOrderEngine.ts` → `approveChangeOrder()`
- **Issue:** Approving a $50K CO only updates `change_orders.status`. Does NOT call `refreshProjectForecast()` or write to `scope_changes`.
- **Impact:** GC sees stale forecast projections after significant financial events
- **Fix:** After approval, call `refreshProjectForecast()` or write to a recalculation queue

#### F-2: audit_log has ZERO entries for legal lifecycle
- **Files:** `nodAutoGen.ts`, `thresholdEngine.ts`, `pdfAssembler.ts`, `publishLegalDoc.ts`
- **Issue:** NOD sent, legal_status changes, document publication — all unaudited
- **Impact:** In arbitration, no system-level proof of when legal events occurred beyond raw `updated_at` timestamps
- **Fix:** Add audit_log INSERTs to all legal state transitions

#### F-3: audit_log CHECK constraint mismatch (DB vs migration file)
- **DB constraint:** `('manual_override', 'status_change', 'config_change', 'import')`
- **Migration file:** `('manual_override', 'status_change', 'scope_change', 'legal_doc_sent')`
- **Impact:** If code writes `'legal_doc_sent'`, the INSERT fails with constraint violation
- **Fix:** ALTER constraint to include all needed action types

#### F-4: Forecast rollback race condition (DELETE + INSERT without transaction)
- **File:** `forecastEngine.ts:234-247`
- **Issue:** Supabase `upsert` with `onConflict` on a COALESCE expression likely always fails → every refresh falls into DELETE + INSERT fallback. Two concurrent calls interleave destructively.
- **Impact:** Data loss or constraint violations on concurrent forecast refreshes
- **Fix:** Create a Postgres RPC `upsert_forecast_snapshots(jsonb)` using `INSERT ... ON CONFLICT DO UPDATE` in a single transaction

#### F-5: Change Order rejection hard-deletes financial records
- **File:** `changeOrderEngine.ts` → `rejectChangeOrder()`
- **Issue:** Rejected COs are DELETEd from the database with no audit trail
- **Impact:** Financial record vanishes completely — bad for audit compliance
- **Fix:** Soft-delete with `rejected_at` + `rejected_by` columns. Never hard-delete financial records.

### MEDIUM Severity

| ID | Issue | Impact |
|----|-------|--------|
| F-6 | `crew_size=NULL` on mobile delay_log INSERT | Cost calculations produce $0; NOD draft shows $0 |
| F-7 | `scope_changes` table completely unused | Schema placeholder — `forecast_impact_days` never consumed |
| F-8 | Upsert `onConflict` with COALESCE always fails | System always falls through to DELETE+INSERT (compounds F-4) |
| F-9 | Corrective action lifecycle unaudited | CA creation, acknowledgment, resolution — no audit entries |

### LOW Severity

| ID | Issue | Note |
|----|-------|------|
| F-10 | `daily_cost` is a rate constant, not pro-rated actual | Semantic display issue only |

### Flow Verification Results

| Verification Point | Status |
|----|--------|
| field_report BLOCKED → delay_log creation | **PASS** |
| delay_log exists → NOD draft auto-generates | **PASS** |
| NOD → Change Order linking | **PASS** |
| Change Order approved → forecast impact | **FAIL** |
| scope_changes → forecast recalculation | **FAIL** |
| audit_log captures all state transitions | **FAIL** |

---

## PART 3: Technical Debt Findings

### HIGH Severity

#### T-1: Hardcoded UUID nil in UPSERT conflict string
- **File:** `forecastEngine.ts:229`
- **Value:** `'project_id,COALESCE(area_id,00000000-...),trade_type,snapshot_date'`
- **Fix:** Replace with RPC approach (also fixes F-4)

### MEDIUM Severity

| ID | Issue | Files |
|----|-------|-------|
| T-2 | Missing monorepo aliases in `vitest.config.ts` | `@readyboard/db`, `@readyboard/shared` not mapped |
| T-3 | Duplicated `ScheduleComparisonRow` type | `forecast/types.ts` AND `dashboard/types/index.ts` |
| T-4 | Duplicated `fetchScheduleComparison` logic | `forecast/services/` AND inline in `dashboard/services/fetchDashboardData.ts` |
| T-5 | `AT_RISK_THRESHOLD_DAYS = 3` defined 3 times | forecastEngine, fetchDashboardData, generateExecutiveReport |
| T-6 | Hardcoded storage bucket `'legal-docs'` | `exportExecutivePdf.ts` — should import from `evidenceStorage.ts` |
| T-7 | `BurnRateData` type exported but never consumed | `forecast/types.ts` + barrel export |
| T-8 | Forecast barrel exports never consumed externally | Awaiting page/route wiring |
| T-9 | Reports barrel exports never consumed externally | Awaiting page/route wiring |
| T-10 | Finance barrel exports never consumed externally | Except `convertToChangeOrder` used by AlertsSection |
| T-11 | Dashboard delay exports never consumed externally | Awaiting page/route wiring |

### LOW Severity

| ID | Issue |
|----|-------|
| T-12 | Unused import `ExecutiveReportData` in `exportExecutivePdf.ts` |
| T-13 | Inline `86_400_000` magic number (3 occurrences in fetchDashboardData) |
| T-14 | Inline `3_600_000` magic number (2 occurrences) |
| T-15 | Hardcoded query limits (5, 10, 20) without named constants |
| T-16 | Duplicated `GC_OVERRIDE_ROLES` / `GC_APPROVE_ROLES` same values |
| T-17 | Duplicated `MS_PER_DAY` in 2 files |
| T-18 | Duplicated `REASON_LABELS` in AlertsSection + NodDraftsSection |
| T-19 | Test file uses inline `86_400_000` |
| T-20 | PDF dimensions hardcoded (already named constants — acceptable) |

### Clean Areas
- **Console statements in Week 5-6 scope:** 0
- **TODO/FIXME/HACK in Week 5-6 scope:** 0

---

## Recommended Fix Order (Post-Approval)

### Phase 1 — Security (Critical)
1. Create `is_sub_management()` helper function
2. Fix foreman leak on 6 tables (S-1 through S-4, S-6 through S-8)
3. Add authorization to `import_schedule_batch()` RPC (S-5)
4. Fix audit_log INSERT policy (S-9)
5. Add missing INSERT/UPDATE policies for `nod_drafts` and `delay_logs` (S-12, S-13)

### Phase 2 — Flow Integrity (Critical)
1. ALTER `audit_log.action` CHECK constraint to include all action types (F-3)
2. Add audit_log writes to legal and CO lifecycle (F-2, F-5)
3. Soft-delete for rejected change orders (F-5)
4. Replace forecast DELETE+INSERT with RPC upsert (F-4, T-1)
5. Wire CO approval → forecast refresh (F-1)

### Phase 3 — Technical Debt (Cleanup)
1. Fix vitest monorepo aliases (T-2)
2. Consolidate duplicated types and logic (T-3, T-4, T-5)
3. Extract shared constants (T-13 through T-18)
4. Remove dead exports and unused imports (T-7, T-12)

---

*Audit complete. 45 findings across 3 domains. Awaiting approval to proceed with fixes.*

---
---

# Hardening Sprint — Post-Week 7 Audit

**Date:** 2026-03-23
**Scope:** Weeks 1-7 (data integrity, RLS, N+1 queries, types)
**Result:** 5 issues found, 5 fixed. Build + tests green.

---

## 1. SHA-256 & Audit Log Integrity

**Status:** PASS

| Check | Result |
|-------|--------|
| `generateNodPdf` writes SHA-256 hash | `crypto.createHash('sha256')` stored in `legal_documents.sha256_hash` |
| `generateRea` writes SHA-256 hash | Same pattern |
| `generateEvidencePackage` writes SHA-256 hash | Same pattern + hash printed in PDF footer |
| `audit_log` entry on NOD send | `writeAuditEntry('nod_sent', ...)` in `sendNod.ts` |
| `audit_log` entry on REA generation | `writeAuditEntry('rea_generated', ...)` in `generateRea.ts` |
| `audit_log` entry on Evidence Package | `writeAuditEntry('evidence_package_generated', ...)` |
| `audit_log` entry on corrective action | `writeAuditEntry('ca_created', ...)` in `createCorrectiveAction.ts` |
| `receipt_tracking_uuid` linked correctly | Tracking pixel route queries by UUID, creates event |
| `delay_logs.evidence_hash` + `evidence_path` | Both columns exist and populated |
| `/api/legal/verify` endpoint | Public SHA-256 verification works |

**No anomalies.**

---

## 2. RLS Stress Test — 51 Policies, 23 Tables

**3 issues found, 3 fixed via migration.**

### 2a. receipt_events INSERT `WITH CHECK(true)` — HIGH

- **Risk:** Any authenticated user could fabricate receipt open events
- **Fix:** Dropped policy. Tracking pixel uses `createServiceClient()` (bypasses RLS).

### 2b. audit_log SELECT cross-org leak — HIGH

- **Before:** `USING (is_gc_role() OR is_sub_management())` — no org scoping
- **Fix:** `AND changed_by IN (SELECT id FROM users WHERE org_id = get_user_org_id())`

### 2c. legal_documents duplicate GC SELECT — MEDIUM

- **Before:** Two GC SELECT policies, one missing `is_gc_role()` check
- **Fix:** Dropped `"GC sees published legal docs only"`. Kept `"GC sees published legal docs"`.

### Migration: `20260323_harden_rls_receipt_events_audit_log_legal_docs.sql`

---

## 3. N+1 Query Audit

**2 critical issues found, 2 fixed.**

### 3a. notificationTrigger.ts — CRITICAL

- **Before:** Per-delay anti-spam check (N queries) + per-delay INSERT (N queries)
- **After:** 1 batch anti-spam query + Set-based filtering + 1 batch INSERT
- **Reduction:** 2N+1 → 3 queries

### 3b. escalationCheck.ts — CRITICAL

- **Before:** Per-doc CA check + per-notification anti-spam + per-notification INSERT
- **After:** 1 batch CA count + 1 batch anti-spam + Set-based filtering + 1 batch INSERT
- **Reduction:** ~3N → ~5 queries

### Other queries (no issues)

| File | Pattern | Status |
|------|---------|--------|
| `fetchDashboardData.ts` | 4 parallel queries | OK |
| `fetchLegalDocs.ts` | Single query with areas join | OK |
| `fetchDelayLogsForRea.ts` | Single query with areas join | OK |
| `fetchPreflightData.ts` | 4 parallel count queries | OK |
| `fetchNotifications.ts` | Single query | OK |

---

## 4. TypeScript + Build + Tests

**Status:** PASS

| Check | Result |
|-------|--------|
| `tsc --noEmit` | 0 errors |
| `next build` | Clean — 7 routes |
| `vitest run` | 50/50 pass |

---

## Files Changed (Hardening Sprint)

| File | Change |
|------|--------|
| `features/dashboard/services/notificationTrigger.ts` | Batched anti-spam + batch INSERT |
| `features/legal/services/escalationCheck.ts` | Batched CA check + anti-spam + batch INSERT |
| `supabase/migrations/20260323_harden_...sql` | 3 RLS policy fixes |

---

*Hardening Sprint complete. Core is arbitration-ready.*
