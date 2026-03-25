/**
 * Backfill area_tasks for all existing areas in the seed project.
 *
 * Iterates every area + its trade_sequences, calls clone_task_templates_for_area
 * RPC for each combination. Idempotent — skips if area_tasks already exist.
 *
 * Run: npx tsx scripts/backfill-tasks.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load from apps/web/.env.local
config({ path: 'apps/web/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Ensure apps/web/.env.local has both variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== Backfill area_tasks ===\n');

  // 1. Check current state
  const { count: existingCount } = await supabase
    .from('area_tasks')
    .select('id', { count: 'exact', head: true });
  console.log(`Current area_tasks count: ${existingCount}`);

  if (existingCount && existingCount > 0) {
    console.log('area_tasks already populated. Skipping backfill.');
    return;
  }

  // 2. Get all areas with their project + area_type
  const { data: areas, error: areasErr } = await supabase
    .from('areas')
    .select('id, name, floor, area_type, project_id')
    .order('floor')
    .order('name');

  if (areasErr || !areas) {
    console.error('Failed to fetch areas:', areasErr?.message);
    process.exit(1);
  }
  console.log(`Found ${areas.length} areas.\n`);

  // 3. Get trade sequences per project + area_type
  const { data: allSequences, error: seqErr } = await supabase
    .from('trade_sequences')
    .select('project_id, area_type, trade_name')
    .order('sequence_order');

  if (seqErr || !allSequences) {
    console.error('Failed to fetch trade_sequences:', seqErr?.message);
    process.exit(1);
  }

  // Build lookup: projectId:areaType → trade_names[]
  const seqMap = new Map<string, string[]>();
  for (const seq of allSequences) {
    const key = `${seq.project_id}:${seq.area_type}`;
    if (!seqMap.has(key)) seqMap.set(key, []);
    seqMap.get(key)!.push(seq.trade_name);
  }

  // 4. Clone templates for each area × trade
  let totalCloned = 0;
  let areasProcessed = 0;

  for (const area of areas) {
    const key = `${area.project_id}:${area.area_type}`;
    const trades = seqMap.get(key);

    if (!trades || trades.length === 0) {
      console.warn(`  SKIP ${area.name} (floor ${area.floor}) — no trade_sequences for ${area.area_type}`);
      continue;
    }

    let areaTotal = 0;
    for (const tradeName of trades) {
      const { data: count, error: rpcErr } = await supabase.rpc(
        'clone_task_templates_for_area',
        {
          p_area_id: area.id,
          p_trade_type: tradeName,
          p_area_type: area.area_type,
        }
      );

      if (rpcErr) {
        console.error(`  ERROR ${area.name}/${tradeName}: ${rpcErr.message}`);
        continue;
      }

      areaTotal += (count as number) || 0;
    }

    totalCloned += areaTotal;
    areasProcessed++;
    console.log(`  ${area.name} (floor ${area.floor}, ${area.area_type}): ${areaTotal} tasks cloned across ${trades.length} trades`);
  }

  // 5. Verify final count
  const { count: finalCount } = await supabase
    .from('area_tasks')
    .select('id', { count: 'exact', head: true });

  console.log(`\n=== Results ===`);
  console.log(`Areas processed: ${areasProcessed}/${areas.length}`);
  console.log(`Tasks cloned: ${totalCloned}`);
  console.log(`Final area_tasks count: ${finalCount}`);
  console.log(`Expected: ~${areasProcessed} areas × ~12 trades × ~4 tasks = ~${areasProcessed * 12 * 4}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
