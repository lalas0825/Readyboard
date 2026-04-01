# Labor Rate Restructuring — Editable Rates + OT Rules + Crew Composition

## Context

Currently there's a single `labor_rate_per_hour` field on the `projects` table ($85/hr for everything). 
This is wrong. In reality:
1. Each trade has different rates
2. Each role within a trade (foreman, journeyperson, apprentice, helper) has a different rate
3. Overtime threshold varies by contract — some trades work 7hr straight time, some 8hr
4. Saturday/Sunday/holiday rules vary by trade and contract
5. All of this must be EDITABLE — the GC enters their actual subcontract rates

Source: NYC Comptroller Prevailing Wage Schedule 2025-2026 (see LABOR_RATES_RESEARCH.md for full data).

---

## PART 1: Database Changes

### New table: `labor_rates`

```sql
CREATE TABLE labor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  trade_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'journeyperson'
    CHECK (role IN ('foreman', 'journeyperson', 'apprentice', 'helper', 'finisher', 'tender')),
  hourly_rate NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, trade_name, role)
);

CREATE INDEX idx_labor_rates_project ON labor_rates(project_id);
CREATE INDEX idx_labor_rates_trade ON labor_rates(project_id, trade_name);
ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labor rates for their projects" ON labor_rates
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "GC admins can manage labor rates" ON labor_rates
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = auth.uid() AND om.role IN ('gc_admin', 'gc_pm')
    )
  );
```

### Alter `trade_sequences` — add OT rules + crew composition

```sql
ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS 
  straight_time_hours NUMERIC(4,1) DEFAULT 8.0;

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS 
  ot_multiplier NUMERIC(4,2) DEFAULT 1.5;

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS 
  dt_multiplier NUMERIC(4,2) DEFAULT 2.0;

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS 
  saturday_rule TEXT DEFAULT 'ot' 
    CHECK (saturday_rule IN ('ot', 'straight_makeup', 'double'));

ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS
  typical_crew JSONB DEFAULT '{"foreman": 1, "journeyperson": 3, "apprentice": 1, "helper": 0}';
```

### Keep `projects.labor_rate_per_hour` as fallback

Do NOT remove this field. It becomes the fallback when specific trade/role rates don't exist. 
Existing projects still work. But the onboarding wizard no longer asks for it.

---

## PART 2: Default Rate Seeds

When a project is created with trade sequences, auto-seed default NYC union rates.
These are LOADED rates (base wage + benefits/supplements) based on NYC Comptroller 2025-2026 data.

```typescript
interface TradeRateDefaults {
  foreman: number;
  journeyperson: number;
  apprentice: number;
  helper: number;
  straight_time_hours: number;
  ot_multiplier: number;
  dt_multiplier: number;
  saturday_rule: 'ot' | 'straight_makeup' | 'double';
  typical_crew: { foreman: number; journeyperson: number; apprentice: number; helper: number };
}

const NYC_UNION_DEFAULTS: Record<string, TradeRateDefaults> = {
  'Rough Plumbing': {
    foreman: 140, journeyperson: 127, apprentice: 76, helper: 55,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 },
  },
  'Metal Stud Framing': {
    foreman: 119, journeyperson: 108, apprentice: 65, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'straight_makeup',
    typical_crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  'MEP Rough-In': {
    foreman: 135, journeyperson: 123, apprentice: 74, helper: 53,
    straight_time_hours: 7, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 },
  },
  'Fire Stopping': {
    foreman: 111, journeyperson: 101, apprentice: 61, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 0, helper: 1 },
  },
  'Insulation & Drywall': {
    foreman: 119, journeyperson: 108, apprentice: 65, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'straight_makeup',
    typical_crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  'Waterproofing': {
    foreman: 107, journeyperson: 98, apprentice: 59, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 0, helper: 1 },
  },
  'Tile / Stone': {
    foreman: 117, journeyperson: 107, apprentice: 64, helper: 86,
    // NOTE: helper rate for Tile is $86 (Tile Finisher) — higher than typical helpers
    // because Tile Finisher is a separate skilled classification, not a general laborer
    straight_time_hours: 7, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 1 },
  },
  'Paint': {
    foreman: 105, journeyperson: 95, apprentice: 57, helper: 45,
    straight_time_hours: 7, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 },
  },
  'Ceiling Grid / ACT': {
    foreman: 119, journeyperson: 108, apprentice: 65, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'straight_makeup',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 },
  },
  'MEP Trim-Out': {
    foreman: 135, journeyperson: 123, apprentice: 74, helper: 53,
    straight_time_hours: 7, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 },
  },
  'Doors & Hardware': {
    foreman: 119, journeyperson: 108, apprentice: 65, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'straight_makeup',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 0, helper: 1 },
  },
  'Millwork & Countertops': {
    foreman: 122, journeyperson: 111, apprentice: 67, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'straight_makeup',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 },
  },
  'Flooring': {
    foreman: 99, journeyperson: 90, apprentice: 54, helper: 42,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 },
  },
  'Final Clean & Punch': {
    foreman: 111, journeyperson: 101, apprentice: 61, helper: 48,
    straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2.0,
    saturday_rule: 'ot',
    typical_crew: { foreman: 1, journeyperson: 2, apprentice: 0, helper: 2 },
  },
};
```

