# ReadyBoard — CLAUDE.md

> **ReadyBoard is a legal infrastructure platform for commercial construction.**
> It tells trades what areas they can work on daily, auto-documents delays as legal evidence,
> and operates offline-first in the foreman's language.
>
> **This is the single source of truth.** If CLAUDE.md says it, Claude Code follows it.
> Last updated: 2026-04-09 — Custom trade sequences with phase duplication and drag-reorder

---

## Current Status — Updated April 9, 2026

| Category | Done | Partial | Not Built | Broken |
|----------|------|---------|-----------|--------|
| Infrastructure | 10 | 0 | 0 | 0 |
| Auth & Invitations | 16 | 0 | 0 | 0 |
| Stripe Billing | 10 | 1 | 1 | 0 |
| Dashboard Navigation | 11 | 0 | 0 | 0 |
| Dashboard Pages | 11 | 0 | 0 | 0 |
| Ready Board Grid | 17 | 0 | 0 | 0 |
| Foreman Mobile | 25 | 0 | 0 | 0 |
| Checklist System | 13 | 0 | 0 | 0 |
| Legal Documentation | 15 | 0 | 0 | 0 |
| Trade Sequences | 5 | 0 | 0 | 0 |
| Forecast Engine | 3 | 2 | 3 | 0 |
| Notifications | 5 | 2 | 2 | 0 |
| Email System | 6 | 1 | 0 | 0 |
| AI Morning Briefing | 2 | 0 | 5 | 0 |
| Labor Rates | 7 | 0 | 0 | 0 |
| Demo Account | 4 | 0 | 0 | 0 |
| Landing Page & Legal | 3 | 0 | 0 | 0 |
| Security | 8 | 0 | 0 | 0 |
| App Store Readiness | 2 | 0 | 4 | 0 |
| **TOTALS** | **172** | **4** | **12** | **0** |

**Diagnostics:** ~755 files, 35 SQL migrations, 13 env vars, `next build` ✅, `tsc --noEmit` 0 errors.

### Recent Changes (April 9, 2026 — Custom Trade Sequences)

- **Feature: Phase-aware trade sequences** — GC can duplicate a trade to create "Phase 2" variants. Example: "Metal Stud Framing P1" → "Metal Stud Framing P2" for touch-up work. Composite key pattern `"{trade_name}::{phase_label}"` in `area_trade_status.trade_type` maintains backward compatibility.
- **Feature: Custom trades with is_custom flag** — GC can add non-standard trades (e.g., "Glass & Glazing"). Flagged in DB, can be bulk deleted from Settings.
- **UI: Drag-and-drop trade reordering** — TradeSequenceConfig.tsx uses `dnd-kit` library for visual reordering. Two-phase RPC (`reorder_trade_sequence`) avoids UNIQUE constraint conflicts.
- **UI: DuplicatePhaseModal + AddTradeModal** — Dedicated modals for creating phases and custom trades.
- **UI: Grid column headers with phase suffixes** — GridHeader displays "FRAM P2" when phases present. GridFilterBar handles composite keys in filter chips.
- **UI: Onboarding custom trade support** — StepTradeSequence has "+ Add custom trade" input. completeOnboarding.ts flags non-default trades with `is_custom=true`.
- **Backend: tradeSequenceActions.ts + checklistActions.ts** — Server actions for duplicateTradeAsPhase, createCustomTrade, deleteCustomTrade, saveTradeChecklist.
- **Database: trade_sequences expanded** — Added `phase_label` (nullable, e.g., "Phase 2", "Touch-up"), `description` (optional notes), `is_custom` (true for non-default trades).
- **RPC: reorder_trade_sequence** — Two-phase update: flip to negative offsets first, then assign final sequence_order. Prevents deadlock on (project_id, area_type, sequence_order) UNIQUE.

### Previous Changes (April 6, 2026)

- **Fix 1 — GC VERIFY excluded from sub progress %:** `calculate_effective_pct` DB trigger now counts `task_owner = 'sub'` tasks only. Gate cap only triggers when a SUB gate is incomplete (GC gate blocks DONE status but not progress %). Mobile checklist splits into "Your tasks (X/Y)" section + "GC Verification Required" purple cards. Web GC detail panel splits into "Sub Tasks" + "GC Verification" sections with PENDING/DONE badges.
- **Fix 2 — Auto start/end date tracking:** `area_trade_status.started_at` auto-set when sub progress first goes >0. `completed_at` set at 100%, cleared on regression (GC correction). Web detail panel shows "Work Dates" → Started · Completed · Duration.
- **Fix 3 — Optional progress photos (not just blockers):** Step2Blockers now has an optional camera button before the blocker question. TaskChecklist has a 📷 icon on each sub task row that opens camera, compresses, uploads to Supabase Storage, and saves to `area_tasks.photo_url`. `photo_type` column added to `field_reports` (`progress | blocker | evidence | safety`). Derived at submit: `has_blockers=true → 'blocker'`, else `'progress'`.
- **Bug fix — Checklist status mismatch:** `GridDetailPanel.tsx` filtered `status === 'completed'` but DB uses `'complete'`. Fixed 5 occurrences — tasks now show correctly in GC web panel.
- **Bug fix — Foreman task updates reverting:** `get_accessible_area_ids()` was only checking org membership, missing foremen assigned via `user_assignments` directly. Added `UNION SELECT area_id FROM user_assignments WHERE user_id = auth.uid()`.
- **⚠️ PowerSync sync rules:** `sync-rules.yaml` updated (adds `started_at`, `completed_at` to area_trade_status; adds `photo_type` to field_reports). Must redeploy manually at powersync.journeyapps.com.

