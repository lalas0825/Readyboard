# ReadyBoard — CLAUDE.md

> *"Built for Carlos. Defended in arbitration. Scaled to Dubai."*
> Version 5.1 — Includes Granular Trade Checklist System

---

## What Is This Project

**ReadyBoard** is a legal infrastructure platform for commercial construction. It tells every trade what areas they can work TODAY, alerts when something changes, and auto-documents every lost day as legal evidence — in the foreman's language, without internet.

**Category:** Insurance policy disguised as a coordination tool.

**Two value props, two buyers:**
- GC buys for **operational visibility** (1-Screen Dashboard)
- Specialty contractor stays for **legal protection** (NOD / REA / Evidence Package)

---

## Golden Path Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend (Mobile) | Expo + React Native + TypeScript | One codebase → iOS, Android, Web |
| Frontend (GC Web) | Next.js 16 + React 19 + TypeScript | Dashboard, reports, admin |
| Styles | Tailwind CSS 3.4 + shadcn/ui | Consistent, fast, Carlos-proof |
| Backend | Supabase (Auth + PostgreSQL + RLS + Realtime) | Row Level Security, realtime updates |
| Offline Engine | PowerSync + SQLite | Offline-first — the #1 technical decision |
| AI Engine | Vercel AI SDK v5 + OpenRouter (Gemini 2.5 Pro) | Phase 1+ only, data-gated |
| i18n | i18next + expo-localization + next-i18next | Auto-detect device language, all surfaces |
| Validation | Zod | Shared schemas mobile + web |
| State | Zustand | Lightweight, works with PowerSync |
| Testing | Playwright (web) + Detox (mobile) | 3-tap flow timing tests |
| Deploy | Vercel (web) + Expo EAS (mobile) | Standard Golden Path |
| Legal Docs | Node.js PDF generation + crypto (SHA-256) | Tamper-evident legal instruments |
| PDF i18n | react-pdf with i18n support | Legal docs in user's language |

