# ReadyBoard — Business Logic

> Version 5.1 — Includes Granular Trade Checklist System, Receipt Acknowledgment, SHA-256

---

## Product Definition

ReadyBoard is a **legal infrastructure platform** for commercial construction.
It is NOT a project management tool. It is the equivalent of an insurance policy
for specialty contractors — and an operational command center for General Contractors.

---

## User Roles & Permissions

| Role | App | Can Do | Cannot Do |
|------|-----|--------|-----------|
| Foreman | Mobile | Report area status (slider or checklist), take photos, view assigned areas, sign NODs | See other trades, access GC dashboard, complete GC tasks, modify task templates |
| Sub PM / Superintendent | Mobile + Web | Review NODs, send legal docs, view all sub areas, manage foremen, customize task templates | Change trade sequences, access other subs' data |
| GC PM | Web | View Ready Board, create corrective actions, all trades, import schedule, approve/correct checklist tasks, view GC verification queue | Access sub legal documents until sub publishes |
| GC Admin | Web | All GC PM + manage projects, configure trade sequences, benchmarks, checklist mode per trade | Access sub legal documents until published |
| Owner | Web | Executive summary, delivery projections | Everything else |

---

## RLS Rules (Row Level Security)

- Foreman sees ONLY areas assigned to them via `user_assignments`
- Sub PM sees ALL areas for their trade on their projects
- GC PM sees ALL areas across ALL trades on their projects
- **Legal documents are PRIVATE to the sub until explicitly published to GC**
- Organizations are isolated: GC A cannot see GC B's data
- Users belong to one organization. Can be on multiple projects
- **SUB tasks in `area_tasks`: only completable by sub users assigned to that area**
- **GC VERIFY tasks in `area_tasks`: only completable by GC users (gc_super, gc_pm, gc_admin)**
- This is enforced at the database level via RLS — not just UI

```sql
-- Sub completes sub tasks
CREATE POLICY "Sub completes sub tasks" ON area_tasks
  FOR UPDATE USING (
    task_owner = 'sub'
    AND completed_by = auth.uid()
    AND auth.uid() IN (
      SELECT user_id FROM user_assignments WHERE area_id = area_tasks.area_id
    )
  );

-- GC completes GC tasks only
CREATE POLICY "GC completes gc tasks" ON area_tasks
  FOR UPDATE USING (
    task_owner = 'gc'
    AND completed_by = auth.uid()
    AND auth.uid() IN (
      SELECT u.id FROM users u
      JOIN projects p ON u.org_id = p.gc_org_id
      JOIN areas a ON a.project_id = p.id
      WHERE a.id = area_tasks.area_id
      AND u.role IN ('gc_super', 'gc_pm', 'gc_admin')
    )
  );
```

---

## Ready Board — Status Logic

### Area Status Calculation

```
For each area + trade combination:
  IF reporting_mode = 'percentage':
    effective_pct = manual_pct (from slider)
    all_gates_passed = true (no gates in % mode)

  IF reporting_mode = 'checklist':
    effective_pct = SUM(completed_task_weights) / SUM(all_task_weights) * 100
    all_gates_passed = (no gate tasks with status != 'complete')

  Then apply status:
    IF all prior trades effective_pct = 100 AND all_gates_passed = true → READY (green)
    IF prior trade effective_pct >= 80 → ALMOST (yellow), show ETA
    IF prior trade effective_pct < 80 → BLOCKED (red)
    IF external_blocker active → HELD (purple)

  SPECIAL RULE — Gates:
    Even if effective_pct = 99%, if any gate task is not complete → status = ALMOST
    "79% complete — awaiting GC verification" is a valid ALMOST state
```

### Status Colors

| Status | Color | Hex | Meaning |
|--------|-------|-----|---------|
| READY | Green | #4ade80 | All prior trades done AND all gates passed. Work here now. |
| ALMOST | Yellow | #fbbf24 | Prior trade 80%+ OR gates pending. ETA 1-2 days. |
| BLOCKED | Red | #f87171 | Prior trade not done. ETA 3+ days. |
| HELD | Purple | #c084fc | External blocker (no heat, no access, inspection). |
| DONE | Blue | #3b82f6 | This trade completed in this area. |

---