### Previous Changes (April 5, 2026)

- **Photo upload fix:** `uploadPhoto.ts` now accepts the authenticated `SupabaseClient` from `useAuth()`. Fixed `project_members_can_upload_legal_docs` storage policy infinite recursion (error 42P17).
- **Mobile: "Other" reason code + free-text notes:** `other` added to `ReasonCode`, TextInput shown in Step3Reason, `notes` column on `field_reports`.
- **Mobile: collapsible unit sections + Android status bar fix**
- **Web: photo lightbox in GridDetailPanel**
- **PowerSync v6 architecture:** `by_project` bucket scales to 2000+ areas.
- **Invite system hardening:** anti-enumeration, FK fix, superintendent routing, sub_org_id auto-link, trade-filtered assignments.
- **Development build workflow:** `eas build --profile development` once → `npx expo start` for hot reload.

### Previous Changes (April 2 — April 4, 2026)

- **Demo seed data:** `scripts/seed-demo-full.ts` — 3 months of simulated project history (Jan 5 → Apr 4 2026), wave pattern Ready Board, 8 delay scenarios, legal docs, CAs, field reports, forecast snapshots
- **Demo credentials:** `demo-gc@readyboard.ai`, `demo-sub@readyboard.ai`, `demo-foreman@readyboard.ai` / password: `demo1234`
- **Logo consistency:** Ready/Board split across all pages — sidebar (bold white + light 500 gray), landing nav, mobile login screen
- **Team management:** All roles now assigned at project level (no per-area checkboxes in invite modal)
- **Mobile login background:** Fixed asset paths — `login-v2-android.jpg` / `login-v2-ios.jpg`
- **EAS build:** Node 20.18.0 in preview profile, APK ready via `eas build --profile preview --platform android`

---

## Product Definition

ReadyBoard serves a two-buyer model:
- **General Contractor (GC):** Operational visibility via web dashboard — Ready Board grid, alerts ranked by cost of inaction, projected delivery date, corrective actions, verification queue
- **Specialty Subcontractor (Sub):** Automated legal protection — Notices of Delay, Requests for Equitable Adjustment, SHA-256-hashed evidence packages with receipt tracking

The GC pays for VISIBILITY. The sub stays for LEGAL PROTECTION. Two different value propositions, same platform.

**Coopetition Model:** Sub legal docs are private until the sub explicitly taps "Publish / Send to GC." GC has operational visibility. Sub maintains legal leverage. Both parties get value. Neither feels exposed.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Monorepo | Turborepo | apps/web, apps/mobile, packages/shared, packages/db |
| Web | Next.js 16 + React 19 + TypeScript | GC dashboard, landing page, auth |
| Mobile | Expo SDK 52 + React Native 0.76 | Foreman app (iOS + Android) |
| Offline | PowerSync + SQLite | Offline-first field reporting |
| Database | Supabase (PostgreSQL) | 24 tables, 65 RLS policies, 28 functions, 21 triggers |
| Styling | Tailwind CSS 4.2 + shadcn/ui | Dashboard components |
| i18n | next-intl 4.8 (web) + i18next (mobile) | EN + ES |
| Billing | Stripe | 4 plans, checkout, webhooks, customer portal |
| Email | Resend | Transactional emails, NOD delivery |
| AI | Gemini 2.5 Flash via OpenRouter | Morning briefing (V1), insights (V2) |
| Hosting | Vercel (web) + EAS (mobile) | Deploy |
| Domain | readyboard.ai (Cloudflare) | DNS |

---

## User Roles & Permissions

