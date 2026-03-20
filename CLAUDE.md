# ReadyBoard — Factory OS

> *"Built for Carlos. Defended in arbitration. Scaled to Dubai."*

## What Is This Project

**ReadyBoard** is a legal infrastructure platform for commercial construction. It tells every trade what areas they can work TODAY, alerts when something changes, and auto-documents every lost day as legal evidence — in the foreman's language, without internet.

**Category:** Insurance policy disguised as a coordination tool.
**Two value props, two buyers:**
- GC buys for **operational visibility** (1-Screen Dashboard)
- Specialty contractor stays for **legal protection** (NOD/REA/Evidence Package)

## Golden Path Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend (Mobile) | Expo + React Native + TypeScript | One codebase → iOS, Android, Web |
| Frontend (GC Web) | Next.js 16 + React 19 + TypeScript | Dashboard, reports, admin |
| Styles | Tailwind CSS 3.4 + shadcn/ui | Consistent, fast, Carlos-proof |
| Backend | Supabase (Auth + PostgreSQL + RLS + Realtime) | Row Level Security, realtime updates |
| Offline Engine | PowerSync + SQLite | Offline-first — the #1 technical decision |
| AI Engine | Vercel AI SDK v5 + OpenRouter (Gemini 2.5 Pro) | Phase 1+ only, data-gated |
| i18n | i18next + expo-localization | Auto-detect device language |
| Validation | Zod | Shared schemas mobile + web |
| State | Zustand | Lightweight, works with PowerSync |
| Testing | Playwright (web) + Detox (mobile) | 3-tap flow timing tests |
| Deploy | Vercel (web) + Expo EAS (mobile) | Standard Golden Path |
| Legal Docs | Node.js PDF generation + crypto (SHA-256) | Tamper-evident legal instruments |

## Architecture: Two Apps, One Codebase Strategy

```
readyboard/
├── apps/
│   ├── mobile/          # Expo app (Foreman + Sub PM)
│   └── web/             # Next.js app (GC Dashboard + Admin)
├── packages/
│   ├── shared/          # Shared types, Zod schemas, i18n, utils
│   ├── db/              # Supabase client, PowerSync schema, migrations
│   └── legal/           # PDF generation, SHA-256, NOD/REA templates
├── supabase/
│   ├── migrations/      # SQL migrations
│   └── seed.sql         # Demo data (80 Clarkson)
└── turbo.json           # Turborepo config
```

## UX Philosophy — The Carlos Standard

**North Star:** Carlos, 60 years old, Spanish-speaking, uses phone for calls and WhatsApp only. If he can't complete his morning update in under 60 seconds on Day 1 with zero training, the UX has failed.

### Foreman Mobile — 6 Principles

| # | Principle | Rule |
|---|-----------|------|
| 1 | One Job Per Screen | Every screen does exactly one thing |
| 2 | Color Does the Talking | Status via color + icon. No English required to understand |
| 3 | Maximum 3 Taps | Every field action ≤ 3 taps. If 4+ required, redesign |
| 4 | Big Buttons, Large Text | Tap targets min 56px. Body text min 18px. Gloved hands, bright sun |
| 5 | Loud Confirmation | Full-screen green checkmark + haptic. No subtle toasts |
| 6 | Offline is Invisible | No error messages about connectivity. App works identically offline |

### Foreman UX Decisions (V1)

- **Home = one question, not a list.** "Where are you working?" with color-coded area buttons
- **Status buttons, not slider.** "Done?" → YES / NO / ALMOST. No percentage precision needed
- **High contrast mode for field.** Light background, bold colors, readable in direct sunlight
- **Language auto-detected** from phone settings. No config screen. Fallback toggle hidden in profile
- **Zero-screen onboarding.** Super sends SMS link. Foreman opens it. Sees his areas. Done
- **No menus, no hamburgers, no settings visible.** Carlos never opens a settings page

### GC Dashboard UX

- **Data-dense is OK.** John lives in Procore and Excel. He expects tables and filters
- **Dark theme.** Indoor office use. Matches the premium positioning
- **The 1-Screen Dashboard answers 3 questions only:**
  1. What's happening RIGHT NOW? (floor status strip)
  2. What needs my attention? (alerts ranked by cost of inaction)
  3. When does this project end? (projected vs scheduled + delta)

## Feature Architecture

