# ReadyBoard — TASKS.md

> **Single source of truth for all build tasks.**
> Weeks 1-6: ✅ COMPLETE (collapsed). Week 7-8: 🔨 PARTIAL. Week 9-11: ✅ COMPLETE. Weeks 12-15: NEW BUILD.
>
> **TASK PREFIXES — Claude Code must follow these:**
> - 🔍 **VERIFY FIRST** — Search codebase. If works: skip ✅. If broken: fix. If missing: build.
> - 🔨 **BUILD** — Does not exist. Create from scratch.
> - 🔌 **WIRE** — Code/dependency exists but not connected. Hook it up.
>
> **RULES:**
> - Never build a 🔍 task without searching the codebase first.
> - After each Day, run `npx tsc --noEmit` and `npm run build` to verify zero errors.
> - Read the relevant SKILL.md before working on billing, RLS, legal, mobile, notifications, or checklists.

---

## ✅ Weeks 1-6 — COMPLETE (Collapsed)

<details>
<summary>Week 1 — Foundation + Data Model (ALL DONE)</summary>

- [x] Supabase schema: 22 tables (organizations, projects, users, areas, trade_sequences, user_assignments, area_trade_status, field_reports, delay_logs, corrective_actions, legal_documents, nod_drafts, receipt_events, production_benchmarks, schedule_items, forecast_snapshots, notifications, audit_log, change_orders, scope_changes, trade_task_templates, area_tasks)
- [x] 60 RLS policies with `get_user_org_id()` helper
- [x] 26 functions, 21 triggers, 87 indexes
- [x] Seed: 383 Madison, Tishman GC, Jantile sub, 30 areas
- [x] i18n: next-intl (web) + i18next (mobile), EN + ES, 165+ keys
- [x] SHA-256: hash.ts, verify.ts, GET /api/legal/verify endpoint
- [x] PowerSync: sync-rules v5.1, schema (11 tables), SupabaseConnector
</details>

<details>
<summary>Week 2 — Foreman Mobile Engine (ALL DONE)</summary>

- [x] Turborepo monorepo: apps/web, apps/mobile, packages/db, packages/shared
- [x] PowerSync packages/db with schema + connector + sync rules
- [x] Shared hooks: usePowerSync, useFieldReport, PowerSyncProvider
- [x] Expo scaffold: AuthProvider, PowerSyncMobileProvider, I18nProvider
- [x] Offline sync validation: 22/22 assertions, test-offline-sync.ts
- [x] Native capabilities: expo-camera, expo-location, expo-haptics, expo-localization (installed, NOT all wired)
- [x] SMS OTP login: phone → verify → authenticated
- [x] Foreman home screen: color-coded cards, NOD banner, report button, sync indicator
- [x] Report flow: slider (Step 1) → blockers (Step 2) → reason codes (Step 3)
- [x] Confirmation screen: full-screen green ✓ + haptic + auto-return
- [x] useReportStore (Zustand): 3-step flow with resilience audit (double-tap guard, data integrity)
- [x] Auto-create delay_log on BLOCKED status
- [x] RLS fix: field_reports INSERT requires user_assignments check
</details>

<details>
<summary>Week 3 — Ready Board + GC Dashboard (ALL DONE)</summary>

- [x] Ready Board grid: 420+ cells, React.memo, deriveStatus engine, realtime, filters, print/PDF
- [x] Corrective Action module: create → acknowledge → resolve lifecycle, actionReducer (24 tests)
- [x] Orchestration: ActionEventBus, toastSubscriber, orchestratorSubscriber (35 tests total)
- [x] GC Visibility: auth session, role guards, middleware, RLS-scoped queries
- [x] 1-Screen Dashboard: MetricsSection, AlertsSection (ranked by cost), ForecastSection, SectionErrorBoundary
- [x] DashboardTabs: Overview, Ready Board, Verifications, Legal Docs, Settings
- [x] Data entry: Create Area modal, Corrective Action form, Legal Doc generation modal
- [x] Legal docs tab with publish-to-GC coopetition model
- [x] Safety clearance gate (project-level toggle)
</details>

<details>
<summary>Week 4 — Delay Logging + Legal Infrastructure (ALL DONE)</summary>