| Role | App | Can Do | Cannot Do |
|------|-----|--------|-----------|
| `gc_admin` | Web | Everything + org settings, billing, team | Access sub legal docs (until published) |
| `gc_pm` | Web | Dashboard, Ready Board, verify, CAs, forecast | Billing, org settings |
| `gc_super` | Web + Mobile | Verify tasks, create CAs, view all trades | Billing, org settings |
| `sub_pm` | Web + Mobile | View sub areas, legal docs, delay costs, manage foremen | GC dashboard, CAs |
| `superintendent` | Mobile + Web | Review NODs, send legal docs, manage foremen | GC dashboard |
| `foreman` | Mobile only | Report status, view assigned areas, submit photos | See other trades, GC dashboard, legal docs |
| `owner` | Web | Executive summary, delivery projections | Everything else |

---

## Spatial Hierarchy — Floor → Unit → Area ✅ IMPLEMENTED

### Status: Fully implemented (2026-04-01)

The data model supports a 3-level hierarchy: Floor → Unit → Area.

```
Building
└── Floor 24
    ├── Unit 24A (apartment/office)
    │   ├── Master Bath      ← area (wet)
    │   ├── Hall Bath         ← area (wet)
    │   ├── Kitchen           ← area (wet)
    │   └── Powder Room       ← area (wet)
    ├── Unit 24B
    │   ├── Master Bath
    │   └── Kitchen
    └── Common Areas
        ├── Corridor          ← area (dry)
        └── Elevator Lobby    ← area (dry)
```

### Architecture Decision

The `areas` table needs a `unit_id` FK (nullable) that groups areas under a unit within a floor.
The `units` table is NEW:

```sql
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  floor TEXT NOT NULL,                   -- "2", "24", "Basement"
  name TEXT NOT NULL,                    -- "24A", "24B", "PH1"
  unit_type TEXT DEFAULT 'standard_2br', -- standard_2br, studio, luxury_3br, office_suite, common
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE areas ADD COLUMN unit_id UUID REFERENCES units(id);
ALTER TABLE areas ADD COLUMN area_code TEXT;        -- manual, from building plans
ALTER TABLE areas ADD COLUMN description TEXT;
ALTER TABLE areas ADD COLUMN sort_order INTEGER DEFAULT 0;
```

### Ready Board Grid Display

The Ready Board grid supports 3 patterns:

**Pattern A — Floor with units (residential/office):**
```
Floor 24 → Unit 24A → [Master Bath, Kitchen, etc.] × [Trade columns]
         → Unit 24B → [Bathroom, Kitchen] × [Trade columns]
```

**Pattern B — Floor without units (lobby, mechanical):**
```
Floor 1 → Main Lobby × [Trade columns]
        → Mailroom × [Trade columns]
        → Restroom M × [Trade columns]
```

**Pattern C — Mixed (amenity floor):**
```
Floor 2 → Gym Complex → [Main Gym, Locker Room] × [Trade columns]
        → Pool Area → [Pool Deck, Equipment Room] × [Trade columns]
        → ── Floor areas ──
        → Kids Room × [Trade columns]
        → Corridor × [Trade columns]
```

Areas with `unit_id = NULL` display directly under the floor header (no unit grouping).

### Quick Add Presets in Setup Wizard

Two modes: **"Add Units with Areas"** and **"Add Areas to Floor (no unit)"**.

**Unit presets** (creates unit + child areas):
- "Standard 2BR" → Master Bath, Half Bath, Kitchen, Powder Room
- "Studio" → Bathroom, Kitchen
- "3BR Luxury" → Master Bath, Half Bath, Bathroom, Kitchen, Powder Room, Laundry
- "Office Suite" → Kitchen, Bathroom, Server Room
- "Common Areas" → Corridor, Elevator Lobby, Utility, Storage

**Floor-level presets** (creates areas directly on floor, no unit):
- "Lobby / Ground Floor" → Main Lobby, Mailroom, Package Room, Restroom M/F, Security Desk
- "Amenity Floor" → Gym, Pool Deck, Locker Room M/F, Sauna, Kids Room, Lounge
- "Mechanical / Service" → Mechanical Room, Electrical Room, Boiler Room, Elevator Machine Room, Fire Pump Room
- "Parking / Basement" → Parking Level, Storage Units, Bike Room, Trash Room, Loading Dock
- "Retail / Commercial" → Retail Space A/B, Common Corridor, Restroom, Utility

**Also:** 25 area type chips (toggleable), custom type input (free text → amber chips), CSV import with template download, batch generation by floor/unit range.

### Implementation Status

- ✅ `units` table: 156 units backfilled from 780 existing areas
- ✅ `areas.unit_id` FK: all 780 user areas linked, 30 legacy demo areas NULL (backward compat)
- ✅ `areas.area_code`, `description`, `sort_order` columns added
- ✅ `area_code` is MANUAL (from building plans), not auto-generated
- ✅ Ready Board grid: 3-level collapsible hierarchy (Floor → Unit → Area)
- ✅ Grid: floor-level areas (unit_id=NULL) render flat under floor header
- ✅ Grid controls: floor tabs, expand/collapse all, "Show problems only" filter
- ✅ Setup wizard: 25 area type chips, CSV import, unit auto-creation
- ✅ Setup wizard: "Add to Floor" mode with 5 floor-level presets
- ✅ PowerSync: `units` table synced, new area columns synced
- ✅ `complete_onboarding` RPC creates units atomically before areas
- ✅ All existing queries still work (areas.floor preserved, unit_id nullable)

