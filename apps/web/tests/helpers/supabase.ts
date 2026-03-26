/**
 * Test helper: Supabase service client for E2E setup/teardown.
 *
 * Uses the service role key to bypass RLS — allows creating test fixtures
 * and verifying DB state without authentication.
 *
 * NEVER import this in production code.
 */

import path from 'path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

// Ensure .env.local is loaded in Playwright worker processes
loadEnvConfig(path.resolve(__dirname, '..', '..'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://errxmhgqksdasxccumtz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function getServiceClient() {
  if (!SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — cannot run E2E tests');
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Seed constants ─────────────────────────────────────────
export const TEST_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
export const TEST_GC_USER_ID = 'd0000000-0000-0000-0000-000000000002';
export const TEST_TRADE = 'Rough Plumbing';

// ─── Test area helpers ──────────────────────────────────────

/** Create a temporary test area with area_trade_status in checklist mode */
export async function createTestArea(suffix: string) {
  const db = getServiceClient();
  const areaId = crypto.randomUUID();

  // Create area
  await db.from('areas').insert({
    id: areaId,
    project_id: TEST_PROJECT_ID,
    name: `E2E Test ${suffix}`,
    floor: '99',
    area_type: 'bathroom',
    total_sqft: 100,
  });

  // Create area_trade_status in checklist mode
  await db.from('area_trade_status').insert({
    area_id: areaId,
    trade_type: TEST_TRADE,
    reporting_mode: 'checklist',
    effective_pct: 0,
    all_gates_passed: true,
    gc_verification_pending: false,
  });

  return areaId;
}

/** Create test tasks for an area/trade */
export async function createTestTasks(
  areaId: string,
  tasks: Array<{
    name: string;
    owner: 'sub' | 'gc';
    isGate?: boolean;
    weight?: number;
  }>,
) {
  const db = getServiceClient();
  const records = tasks.map((t, i) => ({
    id: crypto.randomUUID(),
    area_id: areaId,
    trade_type: TEST_TRADE,
    task_order: i + 1,
    task_name_en: t.name,
    task_name_es: t.name,
    task_owner: t.owner,
    is_gate: t.isGate ?? false,
    weight: t.weight ?? 1,
    status: 'pending',
  }));

  await db.from('area_tasks').insert(records);
  return records.map((r) => r.id);
}

/** Simulate foreman completing SUB tasks (direct DB write) */
export async function completeSubTasks(areaId: string) {
  const db = getServiceClient();
  const now = new Date().toISOString();

  await db
    .from('area_tasks')
    .update({
      status: 'complete',
      completed_at: now,
      completed_by: TEST_GC_USER_ID, // Using GC ID as stand-in for foreman
      completed_by_role: 'sub',
      updated_at: now,
    })
    .eq('area_id', areaId)
    .eq('trade_type', TEST_TRADE)
    .eq('task_owner', 'sub');

  // Trigger recalculation by touching area_trade_status
  await db
    .from('area_trade_status')
    .update({ updated_at: now })
    .eq('area_id', areaId)
    .eq('trade_type', TEST_TRADE);
}

/** Read area_trade_status for verification */
export async function getAreaTradeStatus(areaId: string) {
  const db = getServiceClient();
  const { data } = await db
    .from('area_trade_status')
    .select('*')
    .eq('area_id', areaId)
    .eq('trade_type', TEST_TRADE)
    .single();
  return data;
}

/** Read area_tasks for verification */
export async function getAreaTasks(areaId: string) {
  const db = getServiceClient();
  const { data } = await db
    .from('area_tasks')
    .select('*')
    .eq('area_id', areaId)
    .eq('trade_type', TEST_TRADE)
    .order('task_order', { ascending: true });
  return data ?? [];
}

/** Read notifications for a user */
export async function getNotifications(userId: string, type?: string) {
  const db = getServiceClient();
  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (type) query = query.eq('type', type);
  const { data } = await query;
  return data ?? [];
}

/** Clean up test area + all related data */
export async function cleanupTestArea(areaId: string) {
  const db = getServiceClient();

  // Delete in dependency order
  await db.from('area_tasks').delete().eq('area_id', areaId);
  await db.from('area_trade_status').delete().eq('area_id', areaId);
  await db.from('areas').delete().eq('id', areaId);
}

// ─── Billing test helpers ───────────────────────────────

/** Create a test subscription for a project */
export async function createTestSubscription(
  projectId: string,
  orgId: string,
  overrides?: Partial<{
    plan_id: string;
    status: string;
    stripe_subscription_id: string;
  }>,
) {
  const db = getServiceClient();
  const subId = overrides?.stripe_subscription_id ?? `sub_test_${crypto.randomUUID()}`;

  await db.from('project_subscriptions').upsert(
    {
      org_id: orgId,
      project_id: projectId,
      stripe_customer_id: `cus_test_${crypto.randomUUID().slice(0, 8)}`,
      stripe_subscription_id: subId,
      plan_id: overrides?.plan_id ?? 'pro',
      status: overrides?.status ?? 'active',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  );

  return subId;
}

/** Clean up test subscriptions for a project */
export async function cleanupTestSubscription(projectId: string) {
  const db = getServiceClient();
  await db.from('project_subscriptions').delete().eq('project_id', projectId);
}