### Seed function — called after trade_sequences are created

```typescript
async function seedLaborRates(projectId: string, tradeSequences: TradeSequence[]) {
  for (const trade of tradeSequences) {
    const defaults = NYC_UNION_DEFAULTS[trade.trade_name];
    if (!defaults) continue;

    // Update trade_sequences with OT rules + crew
    await supabase.from('trade_sequences').update({
      straight_time_hours: defaults.straight_time_hours,
      ot_multiplier: defaults.ot_multiplier,
      dt_multiplier: defaults.dt_multiplier,
      saturday_rule: defaults.saturday_rule,
      typical_crew: defaults.typical_crew,
    }).eq('id', trade.id);

    // Insert labor rates for each role
    const roles = [
      { role: 'foreman', hourly_rate: defaults.foreman },
      { role: 'journeyperson', hourly_rate: defaults.journeyperson },
      { role: 'apprentice', hourly_rate: defaults.apprentice },
      { role: 'helper', hourly_rate: defaults.helper },
    ];

    await supabase.from('labor_rates').upsert(
      roles.map(r => ({
        project_id: projectId,
        trade_name: trade.trade_name,
        ...r,
      })),
      { onConflict: 'project_id,trade_name,role' }
    );
  }
}
```

---

## PART 3: Onboarding Changes

### Step 2 (Project Setup) — remove single rate field

Remove the "Labor Rate ($/hr)" input field. Replace with:

```tsx
<div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
  <p className="text-sm text-muted">
    💰 Labor rates will be configured per trade after setup. 
    NYC union prevailing wage defaults will be applied — you can edit them anytime in Settings.
  </p>
</div>
```

Default `projects.labor_rate_per_hour` to $100 (safe average fallback), but don't show the field.

---

## PART 4: Settings → Trades & Costs — Full Rate Matrix UI

The existing "Trades & Costs" tab in Settings currently shows the 14 trades with checklist/percentage toggle.
Below the existing content, add TWO new sections:

### Section A: Overtime & Hours Configuration (per trade)