---

## Custom Trade Sequences — Phase Duplication & Custom Trades ✅ (April 9, 2026)

### Architecture

The `trade_sequences` table is expanded to support:
- **Phase duplication:** GC duplicates a trade to create "Phase 2", "Phase 3" variants (e.g., rough-in → trim-out)
- **Custom trades:** GC adds non-standard trades (e.g., "Glass & Glazing", flagged with `is_custom=true`)
- **Composite trade keys:** In `area_trade_status.trade_type`, trades with phases use key format `"{trade_name}::{phase_label}"` (e.g., `"Metal Stud Framing::Phase 2"`)

### Database

**`trade_sequences` new columns:**
- `phase_label` TEXT NULLABLE — e.g., "Phase 2", "Touch-up", null for standard trades
- `description` TEXT NULLABLE — e.g., "rough-in work for MEP trim-out"
- `is_custom` BOOLEAN DEFAULT false — true for non-canonical 14 trades

**Composite key pattern:**
- When phase_label is set, `area_trade_status.trade_type` stores `"{trade_name}::{phase_label}"`
- Backward compatible: trades without phase_label work normally
- Example grid column key: `"Metal Stud Framing::Phase 2"` → displays as "FRAM P2"

### UI Components

**TradeSequenceConfig.tsx** (Settings → Trades & Costs tab):
- Drag-and-drop reordering via dnd-kit
- Per-trade action buttons: Duplicate as Phase, Delete, Edit Custom
- Floats custom trades at bottom (amber background)
- Keyboard shortcut: Option+R to reorder mode

**DuplicatePhaseModal.tsx:**
- Select base trade → enter phase_label (e.g., "Phase 2", "Touch-up")
- Auto-assigns sequence_order after last trade
- Creates new checklist tasks (synced from base trade template)

**AddTradeModal.tsx:**
- Text input for custom trade name
- Validates: not a duplicate, not empty
- Flags as `is_custom=true` in DB
- Cannot delete canonical 14 trades

**GridHeader + GridFilterBar:**
- GridHeader: displays "FRAM P2" for trades with phases (abbreviation + phase number)
- GridFilterBar: composite keys parse into "Framing P2" filter chips

**StepTradeSequence (Onboarding):**
- "+ Add custom trade" input field + button
- Custom trades appear as amber badge "Custom" next to name
- All custom trades sent to `completeOnboarding` RPC

### Server Actions

**`tradeSequenceActions.ts`:**
- `duplicateTradeAsPhase(project_id, base_trade_name, phase_label)` → calls RPC, returns new trade_sequence record
- `createCustomTrade(project_id, trade_name)` → inserts, flags `is_custom=true`
- `deleteCustomTrade(project_id, trade_name)` → soft-delete or hard-delete (RLS validates project ownership)

**`checklistActions.ts`:**
- `getTradeChecklist(project_id, trade_name)` → returns task templates
- `saveTradeChecklist(project_id, trade_name, tasks)` → upserts task templates

**`fetchGridData.ts`:**
- Modified to generate composite keys when `trade_sequences.phase_label IS NOT NULL`
- Backward compatible: null phase_label produces simple trade_name key

### RPC: reorder_trade_sequence

Two-phase update prevents UNIQUE constraint conflicts on (project_id, area_type, sequence_order):

```sql
-- Phase 1: Flip all affected rows to negative offsets (temporary)
UPDATE trade_sequences 
SET sequence_order = -sequence_order 
WHERE project_id = p_project_id AND area_type = p_area_type;

-- Phase 2: Assign final sequence_order based on new_order array
UPDATE trade_sequences 
SET sequence_order = array_position(p_new_order, trade_name) 
WHERE project_id = p_project_id AND area_type = p_area_type;
```

### Workflow Examples

**Example 1: Duplicate Framing for Phase 2**
1. GC opens Settings → Trades & Costs
2. Clicks "Duplicate Phase" on "Metal Stud Framing"
3. Modal: choose phase_label = "Phase 2"
4. New row: "Metal Stud Framing" with phase_label="Phase 2", sequence_order=14 (at bottom)
5. Grid shows new column: "FRAM P2"
6. Foreman reports "Metal Stud Framing::Phase 2" status independently

