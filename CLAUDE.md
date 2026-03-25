# ReadyBoard — CLAUDE.md

> **ReadyBoard is a legal infrastructure platform for commercial construction.**
> It tells every trade what areas they can work TODAY, alerts when something changes,
> and auto-documents every lost day as legal evidence — in the foreman's language, without internet.
>
> **Read this entire file before writing any code.**

---

## Product Definition

ReadyBoard is NOT a project management tool. It is the equivalent of an insurance policy
for specialty contractors.

- **GC buys for operational visibility** (1-Screen Dashboard, Ready Board grid, Verification Queue)
- **Specialty contractor stays for legal protection** (NOD, REA, Evidence Package with SHA-256)

Two different value propositions. Two different buyers. Both valid, recurring, defensible.

---

## Golden Path Stack

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Monorepo | Turborepo | 2.8+ | ✅ Built |
| Frontend (Mobile) | Expo SDK 52 + React Native 0.76 + TypeScript | | ✅ Built |
| Frontend (Web) | Next.js 16 + React 19 + TypeScript | | ✅ Built |
| Styles | Tailwind CSS 4 + shadcn/ui | Dark theme | ✅ Built |
| Backend | Supabase (Auth + PostgreSQL + RLS + Realtime) | | ✅ Built |
| Offline Engine | PowerSync + SQLite | Cloud: 69bca667 | ✅ Built |
| Payments | Stripe (Checkout + Portal + Webhooks) | | 🔨 Week 10 |
| Email | Resend + React Email | | 🔨 Week 13 |
| AI (V2) | Gemini 2.5 Flash via Vercel AI SDK + OpenRouter | | 🔨 Week 15 |
| AI (V2.5+) | Claude Sonnet 4.6 via Anthropic API | Chat agent | Post-launch |
| i18n (Web) | next-intl v4.8 | Auto-detect | ✅ Built |
| i18n (Mobile) | i18next + react-i18next + expo-localization | Auto-detect | ✅ Built |
| Validation | Zod | | ✅ Built |
| State | Zustand | | ✅ Built |
| Testing | Vitest (unit) + Playwright (web E2E) | 50 tests passing | ✅ Built |
| Deploy (Web) | Vercel | Live | ✅ Built |
| Deploy (Mobile) | Expo EAS | | Pending |
| Legal Docs | pdf-lib + crypto (SHA-256) | | ✅ Built |

---

## Architecture

```
readyboard/
├── apps/
│   ├── mobile/                  Expo (Foreman + Sub PM)
│   │   ├── app/                 Expo Router (index, login, debug, report, (main))
│   │   ├── src/providers/       AuthProvider, PowerSyncMobileProvider, I18nProvider
│   │   ├── src/components/      DebugNav, SuccessView, report flow screens
│   │   └── app.json             Plugins (camera, location, haptics, i18n)
│   └── web/                     Next.js 16 (GC Dashboard + Landing)
│       ├── src/app/             App router: /dashboard, /login, /signup, /onboarding, /billing
│       ├── src/middleware.ts     Route protection (auth + role guard)
│       ├── src/features/        Feature modules (see below)
│       ├── src/lib/             Shared utils: auth, supabase clients, audit, constants, legal
│       ├── messages/            EN + ES translations (next-intl)
│       └── src/shared/          Modal, UI components
├── packages/
│   ├── db/                      PowerSync schema + sync rules + SupabaseConnector
│   └── shared/                  Hooks (usePowerSync, useFieldReport), types, i18n (165+ keys EN/ES)
├── supabase/
│   └── migrations/              37+ SQL migrations
├── scripts/                     test-rls.sql, test-offline-sync.ts, audit-delay-logs.ts, seed-demo.ts
└── turbo.json
```

### Feature Modules (apps/web/src/features/)

```
ready-board/     Grid + Corrective Actions + Orchestration (ActionEventBus, 35 tests)
dashboard/       1-Screen GC Dashboard (Metrics, Alerts, Forecast, NodDrafts, tabs)
forecast/        Burn rate engine, schedule import (P6 CSV), delta alerts (9 tests)
legal/           SignaturePad, thresholdEngine, evidenceStorage, pdfAssembler, nodAutoGen
finance/         Change order engine (convert, approve, reject, financial summary)
reports/         Executive report generation + PDF export
checklist/       [Week 9-12] Task templates, verification queue, approve/correct flows
```

