# ReadyBoard — Ready Board Reorganization + Area Codes + Quick Add

## Context

The Ready Board grid currently shows 780 areas in a flat list. This is unusable. We need to:
1. Reorganize the grid into a collapsible Floor → Unit → Area hierarchy
2. Add area codes (from building plans) and descriptions to each area
3. Improve the onboarding Quick Add with more presets, multi-select, custom input
4. Add CSV import for bulk area creation
5. Add 3 view modes (Floor overview → Unit view → Area detail)

---

## PART 1: Database Changes

### New table: `units`

```sql
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,              -- "24A", "24B", "PH1"
  unit_type TEXT DEFAULT 'standard_2br'
    CHECK (unit_type IN ('standard_2br', 'studio', 'luxury_3br', 'office_suite', 'common', 'custom')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_units_floor ON units(floor_id);
CREATE INDEX idx_units_project ON units(project_id);
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- RLS: same pattern as floors — users in org that owns the project
CREATE POLICY "Users can view units in their projects" ON units
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "GC admins can manage units" ON units
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = auth.uid() AND om.role IN ('gc_admin', 'gc_pm')
    )
  );
```

### Alter `areas` table — add unit_id, area_code, description

```sql
ALTER TABLE areas ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS area_code TEXT;         -- "B.24A.1" — from building plans
ALTER TABLE areas ADD COLUMN IF NOT EXISTS description TEXT;       -- "Master Bath - Marble, double vanity"
ALTER TABLE areas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX idx_areas_unit ON areas(unit_id);
CREATE INDEX idx_areas_code ON areas(area_code);
```

### Update seed data

Update `scripts/seed-demo.ts` to create units and assign areas to them. Example for 383 Madison:

```typescript
// For each floor (2-40), create 4 units (A, B, C, D)
for (let floor = 2; floor <= 40; floor++) {
  for (const unitLetter of ['A', 'B', 'C', 'D']) {
    const unit = await createUnit({
      project_id: projectId,
      floor_id: floors[floor].id,
      name: `${floor}${unitLetter}`,
      unit_type: 'standard_2br',
    });

    // Create areas with codes
    const areas = [
      { type: 'bathroom', code: `B.${floor}${unitLetter}.1`, name: 'Bathroom', description: null },
      { type: 'kitchen', code: `K.${floor}${unitLetter}.1`, name: 'Kitchen', description: null },
      { type: 'corridor', code: `C.${floor}${unitLetter}.1`, name: 'Corridor', description: null },
      { type: 'office', code: `O.${floor}${unitLetter}.1`, name: 'Office', description: null },
      { type: 'utility', code: `U.${floor}${unitLetter}.1`, name: 'Utility', description: null },
    ];

    for (const area of areas) {
      await createArea({
        ...area,
        unit_id: unit.id,
        floor_id: floors[floor].id,
        project_id: projectId,
      });
    }
  }
}
```

---

## PART 2: Ready Board Grid Reorganization

### Replace the current flat grid with a 3-level collapsible hierarchy

The grid component needs to be restructured. The current implementation shows ALL areas as flat rows. Replace with:

### Level 1 — Floor rows (default collapsed view)

When the page loads, show ONE row per floor. Each floor row shows:
- Floor number/name
- Aggregate status bar (mini bar showing count of RDY/WIP/BLK/HLD/DONE across all areas on that floor)
- Total areas count
- Worst status indicator (color dot: green if all ok, red if any blocked, amber if any almost)
- Expand/collapse chevron (▶/▼)