**Example 2: Add Custom Trade (Glass & Glazing)**
1. GC opens Settings → Trades & Costs
2. Clicks "+ Add Custom Trade"
3. Modal: type "Glass & Glazing"
4. Trade inserted with `is_custom=true` at sequence_order=15
5. Appears in grid with amber badge in Settings list
6. Can be deleted; canonical 14 trades cannot

**Example 3: Custom Trade in Onboarding**
1. GC sets up new project
2. Step 3 Trade Sequence: sees 14 default trades
3. Inputs "+ Custom trade" = "Facade Work"
4. Badge shows "Facade Work [Custom]"
5. On completion, completeOnboarding RPC flags trade as `is_custom=true`

### Backward Compatibility

- Old projects with no phases continue to work (phase_label=NULL)
- Grid queries filter on phase_label for phase-awareness
- Task templates auto-sync when phase is duplicated (via `sync_task_templates_to_areas` RPC)
- No migration required for existing projects (new columns are NULL-safe)

### Remaining (P2)

- [ ] 🔨 Bulk delete custom trades (Settings → select multiple, delete button)
- [ ] 🔨 Edit phase_label after creation
- [ ] 🔨 Copy all task assignments from base phase to new phase (currently empty)

---

## The 14-Trade Interior Finish Sequence

Canonical trade sequence for NYC commercial high-rise interior finish.
Ships as default template. GC can customize per project.

```
 1. Rough Plumbing
 2. Metal Stud Framing + Door Frames
 3. MEP Rough-In (In-Wall) — fire protection → HVAC → electrical → plumbing
 4. Fire Stopping — dedicated specialty sub, FDNY inspects separately
 5. Insulation & Drywall — hang, tape, mud, sand to Level 4
 6. Waterproofing (Wet Areas) — membrane + 24h flood test
 7. Tile / Stone — over cured waterproof membrane
 8. Paint — primer + 2 finish coats
 9. Ceiling Grid / ACT — suspended acoustical tile
10. MEP Trim-Out — outlets, lights, faucets, toilets, registers
11. Doors & Hardware — hang doors, locksets, closers
12. Millwork, Casework & Countertops
13. Flooring (Non-Tiled) — carpet, LVT, hardwood
14. Specialties, Final Clean & Punch List
```

211 task templates seeded (14 trades × 4 area types: bathroom, kitchen, corridor, office).

---

## Area Status Definitions — 7 Statuses

### CRITICAL: IN PROGRESS Status (Gap identified 2026-03-27)

The GC Ready Board grid currently has 6 statuses. It is MISSING "IN PROGRESS" — when a trade has started work (1-99% reported) but hasn't finished. The foreman mobile already shows WORKING status, but the GC grid does not reflect it.

| Status | Color | Hex | Meaning | GC Action |
|--------|-------|-----|---------|-----------|
| **PENDING** | Gray | #334155 | Trade sequence hasn't reached this trade yet | None — wait |
| **READY** | Green | #4ade80 | All prior trades done. Crew can start TODAY. | None — on track |
| **IN PROGRESS** | Blue | #60a5fa | Trade actively working (1-99% reported) | Monitor — track rate |
| **ALMOST** | Amber | #fbbf24 | Prior trade 80%+. ETA 1-2 days. | Monitor — don't send crew yet |
| **BLOCKED** | Red | #f87171 | Prior trade not done. ETA 3+ days. | Create Corrective Action |
| **HELD** | Purple | #c084fc | External block: no heat, no access, inspection failed | Resolve external issue. NOD auto-generates. |
| **DONE** | Dark Blue | #3b82f6 | Trade completed 100% (or 100% + all gates passed) | None — move on |

**Implementation:** When `area_trade_status.effective_pct` is between 1 and 99 AND status is not BLOCKED/HELD, the cell should display as IN PROGRESS (blue) instead of staying READY.

---

## Checklist System Architecture

### Two Reporting Modes (configurable per trade by GC)

**Mode A: Percentage (default)** — Foreman slides to a %. Fast, 3 taps.
**Mode B: Checklist** — Foreman taps task checkboxes. Granular, legally stronger.

### Task Ownership: SUB vs GC VERIFY

Every task in a checklist has a `task_owner` field:
- `sub` — foreman completes this (e.g., "Install tile adhesive")
- `gc` — GC must verify this (e.g., "GC VERIFY: Waterproof membrane passes flood test")

GC VERIFY tasks appear greyed out on the foreman's phone ("Awaiting GC"). The GC sees them in their Verification Queue.

### Gate Tasks

Certain tasks are `is_gate = true`. A gate task MUST be completed before the area can reach READY status — regardless of overall percentage. Example: "Waterproof flood test passed" is a gate. Even if the area is 95% complete, if the flood test hasn't passed, the area stays NOT READY.

### GC Verification Chain

