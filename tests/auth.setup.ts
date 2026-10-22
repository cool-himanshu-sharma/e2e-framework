import { test as setup, expect } from '@playwright/test';

// Logs in once and saves the session for the "admin" project.
// The plugin is already active and the site prepared: setup/preflight.ts ran the fixture.
setup('log in as the e2e admin', async ({ page }) => {
  await page.goto('/wp-login.php');
  await page.locator('#user_login').fill(process.env.WP_USER!);
  await page.locator('#user_pass').fill(process.env.WP_PASS!);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/wp-admin/);
  await page.context().storageState({ path: '.auth/admin.json' });
});
