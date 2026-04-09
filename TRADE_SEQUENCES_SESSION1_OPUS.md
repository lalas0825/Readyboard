# Custom Trade Sequences — SESSION 1 (Opus)
# Database + Cascade Logic + Checklist Editor

> Run this with OPUS. These tasks have interdependent cascade effects that need careful reasoning.
> After this session completes, run SESSION 2 (Sonnet) for the UI/drag-and-drop work.

---

## Context

The current 14-trade sequence is a fixed default. We need to make it fully dynamic:
- Trades can be reordered (Session 2 handles the drag UI)
- A trade can appear MULTIPLE TIMES as phases (this session)
- The GC can create NEW custom trades (this session)
- Each trade has an editable checklist (this session)

The critical challenge: when you add/duplicate a trade, you need to CASCADE correctly to:
1. `area_trade_status` — every existing area needs a status row for the new trade
2. `trade_task_templates` — the new trade needs checklist tasks
3. `area_tasks` — if areas already exist, clone templates into area_tasks
4. `labor_rates` — the new trade needs rate entries
5. `trade_sequences.sequence_order` — all trades after the insertion point shift by 1

If any step is missed, the Ready Board grid breaks silently.

---

## PART 1: Database Migration

```sql
-- New columns on trade_sequences
ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS phase_label TEXT;
-- e.g., "Phase 1 — Exterior Walls", NULL if only one phase
ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS description TEXT;
-- Optional description of what this phase covers
ALTER TABLE trade_sequences ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
-- true = user-created trade, false = from default template

-- NOTE: trade_sequences may use trade_name OR trade_type — check the actual column name
-- and use it consistently. If the column is trade_type, use trade_type everywhere in this file.
```

### RPC: Shift sequence orders

When inserting a new trade at position N, all trades at position > N shift up by 1:

```sql
CREATE OR REPLACE FUNCTION shift_trade_sequence(
  p_project_id UUID, 
  p_after_order INT, 
  p_shift_by INT DEFAULT 1
) RETURNS void AS $$
BEGIN
  UPDATE trade_sequences
  SET sequence_order = sequence_order + p_shift_by
  WHERE project_id = p_project_id 
    AND sequence_order > p_after_order;
END;
$$ LANGUAGE plpgsql;
```

### RPC: Create area_trade_status for a new trade across all project areas

When a trade is added, every area in the project needs a status row for it:

```sql
CREATE OR REPLACE FUNCTION create_status_for_new_trade(
  p_project_id UUID,
  p_trade_name TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO area_trade_status (area_id, trade_type, effective_pct, status)
  SELECT a.id, p_trade_name, 0, 'pending'
  FROM areas a
  WHERE a.project_id = p_project_id
  ON CONFLICT (area_id, trade_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

**IMPORTANT:** Check what the actual unique constraint is on `area_trade_status`. It might be `(area_id, trade_type)` or something else. Adjust the ON CONFLICT clause to match.

### RPC: Sync task templates to area_tasks (for existing areas)

When the GC edits a checklist, new tasks need to propagate to areas that already have this trade. But NEVER delete completed tasks — only ADD new ones.

```sql
CREATE OR REPLACE FUNCTION sync_task_templates_to_areas(
  p_project_id UUID, 
  p_trade_type TEXT
) RETURNS void AS $$
BEGIN
  -- Insert new tasks from templates that don't exist yet in area_tasks
  -- Uses task_template_id to detect which tasks are already cloned
  INSERT INTO area_tasks (
    area_id, trade_type, task_template_id, task_order,
    task_name_en, task_name_es, task_owner, is_gate, weight, status
  )
  SELECT 
    a.id, tt.trade_type, tt.id, tt.task_order,
    tt.task_name_en, tt.task_name_es, tt.task_owner, tt.is_gate, tt.weight, 'pending'
  FROM trade_task_templates tt
  CROSS JOIN areas a
  WHERE tt.project_id = p_project_id 
    AND tt.trade_type = p_trade_type 
    AND a.project_id = p_project_id
    AND tt.default_enabled = true
  ON CONFLICT (area_id, task_template_id) DO NOTHING;
  -- DO NOTHING = if the task already exists (even if completed), don't touch it
END;
$$ LANGUAGE plpgsql;
```

**IMPORTANT:** Check if `area_tasks` has a unique constraint on `(area_id, task_template_id)`. If not, add one:
```sql
ALTER TABLE area_tasks ADD CONSTRAINT IF NOT EXISTS 
  uq_area_tasks_template UNIQUE (area_id, task_template_id);