```tsx
<div className="mt-8">
  <h3 className="text-lg font-bold mb-1">Work Hours & Overtime Rules</h3>
  <p className="text-xs text-muted mb-4">
    Configure straight time hours and overtime multipliers per trade. 
    These vary by contract — edit to match your subcontract terms.
  </p>

  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-white/10 text-xs text-muted">
        <th className="text-left py-2 pr-4">Trade</th>
        <th className="text-center py-2 px-2">ST Hours/Day</th>
        <th className="text-center py-2 px-2">OT After</th>
        <th className="text-center py-2 px-2">OT Rate</th>
        <th className="text-center py-2 px-2">DT Rate</th>
        <th className="text-center py-2 px-2">Saturday</th>
      </tr>
    </thead>
    <tbody>
      {trades.map(trade => (
        <tr key={trade.id} className="border-b border-white/5">
          <td className="py-2 pr-4 font-medium text-sm">{trade.trade_name}</td>
          <td className="py-2 px-2 text-center">
            <input
              type="number"
              value={trade.straight_time_hours}
              onChange={e => updateTradeHours(trade.id, 'straight_time_hours', e.target.value)}
              className="w-14 text-center bg-transparent border-b border-white/10 
                         focus:border-amber-500 outline-none"
              step="0.5"
              min="4"
              max="12"
            />
          </td>
          <td className="py-2 px-2 text-center text-xs text-muted">
            {trade.straight_time_hours}h
          </td>
          <td className="py-2 px-2 text-center">
            <input
              type="number"
              value={trade.ot_multiplier}
              onChange={e => updateTradeHours(trade.id, 'ot_multiplier', e.target.value)}
              className="w-14 text-center bg-transparent border-b border-white/10 
                         focus:border-amber-500 outline-none"
              step="0.1"
              min="1"
              max="3"
            />
            <span className="text-xs text-muted ml-1">×</span>
          </td>
          <td className="py-2 px-2 text-center">
            <input
              type="number"
              value={trade.dt_multiplier}
              onChange={e => updateTradeHours(trade.id, 'dt_multiplier', e.target.value)}
              className="w-14 text-center bg-transparent border-b border-white/10 
                         focus:border-amber-500 outline-none"
              step="0.1"
              min="1"
              max="4"
            />
            <span className="text-xs text-muted ml-1">×</span>
          </td>
          <td className="py-2 px-2 text-center">
            <select
              value={trade.saturday_rule}
              onChange={e => updateTradeHours(trade.id, 'saturday_rule', e.target.value)}
              className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs
                         focus:border-amber-500 outline-none"
            >
              <option value="ot">OT (1.5×)</option>
              <option value="straight_makeup">Straight (make-up)</option>
              <option value="double">Double (2×)</option>
            </select>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Section B: Labor Rates Matrix (per trade × role)

```tsx
<div className="mt-8">
  <h3 className="text-lg font-bold mb-1">Labor Rates by Trade</h3>
  <p className="text-xs text-muted mb-4">
    Loaded rates (wage + benefits) used to calculate delay costs in NODs, REAs, and dashboards. 
    Edit to match your subcontract rates. Defaults are NYC union prevailing wage 2025-2026.
  </p>

  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-white/10 text-xs text-muted">
        <th className="text-left py-2 pr-4">Trade</th>
        <th className="text-right py-2 px-2">Foreman</th>
        <th className="text-right py-2 px-2">Journeyperson</th>
        <th className="text-right py-2 px-2">Apprentice</th>
        <th className="text-right py-2 px-2">Helper</th>
        <th className="text-right py-2 px-2">Daily Cost</th>
      </tr>
    </thead>
    <tbody>
      {trades.map(trade => {
        const rates = getRatesForTrade(trade.trade_name);
        const crew = trade.typical_crew || { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 };
        const dailyCost = calculateDailyCost(rates, crew, trade.straight_time_hours);

        return (
          <React.Fragment key={trade.id}>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-medium">{trade.trade_name}</td>
              {['foreman', 'journeyperson', 'apprentice', 'helper'].map(role => (
                <td key={role} className="py-2 px-2">
                  <div className="flex items-center justify-end">
                    <span className="text-muted mr-1 text-xs">$</span>
                    <input
                      type="number"
                      value={rates[role] || ''}
                      onChange={e => updateRate(trade.trade_name, role, e.target.value)}
                      className="w-16 text-right bg-transparent border-b border-white/10 
                                 focus:border-amber-500 outline-none"
                      step="1"
                      min="0"
                      placeholder="—"
                    />
                  </div>
                </td>
              ))}
              <td className="py-2 px-2 text-right font-mono text-amber-400 text-xs">
                ${dailyCost.toLocaleString()}/day
              </td>
            </tr>
            {/* Expandable crew composition row */}
            <tr className="border-b border-white/5">
              <td colSpan={6} className="py-1 pl-8">
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>Typical crew:</span>
                  {['foreman', 'journeyperson', 'apprentice', 'helper'].map(role => (
                    <div key={role} className="flex items-center gap-1">
                      <input
                        type="number"
                        value={crew[role] || 0}
                        onChange={e => updateCrew(trade.id, role, parseInt(e.target.value))}
                        className="w-8 text-center bg-transparent border-b border-white/10 
                                   focus:border-amber-500 outline-none text-xs"
                        min="0"
                        max="20"
                      />
                      <span className="capitalize">{role === 'journeyperson' ? 'JP' : role.slice(0, 4)}</span>
                    </div>
                  ))}
                  <span className="ml-2 text-white/30">
                    = {Object.values(crew).reduce((s, n) => s + n, 0)} workers
                  </span>
                </div>
              </td>
            </tr>
          </React.Fragment>
        );
      })}
    </tbody>
  </table>

  <div className="flex gap-3 mt-4">
    <button onClick={saveAll} className="px-4 py-2 bg-amber-500 text-black rounded font-bold text-sm">
      Save Changes
    </button>
    <button onClick={resetToNYCDefaults} className="px-4 py-2 border border-white/20 rounded text-sm text-muted">
      Reset to NYC Union Defaults
    </button>
    <button onClick={applyNonUnionDiscount} className="px-4 py-2 border border-white/20 rounded text-sm text-muted">
      Apply Non-Union (-25%)
    </button>
  </div>
