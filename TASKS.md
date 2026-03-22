# ReadyBoard — TASKS.md

> Version 5.2 — 7-week V1 build + Week 8-9 Checklist System sprint
> AI is explicitly OUT of scope for V1.
> Checklist System (V1.1) is Week 8-9, immediately post-launch.
> Updated: 2026-03-22 — Week 4 in progress (Delay Engine + Legal Infrastructure)

---

## Pre-Build (Week 0 — Before Writing Code)

- [ ] **LEGAL:** Find NYC construction litigation attorney for 2h template review. Budget: $600-1,200. Schedule for Week 5-6 parallel with PDF build.
- [ ] **LEGAL:** Confirm AIA A201 §8.3.1 clause text for NOD template
- [ ] **LEGAL:** Confirm ConsensusDocs 200 §6.3 language for NOD alternate reference
- [ ] **PRODUCT:** Finalize trade sequences for tile/stone (bathroom, kitchen, hallway, lobby)
- [ ] **PRODUCT:** Get real production benchmarks from Sal (sqft/hr/person by area type + material)
- [ ] **PRODUCT:** Get real labor rates from current projects ($X/hr fully burdened)
- [ ] **DESIGN:** Test foreman mobile in direct sunlight — high contrast light theme
- [ ] **DESIGN:** Paper mockup of 3-step foreman flow (slider → blockers → reason codes)
- [x] **INFRA:** Set up Supabase project (readyboard-prod)
- [ ] **INFRA:** Set up Expo project (readyboard-mobile)
- [x] **INFRA:** Set up Next.js project (readyboard-web)
- [x] **INFRA:** Set up Turborepo monorepo structure
- [ ] **INFRA:** Set up Vercel project for web dashboard
- [ ] **DEMO:** Show 1-Screen Dashboard artifact to Jantile PM. Ask: "If you had this at 7am, how many calls would you not make?" Listen. Write down exact words.

---

## Week 1 — Foundation + Data Model

### Supabase Schema ✅

- [x] Create `organizations` table (name, type: GC|SUB, default_language, logo_url, legal_template_version)
- [x] Create `projects` table (name, address, labor_rate_per_hour, legal_jurisdiction, sha256_enabled DEFAULT true, gc_org_id, sub_org_id)
- [x] Create `users` table (email, phone, name, role, language, org_id)
- [x] Create `areas` table (name, floor, area_type, project_id, total_sqft, original_sqft)
- [x] Create `trade_sequences` table (project_id, area_type, trade_name, sequence_order)
- [x] Create `user_assignments` table (user_id, area_id, trade_name)
- [x] Create `production_benchmarks` table (project_id, trade_name, area_type, sqft_per_hour_per_person)
- [x] Create `area_trade_status` table (area_id, trade_type, reporting_mode DEFAULT 'percentage', manual_pct, calculated_pct, effective_pct, all_gates_passed DEFAULT false, gc_verification_pending, gc_verification_pending_since)
- [x] Create `field_reports` table (area_id, user_id, status, progress_pct, reason_code, gps_lat, gps_lng, photo_url, created_at, offline_created_at, device_id)
- [x] Create `delay_logs` table (area_id, trade_name, reason_code, started_at, man_hours, daily_cost, cumulative_cost, nod_draft_id, rea_id, receipt_confirmed)
- [x] Create `corrective_actions` table (delay_log_id, assigned_to, deadline, note, created_at, acknowledged_at, in_resolution_at, resolved_at, created_by)
- [x] Create `legal_documents` table (project_id, org_id, type: NOD|REA|EVIDENCE, sha256_hash, receipt_tracking_uuid, first_opened_at, open_count, sent_at, sent_by, signature_png_url, pdf_url)
- [x] Create `nod_drafts` table (delay_log_id, draft_content_jsonb, reminder_sent_at, sent_at, sent_by)
- [x] Create `receipt_events` table (document_id, event_type, ip_address, device_type, opened_at)
- [x] Create `schedule_items` table (project_id, area_name, trade_name, planned_start, planned_finish, p6_activity_id)
- [x] Create `scope_changes` table (area_id, delta_sqft, reason, change_order_ref, initiated_by, gc_initiated BOOLEAN, forecast_impact_days, created_at)
- [x] Create `forecast_snapshots` table (project_id, area_id, trade_type, snapshot_date, effective_pct, actual_rate, benchmark_rate, projected_date, scheduled_date, delta_days, recommendations JSONB)
- [x] Write RLS policies: foreman sees only assigned areas (33 policies + `get_accessible_area_ids()` SECURITY DEFINER fix)
- [x] Write RLS policies: sub PM sees all areas for their trade
- [x] Write RLS policies: GC PM sees all areas across all trades
- [x] Write RLS policies: legal_documents private to sub until published
- [x] Write RLS policies: organization isolation (GC A ≠ GC B)
- [x] Write RLS policies: SUB can only complete SUB tasks in area_tasks
- [x] Write RLS policies: GC can only complete GC tasks in area_tasks
- [x] Seed data: 383 Madison project, Tishman as GC, Jantile as sub, 5 floors, baths A-F
- [x] RLS security audit: 3 attack scenarios tested + scripts saved (scripts/test-rls.sql)

### i18n Architecture ✅

- [x] Set up next-intl for web dashboard (next-intl v4.8 + request.ts + middleware)
- [x] Create EN translation file — all UI strings (`messages/en.json`)
- [x] Create ES translation file — all UI strings (`messages/es.json`)
- [x] Create reason_codes translations (EN + ES) — delay reasons + checklist correction reasons
- [x] Create notification_templates translations (EN + ES)
- [x] Auto-detect locale from browser Accept-Language header

### SHA-256 Infrastructure ✅

- [x] Create `src/lib/legal/hash.ts` — SHA-256 hash function for PDF buffers
- [x] Create `src/lib/legal/verify.ts` — hash verification endpoint logic
- [x] Create `GET /api/legal/verify?hash=[hash]` endpoint — tested 4 scenarios (valid, not_found, invalid_format, missing_param)
- [x] Confirm `sha256_hash` column in `legal_documents` (done in schema above)

### PowerSync Schema ✅

