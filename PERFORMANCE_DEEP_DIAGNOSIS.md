# URGENT: Performance Still 10-12 Seconds — Deep Diagnosis

## The first round of fixes didn't solve it. We need deeper investigation.

Run EVERY diagnostic below and report the EXACT output. Do not fix anything until all diagnostics are complete.

---

## DIAGNOSTIC 1: Supabase Query Timing

Create a temporary test script that measures EVERY query the app makes. Run it server-side:

```typescript
// scripts/diagnose-queries.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to bypass RLS
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Use anon key WITH RLS
);

const PROJECT_ID = ''; // fill with demo project ID

async function diagnose() {
  console.log('=== QUERY TIMING WITH SERVICE ROLE (no RLS) ===\n');

  const queries = [
    { name: 'projects', fn: () => supabase.from('projects').select('*').eq('id', PROJECT_ID) },
    { name: 'floors (distinct)', fn: () => supabase.from('areas').select('floor').eq('project_id', PROJECT_ID) },
    { name: 'units', fn: () => supabase.from('units').select('*').eq('project_id', PROJECT_ID) },
    { name: 'areas (all)', fn: () => supabase.from('areas').select('*').eq('project_id', PROJECT_ID) },
    { name: 'areas (count)', fn: () => supabase.from('areas').select('id', { count: 'exact' }).eq('project_id', PROJECT_ID) },
    { name: 'trade_sequences', fn: () => supabase.from('trade_sequences').select('*').eq('project_id', PROJECT_ID) },
    { name: 'area_trade_status (all)', fn: () => supabase.from('area_trade_status').select('*').in('area_id', []) }, // will fill
    { name: 'delay_logs', fn: () => supabase.from('delay_logs').select('*').eq('project_id', PROJECT_ID) },
    { name: 'legal_documents', fn: () => supabase.from('legal_documents').select('*').eq('project_id', PROJECT_ID) },
    { name: 'corrective_actions', fn: () => supabase.from('corrective_actions').select('*').eq('project_id', PROJECT_ID) },
    { name: 'notifications', fn: () => supabase.from('notifications').select('*').limit(50) },
    { name: 'project_members', fn: () => supabase.from('project_members').select('*').eq('project_id', PROJECT_ID) },
    { name: 'field_reports (last 100)', fn: () => supabase.from('field_reports').select('*').eq('project_id', PROJECT_ID).order('reported_at', { ascending: false }).limit(100) },
    { name: 'forecast_snapshots', fn: () => supabase.from('forecast_snapshots').select('*').eq('project_id', PROJECT_ID) },
    { name: 'labor_rates', fn: () => supabase.from('labor_rates').select('*').eq('project_id', PROJECT_ID) },
    { name: 'trade_task_templates', fn: () => supabase.from('trade_task_templates').select('*').eq('project_id', PROJECT_ID) },
    { name: 'invite_tokens', fn: () => supabase.from('invite_tokens').select('*').eq('project_id', PROJECT_ID) },
    { name: 'project_subscriptions', fn: () => supabase.from('project_subscriptions').select('*').eq('project_id', PROJECT_ID) },
  ];

  // First get area IDs for the area_trade_status query
  const { data: areas } = await supabase.from('areas').select('id').eq('project_id', PROJECT_ID);
  const areaIds = areas?.map(a => a.id) || [];

  // Update the area_trade_status query with real IDs
  queries[6].fn = () => supabase.from('area_trade_status').select('*').in('area_id', areaIds);

  for (const q of queries) {
    const start = performance.now();
    const { data, error, count } = await q.fn();
    const elapsed = Math.round(performance.now() - start);
    const rows = Array.isArray(data) ? data.length : (count || 0);
    console.log(`${q.name.padEnd(35)} ${elapsed}ms \t ${rows} rows \t ${error ? 'ERROR: ' + error.message : 'OK'}`);
  }

  console.log('\n=== QUERY TIMING WITH ANON KEY (WITH RLS) ===\n');
  console.log('(Login as demo user first, or use the JWT token)\n');

  // Repeat key queries with anon key to measure RLS overhead
  const rlsQueries = [
    { name: 'areas (with RLS)', fn: () => supabaseAnon.from('areas').select('*').eq('project_id', PROJECT_ID) },
    { name: 'area_trade_status (with RLS)', fn: () => supabaseAnon.from('area_trade_status').select('*').in('area_id', areaIds.slice(0, 100)) },
    { name: 'trade_sequences (with RLS)', fn: () => supabaseAnon.from('trade_sequences').select('*').eq('project_id', PROJECT_ID) },
  ];

  for (const q of rlsQueries) {
    const start = performance.now();
    const { data, error } = await q.fn();
    const elapsed = Math.round(performance.now() - start);
    const rows = Array.isArray(data) ? data.length : 0;
    console.log(`${q.name.padEnd(35)} ${elapsed}ms \t ${rows} rows \t ${error ? 'ERROR: ' + error.message : 'OK'}`);
  }

  console.log('\n=== HEAVY QUERY: area_trade_status for ALL areas ===\n');
  const start = performance.now();
  const { data: allStatus } = await supabase
    .from('area_trade_status')
    .select('area_id, trade_type, effective_pct, status')
    .in('area_id', areaIds);
  console.log(`ALL area_trade_status: ${Math.round(performance.now() - start)}ms, ${allStatus?.length || 0} rows`);

  console.log('\n=== ROW COUNTS ===\n');
  for (const table of ['areas', 'units', 'area_trade_status', 'area_tasks', 'trade_task_templates', 'field_reports', 'delay_logs', 'notifications']) {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
    console.log(`${table.padEnd(30)} ${count} rows`);
  }
}

diagnose().catch(console.error);
```

