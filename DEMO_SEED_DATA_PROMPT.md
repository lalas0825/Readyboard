# Demo Seed Data — Simulate 2-3 Months of Real Project Activity

## Context

The demo account needs realistic historical data so that every page in the dashboard shows meaningful content — not empty states. We're simulating a project that started ~3 months ago (January 2026) and is currently in active construction (April 2026).

**Project:** NYPA (or 383 Madison Avenue — use whichever is the current demo project)
**Timeline:** Jan 5 2026 (start) → current date (today)
**Building:** 39 floors (Floor 2-40), 4 units per floor (A-D), 5 areas per unit = 780 areas
**14 trades** in sequence

## The Simulation Story

The project is a 40-story luxury residential high-rise in NYC. Work started from the bottom up. As of today:

```
Floors 2-8:    90-100% complete (most trades done, paint + punch remaining)
Floors 9-15:   60-80% complete (tile/stone actively working, MEP trim starting)  
Floors 16-22:  30-50% complete (drywall finishing, waterproofing in progress)
Floors 23-28:  10-25% complete (framing + MEP rough-in)
Floors 29-35:  0-5% complete (rough plumbing just started)
Floors 36-40:  0% (not started — pending structural completion)
```

This creates a natural "wave" visible in the Ready Board — green at bottom, blue in middle, amber/red higher up, gray at top.

---

## PART 1: Field Reports (daily_reports + area_trade_status history)

Generate field reports as if foremen reported daily for the past 3 months. Don't create a report for every area every day — that's unrealistic. Create reports for the areas being actively worked.

```typescript
// Simulation parameters
const PROJECT_START = new Date('2026-01-05');
const TODAY = new Date(); // current date
const WORK_DAYS_ONLY = true; // skip weekends

// Production rate per trade (floors completed per month, roughly)
const TRADE_SPEED = {
  'Rough Plumbing': 4,        // 4 floors/month  
  'Metal Stud Framing': 3.5,
  'MEP Rough-In': 3,
  'Fire Stopping': 5,          // fast trade
  'Insulation & Drywall': 3,
  'Waterproofing': 4,
  'Tile / Stone': 2.5,         // slow, precision trade
  'Paint': 3.5,
  'Ceiling Grid / ACT': 4,
  'MEP Trim-Out': 3,
  'Doors & Hardware': 4,
  'Millwork & Countertops': 3,
  'Flooring': 3.5,
  'Final Clean & Punch': 5,
};

// For each work day from PROJECT_START to TODAY:
// 1. Determine which trades are active on which floors
// 2. Generate progress reports (5-15% per day per area)
// 3. Some days have delays (see Part 2)

async function generateFieldReports(projectId: string) {
  const workDays = getWorkDays(PROJECT_START, TODAY);
  
  for (const day of workDays) {
    // Which trades are active today?
    const activeTrades = getActiveTradesForDay(day);
    
    for (const { trade, floor, areas } of activeTrades) {
      for (const area of areas) {
        // Random progress increment (5-15% per day)
        const increment = Math.floor(Math.random() * 11) + 5;
        const newPct = Math.min(100, area.currentPct + increment);
        
        // Create a field report record
        await supabase.from('field_reports').insert({
          project_id: projectId,
          area_id: area.id,
          trade_name: trade,
          reported_by: getRandomForeman(trade),
          reported_at: randomTimeOnDay(day, 7, 15), // between 7am-3pm
          progress_pct: newPct,
          status: newPct === 100 ? 'completed' : 'in_progress',
          gps_lat: 40.7549 + (Math.random() * 0.0001),
          gps_lng: -73.9840 + (Math.random() * 0.0001),
        });

        // Update area_trade_status
        await supabase.from('area_trade_status').upsert({
          area_id: area.id,
          trade_name: trade,
          effective_pct: newPct,
          status: newPct === 100 ? 'done' : newPct > 0 ? 'in_progress' : 'pending',
          updated_at: randomTimeOnDay(day),
        });
      }
    }
  }
}
```

---

## PART 2: Delays (delay_logs)

Create realistic delays spread across the project timeline. Some resolved, some active.

