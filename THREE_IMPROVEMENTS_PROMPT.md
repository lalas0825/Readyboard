# 3 Improvements — GC Verify Progress + Auto Dates + Progress Photos

## Fix 1: GC Verification Tasks Excluded from Progress Percentage

### Problem
Currently, GC VERIFY tasks (like "GC Inspection — Rough Plumbing" with weight 20) count toward the progress percentage. This is wrong. The progress should reflect the SUB's work only. The GC verification is a GATE that blocks READY status, not a contributor to progress.

### Current behavior (WRONG)
```
✅ Layout & mark waste/supply lines   20pts
✅ Install waste piping & vents        25pts
☐ Install supply lines                 25pts  
☐ Pressure test                        10pts
🔒 GC Inspection — Rough plumbing      20pts  ← counting in total
─────────────────────────────────
Progress: 45/100 = 45%
```

### Correct behavior
```
✅ Layout & mark waste/supply lines   20pts
✅ Install waste piping & vents        25pts
☐ Install supply lines                 25pts  
☐ Pressure test                        10pts
─────────────────────────────────
Sub progress: 45/80 = 56%

🔒 GC Inspection — Rough plumbing     GATE
   "Awaiting GC Verification"
   (does NOT affect percentage)
```

### Implementation

#### A. Update progress calculation

Find the function that calculates effective_pct from area_tasks (likely in a trigger, RPC, or utility function). It currently sums ALL task weights. Change it to sum only SUB tasks:

```sql
-- In the trigger/function that calculates effective_pct:
-- OLD:
SELECT COALESCE(
  SUM(CASE WHEN status = 'completed' THEN weight ELSE 0 END) * 100.0 / 
  NULLIF(SUM(weight), 0), 
  0
) INTO new_pct
FROM area_tasks
WHERE area_id = p_area_id AND trade_type = p_trade_type;

-- NEW: Exclude GC tasks from percentage calculation
SELECT COALESCE(
  SUM(CASE WHEN status = 'completed' THEN weight ELSE 0 END) * 100.0 / 
  NULLIF(SUM(weight), 0), 
  0
) INTO new_pct
FROM area_tasks
WHERE area_id = p_area_id 
  AND trade_type = p_trade_type
  AND task_owner = 'sub';  -- ← ONLY count sub tasks in percentage
```

Also update in TypeScript if there's a client-side calculation:

```typescript
// Find progressCalculation.ts or wherever effective_pct is computed
const subTasks = tasks.filter(t => t.task_owner === 'sub');
const completedWeight = subTasks.filter(t => t.status === 'completed').reduce((s, t) => s + t.weight, 0);
const totalWeight = subTasks.reduce((s, t) => s + t.weight, 0);
const effectivePct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
```

#### B. Gate still blocks READY

The existing gate logic stays: even if sub is at 100%, the area does NOT become READY until ALL gate tasks (GC VERIFY) are completed. The `all_gates_passed` flag still controls this.

```
Sub at 100% + GC gate NOT passed → Status: "Complete — Awaiting Verification" (blue/purple)
Sub at 100% + GC gate passed → Status: DONE (ready for next trade)
```

#### C. Display change on mobile checklist

The checklist screen should show:
- Progress bar: based on SUB tasks only (e.g., 56% not 45%)
- Sub tasks: with checkboxes (interactive)
- GC task: visually separated, greyed out, with "Awaiting GC Verification" + "Gate — Must pass before next trade"
- NO percentage contribution shown for GC tasks (remove the weight number "20" from display, or show it separately as "Gate requirement")

```tsx
{/* Sub tasks section */}
<Text style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
  Your tasks ({completedSubCount}/{totalSubCount})
</Text>
{subTasks.map(task => <TaskCheckbox key={task.id} task={task} />)}

{/* Divider */}
<View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 }} />

{/* GC verification section — separate, not part of progress */}
<Text style={{ fontSize: 12, fontWeight: 600, color: '#c084fc', marginBottom: 8 }}>
  GC Verification Required
</Text>
{gcTasks.map(task => (
  <View key={task.id} style={{ 
    backgroundColor: 'rgba(124,58,237,0.1)', 
    borderLeftWidth: 3, borderLeftColor: '#7c3aed',
    padding: 12, borderRadius: 8, marginBottom: 8 
  }}>
    <Text style={{ color: '#c084fc', fontWeight: 600 }}>{task.task_name_en}</Text>
    <Text style={{ color: '#8b5cf6', fontSize: 12, marginTop: 4 }}>
      {task.status === 'completed' ? '✓ Verified' : 'Awaiting GC Verification'}
    </Text>
    {task.is_gate && (
      <Text style={{ color: '#f59e0b', fontSize: 11, marginTop: 2 }}>
        Gate — Must pass before next trade
      </Text>
    )}
  </View>
))}
```

