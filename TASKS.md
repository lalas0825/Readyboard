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
> Last updated: 2026-03-27

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

### 6. Floor → Unit → Area Hierarchy — ✅ PHASE 1 DONE

#### Database — ✅
- [x] `units` table created (id, project_id, floor, name, unit_type + RLS)
- [x] `areas.unit_id` FK column added (nullable for backwards compat)

#### Quick Add — ✅ Multi-type + Presets
- [x] 5 presets: Standard 2BR, Studio, 3BR Luxury, Office Suite, Common Areas
- [x] Multi-type selection (checkboxes) when using Custom mode
- [x] Preset mode generates named areas per unit (e.g., "1A Master Bath", "1A Kitchen")

#### Phase 2 (P2 — post-launch):
- [ ] 🔨 Clone Floor button (copies structure from Floor N to N+1)
- [ ] 🔨 Grid: group area rows by unit (collapsible)
- [ ] 🔨 Mobile: group "My Areas" by unit
- [ ] 🔨 Seed data: add units to 383 Madison demo

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

### 11. Rate Limiting on Auth Routes — ✅ DONE

- [x] In-memory rate limiter in middleware.ts (per-IP, auto-cleanup)
- [x] Auth routes (login, signup, forgot-password, /api/auth/*, /api/invite/*): 10 req/min
- [x] Webhook route (/api/billing/webhook): 100 req/min
- [x] Returns 429 Too Many Requests on breach

### 12. Stripe — Sub Add-on Price ID

- [ ] 🔨 Create Sub Add-on product ($59/mo) in Stripe dashboard (manual)
- [ ] 🔨 Add Price ID to env vars
- [ ] 🔌 Wire to checkout flow for sub_pm role

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

### Forecast Engine Completion

- [ ] 🔨 14-day EMA burn rate algorithm (columns exist, no calculation)
- [ ] 🔨 At-risk alerts trigger when area >3 days behind baseline
- [ ] 🔨 Crew performance vs benchmark dashboard (tables exist, no UI)
- [ ] 🔨 XLSX support for schedule import (CSV works, XLSX doesn't)

### Notification Coverage

- [ ] 🔍 Audit which of the 12 notification types are wired
- [ ] 🔌 Wire remaining notification triggers:
  - Area READY for your trade
  - Area BLOCKED on your project
  - NOD draft ready for review
  - GC verification needed
  - GC verification reminder (4h)
  - Escalation alert (24h)
  - Correction requested
  - Schedule delta alert
  - REA threshold reached
  - Briefing ready
  - Trial ending
  - Payment failed

### AI Morning Briefing — Complete Implementation

- [ ] 🔨 Configure cron: 6am ET daily generation
- [ ] 🔨 Build demo hardcoded briefing (no API call for demo account)
- [ ] 🔨 Add cost monitoring: tokens per briefing, alert if monthly >$50
- [ ] 🔨 Past briefings view (last 7 days)
- [ ] 🔨 Settings: briefing push/email toggle

### Change Order Engine

- [ ] 🔍 `scope_changes` table exists — verify schema
- [ ] 🔨 Build Change Order UI: foreman/PM logs change, sqft delta, reason
- [ ] 🔨 Forecast re-calculation on scope change
- [ ] 🔨 Change order → evidence for delay documentation

### Dashboard Polish

- [ ] 🔨 Collapsible sidebar (icon-only mode)
- [ ] 🔨 Live indicator (green dot) in top bar
- [ ] 🔨 Email verification custom gate (currently Supabase built-in)

### DNS & Email Auth

- [ ] 🔨 Verify/configure SPF, DKIM, DMARC records on readyboard.ai
- [ ] 🔨 Test email deliverability from noreply@readyboard.ai

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

## Summary — Work Remaining

| Priority | Items | Est. Hours | Timeline |
|----------|-------|------------|----------|
| 🔴 P0 Critical | 4 items | ~2 hrs | Today |
| 🟡 P1 Launch | 10 items | ~20 hrs | This week |
| 🟢 P2 Post-Launch | ~15 items | ~40 hrs | Week 1-2 post-launch |
| ⚪ P3 Future | ~20 items | Ongoing | V2+ |

**Web launch target:** After P0 + P1 complete (~22 hours of work).
**App Store target:** After P3 App Store items (~15 hours additional).

---

*ReadyBoard v5.3 — TASKS.md — Updated 2026-03-27 post-audit v2*
*readyboard.ai*
