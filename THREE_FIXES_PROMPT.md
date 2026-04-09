# 3 Fixes — Run with Sonnet

## Fix 1: area_code in expanded grid rows (1 hour)

### Problem
The area_code shows on collapsed unit preview but NOT in expanded area rows. When the GC expands a unit and sees the individual areas, there's no area_code visible.

### Fix
Find the component that renders individual area rows in the Ready Board grid (likely in the Ready Board page component or a GridRow/AreaRow sub-component).

Add the area_code display BEFORE the area name:

```tsx
{/* In the area row — where it currently shows just the area name */}
<td className="pl-16">
  {area.area_code && (
    <span className="font-mono text-[11px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded mr-2">
      {area.area_code}
    </span>
  )}
  <span className="font-medium">{area.name}</span>
  {area.description && (
    <span className="text-xs text-white/30 ml-2">· {area.description}</span>
  )}
</td>
```

Search for: the component rendering area rows inside the Ready Board grid. Look for where `area.name` is displayed in a table row under an expanded unit. The area_code should appear as a monospace badge to the left of the name.

Also verify: the area_code shows in the detail panel (the right-side panel that opens when clicking a cell). If not, add it there too.

---

## Fix 2: calculateDelayCost with per-trade rates (3 hours)

### Problem
The Delays & Costs page and delay cost calculations still use the flat `projects.labor_rate_per_hour` instead of the per-trade rates from the `labor_rates` table. The `labor_rates` table IS populated (56 rates seeded), the Settings UI shows the rate matrix, but the actual cost calculation doesn't use it.

### Step 1: Create the calculation function

Create `src/lib/costs/calculateDelayCost.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

interface CrewMember {
  role: string;
  count: number;
  rate: number;
  hours: number;
  subtotal: number;
}

interface DelayCostResult {
  dailyCost: number;
  straightTimeCost: number;
  overtimeCost: number;
  breakdown: CrewMember[];
  hoursPerDay: number;
}

export async function calculateDelayCost(
  projectId: string,
  tradeName: string,
  hoursBlocked?: number
): Promise<DelayCostResult> {
  const supabase = await createClient();

  // 1. Get rates for this trade from labor_rates table
  const { data: rates } = await supabase
    .from('labor_rates')
    .select('role, hourly_rate')
    .eq('project_id', projectId)
    .eq('trade_name', tradeName);

  // 2. Get OT config + typical crew from trade_sequences
  // NOTE: the column might be trade_name or trade_type — check the actual schema
  const { data: tradeConfig } = await supabase
    .from('trade_sequences')
    .select('straight_time_hours, ot_multiplier, typical_crew')
    .eq('project_id', projectId)
    .or(`trade_name.eq.${tradeName},trade_type.eq.${tradeName}`)
    .single();

  // 3. Fallback to project default if no specific rates
  if (!rates || rates.length === 0) {
    const { data: project } = await supabase
      .from('projects')
      .select('labor_rate_per_hour')
      .eq('id', projectId)
      .single();

    const fallbackRate = project?.labor_rate_per_hour || 100;
    const defaultHours = 8;
    const hrs = hoursBlocked || defaultHours;

    return {
      dailyCost: Math.round(4 * fallbackRate * hrs),
      straightTimeCost: Math.round(4 * fallbackRate * hrs),
      overtimeCost: 0,
      breakdown: [{ role: 'worker', count: 4, rate: fallbackRate, hours: hrs, subtotal: 4 * fallbackRate * hrs }],
      hoursPerDay: defaultHours,
    };
  }

  // 4. Build crew from typical_crew config
  const stHours = tradeConfig?.straight_time_hours || 8;
  const otMultiplier = tradeConfig?.ot_multiplier || 1.5;
  const crew = tradeConfig?.typical_crew || { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 };
  const hrs = hoursBlocked || stHours;

  // 5. Calculate per-role cost
  const breakdown: CrewMember[] = Object.entries(crew as Record<string, number>)
    .filter(([_, count]) => count > 0)
    .map(([role, count]) => {
      const rateRecord = rates.find(r => r.role === role);
      const rate = rateRecord?.hourly_rate || 0;

      const stHrs = Math.min(hrs, stHours);
      const otHrs = Math.max(0, hrs - stHours);

      const stCost = count * rate * stHrs;
      const otCost = count * rate * otMultiplier * otHrs;

      return {
        role,
        count,
        rate,
        hours: hrs,
        subtotal: Math.round(stCost + otCost),
      };
    });

  const totalCost = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const stTotal = breakdown.reduce((sum, b) => {
    const stHrs = Math.min(hrs, stHours);
    return sum + b.count * b.rate * stHrs;
  }, 0);

  return {
    dailyCost: Math.round(totalCost),
    straightTimeCost: Math.round(stTotal),
    overtimeCost: Math.round(totalCost - stTotal),
    breakdown,
    hoursPerDay: stHours,
  };
}
```

### Step 2: Find and replace all usages of flat rate

Search the codebase for:
- `labor_rate_per_hour`
- `laborRate`
- `daily_cost` calculations
- Any place that multiplies crew × rate × hours

Replace with calls to `calculateDelayCost()`. Key files to update:

