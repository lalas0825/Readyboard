import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

// Load .env.local so tests can access SUPABASE_SERVICE_ROLE_KEY
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Serial — tests depend on DB state
  reporter: 'html',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
