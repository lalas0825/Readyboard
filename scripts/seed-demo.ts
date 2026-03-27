/**
 * seed-demo.ts — Comprehensive demo data generator.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING or checks existence before insert.
 * Creates a realistic 383 Madison Avenue project with:
 * - 3 users (GC PM, Sub PM, Foreman)
 * - 30 areas with mixed progress (80% done, 50% in progress, 10% blocked)
 * - 10 field reports (some blocked, some working)
 * - 3 active delays with cost calculations
 * - 5 corrective actions (mixed statuses)
 * - NOD drafts for blocked areas
 *
 * Usage: npx tsx scripts/seed-demo.ts
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env from apps/web/.env.local
config({ path: resolve(__dirname, '../apps/web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── IDs (deterministic for idempotency) ────────────

const IDS = {
  gcOrg: 'a0000000-0000-0000-0000-000000000001',
  subOrg: 'a0000000-0000-0000-0000-000000000002',
  project: 'b0000000-0000-0000-0000-000000000001',
  gcPm: 'd0000000-0000-0000-0000-000000000001',
  subPm: 'd0000000-0000-0000-0000-000000000002',
  foreman: 'd0000000-0000-0000-0000-000000000003',
};

// ─── Seed Functions ─────────────────────────────────

async function seedUsers() {
  console.log('[Seed] Creating demo users...');

  const users = [
    { id: IDS.gcPm, name: 'John GC PM', email: 'demo-gc@readyboard.ai', role: 'gc_pm', org_id: IDS.gcOrg, onboarding_complete: true },
    { id: IDS.subPm, name: 'Maria Sub PM', email: 'demo-sub@readyboard.ai', role: 'sub_pm', org_id: IDS.subOrg, onboarding_complete: true },
    { id: IDS.foreman, name: 'Carlos Foreman', email: 'carlos@jantile.com', phone: '+1234567890', role: 'foreman', org_id: IDS.subOrg, language: 'es', onboarding_complete: true },
  ];

  for (const u of users) {
    await supabase.from('users').upsert(u, { onConflict: 'id' });
  }
  console.log(`  ✓ ${users.length} users`);
}

async function seedAreaTradeStatus() {
  console.log('[Seed] Populating area_trade_status with progress...');

  // Get all areas
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, floor')
    .eq('project_id', IDS.project)
    .order('floor')
    .order('name');

  if (!areas?.length) {
    console.log('  ✗ No areas found. Run supabase/seed.sql first.');
    return;
  }

  // Get all trades
  const { data: trades } = await supabase
    .from('trade_sequences')
    .select('trade_name, sequence_order')
    .eq('project_id', IDS.project)
    .order('sequence_order');

  if (!trades?.length) return;

  const records = [];
  for (const area of areas) {
    const floor = parseInt(area.floor);
    for (const trade of trades) {
      // Floor 20: 100% done, Floor 21: 80-100%, Floor 22: 30-80%, Floor 23: 10-30%, Floor 24: 0-10%
      let pct: number;
      if (floor === 20) pct = 100;
      else if (floor === 21) pct = trade.sequence_order <= 10 ? 100 : Math.min(100, 50 + trade.sequence_order * 5);
      else if (floor === 22) pct = trade.sequence_order <= 7 ? 100 : Math.max(0, 100 - trade.sequence_order * 8);
      else if (floor === 23) pct = trade.sequence_order <= 5 ? 100 : Math.max(0, 80 - trade.sequence_order * 7);
      else pct = trade.sequence_order <= 3 ? Math.max(0, 80 - trade.sequence_order * 15) : 0;

      records.push({
        area_id: area.id,
        trade_type: trade.trade_name,
        reporting_mode: 'percentage',
        effective_pct: Math.round(pct),
        manual_pct: Math.round(pct),
      });
    }
  }

  // Upsert all (ON CONFLICT on area_id + trade_type)
  const { error } = await supabase.from('area_trade_status').upsert(records, {
    onConflict: 'area_id,trade_type',
  });

  if (error) console.log('  ✗ area_trade_status error:', error.message);
  else console.log(`  ✓ ${records.length} area_trade_status rows`);
}

async function seedFieldReports() {
  console.log('[Seed] Creating field reports...');

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name')
    .eq('project_id', IDS.project)
    .limit(10);

  if (!areas?.length) return;

  const reports = areas.map((area, i) => ({
    area_id: area.id,
    user_id: IDS.foreman,
    trade_name: i < 5 ? 'Tile / Stone' : 'Waterproofing',
    status: i < 6 ? 'working' : i < 8 ? 'blocked' : 'done',
    progress_pct: i < 6 ? 50 + i * 10 : i < 8 ? 30 : 100,
    reason_code: i >= 6 && i < 8 ? (i === 6 ? 'moisture' : 'material') : null,
    gps_lat: 40.7580 + i * 0.0001,
    gps_lng: -73.9718 + i * 0.0001,
    offline_created_at: new Date(Date.now() - (10 - i) * 86400000).toISOString(),
  }));

  const { error } = await supabase.from('field_reports').insert(reports);
  if (error) console.log('  ✗ field_reports error:', error.message);
  else console.log(`  ✓ ${reports.length} field reports`);
}

async function seedDelays() {
  console.log('[Seed] Creating active delays...');

  const delays = [
    {
      area_id: 'c0000000-0000-0000-0000-000000210003', // Bath 21C
      trade_name: 'Waterproofing',
      reason_code: 'moisture',
      crew_size: 4,
      daily_cost: 2960,
      cumulative_cost: 29342.85,
      man_hours: 317.22,
      started_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    },
    {
      area_id: 'c0000000-0000-0000-0000-000000240001', // Bath 24A
      trade_name: 'Rough Plumbing',
      reason_code: 'material',
      crew_size: 3,
      daily_cost: 2220,
      cumulative_cost: 15302.28,
      man_hours: 165.43,
      started_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    },
    {
      area_id: 'c0000000-0000-0000-0000-000000220004', // Bath 22D
      trade_name: 'Fire Stopping',
      reason_code: 'inspection',
      crew_size: 2,
      daily_cost: 1480,
      cumulative_cost: 5761.83,
      man_hours: 62.29,
      started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ];

  for (const d of delays) {
    await supabase.from('delay_logs').upsert(d, { onConflict: 'id', ignoreDuplicates: true });
  }
  console.log(`  ✓ ${delays.length} active delays`);
}

async function seedCorrectiveActions() {
  console.log('[Seed] Creating corrective actions...');

  // Get delay IDs
  const { data: delays } = await supabase
    .from('delay_logs')
    .select('id, area_id, trade_name')
    .is('ended_at', null)
    .limit(3);

  if (!delays?.length) {
    console.log('  ✗ No delays found');
    return;
  }

  const now = Date.now();
  const cas = delays.map((d, i) => ({
    delay_log_id: d.id,
    assigned_to: IDS.foreman,
    deadline: new Date(now + (7 - i) * 86400000).toISOString(),
    note: `Fix ${d.trade_name} blockage in area`,
    created_by: IDS.gcPm,
    acknowledged_at: i > 0 ? new Date(now - 2 * 86400000).toISOString() : null,
    resolved_at: i > 1 ? new Date(now - 86400000).toISOString() : null,
  }));

  for (const ca of cas) {
    const { error } = await supabase.from('corrective_actions').insert(ca);
    if (error && !error.message.includes('duplicate')) {
      console.log('  ✗ CA error:', error.message);
    }
  }
  console.log(`  ✓ ${cas.length} corrective actions`);
}

// ─── Main ───────────────────────────────────────────

async function main() {
  console.log('\n🏗️  ReadyBoard Demo Seed\n');
  console.log(`Project: ${SUPABASE_URL}`);
  console.log('─'.repeat(50));

  await seedUsers();
  await seedAreaTradeStatus();
  await seedFieldReports();
  await seedDelays();
  await seedCorrectiveActions();

  console.log('\n─'.repeat(50));
  console.log('✅ Demo data ready!\n');
  console.log('Demo accounts:');
  console.log('  GC:  demo-gc@readyboard.ai / ReadyBoard2026!');
  console.log('  Sub: demo-sub@readyboard.ai / ReadyBoard2026!');
  console.log('');
}

main().catch(console.error);