#### D. Update the grid detail panel on web (from Fix 3)

Same logic: the checklist in the Ready Board detail panel should show sub tasks with percentage, and GC VERIFY tasks in a separate section.

---

## Fix 2: Auto Start Date + End Date per Area × Trade

### Problem
There's no automatic tracking of when work started and ended on each area × trade. Without this, the forecast can't calculate actual production rates.

### Implementation

#### A. Add columns to area_trade_status (if not present)

```sql
ALTER TABLE area_trade_status 
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

#### B. Auto-set started_at on first progress report

Create or update a trigger: when the FIRST field_report or area_task completion happens for an area × trade, set `started_at = now()`.

```sql
-- Trigger on field_reports INSERT
CREATE OR REPLACE FUNCTION set_trade_start_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE area_trade_status
  SET started_at = COALESCE(started_at, NEW.reported_at)
  WHERE area_id = NEW.area_id AND trade_type = NEW.trade_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_trade_start_date
  AFTER INSERT ON field_reports
  FOR EACH ROW EXECUTE FUNCTION set_trade_start_date();
```

Also trigger on area_tasks completion:

```sql
-- Trigger on area_tasks UPDATE (when status changes to 'completed')
CREATE OR REPLACE FUNCTION set_trade_start_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE area_trade_status
    SET started_at = COALESCE(started_at, now())
    WHERE area_id = NEW.area_id AND trade_type = NEW.trade_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_trade_start_on_task
  AFTER UPDATE ON area_tasks
  FOR EACH ROW EXECUTE FUNCTION set_trade_start_on_task_complete();
```

#### C. Auto-set completed_at when sub reaches 100%

When effective_pct reaches 100 (based on SUB tasks only), set `completed_at = now()`.

```sql
-- In the existing trigger that updates effective_pct:
-- After calculating new_pct...
IF new_pct >= 100 THEN
  UPDATE area_trade_status
  SET completed_at = COALESCE(completed_at, now()),
      effective_pct = 100
  WHERE area_id = p_area_id AND trade_type = p_trade_type;
END IF;

-- If progress goes backwards (GC correction), clear completed_at:
IF new_pct < 100 AND OLD.effective_pct >= 100 THEN
  UPDATE area_trade_status
  SET completed_at = NULL,
      effective_pct = new_pct
  WHERE area_id = p_area_id AND trade_type = p_trade_type;
END IF;
```

#### D. Feed the forecast

The forecast engine can now calculate:
- **Actual duration** = `completed_at - started_at` (in work days)
- **Actual production rate** = area sqft / actual duration
- **Comparison to benchmark** = actual rate vs expected rate
- **Projected completion** for remaining areas based on actual rates

Update the forecast data collection to query `started_at` and `completed_at`:

```typescript
// In forecast calculation
const completedAreas = await supabase
  .from('area_trade_status')
  .select('area_id, trade_type, started_at, completed_at, effective_pct')
  .eq('project_id', projectId)
  .not('completed_at', 'is', null);