- [x] Delay engine: cost recalculation, legal locking (draft/sent/signed frozen)
- [x] DB integrity: 4 CHECK constraints, recalculate_delay_costs trigger, guard_legal_immutability trigger
- [x] Threshold engine: scanThresholds, authorizeDraft, configurable per project
- [x] Evidence storage: Supabase Storage bucket, SHA-256 hash before upload, immutable
- [x] Signature pad: canvas, pointer events, metadata, PNG export, validation (MIN_POINTS=20)
- [x] PDF assembler: pdf-lib, header, delay details, cost impact, signature embed, SHA-256 footer
- [x] NOD auto-generation: pending → draft PDF with watermark → nod_draft record → 'draft' status
- [x] NOD approval: draft → signature → final PDF → upload → sent
- [x] Change order engine: convertToChangeOrder, approve, reject, financial summary
- [x] Dashboard: NodDraftsSection, CO buttons on alerts, financial impact metrics
</details>

<details>
<summary>Week 5 — Forecast Engine + Schedule Import (ALL DONE)</summary>

- [x] DB: schedule_items ALTER, forecast indexes, import_schedule_batch RPC, RLS
- [x] Schedule import: P6 CSV parse (PapaParse), Zod validation, atomic batch RPC
- [x] Forecast engine: burn rate (14-day EMA), projected finish, schedule delta
- [x] Project-level rollup: MAX projected date (critical path method)
- [x] Schedule delta alerts: >3 days behind = at-risk (configurable)
- [x] ForecastSection: schedule comparison table, critical path markers
- [x] Executive report: aggregate metrics → PDF via pdf-lib
- [x] 9 forecast tests passing
</details>

<details>
<summary>Week 6 — Legal Docs + Manual Override + Integrity Audit (ALL DONE)</summary>

- [x] Manual override: schedule_items override columns, audit_log, server actions
- [x] Security audit (Phase 1): foreman leak fix, is_sub_management() helper, scoped queries
- [x] Flow integrity (Phase 2): upsert_forecast_snapshots RPC, writeAuditEntry helper, audit on all actions
- [x] Tech debt (Phase 3): constants.ts consolidation, type consolidation, dead code removal
- [x] Final: 0 TypeScript errors, 50/50 tests green, 37 migrations
</details>

---

## Week 7-8 — Incomplete Items (from original plan)

### Still Needs Completion

- [ ] 🔌 Camera capture in mobile report flow (expo-camera installed, not wired to submit)
- [ ] 🔌 GPS capture in mobile report flow (expo-location installed, not wired to handleSubmit)
- [ ] 🔨 REA PDF template (itemized cost table, references NODs)
- [ ] 🔨 Evidence Package PDF (8-section arbitration document)
- [ ] 🔨 AIA A201 §8.3.1 contract references in NOD template (needs attorney review)
- [ ] 🔨 Receipt tracking UUID embedded in outbound NOD email
- [ ] 🔨 Bilingual PDF output (currently English-only templates)
- [ ] 🔨 Hash printed in PDF footer (currently shows note, not actual hash value)
- [ ] 🔨 Push notifications infrastructure (currently DB-only polling)
- [ ] 🔨 Foreman invite flow: superintendent sends SMS → foreman receives link
- [ ] 🔨 Playwright E2E tests (GC dashboard, corrective actions, legal visibility)
- [ ] 🔨 Mobile offline test suite (airplane mode → 5 reports → reconnect → sync)
- [ ] 🔨 Expo EAS builds (iOS + Android)

### Deferred from Week 3-4 (Low Priority)

- [ ] Right sidebar: Cost of Inaction counter (animated), Legal Status per alert
- [ ] Left sidebar: Floor status strip — color-coded per floor with progress bars
- [ ] Demo mode bottom bar: "If you had this at 7am..."

---

## Week 9 — Auth, Onboarding & Data Flow (5 days)

### Day 1-2: Login & Signup