```tsx
// Floor row — collapsed
<tr className="floor-row cursor-pointer" onClick={() => toggleFloor(floor.id)}>
  <td className="font-bold">
    {expanded ? '▼' : '▶'} Floor {floor.number}
  </td>
  <td colSpan={tradeCount}>
    {/* Mini aggregate bar: colored segments proportional to status counts */}
    <div className="flex h-3 rounded overflow-hidden">
      <div style={{ width: `${readyPct}%` }} className="bg-green-500" />
      <div style={{ width: `${wipPct}%` }} className="bg-blue-500" />
      <div style={{ width: `${almostPct}%` }} className="bg-amber-500" />
      <div style={{ width: `${blockedPct}%` }} className="bg-red-500" />
      <div style={{ width: `${heldPct}%` }} className="bg-purple-500" />
      <div style={{ width: `${donePct}%` }} className="bg-blue-700" />
    </div>
  </td>
  <td className="text-xs text-muted">
    {totalAreas} areas · {readyCount} ready · {blockedCount} blocked
  </td>
</tr>
```

### Level 2 — Unit rows (expanded floor)

When a floor is expanded, show ONE row per unit within that floor:
- Unit name (e.g., "Unit 24A")
- Unit type badge (e.g., "2BR", "Studio")
- Aggregate status per trade (worst status of child areas for each trade column)
- Summary text: "4/5 ready"
- Expand/collapse chevron

```tsx
// Unit row — inside expanded floor
<tr className="unit-row cursor-pointer bg-white/5" onClick={() => toggleUnit(unit.id)}>
  <td className="pl-8 font-medium">
    {expanded ? '▼' : '▶'} Unit {unit.name}
    <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded">
      {unit.unit_type_label}
    </span>
  </td>
  {trades.map(trade => (
    <td key={trade.id}>
      {/* Show worst status cell for this unit×trade */}
      <StatusCell status={getWorstStatus(unit.id, trade.id)} />
    </td>
  ))}
  <td className="text-xs">{readyCount}/{totalCount} ready</td>
</tr>
```

### Level 3 — Area rows (expanded unit)

When a unit is expanded, show the individual areas with full trade grid:
- Area code (e.g., "B.24A.1") — monospace font
- Area name + description (e.g., "Master Bath · Marble, double vanity")
- Full trade status cells (the current grid behavior)

```tsx
// Area row — inside expanded unit
<tr className="area-row">
  <td className="pl-16">
    <span className="font-mono text-xs text-muted mr-2">{area.area_code}</span>
    <span>{area.name}</span>
    {area.description && (
      <span className="text-xs text-muted ml-1">· {area.description}</span>
    )}
  </td>
  {trades.map(trade => (
    <td key={trade.id}>
      <StatusCell
        status={getAreaTradeStatus(area.id, trade.id)}
        onClick={() => openDetailPanel(area, trade)}
      />
    </td>
  ))}
</tr>
```

### Navigation controls — add above the grid

```tsx
<div className="flex items-center gap-3 mb-4">
  {/* Floor quick-jump tabs */}
  <div className="flex gap-1 overflow-x-auto">
    {floors.map(f => (
      <button
        key={f.id}
        onClick={() => scrollToFloor(f.id)}
        className={`px-2 py-1 text-xs rounded ${
          activeFloor === f.id ? 'bg-amber-500/20 text-amber-500 font-bold' : 'text-muted'
        }`}
      >
        F{f.number}
      </button>
    ))}
  </div>

  <div className="border-l border-white/10 h-6" />

  {/* Bulk controls */}
  <button onClick={expandAll} className="text-xs text-muted hover:text-white">
    Expand all
  </button>
  <button onClick={collapseAll} className="text-xs text-muted hover:text-white">
    Collapse all
  </button>
  <button
    onClick={toggleProblemsOnly}
    className={`text-xs px-3 py-1 rounded ${
      problemsOnly ? 'bg-red-500/20 text-red-400' : 'text-muted'
    }`}
  >
    Show problems only
  </button>
</div>
```

### "Show problems only" filter

When active, only show:
- Floors that contain at least one BLOCKED, HELD, or ALMOST area
- Within those floors, only units that contain problem areas
- Within those units, only the problem areas

This turns 780 rows into the 10-15 that actually need attention.

### State management

