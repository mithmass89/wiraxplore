---
name: wiraxplore
description: Run and debug browser E2E tests with WiraXplore using Lightpanda, Playwright, or Puppeteer. Use when the user wants to test a web app, write E2E specs, check why a page renders differently, take a screenshot of a local app, or drive a browser from the agent.
---

# WiraXplore browser testing

WiraXplore is a CLI + SDK that runs the same E2E specs against three engines:

| engine | what it is | driver | when to use |
| --- | --- | --- | --- |
| `lightpanda` | Lightpanda headless browser (Zig) | playwright or puppeteer over CDP | fast, low memory, CI |
| `playwright` | local Chrome/Edge binary | playwright-core | full rendering, everything Lightpanda lacks |
| `puppeteer` | local Chrome/Edge binary | puppeteer-core | projects already on Puppeteer |

## 1. Check what is available

```bash
wiraxplore doctor
wiraxplore doctor --json
```

`doctor` reports the platform, the active engine, whether the Lightpanda binary is
reachable (including `wsl:` paths on Windows), whether Chrome/Edge was found, and
whether the CDP server answers on `/json/version`.

## 2. Pick the engine

Project config `wiraxplore.config.yaml`:

```yaml
browser:
  engine: lightpanda   # lightpanda | playwright | puppeteer
  driver: playwright   # playwright | puppeteer
```

Overrides without touching config:

```bash
wiraxplore test --engine playwright
wiraxplore test --engine puppeteer
wiraxplore test --engine lightpanda --driver puppeteer
```

Environment overrides: `WIRAXPLORE_ENGINE`, `WIRAXPLORE_DRIVER`,
`WIRAXPLORE_CDP_URL`, `WIRAXPLORE_BASE_URL`.

## 3. Lifecycle

```bash
wiraxplore serve            # start Lightpanda CDP on 127.0.0.1:9222
wiraxplore status           # server + CDP probe
wiraxplore stop
wiraxplore test             # auto-starts the server when engine is lightpanda
```

`wiraxplore test` starts the server only for the `lightpanda` engine and stops it
afterwards. `playwright`/`puppeteer` launch their own Chrome.

## 4. Write specs

Specs import the published package, not a relative source path:

```ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'wiraxplore';

test('greet flow', async () => {
  const cfg = loadConfig();
  await withPage(cfg, async (page) => {
    await page.goto(cfg.baseUrl!);
    await page.fill('#name', 'Panda');
    await page.click('#greet');
    expect(await page.text('#out')).toBe('Hello, Panda');
  });
});
```

`PandaPage` API: `goto`, `setContent`, `click`, `fill`, `text`, `html`, `eval`,
`waitFor`, `title`, `url`, `screenshot`, `close`, plus `raw` for the underlying
driver page when a spec needs something engine-specific.

## 5. Debug a failure

1. `wiraxplore doctor` — engine and CDP reachability.
2. `wiraxplore status` — is the server actually answering?
3. `.wiraxplore.log` — Lightpanda server output.
4. Re-run the failing spec on a real browser: `wiraxplore test --engine playwright`.
   If it passes there, the page uses an API Lightpanda does not implement.

## 6. Agent integration

- **MCP** (Command Code, OpenCode, any MCP client): `npx -y wiraxplore mcp`.
  Tools: `panda_status`, `panda_serve_start`, `panda_serve_stop`,
  `panda_navigate`, `panda_extract`, `panda_click`, `panda_fill`, `panda_eval`,
  `panda_wait`, `panda_screenshot`, `panda_close`.
  Pass `engine` on `panda_navigate` to switch engines mid-session.
- **Command Code**: `cmd mcp add wiraxplore -- npx -y wiraxplore mcp`,
  or `wiraxplore plugin:commandcode` for the exact local command.
- **OpenCode**: `wiraxplore plugin:opencode` installs the plugin into
  `~/.config/opencode/plugins/wiraxplore` and prints the `mcp.servers` entry.

## Rules of thumb

- Never claim a UI works because a spec passed on Lightpanda alone; confirm layout
  or visual behaviour on `--engine playwright`.
- Prefer `data-testid` selectors; they survive both engines.
- Lightpanda has no graphical rendering: skip WebGL, canvas pixels, and
  screenshot-diff assertions there.
- Always stop what you started (`wiraxplore stop`, or let `wiraxplore test` do it).