- [x] Define PowerSync sync rules (`packages/db/src/powersync/sync-rules.yaml` — v5.1, 5 bugs fixed)
- [x] `field_reports`, `area_trade_status`, `area_tasks`, `user_assignments`, `nod_drafts` — sync to mobile
- [x] Define conflict resolution: last-write-wins with `offline_created_at`
- [x] Set up PowerSync project + connect to Supabase (PowerSync Cloud: `69bca667470f5291b29d919d`)

---

## Week 2 — Foreman Mobile Engine (Offline-First Data Pipeline)

### Monorepo Turborepo ✅

- [x] Restructure project to Turborepo monorepo (`apps/web`, `apps/mobile`, `packages/db`, `packages/shared`)
- [x] Move Next.js app to `apps/web/` (git rename detection preserved history)
- [x] Create root workspace `package.json` with npm workspaces
- [x] Create `turbo.json` with dev/build/lint/typecheck tasks
- [x] Update `apps/web/next.config.ts` with `transpilePackages`
- [x] Update `apps/web/tsconfig.json` with paths to internal packages
- [x] Upgrade Tailwind CSS v3.4 → v4 (`@tailwindcss/postcss`, removed `tailwind.config.ts`)
- [x] Verify: `npm run dev:web` works, all routes functional, 0 TypeScript errors

### PowerSync packages/db ✅

- [x] Create `packages/db/` with `@powersync/common` v1.49 + `@supabase/supabase-js`
- [x] `packages/db/src/powersync/schema.ts` — 11 synced tables using `column.text/integer/real` API
- [x] `packages/db/src/powersync/sync-rules.yaml` — v5.1 with 5 bug fixes (org_id, progress_pct, status, area_trade_status, area_tasks, NOD join)
- [x] `packages/db/src/powersync/SupabaseConnector.ts` — fetchCredentials (proactive refresh) + uploadData (PUT/PATCH/DELETE) with observability logging
- [x] Barrel export `packages/db/src/index.ts`
- [x] TypeScript clean: 0 errors across all 3 workspaces

### Shared Hooks (packages/shared) ✅

- [x] `PowerSyncProvider` — platform-agnostic context wrapping `AbstractPowerSyncDatabase` (createElement for React 18/19 compat)
- [x] `usePowerSync()` hook — exposes `{ db, status }` with `connected`, `lastSyncedAt`, `hasSynced`
- [x] `useFieldReport()` hook — `createReport()` INSERT local SQLite + `getReportsForArea()` SELECT
- [x] Shared types: `FieldReportInput`, `PowerSyncStatus`, `ReasonCode`, `UserRole`
- [x] Barrel export via `packages/shared/src/index.ts`
- [x] Fix: `@types/react` dual version (18 mobile / 19 web) resolved via npm override + postinstall dedup

### Expo Scaffold (apps/mobile) ✅

- [x] Initialize Expo project (SDK 52, expo-router 4, TypeScript)
- [x] `PowerSyncMobileProvider` — initializes `PowerSyncDatabase` (SQLite), connects PowerSync Cloud, syncStatus listener
- [x] `AuthProvider` — Supabase Auth with `onAuthStateChange`, re-uses connector's Supabase client
- [x] `app/_layout.tsx` — `AuthProvider → PowerSyncMobileProvider → Slot`
- [x] `app/index.tsx` — Pipeline status placeholder (Auth + PowerSync connectivity indicators)
- [x] `.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_POWERSYNC_URL`
- [x] `package.json` — scripts include `prebuild`, `prebuild:clean` for native builds
- [x] TypeScript clean: 0 errors across all 4 workspaces (db, shared, web, mobile)

### Offline Sync Validation (Fase 4) ✅

- [x] Enhanced `SupabaseConnector.uploadData` error logging: structured `{ message, code, details, hint, context }` per operation
- [x] Enhanced `apps/mobile/app/index.tsx` with full observability: sync status (color-coded), pending upload count, local report count, error details, live log
- [x] Added "Create Test Report" button using `createReport()` from shared hook for offline testing
- [x] Created `scripts/test-offline-sync.ts` — server-side sync pipeline test (22/22 assertions passed):
  - Auth user creation + `handle_new_user` trigger auto-creates profile
  - Field report INSERT with `offline_created_at` (simulates PowerSync upload)
  - All field values verified (area_id, user_id, trade_name, status, progress_pct, GPS, device_id, app_version)
  - Conflict resolution invariant: `offline_created_at <= created_at` (30s delta confirmed)
  - Cleanup verified (0 residual rows)
- [x] `expo prebuild` — Android native directory generated successfully
- [x] `npm run typecheck` — 4/4 workspaces clean (db, shared, web, mobile)
- [x] Added `packageManager` field to root `package.json` (required by Turbo 2.8+)

### Native Capabilities + i18n (Sprint A) ✅

- [x] Install + configure `expo-camera` (plugin + iOS NSCameraUsageDescription + Android CAMERA permission)
- [x] Install + configure `expo-location` (plugin + iOS NSLocationWhenInUseUsageDescription + Android ACCESS_FINE/COARSE_LOCATION)
- [x] Install + configure `expo-haptics` (Android VIBRATE permission)
- [x] Install + configure `expo-localization` (plugin + auto language detection from device)
- [x] Update `apps/mobile/app.json` with all plugins + iOS infoPlist + Android permissions
- [x] `expo prebuild --clean` — regenerated Android native directory with correct permissions
- [x] Install `i18next` + `react-i18next` in mobile
- [x] Create `packages/shared/src/i18n/en.json` — 165+ keys (common, auth, dashboard, readyBoard, fieldReport, reasonCodes, legal, trades, etc.)
- [x] Create `packages/shared/src/i18n/es.json` — full Spanish translations matching en.json
- [x] Create `packages/shared/src/i18n/index.ts` — barrel export (translations, SupportedLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE)
- [x] Update `packages/shared/src/index.ts` — add i18n exports
- [x] Create `apps/mobile/src/providers/I18nProvider.tsx` — i18next + expo-localization auto-detect + `changeLanguage()` export
- [x] Update `apps/mobile/app/_layout.tsx` — provider chain: I18nProvider → AuthProvider → PowerSyncMobileProvider → Slot
- [x] Verify offline-first: ALL reads/writes go to local SQLite first (22/22 pipeline assertions)

### Auth SMS + Observability (Sprint A) ✅

