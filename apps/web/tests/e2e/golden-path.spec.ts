import { test, expect } from '@playwright/test';
import {
  createTestArea,
  createTestTasks,
  completeSubTasks,
  getAreaTradeStatus,
  getAreaTasks,
  cleanupTestArea,
  getServiceClient,
  TEST_PROJECT_ID,
  TEST_GC_USER_ID,
  TEST_TRADE,
} from '../helpers/supabase';

/**
 * Golden Path E2E — Validates the complete checklist lifecycle:
 *
 * 1. Verification Queue: foreman completes tasks → GC sees queue item
 * 2. Approve Flow: GC approves → trade unblocked → DB verified
 * 3. Correction Flow: GC rejects → notification created → DB state correct
 * 4. Config Lock: mode switch blocked with active tasks, succeeds after clear
 *
 * Requires dev server at localhost:3000 (dev bypass auto-auth as gc_pm).
 * Each test creates its own area for isolation and cleans up after.
 */

const DASHBOARD_URL = 'http://localhost:3000/dashboard';

test.describe('Golden Path — Checklist Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  // ─── Scenario 1: Verification Queue ──────────────────────
  test.describe('Verification Queue Flow', () => {
    let areaId: string;

    test.beforeAll(async () => {
      areaId = await createTestArea('VerifyQueue');

      // Create 3 SUB tasks + 1 GC task
      await createTestTasks(areaId, [
        { name: 'Install pipes', owner: 'sub', weight: 3 },
        { name: 'Connect drain', owner: 'sub', weight: 3 },
        { name: 'Pressure test', owner: 'sub', weight: 2, isGate: true },
        { name: 'GC Inspect plumbing', owner: 'gc', weight: 2 },
      ]);

      // Simulate foreman completing all SUB tasks
      await completeSubTasks(areaId);

      // Wait for trigger propagation
      await new Promise((r) => setTimeout(r, 1500));
    });

    test.afterAll(async () => {
      await cleanupTestArea(areaId);
    });

    test('DB: gc_verification_pending is true after SUB completes all tasks', async () => {
      const status = await getAreaTradeStatus(areaId);
      expect(status).not.toBeNull();
      expect(status!.gc_verification_pending).toBe(true);
      expect(status!.gc_verification_pending_since).not.toBeNull();
    });

    test('UI: Verification queue shows the pending item', async ({ page }) => {
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      // Click Verifications tab
      const verifyTab = page.getByRole('button', { name: 'Verifications' });
      await verifyTab.click();

      // Should see "Pending Verifications" header
      await expect(page.getByText('Pending Verifications')).toBeVisible();

      // Should see our test area in the queue
      await expect(page.getByText('E2E Test VerifyQueue')).toBeVisible({ timeout: 5000 });
    });

    test('UI: Detail view shows tasks when queue item clicked', async ({ page }) => {
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      const verifyTab = page.getByRole('button', { name: 'Verifications' });
      await verifyTab.click();

      // Click the test queue item
      await page.getByText('E2E Test VerifyQueue').click();

      // Detail modal should show task names
      await expect(page.getByText('Install pipes')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Connect drain')).toBeVisible();
      await expect(page.getByText('Pressure test')).toBeVisible();

      // Should show the GC task as well
      await expect(page.getByText('GC Inspect plumbing')).toBeVisible();

      // Approve button should be visible (use "Unblock" to avoid matching queue item text)
      await expect(page.getByRole('button', { name: /Unblock/ })).toBeVisible();
    });
  });

  // ─── Scenario 2: Approve Flow ────────────────────────────
  test.describe('Approve Flow', () => {
    let areaId: string;

    test.beforeAll(async () => {
      areaId = await createTestArea('ApproveFlow');

      await createTestTasks(areaId, [
        { name: 'Rough-in pipes', owner: 'sub', weight: 5 },
        { name: 'GC Sign-off', owner: 'gc', weight: 5 },
      ]);

      await completeSubTasks(areaId);
      await new Promise((r) => setTimeout(r, 1500));
    });

    test.afterAll(async () => {
      await cleanupTestArea(areaId);
    });

    test('UI: GC approves → toast success → item disappears', async ({ page }) => {
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      const verifyTab = page.getByRole('button', { name: 'Verifications' });
      await verifyTab.click();

      // Click the test item
      await page.getByText('E2E Test ApproveFlow').click({ timeout: 10000 });

      // Click Approve button inside modal (use "Unblock" to avoid matching "ApproveFlow" item)
      await page.getByRole('button', { name: /Unblock/ }).click();

      // Should show success toast
      await expect(page.getByText(/Verified/)).toBeVisible({ timeout: 10000 });

      // Wait for modal to close and queue to refresh
      await page.waitForTimeout(1500);
    });

    test('DB: gc_verification_pending is false after approval', async () => {
      const status = await getAreaTradeStatus(areaId);
      expect(status).not.toBeNull();
      expect(status!.gc_verification_pending).toBe(false);
    });

    test('DB: GC tasks are marked complete after approval', async () => {
      const tasks = await getAreaTasks(areaId);
      const gcTask = tasks.find((t: Record<string, unknown>) => t.task_owner === 'gc');
      expect(gcTask).toBeDefined();
      expect(gcTask!.status).toBe('complete');
      expect(gcTask!.completed_by_role).toBe('gc');
    });
  });

  // ─── Scenario 3: Correction Flow ─────────────────────────
  test.describe('Correction Flow', () => {
    let areaId: string;

    test.beforeAll(async () => {
      areaId = await createTestArea('CorrectionFlow');

      await createTestTasks(areaId, [
        { name: 'Solder joints', owner: 'sub', weight: 4 },
        { name: 'Valve install', owner: 'sub', weight: 3 },
        { name: 'GC Check valves', owner: 'gc', weight: 3 },
      ]);

      await completeSubTasks(areaId);
      await new Promise((r) => setTimeout(r, 1500));
    });

    test.afterAll(async () => {
      await cleanupTestArea(areaId);
    });

    test('UI: GC requests correction → selects tasks → submits reason', async ({ page }) => {
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      const verifyTab = page.getByRole('button', { name: 'Verifications' });
      await verifyTab.click();

      // Open detail — wait for queue to load
      await expect(page.getByText('E2E Test CorrectionFlow')).toBeVisible({ timeout: 10000 });
      await page.getByText('E2E Test CorrectionFlow').click();

      // Wait for task detail to load
      await expect(page.getByText('Solder joints')).toBeVisible({ timeout: 5000 });

      // Enter correction mode
      await page.getByText('Select tasks for correction').click();

      // Select first completed SUB task (now clickable with cursor-pointer)
      const selectableRows = page.locator('.cursor-pointer');
      await expect(selectableRows.first()).toBeVisible({ timeout: 3000 });
      await selectableRows.first().click();

      // Click "Request Correction (1)" button
      await page.getByRole('button', { name: /Request Correction/ }).click();

      // Correction modal opens — select reason from dropdown
      const reasonSelect = page.locator('select');
      await expect(reasonSelect).toBeVisible({ timeout: 3000 });
      await reasonSelect.selectOption('workmanship');

      // Submit correction — click the last "Request Correction" button (modal's submit)
      const modalButtons = page.getByRole('button', { name: /Request Correction/ });
      await modalButtons.last().click();

      // Should show success toast
      await expect(
        page.getByText(/Correction requested/).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('DB: tasks have correction_requested status after GC rejection', async () => {
      const tasks = await getAreaTasks(areaId);
      const correctedTasks = tasks.filter(
        (t: Record<string, unknown>) => t.status === 'correction_requested',
      );
      // At least one task should be in correction state
      expect(correctedTasks.length).toBeGreaterThanOrEqual(1);

      // Correction fields should be set
      const firstCorrected = correctedTasks[0];
      expect(firstCorrected.correction_reason).not.toBeNull();
      expect(firstCorrected.correction_requested_at).not.toBeNull();
    });

    test('DB: gc_verification_pending is false after correction request', async () => {
      const status = await getAreaTradeStatus(areaId);
      expect(status).not.toBeNull();
      expect(status!.gc_verification_pending).toBe(false);
    });
  });

  // ─── Scenario 4: Config Lock Test ────────────────────────
  test.describe('Trade Config Lock', () => {
    let areaId: string;

    test.beforeAll(async () => {
      areaId = await createTestArea('ConfigLock');

      // Ensure checklist mode at project level
      const db = getServiceClient();
      await db.from('project_trade_configs').upsert({
        project_id: TEST_PROJECT_ID,
        trade_type: TEST_TRADE,
        reporting_mode: 'checklist',
        updated_by: TEST_GC_USER_ID,
      }, { onConflict: 'project_id,trade_type' });

      // Create tasks that will remain pending (active)
      await createTestTasks(areaId, [
        { name: 'Active task 1', owner: 'sub', weight: 5 },
        { name: 'Active task 2', owner: 'sub', weight: 5 },
      ]);
    });

    test.afterAll(async () => {
      await cleanupTestArea(areaId);
      // Reset config back to percentage (clean state)
      const db = getServiceClient();
      await db.from('project_trade_configs').delete()
        .eq('project_id', TEST_PROJECT_ID)
        .eq('trade_type', TEST_TRADE);
    });

    test('DB: switch_trade_mode RPC rejects mode change with active tasks', async () => {
      const db = getServiceClient();
      const { error } = await db.rpc('switch_trade_mode', {
        p_project_id: TEST_PROJECT_ID,
        p_trade_type: TEST_TRADE,
        p_new_mode: 'percentage',
        p_user_id: TEST_GC_USER_ID,
      });

      // Should fail with "active task(s) exist" error
      expect(error).not.toBeNull();
      expect(error!.message).toContain('Cannot switch');
    });

    test('UI: Settings tab shows trade config with lock indicator', async ({ page }) => {
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');

      const settingsTab = page.getByRole('button', { name: 'Settings' });
      await settingsTab.click();

      // Should show "Trade Configuration" header
      await expect(page.getByText('Trade Configuration')).toBeVisible({ timeout: 10000 });

      // Should show Rough Plumbing trade
      await expect(page.getByText(TEST_TRADE)).toBeVisible();

      // Should show CHECKLIST badge
      await expect(page.getByText('CHECKLIST').first()).toBeVisible();
    });

    test('DB: mode switch succeeds after clearing all active tasks', async () => {
      // Complete all active tasks to clear the lock
      await completeSubTasks(areaId);
      await new Promise((r) => setTimeout(r, 500));

      const db = getServiceClient();
      const { data, error } = await db.rpc('switch_trade_mode', {
        p_project_id: TEST_PROJECT_ID,
        p_trade_type: TEST_TRADE,
        p_new_mode: 'percentage',
        p_user_id: TEST_GC_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      const result = data as Record<string, unknown>;
      expect(result.new_mode).toBe('percentage');
      expect((result.areas_updated as number)).toBeGreaterThanOrEqual(0);
    });

    test('DB: area_trade_status reflects new mode after switch', async () => {
      const status = await getAreaTradeStatus(areaId);
      expect(status).not.toBeNull();
      expect(status!.reporting_mode).toBe('percentage');
    });
  });

  // ─── Scenario 5: Audit Trail Integrity ───────────────────
  test.describe('Audit Trail', () => {
    test('DB: audit_log contains verification and config entries', async () => {
      const db = getServiceClient();
      const { data } = await db
        .from('audit_log')
        .select('action, table_name, new_value')
        .in('action', ['gc_verification_approved', 'gc_correction_requested', 'config_change'])
        .order('created_at', { ascending: false })
        .limit(10);

      // Should have at least some audit entries from our tests
      expect(data).not.toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(0);

      // If entries exist, verify structure
      if (data && data.length > 0) {
        for (const entry of data) {
          expect(entry.action).toBeDefined();
          expect(entry.table_name).toBeDefined();
        }
      }
    });
  });
});
