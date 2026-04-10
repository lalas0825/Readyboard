import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const GC_USER_ID = '70755d4e-9029-40f2-aba8-4c538335826b';

async function time(name: string, fn: () => Promise<unknown>) {
  const start = performance.now();
  const res = await fn() as { data: unknown; error: { message: string } | null; count?: number | null };
  const ms = Math.round(performance.now() - start);
  const rows = Array.isArray(res.data) ? res.data.length : (res.count ?? 0);
  const status = res.error ? 'ERR: ' + res.error.message.slice(0, 40) : 'OK';
  console.log(`  ${name.padEnd(42)} ${String(ms + 'ms').padStart(7)}  ${String(rows + ' rows').padStart(10)}  ${status}`);
  return ms;
}

async function main() {
  console.log('\n====================================================');
  console.log('READYBOARD — QUERY TIMING DIAGNOSIS');
  console.log('====================================================\n');

  const { data: areas } = await supabase.from('areas').select('id').eq('project_id', PROJECT_ID);
  const areaIds = (areas ?? []).map((a: Record<string, string>) => a.id);
  console.log('Project: 383 Madison Ave | Areas:', areaIds.length, '\n');

  console.log('── INDIVIDUAL QUERY TIMES (service role) ─────────────\n');
  const r: Record<string, number> = {};

  r.users_by_id     = await time('users (by id, single)',            () => supabase.from('users').select('id,role,org_id,name,email').eq('id', GC_USER_ID).single());
  r.projects        = await time('projects (list)',                   () => supabase.from('projects').select('id,name').order('name'));
  r.project_sub     = await time('project_subscriptions',            () => supabase.from('project_subscriptions').select('status,trial_ends_at').eq('project_id', PROJECT_ID).limit(1).maybeSingle());
  r.trade_sequences = await time('trade_sequences',                  () => supabase.from('trade_sequences').select('trade_name,phase_label,sequence_order').eq('project_id', PROJECT_ID).order('sequence_order'));
  r.units           = await time('units',                            () => supabase.from('units').select('id,name,floor,unit_type,sort_order').eq('project_id', PROJECT_ID));
  r.delay_logs      = await time('delay_logs (active, joined)',      () => supabase.from('delay_logs').select('id,area_id,trade_name,reason_code,cumulative_cost,daily_cost,man_hours,crew_size,started_at,areas!inner(project_id)').eq('areas.project_id', PROJECT_ID).is('ended_at', null));
  r.ats_plain       = await time('area_trade_status (IN areaIds)',   () => supabase.from('area_trade_status').select('area_id,trade_type,effective_pct,all_gates_passed,gc_verification_pending').in('area_id', areaIds));
  r.ats_joined      = await time('area_trade_status + areas JOIN',   () => supabase.from('area_trade_status').select('area_id,trade_type,effective_pct,all_gates_passed,gc_verification_pending,areas!inner(name,floor,area_type,project_id,unit_id,area_code,description,sort_order,units(id,name,unit_type,sort_order))').eq('areas.project_id', PROJECT_ID));
  r.corrective      = await time('corrective_actions',               () => supabase.from('corrective_actions').select('id,delay_log_id,note,acknowledged_at,in_resolution_at,resolved_at').limit(20));
  r.area_tasks      = await time('area_tasks (count)',               () => supabase.from('area_tasks').select('id', { count: 'exact', head: true }).in('area_id', areaIds));
  r.forecast        = await time('forecast_snapshots (14d)',         () => supabase.from('forecast_snapshots').select('snapshot_date,effective_pct,actual_rate,projected_date,scheduled_date').eq('project_id', PROJECT_ID).eq('trade_type', 'PROJECT').is('area_id', null).order('snapshot_date').limit(20));
  r.templates       = await time('trade_task_templates',             () => supabase.from('trade_task_templates').select('*').eq('project_id', PROJECT_ID));
  r.members         = await time('project_members',                  () => supabase.from('project_members').select('*').eq('project_id', PROJECT_ID));

  console.log('\n── SIMULATED PAGE LOAD TIMES ─────────────────────────\n');

  let t = performance.now();
  await Promise.all([
    supabase.from('projects').select('id,name').order('name'),
    supabase.from('project_subscriptions').select('status,trial_ends_at').eq('project_id', PROJECT_ID).limit(1).maybeSingle(),
  ]);
  console.log(`  Layout  (projects + sub, parallel)             ${Math.round(performance.now()-t)}ms`);

  t = performance.now();
  await Promise.all([
    supabase.from('area_trade_status').select('area_id,effective_pct,gc_verification_pending,areas!inner(project_id)').eq('areas.project_id', PROJECT_ID),
    supabase.from('delay_logs').select('area_id,areas!inner(project_id)').eq('areas.project_id', PROJECT_ID).is('ended_at', null),
  ]);
  console.log(`  Overview (metrics + alerts, parallel)          ${Math.round(performance.now()-t)}ms`);

  t = performance.now();
  await Promise.all([
    supabase.from('area_trade_status').select('area_id,trade_type,effective_pct,all_gates_passed,gc_verification_pending,areas!inner(name,floor,area_type,project_id,unit_id,area_code,description,sort_order,units(id,name,unit_type,sort_order))').eq('areas.project_id', PROJECT_ID),
    supabase.from('trade_sequences').select('trade_name,phase_label,sequence_order').eq('project_id', PROJECT_ID).order('sequence_order'),
    supabase.from('delay_logs').select('id,area_id,trade_name,reason_code,cumulative_cost,daily_cost,man_hours,crew_size,started_at,areas!inner(project_id)').eq('areas.project_id', PROJECT_ID).is('ended_at', null),
    supabase.from('units').select('id,name,floor,unit_type,sort_order').eq('project_id', PROJECT_ID),
  ]);
  console.log(`  Ready Board (4 parallel queries)               ${Math.round(performance.now()-t)}ms`);

  console.log('\n── SORTED SLOWEST → FASTEST ──────────────────────────\n');
  for (const [name, ms] of Object.entries(r).sort(([,a],[,b]) => b-a)) {
    const bar = '█'.repeat(Math.min(50, Math.round(ms/5)));
    console.log(`  ${name.padEnd(28)} ${String(ms+'ms').padStart(7)}  ${bar}`);
  }

  const savedPerNav = r.users_by_id + r.project_sub;
  console.log(`\n  Middleware overhead BEFORE fix:  users(${r.users_by_id}ms) + sub(${r.project_sub}ms) = ${savedPerNav}ms/navigation`);
  console.log(`  Middleware overhead AFTER fix:   ~0ms (JWT read, no DB)`);
  console.log(`  Saving:                          ~${savedPerNav}ms per page navigation\n`);
}

main().catch(console.error);