- [x] Enhance `AuthProvider.tsx` with `signInWithPhone()`, `verifyOtp()`, `signOut()` — each returns `{ error: string | null }`
- [x] Offline resilience: TOKEN_REFRESHED with null session → keep local session for PowerSync cached data
- [x] Auth lifecycle logging: `[AuthProvider] EVENT | user=abc123 | expiresIn=3600s`
- [x] Create `apps/mobile/app/login.tsx` — SMS OTP flow (phone input → verify code → redirect to /)
- [x] Carlos Standard UX: 22px input, 56px+ buttons, dark bg, bilingual via `useTranslation()`
- [x] Haptic feedback on success (`Haptics.NotificationFeedbackType.Success`) and error (`Error`)
- [x] Auth gating on `app/index.tsx`: redirect to `/login` if no session
- [x] Create `apps/mobile/src/components/DebugNav.tsx` — dev-only panel: Auth (userId, phone, expiry), i18n (locale + toggle EN/ES), PowerSync (connection dot, lastSynced, pending uploads)
- [x] Create `apps/mobile/app/debug.tsx` — renders DebugNav only in `__DEV__`
- [x] Triple-tap on title in index.tsx → navigates to `/debug` (500ms tap window)
- [x] `npm run typecheck` — 4/4 workspaces clean (db, shared, web, mobile)

### Foreman Home Screen ✅

- [x] Build home screen showing ONLY areas assigned to this foreman (from `user_assignments` → `areas` → `area_trade_status`)
- [x] Areas sorted by status priority: READY (green) → ALMOST (yellow) → WORKING (blue) → HELD (purple) → BLOCKED (red)
- [x] Large color-coded cards: area name + status chip + progress bar + "Report Update" button
- [x] 56px+ tap targets (Report Update button = 56px height), 20px+ area names
- [x] Header: app name + sync status (green/amber dot) + logout button
- [x] Language auto-detected from device via I18nProvider + expo-localization
- [x] **NOD Reminder Banner:** Purple banner with haptic feedback when unsent NOD drafts exist. Shows area name + count
- [x] "Report Update" button per card (blue, 56px) — opens 3-step report flow
- [x] `useFocusEffect` — instant refresh when screen regains focus after report submit
- [x] "Reported" badge (green checkmark) on cards with reports in last 2 hours
- [x] Triple-tap on title → navigates to `/debug` (dev-only, 500ms tap window)
- [x] Error state: differentiates "no areas" vs "query failed" with monospace error detail
- [x] Null-safe: all SQLite LEFT JOIN columns nullable with fallbacks (`name ?? 'Unknown'`, `floor ?? '-'`)

### Report Flow — Step 1: How Much Is Done? ✅

- [x] Large percentage slider (0–100%, step 5%) via `@react-native-community/slider`
- [x] Huge number display center screen: 96px font
- [x] Progress indicator strip at top: 3 dots (blue active, gray inactive)

### Report Flow — Step 2: Any Blockers? ✅

- [x] Two full-width buttons: "No blockers" (green, 80px) / "Yes, blocked" (red, 80px)
- [x] No blockers → `onReadyToSubmit()` → submit field_report (status=working)
- [x] Has blockers → go to Step 3
- [x] `isSubmitting` guard: buttons disabled + opacity 0.4 during submit

### Report Flow — Step 3: Why Blocked? ✅

- [x] 7 reason codes as large icon buttons (emoji + label, 56px+)
- [x] One tap selects reason (highlighted blue border)
- [ ] Optional: camera button to take photo (queued locally if offline) — **P1: camera capture pending**
- [x] Submit button disabled until reason selected, shows ActivityIndicator during submit
- [x] Submit → save `field_report` with reason_code via `useFieldReport`
- [x] `isSubmitting` guard: reason selection + submit button locked during submit

### Report Flow — Store + Navigator ✅

- [x] `useReportStore` (Zustand): 3-step flow, formData in memory, no persistence middleware
- [x] `ReportFlowNavigator`: step orchestrator with progress dots + cancel button
- [x] `report.tsx` route: guard via useEffect, unmount cleanup resets store, double-tap guard, data integrity validation (blockers answered, reason_code if blocked)
- [x] `router.replace('/(main)')` after submit — prevents gesture-back to empty report screen

### Report Flow — Blindaje (Resilience Audit) ✅

- [x] Memory: store resets on unmount (gesture back, hardware back) via useEffect cleanup
- [x] Double-tap: `isSubmitting` blocks duplicate writes at route + step component level
- [x] Data integrity: validates `has_blockers !== null` and `reason_code` if blocked before DB write
- [x] Post-submit: `submittedRef` prevents double reset (submit reset + unmount cleanup)

### RLS Security Fix ✅

- [x] `field_reports` INSERT policy: added `area_id IN (SELECT area_id FROM user_assignments WHERE user_id = auth.uid())` — prevents inserting reports for unassigned areas

### Confirmation Screen (P0) ✅

- [x] SuccessView inside ReportFlowNavigator (isSubmitted state in store)
- [x] Full-screen green background + large checkmark (80px) + area name + trade name
- [x] Haptic feedback (expo-haptics NotificationFeedbackType.Success)
- [x] i18n: `fieldReport.reportSent` / `fieldReport.reportSentSubtitle` (EN + ES)
- [x] Close button (56px, Carlos Standard) → reset store + `router.replace('/(main)')`
- [x] Guard fix: `submittedRef` prevents double navigation (guard useEffect vs handleClose)

### Auto-create delay_log (P1) ✅

- [x] On BLOCKED report submit: atomically create `delay_log` entry
- [x] If delay_log fails, field_report persists (non-blocking inner try/catch)
- [x] Links field_report to delay_log via area_id + trade_name + reason_code
- [x] `createDelayLog()` in `useFieldReport.ts` + `DelayLogInput` type

### Auth remaining (P2)

- [ ] Superintendent sends invite → foreman receives SMS with link
- [ ] **Zero form fields. Zero password. Zero onboarding screens.**
- [ ] GC/Sub PM: email + password login (standard Supabase auth)

### Offline Testing (P2)

- [ ] Enable airplane mode
- [ ] Submit 5 field reports with slider
- [ ] Take 3 photos
- [ ] Verify all saved locally (SQLite)
- [ ] Re-enable connectivity
- [ ] Verify all synced to Supabase within 30 seconds
- [ ] Verify GPS coordinates captured correctly without internet

### Tablet Responsive Layout (P3)

