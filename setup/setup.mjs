// Setup for the E2E framework on a LocalWP site. Generic: works for any WordPress plugin that has this folder in its root.
//   npm run setup          install deps + Chromium, write .env, create plugin files, install the AI skill, prepare the site
//   npm run local:fixture  only prepare the site (also run quietly before every test run)
// The plugin is the folder that contains this one (whatever this folder is called). The site's domain, PHP version
// and MySQL port are read from Local's sites.json, so nothing is hard-coded. Overrides: LOCAL_PHP, LOCAL_DB_PORT, WP_ROOT.
import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const e2eDir = resolve(here, '..');
const e2eName = basename(e2eDir);
const pluginDir = resolve(e2eDir, '..');
const wpRoot = resolve(process.env.WP_ROOT ?? join(pluginDir, '..', '..', '..')); // plugin -> plugins -> wp-content -> public
const fixtureOnly = process.argv.includes('--fixture-only');
const quiet = process.argv.includes('--quiet');

const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
const step = (msg) => { if (!quiet) console.log(`\n▸ ${msg}`); };
const note = (msg) => { if (!quiet) console.log(msg); };

if (Number(process.versions.node.split('.')[0]) < 18) fail(`Node 18 or newer is required (you have ${process.versions.node}).`);
if (!existsSync(join(wpRoot, 'wp-load.php'))) {
  fail(`wp-load.php not found in ${wpRoot}.\nThis folder must sit in the root of a plugin inside a Local site: wp-content/plugins/<plugin>/${e2eName}.\n` +
    'If the plugin is symlinked into the site, set WP_ROOT to the site\'s app/public folder.');
}

// --- 1. Find the Local site this plugin lives in -------------------------------------------
const localDir = { win32: () => join(process.env.APPDATA ?? '', 'Local'), darwin: () => join(homedir(), 'Library', 'Application Support', 'Local') }[platform()]?.()
  ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'Local');
const sitesFile = join(localDir, 'sites.json');
if (!existsSync(sitesFile)) fail(`Local's sites.json not found at ${sitesFile}. Is LocalWP installed?`);

const norm = (p) => resolve(p.replace(/^~/, homedir())).toLowerCase();
const inside = (child, parent) => norm(child) === norm(parent) || norm(child).startsWith(norm(parent) + sep);
const site = Object.values(JSON.parse(readFileSync(sitesFile, 'utf8')))
  .find((s) => s.path && inside(wpRoot, join(s.path, 'app', 'public')));
if (!site) fail(`No Local site in ${sitesFile} contains ${wpRoot}.`);

const baseURL = `http://${site.domain}`;
const dbPort = process.env.LOCAL_DB_PORT ?? String(site.services?.mysql?.ports?.MYSQL?.[0] ?? '');
const phpVersion = site.services?.php?.version;
note(`Plugin: ${basename(pluginDir)}\nLocal site: ${site.name} (${baseURL}), PHP ${phpVersion}, MySQL port ${dbPort}`);
if (!dbPort) fail('Could not read the MySQL port from sites.json; set LOCAL_DB_PORT (Local > site > Database).');

// --- 2. Find the PHP binary the site uses (system PHP usually lacks mysqli) -------------------
const services = join(localDir, 'lightning-services');
const phpBin = (dir) => [join(dir, 'bin', 'win64', 'php.exe'), join(dir, 'bin', 'linux', 'bin', 'php'),
  ...['darwin-arm64', 'darwin'].map((p) => join(dir, 'bin', p, 'bin', 'php'))].find(existsSync);
const phpDirs = existsSync(services) ? readdirSync(services).filter((d) => d.startsWith('php-')) : [];
const php = process.env.LOCAL_PHP
  ?? phpDirs.filter((d) => d.startsWith(`php-${phpVersion}+`)).map((d) => phpBin(join(services, d))).find(Boolean);
if (!php) fail(`Local's PHP ${phpVersion} not found in ${services}; set LOCAL_PHP to its php binary.`);

// --- 3. The site must be running ---------------------------------------------------------------
step(`Checking ${baseURL} is running`);
let status = 0;
try {
  status = (await fetch(`${baseURL}/wp-login.php`, { signal: AbortSignal.timeout(10_000) })).status;
} catch { /* handled below */ }
if (!status || status >= 500) { // Local's router answers 502 for a stopped site
  fail(`${baseURL} is not working (${status ? `HTTP ${status}` : 'no response'}). Start "${site.name}" in Local, wait until it shows as running, then run this again.`);
}

// --- 4. Dependencies, .env, plugin files and the AI skill (skipped with --fixture-only) -------
const run = (command) => {
  const res = spawnSync(command, { cwd: e2eDir, stdio: 'inherit', shell: true }); // shell: npm/npx are .cmd files on Windows
  if (res.status !== 0) fail(`"${command}" failed.`);
};