- [ ] 🔍 Check if branded `/login` page exists (not Supabase default)
- [ ] 🔨 Build `/login`: dark theme, ReadyBoard logo, email+password, validation, error states
- [ ] 🔨 Build `/forgot-password` (Supabase resetPasswordForEmail)
- [ ] 🔍 Check if `/signup` exists with role selection
- [ ] 🔨 Build `/signup`: email, password, name + role picker (GC | Sub | Owner) → create user + org → redirect /onboarding
- [ ] 🔍 Check if email verification enabled in Supabase Auth
- [ ] 🔍 Check if foreman SMS OTP works (built in Week 2 — verify still functional)
- [ ] 🔍 Check if route protection middleware redirects unauth → /login
- [ ] 🔍 Check if auth users redirect /login → /dashboard
- [ ] 🔨 Build logout button in sidebar (confirmed missing)
- [ ] 🔍 Check if role-based route guards exist

### Day 2-3: GC Onboarding Wizard

- [ ] 🔍 Check if any onboarding flow exists
- [ ] 🔨 Build `/onboarding` — 5 steps:
  - [ ] Step 1: Organization (name, logo, language)
  - [ ] Step 2: First Project (name, address, labor rate, jurisdiction)
  - [ ] Step 3: Trade Sequence (14-trade default, toggle, reorder)
  - [ ] Step 4: Floors & Areas ("Floors __ to __, Units A through __" → auto-generate)
  - [ ] Step 5: Invite Team (email for PM/Super, phone for foremen)
- [ ] 🔨 "Skip for now" on Steps 4-5
- [ ] 🔨 On completion → redirect /dashboard with data

### Day 3: Checklist Data Flow (CRITICAL — verify before building)

- [ ] 🔍 **VERIFY: Area creation clones `trade_task_templates` → `area_tasks`?**
  - [ ] 🔨 If missing: build `clone_task_templates_for_area()` + wire to area creation
- [ ] 🔍 **VERIFY: Seed data has `area_tasks` populated?**
  - [ ] 🔨 If empty: run cloning for all seed areas
- [ ] 🔍 **VERIFY: Auth user linked to org that owns seed project?**
  - [ ] 🔌 If not: fix seed data linkage
- [ ] 🔍 **VERIFY: Ready Board tab shows data when areas exist?**
  - [ ] 🔌 If "No data": debug Supabase query
- [ ] 🔍 **VERIFY: Verifications tab loads area_tasks WHERE task_owner='gc' AND status='pending'?**
  - [ ] 🔌 If "Loading...": fix query/RLS
- [ ] 🔍 **VERIFY: Settings Trade Config shows 14 trades with toggle?**
  - [ ] 🔌 If legend only: wire to trade_sequences + area_trade_status.reporting_mode

### Day 4: Sub Onboarding & Invites

- [ ] 🔨 Sub signup: org (type=sub) → user (role=sub_pm) → "Waiting for invite" page
- [ ] 🔨 GC invite link → sub signs up → auto-joined to project
- [ ] 🔨 Foreman SMS invite: Super enters phone → SMS link → foreman authenticated
- [ ] 🔍 Check user_assignments used for foreman-area assignment

### Day 5: Auth QA

- [ ] 🔨 Test: GC signup → onboard → dashboard with data
- [ ] 🔨 Test: foreman SMS → assigned areas visible
- [ ] 🔨 Test: logout works
- [ ] 🔨 Test: unauth → /login redirect
- [ ] 🔨 Test: role isolation (GC ≠ sub legal docs, foreman ≠ dashboard)

---

## Week 10 — Stripe Billing (4 days)

> **Read `stripe-billing` SKILL before starting.**

### Day 1: Setup

- [ ] 🔨 Stripe account + 4 products (starter $399, pro $699, portfolio $1999, sub_addon $59)
- [ ] 🔨 Install stripe + @stripe/stripe-js
- [ ] 🔨 Env vars: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
- [ ] 🔍 Check organizations table for Stripe columns → 🔨 migration if missing
- [ ] 🔨 Create Stripe customer on org creation (wire into signup)

### Day 2: Checkout + Webhooks

- [ ] 🔨 /api/stripe/checkout → Stripe Checkout Session
- [ ] 🔨 /api/stripe/portal → Stripe Customer Portal
- [ ] 🔨 /billing/success confirmation page
- [ ] 🔨 /api/webhooks/stripe: checkout.completed, invoice.paid, invoice.failed, subscription.updated, subscription.deleted + signature verification

### Day 3: Billing Page + Enforcement

- [ ] 🔨 /dashboard/billing: plan, trial countdown, upgrade/manage buttons, invoices
- [ ] 🔨 usePlan() hook: { plan, isTrialing, trialDaysLeft, canAccess(feature) }
- [ ] 🔨 UpgradePrompt component
- [ ] 🔨 Trial banner: "X days left. [Upgrade →]"

