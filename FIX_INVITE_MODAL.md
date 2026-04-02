# Fix Invite Modal — Trade Selector + Area Grouping + Foreman UX

## Problems to Fix

### Problem 1: No trade selector for Sub roles
When inviting a Sub PM, Superintendent, or Foreman, the modal must ask WHICH TRADE they belong to.
Without this, there's no way to scope their access to only their trade's data.

### Problem 2: Area selector is a flat list of 780 areas
The "Assign to Area" dropdown shows every area as a flat list (F4 — 4A Kitchen, F4 — 4A Laundry...).
This is unusable at 780 areas. Needs to be grouped: Floor → Unit → Areas.

### Problem 3: Foreman "no password" messaging is confusing
"Field reporting — no password needed" sounds like a bug. Rephrase to be clearer.

---

## Fix 1: Add Trade Selector

When ANY of these roles is selected — Sub PM, Superintendent, Foreman — show a trade dropdown BEFORE the name/email fields:

```tsx
{/* Show trade selector for sub-side roles */}
{['sub_pm', 'superintendent', 'foreman'].includes(selectedRole) && (
  <div className="mb-4">
    <label className="text-sm text-muted mb-1 block">Trade</label>
    <select
      value={selectedTrade}
      onChange={e => setSelectedTrade(e.target.value)}
      className="w-full bg-[#1e293b] border border-white/20 rounded-lg px-3 py-2 text-sm"
      required
    >
      <option value="">Select trade...</option>
      {projectTrades.map(trade => (
        <option key={trade.id} value={trade.trade_name}>
          {trade.sequence_order}. {trade.trade_name}
        </option>
      ))}
    </select>
    <p className="text-xs text-muted mt-1">
      This person will only see areas and data for this trade.
    </p>
  </div>
)}
```

The trade selection must be:
- **Required** — can't send invite without selecting a trade
- **Stored** on the invitation record: add `trade_name TEXT` to the `invitations` table
- **Propagated** to the user's `organization_members` record on acceptance (used for RLS scoping)

```sql
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS trade_name TEXT;
```

### Role descriptions — update to mention trade

```typescript
const ROLE_OPTIONS = {
  gc_pm: { 
    label: 'GC Project Manager', 
    description: 'Full dashboard access',
    needsTrade: false,
    authMethod: 'email',
  },
  gc_super: { 
    label: 'GC Superintendent', 
    description: 'Field + dashboard access',
    needsTrade: false,
    authMethod: 'email',
  },
  sub_pm: { 
    label: 'Sub PM', 
    description: 'Manages their trade — legal docs, delay tracking',
    needsTrade: true,
    authMethod: 'email',
  },
  superintendent: { 
    label: 'Superintendent', 
    description: 'Manages foremen, reviews & sends NODs',
    needsTrade: true,
    authMethod: 'email',
  },
  foreman: { 
    label: 'Foreman', 
    description: 'Reports from the field — joins via link, no account setup',
    needsTrade: true,
    authMethod: 'phone',
  },
};
```

---

## Fix 2: Grouped Area Selector

Replace the flat dropdown with a grouped multi-select that follows Floor → Unit → Area hierarchy:

```tsx
function AreaAssignmentSelector({ projectId, selectedTrade, selected, onChange }) {
  const { floors, units, areas } = useProjectHierarchy(projectId);
  
  // If trade is selected, only show areas relevant to that trade
  // (areas where that trade has work — i.e., area_trade_status exists for that trade)
  
  return (
    <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg">
      {/* Select all / none */}
      <div className="sticky top-0 bg-[#0d1426] p-2 border-b border-white/10 flex gap-2">
        <button onClick={selectAll} className="text-xs text-green-400 hover:underline">
          Select all
        </button>
        <button onClick={selectNone} className="text-xs text-muted hover:underline">
          Clear
        </button>
        <span className="text-xs text-muted ml-auto">
          {selected.length} selected
        </span>
      </div>

      {floors.map(floor => {
        const floorUnits = units.filter(u => u.floor_id === floor.id);
        const floorAreas = areas.filter(a => a.floor_id === floor.id && !a.unit_id);
        
        return (
          <div key={floor.id}>
            {/* Floor header — clickable to select all areas on this floor */}
            <div
              className="flex items-center gap-2 px-3 py-2 bg-white/5 cursor-pointer hover:bg-white/10"
              onClick={() => toggleFloor(floor.id)}
            >
              <input
                type="checkbox"
                checked={isFloorFullySelected(floor.id)}
                onChange={() => toggleFloor(floor.id)}
                className="rounded"
              />
              <span className="text-sm font-bold text-white">Floor {floor.number}</span>
              <span className="text-xs text-muted ml-auto">
                {getFloorAreaCount(floor.id)} areas
              </span>
            </div>

            {/* Units within this floor */}
            {floorUnits.map(unit => {
              const unitAreas = areas.filter(a => a.unit_id === unit.id);
              return (
                <div key={unit.id}>
                  {/* Unit header */}
                  <div
                    className="flex items-center gap-2 px-6 py-1.5 cursor-pointer hover:bg-white/5"
                    onClick={() => toggleUnit(unit.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isUnitFullySelected(unit.id)}
                      onChange={() => toggleUnit(unit.id)}
                      className="rounded"
                    />
                    <span className="text-xs font-medium text-muted">
                      Unit {unit.name}
                    </span>
                    <span className="text-xs text-white/30 ml-auto">
                      {unitAreas.length} areas
                    </span>
                  </div>

                  {/* Individual areas */}
                  {unitAreas.map(area => (
                    <div
                      key={area.id}
                      className="flex items-center gap-2 px-10 py-1 cursor-pointer hover:bg-white/5"
                      onClick={() => toggleArea(area.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(area.id)}
                        onChange={() => toggleArea(area.id)}
                        className="rounded"
                      />
                      <span className="text-xs text-white/80">{area.name}</span>
                      {area.area_code && (
                        <span className="text-[10px] font-mono text-white/30 ml-1">
                          {area.area_code}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Floor-level areas (no unit) */}
            {floorAreas.map(area => (
              <div
                key={area.id}
                className="flex items-center gap-2 px-6 py-1 cursor-pointer hover:bg-white/5"
                onClick={() => toggleArea(area.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(area.id)}
                  onChange={() => toggleArea(area.id)}
                  className="rounded"
                />
                <span className="text-xs text-white/80">{area.name}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

### Quick assignment shortcuts

Above the area list, add quick-select buttons:

```tsx
<div className="flex flex-wrap gap-2 mb-2">
  <button onClick={() => selectByFloor(currentFloor)} className="text-xs px-2 py-1 rounded bg-white/10 text-muted">
    All of Floor {currentFloor}
  </button>
  <button onClick={() => selectByUnit('24A')} className="text-xs px-2 py-1 rounded bg-white/10 text-muted">
    All of Unit 24A
  </button>
  <button onClick={selectAll} className="text-xs px-2 py-1 rounded bg-white/10 text-muted">
    Entire project
  </button>