- [ ] Test all screens on iPad + Android tablet
- [ ] Larger cards, adjusted spacing for bigger screens
- [ ] Maintain single-column layout (no desktop-style grids on foreman tablet view)

---

## Week 3 — Ready Board + GC Dashboard

### Ready Board (Web) ✅

- [x] Cross-trade readiness grid (floors × trades) — `ReadyBoardGrid` with 420+ cells, React.memo per cell
- [x] Each cell: status color + label (RDY, ALM, BLK, HLD, DONE) via `deriveStatus()` engine
- [x] Real-time updates via Supabase Realtime subscriptions (`useRealtimeSync` hook)
- [x] Wave-pattern animation on initial load for visual polish
- [x] Click cell → detail panel: enriched delay (daily_cost, man_hours, crew_size), lazy-load GPS + Google Maps link, photo gallery (4-col), StatusTimeline
- [x] Filter by: floor, trade, status — client-side `useMemo`, GridFilterBar with toggle chips, intersection logic
- [x] Export PDF button — `window.print()` + `@media print` CSS (page-break-inside: avoid, color-adjust: exact)
- [x] Legend for color codes — dynamic counts per status, click-to-filter shortcut

### Corrective Action Module ✅

- [x] GC PM creates action from any BLOCKED/HELD alert: assigned_to, deadline, note
- [x] Assigned user receives notification (fire-and-forget insert to `notifications` table)
- [x] Track lifecycle: created → acknowledged → in_resolution → resolved with timestamps (`deriveActionStatus`)
- [x] Optimistic UI with `canProceedWithAction` guard (prevents race conditions Realtime vs Server Actions)
- [x] `actionReducer` — 24 permanent tests covering all state transitions
- [x] When resolved → area status recalculates automatically (DB trigger: `close_delay_on_ca_resolved`)
- [x] Response times tracked: DB timestamps (created_at, acknowledged_at, in_resolution_at, resolved_at) + deriveActionStatus + EfficiencyDashboard latency metrics. Full GC performance analytics deferred to V3 (Bid Intelligence)

### Orchestration Layer ✅

- [x] `ActionEventBus` — typed singleton pub/sub (pure TypeScript, try/catch per handler)
- [x] `useActionObserver` — passive hook emitting `action:confirmed` / `action:reverted` to bus
- [x] `toastSubscriber` — extracted toast notifications (sonner)
- [x] `orchestratorSubscriber` — factory with projectId closure for webhook calls
- [x] `orchestrateAction` server action — webhook with 3x retry, exponential backoff (1s/2s/4s), graceful without `WEBHOOK_ACTION_URL`
- [x] `EfficiencyDashboard` — React.memo, self-subscribed to bus, 5s refresh: Avg Latency, P95, Error Rate
- [x] 35 tests total (6 bus + 5 orchestrator + 24 reducer)

### GC Visibility Control ✅

- [x] Auth session layer: `getSession()` with dev bypass (returns real gc_pm from seed data)
- [x] `getUserRole()` + `requireGCRole()` — role check utilities
- [x] `middleware.ts` — route protection: public routes, GC-only `/dashboard`, dev bypass in development
- [x] Data layer switch: `fetchGridData`, `createCorrectiveAction`, `fetchProjectUsers` → user-scoped client (RLS enforced)
- [x] Security audit: 3 brechas found and sealed (service_role leak, 2× delay_logs unscoped queries)
- [x] All `delay_logs` queries scoped to current `project_id` via `areas!inner` join

### 1-Screen GC Dashboard ✅

- [x] **Section 1: What's happening right now?** — `MetricsSection`: 4 KPI cards (Project %, On Track, Attention, Action Req.) + progress bar
- [x] **Section 2: What needs attention?** — `AlertsSection`: 5 alerts ranked by `daily_cost` DESC, with floor badge, trade, reason, cost, CA status badge
- [x] **Section 3: When does this end?** — `ForecastSection`: schedule delta (scheduled vs projected + delta days), system health (confirmed/reverted ratio from bus), 14-day CSS sparkline trend
- [x] `SectionErrorBoundary` — per-section error isolation (class component, if one crashes others survive)
- [x] `GCDashboard` compositor — assembles 3 sections + EfficiencyDashboard, each in ErrorBoundary
- [x] `DashboardTabs` — client-side tab state (Overview + Ready Board), data fetched once at server level → instant tab switch
- [x] `fetchDashboardData` — 4 parallel queries, each in individual try/catch → failed sub-query returns empty data
- [x] `useAlertMetrics` — bus subscriber hook (confirmed/reverted ratio, useRef + 5s refresh)
- [x] Dashboard barrel exports (`features/dashboard/index.ts`)
- [x] Route integration: `Promise.all([fetchGridData(), fetchDashboardData()])` in `dashboard/page.tsx`
- [x] Layout sidebar: user name + role badge from `getSession()`
- [x] Expandable alert: context + GC action note input + "Save Note" button

### GC Visibility Control — Legal Docs ✅

- [x] Legal documents tab (lazy-loaded `LegalDocsTab` component)
- [x] "Publish to GC" button — explicit sub action required (`publishLegalDoc` server action)
- [x] GC sees Ready Board + Corrective Actions but NOT sub's legal docs until published (RLS enforced)
- [x] Test: GC login cannot see NOD drafts — RLS verified (3/3 scenarios: GC blocked, Sub sees own, GC sees after publish)

### Safety Clearance Gate ✅

- [x] Project-level toggle (off by default): `safety_gate_enabled` column on `projects`
- [x] Safety block via `delay_logs` with `reason_code = 'safety'` (`toggleSafetyBlock` server action)
- [x] Binary gate — NOT a full JHA module

### Dashboard Data Entry Points ✅

- [x] Reusable `Modal` component (`shared/components/Modal.tsx`) — dark theme, backdrop, Escape key, focus trap
- [x] **EP1 — Create Area:** `createArea` server action (inserts area + area_trade_status per trade), `CreateAreaModal` with preset + custom area types, "Initialize Project" CTA on empty dashboard, "+ Add Area" button when areas exist
- [x] **EP2 — Corrective Action:** `GridDetailPanel` refactored — explicit "Create Corrective Action" CTA button (enabled with delay, disabled without), form revealed on click, reset on cell change
- [x] **EP3 — Legal Doc Generation:** `createLegalDoc` server action (inserts draft with org_id), `CreateDocModal` with NOD/REA/Evidence radio group, "+ New Document" button in header, "Create First Document" CTA on empty state, optimistic list update