```typescript
const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
const [problemsOnly, setProblemsOnly] = useState(false);

const toggleFloor = (floorId: string) => {
  setExpandedFloors(prev => {
    const next = new Set(prev);
    if (next.has(floorId)) next.delete(floorId);
    else next.add(floorId);
    return next;
  });
};

const toggleUnit = (unitId: string) => {
  setExpandedUnits(prev => {
    const next = new Set(prev);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    return next;
  });
};
```

---

## PART 3: Onboarding Quick Add Improvements

### Current state
The Quick Add generates areas from presets but only offers: Standard 2BR, Studio, 3BR Luxury, Office Suite, Common Areas, Custom. The "Custom" mode only lets you select from a fixed set of area types.

### Changes needed

#### A. More area type options in presets

Update preset definitions to be more realistic:

```typescript
const UNIT_PRESETS = {
  standard_2br: {
    label: 'Standard 2BR',
    areas: ['Master Bath', 'Hall Bath', 'Kitchen', 'Powder Room']
  },
  studio: {
    label: 'Studio',
    areas: ['Bathroom', 'Kitchen']
  },
  luxury_3br: {
    label: '3BR Luxury',
    areas: ['Master Bath', 'Hall Bath', 'Guest Bath', 'Kitchen', 'Powder Room', 'Laundry']
  },
  office_suite: {
    label: 'Office Suite',
    areas: ['Kitchen/Pantry', 'Restroom M', 'Restroom F', 'Server Room']
  },
  common: {
    label: 'Common Areas',
    areas: ['Corridor', 'Elevator Lobby', 'Stairwell', 'Trash Room', 'Mail Room']
  },
};
```

#### B. Multi-select area types (chips)

When "Custom" is selected (or when the user wants to modify a preset), show a chip-select for common area types. These are toggleable chips — click to add/remove:

```tsx
const AREA_TYPES = [
  'Bathroom', 'Master Bath', 'Half Bath', 'Powder Room',
  'Kitchen', 'Kitchenette', 'Pantry',
  'Corridor', 'Hallway',
  'Office', 'Conference Room',
  'Lobby', 'Elevator Lobby',
  'Utility', 'Mechanical', 'Electrical',
  'Laundry', 'Storage', 'Closet',
  'Balcony', 'Terrace',
  'Living Room', 'Dining Room', 'Bedroom',
];

// Render as toggleable chips
<div className="flex flex-wrap gap-2">
  {AREA_TYPES.map(type => (
    <button
      key={type}
      onClick={() => toggleAreaType(type)}
      className={`px-3 py-1.5 text-sm rounded-full border ${
        selectedTypes.includes(type)
          ? 'bg-green-500/20 border-green-500 text-green-400'
          : 'border-white/20 text-muted hover:border-white/40'
      }`}
    >
      {type}
    </button>
  ))}
</div>
```

#### C. Custom area type input (free text)

Below the chips, add a text input for custom area types not in the list:

```tsx
<div className="flex gap-2 mt-3">
  <input
    type="text"
    value={customType}
    onChange={e => setCustomType(e.target.value)}
    placeholder="Custom area type (e.g., Walk-in Closet)"
    className="flex-1"
    onKeyDown={e => e.key === 'Enter' && addCustomType()}
  />
  <button onClick={addCustomType} disabled={!customType.trim()}>
    + Add
  </button>
</div>

{/* Show custom types as removable chips */}
<div className="flex flex-wrap gap-2 mt-2">
  {customTypes.map(type => (
    <span key={type} className="px-3 py-1 text-sm rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center gap-1">
      {type}
      <button onClick={() => removeCustomType(type)} className="ml-1 text-xs">✕</button>
    </span>
  ))}
</div>
```

#### D. Area code pattern configuration

Add a field where the GC defines their coding convention:

```tsx
<div className="mt-4">
  <label className="text-sm text-muted">Area code pattern</label>
  <select value={codePattern} onChange={e => setCodePattern(e.target.value)}>
    <option value="auto">{'{type_prefix}.{floor}{unit}.{seq}'} — e.g., B.24A.1</option>
    <option value="flat">{'{floor}-{unit}-{type}-{seq}'} — e.g., 24-A-BATH-1</option>
    <option value="none">No auto-codes (I'll add manually or import CSV)</option>
  </select>
</div>
```