```

---

## PART 2: Duplicate Trade as Phase

### Server action / API route

```typescript
// src/app/api/trades/duplicate/route.ts  (or server action)
export async function duplicateTradeAsPhase(params: {
  sourceTradeId: string;
  projectId: string;
  phaseLabel: string;
  description?: string;
  insertAfterOrder: number;
  copyChecklist: boolean;
}) {
  const supabase = await createClient();

  // 1. Fetch the source trade
  const { data: source } = await supabase
    .from('trade_sequences')
    .select('*')
    .eq('id', params.sourceTradeId)
    .single();

  if (!source) throw new Error('Source trade not found');

  // 2. Shift all trades after the insertion point
  await supabase.rpc('shift_trade_sequence', {
    p_project_id: params.projectId,
    p_after_order: params.insertAfterOrder,
    p_shift_by: 1,
  });

  // 3. Create the new trade_sequence entry
  // Same trade_name, different phase_label
  const { data: newTrade } = await supabase
    .from('trade_sequences')
    .insert({
      project_id: params.projectId,
      trade_name: source.trade_name,   // or trade_type — match the actual column
      phase_label: params.phaseLabel,
      description: params.description || null,
      sequence_order: params.insertAfterOrder + 1,
      reporting_mode: source.reporting_mode,
      straight_time_hours: source.straight_time_hours,
      ot_multiplier: source.ot_multiplier,
      dt_multiplier: source.dt_multiplier,
      saturday_rule: source.saturday_rule,
      typical_crew: source.typical_crew,
      is_custom: false, // same base trade, new phase
    })
    .select()
    .single();

  // 4. Create area_trade_status for ALL existing areas
  // IMPORTANT: the trade_type in area_trade_status needs to be UNIQUE per phase
  // Since two phases of "Metal Stud Framing" can't both use "Metal Stud Framing" as trade_type,
  // we need a composite key. Options:
  //   A) Use trade_sequence_id as FK instead of trade_type string
  //   B) Use "Metal Stud Framing::Phase 2" as trade_type
  //   C) Use a generated slug
  //
  // DECISION: Use the trade_sequence_id approach if possible, otherwise use 
  // "{trade_name}::{phase_label}" as the trade_type value.
  
  const tradeTypeKey = params.phaseLabel 
    ? `${source.trade_name}::${params.phaseLabel}`
    : source.trade_name;

  await supabase.rpc('create_status_for_new_trade', {
    p_project_id: params.projectId,
    p_trade_name: tradeTypeKey,
  });

  // 5. Copy checklist templates if requested
  if (params.copyChecklist) {
    const { data: sourceTemplates } = await supabase
      .from('trade_task_templates')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('trade_type', source.trade_name); // or source trade_type

    if (sourceTemplates && sourceTemplates.length > 0) {
      const newTemplates = sourceTemplates.map(t => ({
        ...t,
        id: undefined, // let DB generate new UUID
        trade_type: tradeTypeKey,
        created_at: undefined,
        updated_at: undefined,
      }));

      await supabase.from('trade_task_templates').insert(newTemplates);
    }

    // Clone into area_tasks for existing areas
    await supabase.rpc('sync_task_templates_to_areas', {
      p_project_id: params.projectId,
      p_trade_type: tradeTypeKey,
    });
  }

  // 6. Copy labor rates
  const { data: sourceRates } = await supabase
    .from('labor_rates')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('trade_name', source.trade_name);

  if (sourceRates && sourceRates.length > 0) {
    const newRates = sourceRates.map(r => ({
      ...r,
      id: undefined,
      trade_name: tradeTypeKey,
      created_at: undefined,
      updated_at: undefined,
    }));

    await supabase.from('labor_rates').upsert(newRates, {
      onConflict: 'project_id,trade_name,role',
    });
  }

  return newTrade;
}
```

### CRITICAL ARCHITECTURAL DECISION: Phase Identity

When "Metal Stud Framing" has Phase 1 and Phase 2, they need different identities in `area_trade_status`. The current schema uses `trade_type TEXT` as identifier. Two options:

**Option A (recommended): Composite key string**
- Phase 1: `trade_type = "Metal Stud Framing"`
- Phase 2: `trade_type = "Metal Stud Framing::Phase 2 — Interior Partitions"`

This is backward compatible — existing areas with no phases keep their current trade_type. Only phased trades get the `::` separator.

**Option B: FK to trade_sequences**
- Add `trade_sequence_id UUID REFERENCES trade_sequences(id)` to `area_trade_status`
- More normalized, but requires updating every query that uses trade_type

**Go with Option A** — simpler, backward compatible, works immediately.

When displaying, split on `::` to get the display name:
```typescript
function getTradeDisplayName(tradeType: string) {
  const [name, phase] = tradeType.split('::');
  return { name, phase: phase || null };
}
```

---

## PART 3: Create Custom Trade

```typescript
// src/app/api/trades/create/route.ts  (or server action)
export async function createCustomTrade(params: {
  projectId: string;
  tradeName: string;
  phaseLabel?: string;
  insertAfterOrder: number;
  reportingMode: 'percentage' | 'checklist';
}) {
  const supabase = await createClient();

  // 1. Shift sequence
  await supabase.rpc('shift_trade_sequence', {
    p_project_id: params.projectId,
    p_after_order: params.insertAfterOrder,
    p_shift_by: 1,
  });

  // 2. Create trade_sequence
  const tradeTypeKey = params.phaseLabel
    ? `${params.tradeName}::${params.phaseLabel}`
    : params.tradeName;

  const { data: newTrade } = await supabase
    .from('trade_sequences')
    .insert({
      project_id: params.projectId,
      trade_name: params.tradeName,
      phase_label: params.phaseLabel || null,
      sequence_order: params.insertAfterOrder + 1,
      reporting_mode: params.reportingMode,
      straight_time_hours: 8,
      ot_multiplier: 1.5,
      dt_multiplier: 2.0,
      saturday_rule: 'ot',
      typical_crew: { foreman: 1, journeyperson: 2, apprentice: 1, helper: 0 },
      is_custom: true,
    })
    .select()
    .single();

  // 3. Create area_trade_status for ALL areas
  await supabase.rpc('create_status_for_new_trade', {
    p_project_id: params.projectId,
    p_trade_name: tradeTypeKey,
  });

  // 4. Seed default labor rates
  const defaultRates = [
    { role: 'foreman', hourly_rate: 100 },
    { role: 'journeyperson', hourly_rate: 85 },
    { role: 'apprentice', hourly_rate: 50 },
    { role: 'helper', hourly_rate: 40 },
  ];

  await supabase.from('labor_rates').insert(
    defaultRates.map(r => ({
      project_id: params.projectId,
      trade_name: tradeTypeKey,
      ...r,
    }))
  );

  // 5. NO checklist templates yet — GC will create them in the Checklist Editor
  // (or they use percentage mode which doesn't need templates)

  return newTrade;
}
```

### Delete custom trade

Only custom trades can be deleted. Deleting cascades to:
- `area_trade_status` rows for this trade_type
- `area_tasks` rows for this trade_type
- `trade_task_templates` rows for this trade_type
- `labor_rates` rows for this trade_name
- Shift remaining trades down

```typescript
export async function deleteCustomTrade(tradeId: string, projectId: string) {
  const supabase = await createClient();

  const { data: trade } = await supabase
    .from('trade_sequences')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (!trade || !trade.is_custom) throw new Error('Can only delete custom trades');

  const tradeTypeKey = trade.phase_label
    ? `${trade.trade_name}::${trade.phase_label}`
    : trade.trade_name;

  // Delete in order (respect FKs)
  await supabase.from('area_tasks').delete()
    .eq('trade_type', tradeTypeKey)
    .in('area_id', supabase.from('areas').select('id').eq('project_id', projectId));

  await supabase.from('area_trade_status').delete()
    .eq('trade_type', tradeTypeKey)
    .in('area_id', supabase.from('areas').select('id').eq('project_id', projectId));

  await supabase.from('trade_task_templates').delete()
    .eq('project_id', projectId)
    .eq('trade_type', tradeTypeKey);

  await supabase.from('labor_rates').delete()
    .eq('project_id', projectId)
    .eq('trade_name', tradeTypeKey);

  // Delete the trade_sequence itself
  const deletedOrder = trade.sequence_order;
  await supabase.from('trade_sequences').delete().eq('id', tradeId);

  // Shift remaining trades down
  await supabase.rpc('shift_trade_sequence', {
    p_project_id: projectId,
    p_after_order: deletedOrder - 1,
    p_shift_by: -1,
  });
}
```

---

## PART 4: Checklist Editor (CRUD for task templates)

### Fetch templates for a specific trade

```typescript
export async function getTradeChecklist(projectId: string, tradeTypeKey: string) {
  const { data } = await supabase
    .from('trade_task_templates')
    .select('*')
    .eq('project_id', projectId)
    .eq('trade_type', tradeTypeKey)
    .order('task_order');
  return data || [];
}
```

### Save checklist (full replace strategy)

When the GC saves the checklist editor, we need to handle:
- New tasks added → INSERT into templates + sync to area_tasks
- Existing tasks edited (name, weight, owner, gate) → UPDATE templates + UPDATE area_tasks
- Tasks deleted → DELETE from templates, but ONLY delete from area_tasks if status = 'pending'
  (NEVER delete a completed task from area_tasks — that's evidence)
- Tasks reordered → UPDATE task_order

```typescript
export async function saveTradeChecklist(
  projectId: string,
  tradeTypeKey: string,
  tasks: TaskTemplate[]
) {
  const supabase = await createClient();

  // 1. Fetch current templates to detect adds/edits/deletes
  const { data: existing } = await supabase
    .from('trade_task_templates')
    .select('id')
    .eq('project_id', projectId)
    .eq('trade_type', tradeTypeKey);

  const existingIds = new Set(existing?.map(t => t.id) || []);
  const newIds = new Set(tasks.map(t => t.id));

  // 2. Tasks to delete (in existing but not in new list)
  const toDelete = [...existingIds].filter(id => !newIds.has(id));

  // 3. Delete templates
  if (toDelete.length > 0) {
    await supabase.from('trade_task_templates').delete()
      .in('id', toDelete);

    // Delete from area_tasks ONLY where status = 'pending' (never delete completed evidence)
    await supabase.from('area_tasks').delete()
      .in('task_template_id', toDelete)
      .eq('status', 'pending');
    // Completed tasks stay — they're historical evidence
  }

  // 4. Upsert all tasks (handles both inserts and updates)
  const upsertData = tasks.map((t, i) => ({
    id: t.id,
    project_id: projectId,
    trade_type: tradeTypeKey,
    task_order: i + 1,
    task_name_en: t.task_name_en,
    task_name_es: t.task_name_es || '',
    task_owner: t.task_owner,
    is_gate: t.is_gate,
    weight: t.weight,
    default_enabled: true,
    area_type: t.area_type || 'all',
  }));

  await supabase.from('trade_task_templates').upsert(upsertData, {
    onConflict: 'id',
  });

  // 5. Sync to area_tasks (adds new tasks, doesn't touch existing)
  await supabase.rpc('sync_task_templates_to_areas', {
    p_project_id: projectId,
    p_trade_type: tradeTypeKey,
  });

  // 6. Update edited tasks in area_tasks (name, weight, owner, gate changes)
  // Only update area_tasks that are still 'pending' — don't change completed tasks
  for (const task of tasks) {
    if (existingIds.has(task.id)) {
      await supabase.from('area_tasks')
        .update({
          task_name_en: task.task_name_en,
          task_name_es: task.task_name_es || '',
          task_owner: task.task_owner,
          is_gate: task.is_gate,
          weight: task.weight,
          task_order: tasks.indexOf(task) + 1,
        })
        .eq('task_template_id', task.id)
        .eq('status', 'pending'); // ONLY update pending tasks
    }
  }
}
```

### UI: Checklist Editor Component

This is the full editor UI. Place it in Settings → Trades & Costs, accessible via the ☐ icon on each trade row.

```tsx
function ChecklistEditor({ trade, projectId, onClose }) {
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const tradeTypeKey = trade.phase_label
    ? `${trade.trade_name}::${trade.phase_label}`
    : trade.trade_name;

  useEffect(() => {
    getTradeChecklist(projectId, tradeTypeKey).then(setTasks);
  }, []);

  const addTask = () => {
    if (!newTaskName.trim()) return;
    setTasks([...tasks, {
      id: crypto.randomUUID(),
      project_id: projectId,
      trade_type: tradeTypeKey,
      task_order: tasks.length + 1,
      task_name_en: newTaskName.trim(),
      task_name_es: '',
      task_owner: 'sub',
      is_gate: false,
      weight: 10,
      default_enabled: true,
      area_type: 'all',
    }]);
    setNewTaskName('');
    setHasChanges(true);
  };

  const updateTask = (id: string, field: string, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
    setHasChanges(true);
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveTradeChecklist(projectId, tradeTypeKey, tasks);
    setSaving(false);
    setHasChanges(false);
  };

  // Drag-and-drop reorder handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex(t => t.id === active.id);
    const newIdx = tasks.findIndex(t => t.id === over.id);
    setTasks(arrayMove(tasks, oldIdx, newIdx));
    setHasChanges(true);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1426] border border-white/10 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">
              {trade.trade_name}
              {trade.phase_label && <span className="text-blue-400 ml-2 text-sm">({trade.phase_label})</span>}
            </h3>
            <p className="text-xs text-muted">
              {tasks.length} tasks · Drag to reorder · Gate tasks block next trade
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-muted border border-white/10 rounded-lg">
              {hasChanges ? 'Discard' : 'Close'}
            </button>
            <button onClick={handleSave} disabled={!hasChanges || saving}
              className="px-4 py-1.5 text-sm font-bold bg-green-500 text-black rounded-lg disabled:opacity-30">
              {saving ? 'Saving...' : 'Save Checklist'}
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-white/10">
          <span className="w-6"></span>
          <span className="w-6">#</span>
          <span className="flex-1">Task name</span>
          <span className="w-20 text-center">Spanish</span>
          <span className="w-14 text-center">Weight</span>
          <span className="w-20 text-center">Owner</span>
          <span className="w-14 text-center">Gate</span>
          <span className="w-8"></span>
        </div>

        {/* Task list — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task, i) => (
                <div key={task.id} className="flex items-center gap-2 px-4 py-2 border-b border-white/5 hover:bg-white/3">
                  {/* Drag handle */}
                  <div className="w-6 cursor-grab text-white/20 hover:text-white/40">⠿</div>
                  {/* # */}
                  <span className="w-6 text-xs font-mono text-white/30">{i + 1}</span>
                  {/* Name EN */}
                  <input value={task.task_name_en}
                    onChange={e => updateTask(task.id, 'task_name_en', e.target.value)}
                    className="flex-1 text-sm bg-transparent border-b border-transparent focus:border-amber-500 outline-none" />
                  {/* Name ES */}
                  <input value={task.task_name_es || ''}
                    onChange={e => updateTask(task.id, 'task_name_es', e.target.value)}
                    placeholder="Español"
                    className="w-20 text-xs bg-transparent border-b border-transparent focus:border-amber-500 outline-none text-muted" />
                  {/* Weight */}
                  <input type="number" value={task.weight}
                    onChange={e => updateTask(task.id, 'weight', parseInt(e.target.value) || 0)}
                    className="w-14 text-center text-xs bg-transparent border border-white/10 rounded px-1 py-1" min="1" max="100" />
                  {/* Owner */}
                  <button onClick={() => updateTask(task.id, 'task_owner', task.task_owner === 'sub' ? 'gc' : 'sub')}
                    className={`w-20 text-[10px] px-2 py-1 rounded-full font-bold ${
                      task.task_owner === 'gc' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white/50'
                    }`}>
                    {task.task_owner === 'gc' ? 'GC VERIFY' : 'SUB'}
                  </button>
                  {/* Gate */}
                  <button onClick={() => updateTask(task.id, 'is_gate', !task.is_gate)}
                    className={`w-14 text-[10px] px-2 py-1 rounded-full font-bold ${
                      task.is_gate ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/20'
                    }`}>
                    {task.is_gate ? 'GATE' : 'Gate'}
                  </button>
                  {/* Delete */}
                  <button onClick={() => deleteTask(task.id)}
                    className="w-8 text-center text-red-400/30 hover:text-red-400 text-sm">✕</button>
                </div>
              ))}
            </SortableContext>
          </DndContext>

          {/* Add task input */}
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="w-6"></span>
            <span className="w-6 text-xs text-muted">{tasks.length + 1}</span>
            <input value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
              placeholder="New task name..."
              className="flex-1 text-sm bg-white/5 border border-white/10 rounded px-3 py-2"
              onKeyDown={e => e.key === 'Enter' && addTask()} />
            <button onClick={addTask} disabled={!newTaskName.trim()}
              className="px-3 py-2 bg-green-500/20 text-green-400 rounded text-sm font-bold disabled:opacity-30">
              + Add
            </button>
          </div>
        </div>

        {/* Footer: warnings */}
        <div className="p-3 border-t border-white/10 text-[10px] text-muted">
          Completed tasks in existing areas will NOT be deleted when you remove a task from this checklist.
          Only pending (unchecked) tasks are affected by checklist changes.
        </div>
      </div>
    </div>
  );
}
```

---

## Summary — What this session produces

1. ✅ Migration: `phase_label`, `description`, `is_custom` on `trade_sequences`
2. ✅ 3 RPCs: `shift_trade_sequence`, `create_status_for_new_trade`, `sync_task_templates_to_areas`
3. ✅ `duplicateTradeAsPhase()` — full cascade: shift → create → status → templates → area_tasks → labor_rates
4. ✅ `createCustomTrade()` — full cascade: shift → create → status → labor_rates
5. ✅ `deleteCustomTrade()` — full cascade: delete tasks → status → templates → rates → shift down
6. ✅ `saveTradeChecklist()` — CRUD with protection for completed tasks
7. ✅ ChecklistEditor UI component

After this session, run `npx tsc --noEmit` and `npm run build` to verify.
Then run SESSION 2 (Sonnet) for: drag-to-reorder UI, duplicate/add modals, dynamic grid columns, onboarding update.