---

## Week 4 — Delay Logging + Legal Infrastructure

### Delay Log Engine ✅

- [x] `delayEngine.ts` server action: `getDelayLogSummary(projectId)` — fetches all delay_logs with area/project context
- [x] Real-time cost recalculation for active delays (crew_size × hours × labor_rate)
- [x] Legally locked delays (draft/sent/signed) return frozen DB values — no recalculation
- [x] DB integrity constraints migration: `chk_delay_logs_costs_non_negative`, `chk_delay_logs_end_after_start`, `chk_delay_logs_crew_size_positive`, `chk_delay_logs_man_hours_consistent`
- [x] DB trigger: `recalculate_delay_costs` — auto-computes man_hours, daily_cost, cumulative_cost on INSERT/UPDATE
- [x] `scripts/audit-delay-logs.ts` — 7 integrity checks per log (costs, timestamps, consistency) — 3/3 logs passed, 0 errors
- [x] Dashboard exports: `getDelayLogSummary`, `DelayLogSummary`, `DelayEngineResult`, `DelayLegalStatus`

### Legal Trigger / Threshold Engine ✅

- [x] `legal_status` column on `delay_logs` — CHECK constraint: `pending`, `draft`, `sent`, `signed`
- [x] Configurable thresholds per project: `nod_threshold_hours` (default 24), `rea_threshold_cost` (default 5000), `rea_threshold_crew_days` (default 3)
- [x] `guard_legal_immutability()` DB trigger — fires BEFORE cost recalc (`trg_00_` prefix for alphabetical ordering)
  - Blocks data modifications when status ≥ `draft` (man_hours, costs, crew_size, timestamps frozen)
  - Enforces forward-only progression: NULL→pending→draft→sent→signed (no backwards movement)
  - Allows first-time evidence write (evidence_hash/evidence_path) but blocks overwrites
- [x] `recalculate_delay_costs` updated — skips locked rows (draft/sent/signed)
- [x] `thresholdEngine.ts`: `scanThresholds(projectId)` — evaluates all delay_logs against project thresholds, marks qualifying ones as `pending`
- [x] `thresholdEngine.ts`: `authorizeDraft(delayLogId)` — GC authorizes progression to `draft`, returns cost snapshot + storage path
- [x] Verified: NULL→pending ✓, pending→draft ✓, draft+modify BLOCKED ✓, draft→pending BLOCKED ✓, draft→sent ✓

### Evidence Storage Layer ✅

- [x] `legal-docs` Supabase Storage bucket — private, 50MB limit, PDF + PNG + JSON mime types
- [x] `evidence_path` + `evidence_hash` columns on `delay_logs` with pair constraint (both or neither)
- [x] Storage RLS: SELECT policy (project members via org_id), INSERT policy (delay_log in draft+, no duplicates, project membership)
- [x] No UPDATE/DELETE policies — documents are immutable by design
- [x] `evidenceStorage.ts`: `uploadEvidence(delayLogId, fileContent, signature?)` — SHA-256 hash before upload, stores hash in DB
- [x] `evidenceStorage.ts`: `getEvidenceInfo(delayLogId)` — signed download URL (1hr expiry) + evidence metadata
- [x] `evidenceStorage.ts`: `verifyEvidenceIntegrity(delayLogId)` — downloads file, recomputes SHA-256, compares against stored hash
- [x] Evidence package convention: `{project_id}/{delay_log_id}/evidence.pdf` + `signature.png` + `audit.json`
- [x] Audit JSON: delayLogId, evidenceHash, signature metadata, delay context, uploadedAt, uploadedBy

### Signature Pad Component ✅

- [x] `SignaturePad.tsx` — canvas-based, pointer events (unified touch + mouse), `touchAction: 'none'`
- [x] Output: `SignatureData` = base64 PNG (`imageBase64`) + `SignatureMetadata` (audit trail)
- [x] Metadata: capturedAt, deviceInfo, canvasWidth/Height, strokeCount, totalPoints, coordPath (full coordinate path per stroke)
- [x] Validation: MIN_POINTS = 20, visual border feedback (zinc → amber → green)
- [x] Carlos Standard UX: 56px button heights, high contrast, large targets
- [x] Clear button, "Confirm Signature" enabled only when valid, "Saving..." disabled state
- [x] Security: signature data never logged to console (documented as audit-only)

### PDF Document Assembler ✅

- [x] `pdfAssembler.ts`: `assembleAndUpload(input)` — server action, full pipeline
- [x] `fetchDelayContext()` — nested Supabase joins (delay_log → area → project → org)
- [x] `buildPdf()` — Letter-size PDF via pdf-lib:
  - Header: "NOTICE OF DELAY" + org name + amber divider
  - Project info: name, address, jurisdiction
  - Delay Details: area, trade, reason code, crew size, start/end times, duration
  - Cost Impact: labor rate, man-hours, daily cost, cumulative cost (amber emphasis)
  - Authorized By: embedded signature PNG + signer name + timestamp + stroke metadata
  - Footer: document ID, generated timestamp, SHA-256 tamper-evident note
- [x] Atomicity: upload evidence first → progress status to `sent` only on success
- [x] Reason code formatter: 9 codes → human-readable labels
- [x] `pdf-lib` dependency added to apps/web

### NOD Draft Auto-Generation (Deferred)

- [ ] Trigger: first BLOCKED status on any area → auto-generate draft (Edge Function)
- [ ] Draft content JSONB: project info, area, date, cause, exhibits, AIA contract references
- [ ] Push notification to superintendent + purple banner on foreman home
- [ ] 20-hour reminder push if not sent

### Change Order Engine (Deferred)

- [ ] Log scope changes: new_sqft, reason, change_order_ref, gc_initiated boolean
- [ ] Trigger recalculation of all downstream forecasts on save
- [ ] Flag GC-initiated changes as evidence — appears in REA cost table

---

## Week 5 — Forecast Engine + Schedule Import

### Schedule Import

- [ ] Upload P6 export as CSV or XLSX
- [ ] Parse: area name, trade, scheduled_start, scheduled_finish
- [ ] Store in `schedule_items` table
- [ ] Map imported areas to ReadyBoard areas (fuzzy match + manual override UI)

