import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true }); // WP_BASE_URL, WP_USER, WP_PASS

export default defineConfig({
  testDir: './tests',
  globalSetup: './setup/preflight.ts', // checks .env and that the site is up before anything runs
  workers: 1, // one shared WordPress site, so run serially
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.WP_BASE_URL, // checked by setup/preflight.ts
    trace: 'on-first-retry',
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) }, // e.g. SLOWMO=800 to watch tests run
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      // Front end: visitors are logged out
      name: 'frontend',
      testMatch: /frontend\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // wp-admin: reuse the saved admin session
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
});