1. Foreman completes all SUB tasks → area shows "Pending GC Verification"
2. GC receives notification → opens Verification Queue
3. GC approves → area progresses to READY for next trade
4. GC requests correction → foreman sees CorrectionBanner, fixes, resubmits
5. If GC doesn't verify within 4h → reminder. 24h → escalation alert.
6. Auto-approve NEVER happens. GC inaction is documented as evidence.

---

## Legal Documentation Engine

### Document Lifecycle

1. **Delay occurs** — Foreman reports BLOCKED + reason + photo (offline capable)
2. **Draft NOD** — System auto-generates within 60 seconds. Push: "Legal notice draft ready"
3. **Review window** — Superintendent reviews, edits, draws finger signature. 24h countdown + 20h reminder.
4. **NOD sent** — PDF generated with SHA-256 hash. Tracked email to GC. Receipt monitoring starts.
5. **Receipt event** — GC opens email → timestamp recorded. No response in 48h → sub alerted.
6. **REA generated** — When cumulative impact reaches $5K or 3 crew-days.
7. **Evidence Package** — On demand. Complete arbitration-ready PDF.

### Three Documents

- **NOD (Notice of Delay)** — AIA A201 §8.3.1. Day 1 of BLOCKED. Draft auto-created, sub sends within 24h.
- **REA (Request for Equitable Adjustment)** — AIA A201 §7.3. Itemized compensation claim.
- **Evidence Package** — AAA Construction Arbitration ready. All exhibits, receipts, SHA-256 log.

### SHA-256 Document Integrity

Every PDF hashed immediately after generation. Hash stored in DB + printed in PDF footer. Public verification endpoint: `/api/legal/verify?hash=xxx`.

### Receipt Acknowledgment

1x1 transparent tracking pixel in NOD delivery email. Records: timestamp, IP, device, open count. Creates constructive notice — GC cannot claim ignorance.

---

## Stripe Billing

### Plans

| Plan | Price | Stripe Price ID | For |
|------|-------|-----------------|-----|
| Starter | $399/mo | (configured in env) | Per project — Ready Board, basic forecast, delay logs |
| Pro | $699/mo | (configured in env) | Per project — + legal docs, SHA-256, receipt, checklist, CAs |
| Portfolio | $1,999/mo | (configured in env) | Unlimited projects — + multi-project dashboard, API, AI |
| Sub Add-on | $59/mo | (needs Price ID) | Specialty contractor — legal docs, delay costs, bid intel (V3) |

### Feature Gate Matrix

| Feature | Starter | Pro | Portfolio | Sub |
|---------|---------|-----|-----------|-----|
| Ready Board grid | ✅ | ✅ | ✅ | — |
| Field reports | ✅ | ✅ | ✅ | ✅ |
| Forecast (basic) | ✅ | ✅ | ✅ | — |
| Delay logs | ✅ | ✅ | ✅ | ✅ |
| Legal docs (NOD/REA) | — | ✅ | ✅ | ✅ |
| SHA-256 + receipt | — | ✅ | ✅ | ✅ |
| Checklist mode | — | ✅ | ✅ | — |
| Schedule import (P6) | — | ✅ | ✅ | — |
| Verification queue | — | ✅ | ✅ | — |
| Corrective actions | — | ✅ | ✅ | — |
| Multi-project dashboard | — | — | ✅ | — |
| API access | — | — | ✅ | — |
| AI insights (V2) | — | — | ✅ | — |
| Evidence packages | — | ✅ | ✅ | ✅ |

### Billing Status

- Stripe SDK v20.4.1 installed
- 3 of 4 Price IDs configured (Sub Add-on $59 needs creation)
- `project_subscriptions` table with stripe columns ✅
- Checkout, portal, webhook handler ✅
- `getPlanForProject` + `hasFeature()` ✅
- `/dashboard/billing` page ✅
- ✅ Trial countdown banner + `/billing/success` page built

---

## Labor Rates — Per-Trade Structured Rates (NEW 2026-04-01)

### Architecture

Each trade has per-role hourly rates + OT rules + crew composition. NYC Union Prevailing Wage 2025-2026 defaults auto-seeded on project creation.

### Database

- **`labor_rates` table:** `project_id × trade_name × role → hourly_rate` (UNIQUE constraint)
  - Roles: `foreman`, `journeyperson`, `apprentice`, `helper`, `finisher`, `tender`
  - RLS: SELECT for project members, ALL for gc_admin/gc_pm
- **`trade_sequences` new columns:**
  - `straight_time_hours` (7-8h depending on trade contract)
  - `ot_multiplier` (1.5×), `dt_multiplier` (2.0×)
  - `saturday_rule` (`ot` | `straight_makeup` | `double`)
  - `typical_crew` JSONB (`{"foreman":1,"journeyperson":3,"apprentice":1,"helper":0}`)
- **`seed_labor_rates(project_id)` RPC:** Seeds 56 rates (14 trades × 4 roles) + OT rules

