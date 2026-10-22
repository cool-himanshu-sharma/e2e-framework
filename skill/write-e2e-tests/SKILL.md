---
name: write-e2e-tests
description: Write or update Playwright E2E tests in {{E2E_DIR}}/ for the current branch's code changes. Use when the developer asks to add tests, cover a change, or prepare a PR for the E2E workflow.
---

# Write E2E tests for the current changes

Read `{{E2E_DIR}}/plugin/PLUGIN.md` and `{{E2E_DIR}}/README.md` first. `PLUGIN.md` holds the plugin-specific facts (pages, fixture content, quirks, feature map). Do not assume anything not written there or visible in the code.

## Steps
0. **Check the plugin facts.** If `{{E2E_DIR}}/plugin/PLUGIN.md` still contains `TODO` markers, fill them in first from the plugin's code (admin pages, front-end output, required plugins, feature map), add any required plugins to `{{E2E_DIR}}/plugin/e2e.config.json`, and tell the developer what you filled in.
1. **Find what changed.** Changes may be committed, uncommitted, or both, so look at all of them: `git diff <default-branch> --stat` (`main` or `master`) (committed + uncommitted tracked changes) and `git status --short` (new untracked files). Read the diff for behavior changes (ignore pure refactors, comments, formatting, and anything under `{{E2E_DIR}}/`).
2. **Learn existing behavior.** Read the code around each change, and list the existing specs in `{{E2E_DIR}}/tests/` so you extend them instead of duplicating.
3. **Decide the test list** and show it before writing. Cover:
   - the changed or new behavior (what a user sees or can do);
   - one nearby feature that the change could plausibly break;
   - removed features: delete or update the tests that covered them.
   Test *intended* behavior, never just whatever the code currently does. If the intent is unclear, ask the developer.
4. **Write the specs.**
   - Visitor behavior goes in `tests/frontend/`, wp-admin behavior in `tests/admin/`. Files end in `.spec.ts`; no config change is needed.
   - Prefer `getByRole`, `getByLabel`, `getByText` over CSS classes.
   - Never use fixed sleeps; use `expect(...).toBeVisible()` or `waitForResponse`.
   - Tests must be independent and re-runnable.
   - If a feature needs site content or settings the site lacks (a page, a widget setting, an option), add it to `{{E2E_DIR}}/plugin/fixture.php` (idempotent PHP; it runs before every test run) instead of relying on manual setup or clicking through settings in a test. Add a line about it to `PLUGIN.md`.
5. **Run them.** Make sure the LocalWP site is running (its URL is `WP_BASE_URL` in `{{E2E_DIR}}/.env`; if `.env` is missing, run `npm run setup` in `{{E2E_DIR}}/`), then `npm test` in `{{E2E_DIR}}/`. Fix failures caused by your selectors or timing. If a failure looks like a real plugin bug, stop and report it; do not weaken the test.
6. **Report.** List tests added/changed/deleted, what you could not cover and why (paid add-ons, email, other plugins), and the result of the run. If you learned a quirk worth remembering, add it to `PLUGIN.md`.
7. **End with the commands to run them.** Finish the report with a copy-paste block so the developer can check the new tests themselves. Use the real paths of the spec files you added or changed (one line per file), and keep the comments:
   ```bash
   cd {{E2E_DIR}}
   npx playwright test tests/admin/<new-file>.spec.ts            # just the new tests (admin specs log in automatically)
   npx playwright test tests/admin/<new-file>.spec.ts --headed   # same, with a visible browser
   npm run test:ui                                                # pick and step through tests interactively
   npm test                                                       # the whole suite
   npm run report                                                 # open the HTML report of the last run
   ```
   To watch a run in slow motion, set `SLOWMO` first: `SLOWMO=800 npx playwright test ... --headed` in bash, or `$env:SLOWMO=800; npx playwright test ... --headed` in PowerShell.

## Rules
- Never commit. Leave changes in the working tree.
- Never test against a live or shared site; the local test site only.
- Do not use `test.fixme`/`skip` to hide a failing test without telling the developer.
- Do not edit `playwright.config.ts` or anything in `{{E2E_DIR}}/setup/` for one plugin's needs; plugin-specific setup belongs in `{{E2E_DIR}}/plugin/`. If a generic change is truly needed, say so.
- Edit the skill in `{{E2E_DIR}}/skill/`; `npm run setup` copies it to `.claude/skills/`, `.cursor/skills/`, `.agents/skills/` and `.agent/skills/`.