Run with: `npx tsx scripts/diagnose-queries.ts`

**REPORT THE FULL OUTPUT.**

---

## DIAGNOSTIC 2: Page-Level Timing

Add timing to the ACTUAL page components. Find the server component for each page and wrap the data fetch:

```typescript
// In each page.tsx (server component)
export default async function ReadyBoardPage() {
  const overallStart = performance.now();

  console.log('[READYBOARD] Starting data fetch...');
  const fetchStart = performance.now();
  
  // ... existing data fetching code ...
  
  console.log(`[READYBOARD] Data fetch: ${Math.round(performance.now() - fetchStart)}ms`);
  console.log(`[READYBOARD] Total server time: ${Math.round(performance.now() - overallStart)}ms`);

  return <ReadyBoardClient data={data} />;
}
```

Do this for: Overview, Ready Board, Delays, Legal, Team, Settings, Billing.

Then navigate to each page and **report the console output from the Vercel logs or terminal.**

---

## DIAGNOSTIC 3: Check Supabase Dashboard

Go to your Supabase project dashboard:
1. **Database → Query Performance** — are there slow queries? Screenshot any query taking > 500ms.
2. **Database → Indexes** — how many indexes exist? Are the key ones present?
3. **API → Logs** — look at the last 50 requests. What's the average response time?

---

## DIAGNOSTIC 4: Check what each page actually fetches

For each slow page, list EVERY `supabase.from()` call and whether they're sequential or parallel:

```
OVERVIEW PAGE:
1. await getProject() ← 200ms
2. await getAlerts() ← 800ms  
3. await getForecasts() ← 300ms
4. await getDelays() ← 500ms
5. await getBriefing() ← 400ms
TOTAL SEQUENTIAL: 2200ms
TOTAL IF PARALLEL: 800ms (max of all)
```

**Report this for every page.**

---

## DIAGNOSTIC 5: Bundle and Route Analysis

```bash
# Check route sizes
npm run build 2>&1 | grep -E "Route|Size|─"

# Check if routes are static or dynamic
npm run build 2>&1 | grep -E "○|●|λ|ƒ"
```

Also check:
- Is there a barrel import pulling in everything? (e.g., `import { everything } from '@/lib'`)
- Are heavy libraries imported on every page? (e.g., recharts, dnd-kit on pages that don't use them)

```bash
# Check for large imports
npx @next/bundle-analyzer
# or
ANALYZE=true npm run build
```

---

## DIAGNOSTIC 6: Middleware overhead

Check `middleware.ts` — does it make Supabase calls on EVERY request?

```typescript
// If middleware does this, it adds latency to EVERY navigation:
export async function middleware(req) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession(); // ← network call on every request
  const { data: user } = await supabase.from('profiles').select('*')... // ← ANOTHER network call
  const { data: subscription } = await supabase.from('project_subscriptions')... // ← ANOTHER one
}
```

Every `await` in middleware adds to EVERY page navigation. Report exactly what the middleware does.

---

## AFTER DIAGNOSTICS: Apply Targeted Fixes

Based on what the diagnostics reveal, apply fixes in this priority:

### If middleware is the bottleneck:
- Cache the session/user data in a cookie or JWT claims
- Remove Supabase queries from middleware — only check the JWT token
- Move authorization checks to page-level, not middleware-level

### If RLS is the bottleneck:
- Simplify RLS policies — replace subqueries with JWT claims
- Add `project_id` as a JWT claim so RLS can check it without a subquery:
  ```sql
  -- SLOW RLS (subquery on every row):
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))
  
  -- FAST RLS (JWT claim, no subquery):
  USING (project_id = (auth.jwt() -> 'app_metadata' ->> 'project_id')::uuid)
  ```

### If area_trade_status is the bottleneck:
- Create a materialized view or summary table for floor/unit aggregates
- Don't fetch all 780 × 14 rows — fetch floor summaries first
- Add a Supabase RPC that returns pre-aggregated data:
  ```sql
  CREATE OR REPLACE FUNCTION get_floor_summaries(p_project_id UUID)
  RETURNS TABLE (
    floor TEXT,
    area_count INT,
    ready_count INT,
    blocked_count INT,
    avg_progress NUMERIC
  ) AS $$
    SELECT a.floor, COUNT(*)::INT, 
      COUNT(*) FILTER (WHERE ats.status = 'ready')::INT,
      COUNT(*) FILTER (WHERE ats.status = 'blocked')::INT,
      ROUND(AVG(ats.effective_pct), 1)
    FROM areas a
    LEFT JOIN area_trade_status ats ON a.id = ats.area_id
    WHERE a.project_id = p_project_id
    GROUP BY a.floor
    ORDER BY a.floor;
  $$ LANGUAGE sql STABLE;
  ```

### If sequential queries are the bottleneck:
- Wrap in Promise.all (already tried — check if it was actually applied)
- Reduce number of queries by using JOINs or RPCs

### If bundle size is the bottleneck:
- Dynamic imports for heavy components:
  ```typescript
  const ReadyBoardGrid = dynamic(() => import('./ReadyBoardGrid'), { 
    loading: () => <GridSkeleton />,
    ssr: false 
  });
  ```
- Move recharts, dnd-kit to dynamic imports on pages that use them

---

## TARGET

After fixes:
- **Overview:** < 2 seconds
- **Ready Board:** < 3 seconds (collapsed floors)
- **All other pages:** < 2 seconds
- **Navigation between pages:** < 1 second (prefetched)

Report before/after times for each page.