---

## Database: Current State

**22 tables, 60 RLS policies, 26 functions, 21 triggers, 87 indexes, 37 migrations.**

| Table | Status | Key Details |
|-------|--------|-------------|
| organizations | ✅ | 3 rows, type gc/sub, default_language. Needs: stripe columns (Week 10) |
| projects | ✅ | 2 rows, labor_rate, jurisdiction, sha256, thresholds, safety_gate |
| users | ✅ | 3 rows, 6 roles, auto-created on signup. Needs: push_token (Week 12) |
| areas | ✅ | 31 rows, 6 area_types, floor, total_sqft |
| trade_sequences | ✅ | 14 trades, canonical interior finish sequence |
| user_assignments | ✅ | Schema ready, 0 rows (need foreman assignment UI) |
| area_trade_status | ✅ | 420 rows, reporting_mode, effective_pct, verification_pending |
| field_reports | ✅ | 14 columns incl GPS, photo, offline_created_at |
| delay_logs | ✅ | 19 columns, 5 triggers (immutability, cost calc, delete guard) |
| corrective_actions | ✅ | Full lifecycle: created → acknowledged → resolved |
| legal_documents | ✅ | 22 columns, SHA-256, receipt tracking, locale, coopetition |
| nod_drafts | ✅ | JSONB draft, reminder tracking, draft_pdf_path |
| receipt_events | ✅ | IP, device_type, opened_at |
| production_benchmarks | ✅ | 1 row seeded |
| schedule_items | ✅ | P6 mapping, baseline_finish, is_critical, unique on activity_id |
| forecast_snapshots | ✅ | Atomic upsert via RPC |
| notifications | ✅ | Type-based, anti-spam index, 5 types |
| audit_log | ✅ | 19 action types |
| change_orders | ✅ | Proposal → approval flow |
| scope_changes | ✅ | Evidence linkage to REA |
| trade_task_templates | ✅ | 211 rows — 14 trades × 4 area types |
| area_tasks | ✅ | 28 columns, SUB/GC ownership, gate, correction fields |

### Tables Needed (Weeks 10-15)

| Table | Week | Purpose |
|-------|------|---------|
| organizations (ALTER) | 10 | stripe_customer_id, stripe_subscription_id, plan, trial_ends_at, subscription_status |
| users (ALTER) | 12 | push_token TEXT |
| briefings | 15 | AI morning briefing storage, tokens, read_at |

---

## User Roles & Permissions

| Role | App | Can Do | Cannot Do |
|------|-----|--------|-----------|
| `gc_admin` | Web | Everything + org settings, billing, team mgmt | Access sub legal docs until published |
| `gc_pm` | Web | Dashboard, Ready Board, verify, CAs, forecast | Billing, org settings |
| `gc_super` | Web + Mobile | Verify tasks, create CAs, view all trades | Billing, org settings |
| `sub_pm` | Web + Mobile | Sub areas, legal docs, delay costs, manage foremen | GC dashboard, CAs |
| `superintendent` | Mobile + Web | Review NODs, send legal docs, manage foremen | GC dashboard |
| `foreman` | Mobile only | Report status, view assigned areas, submit photos | Other trades, dashboard, legal, settings |
| `owner` | Web | Executive summary, projections | Everything else |

---

## The 14-Trade Interior Finish Sequence

```
 1. Rough Plumbing
 2. Metal Stud Framing + Door Frames (HM frames set here, doors hung Trade 11)
 3. MEP Rough-In (In-Wall) — fire protection → HVAC → electrical → plumbing
 4. Fire Stopping — dedicated specialty sub, FDNY inspects separately
 5. Insulation & Drywall — hang, tape, mud, sand to Level 4
 6. Waterproofing (Wet Areas) — membrane + 24h flood test
 7. Tile / Stone — over cured waterproof membrane
 8. Paint — primer + 2 finish coats
 9. Ceiling Grid / ACT — suspended acoustical tile (offices, corridors)
10. MEP Trim-Out — outlets, lights, faucets, toilets, registers
11. Doors & Hardware — hang doors, locksets, closers
12. Millwork, Casework & Countertops
13. Flooring (Non-Tiled) — carpet, LVT, hardwood
14. Specialties, Final Clean & Punch List
```

