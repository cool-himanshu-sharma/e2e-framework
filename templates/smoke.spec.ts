import { test, expect } from '@playwright/test';

// Starter spec created by "npm run setup". It proves the install works: the site is reachable, the
// e2e admin can log in, and the plugin is active. Keep it, replace it, or extend it with real specs.
test('{{PLUGIN_NAME}} is active in wp-admin', async ({ page }) => {
  await page.goto('/wp-admin/plugins.php');
  await expect(page.locator('tr[data-slug="{{PLUGIN_SLUG}}"]')).toHaveClass(/\bactive\b/);
});