Auto-generated codes use type prefixes:
- Bathroom/Bath → B
- Kitchen → K
- Corridor → C
- Office → O
- Lobby → L
- Utility → U
- Custom types → first 2 letters uppercase

---

## PART 4: CSV Import for Areas

### Add to the onboarding wizard (Step 4: Areas) and to Settings

A "Import from CSV" button that accepts a file with area definitions:

```tsx
<div className="border border-dashed border-white/20 rounded-lg p-6 text-center">
  <p className="text-sm text-muted mb-3">
    Or import areas from a spreadsheet
  </p>
  <input
    type="file"
    accept=".csv,.xlsx"
    onChange={handleFileUpload}
    className="hidden"
    id="area-import"
  />
  <label htmlFor="area-import" className="cursor-pointer px-4 py-2 bg-white/10 rounded text-sm hover:bg-white/20">
    Upload CSV / Excel
  </label>
  <p className="text-xs text-muted mt-2">
    Columns: floor, unit, type, code (optional), description (optional)
  </p>
</div>
```

### CSV format

```csv
floor,unit,type,code,description
24,A,Bathroom,B.24A.1,Master Bath - Marble double vanity
24,A,Bathroom,B.24A.2,Hall Bath - Standard porcelain
24,A,Kitchen,K.24A.1,Full kitchen - Gas range
24,A,Powder Room,P.24A.1,
24,B,Bathroom,B.24B.1,Studio Bath - ADA compliant
24,B,Kitchen,K.24B.1,Kitchenette
```

### Processing logic

```typescript
async function processAreaCSV(file: File, projectId: string) {
  const rows = await parseCSV(file); // Use papaparse

  // Group by floor → unit
  const grouped = groupBy(rows, row => `${row.floor}-${row.unit}`);

  for (const [key, areaRows] of Object.entries(grouped)) {
    const [floorNum, unitName] = key.split('-');

    // Find or create floor
    let floor = await findFloor(projectId, floorNum);
    if (!floor) floor = await createFloor(projectId, floorNum);

    // Find or create unit
    let unit = await findUnit(floor.id, unitName);
    if (!unit) unit = await createUnit({ project_id: projectId, floor_id: floor.id, name: `${floorNum}${unitName}` });

    // Create areas
    for (const row of areaRows) {
      await createArea({
        project_id: projectId,
        floor_id: floor.id,
        unit_id: unit.id,
        name: row.type,
        area_type: normalizeType(row.type),
        area_code: row.code || generateCode(row),
        description: row.description || null,
      });
    }
  }

  // Clone task templates for all new areas
  await cloneTemplatesForProject(projectId);
}
```

### Download template button

Add a "Download template" link that generates a sample CSV:

```typescript
function downloadTemplate() {
  const csv = `floor,unit,type,code,description
2,A,Bathroom,B.2A.1,Master Bath
2,A,Kitchen,K.2A.1,Full Kitchen
2,A,Corridor,C.2A.1,
2,B,Bathroom,B.2B.1,Studio Bath
2,B,Kitchen,K.2B.1,Kitchenette`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'readyboard-areas-template.csv';
  a.click();
}
```

---

## PART 5: Area Detail in Grid

### When clicking a cell in the grid (area × trade), the detail panel should show:

- Area code: `B.24A.1`
- Area name: `Master Bath`
- Description: `Marble, double vanity`
- Trade status: READY / WIP / BLOCKED / etc.
- If checklist mode: task progress bar + list of tasks
- If percentage mode: slider value
- Evidence: GPS, photos, timestamps
- Actions: Generate NOD (if blocked), Create CA

### Area code display in the grid

In the Area row (Level 3), show the code in monospace before the name:

```tsx
<td className="pl-16">
  {area.area_code && (
    <span className="font-mono text-[11px] text-white/40 mr-2">
      {area.area_code}
    </span>
  )}
  <span className="font-medium">{area.name}</span>
  {area.description && (
    <span className="text-xs text-white/30 ml-2">
      · {area.description}
    </span>
  )}
</td>
```

---

## PART 6: Mobile — Full Hierarchy Update

The foreman mobile app needs to reflect the new Floor → Unit → Area hierarchy across ALL screens. This is not just display — it changes navigation, data queries, and the report flow.

### 6A. Home Screen — "My Areas" grouped by unit

Currently: flat list of area cards (READY, ALMOST, BLOCKED, etc.)
New: grouped by unit within the foreman's assigned floor.

```tsx
// PowerSync query — fetch areas with unit info
const areas = usePowerSyncQuery(`
  SELECT a.*, u.name as unit_name, u.unit_type
  FROM areas a
  LEFT JOIN units u ON a.unit_id = u.id
  WHERE a.id IN (SELECT area_id FROM user_assignments WHERE user_id = ?)
  ORDER BY u.sort_order, u.name, a.sort_order, a.name
`, [userId]);

// Group by unit
const grouped = groupBy(areas, a => a.unit_name || 'Common');
```

Layout:

```tsx
<ScrollView>
  {Object.entries(grouped).map(([unitName, unitAreas]) => (
    <View key={unitName}>
      {/* Unit header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginTop: 12,
      }}>
        <Text style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
          Unit {unitName}
        </Text>
        {/* Unit aggregate: mini status dots */}
        <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
          {getUnitStatusDots(unitAreas).map((dot, i) => (
            <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot.color }} />
          ))}
        </View>
      </View>

      {/* Area cards within unit */}
      {unitAreas.map(area => (
        <AreaCard
          key={area.id}
          area={area}
          onPress={() => startReport(area)}
          onNOD={() => openNODDraft(area)}
        />
      ))}
    </View>
  ))}
</ScrollView>
```

### 6B. Area Card — show code + description

Update the existing area card component to include area_code and description:

```tsx
const AreaCard = ({ area, onPress, onNOD }) => {
  const statusColor = STATUS_COLORS[area.status];

  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: statusColor.bg,
      borderWidth: 2,
      borderColor: statusColor.border,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 14,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    }}>
      {/* Status icon */}
      <View style={{
        width: 50, height: 50, borderRadius: 12,
        backgroundColor: statusColor.icon,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 22 }}>{statusColor.emoji}</Text>
      </View>

      {/* Area info */}
      <View style={{ flex: 1 }}>
        {/* Area code + name on same line */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {area.area_code && (
            <Text style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#475569',
              backgroundColor: 'rgba(255,255,255,0.05)',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}>
              {area.area_code}
            </Text>
          )}
          <Text style={{ fontSize: 19, fontWeight: 700, color: '#f1f5f9' }}>
            {area.name}
          </Text>
        </View>

        {/* Description if exists */}
        {area.description && (
          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {area.description}
          </Text>
        )}

        {/* Status text */}
        <Text style={{ fontSize: 13, color: statusColor.text, marginTop: 4 }}>
          {statusColor.label}
        </Text>
      </View>

      {/* Arrow or action */}
      <Text style={{ fontSize: 24, color: statusColor.text }}>→</Text>
    </Pressable>
  );
};
```

### 6C. Report Flow — show area code in header

When the foreman taps an area to report, the report screen header should show the area code prominently so they can confirm they're reporting on the right area (especially when there are 400 bathrooms):

```tsx
// Report screen header
<View style={{ backgroundColor: '#1e293b', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
  <Pressable onPress={goBack}>
    <Text style={{ color: '#94a3b8', fontSize: 24 }}>←</Text>
  </Pressable>
  <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {area.area_code && (
        <Text style={{
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,0.1)',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
        }}>
          {area.area_code}
        </Text>
      )}
      <Text style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
        Report update
      </Text>
    </View>
    <Text style={{ fontSize: 19, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
      {area.name}
    </Text>
    {area.description && (
      <Text style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>
        {area.description}
      </Text>
    )}
  </View>
</View>
```

