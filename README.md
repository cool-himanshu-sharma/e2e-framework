# WordPress Plugin E2E Framework

Drop this folder into any WordPress plugin, run one command, and get working [Playwright](https://playwright.dev) end-to-end tests that run against the plugin's **LocalWP** site.

`npm run setup` reads your Local site's config and handles everything: the site URL, PHP version and database port, a dedicated test admin, activating the plugin (and any plugins it needs), starter files, and an AI skill that writes tests for your changes.

> Running the tests changes the site (activates plugins, creates a test admin and test content). Use a local test site only.

## Quick start

Requires Node 18+ and [LocalWP](https://localwp.com), with the plugin inside a Local site (`wp-content/plugins/<your-plugin>/`).

1. **Get the folder into your plugin** as `<your-plugin>/e2e` (the name is up to you, `e2e` is recommended):
   ```bash
   cd wp-content/plugins/<your-plugin>
   npx degit <github-user>/e2e-framework e2e     # or: download the ZIP from GitHub and unzip it as e2e/
   ```
   Do not `git clone` it straight into the plugin: that leaves a nested `.git` folder.
2. **Start the site** in LocalWP.
3. **Run setup** (safe to run again at any time):
   ```bash
   cd e2e
   npm run setup
   ```
4. **Run the tests:**
   ```bash
   npm test
   ```

Setup creates a starter smoke test, so `npm test` passes on a fresh install. Then describe your plugin in `plugin/PLUGIN.md` and add your own specs.

## What setup does

| Step | Result |
|---|---|
| Finds your Local site | From the plugin's location, via Local's own `sites.json`: domain, PHP version, MySQL port |
| Installs tooling | npm packages and Chromium for Playwright |
| Writes `.env` | Site URL and the test admin's login |
| Creates your plugin files (once, never overwritten) | `plugin/PLUGIN.md`, `plugin/fixture.php`, `plugin/e2e.config.json`, `tests/admin/smoke.spec.ts`, pre-filled with your plugin's name and slug |
| Installs the `write-e2e-tests` AI skill | Claude Code, Codex, Cursor and Antigravity (see below) |
| Keeps tests out of your release | Appends this folder to `.distignore` and `.gitattributes` if those files exist |
| Prepares the site | Creates `e2e_admin`, activates required plugins, activates your plugin, runs `plugin/fixture.php` |

The same site preparation also runs automatically before every `npm test`, so each run starts from the same state.

## Run

```bash
npm test                                   # all tests
npx playwright test tests/admin/x.spec.ts  # one file
npm run test:headed                        # with a visible browser
npm run test:ui                            # pick and step through tests interactively
npm run report                             # open the HTML report of the last run
npm run local:fixture                      # only prepare the site
```

Slow motion: `SLOWMO=800 npm run test:headed` (bash) or `$env:SLOWMO=800; npm run test:headed` (PowerShell).

## Make it fit your plugin

Everything plugin-specific lives in `plugin/` and `tests/`; everything else is the shared framework.

| File | Purpose |
|---|---|
| `plugin/e2e.config.json` | `{ "requiredPlugins": ["elementor"] }`: folder slugs of other plugins to activate first. A `Requires Plugins:` header in your main plugin file is picked up automatically too. They must already be installed on the site. |
| `plugin/fixture.php` | Idempotent PHP that creates test pages, posts and options. Runs with WordPress loaded and your plugin active, before every run. Delete it if you need no content. |
| `plugin/PLUGIN.md` | Facts the AI can't guess from the code: admin pages, fixture pages, quirks, feature map. |
| `tests/admin/*.spec.ts` | wp-admin specs, already logged in as `e2e_admin`. |
| `tests/frontend/*.spec.ts` | Front-end specs, as a logged-out visitor. |

## Writing tests with AI

The `write-e2e-tests` skill reads your branch's changes and `plugin/PLUGIN.md`, writes the specs, runs them, and lists the commands to re-run them. Setup installs it for each tool:

| Tool | Installed to | How to run it |
|---|---|---|
| Claude Code | `.claude/skills/` | `/write-e2e-tests` |
| Codex (CLI / IDE) | `.agents/skills/` | `$write-e2e-tests`, or pick it from `/skills` |
| Cursor | `.cursor/skills/` | `/write-e2e-tests` |
| Antigravity | `.agent/skills/` | ask the agent to "write e2e tests for my changes" |

Restart the chat after setup: tools may only load skills when a session starts. If `PLUGIN.md` still has `TODO` markers, the skill fills them in from your code first.

## How a test run works

1. `setup/preflight.ts` checks `.env` and that the site is up, then prepares the site (see above).
2. `tests/auth.setup.ts` logs in as `e2e_admin` and saves the session to `.auth/admin.json`.
3. `tests/admin/*.spec.ts` run logged in; `tests/frontend/*.spec.ts` run logged out.

## Updating the framework

Download the new version and copy it over your folder, **except** `plugin/`, `tests/admin/`, `tests/frontend/`, `.env` and `.auth/`. Then run `npm run setup` again to refresh the AI skill.

## Troubleshooting

| Problem | Fix |
|---|---|
| `wp-load.php not found` | The folder must be directly inside the plugin, inside a Local site. If the plugin is symlinked in, set `WP_ROOT` to the site's `app/public` folder. |
| `No Local site ... contains ...` | The plugin isn't inside a site that Local knows about. |
| `... is not responding` | Start the site in LocalWP. |
| `Local's PHP ... not found` | Set `LOCAL_PHP` to the `php` binary of the site's PHP version. |
| `Could not read the MySQL port` | Set `LOCAL_DB_PORT` (Local > site > Database). |
| `needs the plugin "x", but it is not installed` | Install that plugin on the site, or remove it from `requiredPlugins`. |
| `EADDRINUSE ... 9323` | A report or UI window is already open. `npm run report` and `npm run test:ui` pick a free port automatically; this only happens if you call `npx playwright show-report` directly (add `--port 0`, or close the old one). |
| Not using LocalWP | Not supported by setup. You can still write `.env` by hand (see `.env.example`) and create the `e2e_admin` user yourself. |

## Layout

| Path | |
|---|---|
| `setup/` | Generic. `setup.mjs` (setup + site prep driver), `local-fixture.php` (runs inside WordPress), `preflight.ts` (before each run) |
| `templates/` | Generic. Starting points copied into `plugin/` and `tests/` on first setup |
| `skill/write-e2e-tests/SKILL.md` | Generic. Source of the AI skill; setup copies it into each tool's folder. Edit it here |
| `playwright.config.ts`, `tests/auth.setup.ts` | Generic |
| `plugin/` | **Yours.** Created by setup |
| `tests/admin/`, `tests/frontend/` | **Yours.** The specs |
