# Performance Fix — Page Navigation Takes 15+ Seconds

## URGENT — This is the #1 priority right now.

The dashboard pages take 10-15 seconds to load when navigating between them. This kills the demo and makes the product unusable. Fix this before anything else.

## Step 1: DIAGNOSE FIRST (do not fix anything yet)

Run these checks and report findings before making changes:

### A. Measure actual load times

Add temporary console.time measurements to each dashboard page:

```typescript
// At the top of each page component (Overview, Ready Board, Delays, etc.)
console.time('PAGE_NAME render');

// Inside useEffect or data fetch
console.time('PAGE_NAME data fetch');
const data = await fetchData();
console.timeEnd('PAGE_NAME data fetch');

// After render
useEffect(() => {
  console.timeEnd('PAGE_NAME render');
}, []);
```

Report: which pages are slow? Is it the data fetch or the render?

### B. Check Supabase query performance

For each slow page, log the Supabase queries:

```typescript
const start = performance.now();
const { data, error } = await supabase.from('areas').select('*').eq('project_id', projectId);
console.log(`areas query: ${Math.round(performance.now() - start)}ms, rows: ${data?.length}`);
```

Report: 
- How many queries per page load?
- How many rows returned per query?
- Which queries are slowest?
- Are there N+1 query patterns (loop of queries)?

### C. Check for these common Next.js performance killers

1. **No `loading.tsx` files** — pages block until all data fetches complete. Check: does each `/dashboard/*` route have a `loading.tsx`?

2. **Server Components fetching too much** — Are pages Server Components that fetch ALL data before rendering? Or do they use Client Components with `useEffect`?

3. **No data caching** — Same data fetched on every navigation. Check: is there any `unstable_cache`, `revalidate`, or React `cache()` usage?

4. **Fetching ALL 780 areas on every page** — If every page loads all areas, that's 780 rows × 14 trades = 10,920 cells minimum. Check: does the Ready Board fetch all area_trade_status at once?

5. **No pagination** — Delays, Verifications, Legal Docs, etc. fetching ALL records instead of paginating.

6. **Supabase RLS overhead** — Complex RLS policies with subqueries can add 100-500ms per query. Check: how many JOINs do the RLS policies require?

7. **Sequential queries** — Queries running one after another instead of in parallel. Check: are there `await` chains that could be `Promise.all()`?

8. **Layout re-renders** — The sidebar/layout re-fetching data on every navigation. Check: does the root layout fetch user/project data, and does it re-run on every page change?

9. **Large bundle size** — Check: `npm run build` output shows page sizes. Any page over 200KB JS?

10. **No Suspense boundaries** — Everything blocks on the slowest query. Check: are there `<Suspense>` wrappers around independent sections?

### D. Check the build output

```bash
npm run build
```

Look at the output:
- Route sizes (JS + First Load)
- Any routes over 200KB?
- Are routes static or dynamic?

### E. Check network waterfall

In Chrome DevTools → Network tab:
- How many requests per page navigation?
- What's the slowest request?
- Are requests sequential or parallel?
- Any requests over 2 seconds?

---

## Step 2: REPORT FINDINGS

Before fixing, output a table:

| Page | Load Time | # Queries | Slowest Query | Rows Fetched | Issue |
|------|-----------|-----------|---------------|-------------|-------|

---

## Step 3: APPLY FIXES (based on diagnosis)

### Fix A: Add loading.tsx to every dashboard route (IMMEDIATE)

This is the quickest win. Add a skeleton/spinner that shows instantly while data loads:

```tsx
// apps/web/src/app/dashboard/readyboard/loading.tsx
export default function Loading() {
  return (
    <div className="p-6">
      <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-4" />
      <div className="h-4 w-96 bg-white/5 rounded animate-pulse mb-8" />
      <div className="grid gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
```

Create one for EVERY dashboard route:
- `/dashboard/loading.tsx` (overview)
- `/dashboard/readyboard/loading.tsx`
- `/dashboard/verifications/loading.tsx`
- `/dashboard/delays/loading.tsx`
- `/dashboard/legal/loading.tsx`
- `/dashboard/forecast/loading.tsx`
- `/dashboard/corrective-actions/loading.tsx`
- `/dashboard/schedule/loading.tsx`
- `/dashboard/team/loading.tsx`
- `/dashboard/settings/loading.tsx`
- `/dashboard/billing/loading.tsx`

### Fix B: Parallel data fetching with Promise.all

If queries are sequential:

```typescript
// SLOW — sequential
const areas = await supabase.from('areas').select('*').eq('project_id', pid);
const trades = await supabase.from('trade_sequences').select('*').eq('project_id', pid);
const statuses = await supabase.from('area_trade_status').select('*').in('area_id', areaIds);
// Total: query1 + query2 + query3 = 3 round trips

// FAST — parallel
const [areas, trades, statuses] = await Promise.all([
  supabase.from('areas').select('*').eq('project_id', pid),
  supabase.from('trade_sequences').select('*').eq('project_id', pid),
  supabase.from('area_trade_status').select('*').in('area_id', areaIds),
]);
// Total: max(query1, query2, query3) = 1 round trip
```

