# ReadyBoard — TASKS.md

> Version 5.1 — 7-week V1 build + Week 8-9 Checklist System sprint
> AI is explicitly OUT of scope for V1.
> Checklist System (V1.1) is Week 8-9, immediately post-launch.

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
- [ ] **INFRA:** Set up Supabase project (readyboard-prod)
- [ ] **INFRA:** Set up Expo project (readyboard-mobile)
- [ ] **INFRA:** Set up Next.js project (readyboard-web)
- [ ] **INFRA:** Set up Turborepo monorepo structure
- [ ] **INFRA:** Set up Vercel project for web dashboard
- [ ] **DEMO:** Show 1-Screen Dashboard artifact to Jantile PM. Ask: "If you had this at 7am, how many calls would you not make?" Listen. Write down exact words.

---

## Week 1 — Foundation + Data Model

### Supabase Schema

- [ ] Create `organizations` table (name, type: GC|SUB, default_language, logo_url, legal_template_version)
- [ ] Create `projects` table (name, address, labor_rate_per_hour, legal_jurisdiction, sha256_enabled DEFAULT true, gc_org_id, sub_org_id)
- [ ] Create `users` table (email, phone, name, role, language, org_id)
- [ ] Create `areas` table (name, floor, area_type, project_id, total_sqft, original_sqft)
- [ ] Create `trade_sequences` table (project_id, area_type, trade_name, sequence_order)
- [ ] Create `user_assignments` table (user_id, area_id, trade_name)
- [ ] Create `production_benchmarks` table (project_id, trade_name, area_type, sqft_per_hour_per_person)
- [ ] Create `area_trade_status` table (area_id, trade_type, reporting_mode DEFAULT 'percentage', manual_pct, calculated_pct, effective_pct, all_gates_passed DEFAULT false, gc_verification_pending, gc_verification_pending_since)
- [ ] Create `field_reports` table (area_id, user_id, status, progress_pct, reason_code, gps_lat, gps_lng, photo_url, created_at, offline_created_at, device_id)
- [ ] Create `delay_logs` table (area_id, trade_name, reason_code, started_at, man_hours, daily_cost, cumulative_cost, nod_draft_id, rea_id, receipt_confirmed)
- [ ] Create `corrective_actions` table (delay_log_id, assigned_to, deadline, note, created_at, acknowledged_at, in_resolution_at, resolved_at, created_by)
- [ ] Create `legal_documents` table (project_id, org_id, type: NOD|REA|EVIDENCE, sha256_hash, receipt_tracking_uuid, first_opened_at, open_count, sent_at, sent_by, signature_png_url, pdf_url)
- [ ] Create `nod_drafts` table (delay_log_id, draft_content_jsonb, reminder_sent_at, sent_at, sent_by)
- [ ] Create `receipt_events` table (document_id, event_type, ip_address, device_type, opened_at)
- [ ] Create `schedule_items` table (project_id, area_name, trade_name, planned_start, planned_finish, p6_activity_id)
- [ ] Create `scope_changes` table (area_id, delta_sqft, reason, change_order_ref, initiated_by, gc_initiated BOOLEAN, forecast_impact_days, created_at)
- [ ] Create `forecast_snapshots` table (project_id, area_id, trade_type, snapshot_date, effective_pct, actual_rate, benchmark_rate, projected_date, scheduled_date, delta_days, recommendations JSONB)
- [ ] Write RLS policies: foreman sees only assigned areas
- [ ] Write RLS policies: sub PM sees all areas for their trade
- [ ] Write RLS policies: GC PM sees all areas across all trades
- [ ] Write RLS policies: legal_documents private to sub until published
- [ ] Write RLS policies: organization isolation (GC A ≠ GC B)
- [ ] Write RLS policies: SUB can only complete SUB tasks in area_tasks
- [ ] Write RLS policies: GC can only complete GC tasks in area_tasks
- [ ] Seed data: 383 Madison project, Tishman as GC, Jantile as sub, 5 floors, baths A-F

### i18n Architecture

