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
> Last updated: 2026-04-01 (hierarchy refactor + labor rates)

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
- [x] Sync rules: 3 buckets (by_user, by_area, by_project) — no JOINs/subqueries

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

#### Remaining (P2):
- [ ] 🔨 Clone Floor button (copies structure from Floor N to N+1)
- [ ] 🔨 Mobile: group "My Areas" by unit (PowerSync schema ready)
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

### Labor Rates — Per-Trade Structured Rates — ✅ DB DONE

#### Database — ✅
- [x] `labor_rates` table: project_id × trade_name × role → hourly_rate (UNIQUE + RLS)
- [x] `trade_sequences`: +straight_time_hours, ot/dt_multiplier, saturday_rule, typical_crew
- [x] `seed_labor_rates(project_id)` RPC: 56 NYC union rates (14 trades × 4 roles)
- [x] `complete_onboarding`: calls seed_labor_rates after trade_sequences insert
- [x] `projects.labor_rate_per_hour` preserved as fallback

#### Frontend + Integration — ❌ Not Built
- [ ] 🔨 Settings UI: editable rate matrix (Trades & Costs tab) — OT rules + role rates
- [ ] 🔨 `calculateDelayCost()` using per-trade rates + crew composition
- [ ] 🔨 NOD/REA PDF: itemized role-by-role cost breakdown
- [ ] 🔨 Onboarding: remove single rate field, add info note about defaults
- [ ] 🔨 Mobile: per-trade daily cost on blocked area cards

### Change Order Engine

- [ ] 🔍 `scope_changes` table exists — verify schema
- [ ] 🔨 Build Change Order UI: foreman/PM logs change, sqft delta, reason
- [ ] 🔨 Forecast re-calculation on scope change
- [ ] 🔨 Change order → evidence for delay documentation

### Dashboard Polish

- [x] Collapsible sidebar: toggle button, icon-only mode (w-16), localStorage persistence
- [ ] 🔨 Live indicator (green dot) in top bar
- [ ] 🔨 Email verification custom gate (currently Supabase built-in)

### DNS & Email Auth (manual — requires domain purchase)

- [ ] 🔨 Buy readyboard.ai domain
- [ ] 🔨 Connect domain to Vercel (Project Settings → Domains)
- [ ] 🔨 Configure SPF, DKIM, DMARC in Resend + DNS registrar
- [ ] 🔨 Update NEXT_PUBLIC_APP_URL + NEXT_PUBLIC_SITE_URL to https://readyboard.ai
- [ ] 🔨 Test email deliverability from noreply@readyboard.ai

### Demo Account — ✅ PRO UNLOCKED

- [x] Demo GC (Tishman Speyer / 383 Madison) has active Pro subscription until 2027-12-31
- [x] All features unlocked: Legal Docs, SHA-256, Checklist, Schedule, Audit Logs
- [x] Demo briefing loads instantly (hardcoded, no API call)

---

## ⚪ P3 — APP STORE & FUTURE (V2+)

### App Store Submission

- [ ] 🔨 Configure `eas.json` (dev, preview, production profiles)
- [ ] 🔨 Create app icon: 1024×1024 PNG (App Store) + adaptive icon (Android)
- [ ] 🔨 Create splash screen: Floor Pulse logo on #0f172a background
- [ ] 🔨 Build Android APK via EAS
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
| 🟡 P1 Launch | ✅ CLOSED | 14/14 items done + hierarchy refactor complete |
| 🟢 P2 Post-Launch | ✅ CORE DONE | Hierarchy, labor rates DB, forecast, notifications, security |
| ⚪ P3 Future | ⏳ BACKLOG | App Store, SMS, AI Chat, Change Orders |

### Remaining Work (non-blocking)

| Task | Est. | Trigger |
|------|------|---------|
| Buy domain + DNS/SPF/DKIM | Manual | Pre-launch |
| Labor rates Settings UI | 4h | Post-launch |
| `calculateDelayCost()` per-trade | 3h | Post-launch |
| NOD/REA PDF itemized cost breakdown | 3h | Post-launch |
| Clone Floor button | 2h | Post-launch |
| Mobile: group areas by unit | 3h | Post-launch |
| Settings: editable area_code | 1h | Post-launch |
| XLSX schedule import | 2h | Post-launch |
| Crew performance UI | 3h | Post-launch |
| Change order engine UI | 4h | Post-launch |
| Live indicator (green dot) | 1h | Polish |
| Sub Add-on checkout wiring | 1h | Post-launch |
| App Store (eas.json + builds) | 4h | V2 |
| SMS provider (Twilio) | 3h | V2 |
| AI Chat Agent | TBD | V2 (post 10 projects) |

**Web launch:** ✅ Ready after domain purchase + DNS config.
**Field test:** ✅ Ready now with demo accounts (Pro unlocked).

---

*ReadyBoard v5.4 — TASKS.md — Updated 2026-04-01 (hierarchy refactor + labor rates)*
*readyboard.ai*