</div>
```

---

## Fix 3: Foreman Invite UX

### Change the role description
From: "Field reporting — no password needed"
To: "Reports from the field — joins via link, no account setup"

### When Foreman is selected, the form should show:

```tsx
{selectedRole === 'foreman' && (
  <>
    {/* Trade (required) */}
    <TradeSelector ... />

    {/* Name */}
    <div className="mb-4">
      <label className="text-sm text-muted mb-1 block">Foreman name</label>
      <input type="text" placeholder="Carlos Martinez" ... />
    </div>

    {/* Phone */}
    <div className="mb-4">
      <label className="text-sm text-muted mb-1 block">Phone number</label>
      <input type="tel" placeholder="+1 (212) 555-0123" ... />
      <p className="text-xs text-muted mt-1">
        An invite link will be generated. Share it via WhatsApp or text message.
      </p>
    </div>

    {/* Language preference */}
    <div className="mb-4">
      <label className="text-sm text-muted mb-1 block">Preferred language</label>
      <div className="flex gap-2">
        <button
          onClick={() => setLanguage('en')}
          className={language === 'en' ? 'bg-green-500/20 border-green-500' : 'border-white/20'}
        >
          English
        </button>
        <button
          onClick={() => setLanguage('es')}
          className={language === 'es' ? 'bg-green-500/20 border-green-500' : 'border-white/20'}
        >
          Español
        </button>
      </div>
    </div>

    {/* Area assignment (grouped) */}
    <div className="mb-4">
      <label className="text-sm text-muted mb-1 block">Assign to areas (optional)</label>
      <AreaAssignmentSelector
        projectId={projectId}
        selectedTrade={selectedTrade}
        selected={selectedAreas}
        onChange={setSelectedAreas}
      />
    </div>
  </>
)}
```

### After sending a foreman invite — show the link

Instead of just "Invite sent", show the magic link with a copy button:

```tsx
{inviteSent && selectedRole === 'foreman' && (
  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
    <p className="text-sm font-bold text-green-400 mb-2">Invite created</p>
    <p className="text-xs text-muted mb-3">
      Share this link with {name} via WhatsApp or text message:
    </p>
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={inviteLink}
        className="flex-1 font-mono text-xs bg-black/30 border border-white/10 rounded px-3 py-2"
      />
      <button
        onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); }}
        className="px-3 py-2 bg-green-500 text-black rounded font-bold text-xs"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
    <p className="text-xs text-muted mt-2">
      When {name} taps this link, they'll be logged in automatically — no password, no email needed.
    </p>
  </div>
)}
```

---

## Fix 4: Email Invite — include trade in the email

When inviting a Sub PM or Superintendent via email, the invite email should mention the trade:

```
Subject: You're invited to NYPA on ReadyBoard — Tile / Stone

Body:
Juan Restrepo invited you to join NYPA as Superintendent for Tile / Stone.

ReadyBoard gives you real-time visibility into what's ready, what's blocked, 
and what needs your attention.

[Accept Invitation]
```

---

## Fix 5: On Accept — Store trade on the user

When the invitation is accepted, the trade must be saved on the user's membership:

```typescript
// In the accept invitation handler
await supabase.from('organization_members').upsert({
  user_id: acceptingUser.id,
  organization_id: invitation.organization_id,
  role: invitation.role,
  trade_name: invitation.trade_name,  // ← THIS IS THE KEY ADDITION
});
```

This `trade_name` on `organization_members` is what the RLS policies use to scope data:
- Sub PM with trade = 'Tile / Stone' → only sees areas where Tile / Stone has work
- Foreman with trade = 'Tile / Stone' → only sees their assigned areas for Tile
- GC PM with trade = NULL → sees everything (GC roles don't have a trade scope)

---

## Database Changes Summary

```sql
-- Add trade to invitations
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add trade to org members (for RLS scoping)
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS trade_name TEXT;
```

---

## Implementation Order

1. **Migration:** Add `trade_name` and `language` to `invitations`, add `trade_name` to `organization_members`
2. **Invite modal:** Add trade selector (required for sub roles), language selector for foreman
3. **Area selector:** Replace flat dropdown with grouped Floor → Unit → Area checkbox tree
4. **Foreman flow:** Show copy-link after invite, improve messaging
5. **Email template:** Include trade name in subject + body
6. **Accept handler:** Store trade_name on organization_members
7. **RLS policies:** Verify sub roles are scoped by trade_name (existing policies may need update)
8. **Run `npx tsc --noEmit` and `npm run build`**