- [ ] Set up i18next in shared package
- [ ] Create EN translation file — all UI strings (zero hardcoded strings in components)
- [ ] Create ES translation file — all UI strings
- [ ] Create reason_codes translations (EN + ES) — delay reasons + checklist correction reasons
- [ ] Create notification_templates translations (EN + ES)
- [ ] Set up next-i18next for web dashboard

### SHA-256 Infrastructure

- [ ] Create `packages/legal/hash.ts` — SHA-256 hash function for PDF buffers
- [ ] Create `packages/legal/verify.ts` — hash verification endpoint logic
- [ ] Confirm `sha256_hash` column in `legal_documents` (done in schema above)

### PowerSync Schema

- [ ] Define PowerSync sync rules (which tables sync to mobile)
- [ ] `field_reports`, `area_trade_status`, `user_assignments`, `nod_drafts` — sync to mobile
- [ ] Define conflict resolution: last-write-wins with `offline_created_at`
- [ ] Set up PowerSync project + connect to Supabase

---

## Week 2 — Foreman Mobile App (Offline-First)

### Expo Setup

- [ ] Initialize Expo project with TypeScript
- [ ] Configure expo-localization — auto language detection from device
- [ ] Configure expo-camera — photo evidence
- [ ] Configure expo-location — GPS capture
- [ ] Configure expo-haptics — confirmation feedback
- [ ] Set up PowerSync + SQLite in mobile app
- [ ] Verify offline-first: ALL reads/writes go to local SQLite first

### Auth (SMS Magic Link)

- [ ] Create SMS magic link flow in Supabase Auth
- [ ] Superintendent sends invite → foreman receives SMS with link
- [ ] Foreman taps link → authenticated → sees assigned areas immediately
- [ ] **Zero form fields. Zero password. Zero onboarding screens.**
- [ ] GC/Sub PM: email + password login (standard Supabase auth)

### Foreman Home Screen

- [ ] Build home screen showing ONLY areas assigned to this foreman (from `user_assignments`)
- [ ] Areas grouped by status: READY (green) first, ALMOST (yellow), BLOCKED/HELD (red/purple)
- [ ] Large color-coded cards: area name + status label + one-line description
- [ ] 56px+ tap targets, readable in direct sunlight
- [ ] Header: foreman name, trade, project name, sync status (green dot)
- [ ] Language auto-detected from device. Hidden toggle in profile.
- [ ] **NOD Reminder Banner:** When active BLOCKED area + pending NOD draft + not yet sent → purple banner top of screen: "⚖ [NOD draft ready — 24h window. Tap.]" → tapping opens NOD draft
- [ ] Big orange "Report Update" button always visible at bottom

### Report Flow — Step 1: How Much Is Done?

- [ ] Large percentage slider (0–100%, step 5%)
- [ ] Huge number display center screen: "75%"
- [ ] Progress indicator strip at top: 3 steps

### Report Flow — Step 2: Any Blockers?

- [ ] Two full-width buttons: YES ✓ (green, large) / NO ✕ (red, large)
- [ ] If YES → save `field_report` (status=WORKING, progress=slider value) → confirmation screen
- [ ] If NO → go to Step 3

### Report Flow — Step 3: Why Blocked? (only if NO on Step 2)

- [ ] Reason codes as large icon buttons (56px+):
     🌡 No Heat | 🔨 Prior Trade | 🚫 No Access | 📋 Inspection | 🔧 Plumbing | 📦 Material | 💧 Moisture
- [ ] One tap selects reason (highlighted blue border)
- [ ] Optional: camera button to take photo (queued locally if offline)
- [ ] "📷 Take photo & submit" button (disabled until reason selected)
- [ ] Submit → save `field_report` with reason_code + GPS + photo_url
- [ ] Auto-create `delay_log` entry on first BLOCKED report for this area

### Confirmation Screen

- [ ] Full-screen green background
- [ ] Large ✓ checkmark (88px)
- [ ] Haptic feedback (expo-haptics)
- [ ] Show: area name + status + "Syncing..." → "Synced ✓"
- [ ] Auto-return to home after 2 seconds

