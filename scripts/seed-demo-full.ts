/**
 * seed-demo-full.ts — 3-month historical demo data generator.
 *
 * Simulates a project that started Jan 5 2026 and is ~33% complete today.
 * Creates realistic wave pattern (green bottom → gray top) in Ready Board.
 *
 * Usage: npx tsx scripts/seed-demo-full.ts
 * Idempotent: clears volatile demo data first, then re-seeds fresh.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../apps/web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Fixed IDs ────────────────────────────────────────

const IDS = {
  gcOrg:   'a0000000-0000-0000-0000-000000000001',
  subOrg:  'a0000000-0000-0000-0000-000000000002',
  project: 'b0000000-0000-0000-0000-000000000001',
  // Legacy seed IDs (exist in users table, NOT in auth.users)
  gcPm:    'd0000000-0000-0000-0000-000000000001',
  subPm:   'd0000000-0000-0000-0000-000000000002',
  // Real auth.users IDs (use these wherever FK → auth.users is required)
  authGcPm:    '70755d4e-9029-40f2-aba8-4c538335826b',
  authSubPm:   '89355c82-4d44-4be0-8643-9416609397f6',
  authForeman: '33031ee8-9fe8-4961-89d4-70d653ac8a1e',
  // Extra display users (only inserted in users table)
  mikechen:   'd0000000-0000-0000-0000-000000000004',
  sarahj:     'd0000000-0000-0000-0000-000000000005',
  salmoretti: 'd0000000-0000-0000-0000-000000000006',
  tomgarcia:  'd0000000-0000-0000-0000-000000000007',
};

const TODAY = new Date('2026-04-04');
const PROJECT_START = new Date('2026-01-05');

// ─── Helpers ──────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function atTime(dateStr: string, hour: number, minute = 0): string {
  const d = new Date(dateStr);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jitter(base: number, range: number): number {
  return Math.max(0, Math.min(100, base + (Math.random() - 0.5) * range * 2));
}

// ─── STEP 0: Clear volatile demo data ────────────────

async function clearDemoData() {
  console.log('[Clear] Removing existing volatile demo data...');

  // Delete in FK order (dependents first)
  // (no-op placeholder — receipt_events cleaned below per-document)

  const { data: docs } = await supabase.from('legal_documents').select('id').eq('project_id', IDS.project);
  if (docs?.length) {
    for (const doc of docs) {
      await supabase.from('receipt_events').delete().eq('document_id', doc.id);
    }
  }
  await supabase.from('legal_documents').delete().eq('project_id', IDS.project);

  const { data: delays } = await supabase.from('delay_logs').select('id').eq('area_id.project_id', IDS.project).limit(1000);
  // Get all area IDs for this project first
  const { data: allAreas } = await supabase.from('areas').select('id').eq('project_id', IDS.project);
  const areaIds = allAreas?.map(a => a.id) ?? [];

  if (areaIds.length) {
    // nod_drafts
    const { data: nodDrafts } = await supabase.from('nod_drafts').select('id').in('delay_log_id',
      (await supabase.from('delay_logs').select('id').in('area_id', areaIds)).data?.map(d => d.id) ?? []
    );
    if (nodDrafts?.length) {
      await supabase.from('nod_drafts').delete().in('id', nodDrafts.map(n => n.id));
    }

    // corrective_actions
    const { data: delayIds } = await supabase.from('delay_logs').select('id').in('area_id', areaIds);
    if (delayIds?.length) {
      await supabase.from('corrective_actions').delete().in('delay_log_id', delayIds.map(d => d.id));
    }

    await supabase.from('delay_logs').delete().in('area_id', areaIds);
    await supabase.from('field_reports').delete().in('area_id', areaIds);
    await supabase.from('area_trade_status').delete().in('area_id', areaIds);
    await supabase.from('forecast_snapshots').delete().eq('project_id', IDS.project);
  }

  console.log('  ✓ Cleared');
}

// ─── STEP 1: Extra team members ───────────────────────

async function seedExtraUsers() {
  console.log('[Users] Adding team members...');

  const extras = [
    { id: IDS.mikechen,   name: 'Mike Chen',       email: 'mike@demo.readyboard.ai',   role: 'gc_pm',   org_id: IDS.gcOrg,  onboarding_complete: true },
    { id: IDS.sarahj,     name: 'Sarah Johnson',   email: 'sarah@demo.readyboard.ai',  role: 'gc_super',org_id: IDS.gcOrg,  onboarding_complete: true },
    { id: IDS.salmoretti, name: 'Sal Moretti',      email: 'sal@demo.readyboard.ai',    role: 'sub_pm',  org_id: IDS.subOrg, onboarding_complete: true },
    { id: IDS.tomgarcia,  name: 'Tom Garcia',       email: 'tom@demo.readyboard.ai',    role: 'sub_pm',  org_id: IDS.subOrg, onboarding_complete: true },
  ];

  for (const u of extras) {
    const { error } = await supabase.from('users').upsert(u, { onConflict: 'id' });
    if (error && !error.message.includes('duplicate') && !error.message.includes('violates')) {
      console.log(`  ⚠ user ${u.name}:`, error.message);
    }
  }
  console.log(`  ✓ ${extras.length} extra team members`);
}

// ─── STEP 2: area_trade_status — wave pattern ─────────

async function seedAreaTradeStatus() {
  console.log('[Grid] Generating area_trade_status wave pattern...');

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, floor')
    .eq('project_id', IDS.project)
    .order('floor')
    .order('name');

  if (!areas?.length) { console.log('  ✗ No areas found'); return; }

  const { data: trades } = await supabase
    .from('trade_sequences')
    .select('trade_name, sequence_order')
    .eq('project_id', IDS.project)
    .order('sequence_order');

  if (!trades?.length) { console.log('  ✗ No trades found'); return; }

  // Unique floors sorted numerically
  const floors = Array.from(new Set(areas.map((a: any) => a.floor))).sort((a: string, b: string) => {
    return (parseInt(a) || 0) - (parseInt(b) || 0);
  });

  // Wave: bottom floor = most complete, top = least
  // Map floor → completion % (0-100)
  const floorPctMap = new Map<string, number>();
  floors.forEach((fl, idx) => {
    const ratio = 1 - idx / Math.max(floors.length - 1, 1); // 1.0 → 0.0
    // Zone boundaries matching the spec
    let base: number;
    if (ratio >= 0.82) base = jitter(95, 5);    // bottom ~18%: 90-100%
    else if (ratio >= 0.62) base = jitter(70, 10); // next 20%: 60-80%
    else if (ratio >= 0.44) base = jitter(40, 10); // next 18%: 30-50%
    else if (ratio >= 0.28) base = jitter(17, 7);  // next 16%: 10-25%
    else if (ratio >= 0.12) base = jitter(3, 3);   // next 16%: 0-5%
    else base = 0;                                  // top 12%: not started
    floorPctMap.set(fl, base);
  });

  const tradeCount = trades.length;
  const records: object[] = [];

  for (const area of areas) {
    const floorPct = floorPctMap.get(area.floor) ?? 0;
    // How many whole trades completed?
    const tradesDone = Math.floor(floorPct / 100 * tradeCount);

    for (const trade of trades) {
      const tIdx = trade.sequence_order - 1; // 0-based
      let pct: number;

      if (tIdx < tradesDone) {
        pct = 100;
      } else if (tIdx === tradesDone) {
        // Active trade — pct within the trade
        const tradeProgress = (floorPct / 100 * tradeCount) - tradesDone;
        pct = Math.round(jitter(tradeProgress * 100, 10));
      } else {
        pct = 0;
      }

      records.push({
        area_id: area.id,
        trade_type: trade.trade_name,
        reporting_mode: 'percentage',
        manual_pct: pct,
        calculated_pct: pct,
        effective_pct: pct,
      });
    }
  }

  // Batch upsert in chunks of 500
  let inserted = 0;
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const { error } = await supabase.from('area_trade_status').upsert(chunk as any, {
      onConflict: 'area_id,trade_type',
    });
    if (error) { console.log('  ✗ area_trade_status:', error.message); return; }
    inserted += chunk.length;
  }
  console.log(`  ✓ ${inserted} rows (${areas.length} areas × ${tradeCount} trades)`);
}

// ─── STEP 3: Field reports (representative subset) ───

async function seedFieldReports() {
  console.log('[Reports] Creating field reports...');

  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, floor')
    .eq('project_id', IDS.project)
    .order('floor')
    .order('name')
    .limit(40);

  if (!areas?.length) return;

  const { data: trades } = await supabase
    .from('trade_sequences')
    .select('trade_name, sequence_order')
    .eq('project_id', IDS.project)
    .order('sequence_order');

  if (!trades?.length) return;

  const reports: object[] = [];
  const floors = Array.from(new Set((areas ?? []).map((a: any) => a.floor))).sort((a: string, b: string) => (parseInt(a)||0) - (parseInt(b)||0));

  // Create 3-5 reports per area spread over last 90 days
  for (const area of areas) {
    const floorIdx = floors.indexOf(area.floor);
    const ratio = 1 - floorIdx / Math.max(floors.length - 1, 1);
    const activeTrade = trades[Math.min(Math.floor(ratio * trades.length), trades.length - 1)];

    const reportCount = rand(2, 5);
    for (let r = 0; r < reportCount; r++) {
      const daysBack = rand(1, 85);
      const hour = rand(7, 15);
      const pct = Math.min(100, rand(20, 95));
      reports.push({
        area_id: area.id,
        user_id: IDS.authForeman,
        trade_name: activeTrade.trade_name,
        status: pct >= 100 ? 'done' : pct > 0 ? 'working' : 'working',
        progress_pct: pct,
        gps_lat: 40.7549 + (Math.random() - 0.5) * 0.001,
        gps_lng: -73.9840 + (Math.random() - 0.5) * 0.001,
        offline_created_at: daysAgo(daysBack),
        created_at: atTime(daysAgo(daysBack), hour),
      });
    }
  }

  const { error } = await supabase.from('field_reports').insert(reports as any);
  if (error) console.log('  ✗ field_reports:', error.message);
  else console.log(`  ✓ ${reports.length} field reports`);
}

// ─── STEP 4: Delays ──────────────────────────────────

type DelayRecord = {
  id: string;
  area_id: string;
  trade_name: string;
  reason_code: string;
  started_at: string;
  ended_at: string | null;
  crew_size: number;
  daily_cost: number;
  cumulative_cost: number;
  man_hours: number;
  _desc?: string;
};

async function seedDelays(): Promise<DelayRecord[]> {
  console.log('[Delays] Creating delay scenarios...');

  // Query areas — we'll find by name patterns
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, floor')
    .eq('project_id', IDS.project)
    .order('floor')
    .order('name');

  if (!areas?.length) { console.log('  ✗ No areas'); return []; }

  // Pick specific areas from lower/middle floors for delays
  const floors = Array.from(new Set(areas.map((a: any) => a.floor))).sort((a: string, b: string) => (parseInt(a)||0) - (parseInt(b)||0));
  const nFloors = floors.length;

  // Helper: get first area from floor at a given fractional position
  function areaAtFloor(floorFraction: number, nameFrag?: string): string {
    const fl = floors[Math.min(Math.floor(floorFraction * nFloors), nFloors - 1)];
    const candidates = areas.filter(a => a.floor === fl);
    if (nameFrag) {
      const match = candidates.find(a => a.name.toLowerCase().includes(nameFrag.toLowerCase()));
      if (match) return match.id;
    }
    return candidates[0]?.id ?? areas[0].id;
  }

  const DELAYS: Omit<DelayRecord, 'id'>[] = [
    // ── Resolved delays (weeks/months ago) ──────────
    {
      area_id: areaAtFloor(0.1, 'bath'),
      trade_name: 'Waterproofing',
      reason_code: 'no_heat',
      started_at: daysAgo(74),
      ended_at: daysAgo(71),
      crew_size: 4,
      daily_cost: 2960,
      cumulative_cost: 8880,
      man_hours: 88,
      _desc: 'HVAC not operational Floor 5. Min 50°F for membrane curing.',
    },
    {
      area_id: areaAtFloor(0.2, 'kitchen'),
      trade_name: 'Tile / Stone',
      reason_code: 'prior_trade',
      started_at: daysAgo(60),
      ended_at: daysAgo(58),
      crew_size: 6,
      daily_cost: 4150,
      cumulative_cost: 8300,
      man_hours: 96,
      _desc: 'Waterproofing incomplete on Floor 8B Kitchen. Tile crew idle.',
    },
    {
      area_id: areaAtFloor(0.3, 'corridor'),
      trade_name: 'Insulation & Drywall',
      reason_code: 'inspection',
      started_at: daysAgo(49),
      ended_at: daysAgo(46),
      crew_size: 5,
      daily_cost: 3220,
      cumulative_cost: 9660,
      man_hours: 105,
      _desc: 'MEP rough-in inspection failed. Drywall crew on standby.',
    },
    {
      area_id: areaAtFloor(0.35, 'bath'),
      trade_name: 'Tile / Stone',
      reason_code: 'material',
      started_at: daysAgo(38),
      ended_at: daysAgo(34),
      crew_size: 6,
      daily_cost: 4150,
      cumulative_cost: 16600,
      man_hours: 160,
      _desc: 'Marble shipment delayed from Italy. Tile crew reassigned to Floor 14.',
    },
    {
      area_id: areaAtFloor(0.27, 'bath'),
      trade_name: 'Rough Plumbing',
      reason_code: 'no_access',
      started_at: daysAgo(30),
      ended_at: daysAgo(27),
      crew_size: 4,
      daily_cost: 2800,
      cumulative_cost: 8400,
      man_hours: 84,
      _desc: 'Architect changed fixture layout. Plumbing rework required.',
    },
    // ── Active delays (happening NOW) ───────────────
    {
      area_id: areaAtFloor(0.48, 'bath'),
      trade_name: 'Waterproofing',
      reason_code: 'no_heat',
      started_at: daysAgo(6),
      ended_at: null,
      crew_size: 4,
      daily_cost: 2960,
      cumulative_cost: 2960 * 6,
      man_hours: 4 * 6 * 7,
      _desc: 'Temporary heater failed on Floors 17-19. Current: 38°F, min 50°F required.',
    },
    {
      area_id: areaAtFloor(0.52, 'kitchen'),
      trade_name: 'Metal Stud Framing',
      reason_code: 'material',
      started_at: daysAgo(4),
      ended_at: null,
      crew_size: 6,
      daily_cost: 3680,
      cumulative_cost: 3680 * 4,
      man_hours: 6 * 4 * 7,
      _desc: 'Steel stud delivery delayed. Framing crew idle since Monday.',
    },
    {
      area_id: areaAtFloor(0.44, 'powder'),
      trade_name: 'Tile / Stone',
      reason_code: 'prior_trade',
      started_at: daysAgo(5),
      ended_at: null,
      crew_size: 4,
      daily_cost: 2760,
      cumulative_cost: 2760 * 5,
      man_hours: 4 * 5 * 7,
      _desc: 'Waterproofing on 16C Powder Room at 61%. Tile crew waiting.',
    },
  ];

  const inserted: DelayRecord[] = [];
  for (const d of DELAYS) {
    const { data, error } = await supabase
      .from('delay_logs')
      .insert({
        area_id: d.area_id,
        trade_name: d.trade_name,
        reason_code: d.reason_code,
        started_at: d.started_at,
        ended_at: d.ended_at,
        crew_size: d.crew_size,
        daily_cost: d.daily_cost,
        cumulative_cost: d.cumulative_cost,
        man_hours: d.man_hours,
      })
      .select()
      .single();

    if (error) { console.log('  ✗ delay insert:', error.message); }
    else if (data) inserted.push({ ...d, id: data.id });
  }

  // Mark active delay areas as blocked in area_trade_status
  for (const d of inserted.filter(d => !d.ended_at)) {
    await supabase.from('area_trade_status').upsert({
      area_id: d.area_id,
      trade_type: d.trade_name,
      effective_pct: 0,
      manual_pct: 0,
      calculated_pct: 0,
      reporting_mode: 'percentage',
    }, { onConflict: 'area_id,trade_type' });
  }

  console.log(`  ✓ ${inserted.length} delays (${inserted.filter(d => !d.ended_at).length} active, ${inserted.filter(d => !!d.ended_at).length} resolved)`);
  return inserted;
}

// ─── STEP 5: Corrective Actions ───────────────────────

async function seedCorrectiveActions(delays: DelayRecord[]) {
  console.log('[CAs] Creating corrective actions...');

  if (!delays.length) return;

  const cas: object[] = [
    // Resolved CAs
    {
      delay_log_id: delays[0]?.id,
      assigned_to: IDS.authForeman,
      created_by: IDS.gcPm,
      note: 'Temporary heater installed on Floor 5. HVAC contractor accelerating.',
      deadline: atTime(daysAgo(73), 17),
      acknowledged_at: atTime(daysAgo(74), 10),
      in_resolution_at: atTime(daysAgo(73), 8),
      resolved_at: atTime(daysAgo(72), 14),
    },
    {
      delay_log_id: delays[1]?.id,
      assigned_to: IDS.subPm,
      created_by: IDS.gcPm,
      note: 'Waterproofing crew added 2 workers. Expected completion tomorrow.',
      deadline: atTime(daysAgo(59), 17),
      acknowledged_at: atTime(daysAgo(60), 9),
      in_resolution_at: atTime(daysAgo(59), 7),
      resolved_at: atTime(daysAgo(58), 16),
    },
    {
      delay_log_id: delays[3]?.id,
      assigned_to: IDS.subPm,
      created_by: IDS.gcPm,
      note: 'Material sourced from local supplier as temporary. Italian marble ETA March 1.',
      deadline: atTime(daysAgo(37), 17),
      acknowledged_at: atTime(daysAgo(38), 11),
      in_resolution_at: atTime(daysAgo(37), 8),
      resolved_at: atTime(daysAgo(35), 15),
    },
    // In-progress CA
    {
      delay_log_id: delays[5]?.id,
      assigned_to: IDS.gcPm,
      created_by: IDS.gcPm,
      note: 'Replacement heater ordered. ETA tomorrow 8am. Crew reassigned to Floor 16.',
      deadline: atTime(daysAgo(2), 17),
      acknowledged_at: atTime(daysAgo(6), 10),
      in_resolution_at: atTime(daysAgo(5), 8),
      resolved_at: null,
    },
    // Open (no response)
    {
      delay_log_id: delays[6]?.id,
      assigned_to: IDS.gcPm,
      created_by: IDS.gcPm,
      note: null,
      deadline: atTime(daysAgo(-3), 17), // future deadline
      acknowledged_at: null,
      in_resolution_at: null,
      resolved_at: null,
    },
    // Acknowledged but not started
    {
      delay_log_id: delays[7]?.id,
      assigned_to: IDS.subPm,
      created_by: IDS.gcPm,
      note: 'WP crew adding workers. Estimated 2 more days.',
      deadline: atTime(daysAgo(-1), 17),
      acknowledged_at: atTime(daysAgo(4), 14),
      in_resolution_at: null,
      resolved_at: null,
    },
  ].filter(ca => ca.delay_log_id); // only if delay was created

  let ok = 0;
  for (const ca of cas) {
    const { error } = await supabase.from('corrective_actions').insert(ca as any);
    if (error && !error.message.includes('duplicate')) {
      console.log('  ✗ CA error:', error.message);
    } else ok++;
  }
  console.log(`  ✓ ${ok} corrective actions`);
}

// ─── STEP 6: NOD Drafts + Legal Documents ────────────

async function seedLegalDocs(delays: DelayRecord[]) {
  console.log('[Legal] Creating NOD drafts and legal documents...');

  // NOD draft (pending, for active delay #7 — tile waiting on WP)
  if (delays[7]?.id) {
    await supabase.from('nod_drafts').insert({
      delay_log_id: delays[7].id,
      draft_content: {
        project_name: '383 Madison Avenue',
        trade: 'Tile / Stone',
        reason: 'Prior trade (Waterproofing) incomplete',
        started: delays[7].started_at,
        description: 'Waterproofing on 16C Powder Room at 61%. Tile crew waiting. Pursuant to AIA A201 §8.3.1.',
        claim_amount: delays[7].daily_cost * 5,
      },
    });
  }

  // Helper to create a legal_document with receipt events
  async function createNOD(opts: {
    delayId: string;
    areaId: string;
    tradeName: string;
    sentAt: string;
    openedAt: string | null;
    openCount: number;
    hash: string;
    draftStatus: 'sent' | 'draft';
  }) {
    const trackingUuid = crypto.randomUUID();
    const { data: doc, error } = await supabase
      .from('legal_documents')
      .insert({
        project_id: IDS.project,
        org_id: IDS.subOrg,
        type: 'nod',
        sha256_hash: opts.hash,
        receipt_tracking_uuid: trackingUuid,
        sent_at: opts.draftStatus === 'sent' ? opts.sentAt : null,
        sent_by: IDS.authSubPm,
        first_opened_at: opts.openedAt,
        open_count: opts.openCount,
        published_to_gc: opts.draftStatus === 'sent',
        published_at: opts.draftStatus === 'sent' ? opts.sentAt : null,
        generated_at: opts.sentAt,
      })
      .select()
      .single();

    if (error) { console.log('  ✗ legal_document (nod):', error.message); return; }

    // Receipt events
    if (opts.openedAt && doc) {
      for (let i = 0; i < opts.openCount; i++) {
        await supabase.from('receipt_events').insert({
          document_id: doc.id,
          event_type: 'open',
          ip_address: '192.168.1.1',
          device_type: 'desktop',
          opened_at: new Date(new Date(opts.openedAt).getTime() + i * 3600000).toISOString(),
        });
      }
    }
  }

  // NOD 1: Sent and acknowledged (marble delay — resolved)
  if (delays[3]?.id) {
    await createNOD({
      delayId: delays[3].id,
      areaId: delays[3].area_id,
      tradeName: 'Tile / Stone',
      sentAt: atTime(daysAgo(37), 14),
      openedAt: atTime(daysAgo(37), 16),
      openCount: 3,
      hash: 'a3f8c2d1e4b7a9f0c3d6e8b2a5f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5',
      draftStatus: 'sent',
    });
  }

  // NOD 2: Sent, GC opened but no response (48h+, active heat delay)
  if (delays[5]?.id) {
    await createNOD({
      delayId: delays[5].id,
      areaId: delays[5].area_id,
      tradeName: 'Waterproofing',
      sentAt: atTime(daysAgo(5), 15),
      openedAt: atTime(daysAgo(5), 17),
      openCount: 2,
      hash: 'b4e9d3f2a5c8b1e0d4f7a3c6b9e2d5f8a1c4b7e0d3f6a9c2e5b8d1f4a7c0b3e6',
      draftStatus: 'sent',
    });
  }

  // NOD 3: Draft (pending — tile/WP delay, just created)
  if (delays[7]?.id) {
    await createNOD({
      delayId: delays[7].id,
      areaId: delays[7].area_id,
      tradeName: 'Tile / Stone',
      sentAt: daysAgo(1),
      openedAt: null,
      openCount: 0,
      hash: '',
      draftStatus: 'draft',
    });
  }

  // REA: For marble delay — cumulative > $5K
  if (delays[3]?.id) {
    const { data: rea, error } = await supabase
      .from('legal_documents')
      .insert({
        project_id: IDS.project,
        org_id: IDS.subOrg,
        type: 'rea',
        sha256_hash: 'c5f0e4d3b6a9c2f5e8d1b4a7f0c3e6d9b2a5f8c1e4d7b0a3f6c9e2d5b8a1f4c7',
        sent_at: atTime(daysAgo(34), 10),
        sent_by: IDS.authSubPm,
        first_opened_at: atTime(daysAgo(34), 11),
        open_count: 5,
        published_to_gc: true,
        published_at: atTime(daysAgo(34), 10),
        generated_at: atTime(daysAgo(34), 9),
      })
      .select()
      .single();

    if (error) { console.log('  ✗ REA:', error.message); }
    else if (rea) {
      // 5 receipt events for REA
      for (let i = 0; i < 5; i++) {
        await supabase.from('receipt_events').insert({
          document_id: rea.id,
          event_type: 'open',
          ip_address: '10.0.0.1',
          device_type: i < 3 ? 'desktop' : 'mobile',
          opened_at: atTime(daysAgo(34 - i), 10 + i),
        });
      }
    }
  }

  console.log('  ✓ NOD drafts + legal documents + receipt events');
}

// ─── STEP 7: Forecast snapshots ───────────────────────

async function seedForecastSnapshots() {
  console.log('[Forecast] Creating weekly snapshots...');

  const { data: areas } = await supabase
    .from('areas')
    .select('id')
    .eq('project_id', IDS.project)
    .limit(5);

  if (!areas?.length) return;

  const { data: trades } = await supabase
    .from('trade_sequences')
    .select('trade_name, sequence_order')
    .eq('project_id', IDS.project)
    .limit(3);

  if (!trades?.length) return;

  // Weekly snapshots from Jan 12 to today
  const snapshots: object[] = [];
  const startDate = new Date('2026-01-12');
  const endDate = new Date(TODAY);

  const d = new Date(startDate);
  let weekNum = 0;

  // Project-level % trend
  const weeklyPcts = [2, 5, 8, 12, 16, 20, 24, 25, 28, 30, 32, 33];

  while (d <= endDate) {
    const overallPct = weeklyPcts[Math.min(weekNum, weeklyPcts.length - 1)] ?? 33;
    const projectedCompletion = new Date('2026-09-21');
    const scheduledCompletion = new Date('2026-09-15');
    const deltaDays = 6;

    // Create snapshots for a few representative areas × trades
    for (const area of areas.slice(0, 3)) {
      for (const trade of trades.slice(0, 2)) {
        snapshots.push({
          project_id: IDS.project,
          area_id: area.id,
          trade_type: trade.trade_name,
          snapshot_date: d.toISOString().split('T')[0],
          effective_pct: Math.min(100, overallPct * (1 + (trade.sequence_order === 1 ? 0.8 : 0.3))),
          actual_rate: 3.2 + (Math.random() - 0.5) * 0.5,
          benchmark_rate: 3.5,
          projected_date: projectedCompletion.toISOString().split('T')[0],
          scheduled_date: scheduledCompletion.toISOString().split('T')[0],
          delta_days: deltaDays + rand(-1, 2),
          recommendations: {
            note: overallPct < 15 ? 'Project in mobilization phase' : overallPct < 25 ? 'Steady progress' : 'Active construction',
            at_risk: overallPct > 28 ? ['Floor 18 (heat)', 'Floor 20 (material)'] : [],
          },
        });
      }
    }

    weekNum++;
    d.setDate(d.getDate() + 7);
  }

  const { error } = await supabase.from('forecast_snapshots').insert(snapshots as any);
  if (error) console.log('  ✗ forecast_snapshots:', error.message);
  else console.log(`  ✓ ${snapshots.length} forecast snapshots (${weekNum} weeks)`);
}

// ─── STEP 8: Hardcoded morning briefing ──────────────

async function seedBriefing() {
  console.log('[Briefing] Seeding morning briefing...');

  // Check if table exists first
  const { error: checkErr } = await supabase.from('briefings').select('id').limit(1);
  if (checkErr?.message?.includes('does not exist')) {
    console.log('  ⚠ briefings table not found — skipping');
    return;
  }

  const content = `Good morning. As of today, 383 Madison Avenue is 33% complete across 780 areas and 14 active trades. Three delays are costing $6,660/day combined — the most urgent is the heater failure on Floors 17–19 (Waterproofing, $2,960/day, now 6 days). A Notice of Delay was sent 5 days ago with no GC response. Escalation is recommended. Steel stud delivery for Floor 20B is 4 days late ($14,720 cumulative). Tile crew on Floor 16C is waiting on Waterproofing to clear. 6 GC verifications are pending on Floors 12–14. Projected completion is September 21 — 6 days behind the original September 15 schedule.`;

  await supabase.from('briefings').upsert({
    project_id: IDS.project,
    user_id: IDS.gcPm,
    role: 'gc_pm',
    language: 'en',
    content,
    model: 'demo',
    briefing_date: TODAY.toISOString().split('T')[0],
  }, { onConflict: 'project_id,user_id,briefing_date' }).then(({ error }) => {
    if (error) console.log('  ⚠ briefing:', error.message);
    else console.log('  ✓ Morning briefing seeded');
  });
}

// ─── Main ─────────────────────────────────────────────

async function main() {
  console.log('\n🏗️  ReadyBoard — Full Demo Seed\n');
  console.log(`  Project: ${IDS.project}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log('  Simulating: Jan 5 → Apr 4 2026 (3 months)\n');
  console.log('─'.repeat(55));

  await clearDemoData();
  console.log('');

  await seedExtraUsers();
  await seedAreaTradeStatus();
  await seedFieldReports();

  const delays = await seedDelays();
  await seedCorrectiveActions(delays);
  await seedLegalDocs(delays);
  await seedForecastSnapshots();
  await seedBriefing();

  console.log('\n' + '─'.repeat(55));
  console.log('✅ Demo seed complete!\n');
  console.log('  GC:  demo-gc@readyboard.ai  / ReadyBoard2026!');
  console.log('  Sub: demo-sub@readyboard.ai / ReadyBoard2026!');
  console.log('\nWhat each page shows:');
  console.log('  Ready Board  → wave pattern (green bottom → gray top)');
  console.log('  Delays       → 8 delays (5 resolved, 3 active @ $6.6K/day)');
  console.log('  Legal Docs   → 2 NODs sent, 1 draft, 1 REA ($16.6K)');
  console.log('  Corrective   → 1 open, 1 acknowledged, 1 in-progress, 3 resolved');
  console.log('  Forecast     → 12 weekly snapshots, +6 days behind schedule');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
