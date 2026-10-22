// Runs once before any test: fail fast with a clear message, then reset the site to the
// fixture state (plugin active, e2e_admin, plugin/fixture.php) so every run starts the same.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default async function preflight() {
  const fix = 'Run "npm run setup" in e2e/ first.';
  if (!existsSync(join(__dirname, '..', '.env'))) throw new Error(`No e2e/.env file. ${fix}`);
  const { WP_BASE_URL: url, WP_USER, WP_PASS } = process.env;
  if (!url || !WP_USER || !WP_PASS) throw new Error(`e2e/.env is missing WP_BASE_URL, WP_USER or WP_PASS. ${fix}`);

  let status = 0;
  try {
    status = (await fetch(`${url}/wp-login.php`, { signal: AbortSignal.timeout(10_000) })).status;
  } catch { /* handled below */ }
  if (!status || status >= 500) { // Local's router answers 502 for a stopped site
    throw new Error(`${url} is not working (${status ? `HTTP ${status}` : 'no response'}). Start the site in LocalWP, then run the tests again.`);
  }

  const res = spawnSync(process.execPath, [join(__dirname, 'setup.mjs'), '--fixture-only', '--quiet'], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`Preparing the site failed:\n${res.stdout}${res.stderr}`);
}