```typescript
const DELAY_SCENARIOS = [
  // Resolved delays (happened weeks ago, already fixed)
  {
    floor: 5, unit: 'A', area: 'Master Bath',
    trade: 'Waterproofing',
    reason: 'no_heat',
    started: '2026-01-20', resolved: '2026-01-23',
    description: 'Building HVAC not operational on Floor 5. Min 50°F required for membrane curing.',
    crew: { foreman: 1, journeyperson: 2, helper: 1 },
  },
  {
    floor: 8, unit: 'B', area: 'Kitchen',
    trade: 'Tile / Stone',
    reason: 'prior_trade',
    started: '2026-02-03', resolved: '2026-02-05',
    description: 'Waterproofing on Floor 8B Kitchen incomplete. Tile crew idle.',
    crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  {
    floor: 12, unit: 'C', area: 'Corridor',
    trade: 'Insulation & Drywall',
    reason: 'inspection_failed',
    started: '2026-02-14', resolved: '2026-02-17',
    description: 'MEP rough-in inspection failed. Drywall crew on standby.',
    crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  {
    floor: 15, unit: 'A', area: 'Master Bath',
    trade: 'Tile / Stone',
    reason: 'material_not_delivered',
    started: '2026-02-25', resolved: '2026-03-01',
    description: 'Marble shipment delayed from Italy. Tile crew reassigned to Floor 14.',
    crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  {
    floor: 10, unit: 'D', area: 'Secondary Bath',
    trade: 'Rough Plumbing',
    reason: 'design_change',
    started: '2026-03-05', resolved: '2026-03-08',
    description: 'Architect changed fixture layout. Plumbing rework required.',
    crew: { foreman: 1, journeyperson: 2, apprentice: 1 },
  },

  // Active delays (happening NOW)
  {
    floor: 18, unit: 'A', area: 'Master Bath',
    trade: 'Waterproofing',
    reason: 'no_heat',
    started: '2026-03-29', resolved: null,
    description: 'Temporary heater failed on Floors 17-19. Min 50°F required. Current: 38°F.',
    crew: { foreman: 1, journeyperson: 2, helper: 1 },
  },
  {
    floor: 20, unit: 'B', area: 'Kitchen',
    trade: 'Metal Stud Framing',
    reason: 'material_not_delivered',
    started: '2026-03-31', resolved: null,
    description: 'Steel stud delivery delayed. Framing crew idle since Monday.',
    crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  {
    floor: 16, unit: 'C', area: 'Powder Room',
    trade: 'Tile / Stone',
    reason: 'prior_trade',
    started: '2026-03-30', resolved: null,
    description: 'Waterproofing on 16C Powder Room at 61%. Tile crew waiting.',
    crew: { foreman: 1, journeyperson: 2, apprentice: 1 },
  },
];

// For each delay, generate:
for (const delay of DELAY_SCENARIOS) {
  const startDate = new Date(delay.started);
  const endDate = delay.resolved ? new Date(delay.resolved) : TODAY;
  const daysBlocked = getWorkDaysBetween(startDate, endDate);

  // 1. delay_log record
  await supabase.from('delay_logs').insert({
    project_id: projectId,
    area_id: findAreaId(delay.floor, delay.unit, delay.area),
    trade_name: delay.trade,
    reason: delay.reason,
    description: delay.description,
    started_at: startDate.toISOString(),
    resolved_at: delay.resolved ? endDate.toISOString() : null,
    status: delay.resolved ? 'resolved' : 'active',
    crew_composition: delay.crew,
    daily_cost: calculateDailyCost(delay.trade, delay.crew),
    cumulative_cost: calculateDailyCost(delay.trade, delay.crew) * daysBlocked,
    man_hours_lost: Object.values(delay.crew).reduce((s, n) => s + n, 0) * daysBlocked * 7,
    gps_lat: 40.7549,
    gps_lng: -73.9840,
  });

  // 2. Set the area status to BLOCKED (for active delays)
  if (!delay.resolved) {
    await supabase.from('area_trade_status').upsert({
      area_id: findAreaId(delay.floor, delay.unit, delay.area),
      trade_name: delay.trade,
      status: 'blocked',
      blocked_reason: delay.reason,
      blocked_at: startDate.toISOString(),
    });
  }
}
```

---

## PART 3: Corrective Actions

Create CAs linked to the delays, in various states:

