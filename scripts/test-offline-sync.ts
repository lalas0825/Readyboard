/**
 * test-offline-sync.ts — Simulates PowerSync upload to Supabase
 *
 * Verifies the server-side of the offline sync pipeline:
 * 1. Creates test fixtures (user) needed for FK constraints
 * 2. Inserts a field_report with offline_created_at (simulating a device write)
 * 3. Verifies the row exists with all fields correct
 * 4. Verifies offline_created_at <= created_at (conflict resolution invariant)
 * 5. Cleans up all test data
 *
 * Run: npx tsx scripts/test-offline-sync.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://errxmhgqksdasxccumtz.supabase.co';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const envPath = path.resolve(__dirname, '..', 'apps', 'web', '.env.local');
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (match) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
    }
  } catch {
    console.error('Cannot read .env.local — set SUPABASE_SERVICE_ROLE_KEY env var');
    process.exit(1);
  }
}

const supabase = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Use a real seed area and create a test user
const SEED_AREA_ID = 'c0000000-0000-0000-0000-000000200001'; // Bath 20A from seed
const TEST_REPORT_ID = 'f0000000-0000-4000-a000-fef000000001';
const TEST_USER_ID = 'f0000000-0000-4000-a000-fef000000002';
const SEED_ORG_ID = 'a0000000-0000-0000-0000-000000000002'; // Jantile (sub) from seed

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

// Cleanup needs auth user ID, so we track it globally
let _authUserId: string | null = null;

async function cleanup() {
  await supabase.from('field_reports').delete().eq('id', TEST_REPORT_ID);
  if (_authUserId) {
    await supabase.from('users').delete().eq('id', _authUserId);
    await supabase.auth.admin.deleteUser(_authUserId);
  }
}

async function main() {
  console.log('🔄 Test: Offline Sync Pipeline (Server-Side)\n');

  // Cleanup any leftover test data
  await cleanup();

  // --- Setup: Create auth user + profile (FK requirement) ---
  console.log('0️⃣  Setup: create test user fixtures');

  // Create in auth.users first (users.id FK → auth.users.id)
  // Trigger handle_new_user auto-creates public.users profile from metadata
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: 'test-sync@readyboard.dev',
    password: 'test-password-12345',
    email_confirm: true,
    user_metadata: {
      name: 'Test Foreman (sync)',
      role: 'foreman',
      language: 'en',
      org_id: SEED_ORG_ID,
    },
  });

  if (authError) {
    console.error(`  Auth user creation failed: ${authError.message}`);
    // Try to find existing test user
    const { data: { users: existing } } = await supabase.auth.admin.listUsers();
    const testAuth = existing?.find(u => u.email === 'test-sync@readyboard.dev');
    if (testAuth) {
      console.log('  Using existing auth user');
      (authUser as any) = { user: testAuth };
    } else {
      console.error('\n💀 Cannot proceed — auth user fixture failed');
      process.exit(1);
    }
  }

  const authUserId = authUser!.user.id;
  assert(!!authUserId, `Auth user created: ${authUserId.slice(0, 12)}...`);

  // Verify trigger created the profile in public.users
  const { data: profile } = await supabase.from('users').select('id').eq('id', authUserId).single();
  assert(!!profile, `User profile auto-created by trigger`);

  // Track for cleanup
  _authUserId = authUserId;
  const actualUserId = authUserId;

  // --- Test 1: Insert field_report with offline_created_at ---
  console.log('\n1️⃣  Insert field_report simulating PowerSync upload');

  const offlineTimestamp = new Date(Date.now() - 30_000).toISOString(); // 30s ago (device time)
  const serverTimestamp = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('field_reports')
    .insert({
      id: TEST_REPORT_ID,
      area_id: SEED_AREA_ID,
      user_id: actualUserId,
      trade_name: 'tile',
      status: 'working',
      progress_pct: 65,
      reason_code: null,
      gps_lat: 40.7484,
      gps_lng: -73.9857,
      photo_url: null,
      device_id: 'test-device-001',
      app_version: '0.1.0',
      offline_created_at: offlineTimestamp,
      created_at: serverTimestamp,
    })
    .select()
    .single();

  assert(!insertError, `INSERT succeeded${insertError ? ': ' + insertError.message : ''}`);
  assert(!!inserted, 'Row returned after insert');

  if (!inserted) {
    console.error('\n💀 Cannot proceed — insert failed');
    await cleanup();
    process.exit(1);
  }

  // --- Test 2: Verify all fields ---
  console.log('\n2️⃣  Verify field values');

  const { data: row, error: selectError } = await supabase
    .from('field_reports')
    .select('*')
    .eq('id', TEST_REPORT_ID)
    .single();

  assert(!selectError, `SELECT succeeded${selectError ? ': ' + selectError.message : ''}`);
  assert(row?.area_id === SEED_AREA_ID, `area_id = ${row?.area_id}`);
  assert(row?.user_id === actualUserId, `user_id = ${row?.user_id?.slice(0, 12)}...`);
  assert(row?.trade_name === 'tile', `trade_name = ${row?.trade_name}`);
  assert(row?.status === 'working', `status = ${row?.status}`);
  assert(row?.progress_pct === 65, `progress_pct = ${row?.progress_pct}`);
  assert(row?.gps_lat === 40.7484, `gps_lat = ${row?.gps_lat}`);
  assert(row?.gps_lng === -73.9857, `gps_lng = ${row?.gps_lng}`);
  assert(row?.device_id === 'test-device-001', `device_id = ${row?.device_id}`);
  assert(row?.app_version === '0.1.0', `app_version = ${row?.app_version}`);
  assert(row?.reason_code === null, `reason_code = null (no blocker)`);
  assert(row?.offline_created_at != null, `offline_created_at is set`);

  // --- Test 3: Conflict resolution invariant ---
  console.log('\n3️⃣  Verify offline_created_at <= created_at (conflict resolution)');

  const offlineTime = new Date(row!.offline_created_at).getTime();
  const createdTime = new Date(row!.created_at).getTime();

  assert(
    offlineTime <= createdTime,
    `offline_created_at (${row!.offline_created_at}) <= created_at (${row!.created_at})`
  );

  const deltaSec = (createdTime - offlineTime) / 1000;
  assert(
    deltaSec >= 0,
    `Delta: ${deltaSec.toFixed(1)}s (device was ${deltaSec.toFixed(1)}s behind server)`
  );

  // --- Test 4: Verify row exists and is countable ---
  console.log('\n4️⃣  Verify row accessibility via service role');

  const { count, error: countError } = await supabase
    .from('field_reports')
    .select('*', { count: 'exact', head: true })
    .eq('id', TEST_REPORT_ID);

  assert(!countError, `Count query succeeded`);
  assert(count === 1, `Exactly 1 row found (count=${count})`);

  // --- Cleanup ---
  console.log('\n🧹 Cleanup');
  await cleanup();

  const { count: postCleanup } = await supabase
    .from('field_reports')
    .select('*', { count: 'exact', head: true })
    .eq('id', TEST_REPORT_ID);

  assert(postCleanup === 0, `Test report cleaned up (count=${postCleanup})`);

  const { count: userPostCleanup } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('id', _authUserId!);

  assert(userPostCleanup === 0, `Test user cleaned up (count=${userPostCleanup})`);

  // --- Summary ---
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