### Forecast Calculation

- [ ] For each area + trade: calculate actual production rate from field_reports
- [ ] `completed_sqft = total_sqft × (effective_pct / 100)` — works for BOTH modes
- [ ] `actual_rate = completed_sqft / hours_worked`
- [ ] Project completion date based on actual_rate
- [ ] Calculate delta_days vs p6 scheduled date
- [ ] Generate daily `forecast_snapshots`
- [ ] Handle scope changes: recalculate on any scope_changes insert

### Schedule Delta Alerts

- [ ] Alert when projected_date > scheduled_date by > 3 days
- [ ] Content: area, trade, delta days, primary cause, recommended action
- [ ] Display in GC Dashboard Section 3

### REA Threshold Triggers (Partially complete — thresholds built in Week 4)

- [x] Monitor cumulative delay cost per area per cause — `scanThresholds()` in thresholdEngine.ts
- [x] Trigger at $5,000 OR 3 crew-days — configurable per project (Week 4)
- [ ] Auto-generate REA draft referencing all NODs for this cause
- [ ] Notify Sub PM via push + web

---

## Week 6 — Legal Document Generation (Partially complete — PDF engine built in Week 4)

### PDF Generation Engine (Partially complete)

- [x] NOD PDF template — built in `pdfAssembler.ts` (Week 4): project header, delay details, cost impact, signature, footer
- [x] Fields: project, area, delay dates, cause, cost breakdown, crew size
- [x] Include finger signature PNG overlay — embedded via `doc.embedPng()`
- [x] Include SHA-256 tamper-evident note in footer
- [ ] AIA A201 §8.3.1 / ConsensusDocs 200 §6.3 contract references — needs attorney review
- [ ] Include receipt tracking UUID in PDF
- [ ] PDF generated in user's language (EN or ES via i18n)
- [ ] **DO NOT FINALIZE TEMPLATE before attorney review in Week 5-6**

### REA PDF Template

- [ ] Itemized cost table: date × crew × rate + overhead percentage
- [ ] Reference all related NODs with sent timestamps
- [ ] Total claim amount (auto-calculated)
- [x] SHA-256 hash infrastructure ready (Week 4)

### Evidence Package PDF

- [ ] Chronological delay narrative
- [ ] All NODs with receipt confirmations (timestamp + IP)
- [ ] All REAs with cost tables
- [ ] GPS verification log
- [ ] Photo exhibits numbered sequentially (Exhibit A, B, C...)
- [ ] Corrective action history with GC response times
- [ ] GC verification timeline (if checklist mode delays involved) — placeholder for V1.1
- [x] SHA-256 integrity verification — `verifyEvidenceIntegrity()` (Week 4)
- [ ] Financial summary by cause and responsible party

### Receipt Tracking System

- [ ] Generate unique tracking UUID per document (`legal_documents.receipt_tracking_uuid`)
- [ ] Create 1×1 transparent PNG pixel hosted on ReadyBoard CDN
- [ ] Embed pixel in every outbound legal document email
- [ ] Supabase webhook: on pixel load → create `receipt_event` (timestamp, IP, device, open_count)
- [ ] Update `legal_documents.first_opened_at` + `open_count`
- [ ] 48h timer: if no corrective action after GC opens → alert to sub

### SHA-256 Verification (Partially complete — core engine built in Week 4)

- [x] Compute SHA-256 hash on PDF buffer before storage — `computeHash()` in evidenceStorage.ts
- [x] Store hash in `delay_logs.evidence_hash` (immutable after write)
- [x] Tamper-evident verification: `verifyEvidenceIntegrity()` downloads + recomputes + compares
- [x] Public verification endpoint: `GET /api/legal/verify?hash=[hash]` (built in Week 1)
- [ ] Print hash in PDF footer (currently shows note, not actual hash)
- [ ] All hashes included in Evidence Package appendix as "Document Integrity Log"

---

## Week 7 — QA + Deploy + First Pilot

### Testing

- [ ] Playwright: GC Dashboard loads, all 3 sections render correctly
- [ ] Playwright: Ready Board grid status colors correct per area status
- [ ] Playwright: Corrective action creation flow end-to-end
- [ ] Playwright: Legal doc GC visibility — GC cannot see unpublished NODs
- [ ] Mobile: 3-step foreman flow completes in < 15 seconds (time it)
- [ ] Mobile: offline report + photo + GPS + sync flow
- [ ] Mobile: NOD draft → signature → send flow complete
- [ ] Mobile: NOD reminder banner appears when conditions met, disappears when sent
- [ ] Mobile: EN ↔ ES language switch — ALL strings update
- [ ] Mobile: SHA-256 hash in PDF footer is correct
- [ ] Mobile: receipt tracking pixel fires on email open
- [ ] Cross-browser: Chrome, Safari, Firefox (GC Dashboard)
- [ ] Tablet: iPad + Android tablet (foreman app — all flows)
- [ ] Stress: 50 simultaneous field reports syncing via PowerSync

### Deploy

- [ ] Vercel production deploy (web dashboard)
- [ ] Expo EAS build (iOS + Android)
- [ ] TestFlight distribution for pilot
- [ ] Custom domain: app.readyboard.io (web), readyboard.io (marketing)

### First Pilot Onboard

- [ ] Create [PROJECT_NAME] project in production
- [ ] Configure trade sequences for tile/stone
- [ ] Set up [GC_ORG] as GC, Jantile as sub
- [ ] Create accounts: [FOREMAN_NAME] (foreman), [SUPER_NAME] (superintendent), [GC_PM_NAME] (GC PM)
- [ ] Send SMS magic links to foremen — YOU install the app on their phones
- [ ] Monitor first 24h of real data
- [ ] Collect feedback: what worked, what confused, what's missing
- [ ] Schedule attorney review of NOD template if not done in Week 5

---

## Week 8-9 — Checklist System (V1.1)

> Build immediately post-launch. 1-2 weeks for solo developer given V1 infrastructure.
> Do NOT start until first pilot is live and data is flowing.

### Schema Additions

- [ ] Create `trade_task_templates` table:
  ```sql
  id, org_id (NULL = system default), trade_type, area_type,
  task_order, task_name_en, task_name_es, verification_criteria,
  task_owner CHECK ('sub' | 'gc'), is_gate BOOLEAN,
  is_inspection BOOLEAN, weight NUMERIC(3,2) DEFAULT 1.0,
  gate_timeout_hours DEFAULT 4, requires_photo BOOLEAN,
  default_enabled BOOLEAN DEFAULT true
  ```