```typescript
const CORRECTIVE_ACTIONS = [
  // Resolved
  { delay_index: 0, status: 'resolved', 
    action: 'Temporary heater installed on Floor 5. HVAC contractor accelerating.',
    assigned_to: 'Mike Chen (Suffolk)', created: '2026-01-20', resolved: '2026-01-22' },
  { delay_index: 1, status: 'resolved',
    action: 'Waterproofing crew added 2 workers. Expected completion tomorrow.',
    assigned_to: 'Tom Garcia (WP Sub)', created: '2026-02-03', resolved: '2026-02-05' },
  { delay_index: 3, status: 'resolved',
    action: 'Material sourced from local supplier as temporary. Italian marble ETA March 1.',
    assigned_to: 'Sal Moretti (Jantile)', created: '2026-02-25', resolved: '2026-02-28' },

  // In progress
  { delay_index: 5, status: 'in_progress',
    action: 'Replacement heater ordered. ETA tomorrow 8am. Crew reassigned to Floor 16.',
    assigned_to: 'Mike Chen (Suffolk)', created: '2026-03-29', acknowledged: '2026-03-29' },

  // Open (no response yet)
  { delay_index: 6, status: 'open',
    action: null,
    assigned_to: null, created: '2026-03-31' },

  // Acknowledged but not started
  { delay_index: 7, status: 'acknowledged',
    action: 'WP crew adding workers. Estimated 2 more days.',
    assigned_to: 'Tom Garcia (WP Sub)', created: '2026-03-30', acknowledged: '2026-03-31' },
];
```

---

## PART 4: Legal Documents (NODs sent, receipts tracked)

Create legal docs for the delays that warranted formal notices:

```typescript
const LEGAL_DOCS = [
  // NOD sent and acknowledged (resolved delay)
  {
    type: 'nod',
    delay_index: 3, // marble delay
    status: 'sent',
    sent_at: '2026-02-26T14:30:00Z',
    receipt_opened_at: '2026-02-26T16:45:00Z',
    receipt_open_count: 3,
    sha256_hash: 'a3f8c2d1e4b7a9f0c3d6e8b2a5f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5',
  },
  // NOD sent, GC opened but no response (48h+ passed)
  {
    type: 'nod',
    delay_index: 5, // heat failure — active
    status: 'sent',
    sent_at: '2026-03-29T15:00:00Z',
    receipt_opened_at: '2026-03-29T17:22:00Z',
    receipt_open_count: 2,
    sha256_hash: 'b4e9d3f2a5c8b1e0d4f7a3c6b9e2d5f8a1c4b7e0d3f6a9c2e5b8d1f4a7c0b3e6',
  },
  // NOD draft pending (just created)
  {
    type: 'nod',
    delay_index: 7, // tile waiting on WP — active
    status: 'draft',
    sent_at: null,
    receipt_opened_at: null,
    sha256_hash: null,
  },
  // REA generated (for the marble delay — cumulative > $5K)
  {
    type: 'rea',
    delay_index: 3,
    status: 'sent',
    sent_at: '2026-03-01T10:00:00Z',
    receipt_opened_at: '2026-03-01T11:15:00Z',
    receipt_open_count: 5,
    sha256_hash: 'c5f0e4d3b6a9c2f5e8d1b4a7f0c3e6d9b2a5f8c1e4d7b0a3f6c9e2d5b8a1f4c7',
    total_claim_amount: 16600, // 4 days × $4150/day
  },
];
```

---

## PART 5: Forecast Snapshots (historical trend)

Create weekly forecast snapshots going back 3 months so the trend line has data:

```typescript
const FORECAST_SNAPSHOTS = [];
const snapshotDate = new Date('2026-01-12'); // first snapshot, 1 week after start

while (snapshotDate <= TODAY) {
  const weekNum = getWeekNumber(snapshotDate);
  const overallPct = calculateProjectPctAtDate(snapshotDate); // based on the field reports
  
  FORECAST_SNAPSHOTS.push({
    project_id: projectId,
    snapshot_date: snapshotDate.toISOString(),
    overall_pct: overallPct,
    projected_completion: calculateProjectedCompletion(overallPct, snapshotDate),
    p6_scheduled_completion: '2026-09-15', // original schedule
    delta_days: daysBetween(calculateProjectedCompletion(overallPct, snapshotDate), '2026-09-15'),
    active_delays: getActiveDelayCountAtDate(snapshotDate),
    total_delay_cost: getCumulativeDelayCostAtDate(snapshotDate),
  });
  
  snapshotDate.setDate(snapshotDate.getDate() + 7); // weekly snapshots
}

// Expected trend: 
// Jan: 2% → 5% → 8% (slow start, mobilization)
// Feb: 12% → 16% → 20% → 24% (steady progress)
// Mar: 25% → 28% → 30% → 32% (some delays slowed things)
// Current: ~33% complete, projected finish Sept 21 vs scheduled Sept 15 = +6 days behind
```

---

## PART 6: Verification History

Create GC verification events (approved, corrected, pending):