## The 14-Trade Interior Finish Sequence

Default template for NYC commercial high-rise. Stored per area_type (bathroom, kitchen, corridor, office).
GCs customize per project. Area types define which trades apply.

```
Trade  1: Rough Plumbing
Trade  2: Metal Stud Framing + Door Frames
Trade  3: MEP Rough-In (In-Wall)
Trade  4: Fire Stopping — FDNY inspects independently, gates drywall
Trade  5: Insulation & Drywall
Trade  6: Waterproofing (Wet Areas) — membrane + flood test
Trade  7: Tile / Stone
Trade  8: Paint
Trade  9: Ceiling Grid / ACT
Trade 10: MEP Trim-Out
Trade 11: Doors & Hardware
Trade 12: Millwork, Casework & Countertops
Trade 13: Flooring (Non-Tiled)
Trade 14: Specialties, Final Clean & Punch List
```

---

## Two Reporting Modes

### Mode A: Percentage-Based (Default — V1)

Foreman slides to a percentage. Fast, 3 taps. Works for all projects in V1.
`effective_pct = manual_pct`. No gates. `all_gates_passed = true` always.

### Mode B: Task-Based Checklist (V1.1 — opt-in per trade)

GC enables checklist per trade at project setup. Foreman taps checkboxes instead of slider.
`effective_pct` is auto-calculated from task weights. Gates enforce ordering at key milestones.

**The downstream logic is identical for both modes.** Ready Board, Forecast, Legal Docs,
and 1-Screen Dashboard all consume `effective_pct` and `all_gates_passed`. They never
know or care which mode generated the number.

### Effective Percentage Calculation (Edge Function / DB Trigger)

```sql
CREATE OR REPLACE FUNCTION calculate_effective_pct()
RETURNS TRIGGER AS $$
DECLARE
  total_weight NUMERIC;
  done_weight  NUMERIC;
  gates_ok     BOOLEAN;
BEGIN
  IF NEW.reporting_mode = 'checklist' THEN
    SELECT
      COALESCE(SUM(weight), 0),
      COALESCE(SUM(CASE WHEN status = 'complete' THEN weight ELSE 0 END), 0)
    INTO total_weight, done_weight
    FROM area_tasks
    WHERE area_id = NEW.area_id
      AND trade_type = NEW.trade_type
      AND status != 'na';

    NEW.calculated_pct := CASE
      WHEN total_weight > 0 THEN ROUND((done_weight / total_weight) * 100, 1)
      ELSE 0
    END;
    NEW.effective_pct := NEW.calculated_pct;

    SELECT NOT EXISTS (
      SELECT 1 FROM area_tasks
      WHERE area_id = NEW.area_id
        AND trade_type = NEW.trade_type
        AND is_gate = true
        AND status != 'complete'
    ) INTO gates_ok;

    NEW.all_gates_passed := gates_ok;

  ELSE
    NEW.effective_pct := NEW.manual_pct;
    NEW.all_gates_passed := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Task Ownership — SUB vs GC VERIFY

Every task in a checklist has `task_owner` — either `'sub'` or `'gc'`.

### SUB Tasks
- Production tasks performed by the specialty contractor's foreman
- Carlos taps these in the field app
- GPS, timestamp, and optional photo captured automatically
- Can be completed offline — sync on reconnect

### GC VERIFY Tasks
- Approval gates performed by the GC superintendent or PM
- Cannot be completed by the sub — RLS enforced at DB level
- On Carlos's screen: greyed out with label "Awaiting GC" in his language
- On GC dashboard: appear in the Verification Queue

### Gate Tasks (⛔)
- Any task (SUB or GC) can be flagged `is_gate = true`
- Even at 99% effective_pct, area does NOT flip to READY if any gate is incomplete
- Visual: ⛔ icon, highlighted row, distinct color in checklist
- Sequential tasks are a suggestion. Gate tasks are a hard stop.

---

## GC Verification Notification Chain

When the sub completes the **last SUB task before a GC VERIFY gate**:

```
Step 1: Push notification to GC super (in their language)
        "Floor 24 Bath A — Waterproofing complete. Your verification needed."
        Timestamp saved to area_tasks.verification_requested_at

