# ReadyBoard — TASKS.md

> **Single source of truth for all remaining build tasks.**
> Based on final audit: 108 ✅ / 9 🔨 partial / 23 ❌ not built / 1 🐛 broken
>
> **PRIORITY TIERS:**
> - 🔴 **P0 — Critical Blockers** (will crash or block launch)
> - 🟡 **P1 — Launch Blockers** (must have for web launch)
> - 🟢 **P2 — Post-Launch** (important but not blocking)
> - ⚪ **P3 — Future** (V2+, backlog)
>
> **TASK PREFIXES:**
> - 🔍 VERIFY FIRST — Search codebase before building
> - 🔨 BUILD — Does not exist, create from scratch
> - 🔌 WIRE — Code exists but not connected
>
> Last updated: 2026-04-10 (Schedule manual entry tab + CSV import)

---

## 🔴 P0 — CRITICAL BLOCKERS ✅ ALL RESOLVED (2026-03-27)

### 1. `briefings` table migration — ✅ FIXED

- [x] Created migration `20260327100000_create_briefings_table.sql`
- [x] Applied in Supabase (table + RLS + unique daily index + briefing_date + model columns)
- [x] MorningBriefingCard renders without crash

### 2. `/terms` and `/privacy` pages — ✅ ALREADY EXISTED

- [x] `/terms` page exists with full SaaS terms content
- [x] `/privacy` page exists with full privacy policy content
- [x] Audit had false negative — pages were built in Week 13

### 3. `users.push_token` column — ✅ VERIFIED EXISTS

- [x] `push_token TEXT` column confirmed on `public.users` table

### 4. OPENROUTER_API_KEY — ✅ RESILIENT FALLBACK ADDED

- [x] `generateBriefing.ts` now skips AI entirely if no API key (no crash, no 500)
- [x] Uses data-only fallback: shows real project numbers without AI
- [x] Key still needs to be added to Vercel env vars when ready

---

## 🟡 P1 — LAUNCH BLOCKERS (this week, ~20 hours)

### 15. Custom Trade Sequences with Phase Duplication & Custom Trades — ✅ DONE (April 9, 2026)

#### Database ✅
- [x] `trade_sequences`: +phase_label (nullable), +description, +is_custom
- [x] `reorder_trade_sequence` RPC with two-phase update (negative offset flip, then final assign)
- [x] RPC: `duplicateTradeAsPhase(project_id, base_trade, phase_label)`
- [x] RPC: `createCustomTrade(project_id, trade_name)` with `is_custom=true` flag
- [x] RPC: `deleteCustomTrade(project_id, trade_name)` with RLS validation
- [x] Task template sync: `sync_task_templates_to_areas` RPC runs on phase duplication

#### Backend Services ✅
- [x] `tradeSequenceActions.ts`: duplicateTradeAsPhase, createCustomTrade, deleteCustomTrade
- [x] `checklistActions.ts`: getTradeChecklist, saveTradeChecklist
- [x] `fetchGridData.ts`: generates composite keys when phase_label present (e.g., "Metal Stud Framing::Phase 2")

#### UI Components ✅
- [x] `TradeSequenceConfig.tsx`: drag-and-drop reordering via dnd-kit, action buttons, custom trades float at bottom
- [x] `DuplicatePhaseModal.tsx`: select base trade, enter phase_label, auto-assign sequence_order
- [x] `AddTradeModal.tsx`: text input for custom trade, validation, amber badge in list
- [x] `ChecklistEditor.tsx`: modal for task CRUD per trade
- [x] `SettingsPage.tsx`: updated to use TradeSequenceConfig instead of TradeConfig
- [x] `DashboardTabs.tsx`: updated import to TradeSequenceConfig
- [x] `GridHeader.tsx`: phase-aware display (e.g., "FRAM P2" with phase number suffix)
- [x] `GridFilterBar.tsx`: parse composite keys, display phase info in filter chips
- [x] `StepTradeSequence.tsx`: "+ Add custom trade" input, custom badge, flag trades in onboarding
- [x] `completeOnboarding.ts`: post-process to flag non-default trades with `is_custom=true`

#### Removed ✅
- [x] Deleted `TradeConfig.tsx`
- [x] Deleted `fetchTradeConfigs.ts`
- [x] Updated `settings/index.ts` to remove orphaned imports