```typescript
const VERIFICATIONS = [
  // Approved verifications (past)
  ...generateVerifications('approved', 40, {
    dateRange: ['2026-01-15', '2026-03-25'],
    floors: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    trades: ['Rough Plumbing', 'Metal Stud Framing', 'MEP Rough-In', 'Waterproofing'],
  }),
  
  // Corrected (GC found issues)
  ...generateVerifications('corrected', 8, {
    dateRange: ['2026-02-01', '2026-03-20'],
    floors: [6, 7, 8, 9],
    trades: ['Waterproofing', 'Fire Stopping'],
    correctionReasons: ['incomplete_coverage', 'failed_test', 'wrong_material'],
  }),

  // Pending (waiting for GC)
  ...generateVerifications('pending', 6, {
    dateRange: ['2026-03-28', 'today'],
    floors: [12, 13, 14],
    trades: ['Insulation & Drywall', 'Waterproofing', 'Fire Stopping'],
  }),
];
```

---

## PART 7: Team Members (demo users)

Create realistic team members:

```typescript
const DEMO_TEAM = [
  // GC side
  { name: 'Juan Restrepo', email: 'demo-gc@readyboard.ai', role: 'gc_admin', trade: null },
  { name: 'Mike Chen', email: 'mike@demo.readyboard.ai', role: 'gc_pm', trade: null },
  { name: 'Sarah Johnson', email: 'sarah@demo.readyboard.ai', role: 'gc_super', trade: null },
  
  // Sub side — Tile/Stone (Jantile)
  { name: 'Sal Moretti', email: 'sal@demo.readyboard.ai', role: 'sub_pm', trade: 'Tile / Stone' },
  { name: 'Carlos Martinez', phone: '+1-212-555-0101', role: 'foreman', trade: 'Tile / Stone' },
  { name: 'Mario Gutierrez', phone: '+1-212-555-0102', role: 'foreman', trade: 'Tile / Stone' },
  
  // Sub side — Waterproofing
  { name: 'Tom Garcia', email: 'tom@demo.readyboard.ai', role: 'sub_pm', trade: 'Waterproofing' },
  { name: 'Pedro Sanchez', phone: '+1-212-555-0201', role: 'foreman', trade: 'Waterproofing' },
  
  // Sub side — Drywall
  { name: 'James Wilson', email: 'james@demo.readyboard.ai', role: 'sub_pm', trade: 'Insulation & Drywall' },
  { name: 'Roberto Diaz', phone: '+1-212-555-0301', role: 'foreman', trade: 'Insulation & Drywall' },
];
```

---

## PART 8: What Each Page Should Show After Seeding

### Overview
- Project: 33% complete
- On Track: 18 floors | Attention: 4 floors | Action Required: 3 floors
- Delay Cost: $50,406 cumulative | $6,660/day currently
- 3 active alerts ranked by cost of inaction
- Forecast: scheduled Sept 15, projected Sept 21, +6 days behind
- Morning Briefing card (hardcoded for demo)

### Ready Board
- Bottom floors (2-8): mostly green/blue (done/in-progress)
- Middle floors (9-22): mix of green, blue, amber, some red
- Upper floors (23-35): gray with some green on first trades
- Top floors (36-40): all gray (not started)
- Collapsible Floor → Unit → Area hierarchy

### Delays & Costs
- 8 total delays (5 resolved, 3 active)
- Active delays: $6,660/day combined
- Cumulative: $50K+
- GPS verified, some with photos
- "Generate NOD" buttons on active delays

### Legal Docs
- 2 NODs sent (1 with receipt opened, 1 with 48h no-response alert)
- 1 NOD draft pending
- 1 REA sent ($16,600 claim)
- Receipt tracking showing timestamps

### Forecast
- 12 weekly snapshots showing upward trend
- Schedule delta: +6 days behind
- At-risk areas: Floor 18 (heat), Floor 20 (material)
- Projected completion line vs P6 baseline

### Corrective Actions
- Kanban view: 1 open, 1 acknowledged, 1 in-progress, 3 resolved
- Response time metrics visible

### Verifications
- 6 pending (badge shows on sidebar)
- 8 corrected in history
- 40 approved in history

### Team
- 10 members across 3 subs + GC
- Mix of roles: gc_admin, gc_pm, gc_super, sub_pm, foreman
- Each with trade assignment

---

## Implementation

Create this as `scripts/seed-demo-full.ts` — idempotent (can re-run safely).
Clear existing demo data first, then insert fresh.
Use realistic timestamps spread across the 3-month period.
All dates should be work days (Mon-Fri).
Randomize times between 6:30am-4:00pm for field reports.

Run with: `npx tsx scripts/seed-demo-full.ts`

**This is the single most impactful thing for the demo.** When the PM opens the dashboard and sees 3 months of real-looking data with active delays, cost trends, and legal docs — that's when they say "I need this."
