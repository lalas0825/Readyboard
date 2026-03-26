import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { loadEnvConfig } from '@next/env';

// Load .env.local — use __dirname to resolve from config file location
// (Playwright workers may run from a different CWD)
loadEnvConfig(path.resolve(__dirname));

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