### Day 4: QA

- [ ] 🔨 API-level enforcement (403 on gated routes)
- [ ] 🔨 Test: Starter → Legal Docs → upgrade prompt
- [ ] 🔨 Test: trial expires → downgrade
- [ ] 🔨 Test: checkout → active → features unlocked

---

## ✅ Week 11 — Full Navigation & New Pages (5 days) — COMPLETE

<details>
<summary>Week 11 — All 5 Days DONE (click to expand)</summary>

### Day 1: Sidebar + Routing ✅

- [x] 🔨 Professional Sidebar: 11 nav items, dynamic badges (Legal 6, Verifications count), project selector dropdown
- [x] 🔨 Convert DashboardTabs → 11 separate /dashboard/* routes (App Router)
- [x] 🔨 Active state (amber icon + zinc-800 bg), mobile hamburger (drawer + overlay)
- [x] 🔨 Loading skeletons (loading.tsx) for Overview, ReadyBoard, Verifications, Legal, Billing
- [x] 🔨 Server Components for data fetch, Client Components only for interactivity

**Files:** Sidebar.tsx, DashboardSkeleton.tsx, fetchProjectContext.ts, 10 page.tsx, 5 loading.tsx

### Day 2: Delays & Costs Page ✅

- [x] 🔨 /dashboard/delays: 5 summary cards (Active, Closed, Man Hours, Daily Burn, Cumulative Cost)
- [x] 🔨 10-column table: Area, Trade, Reason, Severity, Duration, Daily Cost, Cumulative, GPS, Legal, Actions
- [x] 🔨 Filters: trade, severity (critical/high/medium/low), status (active/closed), date range
- [x] 🔨 EvidenceModal: GPS coords + Google Maps link + photo evidence
- [x] 🔨 NodGenerateModal: triggers existing generateNodDraft → draft PDF with audit
- [x] 🔨 Plan Guard: Starter → UpgradePrompt on "Generate NOD"
- [x] 🔨 Pagination (20 per page), severity badges, live pulse indicator for active delays

**Files:** DelaysTable.tsx, NodGenerateModal.tsx, EvidenceModal.tsx, fetchDelayDetails.ts, delays/index.ts

### Day 3: Forecast + Corrective Actions ✅

- [x] 🔨 /dashboard/forecast: 4 metric cards, projected vs original finish dates, SVG line chart (14-day trend)
- [x] 🔨 Schedule vs Reality comparison table, At Risk areas section (red border)
- [x] 🔨 Empty state with link to Schedule import
- [x] 🔨 /dashboard/corrective-actions: Kanban view (4 columns: Open, Acknowledged, In Progress, Resolved)
- [x] 🔨 Table view toggle, 6 metric cards (incl. Avg Resolution Time), overdue alert banner
- [x] 🔨 Click actions: Acknowledge → Resolve (triggers DB trigger to close linked delay)
- [x] 🔨 Uses existing acknowledgeCA + resolveCA server actions with full audit trail

**Files:** ForecastPageView.tsx, fetchForecastPage.ts, CAKanban.tsx, fetchCorrectiveActions.ts

### Day 4: Schedule + Team ✅

- [x] 🔨 /dashboard/schedule: Drag-and-drop CSV upload, preview table (10 rows), validation warnings
- [x] 🔨 Import/Update button → importP6Schedule (PapaParse + atomic RPC), result display + unmapped areas
- [x] 🔨 Existing items table (area, trade, dates, mapped status, critical flag)
- [x] 🔨 Plan Guard: Starter → UpgradePrompt blocks schedule import
- [x] 🔨 /dashboard/team: 4 metric cards, GC/Sub team tables, role badges, assigned areas
- [x] 🔨 "+ Invite Member" button (GC Admin/PM/Owner only), invite modal (Sub PM or Foreman + area)
- [x] 🔨 Pending invites section with copy link + expiration status
- [x] 🔨 Uses existing generateInviteLink (7-day tokens with audit)

**Files:** ScheduleUpload.tsx, TeamManagementView.tsx, fetchTeamMembers.ts

### Day 5: Settings Expansion ✅

- [x] 🔨 Vertical tab navigation: General, Trades & Costs, Legal, Integrations, Team Roles, Audit Logs
- [x] 🔨 General: project name, address, labor rate ($/hr), jurisdiction, safety gate toggle + save with audit
- [x] 🔨 Trades & Costs: existing TradeConfig (percentage/checklist toggle, task counts, lock logic)
- [x] 🔨 Legal: jurisdiction, SHA-256 status, NOD/REA thresholds (24h, $5K, 3 crew-days), template status
- [x] 🔨 Team Roles: 7-role reference table with access descriptions
- [x] 🔨 Plan Guard: Integrations + Audit Logs locked for Starter → UpgradePrompt
- [x] 🔨 Audit Logs: paginated viewer, action badges, user names, JSON diff expandable detail

**Files:** SettingsPage.tsx, GeneralSection.tsx, LegalSection.tsx, AuditLogSection.tsx, updateProjectSettings.ts, fetchProjectSettings.ts, fetchAuditLog.ts

</details>

---

## Week 12 — Mobile Completion (4 days)

> **Read `expo-mobile` SKILL before starting.**

### Day 1: GPS + Photo (Top Priority)

- [ ] 🔌 GPS: Location.getCurrentPositionAsync() → handleSubmit → store lat/lon (30 min)
- [ ] 🔌 Photo: camera modal in blocker step → store locally (2h)
- [ ] 🔨 Photo preview before submit
- [ ] 🔍 Photo sync: PowerSync or Supabase Storage? → 🔨 build upload queue if needed

### Day 2: Push Notifications

> **Read `readyboard-notifications` SKILL before starting.**

- [ ] 🔨 expo-notifications config + permission request
- [ ] 🔍 users.push_token column? → 🔨 migration if missing
- [ ] 🔨 Register token → users.push_token
- [ ] 🔨 /api/push/send (Expo Push API)
- [ ] 🔨 7 push triggers: READY→foreman, BLOCKED→GC+sub, NOD→super, verify→GC, 4h→GC, 24h→sub, correction→foreman
- [ ] 🔍 Verify all bilingual

### Day 3: Bottom Tabs + Profile

- [ ] 🔨 Bottom tab nav: My Areas | Report | Legal | Profile
- [ ] 🔨 Legal tab: NOD drafts + sent docs
- [ ] 🔨 Profile: language toggle, notification prefs, sync status, logout

### Day 4: Checklist E2E Verification

> **Read `readyboard-checklist` SKILL before starting.**

- [ ] 🔍 Mobile TaskChecklist → real area_tasks via PowerSync?
- [ ] 🔍 SUB task complete on mobile → syncs to Supabase?
- [ ] 🔍 Synced → appears in web Verification Queue?
- [ ] 🔍 GC approve → recalculates pct → READY → foreman notified?
- [ ] 🔍 Gate blocks READY at high %?
- [ ] 🔍 Correction flow end-to-end?
- [ ] 🔨 Fix any broken link

---

## Week 13 — Email, Demo Data, Landing Page (5 days)

### Day 1-2: Email System

- [ ] 🔨 Install Resend, add RESEND_API_KEY, configure noreply@readyboard.ai
- [ ] 🔨 DNS: SPF, DKIM, DMARC
- [ ] 🔨 Templates (bilingual): welcome, team invite, NOD delivery+pixel, receipt confirmation, trial ending (7/3/1), payment failed
- [ ] 🔍 NOD email actually sends? → 🔌 wire if not

### Day 3: Demo Seed Data

- [ ] 🔨 Demo users: demo-gc@readyboard.ai, demo-sub@readyboard.ai
- [ ] 🔨 scripts/seed-demo.ts: orgs, project (383 Madison), users (GC PM, Super, Sub PM, 3 foremen), 9 floors, 45 areas, 14 trades, area_tasks cloned, field reports (80%/50%/10%), delays ($14K/$9.6K/$1.6K), legal docs, CAs, verifications, GPS data
- [ ] 🔨 Idempotent (re-runnable)
- [ ] 🔨 Hardcoded morning briefing for demo

### Day 4-5: Landing Page

- [ ] 🔨 / (root): hero, CTAs, 3 value props, pricing cards, footer
- [ ] 🔨 /terms, /privacy

---

## Week 14 — Security, QA & Deploy (3 days)

### Day 1: Security

- [ ] 🔍 CORS, CSP headers
- [ ] 🔨 Rate limiting on /api/auth/*, /api/webhooks/*, /api/stripe/*
- [ ] 🔍 No hardcoded secrets
- [ ] 🔍 Stripe webhook signature verification
- [ ] 🔨 Security headers (X-Frame-Options, X-Content-Type-Options)

### Day 2: E2E QA (8 flows)

- [ ] 🔨 Flow 1: GC signup → onboard → project → areas → invite foreman
- [ ] 🔨 Flow 2: Foreman SMS → areas → BLOCKED → delay_log → NOD draft
- [ ] 🔨 Flow 3: GC alert → CA → assign → resolve → READY
- [ ] 🔨 Flow 4: Verify queue → approve → next trade notified
- [ ] 🔨 Flow 5: Trial → checkout → active → features work
- [ ] 🔨 Flow 6: Demo login → all tabs → all data
- [ ] 🔨 Flow 7: Mobile offline → 3 reports → reconnect → sync <30s
- [ ] 🔨 Flow 8: Checklist → SUB tasks → GC verify → gate → READY

### Day 3: Production Deploy

- [ ] 🔨 Vercel: readyboard.ai domain
- [ ] 🔨 Supabase production project (separate from dev)
- [ ] 🔨 Schema migration to production
- [ ] 🔨 seed-demo.ts on production
- [ ] 🔨 Production env vars (Stripe live, Resend prod, Supabase prod, OpenRouter)
- [ ] 🔨 Expo EAS: Android APK + iOS TestFlight
- [ ] 🔨 Smoke test with demo account
- [ ] 🔨 Verify HTTPS

---

## Week 15 — AI Morning Briefing Agent (3 days)

### Day 1: Data Pipeline + Prompt

- [ ] 🔨 lib/ai/collectBriefingData.ts: parallel fetch (areas, delays, verifications, crews, forecast, changes, legal, CAs)
- [ ] 🔨 lib/ai/briefingPrompt.ts: system prompt, role-aware (GC/Sub), language-aware (EN/ES), 4-8 sentences, specific numbers
- [ ] 🔨 lib/ai/generateBriefing.ts: Vercel AI SDK + OpenRouter → gemini-2.5-flash, temp 0.3, 600 tokens
- [ ] 🔨 Install @openrouter/ai-sdk-provider, add OPENROUTER_API_KEY
- [ ] 🔨 Test script + 5 test cases (GC, Sub, Spanish, nothing changed, 0 delays)

### Day 2: Storage + Scheduling

- [ ] 🔨 briefings table + RLS
- [ ] 🔨 Cron (6am ET): generate per user × project → store → notify → push preview
- [ ] 🔌 Add briefing push type (from Week 12 push infra)
- [ ] 🔨 Optional: email digest via Resend

### Day 3: Dashboard UI

- [ ] 🔨 MorningBriefing.tsx card: top of Overview, dismissable, read_at tracking, action links
- [ ] 🔨 Mobile MorningBriefingCard (GC/Sub only, never foreman)
- [ ] 🔨 Past Briefings (last 7 days)
- [ ] 🔨 Settings: briefing push/email toggles
- [ ] 🔨 Demo: hardcoded briefing (no API call)
- [ ] 🔨 Cost monitor: tokens per briefing, alert if monthly >$50

---

## Post-Launch Backlog (DO NOT BUILD IN WEEKS 9-15)

- [ ] AI Chat Agent (Claude Sonnet 4.6) — Week 16+
- [ ] Cross-project intelligence — Month 6+
- [ ] Bid Intelligence — 50 projects + 12 months
- [ ] Multi-language beyond EN/ES (French, Portuguese, Arabic, Mandarin)
- [ ] DocuSign integration
- [ ] Owner portal
- [ ] API access for Portfolio
- [ ] Webhook API
- [ ] White-label enterprise
- [ ] App Store / Play Store publication
- [ ] Advanced analytics dashboard
- [ ] SSO/SAML
- [ ] Custom domains

---

*ReadyBoard v5.3 — Consolidated Build Plan*
*Weeks 1-6: ✅ | Week 7-8: 🔨 partial | Weeks 9-15: production SaaS*
*readyboard.ai*