- [ ] Create `area_tasks` table:
  ```sql
  id, area_id, trade_type, task_template_id, task_order,
  task_name_en, task_name_es, task_owner, is_gate, weight,
  status CHECK ('pending'|'complete'|'blocked'|'na'|'correction_requested'),
  completed_at, completed_by, completed_by_role, photo_url, notes,
  gps_lat, gps_lon,
  verification_requested_at, notification_sent_at, notification_opened_at,
  reminder_sent_at, correction_reason, correction_note,
  correction_requested_at, correction_requested_by, correction_resolved_at
  ```
- [ ] Add columns to `area_trade_status`:
  ```sql
  ALTER TABLE area_trade_status ADD COLUMN reporting_mode TEXT DEFAULT 'percentage';
  ALTER TABLE area_trade_status ADD COLUMN calculated_pct NUMERIC(5,2);
  ALTER TABLE area_trade_status ADD COLUMN all_gates_passed BOOLEAN DEFAULT false;
  ALTER TABLE area_trade_status ADD COLUMN gc_verification_pending BOOLEAN DEFAULT false;
  ALTER TABLE area_trade_status ADD COLUMN gc_verification_pending_since TIMESTAMPTZ;
  ```
- [ ] Create `calculate_effective_pct()` DB trigger (see BUSINESS_LOGIC.md)
- [ ] Add RLS policies for `area_tasks` (SUB only completes SUB tasks, GC only GC tasks)
- [ ] Create indexes: `idx_area_tasks_area`, `idx_area_tasks_pending_gc`

### Seed Template Library

- [ ] Create `packages/db/templates/bathroom-tasks.json` — 14 trades × bathroom (170+ tasks)
- [ ] Create `packages/db/templates/kitchen-tasks.json` — 14 trades × kitchen
- [ ] Create `packages/db/templates/corridor-tasks.json` — 14 trades × corridor/common
- [ ] Create `packages/db/templates/office-tasks.json` — 14 trades × office
- [ ] Seed script: load all templates into `trade_task_templates` as system defaults (org_id = NULL)
- [ ] Reference: `ReadyBoard_14Trade_Checklist_v5.1.docx` for task data, SUB/GC tags, gate identification

### Foreman Mobile — Checklist Screen

