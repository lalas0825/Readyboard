# Replace Report Tab → "Today" Tab (Foreman Daily Hub)

## Problem
The "Report" tab is redundant — it just says "Select an area from My Areas to start a report" with a button that goes to My Areas. Two tabs doing the same thing wastes space.

## Solution
Replace "Report" with "Today" — a daily hub with 4 sections in one scrollable screen.

## Tab Bar Change

```
BEFORE: My Areas | Report  | Legal | Profile
AFTER:  My Areas | Today   | Legal | Profile
                    📅
```

Change the tab icon from the current report icon to a calendar/today icon.
Change the label from "Report" to "Today".

## The "Today" Screen Layout

One scrollable screen with 4 sections stacked vertically. Each section is a card. Data comes from local PowerSync DB (works offline).

### Section 1: My Shift (top)

Shows today's work summary at a glance.

```tsx
<View style={{ padding: 16 }}>
  {/* Header */}
  <Text style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>Today</Text>
  <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
    {formatDate(new Date(), 'EEEE, MMM d')} · {tradeName}
  </Text>

  {/* Shift stats card */}
  <View style={{
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  }}>
    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
      My shift
    </Text>

    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <StatBox icon="⏱" value={hoursWorked} label="Hours" color="#60a5fa" />
      <StatBox icon="📋" value={areasReported} label="Reported" color="#4ade80" />
      <StatBox icon="📷" value={photosTaken} label="Photos" color="#fbbf24" />
      <StatBox icon="🔴" value={blockersReported} label="Blockers" color="#f87171" />
    </View>
  </View>
</View>
```

**Data source:**
```typescript
// Query from PowerSync local DB
const todayStart = startOfDay(new Date()).toISOString();

// Areas reported today
const areasReported = usePowerSyncQuery(`
  SELECT COUNT(DISTINCT area_id) as count
  FROM field_reports
  WHERE reported_by = ? AND reported_at >= ?
`, [userId, todayStart]);

// Photos taken today
const photosTaken = usePowerSyncQuery(`
  SELECT COUNT(*) as count
  FROM field_photos
  WHERE reported_by = ? AND captured_at >= ?
`, [userId, todayStart]);

// Blockers reported today
const blockersReported = usePowerSyncQuery(`
  SELECT COUNT(*) as count
  FROM field_reports
  WHERE reported_by = ? AND reported_at >= ? AND status = 'blocked'
`, [userId, todayStart]);

// Hours: calculate from first report to now (or use check-in time if available)
const firstReport = usePowerSyncQuery(`
  SELECT MIN(reported_at) as start_time
  FROM field_reports
  WHERE reported_by = ? AND reported_at >= ?
`, [userId, todayStart]);
const hoursWorked = firstReport ? differenceInHours(new Date(), new Date(firstReport.start_time)) : 0;
```

### Section 2: Up Next (schedule — what's coming)

Shows the foreman's assigned areas ordered by readiness. Tapping an area goes directly to the report flow.

```tsx
<View style={{ padding: 16 }}>
  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
    Up next
  </Text>

  {upNextAreas.map(area => (
    <Pressable
      key={area.id}
      onPress={() => navigateToReport(area)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 14, marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12, borderWidth: 1,
        borderColor: STATUS_COLORS[area.status].border,
      }}
    >
      {/* Status dot */}
      <View style={{
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: STATUS_COLORS[area.status].dot,
      }} />

      {/* Area info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {area.area_code && (
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569',
              backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
              {area.area_code}
            </Text>
          )}
          <Text style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>
            {area.name}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: STATUS_COLORS[area.status].text, marginTop: 2 }}>
          {area.status === 'ready' ? 'Ready — work here now' :
           area.status === 'almost' ? `Almost ready — ETA ${area.eta}` :
           area.status === 'blocked' ? `Blocked: ${area.blocked_reason}` :
           area.status === 'in_progress' ? `${area.effective_pct}% complete` :
           'Pending'}
        </Text>
      </View>

      {/* Arrow */}
      <Text style={{ color: '#475569', fontSize: 18 }}>→</Text>
    </Pressable>
  ))}

  {upNextAreas.length === 0 && (
    <Text style={{ color: '#334155', textAlign: 'center', padding: 20 }}>
      No areas assigned yet
    </Text>
  )}
</View>
```

