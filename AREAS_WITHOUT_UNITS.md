# Clarification: Areas Without Units (Floor-Level Areas)

## The Rule

Units are OPTIONAL. The hierarchy supports both patterns:

**Pattern A — With units (residential/office floors):**
```
Floor 24
├── Unit 24A → Master Bath, Hall Bath, Kitchen, Powder Room
├── Unit 24B → Bathroom, Kitchen
├── Unit 24C → Master Bath, Hall Bath, Kitchen
└── Common → Corridor, Elevator Lobby (unit_id = NULL)
```

**Pattern B — No units (lobbies, mechanical, amenity floors):**
```
Floor 1 (Lobby)
├── Main Lobby          (unit_id = NULL, directly on floor)
├── Mailroom            (unit_id = NULL)
├── Package Room        (unit_id = NULL)
├── Restroom M          (unit_id = NULL)
├── Restroom F          (unit_id = NULL)
└── Security Desk       (unit_id = NULL)
```

**Pattern C — Mixed (amenity floor with some groupings):**
```
Floor 2 (Amenities)
├── Gym Complex → Main Gym, Locker Room M, Locker Room F, Sauna
├── Pool Area → Pool Deck, Changing Room, Equipment Room
├── Kids Room            (unit_id = NULL, no unit)
├── Corridor             (unit_id = NULL)
└── Restroom             (unit_id = NULL)
```

The database already supports this — `areas.unit_id` is nullable. 
What needs to be verified is that ALL UI handles both patterns correctly.

---

## Ready Board Grid — How to Display

When rendering a floor:

```typescript
// Separate areas into grouped (has unit) and ungrouped (no unit)
const unitsOnFloor = units.filter(u => u.floor_id === floor.id);
const areasWithUnit = areas.filter(a => a.floor_id === floor.id && a.unit_id !== null);
const areasWithoutUnit = areas.filter(a => a.floor_id === floor.id && a.unit_id === null);

// Render order:
// 1. Units (collapsible, each with their child areas)
// 2. Floor-level areas (no unit header, directly under the floor)
```

**If a floor has ZERO units:** Don't show any unit grouping. Areas display directly under the floor header — exactly like the old flat layout but only for that floor.

```
▼ Floor 1 (Lobby)  6 areas        [aggregate status bar]
    Main Lobby        DONE  DONE  DONE  RDY  —  —
    Mailroom          DONE  DONE  RDY   —    —  —
    Package Room      DONE  RDY   —     —    —  —
    Restroom M        DONE  DONE  DONE  DONE RDY —
    Restroom F        DONE  DONE  DONE  DONE RDY —
    Security Desk     DONE  DONE  DONE  DONE DONE RDY
```

**If a floor has units AND floor-level areas:** Show units first (collapsible), then floor-level areas under a subtle "Floor areas" or no header at all.

```
▼ Floor 2 (Amenities)  18 areas    [aggregate status bar]
  ▼ Gym Complex         4 areas
      Main Gym          DONE  DONE  RDY  —  —
      Locker Room M     DONE  RDY   —    —  —
      Locker Room F     DONE  RDY   —    —  —
      Sauna             DONE  DONE  RDY  —  —
  ▶ Pool Area           3 areas     [collapsed]
  ── Floor areas ──
      Kids Room         DONE  DONE  RDY  —  —
      Corridor          DONE  DONE  DONE RDY —
      Restroom          DONE  DONE  DONE RDY —
```

**If a floor has ONLY units (no loose areas):** Don't show "Floor areas" section.

---

## Onboarding Quick Add — Support Both Patterns

The Quick Add UI must allow:

### Option 1: Add unit with areas (existing flow)
Select preset → name the unit → generates areas inside the unit.

### Option 2: Add areas directly to a floor (NEW)
For lobbies, mechanical floors, etc. where there are no units.

Add a toggle or section in the Quick Add:

```tsx
<div className="flex gap-3 mb-4">
  <button
    onClick={() => setAddMode('unit')}
    className={addMode === 'unit' ? 'bg-green-500/20 border-green-500' : 'border-white/20'}
  >
    Add Unit with Areas
  </button>
  <button
    onClick={() => setAddMode('floor')}
    className={addMode === 'floor' ? 'bg-amber-500/20 border-amber-500' : 'border-white/20'}
  >
    Add Areas to Floor (no unit)
  </button>
</div>
```

When "Add Areas to Floor" is selected:
- Hide the unit name/range fields
- Show only the area type chips + custom input
- Selected areas are created with `unit_id = NULL`
- Floor selector: which floor(s) to add these areas to

This covers:
- "Add Restroom M, Restroom F, Corridor to Floor 1" — no unit
- "Add Mechanical Room, Electrical Room to Basement" — no unit
- "Add Main Lobby, Mailroom, Package Room to Floor 1" — no unit

### Presets for non-unit floors:

Add presets that create floor-level areas (no unit):

```typescript
const FLOOR_PRESETS = {
  'lobby': {
    label: 'Lobby / Ground Floor',
    areas: ['Main Lobby', 'Mailroom', 'Package Room', 'Restroom M', 'Restroom F', 'Security Desk']
  },
  'amenity': {
    label: 'Amenity Floor',
    areas: ['Gym', 'Pool Deck', 'Locker Room M', 'Locker Room F', 'Sauna', 'Kids Room', 'Lounge']
  },
  'mechanical': {
    label: 'Mechanical / Service',
    areas: ['Mechanical Room', 'Electrical Room', 'Boiler Room', 'Elevator Machine Room', 'Fire Pump Room']
  },
  'parking': {
    label: 'Parking / Basement',
    areas: ['Parking Level', 'Storage Units', 'Bike Room', 'Trash Room', 'Loading Dock']
  },
  'retail': {
    label: 'Retail / Commercial',
    areas: ['Retail Space A', 'Retail Space B', 'Common Corridor', 'Restroom', 'Utility']
  },
};
```

---

## Mobile — My Areas

The foreman's "My Areas" screen groups by unit. Areas without a unit show under a 
"Floor X" header (not "Unit" header):

```tsx
const grouped = groupAreas(areas);
// Returns:
// {
//   'Unit 24A': [...areas with unit_id matching Unit 24A...],
//   'Unit 24B': [...],
//   'Floor 1': [...areas on floor 1 with unit_id = NULL...],
//   'Floor 2 (common)': [...areas on floor 2 with unit_id = NULL...],
// }

// Render:
{Object.entries(grouped).map(([groupName, groupAreas]) => (
  <View key={groupName}>
    <Text style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
      {groupName}
    </Text>
    {groupAreas.map(area => <AreaCard key={area.id} area={area} />)}
  </View>
))}
```

---

## CSV Import — unit column is optional

The CSV import already has `unit` as optional. When the unit column is empty or missing, 
the area is created with `unit_id = NULL`:

```csv
floor,unit,type,code,description
1,,Main Lobby,,Ground floor lobby
1,,Mailroom,,
1,,Restroom M,,ADA compliant
1,,Restroom F,,ADA compliant
24,A,Master Bath,B.24A.1,Marble double vanity
24,A,Kitchen,K.24A.1,Full kitchen
```

Rows 1-4 have no unit → `unit_id = NULL` → floor-level areas.
Rows 5-6 have unit "A" → system finds or creates "Unit 24A" → `unit_id` set.

---

## Summary

No new database changes needed — `unit_id` is already nullable. 
The changes are all UI:

1. **Ready Board grid:** Render floor-level areas (unit_id = NULL) directly under the floor header, no unit grouping
2. **Quick Add:** Add "Add Areas to Floor (no unit)" toggle + floor-level presets (Lobby, Mechanical, Amenity, etc.)
3. **Mobile:** Group floor-level areas under "Floor X" header instead of "Unit" header
4. **CSV import:** Already works — empty unit column = floor-level area