const avgDaysPerArea = calculateAvgDuration(completedAreas);
const remainingAreas = totalAreas - completedAreas.length;
const projectedDaysRemaining = remainingAreas * avgDaysPerArea;
```

#### E. Display in grid detail panel

Show start/end dates in the Ready Board detail panel:

```tsx
{tradeStatus.started_at && (
  <div className="text-xs text-muted mt-2">
    Started: {formatDate(tradeStatus.started_at)}
    {tradeStatus.completed_at && (
      <> · Completed: {formatDate(tradeStatus.completed_at)}
        · Duration: {workDaysBetween(tradeStatus.started_at, tradeStatus.completed_at)} days
      </>
    )}
  </div>
)}
```

---

## Fix 3: Optional Progress Photos (not just blockers)

### Problem
Currently the camera only appears in the blocker reporting flow. Foremen should be able to take progress photos at any time — documenting work done, not just problems. This is valuable for evidence packages, GC verification, and disputes.

### Key rule: OPTIONAL, never blocking
If the foreman doesn't want to take a photo, the report still submits. No friction.

### Implementation

#### A. Add camera icon to each checklist task

In the TaskChecklist component on mobile, add a small camera icon on each task row:

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
  {/* Existing checkbox + task name */}
  <Pressable onPress={() => toggleTask(task.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
    <Checkbox checked={task.status === 'completed'} />
    <Text style={{ marginLeft: 12, fontSize: 16 }}>{task.task_name_en}</Text>
  </Pressable>
  
  {/* Camera icon — always visible, optional */}
  <Pressable
    onPress={() => captureTaskPhoto(task.id)}
    style={{ padding: 8 }}
  >
    <CameraIcon size={20} color={taskHasPhotos(task.id) ? '#4ade80' : '#475569'} />
    {taskPhotoCount(task.id) > 0 && (
      <View style={{
        position: 'absolute', top: 2, right: 2,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#4ade80',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 9, color: '#000', fontWeight: 700 }}>
          {taskPhotoCount(task.id)}
        </Text>
      </View>
    )}
  </Pressable>
</View>
```

#### B. Add "Add Photo" button at the end of the report flow

After the blocker step (or after the percentage slider if no blockers), add an optional photo step:

```tsx
{/* After Step 2 (blockers) or Step 1 (slider) — before confirmation */}
<View style={{ padding: 20 }}>
  <Text style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>
    Progress photo (optional)
  </Text>
  
  {photos.length > 0 ? (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
      {photos.map((photo, i) => (
        <Image key={i} source={{ uri: photo.uri }} 
          style={{ width: 80, height: 80, borderRadius: 8 }} />
      ))}
    </View>
  ) : null}

  <View style={{ flexDirection: 'row', gap: 12 }}>
    <Pressable
      onPress={captureProgressPhoto}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}
    >
      <CameraIcon size={24} color="#60a5fa" />
      <Text style={{ color: '#60a5fa', fontWeight: 600 }}>Take Photo</Text>
    </Pressable>

    <Pressable
      onPress={submitReport}
      style={{ flex: 1, padding: 16, backgroundColor: '#e67e22',
        borderRadius: 12, alignItems: 'center' }}
    >
      <Text style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
        {photos.length > 0 ? 'Submit with Photo' : 'Submit'}
      </Text>
    </Pressable>
  </View>
</View>
```

#### C. Photo metadata

When a progress photo is taken, store it with context:

```typescript
await enqueuePhoto({
  area_id: area.id,
  trade_name: currentTrade,
  task_id: task?.id || null,        // which task, if taken from task row
  photo_type: 'progress',           // 'progress' | 'blocker' | 'evidence'
  reported_by: userId,
  gps_lat: location.lat,
  gps_lng: location.lng,
  captured_at: new Date().toISOString(),
});
```

Add `photo_type` column to `field_photos` if not present:

```sql
ALTER TABLE field_photos ADD COLUMN IF NOT EXISTS 
  photo_type TEXT DEFAULT 'progress' CHECK (photo_type IN ('progress', 'blocker', 'evidence', 'safety'));
```

#### D. Photos visible in GC detail panel

On the web Ready Board detail panel, show progress photos in a small gallery:

```tsx
{/* Photo gallery in detail panel */}
{photos.length > 0 && (
  <div className="mt-4 border-t border-white/10 pt-4">
    <h4 className="text-xs text-muted uppercase tracking-wide mb-2">
      Photos ({photos.length})
    </h4>
    <div className="flex gap-2 overflow-x-auto">
      {photos.map(photo => (
        <img
          key={photo.id}
          src={photo.url}
          alt=""
          className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80"
          onClick={() => openPhotoViewer(photo)}
        />
      ))}
    </div>
  </div>
)}
```

---

## Summary

| Fix | What | Impact | Time |
|-----|------|--------|------|
| 1 | GC VERIFY excluded from progress % | Progress reflects real sub work | 2h |
| 2 | Auto start_date + completed_at | Forecast gets real production data | 2h |
| 3 | Optional progress photos | Better evidence, GC can verify remotely | 2h |

Total: ~6 hours. All safe for Sonnet.

### Run order
1. Fix 1 first — changes the core calculation, everything else depends on it
2. Fix 2 second — adds date tracking
3. Fix 3 last — additive feature, no dependencies
4. Run `npx tsc --noEmit` and `npm run build` after each