### Tablet Responsive Layout

- [ ] Test all screens on iPad + Android tablet
- [ ] Larger cards, adjusted spacing for bigger screens
- [ ] Maintain single-column layout (no desktop-style grids on foreman tablet view)

### Offline Testing

- [ ] Enable airplane mode
- [ ] Submit 5 field reports with slider
- [ ] Take 3 photos
- [ ] Verify all saved locally (SQLite)
- [ ] Re-enable connectivity
- [ ] Verify all synced to Supabase within 30 seconds
- [ ] Verify GPS coordinates captured correctly without internet

---

## Week 3 — Ready Board + GC Dashboard

### Ready Board (Web)

- [ ] Cross-trade readiness grid (floors × trades) — floor rows, trade columns
- [ ] Each cell: status color + label (RDY, ALM, BLK, HLD, DONE)
- [ ] Click cell → detail panel slides in: area info, hours blocked, cost, GPS, photos
- [ ] Real-time updates via Supabase Realtime subscriptions
- [ ] Filter by: floor, trade, status
- [ ] Export PDF button (generates Delay Impact Report)
- [ ] Legend for color codes

### 1-Screen GC Dashboard

- [ ] **Section 1: What's happening right now?** — 4 metric cards: project %, on track count, attention count, action required count
- [ ] **Section 2: What needs attention?** — Alert list ranked by daily cost of inaction ($). Max 5 items.
- [ ] Each alert: floor, trade, reason, daily cost, cumulative cost, days blocked, one action button
- [ ] Expandable alert: context + GC action note input + "Confirm Action" button
- [ ] **Section 3: When does this end?** — P6 date + projected date + delta in days (red if behind). Recovery actions list.
- [ ] Right sidebar: Cost of Inaction counter (animated), Legal Status per alert, AI Insight placeholder
- [ ] Left sidebar: Floor status strip — color-coded per floor with progress bars
- [ ] Bottom bar: "If you had this at 7am — how many calls would you not make?" (demo mode)

### Corrective Action Module

- [ ] GC PM creates action from any BLOCKED/HELD alert: assigned_to, deadline, note
- [ ] Assigned user receives push notification
- [ ] Track lifecycle: created → acknowledged → in_resolution → resolved with timestamps
- [ ] When resolved → area status recalculates automatically
- [ ] Response times tracked for GC performance profile

### GC Visibility Control — Legal Docs

- [ ] Legal documents tab visible to sub only
- [ ] "Publish / Send to GC" button — explicit sub action required
- [ ] GC sees Ready Board + Corrective Actions but NOT sub's legal docs until published
- [ ] Test: GC login cannot see NOD drafts or Evidence Packages

### Safety Clearance Gate

- [ ] Project-level toggle (off by default, set by GC Admin)
- [ ] If on: foreman must attach safety photo + mark "Cleared" before area shows READY
- [ ] Binary gate — NOT a full JHA module

### Push Notifications (Bilingual)

- [ ] Set up Expo push notifications
- [ ] Area → READY: push to assigned foreman in their language
- [ ] Area → BLOCKED: push to GC PM + Sub PM in their language
- [ ] NOD draft ready: push to superintendent in their language
- [ ] All notifications use i18next templates

---

## Week 4 — Delay Logging + Legal Triggers

### Delay Log Engine

- [ ] Auto-create `delay_log` on first BLOCKED/HELD field_report per area
- [ ] Calculate `man_hours`: crew_size × hours since blocked
- [ ] Calculate `daily_cost`: man_hours × project.labor_rate_per_hour
- [ ] Accumulate `cumulative_cost` across days
- [ ] Attach GPS evidence from field_report
- [ ] Link photo evidence from field_report

### NOD Draft Auto-Generation

- [ ] Trigger: first BLOCKED status on any area
- [ ] Generate draft within 60 seconds (Supabase Edge Function)
- [ ] Draft content JSONB: project info, area, date, cause, exhibits list, AIA contract references
- [ ] Push notification to superintendent + purple banner on foreman home
- [ ] 20-hour reminder push if not sent