</div>
```

### Daily cost calculation (shown in the last column)

```typescript
function calculateDailyCost(
  rates: Record<string, number>,
  crew: Record<string, number>,
  straightTimeHours: number
): number {
  let total = 0;
  for (const [role, count] of Object.entries(crew)) {
    const rate = rates[role] || 0;
    total += count * rate * straightTimeHours;
  }
  return Math.round(total);
}

// Example: Tile / Stone
// 1 foreman ($117) + 3 JP ($107) + 1 apprentice ($64) + 1 finisher ($86) = 6 workers
// Daily: (117 + 321 + 64 + 86) × 7hrs = $4,116/day
```

---

## PART 5: Update Delay Cost Calculations — ALL locations

### New calculation function

```typescript
async function calculateDelayCost(
  projectId: string,
  tradeName: string,
  hoursBlocked: number
): Promise<{
  dailyCost: number;
  straightTimeCost: number;
  otCost: number;
  breakdown: { role: string; count: number; rate: number; hours: number; subtotal: number }[];
}> {
  // 1. Get rates for this trade
  const { data: rates } = await supabase
    .from('labor_rates')
    .select('role, hourly_rate')
    .eq('project_id', projectId)
    .eq('trade_name', tradeName);

  // 2. Get OT config for this trade
  const { data: trade } = await supabase
    .from('trade_sequences')
    .select('straight_time_hours, ot_multiplier, typical_crew')
    .eq('project_id', projectId)
    .eq('trade_name', tradeName)
    .single();

  // 3. Fallback to project default if no specific rates
  if (!rates?.length) {
    const { data: project } = await supabase
      .from('projects')
      .select('labor_rate_per_hour')
      .eq('id', projectId)
      .single();
    const fallbackRate = project?.labor_rate_per_hour || 100;
    return {
      dailyCost: 4 * fallbackRate * hoursBlocked, // assume 4-person crew
      straightTimeCost: 4 * fallbackRate * hoursBlocked,
      otCost: 0,
      breakdown: [{ role: 'worker', count: 4, rate: fallbackRate, hours: hoursBlocked, subtotal: 4 * fallbackRate * hoursBlocked }],
    };
  }

  const stHours = trade?.straight_time_hours || 8;
  const otMultiplier = trade?.ot_multiplier || 1.5;
  const crew = trade?.typical_crew || { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 };

  // 4. Calculate per-role cost
  const breakdown = Object.entries(crew)
    .filter(([_, count]) => count > 0)
    .map(([role, count]) => {
      const rateRecord = rates.find(r => r.role === role);
      const rate = rateRecord?.hourly_rate || 0;

      // Split hours into straight time and OT
      const stHrs = Math.min(hoursBlocked, stHours);
      const otHrs = Math.max(0, hoursBlocked - stHours);

      const stCost = count * rate * stHrs;
      const otCost = count * rate * otMultiplier * otHrs;

      return {
        role,
        count,
        rate,
        hours: hoursBlocked,
        subtotal: stCost + otCost,
      };
    });

  const totalCost = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const stTotal = breakdown.reduce((sum, b) => sum + b.count * b.rate * Math.min(hoursBlocked, stHours), 0);
  const otTotal = totalCost - stTotal;

  return {
    dailyCost: Math.round(totalCost),
    straightTimeCost: Math.round(stTotal),
    otCost: Math.round(otTotal),
    breakdown,
  };
}
```

### Update ALL places that calculate delay costs:

Search the codebase for usages of `labor_rate_per_hour` or any delay cost calculation. 
Replace with calls to `calculateDelayCost()`. Specifically update:

1. **Delays & Costs page** — "Daily Cost" and "Cumulative" columns per delay row
2. **Overview page** — alerts section, "$/day" cost of inaction per alert
3. **NOD PDF generation** — itemized cost table must show role-by-role breakdown
4. **REA PDF generation** — cumulative cost calculation with breakdown
5. **Evidence Package** — financial summary section
6. **Forecast engine** — projected cost impact of delays
7. **1-Screen Dashboard demo** — if using real data, must use real rates

### NOD PDF cost table format (updated)

The NOD currently shows a simple "X workers × $85/hr × Y hours = $Z". 
Replace with an itemized breakdown:

```
DAILY DELAY COST CALCULATION
Trade: Tile / Stone
Straight Time: 7 hours/day | OT After: 7 hours | OT Rate: 1.5×