if (!fixtureOnly) {
  if (existsSync(join(e2eDir, '.git'))) {
    console.warn(`\n  ! ${e2eName}/ contains its own .git folder. Delete it, or the plugin's repository will treat this folder as a nested repo.`);
  }

  step('Installing npm packages');
  run('npm install');
  step('Installing the Chromium browser for Playwright');
  run('npx playwright install chromium');

  const envFile = join(e2eDir, '.env');
  if (existsSync(envFile)) {
    step('.env already exists, leaving it as is');
    if (!readFileSync(envFile, 'utf8').includes(`WP_BASE_URL=${baseURL}`)) {
      console.warn(`  ! Its WP_BASE_URL is not ${baseURL}. Delete .env and re-run setup if that is wrong.`);
    }
  } else {
    step('Writing .env');
    writeFileSync(envFile, `WP_BASE_URL=${baseURL}\nWP_USER=e2e_admin\nWP_PASS="e2e_admin_pass"\n`);
  }

  // Plugin-specific starter files, created once from templates/ and never overwritten.
  const mainHeader = readdirSync(pluginDir).filter((f) => f.endsWith('.php'))
    .map((f) => /^[ \t/*#@]*Plugin Name:[ \t]*(.+)$/mi.exec(readFileSync(join(pluginDir, f), 'utf8').slice(0, 8192))?.[1]?.trim())
    .find(Boolean);
  const tokens = { PLUGIN_NAME: mainHeader ?? basename(pluginDir), PLUGIN_SLUG: basename(pluginDir), E2E_DIR: e2eName };
  const render = (text) => text.replace(/\{\{(\w+)\}\}/g, (m, key) => tokens[key] ?? m);
  const scaffold = (template, dest) => {
    const to = join(e2eDir, dest);
    if (existsSync(to)) return;
    step(`Creating ${dest}`);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, render(readFileSync(join(e2eDir, 'templates', template), 'utf8')));
  };
  scaffold('PLUGIN.md', 'plugin/PLUGIN.md');
  scaffold('fixture.php', 'plugin/fixture.php');
  scaffold('e2e.config.json', 'plugin/e2e.config.json');
  if (!existsSync(join(e2eDir, 'tests', 'admin')) && !existsSync(join(e2eDir, 'tests', 'frontend'))) {
    scaffold('smoke.spec.ts', 'tests/admin/smoke.spec.ts'); // proves the install works; replace or extend with real specs
  }

  // AI tools only find skills in their own project folder, so copy ours into each.
  // Same SKILL.md format everywhere: .claude/skills = Claude Code, .cursor/skills = Cursor,
  // .agents/skills = Codex (the only repo folder its docs list), .agent/skills = Antigravity.
  const skillSrc = join(e2eDir, 'skill', 'write-e2e-tests', 'SKILL.md');
  const skillText = existsSync(skillSrc) ? render(readFileSync(skillSrc, 'utf8')) : null;
  const skillFolders = ['.claude', '.cursor', '.agents', '.agent'];
  for (const folder of skillFolders) {
    const skillDest = join(pluginDir, folder, 'skills', 'write-e2e-tests', 'SKILL.md');
    if (skillText && (!existsSync(skillDest) || readFileSync(skillDest, 'utf8') !== skillText)) {
      step(`Installing the write-e2e-tests skill into ${folder}/skills`);
      mkdirSync(dirname(skillDest), { recursive: true });
      writeFileSync(skillDest, skillText);
    }
  }

  // Keep the test folder and AI folders out of the plugin release. Only appends to files that already exist.
  const ensureEntry = (file, entry, line) => {
    const path = join(pluginDir, file);
    if (!existsSync(path)) return;
    const text = readFileSync(path, 'utf8');
    if (text.split(/\r?\n/).some((l) => l.trim().replace(/^\//, '').startsWith(`${entry}/`))) return;
    step(`Adding ${entry}/ to ${file}`);
    const eol = text.includes('\r\n') ? '\r\n' : '\n'; // match the file's own line endings
    appendFileSync(path, `${text === '' || text.endsWith('\n') ? '' : eol}${line}${eol}`);
  };
  for (const entry of [e2eName, ...skillFolders]) {
    ensureEntry('.distignore', entry, `${entry}/`);
    ensureEntry('.gitattributes', entry, `${entry}/ export-ignore`);
  }
  if (!['.distignore', '.gitattributes'].some((f) => existsSync(join(pluginDir, f)))) {
    note(`\n  ! No .distignore or .gitattributes in the plugin: make sure ${e2eName}/ is excluded from the release zip.`);
  }
}

// --- 5. Prepare the site: e2e_admin, plugin active, plugin/fixture.php ------------------------
step('Preparing the site (e2e_admin user, plugin active, plugin fixture)');
const res = spawnSync(php, [
  '-d', `extension_dir=${join(dirname(php), 'ext')}`, '-d', 'extension=mysqli', '-d', `mysqli.default_port=${dbPort}`,
  join(here, 'local-fixture.php'),
], { cwd: wpRoot, encoding: 'utf8', env: { ...process.env, WP_ROOT: wpRoot, PLUGIN_DIR: pluginDir, E2E_DIR: e2eDir } });
// WordPress exits 0 even when it dies (e.g. database down), so success is the marker local-fixture.php prints last.
if (res.status !== 0 || !res.stdout?.includes('E2E_SITE_READY')) {
  const dbDown = /database connection/i.test(res.stdout ?? '');
  const output = dbDown ? 'WordPress could not connect to its database. Make sure the site is fully started in Local.'
    : `${res.stdout ?? ''}${res.stderr ?? ''}`.replace(/<[^>]*>/g, '').trim().slice(-2000);
  fail(`Preparing the site failed.\n${output}`);
}
if (!quiet) process.stdout.write(res.stdout.replace('E2E_SITE_READY\n', ''));

if (!quiet) {
  console.log(fixtureOnly ? '\n✔ Site ready.\n' : `\n✔ Setup done. Run the tests with: npm test\n  Next: describe your plugin in ${relative(pluginDir, join(e2eDir, 'plugin', 'PLUGIN.md'))}\n`);
}