**Data source:** Same query as My Areas but filtered to show:
1. READY areas first (green — work here now)
2. IN_PROGRESS areas (blue — started, not done)
3. ALMOST areas (amber — coming soon)
4. BLOCKED areas (red — can't work)

This is the foreman's task list for the day, prioritized by what they can act on NOW.

### Section 3: Photos Today (gallery strip)

Horizontal scrollable strip of today's photos. Tap to view full-screen.

```tsx
<View style={{ padding: 16 }}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
      Photos today
    </Text>
    {todayPhotos.length > 0 && (
      <Pressable onPress={() => openGallery()}>
        <Text style={{ fontSize: 12, color: '#60a5fa' }}>View all →</Text>
      </Pressable>
    )}
  </View>

  {todayPhotos.length > 0 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
      {todayPhotos.map(photo => (
        <Pressable key={photo.id} onPress={() => openPhotoViewer(photo)}>
          <Image
            source={{ uri: photo.local_uri || photo.url }}
            style={{ width: 80, height: 80, borderRadius: 10, marginHorizontal: 4 }}
          />
          {/* Overlay with area name */}
          <Text style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>
            {photo.area_name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  ) : (
    <View style={{
      padding: 24, alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderStyle: 'dashed',
    }}>
      <Text style={{ color: '#334155', fontSize: 13 }}>No photos yet today</Text>
      <Text style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
        Take progress photos from any area report
      </Text>
    </View>
  )}
</View>
```

**Data source:**
```typescript
const todayPhotos = usePowerSyncQuery(`
  SELECT fp.*, a.name as area_name
  FROM field_photos fp
  LEFT JOIN areas a ON fp.area_id = a.id
  WHERE fp.reported_by = ? AND fp.captured_at >= ?
  ORDER BY fp.captured_at DESC
  LIMIT 20
`, [userId, todayStart]);
```

### Section 4: Messages (communication with super/PM)

Simple message list — read-only for now, just shows messages relevant to the foreman's areas.

```tsx
<View style={{ padding: 16, paddingBottom: 32 }}>
  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
    Messages
  </Text>

  {messages.length > 0 ? (
    messages.map(msg => (
      <View key={msg.id} style={{
        padding: 12, marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10, borderLeftWidth: 3,
        borderLeftColor: msg.priority === 'urgent' ? '#f87171' : '#334155',
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            {msg.sender_name} · {msg.sender_role}
          </Text>
          <Text style={{ fontSize: 10, color: '#475569' }}>
            {formatRelativeTime(msg.created_at)}
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 20 }}>
          {msg.content}
        </Text>
        {msg.area_name && (
          <Text style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            📍 {msg.area_name}
          </Text>
        )}
      </View>
    ))
  ) : (
    <View style={{ padding: 20, alignItems: 'center' }}>
      <Text style={{ color: '#334155', fontSize: 13 }}>No messages today</Text>
    </View>
  )}
</View>
```

**Data source for V1 (simple):**
Messages come from the `notifications` table filtered to the foreman's areas. These are system-generated messages:
- "GC Inspection at 2pm on Floor 3" (from corrective actions)
- "3A Kitchen is now READY for Tile" (from status changes)
- "Waterproofing completed on 3B — you can start tomorrow" (from completion events)

```typescript
const messages = usePowerSyncQuery(`
  SELECT n.*, a.name as area_name
  FROM notifications n
  LEFT JOIN areas a ON n.area_id = a.id
  WHERE n.user_id = ? AND n.created_at >= ?
  ORDER BY n.created_at DESC
  LIMIT 10
`, [userId, todayStart]);
```

**IMPORTANT:** The Messages section does NOT just show system notifications. It shows AREA NOTES — human-written messages attached to specific areas. See PART 2 below.

Data source combines area_notes + system notifications:

```typescript
const areaIds = myAreas.map(a => a.id);

const areaNotes = usePowerSyncQuery(`
  SELECT an.*, a.name as area_name, 'note' as message_type
  FROM area_notes an
  LEFT JOIN areas a ON an.area_id = a.id
  WHERE an.area_id IN (${areaIds.map(() => '?').join(',')})
    AND an.created_at >= ?
  ORDER BY an.created_at DESC
  LIMIT 20
`, [...areaIds, todayStart]);

const systemNotifs = usePowerSyncQuery(`
  SELECT n.*, a.name as area_name, 'system' as message_type
  FROM notifications n
  LEFT JOIN areas a ON n.area_id = a.id
  WHERE n.user_id = ? AND n.created_at >= ?
  ORDER BY n.created_at DESC
  LIMIT 10
`, [userId, todayStart]);

const messages = [...areaNotes, ...systemNotifs]
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  .slice(0, 15);
```

Differentiate human notes (blue left border) from system events (gray, italic):

```tsx
{messages.map(msg => (
  <View key={msg.id} style={{
    padding: 12, marginBottom: 8,
    backgroundColor: msg.message_type === 'note' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
    borderRadius: 10, borderLeftWidth: 3,
    borderLeftColor: msg.message_type === 'note' ? '#60a5fa' : '#1e293b',
  }}>
    {msg.message_type === 'note' ? (
      <>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            {msg.author_name} · {msg.author_role}
          </Text>
          <Text style={{ fontSize: 10, color: '#475569' }}>{formatRelativeTime(msg.created_at)}</Text>
        </View>
        <Text style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 20 }}>{msg.content}</Text>
      </>
    ) : (
      <Text style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>{msg.content}</Text>
    )}
    {msg.area_name && (
      <Text style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>📍 {msg.area_name}</Text>
    )}
  </View>
))}
```

---

## PART 2: Area Notes System

Area Notes is a per-area log where anyone on the project can leave context-specific messages. NOT a general chat — every note is attached to a specific area. Think "comments on a Google Doc" per area.

### Database

```sql
CREATE TABLE area_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE NOT NULL,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  content TEXT NOT NULL,
  photo_id UUID REFERENCES field_photos(id),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_area_notes_area ON area_notes(area_id, created_at DESC);
CREATE INDEX idx_area_notes_project ON area_notes(project_id, created_at DESC);
ALTER TABLE area_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view area notes" ON area_notes
  FOR SELECT USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create notes" ON area_notes
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );
```

### PowerSync schema — add area_notes

```typescript
const area_notes = new Table({
  id: Column.text,
  project_id: Column.text,
  area_id: Column.text,
  author_id: Column.text,
  author_name: Column.text,
  author_role: Column.text,
  content: Column.text,
  photo_id: Column.text,
  is_system: Column.integer,
  created_at: Column.text,
});
```

Add to sync rules:
```yaml
- name: area_notes
  table: area_notes
  filter: "organization_id = bucket.organization_id"
```

### Mobile — Notes button on Area Detail screen

When the foreman opens an area (to report progress), add a "Notes" button:

```tsx
<Pressable
  onPress={() => navigation.navigate('AreaNotes', { area })}
  style={{
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, marginTop: 12,
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
  }}
>
  <Text style={{ fontSize: 16 }}>💬</Text>
  <Text style={{ color: '#60a5fa', fontWeight: 600, flex: 1 }}>Notes ({noteCount})</Text>
  {unreadCount > 0 && (
    <View style={{ backgroundColor: '#60a5fa', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, color: '#000', fontWeight: 700 }}>{unreadCount} new</Text>
    </View>
  )}
  <Text style={{ color: '#475569' }}>→</Text>
</Pressable>
```

### Mobile — Area Notes Screen

Full-screen notes feed with input at the bottom (looks like a simple chat):

```tsx
function AreaNotesScreen({ area }) {
  const [newNote, setNewNote] = useState('');
  const notes = usePowerSyncQuery(`
    SELECT * FROM area_notes WHERE area_id = ? ORDER BY created_at ASC LIMIT 50
  `, [area.id]);

  const sendNote = async () => {
    if (!newNote.trim()) return;
    await localInsert('area_notes', {
      id: uuid(),
      project_id: area.project_id,
      area_id: area.id,
      author_id: userId,
      author_name: userName,
      author_role: userRoleLabel,
      content: newNote.trim(),
      is_system: 0,
      created_at: new Date().toISOString(),
    });
    setNewNote('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* Header */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
        <Pressable onPress={goBack}>
          <Text style={{ color: '#60a5fa', fontSize: 16 }}>← Back</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {area.area_code && (
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569',
              backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              {area.area_code}
            </Text>
          )}
          <Text style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{area.name}</Text>
        </View>
        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Notes & updates</Text>
      </View>

      {/* Notes list */}
      <FlatList
        data={notes}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item: note }) => (
          <View style={{
            marginBottom: 12,
            alignSelf: note.author_id === userId ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
          }}>
            {note.author_id !== userId && !note.is_system && (
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                {note.author_name} · {note.author_role}
              </Text>
            )}
            <View style={{
              padding: 12, borderRadius: 14,
              backgroundColor: note.is_system ? 'rgba(255,255,255,0.03)'
                : note.author_id === userId ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.08)',
            }}>
              <Text style={{
                fontSize: note.is_system ? 12 : 15,
                color: note.is_system ? '#475569' : '#e2e8f0',
                fontStyle: note.is_system ? 'italic' : 'normal',
                lineHeight: 21,
              }}>
                {note.content}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: '#334155', marginTop: 2,
              textAlign: note.author_id === userId ? 'right' : 'left' }}>
              {formatTime(note.created_at)}
            </Text>
          </View>
        )}
      />

      {/* Input bar */}
      <View style={{
        flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 28,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#0d1426',
      }}>
        <TextInput
          value={newNote}
          onChangeText={setNewNote}
          placeholder="Add a note..."
          placeholderTextColor="#475569"
          multiline
          style={{
            flex: 1, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 12, color: '#f1f5f9', fontSize: 15, maxHeight: 100,
          }}
        />
        <Pressable
          onPress={sendNote}
          disabled={!newNote.trim()}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: newNote.trim() ? '#60a5fa' : '#1e293b',
            alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

### Web — Notes in Ready Board Detail Panel

On the GC dashboard Ready Board, the detail panel (right side) should show recent notes below the checklist:

```tsx
<div className="mt-4 border-t border-white/10 pt-4">
  <h4 className="text-xs text-muted uppercase tracking-wide mb-3">Notes ({notes.length})</h4>

  <div className="space-y-2 max-h-48 overflow-y-auto">
    {notes.slice(0, 5).map(note => (
      <div key={note.id} className={`p-2 rounded-lg text-xs ${note.is_system ? 'text-white/30 italic' : 'bg-white/5'}`}>
        {!note.is_system && (
          <div className="flex justify-between mb-1">
            <span className="font-medium text-white/60">{note.author_name} · {note.author_role}</span>
            <span className="text-white/20">{formatTime(note.created_at)}</span>
          </div>
        )}
        <p className="text-white/80">{note.content}</p>
      </div>
    ))}
  </div>

  {/* GC can add notes too */}
  <div className="flex gap-2 mt-3">
    <input
      type="text"
      value={newNote}
      onChange={e => setNewNote(e.target.value)}
      placeholder="Add a note..."
      className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:border-blue-500 outline-none"
      onKeyDown={e => e.key === 'Enter' && sendNote()}
    />
    <button onClick={sendNote} disabled={!newNote.trim()}
      className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold disabled:opacity-30">
      Send
    </button>
  </div>
</div>
```

### System-generated notes (auto-created on events)

Create area_notes automatically when important events happen:

```typescript
// Status change → BLOCKED
await insertSystemNote(areaId, `Status changed to BLOCKED: ${blockedReason}`);

// Status change → READY
await insertSystemNote(areaId, `Area is now READY for ${nextTrade}`);

// GC creates corrective action
await insertSystemNote(areaId, `Corrective Action created: ${description}. Assigned to ${assignedTo}`);

// Sub completes 100%
await insertSystemNote(areaId, `Sub work complete (100%). Awaiting GC verification.`);

// GC verifies
await insertSystemNote(areaId, `GC verified ✓ — area cleared for next trade.`);

// GC requests correction
await insertSystemNote(areaId, `GC requested correction: ${reason}`);

// Helper function
async function insertSystemNote(areaId: string, content: string) {
  await localInsert('area_notes', {
    id: uuid(),
    project_id: projectId,
    area_id: areaId,
    author_id: 'system',
    author_name: 'ReadyBoard',
    author_role: 'System',
    content,
    is_system: true,
    created_at: new Date().toISOString(),
  });
}
```

---

## Full Photo Gallery Screen

When the foreman taps "View all →" in the Photos section, open a full gallery screen:

```tsx
// New screen: /today/gallery
function PhotoGalleryScreen() {
  // All photos by this foreman, grouped by date
  const photosByDate = groupPhotosByDate(allPhotos);

  return (
    <ScrollView>
      {Object.entries(photosByDate).map(([date, photos]) => (
        <View key={date}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', padding: 16 }}>
            {formatDate(date)}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 }}>
            {photos.map(photo => (
              <Pressable key={photo.id} onPress={() => openFullScreen(photo)}
                style={{ width: '33.33%', padding: 2 }}>
                <Image source={{ uri: photo.local_uri || photo.url }}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: 6 }} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
```

---

## Implementation Notes

1. **Rename the tab** — change the tab config in `_layout.tsx` from "Report" to "Today" with a calendar icon
2. **Replace the screen** — delete or repurpose the current Report screen component, create TodayScreen.tsx
3. **All data from PowerSync** — everything queries the local DB, works offline
4. **No spinners** — show "0" values instantly, data fills in as sync catches up (Carlos Standard: offline is invisible)
5. **Tap "Up Next" areas → goes to report flow** — this IS the report entry point now (replaces the old Report tab's purpose)
6. **Messages are read-only V1** — system notifications displayed as messages. Real messaging in V2.

## Tab icon

Use a calendar or sun icon for "Today":
```tsx
// In the tab bar configuration
{
  name: 'today',
  title: 'Today',
  icon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
  // or use '📅' emoji if using emoji icons
}
```
