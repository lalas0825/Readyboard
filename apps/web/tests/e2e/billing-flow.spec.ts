import { test, expect } from '@playwright/test';
import {
  getServiceClient,
  TEST_PROJECT_ID,
  createTestSubscription,
  cleanupTestSubscription,
} from '../helpers/supabase';

const TEST_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

test.describe('Billing Flow', () => {
  test.beforeEach(async () => {
    await cleanupTestSubscription(TEST_PROJECT_ID);
  });

  test.afterAll(async () => {
    await cleanupTestSubscription(TEST_PROJECT_ID);
  });

  // ── Test 1: Starter plan — Legal Docs gated ─────────────
  test('starter plan shows upgrade prompt on Legal Docs tab', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Legal Docs")');

    await page.click('button:has-text("Legal Docs")');

    await expect(page.locator('text=Legal Documents')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Upgrade to Pro')).toBeVisible({ timeout: 5000 });
  });

  // ── Test 2: Pro plan — Legal Docs accessible ────────────
  test('pro plan shows Legal Docs tab content', async ({ page }) => {
    await createTestSubscription(TEST_PROJECT_ID, TEST_ORG_ID, { plan_id: 'pro' });

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Legal Docs")');

    await page.click('button:has-text("Legal Docs")');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Upgrade to Pro')).not.toBeVisible();
  });

  // ── Test 3: Billing tab renders correctly ────────────────
  test('billing tab shows plan info and actions', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Billing")');

    await page.click('button:has-text("Billing")');

    await expect(page.locator('text=Starter Plan')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=$399/mo per project')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Upgrade to Pro')).toBeVisible({ timeout: 5000 });
  });

  // ── Test 4: Pro billing tab shows Manage Billing ─────────
  test('pro plan billing tab shows Manage Billing button', async ({ page }) => {
    await createTestSubscription(TEST_PROJECT_ID, TEST_ORG_ID, { plan_id: 'pro' });

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Billing")');

    await page.click('button:has-text("Billing")');

    await expect(page.locator('text=Pro Plan')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=ACTIVE')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Manage Billing')).toBeVisible({ timeout: 5000 });
  });

  // ── Test 5: Idempotent UPSERT — no duplicate rows ───────
  test('idempotent subscription UPSERT creates only one row', async () => {
    const fixedSubId = `sub_test_idempotent_${Date.now()}`;

    await createTestSubscription(TEST_PROJECT_ID, TEST_ORG_ID, {
      plan_id: 'pro',
      stripe_subscription_id: fixedSubId,
    });
    await createTestSubscription(TEST_PROJECT_ID, TEST_ORG_ID, {
      plan_id: 'pro',
      stripe_subscription_id: fixedSubId,
    });

    const db = getServiceClient();
    const { data, error } = await db
      .from('project_subscriptions')
      .select('id')
      .eq('project_id', TEST_PROJECT_ID)
      .in('status', ['active', 'past_due', 'trialing']);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  // ── Test 6: Past-due badge renders on billing tab ────────
  test('past-due subscription shows red badge', async ({ page }) => {
    await createTestSubscription(TEST_PROJECT_ID, TEST_ORG_ID, {
      plan_id: 'pro',
      status: 'past_due',
    });

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Billing")');

    await page.click('button:has-text("Billing")');

    await expect(page.locator('text=PAST DUE')).toBeVisible({ timeout: 5000 });
  });
});