211 task templates pre-seeded across 14 trades × 4 area types (bathroom, kitchen, corridor, office).

---

## Checklist System

### Two Reporting Modes (per trade, GC configures)

- **Percentage (default):** Slider → `effective_pct = manual_pct`
- **Checklist (opt-in):** Task checkboxes → `effective_pct = SUM(done_weights) / SUM(all_weights) × 100`

Both produce `effective_pct`. Ready Board, Forecast, Legal Docs consume it identically.

### Task Ownership

- **🔧 SUB** — Foreman completes. GPS + timestamp + photo captured.
- **👷 GC VERIFY** — Only GC super can complete. Greyed out on foreman screen: "Awaiting GC".
- **⛔ Gate** — Blocks READY regardless of %. "79% — awaiting GC verification" = ALMOST (yellow).

### Template Cloning (CRITICAL)

When areas are created → system MUST clone `trade_task_templates` into `area_tasks`.
**🔍 VERIFY THIS WORKS. If it doesn't, build `clone_task_templates_for_area()` function.**

### GC Verification Chain

Last SUB task before GC gate complete → notify GC → 4h reminder → 24h escalation to sub PM.
All timestamps become NOD evidence.

---

## GC Web Dashboard — Full Navigation

### Current State (Week 8)
Sidebar: "ReadyBoard" logo + "Dashboard" link only.
Content: DashboardTabs with 5 tabs (Overview, Ready Board, Verifications, Legal Docs, Settings).

### Target State (Week 11)
Convert tabs to separate routes. Add sidebar with full navigation:

```
[ReadyBoard Logo]
[Project Selector]
──────────────────
📊 Overview              /dashboard/overview         ✅ Built (as tab)
📋 Ready Board           /dashboard/readyboard       ✅ Built (as tab)
👷 Verifications (badge) /dashboard/verifications    ✅ Built (as tab)
⚠️ Delays & Costs        /dashboard/delays           🔨 Week 11
⚖️ Legal Docs            /dashboard/legal            ✅ Built (as tab)
📈 Forecast              /dashboard/forecast         🔨 Week 11
🔧 Corrective Actions    /dashboard/corrective-actions  🔨 Week 11
📅 Schedule              /dashboard/schedule         🔨 Week 11
👥 Team                  /dashboard/team             🔨 Week 11
⚙️ Settings              /dashboard/settings         ✅ Partial (Trade Config only)
──────────────────
💳 Billing               /dashboard/billing          🔨 Week 10
🚪 Logout                                            🔨 Week 9
──────────────────
[User + Role Badge]
```

---

## Foreman Mobile — The Carlos Standard

**North Star:** Carlos, 60 years old, Spanish-speaking, WhatsApp-only phone user.
60-second morning update. Day 1. Zero training. No exceptions.

### 6 Principles

| # | Principle | Rule |
|---|-----------|------|
| 1 | One Job Per Screen | Every screen does exactly one thing |
| 2 | Color Does the Talking | Status via color + icon. No reading required |
| 3 | Maximum 3 Taps | Every field action ≤ 3 taps. If 4+ → redesign |
| 4 | Big Buttons, Large Text | Min 56px tap targets. Min 18px body text |
| 5 | Loud Confirmation | Full-screen green ✓ + haptic. No toasts. |
| 6 | Offline is Invisible | No connectivity errors. EVER. |