### Backward Compatibility

`projects.labor_rate_per_hour` preserved as fallback. Projects without specific trade rates use this flat rate. New projects get per-trade rates automatically via `complete_onboarding` → `seed_labor_rates()`.

### Sample Rates

| Trade | Foreman | JP | Apprentice | Helper | ST Hours | Saturday |
|-------|---------|-----|------------|--------|----------|----------|
| Rough Plumbing | $140 | $127 | $76 | $55 | 8h | OT |
| Tile / Stone | $117 | $107 | $64 | $86* | 7h | OT |
| Paint | $105 | $95 | $57 | $45 | 7h | OT |

*Tile helper = Tile Finisher (separate skilled classification)

### Built

- ✅ Settings UI: editable rate matrix (Trades & Costs tab)
- ✅ `calculateDelayCost()` function using per-trade rates
- ✅ NOD/REA PDF: itemized role-by-role cost breakdown (`laborBreakdown.ts`)

### Not Yet Built

- [ ] Mobile: per-trade daily cost on blocked areas

---

## Carlos Standard (UX Philosophy)

> If Carlos — 60 years old, Spanish-speaking, uses his phone for calls and WhatsApp — cannot complete his morning update in under 60 seconds with zero training, the UX has failed.

| # | Principle | Rule |
|---|-----------|------|
| 1 | One Job Per Screen | Every screen does exactly one thing |
| 2 | Color Does the Talking | Status via color + icon. No English required. |
| 3 | Maximum 3 Taps | Every field action ≤ 3 taps. If 4+, redesign. |
| 4 | Big Buttons, Large Text | Tap targets ≥ 56px. Body text ≥ 18px. Gloved hands. |
| 5 | Loud Confirmation | Full-screen green ✓ + haptic. No subtle toasts. |
| 6 | Offline is Invisible | No error messages. App works identically offline. |

**Auth:** SMS magic link. No passwords for foremen.
**Theme:** High-contrast light theme on mobile. Dark theme on GC dashboard.
**Language:** Auto-detected from device. Manual override in 1 tap.

---

## GC Dashboard — Navigation (11 pages)

All pages built and routed as separate `/dashboard/*` paths:

```
📊 Overview          ✅ — metrics, alerts by cost, forecast, morning briefing card
📋 Ready Board       ✅ — 3-level collapsible grid (Floor→Unit→Area), 14 trades, floor tabs, problem filter
👷 Verifications     ✅ — GC queue, approve/correct modal, badges
⚠️ Delays & Costs   ✅ — summary cards, filterable table, GPS/photo evidence, Generate NOD
⚖️ Legal Docs       ✅ — NOD/REA/Evidence list, receipt tracking, escalation alerts
📈 Forecast          ✅ — 14-day trend, schedule delta, at-risk areas (needs burn rate calc)
🔧 Corrective Actions ✅ — Kanban + table toggle, 4 columns, overdue tracking
📅 Schedule          ✅ — CSV upload, preview, column mapper, import RPC
👥 Team              ✅ — GC/Sub sections, invite, role badges, assigned areas
⚙️ Settings          ✅ — 6 tabs (General, Trades & Costs, Legal, Integrations, Roles, Audit Logs)
💳 Billing           ✅ — plan card, upgrade/manage, feature comparison
```

**Nav items:** Notification bell ✅, Collapsible sidebar ✅, Live indicator (green dot) ✅

---

## Foreman Mobile — Complete (16/16 ✅)

- Home: color-coded area cards (READY/ALMOST/BLOCKED/HELD/WORKING)
- Report: slider OR checklist, blockers, reason codes (7), photo + GPS capture
- Confirmation: full-screen ✓ + haptic
- NOD draft banner (purple, tappable)
- Bottom tabs: My Areas | Report | Legal | Profile (80px)
- Profile: user info, role badge, push toggle, logout
- Legal tab: pending NODs, blocked areas, status badges
- Offline-first via PowerSync + SQLite
- Checklist mode with progress bar
- GC VERIFY tasks greyed out ("Awaiting GC")
- Language: auto-detect EN/ES + manual override

---

## AI Morning Briefing Agent

### Spec

- **Model:** Gemini 2.5 Flash via OpenRouter (cheap, fast)
- **Trigger:** Cron at 6am ET daily, per user × project
- **Output:** 4-8 sentences, role-aware (GC vs Sub), language-aware (EN/ES), specific numbers
- **Storage:** `briefings` table (MIGRATION MISSING — critical blocker)
- **UI:** MorningBriefingCard on Overview page (built), history dropdown
- **Cost target:** < $0.90/month at 200 projects

### Status

