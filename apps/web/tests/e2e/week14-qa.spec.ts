/**
 * Week 14 QA — Production readiness E2E tests.
 *
 * Tests the full navigation system (Week 11), delays (Week 11 Day 2),
 * landing page (Week 13), and security boundaries.
 *
 * Run: npx playwright test tests/e2e/week14-qa.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Landing Page', () => {
  test('renders hero, pricing, and CTAs', async ({ page }) => {
    await page.goto(BASE_URL);

    // Hero
    await expect(page.getByText('Your jobsite under control.')).toBeVisible();
    await expect(page.getByText('No calls. No chaos.')).toBeVisible();

    // CTAs
    await expect(page.getByRole('link', { name: 'Start Free Trial' }).first()).toBeVisible();

    // Pricing section
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('$399')).toBeVisible();
    await expect(page.getByText('$699')).toBeVisible();
    await expect(page.getByText('$59')).toBeVisible();
  });

  test('terms and privacy pages load', async ({ page }) => {
    await page.goto(`${BASE_URL}/terms`);
    await expect(page.getByText('Terms of Service')).toBeVisible();

    await page.goto(`${BASE_URL}/privacy`);
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });
});

test.describe('Dashboard Navigation (Week 11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
  });

  test('sidebar renders with all 11 nav items', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ready Board' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Verifications' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Delays & Costs' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Legal Docs/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forecast' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Corrective Actions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Schedule' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Billing' })).toBeVisible();
  });

  test('project selector visible', async ({ page }) => {
    await expect(page.getByText('383 Madison Avenue')).toBeVisible();
  });

  test('navigation to delays page works', async ({ page }) => {
    await page.getByRole('link', { name: 'Delays & Costs' }).click();
    await expect(page).toHaveURL(/\/dashboard\/delays/);
    await expect(page.getByText('Delays & Costs')).toBeVisible();
    // Should show summary cards
    await expect(page.getByText('Active Delays')).toBeVisible();
    await expect(page.getByText('Cumulative Cost')).toBeVisible();
  });

  test('navigation to forecast page works', async ({ page }) => {
    await page.getByRole('link', { name: 'Forecast' }).click();
    await expect(page).toHaveURL(/\/dashboard\/forecast/);
    await expect(page.getByRole('heading', { name: 'Forecast' })).toBeVisible();
  });

  test('navigation to corrective actions works', async ({ page }) => {
    await page.getByRole('link', { name: 'Corrective Actions' }).click();
    await expect(page).toHaveURL(/\/dashboard\/corrective-actions/);
    await expect(page.getByRole('heading', { name: 'Corrective Actions' })).toBeVisible();
    // Kanban toggle
    await expect(page.getByRole('button', { name: 'Kanban' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
  });

  test('navigation to team page works', async ({ page }) => {
    await page.getByRole('link', { name: 'Team' }).click();
    await expect(page).toHaveURL(/\/dashboard\/team/);
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    // Invite button visible for GC PM
    await expect(page.getByText('+ Invite Member')).toBeVisible();
  });

  test('navigation to settings with tabs', async ({ page }) => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    // Vertical tabs
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trades & Costs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Legal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toBeVisible();
  });
});

test.describe('Delays Page (Week 11 Day 2)', () => {
  test('shows delay table with financial data', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/delays`);

    // Summary cards
    await expect(page.getByText('Active Delays')).toBeVisible();
    await expect(page.getByText('Daily Burn Rate')).toBeVisible();
    await expect(page.getByText('Cumulative Cost')).toBeVisible();

    // Filters
    await expect(page.locator('select').first()).toBeVisible();

    // Table headers
    await expect(page.getByText('Area')).toBeVisible();
    await expect(page.getByText('Trade')).toBeVisible();
    await expect(page.getByText('Severity')).toBeVisible();
  });
});

test.describe('Plan Guard (Stripe Enforcement)', () => {
  test('schedule page shows upgrade prompt for starter', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/schedule`);
    await expect(page.getByText('Schedule Import')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upgrade to Pro' })).toBeVisible();
  });

  test('legal page shows upgrade prompt for starter', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/legal`);
    await expect(page.getByText('Legal Documents')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upgrade to Pro' })).toBeVisible();
  });
});

test.describe('Security Headers', () => {
  test('response includes security headers', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() ?? {};

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain('frame-ancestors');
  });
});