Role              Count   Rate      Hours   Subtotal
─────────────────────────────────────────────────────
Foreman           1       $117.00   7.0     $819.00
Journeyperson     3       $107.00   7.0     $2,247.00
Apprentice        1       $64.00    7.0     $448.00
Tile Finisher     1       $86.00    7.0     $602.00
─────────────────────────────────────────────────────
TOTAL (6 workers)                           $4,116.00/day

Cumulative (3 days blocked): $12,348.00
```

---

## PART 6: Onboarding Wizard — Remove Labor Rate Field

### Step 2 (Project Setup)

Find the "Labor Rate ($/hr)" input field and remove it. Replace with:

```tsx
<div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
  <div className="flex items-center gap-2 mb-1">
    <span className="text-sm">💰</span>
    <span className="text-sm font-medium">Labor Rates</span>
  </div>
  <p className="text-xs text-muted">
    NYC union prevailing wage defaults will be applied per trade. 
    Edit anytime in Settings → Trades & Costs.
  </p>
</div>
```

Keep the `labor_rate_per_hour` field in the database — just set it to a default of $100 
(used as fallback only when no specific trade rates exist).

---

## PART 7: Mobile — Show Daily Cost on Blocked Areas

On the foreman's mobile app, when an area is BLOCKED, the area card should show the 
daily cost using the correct trade rates:

```tsx
{area.status === 'BLOCKED' && area.daily_cost && (
  <Text style={{ fontSize: 12, color: '#f87171', fontWeight: 700, marginTop: 4 }}>
    ${area.daily_cost.toLocaleString()}/day idle
  </Text>
)}
```

The `daily_cost` should be calculated server-side (or in a Supabase view/function) using 
the trade's rates and crew composition, NOT the flat project rate.

---

## Summary — Implementation Order

1. **Migration:** Create `labor_rates` table + ALTER `trade_sequences` with new columns
2. **Seed function:** `seedLaborRates()` called after trade sequences are created in onboarding
3. **Update seed-demo.ts:** Seed realistic rates for 383 Madison demo project
4. **Settings UI:** Add "Work Hours & Overtime Rules" + "Labor Rates by Trade" sections
5. **Onboarding:** Remove single rate field, add info note about defaults
6. **Cost calculation:** Create `calculateDelayCost()` function
7. **Update all cost displays:** Delays page, Overview alerts, NOD/REA PDFs, Evidence Package, Forecast
8. **Mobile:** Show per-trade daily cost on blocked area cards
9. **Run `npx tsc --noEmit` and `npm run build`** after each step
