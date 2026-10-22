# Plugin facts: {{PLUGIN_NAME}}

This folder (`{{E2E_DIR}}/plugin/`) is the only plugin-specific part of `{{E2E_DIR}}/` besides the specs in `tests/admin/` and `tests/frontend/`.
The `/write-e2e-tests` skill reads this file before writing tests. Write down anything it cannot guess from the code.
TODO markers below are for the developer, or for the AI: fill them in from the plugin's code before writing tests.

The plugin folder, main file and site are detected automatically; do not list them here.

| Item | Value |
|---|---|
| Plugin name | {{PLUGIN_NAME}} |
| Requires | TODO other plugins it needs (also list them in `plugin/e2e.config.json` as `requiredPlugins`) |
| Admin pages | TODO e.g. `/wp-admin/admin.php?page=my-plugin` and what is on it |
| Front-end output | TODO shortcode, block, widget or page that shows the plugin to visitors |
| Fixture content | TODO pages/posts/options `plugin/fixture.php` creates, with their URLs |

## Known quirks
- TODO anything that makes tests flaky or surprising (animated buttons, hidden inputs behind styled controls, things that cannot be tested locally such as email).

## Feature map (add a line per feature so the AI knows where to look)
- TODO feature: folder or file in the plugin