- ✅ `collectBriefingData.ts` — parallel data fetch
- ✅ `MorningBriefingCard.tsx` — UI component
- 🐛 `briefings` table migration MISSING — code references it, will crash
- ❌ OPENROUTER_API_KEY not in .env
- ❌ Cron scheduler not configured
- ❌ Demo hardcoded briefing not built
- ❌ Cost monitoring incomplete

---

## Email System

- ✅ Resend installed + configured (`src/lib/email/client.ts`)
- ✅ Sender: `noreply@readyboard.ai`
- ✅ Templates exist: WelcomeEmail, BlockedAlertEmail, VerifiedReportEmail
- ❌ Missing templates: team invite, trial ending (7/3/1 day), payment failed
- ❌ DNS (SPF/DKIM/DMARC) — cannot verify from codebase
- ❌ NOD email dispatch — tracking pixel built, email never actually sends

---

## Notification Business Rules

- All notifications stored in DB first, push is secondary layer
- Anti-spam: max 1 notification of same type per area per 24h
- GC verification chain: request → 4h reminder → 24h escalation
- Foreman notifications: only READY and BLOCKED for assigned areas
- Email: only for legal docs (NOD delivery) and billing
- SMS: only for foreman invite links

---

## Demo Account

| Account | Email | Password | Role |
|---------|-------|----------|------|
| GC | `demo-gc@readyboard.ai` | `demo1234` | gc_pm |
| Sub | `demo-sub@readyboard.ai` | `demo1234` | sub_pm |
| Foreman | `demo-foreman@readyboard.ai` | `demo1234` | foreman |

- ✅ `scripts/seed-demo-full.ts` — full historical seed (3 months, Jan 5 → Apr 4 2026)
- ✅ 383 Madison Ave, Tishman Speyer (GC) / Jantile (Sub), 9 floors, 14 trades, 780 areas
- ✅ Wave pattern: lower floors complete, upper floors in-progress/pending
- ✅ 8 delay scenarios (5 resolved, 3 active), legal docs, CAs, field reports, forecast snapshots
- ✅ Demo GC has Pro subscription unlocked until 2027-12-31

---

## Pricing on Landing Page

Landing page currently shows 3 pricing cards (Starter $399, Pro $699, Sub $59).
**Missing:** Portfolio $1,999/mo card. Must add.

---

## Key Terminology

| Term | Meaning |
|------|---------|
| NOD | Notice of Delay — formal notification under AIA A201 §8.3.1 |
| REA | Request for Equitable Adjustment — itemized compensation claim |
| AIA A201 | Standard US construction contract (American Institute of Architects) |
| Ready Board | The cross-trade readiness grid (floors × trades × areas) |
| Carlos Standard | UX philosophy: 3 taps, 60-year-old Spanish speaker, zero training |
| effective_pct | Calculated completion % accounting for gate tasks |
| gate task | Task that blocks READY regardless of overall % |
| coopetition | GC sees operations, sub keeps legal docs private until published |
| PowerSync | Offline-first sync engine (SQLite local ↔ Supabase cloud) |
| cost of inaction | Daily $ lost if a delay remains unresolved |
| GC VERIFY | Task that requires GC approval, not foreman completion |

---

## What NOT To Build

1. Don't build AI-generated legal narrative in V1 — templates first
2. Don't build task creation UI for foremen — they consume checklists, not create them
3. Don't allow partial GC verification — approve or correct, no "partially approved"
4. Don't auto-approve GC VERIFY tasks — ever. Inaction IS the evidence.
5. Don't show AI suggestions in foreman checklist — human-verified data only
6. Don't require sequential task completion — foremen do tasks out of order
7. Don't add DocuSign before V3 — finger signature is sufficient for V1
8. Don't build Owner portal before 20 paying customers
9. Don't add languages beyond EN/ES before V2
10. Don't build Bid Intelligence before 50 projects + 12 months data
11. Don't internationalize legal templates (non-US) in Year 1
12. Don't build AI chat agent before V2
13. Don't build custom domains / white-label before enterprise demand
14. Don't send NODs automatically — always draft + human send
15. Don't use WidthType.PERCENTAGE in docx tables — breaks in Google Docs

---

## Task Prefixes — Claude Code Must Follow

- 🔍 **VERIFY FIRST** — Search codebase. If works: skip ✅. If broken: fix. If missing: build.
- 🔨 **BUILD** — Does not exist. Create from scratch.
- 🔌 **WIRE** — Code/dependency exists but not connected. Hook it up.

**Rules:**
- Never build a 🔍 task without searching the codebase first
- After each task batch, run `npx tsc --noEmit` and `npm run build`
- Read the relevant SKILL.md before working on billing, RLS, legal, mobile, notifications, or checklists

---

*ReadyBoard v6.0 — CLAUDE.md — Updated 2026-04-06 — GC task exclusion + work dates + progress photos*
*readyboard.ai*