### Current Mobile State (Week 8)
- ✅ Home screen with color-coded area cards (READY/ALMOST/BLOCKED/HELD)
- ✅ 3-step report flow: slider → blockers → reason codes
- ✅ Confirmation screen with haptic
- ✅ NOD draft banner (purple)
- ✅ Offline-first via PowerSync
- ✅ i18n auto-detect EN/ES
- ✅ SMS OTP login
- ✅ Checklist mode (TaskChecklist component)
- 🔌 GPS capture: expo-location installed, NOT wired to submit
- 🔌 Photo capture: expo-camera installed, NOT wired to submit
- ❌ Bottom tab navigation (stack only)
- ❌ Profile/settings screen
- ❌ Push notifications (DB-only polling)

### Target Navigation (Week 12)
```
🏠 My Areas    📋 Report    ⚖️ Legal    👤 Profile
```

### What Foremen NEVER See
AI, GC VERIFY tasks (greyed), billing, settings, org management, other trades, connectivity errors.

---

## Legal Documentation Engine

### Current State (Week 8)
- ✅ SHA-256 hash computation + storage + verification endpoint
- ✅ NOD draft auto-generation (pending → draft PDF → watermark)
- ✅ NOD approval flow (draft → signature → final PDF → sent)
- ✅ Finger signature canvas (pointer events, metadata, PNG export)
- ✅ PDF generation via pdf-lib (header, details, costs, signature, footer)
- ✅ Evidence storage (Supabase Storage, immutable, SHA-256 verified)
- ✅ Receipt tracking pixel endpoint: /api/legal/track/[uuid]
- ✅ 48h/72h escalation logic
- ✅ REA threshold detection ($5K or 3 crew-days)
- 🔨 Receipt tracking pixel in outbound NOD email (email sending not wired)
- 🔨 REA PDF generation (cost table template)
- 🔨 Evidence Package PDF (8-section arbitration document)
- 🔨 AIA A201 contract references (needs attorney review)
- 🔨 Bilingual PDF output (currently English only)

### The Three Documents

1. **NOD** — Day 1 BLOCKED. Auto-draft → super reviews → finger-signs → sends. SHA-256 + pixel.
2. **REA** — Cumulative > $5K or 3 crew-days. Itemized cost table. References all NODs.
3. **Evidence Package** — On demand. 8-section arbitration PDF. All exhibits.

---

## Billing & Plans (Stripe) — Week 10

| Plan | Price | For | Key Limits |
|------|-------|-----|------------|
| Trial | Free 30 days | Everyone | Pro features, 1 project |
| Starter | $399/mo | GC small | No legal docs, no checklist, no SHA-256 |
| Pro | $699/mo | GC serious | Everything |
| Portfolio | $1,999/mo | GC multi | Unlimited projects + API + AI |
| Sub Add-on | $59/mo | Specialty sub | Legal docs + delay costs |

### Feature Gate Matrix

```
Feature                    | Trial | Starter | Pro  | Portfolio | Sub
---------------------------|-------|---------|------|-----------|----
Ready Board                |  ✓    |   ✓     |  ✓   |    ✓      |  —
Field reports              |  ✓    |   ✓     |  ✓   |    ✓      |  ✓
Delay logs                 |  ✓    |   ✓     |  ✓   |    ✓      |  ✓
Basic forecast             |  ✓    |   ✓     |  ✓   |    ✓      |  —
Corrective actions         |  ✓    |   ✓     |  ✓   |    ✓      |  —
Checklist mode             |  ✓    |   —     |  ✓   |    ✓      |  —
Legal docs                 |  ✓    |   —     |  ✓   |    ✓      |  ✓
SHA-256 + receipts         |  ✓    |   —     |  ✓   |    ✓      |  ✓
Verification Queue         |  ✓    |   —     |  ✓   |    ✓      |  —
Schedule import            |  ✓    |   —     |  ✓   |    ✓      |  —
Multiple projects          |  —    |   —     |  —   |    ✓      |  —
AI Morning Briefing        |  —    |   —     |  —   |    ✓      |  —
```

---

## AI Morning Briefing Agent — Week 15

Proactive daily briefing at 6:00 AM. No chat. Agent reads project data → writes 4-8 sentence
summary personalized to role (GC: verifications + forecast | Sub: delays + costs + NODs).