#### Testing ✅
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npm run build` — ✅ success
- [x] Manual testing: drag-and-drop reordering, phase duplication, custom trade creation

#### Remaining (P2):
- [ ] 🔨 Bulk delete custom trades
- [ ] 🔨 Edit phase_label after creation
- [ ] 🔨 Copy task assignments from base phase to new phase



### 5. IN PROGRESS Status on Ready Board Grid — ✅ DONE

- [x] Added `in_progress` to `GridStatus` type + `STATUS_CONFIG` (blue #60a5fa, label "WIP")
- [x] Updated `deriveStatus.ts`: 1-99% without active delay → `in_progress`
- [x] Added to GridLegend + GridFilterBar + statusCounts

### 6. Floor → Unit → Area Hierarchy — ✅ ALL PHASES DONE

#### Phase 1: Database — ✅
- [x] `units` table created (id, project_id, floor, name, unit_type, sort_order + RLS)
- [x] `areas.unit_id` FK column + `area_code`, `description`, `sort_order`
- [x] Backfilled 156 units from 780 existing areas (regex `^(\d+)([A-Z])\s`)
- [x] Generated area_codes (`B.10A.1`, `K.24D.1`) — later changed to manual-only
- [x] Dropped CHECK constraints on `areas.area_type` + `units.unit_type` (custom types)
- [x] `complete_onboarding` RPC creates units atomically before areas

#### Phase 2: Backend & Sync — ✅
- [x] `fetchGridData.ts`: JOINs units via areas, maps unit_id/unit_name/area_code
- [x] `useReadyBoardData.ts`: buildAllFloors groups floor → unit → area
- [x] Types: GridUnit, GridFloor.units[], RawCellData + GridRow + GridCellData expanded
- [x] PowerSync: `units` table + `area_code/description/sort_order/unit_id` on areas
- [x] Sync rules v6: 3 buckets (by_user, by_project, by_area) — scales to 2000+ areas
  - `by_project`: areas + area_trade_status + units + trade_sequences (1 bucket per project)
  - `by_area`: field_reports + area_tasks + delay_logs (granular per assigned area)
  - `area_trade_status.project_id` column added + backfilled 8540 rows + INSERT trigger

#### Phase 3: Grid UI — ✅
- [x] 3-level collapsible hierarchy: FloorSection → UnitSection → GridRow
- [x] Floor rows: aggregate status bar + worst status dot + area count
- [x] Unit rows: per-trade worst-status dots + ready/total count
- [x] Floor quick-jump tabs, Expand/Collapse all, "Show problems only" filter
- [x] GridRow: area_code (monospace) + description (muted)
- [x] GridDetailPanel: area_code badge, unit context, description

#### Phase 4: Onboarding — ✅
- [x] 25 area type chips (toggleable) replacing 6-option select
- [x] Custom type input (free text → amber chips)
- [x] CSV import: papaparse, column validation, preview, confirm, download template
- [x] area_code is MANUAL only (from building plans, not auto-generated)
- [x] `complete_onboarding` passes unit_name/area_code/description to RPC

#### Phase 5: Floor-Level Areas (No Unit) — ✅
- [x] Grid: floors with only NULL-unit areas render flat (no unit grouping)
- [x] Grid: mixed floors show units collapsible + "Floor areas" section for loose areas
- [x] Quick Add: mode toggle — "Add Units with Areas" vs "Add Areas to Floor"
- [x] 5 floor-level presets: Lobby, Amenity, Mechanical, Parking, Retail
- [x] `generateFloorAreas()` creates areas without unit_name (unit_id=NULL)

#### Phase 6: Mobile UX + Project Assignment — ✅
- [x] Mobile: collapsible Floor → Unit → Area hierarchy (ScrollView + floor headers with status chips)
- [x] Mobile: first floor auto-expanded, rest collapsed — scales to 2000+ areas
- [x] Mobile: area_code badges on AreaCard
- [x] Mobile: unit_name + description in AreaCard meta line
- [x] `useAreas` hook: switched from `db.getAll()` polling to `db.watch()` — reactive, no SQLite lock issues during large initial sync
- [x] `assign_user_to_project()` RPC: assigns ALL project areas atomically
- [x] `redeemInviteToken`: calls assign_user_to_project for sub/super/foreman (trade-filtered if invite has trade_name)
- [x] `addAreasToProject`: auto-assigns new areas to existing project members

#### Remaining (P2):
- [x] Clone Floor — onboarding StepAreas + post-onboarding AddAreasModal "Clone Floor" tab + `cloneFloor` server action
- [ ] 🔨 Settings: editable area_code field per area

### 7. NOD Email Dispatch — ✅ DONE

- [x] Wired into `approveNodDraft()` after status update + audit
- [x] NodSentEmail template: bilingual (EN/ES), tracking pixel, SHA-256 hash, verify link
- [x] Fire-and-forget: email failure never blocks legal flow
- [x] Fetches GC org users (gc_admin, gc_pm) and sends to each
- [x] Generates tracking UUID + stores in legal_documents

### 8. Email Templates — ✅ DONE

- [x] TeamInviteEmail (bilingual EN/ES, inviter name, project, role, join link)
- [x] TrialEndingEmail (bilingual, days countdown, upgrade CTA)
- [x] PaymentFailedEmail (bilingual, project name, portal link)
- [x] NodSentEmail (bilingual, tracking pixel, hash verification, cost details)
- [x] All 4 wired into sendEmail.ts with fire-and-forget pattern

### 9. Landing Page — ✅ DONE

- [x] Portfolio card ($1,999/mo): enterprise badge, yellow accent, "Contact Sales" → mailto
- [x] 4-column grid layout (responsive: 2 cols md, 4 cols lg)
- [x] "View Demo" → auto-login with demo-gc account (?demo=gc param)
- [x] SEO metadata: keywords, OpenGraph, Twitter card for construction management

### 10. Notification Bell on Dashboard — ✅ DONE

- [x] NotificationBell component with bell icon + unread badge (red, 99+ cap)
- [x] Dropdown: last 10 notifications, type icons, time-ago, unread dot
- [x] "Mark all read" button + markNotificationsRead server action
- [x] Click-outside closes dropdown
- [x] Added to Sidebar header (next to logo)

### 11. Rate Limiting + Security Hardening — ✅ DONE

- [x] In-memory rate limiter in middleware.ts (per-IP, auto-cleanup)
- [x] API auth routes: 10 req/min, page auth routes: 30/min (redirect not JSON on limit)
- [x] Webhook route (/api/billing/webhook): 100 req/min
- [x] Dev bypass requires explicit `DEV_AUTH_BYPASS=true` flag (not just NODE_ENV)
- [x] Email verification check (`email_confirmed_at`) in middleware
- [x] Stripe SECRET_KEY validation warning in production
- [x] Demo credentials gated behind `NEXT_PUBLIC_DEMO_ENABLED` env var

### 12. Stripe — Sub Add-on Price ID — ✅ DONE

- [x] Sub Add-on product ($59/mo) created in Stripe sandbox
- [x] STRIPE_PRICE_SUB_ADDON added to .env.local + Vercel env vars
- [ ] 🔌 Wire to checkout flow for sub_pm role (post-launch)

### 13. Trial Banner with Countdown — ✅ DONE

- [x] TrialBanner component: dismissable, shows ≤7 days only
- [x] Red urgency when ≤3 days, amber when 4-7 days
- [x] `trial_ends_at` column added to project_subscriptions
- [x] Wired into main layout (reads from DB on each render)

### 14. `/billing/success` Page — ✅ DONE

- [x] Dedicated page: checkmark, plan features, "Go to Dashboard" button
- [x] Checkout success_url updated to `/billing/success`

---

## 🟢 P2 — POST-LAUNCH (Week 1-2 after launch)

### Performance Optimization — ✅ COMPLETE (April 9, 2026)

- [x] **Middleware: 0 DB queries** — removed `users` + `project_subscriptions` queries; role read from `user.app_metadata` (JWT)
- [x] **`trg_sync_user_role_to_jwt` trigger** — backfills + keeps `raw_app_meta_data.role` + `org_id` in sync (migration `20260409000002`)
- [x] **RLS helpers use JWT claims** — `get_user_role()`, `get_user_org_id()`, `is_gc_role()` read from `auth.jwt()` (migration `20260409000003`)
- [x] **`getSession()` in `React.cache()`** — deduplicates auth within render tree; layout + page share one result
- [x] **11 `loading.tsx` skeleton files** — all dashboard routes have instant-render skeleton UI
- [x] **`fetchGridData` parallelized** — `Promise.all([ats_pagination, trade_sequences, delay_logs, units])`
- [x] **Overview: removed extra `fetchGridData` call** — was fetching 780+ rows for just `projectId`
- [x] **Billing past_due redirect moved to layout** — eliminates extra DB query in middleware on every nav
- [x] **Settings toggle visibility fix** — PERCENTAGE/CHECKLIST toggle now amber/green with visible border

### Schedule Manual Entry — ✅ COMPLETE (April 10, 2026)

- [x] `schedule_baselines` table: `project_id × trade_name × floor` UNIQUE, `duration_days` generated column
- [x] RLS: project members SELECT, GC roles ALL
- [x] Schedule page: [✏️ Manual] + [📁 Import] tab toggle
- [x] ManualEntryTab: inline date inputs, work-day duration, status/actual from ATS, delta
- [x] "Apply to all floors" button per trade (offset by N work days, default 2d)
- [x] `fetchFloorTradeMatrix`: aggregates ATS per floor × trade
- [x] `upsertScheduleBaselines`: server action with onConflict upsert
- [x] Page: 4 parallel fetches (items + plan + baselines + matrix)

### Forecast Engine Completion — ✅ CORE DONE

- [x] 14-day EMA burn rate (EMA_SPAN=14, α=0.133) — replaces 3-day span
- [x] AT_RISK flag: delta_days > 3 tracked in forecast_snapshots
- [x] Cron API: `/api/forecast/refresh` — refreshes all projects (service client, no session)
- [x] `forecastCron.ts` — iterates all projects with try/catch per project
- [ ] 🔨 Crew performance vs benchmark dashboard (tables exist, no UI)
- [ ] 🔨 XLSX support for schedule import (CSV works, XLSX doesn't)
- [x] Vercel Cron config: every 6h (vercel.json) + cron_logs table + cronLogger + fail-safe alerts

### Notification Coverage — ✅ 12/12 WIRED

Audit result: 9 were already wired, 3 were added.

**Previously wired (9):**
- [x] nod_reminder (20h delay without NOD)
- [x] legal_escalation (48h opened, no response)
- [x] legal_follow_up (72h never opened)
- [x] gc_verification_reminder (4h pending)
- [x] gc_verification_escalation (24h pending)
- [x] gc_correction_requested
- [x] gc_verification_approved
- [x] corrective_action_assigned
- [x] morning_briefing

**Newly wired (3):**
- [x] area_blocked — notifies GC team when delay starts (anti-spam 24h)
- [x] area_ready — notifies assigned foremen when trade completes (anti-spam 24h)
- [x] nod_draft_ready — notifies GC supers/PMs when draft needs review (anti-spam 24h)

**Remaining (event-driven, not poll-based):**
- [ ] schedule_delta_alert — needs forecast cron integration
- [ ] trial_ending — needs billing cron
- [ ] payment_failed — needs webhook integration

### AI Morning Briefing — ✅ CORE DONE

- [x] Cron: 11:00 UTC (6AM ET) daily via vercel.json + CRON_SECRET auth
- [x] Demo hardcoded briefing: detects 383 Madison → instant bilingual EN/ES, no API call
- [x] cron_logs structured logging + 3x fail-safe admin alert email
- [ ] 🔨 Cost monitoring: tokens per briefing, alert if monthly >$50
- [ ] 🔨 Settings: briefing push/email toggle

### Labor Rates — Per-Trade Structured Rates — ✅ COMPLETE

#### Database — ✅
- [x] `labor_rates` table: project_id × trade_name × role → hourly_rate (UNIQUE + RLS)
- [x] `trade_sequences`: +straight_time_hours, ot/dt_multiplier, saturday_rule, typical_crew
- [x] `seed_labor_rates(project_id)` RPC: 56 NYC union rates (14 trades × 4 roles)
- [x] `complete_onboarding`: calls seed_labor_rates after trade_sequences insert
- [x] `projects.labor_rate_per_hour` preserved as fallback

#### Settings UI — ✅
- [x] OT Rules table: ST hours, OT/DT multiplier, Saturday rule per trade
- [x] Labor Rates matrix: per-role rates (Foreman/JP/Apprentice/Helper) per trade
- [x] Daily cost auto-calculated from rates × crew × ST hours
- [x] Crew composition editor per trade
- [x] Save Changes + Reset to NYC Defaults buttons
- [x] Onboarding: removed single rate field, replaced with info note

#### Remaining (P2):
- [x] `calculateDelayCost()` using per-trade rates + crew composition (`apps/web/src/lib/costs/calculateDelayCost.ts`)
- [x] NOD/REA PDF: itemized role-by-role cost breakdown — `laborBreakdown.ts` + NOD role table + REA "Cost Basis" section
- [ ] 🔨 Mobile: per-trade daily cost on blocked area cards

### Invitation System — ✅ COMPLETE + HARDENED

- [x] `invite_tokens` table: expanded roles (gc_pm, gc_super, sub_pm, superintendent, foreman)
- [x] Added email, phone, name columns for tracking
- [x] `generateInviteLink()`: auto-sends TeamInviteEmail for email roles
- [x] Foreman: generates URL for manual WhatsApp sharing (no SMS provider in V1)
- [x] Invite modal: 5 role chips, name/email/phone fields, area assignment (foreman)
- [x] `resendInvite()`: extends expiration + re-sends email
- [x] `revokeInvite()`: deletes unused token
- [x] Pending invites list with Copy/Resend/Revoke buttons
- [x] `/join/[token]` page: validates token, supports signup + foreman magic link
- [x] `TeamInviteEmail` template (bilingual EN/ES)
- [x] **Anti-enumeration fix:** Supabase returns fake userId on duplicate email signUp — now resolves real user via `auth.admin.listUsers()` + email lookup
- [x] **FK fix:** Creates `public.users` row from auth data if missing before inserting project_members
- [x] **Superintendent routing:** Added `superintendent` to `subRoles` in middleware.ts + (main-sub)/layout.tsx — was causing redirect loop
- [x] **sub_org_id auto-link:** `redeemInviteToken` sets `projects.sub_org_id` when sub-side user joins (required for RLS visibility)
- [x] **Trade-filtered assignments:** If invite has `trade_name`, only assigns that trade (not all 14) — prevents PowerSync overload
- [ ] 🔨 V2: Twilio SMS for foreman invites (currently WhatsApp manual share)

### Add Areas (Post-Onboarding) — ✅ COMPLETE

- [x] "Add Areas" modal accessible from Ready Board header
- [x] 3 modes: Units+Areas, Floor Areas, CSV Import
- [x] Per-type area_code input (manual, from building plans)
- [x] Free-text unit names (comma-separated: A,B,C or 201,202 or East,West)
- [x] Custom area type input with removable chips
- [x] `addAreasToProject` server action with corridor fallback for new area types

### Change Order Engine

- [ ] 🔍 `scope_changes` table exists — verify schema
- [ ] 🔨 Build Change Order UI: foreman/PM logs change, sqft delta, reason
- [ ] 🔨 Forecast re-calculation on scope change
- [ ] 🔨 Change order → evidence for delay documentation

### Dashboard Polish

- [x] Collapsible sidebar: toggle button, icon-only mode (w-16), localStorage persistence
- [x] Live indicator — pulsing green dot (LiveIndicator.tsx) tracking Supabase Realtime connectivity in top-right bar
- [ ] 🔨 Email verification custom gate (currently Supabase built-in)

### DNS & Email Auth (manual — requires domain purchase)

- [ ] 🔨 Buy readyboard.ai domain
- [ ] 🔨 Connect domain to Vercel (Project Settings → Domains)
- [ ] 🔨 Configure SPF, DKIM, DMARC in Resend + DNS registrar
- [ ] 🔨 Update NEXT_PUBLIC_APP_URL + NEXT_PUBLIC_SITE_URL to https://readyboard.ai
- [ ] 🔨 Test email deliverability from noreply@readyboard.ai

### Demo Account — ✅ FULLY SEEDED

- [x] Demo GC (Tishman Speyer / 383 Madison) has active Pro subscription until 2027-12-31
- [x] All features unlocked: Legal Docs, SHA-256, Checklist, Schedule, Audit Logs
- [x] Demo briefing loads instantly (hardcoded, no API call)
- [x] `scripts/seed-demo-full.ts` — 3-month historical data (Jan 5 → Apr 4 2026)
- [x] Wave pattern Ready Board, 8 delay scenarios, legal docs, CAs, forecast snapshots
- [x] Credentials: demo-gc / demo-sub / demo-foreman all at `demo1234`

---

## ⚪ P3 — APP STORE & FUTURE (V2+)

### App Store Submission

- [x] Configure `eas.json` (dev, preview, production profiles) — Node 20.18.0, env vars in dev + preview
- [x] Development build workflow: `eas build --profile development` once → `npx expo start` for hot reload
- [x] App icon + adaptive icon (Android) — assets/icon.png + assets/adaptive-icon.png exist
- [x] Splash screen — assets/splash.png on #0f172a exists
- [x] Login background images — login-v2-android.jpg + login-v2-ios.jpg wired correctly
- [ ] 🔨 Build production APK via EAS — run: `eas build --profile preview --platform android`
- [ ] 🔨 Build iOS TestFlight via EAS
- [ ] 🔨 App Store screenshots (6.7" + 5.5" for iOS, phone + tablet for Android)
- [ ] 🔨 App Store description (EN + ES)
- [ ] 🔨 Deep linking: readyboard.ai links open the app

### SMS Provider Integration

- [ ] 🔨 Integrate Twilio or Vonage for foreman SMS OTP
- [ ] 🔨 Replace console.log placeholder with real SMS delivery

### V2 Features (Month 3+)

- [ ] AI Insights panel (Gemini 2.5 Pro, requires 10 projects + 90 days)
- [ ] French + Portuguese language support
- [ ] AI Chat Agent (Claude Sonnet 4.6)
- [ ] Cross-project intelligence
- [ ] Owner portal
- [ ] API access for Portfolio plan

### V3 Features (Month 12+)

- [ ] Bid Intelligence Engine (50 projects + 12 months + 20 GCs)
- [ ] DocuSign integration for enterprise GCs
- [ ] ReadyBoard Industry Benchmarks quarterly report
- [ ] White-label enterprise
- [ ] Custom domains
- [ ] SSO/SAML

---

## Summary — Current Status

| Priority | Status | Detail |
|----------|--------|--------|
| 🔴 P0 Critical | ✅ CLOSED | All 4 blockers resolved |
| 🟡 P1 Launch | ✅ CLOSED | 14/14 items + hierarchy + invitations + labor rates |
| 🟢 P2 Post-Launch | ✅ CORE DONE | Settings UI, Add Areas, mobile Floor→Unit grouping, project assignment, performance |
| ⚪ P3 Future | ⏳ BACKLOG | App Store, SMS, AI Chat, Change Orders |

### Remaining Work (non-blocking)

| Task | Est. | Trigger |
|------|------|---------|
| Buy domain + DNS/SPF/DKIM | Manual | Pre-launch |
| ~~`calculateDelayCost()` per-trade~~ | ✅ Done | — |
| ~~NOD/REA PDF itemized cost breakdown~~ | ✅ Done | — |
| ~~Clone Floor button~~ | ✅ Done | — |
| XLSX schedule import | 2h | Post-launch |
| Crew performance UI | 3h | Post-launch |
| Change order engine UI | 4h | Post-launch |
| ~~Live indicator (green dot)~~ | ✅ Done | — |
| Sub Add-on checkout wiring | 1h | Post-launch |
| Mobile EAS build (APK) | 1h | Ready now |
| App Store (screenshots + description) | 4h | V2 |
| SMS provider (Twilio) | 3h | V2 |
| AI Chat Agent | TBD | V2 (post 10 projects) |

**Web launch:** ✅ Ready after domain purchase + DNS config.
**Field test:** ✅ Ready now with demo accounts (Pro unlocked, full 3-month seed data).
**Mobile:** ✅ Development build running with hot reload. PowerSync v6 syncing. Invite flow end-to-end tested.

---

---

## Recent Changes (April 9, 2026 — Performance Optimization)

### Performance: JWT Auth + Loading Skeletons + Parallel Queries ✅

**Migrations applied:**
- `20260409000002_sync_role_org_to_jwt_app_metadata.sql` — backfill + trigger
- `20260409000003_rls_helpers_use_jwt_claims.sql` — JWT-based RLS helpers

**Files modified:**
- `apps/web/src/middleware.ts` — removed DB queries, role from JWT app_metadata
- `apps/web/src/lib/auth/getSession.ts` — wrapped in `React.cache()`
- `apps/web/src/app/(main)/layout.tsx` — added past_due redirect, removed duplicate queries
- `apps/web/src/app/(main)/dashboard/page.tsx` — removed extra `fetchGridData` call
- `apps/web/src/features/ready-board/services/fetchGridData.ts` — parallelized with `Promise.all`
- `apps/web/src/features/settings/components/TradeSequenceConfig.tsx` — toggle visibility fix
- `apps/web/src/features/settings/services/updateTradeMode.ts` — removed Pro gate from checklist mode

**Files created (11 loading.tsx skeletons):**
- `apps/web/src/app/(main)/dashboard/loading.tsx`
- `apps/web/src/app/(main)/dashboard/readyboard/loading.tsx`
- `apps/web/src/app/(main)/dashboard/verifications/loading.tsx`
- `apps/web/src/app/(main)/dashboard/delays/loading.tsx`
- `apps/web/src/app/(main)/dashboard/legal/loading.tsx`
- `apps/web/src/app/(main)/dashboard/forecast/loading.tsx`
- `apps/web/src/app/(main)/dashboard/corrective-actions/loading.tsx`
- `apps/web/src/app/(main)/dashboard/schedule/loading.tsx`
- `apps/web/src/app/(main)/dashboard/team/loading.tsx`
- `apps/web/src/app/(main)/dashboard/settings/loading.tsx`
- `apps/web/src/app/(main)/dashboard/billing/loading.tsx`

**Result:** Middleware 0 DB queries, layout ~91ms, Overview ~103ms, Ready Board ~175ms.

---

## Recent Changes (April 9, 2026 — Custom Trade Sequences)

### Feature: Custom Trade Sequences — Phase Duplication + Custom Trades ✅

**Database migrations applied:**
- (None required — new columns nullable, backward compatible)

**Files created:**
- `apps/web/src/features/settings/components/TradeSequenceConfig.tsx` — drag-and-drop trade reordering
- `apps/web/src/features/settings/components/DuplicatePhaseModal.tsx` — modal for phase creation
- `apps/web/src/features/settings/components/AddTradeModal.tsx` — modal for custom trades
- `apps/web/src/features/settings/components/ChecklistEditor.tsx` — task CRUD modal
- `apps/web/src/features/settings/services/tradeSequenceActions.ts` — server actions (duplicate, create, delete)
- `apps/web/src/features/checklist/services/checklistActions.ts` — checklist server actions

**Files modified:**
- `apps/web/src/features/settings/page.tsx` — use TradeSequenceConfig
- `apps/web/src/features/dashboard/components/DashboardTabs.tsx` — import TradeSequenceConfig
- `apps/web/src/features/ready-board/services/fetchGridData.ts` — composite key generation
- `apps/web/src/features/ready-board/components/GridHeader.tsx` — phase-aware abbreviations
- `apps/web/src/features/ready-board/components/GridFilterBar.tsx` — composite key parsing
- `apps/web/src/features/onboarding/components/StepTradeSequence.tsx` — custom trade input
- `apps/web/src/features/onboarding/services/completeOnboarding.ts` — flag custom trades

**Files deleted:**
- `apps/web/src/features/settings/components/TradeConfig.tsx`
- `apps/web/src/features/settings/services/fetchTradeConfigs.ts`

**Key patterns:**
- Composite trade keys: `"{trade_name}::{phase_label}"` in area_trade_status.trade_type
- Two-phase RPC update (negative offset flip) prevents UNIQUE constraint deadlock
- Backward compatible: null phase_label works normally
- Custom trades flagged with `is_custom=true` for bulk cleanup

**Build status:**
- `npx tsc --noEmit` — ✅ 0 errors
- `npm run build` — ✅ success

---

## Recent Changes (April 6, 2026)

### Bug fixes committed April 5-6:
- [x] **Checklist tasks in GC web panel showing 0 completed** — `GridDetailPanel.tsx` was filtering `status === 'completed'` (wrong) instead of `'complete'`. Fixed all 5 occurrences.
- [x] **Checklist taps reverting on mobile** — `get_accessible_area_ids()` only checked org membership, not direct `user_assignments`. Foremen (direct-assigned, no org) got empty result set → RLS rejected every task UPDATE → PowerSync reverted. Fixed: added `UNION SELECT area_id FROM user_assignments WHERE user_id = auth.uid()`.
- [x] **42P17 storage recursion error** — `project_members_can_upload_legal_docs` storage policy had self-referencing `storage.objects` in its own WITH CHECK. Removed recursion; policy now checks `bucket_id = 'field-reports'` only.
- [x] **Live indicator + notification bell overlapping page content** — Was `position: fixed`. Replaced with in-flow `h-12` top bar in layout.

### 3 Improvements (THREE_IMPROVEMENTS_PROMPT.md):
- [x] **Fix 1 — GC VERIFY excluded from sub progress %**
  - `calculate_effective_pct` DB trigger now counts `task_owner = 'sub'` tasks only
  - Gate cap only applies when there's an incomplete SUB gate (GC gate blocks DONE, not %)
  - Mobile: checklist split into "Your tasks (X/Y)" + "GC Verification Required" cards (purple)
  - Web GC panel: "Sub Tasks" section + "GC Verification" section with PENDING/DONE badges
- [x] **Fix 2 — Auto start_date + completed_at on area_trade_status**
  - `started_at`: set when sub effective_pct goes 0 → >0 for the first time
  - `completed_at`: set at 100%, cleared if progress regresses (GC correction)
  - Web detail panel: "Work Dates" section → Started · Completed · Duration in days
  - `fetchCellDetails` queries `area_trade_status` for both dates
- [x] **Fix 3 — Optional progress photos (not just blockers)**
  - `Step2Blockers`: camera button (optional) before blocker question — `photo_type='progress'`
  - `TaskChecklist`: 📷 icon on each sub task row → camera → upload → `area_tasks.photo_url`
  - `photo_type` column on `field_reports` (`progress | blocker | evidence | safety`)
  - `photo_type` derived at submit: `has_blockers=true → 'blocker'`, else `'progress'`
  - PowerSync schema.ts + sync-rules.yaml updated (⚠️ redeploy to PowerSync dashboard needed)

### Migrations applied (via Supabase MCP):
- `20260405120000_fix_get_accessible_area_ids.sql` — foreman RLS fix
- `20260406100000_fix1_fix2_gc_tasks_and_dates.sql` — GC task exclusion + started_at/completed_at
- `20260406100001_fix3_photo_type.sql` — photo_type column on field_reports

### ⚠️ Manual action required:
- PowerSync Dashboard → Sync Rules → redeploy `sync-rules.yaml` (adds `started_at`, `completed_at` to area_trade_status + `photo_type` to field_reports)

---

## Remaining Work

| Task | Est. | Priority |
|------|------|----------|
| Buy domain + DNS/SPF/DKIM | Manual | Pre-launch |
| PowerSync sync rules redeploy | 5min | ⚠️ NOW |
| XLSX schedule import | 2h | Post-launch |
| Crew performance UI | 3h | Post-launch |
| Change order engine UI | 4h | Post-launch |
| Sub Add-on checkout wiring | 1h | Post-launch |
| Mobile EAS production build (APK) | 1h | Ready now |
| App Store (screenshots + description) | 4h | V2 |
| SMS provider (Twilio) for foreman OTP | 3h | V2 |
| Settings: editable area_code per area | 2h | Post-launch |
| Mobile: per-trade daily cost on blocked areas | 2h | Post-launch |
| AI Chat Agent | TBD | V2 (post 10 projects) |

**Web launch:** ✅ Ready after domain + DNS.
**Mobile field test:** ✅ Ready. Development build running, PowerSync v6, invite flow end-to-end tested.

---

*ReadyBoard v6.0 — TASKS.md — Updated 2026-04-10 (Schedule manual entry tab + CSV import)*
*readyboard.ai*