1. **Delays & Costs page** — the data fetching function that calculates daily_cost and cumulative_cost per delay row
2. **Overview page** — the alerts section that shows $/day per alert
3. **NOD generation** — `nodAutoGen.ts` or wherever the NOD PDF cost table is built
4. **REA generation** — cumulative cost calculation
5. **delay_logs** — if daily_cost is stored on insert, update the insert logic

### Step 3: Update the Delays & Costs display

The Delays & Costs page currently shows "Daily Cost: $X" per row. After the fix, it should show the correct per-trade cost. If possible, add a tooltip or expandable row showing the breakdown:

```
Tile / Stone — Floor 18, Unit A, Master Bath
Daily Cost: $4,116/day (1 foreman $117 + 3 JP $107 + 1 apprentice $64 + 1 finisher $86 × 7h)
```

At minimum, just make sure the dollar amounts are correct. The detailed breakdown tooltip is nice-to-have.

---

## Fix 3: GC Checklist Visibility in Ready Board (2 hours)

### Problem
When the GC clicks a cell in the Ready Board grid, the detail panel on the right shows:
- Trade name
- Status (RDY — 0%)
- Sequence position (Trade #1 of 14)
- Gates info

But it does NOT show the actual checklist tasks. The GC can't see what the foreman has completed or what GC VERIFY tasks are pending without going to the Verifications page.

### Fix: Add checklist view to the grid detail panel

Find the component that renders when a cell is clicked in the Ready Board (likely called `GridDetailPanel`, `AreaTradeDetail`, or similar — it's the right-side panel visible in the screenshot).

Add a checklist section below the existing status info:

```tsx
{/* Existing content: trade name, status, sequence, gates */}

{/* NEW: Checklist tasks for this area × trade */}
<div className="mt-4 border-t border-white/10 pt-4">
  <h4 className="text-xs text-muted uppercase tracking-wide mb-3">
    Tasks ({completedCount}/{totalCount})
  </h4>

  {/* Progress bar */}
  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
    <div
      className="h-full rounded-full transition-all"
      style={{
        width: `${(completedCount / totalCount) * 100}%`,
        backgroundColor: completedCount === totalCount ? '#4ade80' : '#60a5fa',
      }}
    />
  </div>

  {/* Task list */}
  <div className="space-y-1 max-h-64 overflow-y-auto">
    {tasks.map(task => (
      <div
        key={task.id}
        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
          task.status === 'completed' ? 'text-white/40' : 'text-white/80'
        }`}
      >
        {/* Checkbox icon (read-only for GC) */}
        <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
          task.status === 'completed'
            ? 'bg-green-500/20 border-green-500 text-green-400'
            : task.task_owner === 'gc'
              ? 'bg-purple-500/20 border-purple-500'
              : 'border-white/20'
        }`}>
          {task.status === 'completed' && '✓'}
        </span>

        {/* Task name */}
        <span className={task.status === 'completed' ? 'line-through' : ''}>
          {task.task_name_en}
        </span>

        {/* Badges */}
        {task.is_gate && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
            GATE
          </span>
        )}
        {task.task_owner === 'gc' && task.status !== 'completed' && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">
            GC VERIFY
          </span>
        )}
      </div>
    ))}
  </div>

  {/* If there are pending GC VERIFY tasks, show action button */}
  {pendingGCTasks.length > 0 && (
    <button
      onClick={() => router.push('/dashboard/verifications')}
      className="mt-3 w-full py-2 text-xs font-bold text-purple-400 bg-purple-500/10 
                 border border-purple-500/30 rounded-lg hover:bg-purple-500/20"
    >
      {pendingGCTasks.length} verification{pendingGCTasks.length > 1 ? 's' : ''} pending →
    </button>
  )}
</div>
```

### Data query for tasks

The detail panel needs to fetch `area_tasks` for the selected area × trade:

```typescript
const { data: tasks } = await supabase
  .from('area_tasks')
  .select('*')
  .eq('area_id', selectedArea.id)
  .eq('trade_type', selectedTrade)  // NOTE: column might be trade_type not trade_name
  .order('task_order', { ascending: true });

const completedCount = tasks?.filter(t => t.status === 'completed').length || 0;
const totalCount = tasks?.length || 0;
const pendingGCTasks = tasks?.filter(t => t.task_owner === 'gc' && t.status !== 'completed') || [];
```

### What the GC sees

After this fix, clicking any cell in the Ready Board shows:
- Trade name + status + sequence position (existing)
- **Task checklist with progress bar** (NEW)
- Each task: checkbox icon, name, GATE badge, GC VERIFY badge
- Completed tasks greyed out with strikethrough
- GC VERIFY tasks highlighted in purple
- "X verifications pending →" button linking to Verifications page

The GC can SEE all tasks but can only ACT on GC VERIFY tasks (through the Verifications page). Sub tasks are read-only for the GC — they see the status but can't change it.

---

## Run order

1. Fix 1 (area_code) — 30 min
2. Fix 3 (checklist in detail panel) — 2 hrs
3. Fix 2 (calculateDelayCost) — 3 hrs
4. Run `npx tsc --noEmit` and `npm run build` after each fix

All 3 fixes are safe for Sonnet — they're isolated changes with clear specs.
