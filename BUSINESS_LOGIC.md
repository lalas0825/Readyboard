# ReadyBoard — Business Logic

## Product Definition

ReadyBoard is a legal infrastructure platform for commercial construction.
It is NOT a project management tool. It is the equivalent of an insurance policy for specialty contractors.

## User Roles & Permissions

| Role | App | Can Do | Cannot Do |
|------|-----|--------|-----------|
| Foreman | Mobile | Report area status, take photos, view assigned areas, sign NODs | See other trades, access GC dashboard, change sequences |
| Sub PM / Superintendent | Mobile + Web | Review NODs, send legal docs, view all sub areas, manage foremen | Change trade sequences, access other subs' data |
| GC PM | Web | View Ready Board, create corrective actions, see all trades, import schedule | Access sub legal documents (until sub publishes) |
| GC Admin | Web | All GC PM + manage projects, configure trade sequences, set benchmarks | Access sub legal documents |
| Owner | Web | View executive summary, delivery projections | Everything else |

## RLS Rules (Row Level Security)

- Foreman sees ONLY areas assigned to them via user_assignments
- Sub PM sees ALL areas for their trade on their projects
- GC PM sees ALL areas across ALL trades on their projects
- Legal documents are PRIVATE to the sub until explicitly published to GC
- Organizations are isolated: GC A cannot see GC B's data
- Users belong to one organization. Can be on multiple projects

## Ready Board — Status Logic

### Area Status Calculation
```
For each area, check trade_sequence order:
  IF all prior trades = 100% → status = READY (green)
  IF prior trade >= 80% → status = ALMOST (yellow), show ETA
  IF prior trade < 80% → status = BLOCKED (red)
  IF external_blocker active → status = HELD (purple)
```

### Status Colors
| Status | Color | Hex | Meaning |
|--------|-------|-----|---------|
| READY | Green | #4ade80 | All prior trades done. Work here now |
| ALMOST | Yellow | #fbbf24 | Prior trade 80%+. ETA 1-2 days |
| BLOCKED | Red | #f87171 | Prior trade not done. ETA 3+ days |
| HELD | Purple | #c084fc | External blocker (no heat, no access, inspection) |
| DONE | Blue | #3b82f6 | This trade completed in this area |

### Trade Sequence (Example: Bathroom Tile)
```
Rough Plumbing → Framing → MEP Rough → Drywall → Waterproof → [Tile/Stone] → Grout → Paint
```
Each project configures sequences per area type. GC PM sets this during project setup. Cloneable floor-to-floor for repetitive layouts.

## Field Report Flow (Foreman — 3 Taps)

### Screen 1: Where Are You?
- Shows ONLY areas assigned to this foreman
- Color-coded cards: green (ready), yellow (almost), red/purple (blocked)
- Tap area card to start report

### Screen 2: What's the Status?
- Three big buttons: DONE ✓ / WORKING ◔ / BLOCKED ✕
- If WORKING: show simple progress (ALMOST DONE / HALFWAY / JUST STARTED)
- If BLOCKED: go to Screen 3

### Screen 3: Why Blocked? (only if blocked)
- Reason codes with large icons (56px tap targets):
  - 🌡 No Heat | 🔨 Prior Trade | 🚫 No Access
  - 📋 Inspection Failed | 🔧 Plumbing | 📦 Material Wait | 💧 Moisture/Drying
- Optional: take photo (auto-queued if offline)
- Submit → full screen green checkmark + haptic

### Auto-captured on every report:
- GPS coordinates (from hardware, no internet needed)
- Timestamp (device clock, verified on sync)
- Device ID
- Offline flag (was this created without connectivity?)

## Delay Documentation — Auto-triggers