### Finger Signature Component

- [ ] Canvas-based signature capture (mobile + tablet + web)
- [ ] Saves as PNG with timestamp + GPS + device_id
- [ ] Stores in Supabase Storage
- [ ] Links to `legal_document.signature_png_url`
- [ ] Clear button, visual confirmation when signed

### Change Order Engine

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

### REA Threshold Triggers

- [ ] Monitor cumulative delay cost per area per cause
- [ ] Trigger at $5,000 OR 3 crew-days: auto-generate REA draft
- [ ] REA references all NODs already sent for this cause
- [ ] Notify Sub PM via push + web

---

## Week 6 — Legal Document Generation

### PDF Generation Engine

- [ ] NOD PDF template (AIA A201 §8.3.1 / ConsensusDocs 200 §6.3)
- [ ] Fields: project, contract no., date, delay start, cause, area, exhibits list
- [ ] Include finger signature PNG overlay
- [ ] Include SHA-256 hash in footer (monospace, small)
- [ ] Include receipt tracking UUID
- [ ] PDF generated in user's language (EN or ES via react-pdf + i18n)
- [ ] **DO NOT FINALIZE TEMPLATE before attorney review in Week 5-6**

### REA PDF Template

- [ ] Itemized cost table: date × crew × rate + overhead percentage
- [ ] Reference all related NODs with sent timestamps
- [ ] Total claim amount (auto-calculated)
- [ ] SHA-256 hash in footer

### Evidence Package PDF

- [ ] Chronological delay narrative
- [ ] All NODs with receipt confirmations (timestamp + IP)
- [ ] All REAs with cost tables
- [ ] GPS verification log
- [ ] Photo exhibits numbered sequentially (Exhibit A, B, C...)
- [ ] Corrective action history with GC response times
- [ ] GC verification timeline (if checklist mode delays involved) — placeholder for V1.1
- [ ] SHA-256 integrity verification appendix
- [ ] Financial summary by cause and responsible party

### Receipt Tracking System

- [ ] Generate unique tracking UUID per document (`legal_documents.receipt_tracking_uuid`)
- [ ] Create 1×1 transparent PNG pixel hosted on ReadyBoard CDN
- [ ] Embed pixel in every outbound legal document email
- [ ] Supabase webhook: on pixel load → create `receipt_event` (timestamp, IP, device, open_count)
- [ ] Update `legal_documents.first_opened_at` + `open_count`
- [ ] 48h timer: if no corrective action after GC opens → alert to sub

### SHA-256 Verification

- [ ] Compute SHA-256 hash on PDF buffer before storage
- [ ] Store in `legal_documents.sha256_hash` with `generated_at`
- [ ] Print hash in PDF footer
- [ ] Public verification endpoint: `GET /api/legal/verify?hash=[hash]`
- [ ] Returns: `{ valid, generated_at, project_id }`
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
├── apps/
│   ├── mobile/                  Expo (Foreman + Sub PM)
│   └── web/                     Next.js (GC Dashboard)
├── packages/
│   ├── shared/                  Types, Zod schemas, i18n, utils
│   ├── db/
│   │   ├── migrations/          SQL migrations
│   │   ├── seed.sql             Demo data
│   │   └── templates/           Checklist JSON seed files (V1.1)
│   │       ├── bathroom-tasks.json
│   │       ├── kitchen-tasks.json
│   │       ├── corridor-tasks.json
│   │       └── office-tasks.json
│   └── legal/                   PDF generation, SHA-256
├── supabase/
│   ├── migrations/
│   └── functions/               Edge Functions (forecast, NOD draft, receipt webhook)
├── CLAUDE.md                    This project's AI context
├── BUSINESS_LOGIC.md            Status logic, RLS, notification chains
├── TASKS.md                     This file
└── CHECKLIST_SYSTEM.md          Full checklist architecture spec
```