Step 2: If no GC response in 4 hours (configurable per project)
        Reminder push to GC: "Verification pending 4h — [area], [trade]"
        Saved to area_tasks.reminder_sent_at

Step 3: If no GC response in 24 hours
        Flag on GC dashboard: "GC verification pending 24h — crew waiting"
        Saved to area_tasks — escalation_flagged_at

Step 4: Alert to sub:
        "GC viewed your request 24h ago — no response. Consider escalating."

Step 5: NOD draft auto-references this chain:
        "Waterproofing completed [date] at [time] (GPS verified, flood test
        photo attached). GC verification requested [time]. GC notification
        opened [time]. No verification recorded as of [date].
        Tile crew of [n] idle: [x] crew-days, $[cost]."
```

Receipt tracking for verification notifications uses the same pixel/webhook
infrastructure as the NOD receipt tracking.

---

## GC Verification Queue

New view on GC dashboard and mobile: **"👷 Verify"** tab.

### Ordering
Sorted by **cost of inaction** (same logic as 1-Screen Dashboard alerts):
1. Has idle crew × daily cost (highest first)
2. Waiting hours (longest first)
3. Most recent (newest first)

### Per-Item Content
1. Header: floor, area, trade, foreman name
2. What sub completed: last task name, timestamps, evidence description
3. Full task checklist (expandable): all tasks with SUB/GC tags + status
4. Photos: thumbnails with timestamps and GPS
5. Idle cost: cumulative $ and hours if crew is waiting
6. Two action buttons (and nothing else):

```
[ ✕ Request Correction ]    [ ✓ Approve — Unblock Next Trade ]
```

### Approve Flow
1. GC taps "Approve"
2. System records: user, timestamp, GPS, device
3. GC VERIFY gate tasks → `complete` in `area_tasks`
4. `effective_pct` recalculates via trigger
5. If `all_gates_passed = true` → area status flips to READY for next trade
6. Next trade foreman receives push in their language: "Baño 24A is READY for Tile"
7. Timestamp recorded in `area_tasks.completed_at`

### Correction Flow
1. GC taps "Request Correction"
2. Picks reason code:
   - Workmanship does not meet spec
   - Wrong material installed
   - Missing items — incomplete
   - Failed test — redo required
   - Safety concern
   - Other (see notes)
3. Optional notes field
4. `area_tasks.status` → `correction_requested`
5. Sub foreman push: "GC requested correction on [area] [trade]: [reason]"
6. Correction response timer starts (documented)
7. Sub corrects → re-completes tasks → GC re-notified

---

## Field Report Flow (Foreman — 3 Taps)

### Percentage Mode (V1 Default)

**Step 1: How much is done?**
- Large percentage slider (0–100%, step 5%)
- Large number display

**Step 2: Any blockers?**
- YES ✓ (full-width green) → save progress update → confirmation
- NO ✕ (full-width red) → go to Step 3

**Step 3: Why blocked?**
- Reason codes with large icons (56px tap targets)
- Reason codes: 🌡 No Heat | 🔨 Prior Trade | 🚫 No Access | 📋 Inspection | 🔧 Plumbing | 📦 Material | 💧 Moisture
- Optional: camera button (queued offline)
- Submit → full-screen green checkmark + haptic

### Checklist Mode (V1.1)

Step 1 slider is replaced by task checklist. Same 3-tap standard.
SUB tasks: tappable. GC VERIFY tasks: greyed, "Awaiting GC".
Gate tasks: ⛔ icon. Progress bar live-updates.

### Auto-captured on every report
- GPS coordinates (device hardware — no internet required)
- Timestamp (device clock, verified on sync)
- Device ID
- `offline_created_at` flag (was this created without connectivity?)

### NOD Reminder Banner

When foreman has active BLOCKED area + pending NOD draft + NOD not yet sent:
Purple banner appears top of home screen: "⚖ [NOD draft ready — 24h window. Tap to review.]"
Tapping opens the NOD draft. Only visible when conditions are met.

---

## Delay Documentation — Auto-Triggers

| Event | System Action |
|-------|--------------|
| Area → BLOCKED or HELD | `delay_log` created. Man-hours clock starts. Cost accumulates. |
| First BLOCKED report on area | Draft NOD auto-generated within 60 seconds |
| Draft NOD created | Push to superintendent + purple banner on foreman home screen |
| 20 hours since draft, not sent | Reminder push: "24h window closing" |
| Sub sends NOD to GC | PDF generated with SHA-256. Tracked email. Receipt monitoring starts. |
| GC opens NOD email | `receipt_event` logged (timestamp, IP, device, open count) |
| 48h since GC opened, no CA response | Alert to sub: "GC viewed, no response. Consider escalating." |
| Cumulative delay > $5K or 3 crew-days | REA draft auto-generated |
| Last SUB task before GC gate completed | Push to GC verification queue. Timer starts. |
| 4h since GC gate notification, no response | Reminder push to GC |
| 24h since GC gate notification, no response | Escalation flag on dashboard. Sub alerted. |

---

## Corrective Action Lifecycle

```
CREATED → ACKNOWLEDGED → IN_RESOLUTION → RESOLVED
```

| Stage | Actor | Timestamp Field |
|-------|-------|-----------------|
| Created | GC PM creates action, assigns responsible party + deadline | created_at |
| Acknowledged | Assigned party views and confirms | acknowledged_at |
| In Resolution | Work to resolve has started | in_resolution_at |
| Resolved | Blocker removed. Area status recalculates. | resolved_at |

Response times tracked and included in GC performance profile for Bid Intelligence (V3).

---

## Forecast Engine — Deterministic (V1)

### Inputs
1. **Benchmark:** PM-defined production rate (e.g., 2.6 sqft/hr/person for marble tile)
2. **Actual rate:** `effective_pct` × `total_sqft` ÷ hours_worked
   - In percentage mode: `completed_sqft = total_sqft × (manual_pct / 100)`
   - In checklist mode: `completed_sqft = total_sqft × (effective_pct / 100)`
3. **P6 Schedule:** Imported CSV/XLSX with official planned dates

### Calculation

```
remaining_sqft   = total_sqft - completed_sqft
actual_rate      = completed_sqft / hours_worked
eta_hours        = remaining_sqft / actual_rate / crew_size
projected_date   = now + eta_hours (work days only)
delta_days       = projected_date - p6_scheduled_date
```

### Alert Examples

- "Mario's crew: 3.8 sqft/h/man — 46% above benchmark. Floor 7 finishes Thursday."
- "Pedro's crew: 1.9 sqft/h/man — 27% below benchmark. Floor 8 finishes Apr 8 (+5 days vs P6)."
- "GC verification pending 24h on Waterproofing Floor 24. Tile crew idle: $4,160/day."

### Change Order Engine

When scope changes mid-project:
1. PM or foreman logs change: new sqft, reason, `gc_initiated` flag
2. System recalculates all downstream forecasts
3. GC-initiated changes flagged as evidence in REA cost table

---

## Receipt Acknowledgment System

When the sub sends a legal document (NOD, REA, Evidence Package) to the GC:

1. Each document email contains a unique tracking pixel (1×1 transparent PNG)
2. Pixel hosted on ReadyBoard CDN with UUID endpoint
3. When GC opens email, pixel loads → webhook fires → `receipt_event` created
4. `legal_documents.first_opened_at` + `open_count` updated
5. If document opened and no corrective action in 48h → sub alerted:
   "GC viewed your NOD [x]h ago — no response."
6. `receipt_event` data included in Evidence Package as exhibit
7. PDF footer prints: "Document viewed: [timestamp] — Receipt ID: [UUID]"

### Legal Significance

This creates **constructive notice** — the GC cannot claim they did not receive
or review the document. Every hour of silence after the read receipt is documented
inaction. This data included automatically in all NOD and Evidence Package content.

---

## SHA-256 Document Integrity

Every legal document PDF is hashed immediately after generation, before delivery:

1. `crypto.createHash('sha256')` computed on PDF buffer
2. Hash stored in `legal_documents.sha256_hash` with `generated_at` timestamp
3. Hash printed in PDF footer (monospace font — machine-readable)
4. Public verification endpoint: `GET /api/legal/verify?hash=[hash]`
   Returns: `{ valid: boolean, generated_at, project_id }`
5. All hashes included in Evidence Package appendix as "Document Integrity Log"

### Legal Significance

If a document is presented in arbitration 18 months after generation:
- Hash on paper document is computed and compared to DB record
- Match = document is provably unaltered since generation
- Mismatch = document was tampered (which the system would surface)
- No construction software in the market currently provides this

---

## Legal Document Content — Full Specification

### NOD (Notice of Delay)

**Auto-trigger:** First BLOCKED status on any area (draft only — human sends)
**Contract references:** AIA A201 §8.3.1, ConsensusDocs 200 §6.3
**Content:**
- Party names, contract number, project address
- Delay event date, time, area, cause description (AI-generated narrative in V2, template in V1)
- Exhibits: GPS field report, photographs (numbered), corrective action reference
- Cost impact: crew × hours × labor rate
- GC verification timeline (if delay involves pending GC gate)
- Finger signature PNG + timestamp + GPS + device ID
- SHA-256 hash in footer
- Receipt tracking UUID

### REA (Request for Equitable Adjustment)

**Auto-trigger:** $5,000 cumulative OR 3 crew-days on single delay cause
**Contract references:** AIA A201 §7.3, standard subcontract change order clause
**Content:**
- All of NOD content
- Itemized cost table: date × crew × hours × rate + overhead percentage
- References all NODs already sent for this cause
- Total claim amount
- GC-initiated scope changes if applicable

### Evidence Package

**Trigger:** On demand (weekly, monthly, closeout, or attorney request)
**Format:** Complete legal brief formatted for AAA Construction Industry arbitration
**Content:**
- Executive summary (chronological narrative)
- All NODs with receipt confirmations
- All REAs with cost tables
- GPS verification log
- Photo exhibits (numbered sequentially as Exhibit A, B, C...)
- Corrective action history with GC response times
- GC verification timeline log (checklist mode)
- SHA-256 integrity verification appendix
- Financial summary by cause and responsible party

---

## Notification Rules

| Event | Who Gets Notified | Channel | Language |
|-------|-------------------|---------|----------|
| Area → READY for your trade | Assigned foreman | Push | Foreman's language |
| Area → BLOCKED | GC PM + Sub PM | Push + Web | Their language |
| NOD draft ready | Superintendent | Push + banner | Their language |
| NOD 20h reminder | Superintendent | Push | Their language |
| GC opened NOD | Sub PM | Push + Web | Their language |
| GC 48h no response to NOD | Sub PM | Push + Web | Their language |
| GC verification requested (last SUB task before gate) | GC super | Push + Verify queue | Their language |
| GC 4h no verification response | GC super | Push | Their language |
| GC 24h no verification response | GC super (dashboard flag) + Sub PM | Push + Web | Their language |
| GC approved verification | Next trade foreman | Push | Foreman's language |
| GC requested correction | Sub foreman | Push | Foreman's language |
| Forecast delta > 3 days | GC PM | Web | Their language |
| REA threshold reached | Sub PM | Push + Web | Their language |

---

## i18n — What Gets Translated

EVERYTHING. No surface is English-only in V1.

- All UI (buttons, labels, menus, headers)
- Reason codes (delay and checklist)
- Push notifications
- PDF legal documents
- Status labels (READY, BLOCKED, etc.)
- Task names in checklists (`task_name_en` / `task_name_es`)
- GC verification reasons
- Error messages
- Onboarding SMS

V1 languages: **English + Spanish**
Language detected from device. Changeable via profile toggle (hidden from main nav).

---

## Pricing Logic

- Projects billed monthly per-project (not per-user)
- Sub Add-on is per-organization per-month
- Free pilot: 30 days, full Pro features, one project
- Upgrade path: Starter → Pro → Portfolio (GC), Sub Add-on (sub)
- $699/mo approval threshold: PM can expense from project contingency without IT/procurement

---

## What NOT to Build

- Do NOT auto-send NODs — always draft + human approval
- Do NOT allow partial GC verification — approve or correct, no middle state
- Do NOT auto-approve GC VERIFY tasks — the documentation of inaction IS the value
- Do NOT build task creation UI for foremen — they consume, not create
- Do NOT show AI in foreman checklist — human-verified field data only
- Do NOT require sequential task completion — only gate tasks enforce ordering
- Do NOT build a full JHA module — keep the lightweight safety gate