---

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
│   └── seed.sql         # Demo data (383 Madison)
└── turbo.json           # Turborepo config
```

---

## UX Philosophy — The Carlos Standard

**North Star:** Carlos, 60 years old, Spanish-speaking, uses phone for calls and WhatsApp only. If he can't complete his morning update in under 60 seconds on Day 1 with zero training, the UX has failed.

### Foreman Mobile — 6 Principles

| # | Principle | Rule |
|---|-----------|------|
| 1 | One Job Per Screen | Every screen does exactly one thing |
| 2 | Color Does the Talking | Status via color + icon. No English required to understand |
| 3 | Maximum 3 Taps | Every field action ≤ 3 taps. If 4+ required, redesign. No exceptions. |
| 4 | Big Buttons, Large Text | Tap targets min 56px. Body text min 18px. Gloved hands, bright sun |
| 5 | Loud Confirmation | Full-screen green checkmark + haptic. No subtle toasts |
| 6 | Offline is Invisible | No error messages about connectivity. App works identically offline |

### Foreman UX — V1 Field Report Flow (3 Steps)

The report flow is exactly 3 steps. This applies to BOTH percentage mode and checklist mode.

**Step 1 — How much is done?**
- Large percentage slider (0–100%, step 5%)
- Huge number display: "75%"
- In checklist mode: this screen is REPLACED by the task checklist (same tap count)

**Step 2 — Any blockers?**
- Two full-width buttons: YES ✓ (green) / NO ✕ (red)
- If YES → area saved as progress update, go to confirmation
- If NO → go to Step 3

**Step 3 — Why blocked? (only if NO on Step 2)**
- Reason codes as large icon buttons (56px+):
  🌡 No Heat | 🔨 Prior Trade | 🚫 No Access | 📋 Inspection | 🔧 Plumbing | 📦 Material | 💧 Moisture
- Optional camera button (queued offline if no signal)
- Submit → full-screen green checkmark + haptic

### Foreman UX — Checklist Mode (V1.1)

When the GC has enabled checklist mode for a trade, the slider in Step 1 is replaced by a task checklist. The tap count does NOT increase.

```
Tap 1: Select area (big color-coded card)
Tap 2: Check off completed tasks (or multiple taps — each task check is fast)
Tap 3: Submit (confirmation screen)
```

Rules:
- Tasks ordered sequentially but NOT required in order — foreman can check in any sequence
- SUB tasks: green ✅ when complete, tappable
- GC VERIFY tasks: greyed out, label "Awaiting GC" (in foreman's language), NOT tappable
- Gate tasks: ⛔ icon, highlighted row
- Progress bar auto-updates live as tasks are checked
- When last SUB task before a GC gate is checked: confirmation includes "GC has been notified"
- Foremen CANNOT create or modify task templates — only consume them

### NOD Reminder Banner

When a foreman has an active BLOCKED area with a pending NOD draft, a purple banner appears at the top of their home screen:

```
⚖ [Recordatorio: Aviso legal listo — 24h para enviar. Tap para revisar.]
```

Tapping the banner opens the NOD draft directly. This banner only shows when:
- An area assigned to this foreman is BLOCKED or HELD
- A draft NOD exists for that area
- The NOD has not yet been sent

### GC Dashboard UX

- Data-dense is OK — GC PM lives in Procore and Excel
- Dark theme — indoor office use, premium positioning
- **The 1-Screen Dashboard answers exactly 3 questions:**
  1. What's happening RIGHT NOW? (floor status strip — color-coded per floor)
  2. What needs my attention? (alerts ranked by cost of inaction — $ per day)
  3. When does this project end? (projected vs P6 + delta in days)

### GC Visibility Rule (Coopetition Model)

- GC sees the **Ready Board** (operational state) in full — all trades, all floors
- GC sees the **1-Screen Dashboard** — alerts, forecast, cost of inaction
- GC sees the **Corrective Action module** — can create and track actions
- **Legal Documents are PRIVATE to the sub** until the sub explicitly taps "Publish / Send to GC"
- GC cannot access NOD drafts, REAs, or Evidence Packages until published
- This is not a bug — it is the coopetition model: GC has operational visibility, sub maintains legal leverage

---

## Feature Architecture

```
src/features/
├── ready-board/        # Core readiness grid (cross-trade status)
├── field-report/       # Foreman reporting (3-tap: slider mode)
├── checklist/          # Granular task checklist (V1.1 — see CHECKLIST_SYSTEM.md)
│   ├── components/
│   │   ├── TaskChecklist.tsx          # Foreman: replaces slider when mode=checklist
│   │   ├── TaskItem.tsx               # Single task row (SUB/GC/gate icons)
│   │   ├── ChecklistProgress.tsx      # Live % bar auto-calculated from tasks
│   │   ├── GCVerificationQueue.tsx    # GC dashboard: pending verifications list
│   │   ├── VerificationDetail.tsx     # GC: full detail + approve/correct buttons
│   │   ├── CorrectionModal.tsx        # GC: reason code picker + notes
│   │   └── TradeConfig.tsx            # GC setup: toggle % vs checklist per trade
│   ├── hooks/
│   │   ├── useChecklist.ts            # CRUD for area_tasks, offline-first
│   │   ├── useVerificationQueue.ts    # GC: fetch pending verifications
│   │   └── useTaskTemplates.ts        # Load/customize templates
│   ├── lib/
│   │   ├── calculatePct.ts            # Weighted % from tasks
│   │   ├── gateCheck.ts               # Are all gates passed?
│   │   └── notificationChain.ts       # GC notify → 4h reminder → 24h escalation
│   └── types.ts
├── corrective-action/  # GC assigns responsibility + deadline
├── forecast/           # Predictive completion dates from real data
├── delay-log/          # Every blocked day documented (GPS, photo, timestamp)
├── legal-docs/         # NOD, REA, Evidence Package generation
├── notifications/      # Push notifications (bilingual)
├── schedule-import/    # P6/CSV schedule import + delta tracking
├── dashboard/          # 1-Screen GC Dashboard
├── auth/               # Supabase auth (SMS magic link foreman, email GC)
├── org/                # Organization management
├── project-setup/      # Trade sequences, areas, benchmarks config
└── i18n/               # Internationalization (EN + ES for V1)
```

### Template Seed Data

```
packages/db/templates/
├── bathroom-tasks.json    # 14 trades × bathroom area type
├── kitchen-tasks.json     # 14 trades × kitchen area type
├── corridor-tasks.json    # 14 trades × corridor/common area type
└── office-tasks.json      # 14 trades × office area type
```

---

## The 14-Trade Interior Finish Sequence

This is the canonical trade sequence for NYC commercial high-rise interior finish.
Ships as the DEFAULT template. GCs can customize per project. Area-type templates
define which trades apply (bathroom has waterproofing + tile; office skips them).

```
Trade  1: Rough Plumbing
Trade  2: Metal Stud Framing + Door Frames
Trade  3: MEP Rough-In (In-Wall) — fire protection, HVAC, electrical, plumbing
Trade  4: Fire Stopping — dedicated specialty sub, FDNY inspects separately
Trade  5: Insulation & Drywall — hang, tape, mud, sand to Level 4
Trade  6: Waterproofing (Wet Areas) — membrane + flood test
Trade  7: Tile / Stone — over cured waterproof membrane
Trade  8: Paint — primer + 2 finish coats
Trade  9: Ceiling Grid / ACT — suspended acoustical tile (offices, corridors)
Trade 10: MEP Trim-Out — outlets, lights, faucets, toilets, registers
Trade 11: Doors & Hardware — hang doors, locksets, closers
Trade 12: Millwork, Casework & Countertops
Trade 13: Flooring (Non-Tiled) — carpet, LVT, hardwood
Trade 14: Specialties, Final Clean & Punch List
```

The original demo used 6 simplified trades. The real sequence has 14 because:
- Fire Stopping (Trade 4) is inspected by FDNY independently — gates drywall
- Ceiling Grid (Trade 9) is its own trade in commercial — goes after paint
- Doors & Hardware (Trade 11) — frames in framing, doors hung after paint
- Flooring (Trade 13) — always a different sub from millwork, installed late

---

## Data Model — Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| organizations | GC or sub company | default_language, signature_on_file, legal_template_version |
| projects | Construction project | labor_rate_per_hour, legal_jurisdiction, sha256_enabled |
| areas | Physical areas (Bath 23A, Hall 7) | total_sqft, area_type, floor |
| trade_sequences | Ordered trades per area type | trade_name, sequence_order, area_type |
| area_trade_status | Current status per area per trade | effective_pct, reporting_mode, all_gates_passed, gc_verification_pending |
| field_reports | Foreman daily reports | status, gps_lat/lng, photo_url, offline_created_at |
| **trade_task_templates** | **Pre-built task library (14 trades × 4 area types)** | **task_owner (sub/gc), is_gate, weight, requires_photo** |
| **area_tasks** | **Task instances per area per project** | **status, completed_by, verification_requested_at, notification_opened_at** |
| delay_logs | Every blocked day | reason_code, man_hours, cost, nod_draft_id |
| corrective_actions | GC response to delays | assigned_to, deadline, acknowledged_at, resolved_at |
| legal_documents | Generated NOD, REA, Evidence Packages | sha256_hash, receipt_tracking_uuid, first_opened_at |
| nod_drafts | Auto-generated draft NODs | draft_content_jsonb, reminder_sent_at, sent_at |
| receipt_events | Document open/view tracking | ip_address, device_type, opened_at |
| production_benchmarks | Expected rates per trade | sqft/hr/person, area_type |
| forecast_snapshots | Daily calculated projections | effective_pct, delta_days, projected_date |
| schedule_items | P6 import data | planned_start, planned_finish, p6_activity_id |
| scope_changes | Change order / scope delta | delta_sqft, reason, initiated_by, forecast_impact |
| users | User profiles | role, language, org_id |
| user_assignments | Foreman → area assignments | user_id, area_id, trade_name |

---

## Legal Document Architecture

### Three Documents

1. **NOD (Notice of Delay)** — Day 1 of BLOCKED. Draft auto-created (60s), human sends within 24h
2. **REA (Request for Equitable Adjustment)** — Triggered at $5K or 3 crew-days cumulative
3. **Evidence Package** — On demand. Complete arbitration-ready PDF with all exhibits

### Two Critical Infrastructure Features

1. **Receipt Acknowledgment** — Tracking pixel in email. Records when GC opens document (timestamp, IP, device, open count). Creates constructive notice.
2. **SHA-256 Hash** — Crypto hash of every PDF. Tamper-evident. Stored in DB + printed in PDF footer. Public verification endpoint.

### NOD Content — Checklist Mode Addition

When delay involves a pending GC verification, NOD content includes:

```
"[Trade] completed [date] at [time] (GPS verified, [test] photo attached).
GC verification requested [date] at [time]. GC notification opened [date]
at [time]. No verification recorded as of [date].
[Trade] crew of [n] idle: [x] crew-days, $[cost]."
```

### Legal Flow

```
Foreman reports BLOCKED → delay_log created → draft NOD auto-generated (60s)
→ Super gets push + purple banner → reviews + finger signs → sends to GC
→ PDF generated with SHA-256 + tracked email → receipt monitoring starts
→ If GC opens + no CA response in 48h → sub alerted to escalate
```

---

## Business Rules

### NOD / Legal
- **NOD is NEVER auto-sent.** Always draft + human send. Protects GC relationship.
- **24h reminder** if NOD draft not sent (at 20h mark)
- **REA threshold:** $5,000 cumulative OR 3 crew-days on single delay cause
- **Receipt tracking:** 48h response window after GC opens document
- **GC Legal Docs are private** until sub explicitly publishes. Coopetition model.

### Checklist System
- **GC VERIFY tasks CANNOT be completed by sub.** RLS enforced at database level.
- **No partial GC verification.** GC either approves or requests correction. No middle state.
- **Gate tasks block READY even at 99%.** effective_pct can be 99% but status stays ALMOST until all gates pass.
- **Auto-approve NEVER happens.** A GC VERIFY task stays pending indefinitely. The documentation of inaction IS the value.
- **Foremen cannot create or modify task templates.** Only GC PM or Sub PM can customize.
- **Sequential order is a suggestion, not a constraint.** Foremen can check tasks in any order. Only gate tasks enforce ordering.
- **NOD includes GC verification timeline** when delay is caused by pending GC gate.

### AI
- **AI features ONLY on GC web dashboard.** Foreman app is AI-free by design.
- **AI launches Phase 1 only after:** 10 projects + 90 days of data.
- **Every AI insight labeled** "AI Suggestion — Based on X projects." Never presented as fact.
- **No AI in the foreman checklist.** Human-verified, field-reported data only.

### Offline
- **ALL foreman actions work without connectivity.** Sync is background.
- **GPS captured from device hardware.** No internet required.
- **Photos queue locally** when offline, upload on reconnect.

### Auth
- **Foreman auth: SMS magic link only.** Superintendent sends link → foreman taps → sees areas. Zero form fields, zero password, zero onboarding screens.
- **GC/Sub PM: email + password** (standard Supabase auth).

---

## Pricing (Reference)

| Plan | Price | For |
|------|-------|-----|
| Starter | $399/mo per project | Basic readiness + forecast + delay logs |
| Pro | $699/mo per project | Full legal docs + SHA-256 + receipt tracking + checklist mode (V1.1) |
| Portfolio | $1,999/mo unlimited | Multi-project dashboard + API + AI insights (V2) |
| Sub Add-on | $59/mo per sub | Full legal docs + bid intelligence (V3) |

---

## Markets — Year 1

USA only. NYC and Miami exclusively first 6 months. Chicago Q3-Q4. Houston Q4.
Colombia opportunistic only (4 conditions must be met simultaneously — see Product Overview v5.0).

---

## What NOT To Do

- Do NOT add AI features before data thresholds are met (10 projects / 90 days)
- Do NOT require the foreman to create an account or set a password
- Do NOT show error messages about connectivity on mobile
- Do NOT use per-user pricing (GCs think in project costs)
- Do NOT attempt international legal templates in Year 1
- Do NOT build a full JHA/safety module (keep the lightweight safety gate)
- Do NOT use OAuth for auth in V1 (SMS magic link foreman, email/password GC)
- Do NOT auto-send NODs — always draft + human approval
- Do NOT allow partial GC verification — approve or correct, no middle state
- Do NOT auto-approve GC VERIFY tasks — ever
- Do NOT build task creation UI for foremen — they consume, not create
- Do NOT show AI suggestions in the foreman checklist
- Do NOT require sequential task completion — order is a suggestion except gates

---

## Reference Documents

| File | Purpose |
|------|---------|
| `BUSINESS_LOGIC.md` | Status calculations, RLS rules, notification chains, legal triggers |
| `TASKS.md` | 7-week V1 build + Week 8-9 checklist system sprint |
| `CHECKLIST_SYSTEM.md` | Full checklist architecture spec (14 trades, SUB/GC model, data model) |
| `ReadyBoard_ProductOverview_v5.docx` | Product spec with legal architecture and strategist decisions |
| `ReadyBoard_StudyGuide.docx` | Complete product knowledge in Spanglish |
| `ReadyBoard_14Trade_Checklist_v5.1.docx` | 170+ tasks, SUB/GC tagging, gate identification |

---

*ReadyBoard v5.1 — Legal Infrastructure Platform*
*Built for Carlos. Defended in arbitration. Scaled to Dubai.*