```
src/features/
├── ready-board/        # Core readiness grid (cross-trade status)
├── field-report/       # Foreman reporting flow (3-tap)
├── corrective-action/  # GC assigns responsibility + deadline
├── forecast/           # Predictive completion dates from real data
├── delay-log/          # Every blocked day documented (GPS, photo, timestamp)
├── legal-docs/         # NOD, REA, Evidence Package generation
├── notifications/      # Push notifications (bilingual)
├── schedule-import/    # P6/CSV schedule import + delta tracking
├── dashboard/          # 1-Screen GC Dashboard
├── auth/               # Supabase auth (SMS magic link for foreman, email for GC)
├── org/                # Organization management (GC, Sub companies)
├── project-setup/      # Trade sequences, areas, benchmarks config
└── i18n/               # Internationalization (EN + ES for V1)
```

## Data Model — Core Tables

| Table | Purpose |
|-------|---------|
| organizations | GC or sub company (default_language, signature_on_file) |
| projects | Construction project (labor_rate, jurisdiction, sha256_enabled) |
| areas | Physical areas within a project (Bath 23A, Hall 7, etc.) |
| trade_sequences | Ordered trades per area type (Plumb → Frame → Drywall → Tile) |
| field_reports | Foreman daily reports (status, GPS, photo, timestamp, offline_created_at) |
| delay_logs | Every blocked day (reason_code, man_hours, cost, nod_draft_id) |
| corrective_actions | GC response to delays (assigned_to, deadline, acknowledged_at, resolved_at) |
| legal_documents | Generated NOD, REA, Evidence Packages (sha256_hash, receipt_tracking_uuid) |
| nod_drafts | Auto-generated draft NODs awaiting sub approval |
| receipt_events | Document open/view tracking (timestamp, IP, device, open_count) |
| production_benchmarks | Expected rates per trade per area type (sqft/hr/person) |
| forecast_snapshots | Daily calculated projections (vs P6 schedule) |
| users | User profiles (role, language, assigned_areas) |
| user_assignments | Which foreman is assigned to which areas |

## Legal Document Architecture

### Three Documents
1. **NOD (Notice of Delay)** — Day 1 of BLOCKED. Draft auto-created, human sends within 24h
2. **REA (Request for Equitable Adjustment)** — Triggered at $5K or 3 crew-days cumulative
3. **Evidence Package** — On demand. Complete arbitration-ready PDF with all exhibits

### Two Critical Additions (V5)
1. **Receipt Acknowledgment** — Tracking pixel in email. Records when GC opens document
2. **SHA-256 Hash** — Crypto hash of every PDF. Tamper-evident. 3 lines of code, immeasurable legal value

### Legal Flow
```
Foreman reports BLOCKED → delay_log created → draft NOD auto-generated (60s)
→ Super gets push notification → reviews + finger signs → sends to GC
→ PDF generated with SHA-256 + tracked email → receipt monitoring starts
→ If GC opens + no response in 48h → sub alerted to escalate
```

## Business Rules

- **NOD is NEVER auto-sent.** Always draft + human send. Protects GC relationship
- **24h reminder** if NOD draft not sent
- **REA threshold:** $5,000 cumulative OR 3 crew-days on single delay cause
- **Receipt tracking:** 48h response window after GC opens document
- **AI features ONLY on GC web dashboard.** Foreman app is AI-free by design
- **AI launches Phase 1 only after:** 10 projects + 90 days of data
- **Every AI insight labeled** "AI Suggestion — Based on X projects." Never presented as fact
- **Offline-first:** ALL foreman actions work without connectivity. Sync is background magic

## Pricing (Reference)

| Plan | Price | For |
|------|-------|-----|
| Starter | $399/mo per project | Basic readiness + forecast + delay logs |
| Pro | $699/mo per project | Full legal docs + SHA-256 + receipt tracking |
| Portfolio | $1,999/mo unlimited | Multi-project dashboard + API + AI insights |
| Sub Add-on | $59/mo per sub | Full legal docs + bid intelligence (V3) |

## Markets — Year 1

USA only. NYC and Miami exclusively first 6 months. Chicago Q3-Q4. Houston Q4.
Colombia opportunistic only (4 conditions must be met simultaneously).

## What NOT To Do

- Do NOT add AI features before data thresholds are met
- Do NOT require the foreman to create an account or set a password
- Do NOT show error messages about connectivity on mobile
- Do NOT use per-user pricing (GCs think in project costs)
- Do NOT attempt international legal templates in Year 1
- Do NOT build a full JHA/safety module (scope creep — keep the lightweight safety gate)
- Do NOT use OAuth for auth in V1 (SMS magic link for foreman, email/password for GC)

---

*ReadyBoard v5.0 — Legal Infrastructure Platform*
*Built for Carlos. Defended in arbitration. Scaled to Dubai.*