- **Model:** Gemini 2.5 Flash via OpenRouter. $0.90/month for 50 users.
- **Fallback:** Claude Haiku 4.5 ($6.75/mo) if quality insufficient.
- **Rule:** Every briefing labeled "🤖 AI Briefing · Based on [project] data as of [time]"
- **Rule:** Foreman mobile NEVER shows briefing. GC/Sub PM only.
- **Demo:** Hardcoded briefing for demo account (no API call).

---

## Email System — Week 13

- Provider: Resend + React Email
- Sender: noreply@readyboard.ai (SPF, DKIM, DMARC)
- Templates (bilingual EN/ES): welcome, team invite, NOD delivery (with pixel), receipt confirmation, trial ending (7/3/1 day), payment failed, morning briefing digest

---

## Notification Rules

| Event | Who | Channel |
|-------|-----|---------|
| Area READY | Assigned foreman | Push |
| Area BLOCKED | GC PM + Sub PM | Push + Web |
| NOD draft ready | Superintendent | Push |
| NOD 20h reminder | Superintendent | Push |
| GC opened NOD | Sub PM | Push + Web |
| GC 48h no response | Sub PM | Push + Web |
| GC verify needed | GC Super | Push + Web |
| 4h verify reminder | GC Super | Push |
| 24h escalation | Sub PM | Push + Web |
| Correction requested | Sub foreman | Push |
| Morning briefing | GC/Sub PM | Push + Email |
| Trial ending | Account owner | Email |

Anti-spam: 1 per type per area per 24h. All bilingual EN/ES.

---

## Demo Account

- GC: `demo-gc@readyboard.ai` / `ReadyBoard2026!`
- Sub: `demo-sub@readyboard.ai` / `ReadyBoard2026!`
- Project: 383 Madison Ave, Tishman (GC, pro), Jantile (sub, sub_addon)
- 9 floors, 45 areas, 14 trades, realistic progress + delays + legal docs + verifications
- Resettable via `scripts/seed-demo.ts`

---

## Markets — Year 1

USA only. NYC + Miami first 6 months. Chicago Q3-Q4. Houston Q4.
Colombia opportunistic only (4 conditions required).

---

## What NOT To Do

- Do NOT add AI to foreman mobile screens
- Do NOT auto-send NODs (always human-approved: draft → review → send)
- Do NOT auto-approve GC VERIFY tasks (inaction IS evidence)
- Do NOT allow partial GC verification (approve or correct, nothing between)
- Do NOT require foremen to create accounts or set passwords (SMS magic link only)
- Do NOT show connectivity errors on mobile (offline is invisible)
- Do NOT build AI chat before Morning Briefing ships + 10 projects have data
- Do NOT attempt international legal templates in Year 1
- Do NOT use per-user pricing (GCs think in project costs)
- Do NOT build full JHA/safety module (keep lightweight gate)
- Do NOT ship legal AI narrative without attorney review gate
- Do NOT require sequential task completion in checklists (gates enforce, not sequence)
- Do NOT build Post-Launch Backlog during Weeks 9-15
- Do NOT duplicate existing code — always 🔍 VERIFY FIRST

---

## Skills Available

When working on specific systems, read the relevant skill BEFORE writing code:

| Skill | Location | Use When |
|-------|----------|----------|
| stripe-billing | /mnt/skills/user/stripe-billing/SKILL.md | Checkout, webhooks, plans, enforcement |
| supabase-rls | /mnt/skills/user/supabase-rls/SKILL.md | Tables, policies, debugging "no data" |
| readyboard-legal-docs | /mnt/skills/user/readyboard-legal-docs/SKILL.md | SHA-256, PDFs, receipt tracking, NOD/REA |
| expo-mobile | /mnt/skills/user/expo-mobile/SKILL.md | Foreman app, offline, GPS, photo, Carlos Standard |
| readyboard-notifications | /mnt/skills/user/readyboard-notifications/SKILL.md | 12 notification types, push, anti-spam |
| readyboard-checklist | /mnt/skills/user/readyboard-checklist/SKILL.md | Templates, tasks, gates, verification chain |

---

*ReadyBoard v5.3 — Legal Infrastructure Platform*
*Built for Carlos. Defended in arbitration. Scaled to Dubai.*
*readyboard.ai*