### Fix C: Ready Board — DON'T fetch all 780 areas at once

The Ready Board should fetch COLLAPSED data first (floor summaries), then fetch area details ONLY when a floor is expanded.

```typescript
// Step 1: Fetch floor summaries (fast — ~30 rows)
const floors = await supabase
  .from('floors') // or distinct floor values from areas
  .select('*')
  .eq('project_id', pid);

// Step 2: Fetch unit summaries per floor (on expand — ~4-8 rows)
async function expandFloor(floorId: string) {
  const units = await supabase
    .from('units')
    .select('*')
    .eq('floor_id', floorId);
  // show unit rows
}

// Step 3: Fetch areas only when unit is expanded (~5 rows)
async function expandUnit(unitId: string) {
  const areas = await supabase
    .from('areas')
    .select('*, area_trade_status(*)')
    .eq('unit_id', unitId);
  // show area detail rows with trade cells
}
```

This changes from loading 780 × 14 = 10,920 cells upfront to loading ~30 rows initially. 100× faster.

### Fix D: Supabase query optimization

1. **Select only needed columns** — not `select('*')`:
```typescript
// SLOW
.select('*')

// FAST
.select('id, name, status, effective_pct, area_code')
```

2. **Use views or RPCs for complex queries**:
```sql
-- Create a materialized view for floor summaries
CREATE OR REPLACE VIEW floor_summaries AS
SELECT 
  a.floor,
  a.project_id,
  COUNT(DISTINCT a.id) as area_count,
  COUNT(DISTINCT CASE WHEN ats.status = 'blocked' THEN a.id END) as blocked_count,
  COUNT(DISTINCT CASE WHEN ats.status = 'ready' THEN a.id END) as ready_count,
  AVG(ats.effective_pct) as avg_progress
FROM areas a
LEFT JOIN area_trade_status ats ON a.id = ats.area_id
GROUP BY a.floor, a.project_id;
```

3. **Add missing indexes**:
```sql
-- Check these exist
CREATE INDEX IF NOT EXISTS idx_area_trade_status_area ON area_trade_status(area_id);
CREATE INDEX IF NOT EXISTS idx_areas_project_floor ON areas(project_id, floor);
CREATE INDEX IF NOT EXISTS idx_areas_unit ON areas(unit_id);
```

### Fix E: Cache layout data

The sidebar, user info, project selector, and notification count should be fetched ONCE and cached — not on every navigation.

```typescript
// In the dashboard layout (layout.tsx)
// Use React cache() or unstable_cache() for data that doesn't change often

import { cache } from 'react';

const getProjectData = cache(async (projectId: string) => {
  const [project, trades, memberCount] = await Promise.all([
    supabase.from('projects').select('id, name, address').eq('id', projectId).single(),
    supabase.from('trade_sequences').select('id, trade_name, sequence_order').eq('project_id', projectId),
    supabase.from('project_members').select('id', { count: 'exact' }).eq('project_id', projectId),
  ]);
  return { project: project.data, trades: trades.data, memberCount: memberCount.count };
});
```

### Fix F: Suspense boundaries for independent sections

On the Overview page, different sections can load independently:

```tsx
export default function OverviewPage() {
  return (
    <div>
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsCards projectId={pid} />
      </Suspense>

      <Suspense fallback={<AlertsSkeleton />}>
        <AlertsList projectId={pid} />
      </Suspense>

      <Suspense fallback={<ForecastSkeleton />}>
        <ForecastSummary projectId={pid} />
      </Suspense>
    </div>
  );
}
```

Each section loads and renders as soon as ITS data is ready, without waiting for the others.

### Fix G: Client-side navigation with prefetch

Make sure Next.js Link components have prefetch enabled:

```tsx
// In the sidebar
<Link href="/dashboard/readyboard" prefetch={true}>
  Ready Board
</Link>
```

This pre-loads the page JS bundle when the link is visible, so navigation is near-instant for the JS part.

---

## Step 4: VERIFY

After applying fixes, measure again:

```
Target: Every page loads in < 2 seconds
Acceptable: < 3 seconds
Unacceptable: > 5 seconds
```

Report the before/after times for each page.

---

## Run Order

1. DIAGNOSE (Step 1) — do NOT fix yet, just report
2. Report findings (Step 2)
3. Apply Fix A (loading.tsx) FIRST — instant improvement in perceived speed
4. Apply Fix B (Promise.all) — reduces actual load time
5. Apply Fix C (lazy load grid) — Ready Board specific
6. Apply remaining fixes as needed based on diagnosis
7. Measure again
8. `npx tsc --noEmit` and `npm run build`