- [ ] `features/checklist/components/TaskChecklist.tsx` — replaces slider when mode=checklist
- [ ] `features/checklist/components/TaskItem.tsx` — single task row:
  - SUB task: tappable, green ✅ when complete
  - GC VERIFY task: greyed out, 👷 icon, "Awaiting GC" label (in foreman's language)
  - Gate task: ⛔ icon, highlighted row
- [ ] `features/checklist/components/ChecklistProgress.tsx` — percentage bar auto-updates live
- [ ] `features/checklist/hooks/useChecklist.ts` — CRUD for `area_tasks`, offline-first via PowerSync
- [ ] `features/checklist/lib/calculatePct.ts` — weighted percentage calculation
- [ ] `features/checklist/lib/gateCheck.ts` — are all gate tasks complete?
- [ ] When last SUB task before GC gate is checked: confirmation includes "GC has been notified"
- [ ] Foremen CANNOT modify or create tasks — read + check only

### GC Web Dashboard — Verification Queue

- [ ] `features/checklist/components/GCVerificationQueue.tsx` — new "👷 Verify" tab
- [ ] Items ordered by cost of inaction (crew × daily cost → hours waiting → newest)
- [ ] Per-item: floor, area, trade, foreman, last task, timestamps, photos, idle cost
- [ ] Expandable task checklist showing all tasks with SUB/GC tags
- [ ] Two action buttons only: "✕ Request Correction" and "✓ Approve — Unblock Next Trade"
- [ ] `features/checklist/components/VerificationDetail.tsx` — full detail view
- [ ] `features/checklist/components/CorrectionModal.tsx` — reason code picker + notes:
  - Workmanship does not meet spec
  - Wrong material installed
  - Missing items — incomplete
  - Failed test — redo required
  - Safety concern
  - Other (see notes)
- [ ] `features/checklist/hooks/useVerificationQueue.ts` — fetch pending GC verifications

### GC Setup — Trade Configuration

- [ ] `features/checklist/components/TradeConfig.tsx` — per-trade mode toggle
- [ ] Location: GC Dashboard → Project Setup → Trade Configuration
- [ ] For each trade in sequence: [● Percentage] [○ Checklist] radio toggle
- [ ] If Checklist selected: load default template for trade × area_type
- [ ] GC can customize: add/remove/reorder tasks, change weights, toggle gate flags, add custom GC VERIFY tasks
- [ ] `features/checklist/hooks/useTaskTemplates.ts` — load/customize templates per project

### Notification Chain — 3 New Types

- [ ] "GC verification requested" push to GC super (fires when last SUB task before gate is completed)
- [ ] "GC 4h no verification response" reminder push to GC super
- [ ] "GC 24h no verification response" escalation: dashboard flag + sub PM alert
- [ ] "GC approved — area READY for next trade" push to next trade foreman
- [ ] "GC requested correction" push to sub foreman with reason code
- [ ] All 5 new notification types in EN + ES translation files
- [ ] `features/checklist/lib/notificationChain.ts` — orchestrates the full chain

### Checklist Testing Criteria

- [ ] Foreman in checklist mode can complete all SUB tasks offline, sync on reconnect
- [ ] GC VERIFY tasks are greyed out and untappable on foreman device
- [ ] GC can approve from web dashboard and mobile
- [ ] Approving a gate task recalculates `effective_pct` and flips status to READY
- [ ] Next trade foreman receives push notification within 30 seconds of approval
- [ ] GC response timer starts when last SUB task before gate is completed
- [ ] 4-hour reminder fires if GC hasn't responded (configurable per project)
- [ ] 24-hour escalation alert fires to sub
- [ ] Correction flow: sub receives reason code push, can re-complete, GC re-notified
- [ ] NOD draft references GC verification timeline when delay involves pending GC gate
- [ ] Percentage mode and checklist mode both produce same `effective_pct` format for Ready Board
- [ ] Task weights correctly affect percentage calculation (verify with known test data)
- [ ] Template library loads correct checklist for trade × area_type combination
- [ ] GC can toggle mode per trade without affecting other trades on same project
- [ ] `effective_pct` = 99% but gates not passed → status = ALMOST (not READY)
- [ ] SUB cannot complete GC tasks — test at DB level (RLS policy test)

---

## Week 4+ Backlog (Moved from Week 3)

- [ ] Right sidebar: Cost of Inaction counter (animated), Legal Status per alert
- [ ] Left sidebar: Floor status strip — color-coded per floor with progress bars
- [ ] Bottom bar: "If you had this at 7am — how many calls would you not make?" (demo mode)
- [ ] Push Notifications (Bilingual) — Set up Expo push notifications
- [ ] Push: Area → READY to assigned foreman in their language
- [ ] Push: Area → BLOCKED to GC PM + Sub PM in their language
- [ ] Push: NOD draft ready to superintendent in their language
- [ ] Push: All notifications use i18next templates
- [ ] Response times tracked for GC performance profile

---

## Post-V1 Backlog (Do NOT build in V1 or V1.1)

### V2 — AI + Languages (Needs 10 projects / 90 days)

- [ ] AI Insights panel — delay pattern analysis, CA intelligence
- [ ] French, Portuguese, Italian languages
- [ ] Owner portal
- [ ] Multi-project portfolio view for GC
- [ ] API for third-party integrations
- [ ] V2 checklist analytics: avg GC verification response time per project, cost of GC verification delays, Bid Intelligence fuel

### V3 — Bid Intelligence (Needs 50 projects / 12 months / 20 GCs)

- [ ] Bid Intelligence Engine — GC performance profiles
- [ ] Arabic, Mandarin, Polish, Haitian Creole languages
- [ ] DocuSign integration for enterprise GC accounts
- [ ] P6 API bidirectional sync

### V4 — Data Products

- [ ] ReadyBoard Industry Benchmarks — quarterly report (separate revenue stream)
- [ ] Japanese, Hindi, German languages
- [ ] Cross-GC benchmark publishing

---

## Reference: File Structure

```
readyboard/
├── turbo.json                   Turborepo config
├── package.json                 Workspace root (npm workspaces)
├── tsconfig.json                Root TypeScript config
├── .env.local                   Web env vars (Supabase URL + keys)
├── CLAUDE.md                    This project's AI context
├── BUSINESS_LOGIC.md            Status logic, RLS, notification chains
├── TASKS.md                     This file
├── apps/
│   ├── mobile/                  Expo (Foreman + Sub PM)
│   │   ├── app/index.tsx        Pipeline status + auth gating + triple-tap debug
│   │   ├── app/login.tsx        SMS OTP login (phone → verify → home)
│   │   ├── app/debug.tsx        Dev-only debug panel route
│   │   ├── app/_layout.tsx      I18n → Auth → PowerSync → Slot
│   │   ├── src/providers/       AuthProvider, PowerSyncProvider, I18nProvider
│   │   ├── src/components/      DebugNav (observability panel)
│   │   └── app.json             Plugins + permissions (camera, location, haptics, i18n)
│   └── web/                     Next.js 16 (GC Dashboard)
│       ├── src/app/             App router pages
│       ├── src/middleware.ts     Route protection (auth + GC role guard)
│       ├── src/features/        Feature-based modules
│       │   ├── ready-board/     Grid + Corrective Actions + Orchestration
│       │   │   ├── components/  ReadyBoardGrid, EfficiencyDashboard, ActionPanel, etc.
│       │   │   ├── hooks/       useReadyBoardData, useRealtimeSync, useActionObserver
│       │   │   ├── lib/         ActionEventBus, subscribers, deriveStatus, actionReducer
│       │   │   ├── services/    fetchGridData, createCorrectiveAction, orchestrateAction
│       │   │   └── __tests__/   35 tests (reducer, bus, orchestrator)
│       │   ├── dashboard/       1-Screen GC Dashboard
│       │   │   ├── components/  GCDashboard, DashboardTabs, MetricsSection, AlertsSection, ForecastSection, SectionErrorBoundary
│       │   │   ├── hooks/       useAlertMetrics (bus subscriber)
│       │   │   ├── services/    fetchDashboardData, delayEngine, createArea, createLegalDoc
│       │   │   └── types/       ProjectMetrics, DashboardAlert, ProjectForecast
│       │   └── legal/           Legal Infrastructure (Week 4)
│       │       ├── components/  SignaturePad (canvas-based, pointer events)
│       │       ├── services/    thresholdEngine, evidenceStorage, pdfAssembler
│       │       └── index.ts     Barrel exports
│       ├── src/lib/auth/        getSession (dev bypass), getUserRole
│       ├── src/lib/supabase/    SSR clients (client.ts, server.ts, service.ts)
│       ├── src/lib/legal/       SHA-256 hash + verify
│       ├── src/lib/i18n/        Locale utilities
│       ├── src/i18n/            next-intl request config
│       ├── messages/            EN + ES translations
│       ├── next.config.ts       transpilePackages for internal pkgs
│       └── package.json         @readyboard/web
├── packages/
│   ├── db/                      PowerSync + Supabase shared
│   │   ├── src/powersync/schema.ts          11 synced tables
│   │   ├── src/powersync/sync-rules.yaml    Bucket definitions v5.1
│   │   ├── src/powersync/SupabaseConnector.ts  Auth + CRUD bridge
│   │   └── package.json         @readyboard/db
│   └── shared/                  Hooks, types, i18n
│       ├── src/hooks/usePowerSync.tsx    Platform-agnostic PowerSync context + hook
│       ├── src/hooks/useFieldReport.ts   Field report CRUD (offline-first)
│       ├── src/i18n/en.json             EN translations (165+ keys)
│       ├── src/i18n/es.json             ES translations (165+ keys)
│       ├── src/i18n/index.ts            Barrel export (translations, locales)
│       ├── src/types/index.ts            Shared types (roles, status, inputs)
│       └── package.json         @readyboard/shared
├── scripts/
│   ├── test-rls.sql             RLS attack scenario tests
│   ├── test-offline-sync.ts     Offline sync pipeline test (22 assertions)
│   └── audit-delay-logs.ts      Delay log integrity audit (7 checks per log)
└── supabase/
    └── migrations/              27 SQL migration files
```
