# Custom Trade Sequences — SESSION 2 (Sonnet)
# UI: Drag-to-Reorder, Modals, Grid Columns, Onboarding

> Run this with SONNET after SESSION 1 (Opus) is complete.
> SESSION 1 created: migration, RPCs, cascade functions, ChecklistEditor component.
> This session adds the UI layer on top.

---

## Pre-check

Before starting, verify SESSION 1 deliverables exist:
- [ ] `trade_sequences` has columns: `phase_label`, `description`, `is_custom`
- [ ] RPCs exist: `shift_trade_sequence`, `create_status_for_new_trade`, `sync_task_templates_to_areas`
- [ ] Functions exist: `duplicateTradeAsPhase()`, `createCustomTrade()`, `deleteCustomTrade()`
- [ ] `ChecklistEditor` component exists

If any are missing, STOP and report — Session 1 needs to complete first.

---

## PART 1: Drag-to-Reorder Trade Sequence in Settings

### Install dnd-kit (if not already installed)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Replace the current static trade list in Settings → Trades & Costs

The current list shows trades 1-14 with toggles. Replace with a draggable list:

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function TradeSequenceConfig({ projectId }) {
  const [trades, setTrades] = useState([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    supabase.from('trade_sequences')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_order')
      .then(({ data }) => setTrades(data || []));
  }, [projectId]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = trades.findIndex(t => t.id === active.id);
    const newIndex = trades.findIndex(t => t.id === over.id);
    const reordered = arrayMove(trades, oldIndex, newIndex);

    // Optimistic update
    setTrades(reordered);

    // Persist new order
    const updates = reordered.map((t, i) => ({ id: t.id, sequence_order: i + 1 }));
    for (const { id, sequence_order } of updates) {
      await supabase.from('trade_sequences').update({ sequence_order }).eq('id', id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">Trade Sequence</h3>
          <p className="text-xs text-muted">
            Drag to reorder. This defines column order in the Ready Board and which trade must complete before the next starts.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400 font-medium">
            + Add Trade
          </button>
          <button onClick={resetToDefaults}
            className="px-3 py-1.5 border border-white/10 rounded-lg text-sm text-muted">
            Reset to Defaults
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={trades.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {trades.map((trade, index) => (
            <SortableTradeRow
              key={trade.id}
              trade={trade}
              index={index}
              onDuplicate={() => { setDuplicateSource(trade); setShowDuplicateModal(true); }}
              onEditChecklist={() => { setChecklistTrade(trade); setShowChecklistEditor(true); }}
              onDelete={() => handleDelete(trade)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableTradeRow({ trade, index, onDuplicate, onEditChecklist, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: trade.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 p-3 mb-1 rounded-lg border ${
        isDragging ? 'bg-white/10 border-amber-500/50 shadow-lg' : 'bg-white/3 border-white/5 hover:border-white/10'
      }`}>

      {/* Drag handle */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/40">
        ⠿
      </div>

      {/* Sequence number */}
      <span className="text-xs font-mono text-white/30 w-6 text-right">{index + 1}</span>

      {/* Trade info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{trade.trade_name}</span>
          {trade.phase_label && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">{trade.phase_label}</span>
          )}
          {trade.is_custom && (
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">Custom</span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
            trade.reporting_mode === 'checklist' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
          }`}>
            {trade.reporting_mode === 'checklist' ? 'CHECKLIST' : 'PERCENTAGE'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <button onClick={onDuplicate} className="text-xs text-muted hover:text-white px-2" title="Add another phase">
        ⊕ Phase
      </button>
      <button onClick={onEditChecklist} className="text-xs text-muted hover:text-white px-2" title="Edit checklist">
        ☐ Tasks
      </button>
      {trade.is_custom && (
        <button onClick={onDelete} className="text-xs text-red-400/50 hover:text-red-400 px-2" title="Delete">
          ✕
        </button>
      )}
    </div>
  );
}
```

---

## PART 2: Duplicate Phase Modal

Triggered when GC clicks "⊕ Phase" on a trade row:

```tsx
function DuplicatePhaseModal({ source, allTrades, projectId, onClose, onSuccess }) {
  const [phaseLabel, setPhaseLabel] = useState('');
  const [description, setDescription] = useState('');
  const [insertAfter, setInsertAfter] = useState(source.sequence_order);
  const [copyChecklist, setCopyChecklist] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!phaseLabel.trim()) return;
    setSaving(true);
    await duplicateTradeAsPhase({
      sourceTradeId: source.id,
      projectId,
      phaseLabel: phaseLabel.trim(),
      description: description.trim() || undefined,
      insertAfterOrder: insertAfter,
      copyChecklist,
    });
    setSaving(false);
    onSuccess();
  };

  return (
    <Dialog open onClose={onClose}>
      <div className="p-6 max-w-md">
        <h3 className="font-bold text-lg mb-1">Add Phase: {source.trade_name}</h3>
        <p className="text-xs text-muted mb-4">
          Create a new phase. It appears as a separate column in the Ready Board with its own progress tracking.
        </p>

        <label className="text-sm text-muted mb-1 block">Phase name *</label>
        <input value={phaseLabel} onChange={e => setPhaseLabel(e.target.value)}
          placeholder="Phase 2 — Interior Partitions"
          className="w-full mb-4" autoFocus />

        <label className="text-sm text-muted mb-1 block">Description (optional)</label>
        <input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Second pass framing after MEP rough-in"
          className="w-full mb-4" />

        <label className="text-sm text-muted mb-1 block">Insert after</label>
        <select value={insertAfter} onChange={e => setInsertAfter(Number(e.target.value))} className="w-full mb-4">
          {allTrades.map(t => (
            <option key={t.id} value={t.sequence_order}>
              {t.sequence_order}. {t.trade_name} {t.phase_label ? `(${t.phase_label})` : ''}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm mb-6 cursor-pointer">
          <input type="checkbox" checked={copyChecklist} onChange={e => setCopyChecklist(e.target.checked)} />
          Copy checklist from original phase
        </label>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted">Cancel</button>
          <button onClick={handleSave} disabled={!phaseLabel.trim() || saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-30">
            {saving ? 'Creating...' : 'Create Phase'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
```

---

## PART 3: Add Custom Trade Modal

Triggered when GC clicks "+ Add Trade":

```tsx
function AddTradeModal({ allTrades, projectId, onClose, onSuccess }) {
  const [tradeName, setTradeName] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [insertAfter, setInsertAfter] = useState(allTrades.length);
  const [reportingMode, setReportingMode] = useState<'percentage' | 'checklist'>('percentage');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tradeName.trim()) return;
    setSaving(true);
    await createCustomTrade({
      projectId,
      tradeName: tradeName.trim(),
      phaseLabel: phaseLabel.trim() || undefined,
      insertAfterOrder: insertAfter,
      reportingMode,
    });
    setSaving(false);
    onSuccess();
  };

  return (
    <Dialog open onClose={onClose}>
      <div className="p-6 max-w-md">
        <h3 className="font-bold text-lg mb-1">Add Custom Trade</h3>
        <p className="text-xs text-muted mb-4">
          Create a trade not in the default sequence. You can add its checklist after creating.
        </p>

        <label className="text-sm text-muted mb-1 block">Trade name *</label>
        <input value={tradeName} onChange={e => setTradeName(e.target.value)}
          placeholder="e.g., Acoustic Insulation, Glass & Glazing"
          className="w-full mb-4" autoFocus />

        <label className="text-sm text-muted mb-1 block">Phase label (optional)</label>
        <input value={phaseLabel} onChange={e => setPhaseLabel(e.target.value)}
          placeholder="e.g., Phase 1 — Below Grade"
          className="w-full mb-4" />

        <label className="text-sm text-muted mb-1 block">Insert after</label>
        <select value={insertAfter} onChange={e => setInsertAfter(Number(e.target.value))} className="w-full mb-4">
          <option value={0}>At the beginning</option>
          {allTrades.map(t => (
            <option key={t.id} value={t.sequence_order}>
              {t.sequence_order}. {t.trade_name} {t.phase_label ? `(${t.phase_label})` : ''}
            </option>
          ))}
        </select>

        <label className="text-sm text-muted mb-1 block">Reporting mode</label>
        <div className="flex gap-3 mb-6">
          {(['percentage', 'checklist'] as const).map(mode => (
            <button key={mode} onClick={() => setReportingMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm border ${
                reportingMode === mode
                  ? mode === 'checklist' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'border-white/10 text-muted'
              }`}>
              {mode === 'percentage' ? 'Percentage (slider)' : 'Checklist (tasks)'}
            </button>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted">Cancel</button>
          <button onClick={handleSave} disabled={!tradeName.trim() || saving}
            className="px-4 py-2 bg-green-500 text-black rounded-lg text-sm font-bold disabled:opacity-30">
            {saving ? 'Creating...' : 'Create Trade'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
```

---

## PART 4: Dynamic Grid Columns in Ready Board

### Verify: are grid columns already fetched from trade_sequences?

Search the Ready Board component for how columns are defined. If they're hardcoded as an array of 14 trade names, they need to be fetched from the DB.

```tsx
// CORRECT: columns come from trade_sequences
const { data: tradeColumns } = await supabase
  .from('trade_sequences')
  .select('id, trade_name, phase_label, sequence_order')
  .eq('project_id', projectId)
  .order('sequence_order');
```

### Column header with phase label

When rendering grid column headers, show phase label if present:

```tsx
{tradeColumns.map(col => (
  <th key={col.id} className="text-center px-1 min-w-[60px]">
    <div className="text-[10px] font-bold truncate">
      {getColumnAbbreviation(col)}
    </div>
    {col.phase_label && (
      <div className="text-[8px] text-muted font-normal truncate">
        {col.phase_label}
      </div>
    )}
  </th>
))}
```

### Column abbreviations

```typescript
const TRADE_ABBREVIATIONS: Record<string, string> = {
  'Rough Plumbing': 'PLMB',
  'Metal Stud Framing': 'FRAME',
  'MEP Rough-In': 'MEP-R',
  'Fire Stopping': 'FIRE',
  'Insulation & Drywall': 'DRYW',
  'Waterproofing': 'WTPR',
  'Tile / Stone': 'TILE',
  'Paint': 'PAINT',
  'Ceiling Grid / ACT': 'CEIL',
  'MEP Trim-Out': 'MEP-T',
  'Doors & Hardware': 'DOOR',
  'Millwork & Countertops': 'MILL',
  'Flooring': 'FLOOR',
  'Final Clean & Punch': 'PUNCH',
};

function getColumnAbbreviation(trade: { trade_name: string; phase_label?: string }) {
  const abbr = TRADE_ABBREVIATIONS[trade.trade_name] || trade.trade_name.slice(0, 5).toUpperCase();
  if (trade.phase_label) {
    const num = trade.phase_label.match(/\d+/)?.[0];
    return num ? `${abbr} P${num}` : abbr;
  }
  return abbr;
}
```

### Cell lookup with phase awareness

When looking up `area_trade_status` for a cell, use the composite key if the trade has a phase:

```typescript
function getTradeTypeKey(trade: { trade_name: string; phase_label?: string }): string {
  return trade.phase_label
    ? `${trade.trade_name}::${trade.phase_label}`
    : trade.trade_name;
}

// In the grid cell renderer:
const tradeTypeKey = getTradeTypeKey(column);
const status = areaTradeStatuses.find(
  s => s.area_id === area.id && s.trade_type === tradeTypeKey
);
```

---

## PART 5: Onboarding Step 3 (Trades) — Simplified Reorder

The onboarding wizard Step 3 currently shows 14 checkboxes. Update to:

1. Show all 14 defaults pre-selected
2. Each trade has a checkbox (deselect = remove from this project)
3. Drag to reorder (simplified version of Settings drag-and-drop)
4. "+ Add Custom Trade" input at the bottom

Keep it simple for onboarding — the full editor (phases, checklist editing) is in Settings after setup.

```tsx
function OnboardingTradesStep({ selectedTrades, onUpdate }) {
  return (
    <div>
      <h3 className="font-bold text-lg mb-1">Trade Sequence</h3>
      <p className="text-sm text-muted mb-4">
        Select and reorder the trades for your project. You can customize further in Settings after setup.
      </p>

      <DndContext onDragEnd={handleDragEnd}>
        <SortableContext items={selectedTrades.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {selectedTrades.map((trade, i) => (
            <div key={trade.id} className="flex items-center gap-3 p-2 mb-1 rounded bg-white/3">
              <div className="cursor-grab text-white/20">⠿</div>
              <span className="text-xs font-mono text-white/30 w-5">{i + 1}</span>
              <input type="checkbox" checked={trade.enabled}
                onChange={() => toggleTrade(trade.id)} />
              <span className={`text-sm ${trade.enabled ? 'text-white' : 'text-white/30 line-through'}`}>
                {trade.trade_name}
              </span>
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add custom */}
      <div className="flex gap-2 mt-4">
        <input value={customName} onChange={e => setCustomName(e.target.value)}
          placeholder="Add custom trade..."
          className="flex-1 text-sm bg-white/5 border border-white/10 rounded px-3 py-2"
          onKeyDown={e => e.key === 'Enter' && addCustom()} />
        <button onClick={addCustom} disabled={!customName.trim()}
          className="px-3 py-2 bg-green-500/20 text-green-400 rounded text-sm font-bold disabled:opacity-30">
          + Add
        </button>
      </div>
    </div>
  );
}
```

---

## Implementation Order

1. Install `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` if not present
2. Build the `SortableTradeRow` component
3. Build the `TradeSequenceConfig` with drag-and-drop
4. Build `DuplicatePhaseModal`
5. Build `AddTradeModal`
6. Wire the ChecklistEditor from Session 1 into the "☐ Tasks" button
7. Update Ready Board grid to use dynamic columns with `getTradeTypeKey()`
8. Update onboarding Step 3
9. Run `npx tsc --noEmit` and `npm run build`