| Event | System Action |
|-------|--------------|
| Area changes to BLOCKED or HELD | delay_log created. Man-hours clock starts. Cost accumulates |
| First BLOCKED report on an area | Draft NOD auto-generated within 60 seconds |
| Draft NOD created | Push to superintendent: "Legal notice draft ready" |
| 20 hours since draft, not sent | Reminder push: "24h window closing" |
| Sub sends NOD to GC | PDF generated with SHA-256. Tracked email sent. Receipt monitoring starts |
| GC opens NOD email | receipt_event logged (timestamp, IP, device, count) |
| 48h since GC opened, no corrective action | Alert to sub: "GC viewed, no response. Consider escalating" |
| Cumulative delay > $5K or 3 crew-days | REA draft auto-generated |

## Corrective Action Lifecycle

```
CREATED → ACKNOWLEDGED → IN_RESOLUTION → RESOLVED
```

| Stage | Actor | Timestamp Field |
|-------|-------|-----------------|
| Created | GC PM creates action, assigns responsible party + deadline | created_at |
| Acknowledged | Assigned party views and confirms | acknowledged_at |
| In Resolution | Work to resolve has started | in_resolution_at |
| Resolved | Blocker removed. Area returns to previous status calculation | resolved_at |

Response times (acknowledged_at - created_at, resolved_at - created_at) are tracked and become part of the GC's performance profile for Bid Intelligence (V3).

## Forecast Engine — Deterministic (V1)

### Inputs
1. **Benchmark:** PM-defined production rate (e.g., 2.6 sqft/hr/person for marble tile)
2. **Actual rate:** Calculated from field reports (sqft completed ÷ hours worked)
3. **P6 Schedule:** Imported CSV/XLSX with official dates

### Calculation
```
remaining_sqft = total_sqft - completed_sqft
actual_rate = completed_sqft / hours_worked
eta_hours = remaining_sqft / actual_rate / crew_size
projected_date = now + eta_hours (adjusted for work days only)
delta_days = projected_date - p6_scheduled_date
```

### Alerts Generated
- "Mario's crew producing 3.8 sqft/h — 46% above benchmark. Floor 7 finishes Thursday"
- "Pedro's crew producing 1.9 sqft/h — 27% below benchmark. Floor 8 finishes April 8 (+5 days vs P6)"

## Notification Rules

| Event | Who Gets Notified | Channel | Language |
|-------|-------------------|---------|----------|
| Area becomes READY for your trade | Assigned foreman | Push | Foreman's language |
| Area becomes BLOCKED | GC PM + Sub PM | Push + Web | Their language |
| NOD draft ready | Superintendent | Push | Their language |
| NOD 20h reminder | Superintendent | Push | Their language |
| GC opened NOD | Sub PM | Push + Web | Their language |
| GC 48h no response | Sub PM | Push + Web | Their language |
| Forecast delta > 3 days | GC PM | Web | Their language |
| REA threshold reached | Sub PM | Push + Web | Their language |

## i18n — What Gets Translated in V1

EVERYTHING. No surface is English-only.
- All UI (buttons, labels, menus, headers)
- Reason codes
- Push notifications
- PDF legal documents
- Status labels
- Error messages (though there should be almost none)
- Onboarding SMS

V1 languages: English + Spanish.
Language detected from device. Changeable via hidden profile toggle.

## Pricing Logic

- Projects are billed monthly per-project (not per-user)
- Sub Add-on is per-organization per-month
- Free pilot: 30 days, full Pro features, one project
- Upgrade path: Starter → Pro → Portfolio (GC), Sub Add-on (sub)
- $699/mo approval threshold: PM can expense from project contingency without IT/procurement

## Change Order Engine

When scope changes mid-project:
1. Foreman or PM logs change (new sqft, reason, GC-initiated flag)
2. System recalculates all downstream forecasts
3. Change recorded as evidence (if GC-initiated change causes delay)
4. Appears in REA cost table if applicable

## Safety Clearance Gate (Lightweight)

- Optional per-project toggle set by GC
- If active: foreman must attach safety photo + mark "Cleared" before area shows READY
- NOT a full JHA module. That's a different buyer (Safety Manager) and a longer sales cycle
- Captures 80% of the safety value without 100% of the complexity