### 6D. Confirmation Screen — show area code

After the foreman submits a report, the green confirmation screen should display the area code so they know exactly what was recorded:

```tsx
// Confirmation screen
<View style={{
  backgroundColor: '#14532d', flex: 1,
  alignItems: 'center', justifyContent: 'center', gap: 16,
}}>
  <Text style={{ fontSize: 88 }}>✓</Text>
  <Text style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>
    {t.saved}
  </Text>
  {area.area_code && (
    <Text style={{ fontFamily: 'monospace', fontSize: 14, color: '#86efac' }}>
      {area.area_code}
    </Text>
  )}
  <Text style={{ fontSize: 15, color: '#86efac' }}>
    {area.name} — {pct}%
  </Text>
</View>
```

### 6E. Legal Tab — group NOD drafts by unit

The Legal tab on mobile shows pending NODs and blocked areas. Group these by unit:

```tsx
// Legal tab
<ScrollView>
  {Object.entries(groupedByUnit).map(([unitName, items]) => (
    <View key={unitName}>
      <Text style={{ fontSize: 13, fontWeight: 700, color: '#64748b', paddingHorizontal: 16, paddingTop: 12 }}>
        Unit {unitName}
      </Text>
      {items.map(item => (
        <NODCard
          key={item.id}
          area={item}
          showAreaCode={true}  // display area_code in NOD card
          onPress={() => openNODDraft(item)}
        />
      ))}
    </View>
  ))}
</ScrollView>
```

### 6F. PowerSync schema update

Add `unit_id`, `area_code`, `description` to the PowerSync sync rules so these fields are available offline:

```typescript
// In PowerSync schema definition
const areas = new Table({
  // ... existing columns ...
  unit_id: Column.text,           // ADD
  area_code: Column.text,         // ADD
  description: Column.text,       // ADD
  sort_order: Column.integer,     // ADD
});

// Add units table to PowerSync schema
const units = new Table({
  id: Column.text,
  project_id: Column.text,
  floor_id: Column.text,
  name: Column.text,
  unit_type: Column.text,
  sort_order: Column.integer,
});
```

Update the sync rules in PowerSync dashboard to include the `units` table and the new area columns.

### 6G. Profile Screen — show assigned unit(s)

On the foreman's Profile screen, show which units they're assigned to:

```tsx
<View style={{ padding: 16 }}>
  <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
    Assigned areas
  </Text>
  {assignedUnits.map(unit => (
    <View key={unit.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
        Unit {unit.name}
      </Text>
      <Text style={{ fontSize: 12, color: '#475569' }}>
        · {unit.areaCount} areas
      </Text>
    </View>
  ))}
</View>
```

---

## Summary of changes

### Database
1. Create `units` table + RLS
2. Add `unit_id`, `area_code`, `description`, `sort_order` to `areas`
3. Update seed data

### Ready Board grid
4. Restructure into 3-level collapsible hierarchy (Floor → Unit → Area)
5. Add floor quick-jump tabs
6. Add "Expand all / Collapse all" buttons
7. Add "Show problems only" filter
8. Show area codes and descriptions in area rows

### Onboarding
9. Add more area types to multi-select chips (~25 common types)
10. Add free text input for custom area types
11. Add area code pattern configuration
12. Add CSV import with template download

### Mobile
13. Home screen: areas grouped by unit with section headers + aggregate status dots
14. Area cards: show area_code (monospace badge) + description
15. Report flow header: area_code prominently displayed so foreman confirms correct area
16. Confirmation screen: show area_code in the green ✓ screen
17. Legal tab: NOD drafts grouped by unit
18. PowerSync schema: add units table + area_code/description/unit_id columns to sync rules
19. Profile screen: show assigned units

### Order of implementation
Do the database changes FIRST (migration), then seed data, then grid reorganization, then onboarding, then mobile (PowerSync schema first, then UI). Run `npx tsc --noEmit` and `npm run build` after each part.
