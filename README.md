# WiraXplore

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-0f172a?style=for-the-badge" alt="version" />
  <img src="https://img.shields.io/badge/license-MIT-16a34a?style=for-the-badge" alt="license" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="node" />
  <img src="https://img.shields.io/badge/engines-Lightpanda%20%7C%20Playwright%20%7C%20Puppeteer-ff6b35?style=for-the-badge" alt="engines" />
  <img src="https://img.shields.io/badge/tests-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="vitest" />
</p>

<p align="center">
  <strong>WiraXplore</strong> runs one E2E suite against three browser engines:
  <a href="https://github.com/lightpanda-io/browser">Lightpanda</a>, Playwright and Puppeteer.
  <br />
  Fast on Lightpanda, faithful on real Chrome, drivable from your coding agent.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#engines">Engines</a> ·
  <a href="#test-your-app">Test your app</a> ·
  <a href="#agent-integration">Agent Integration</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

## Why WiraXplore?

Lightpanda is 16× lighter and 9× faster than Chromium, but it is not a Chromium
replacement: no WebGL, no pixel rendering, and some modern APIs are missing.
Real browsers are faithful but slow and heavy.

WiraXplore lets you keep **one test suite** and choose the engine per run:

```bash
wiraxplore test --engine lightpanda    # fast feedback loop
wiraxplore test --engine playwright    # release gate on real Chrome
```

## Engines

| engine | browser | driver | mode | best for |
| --- | --- | --- | --- | --- |
| `lightpanda` | Lightpanda (Zig) | playwright-core **or** puppeteer-core | CDP | speed, CI, crawlers |
| `playwright` | local Chrome/Edge | playwright-core | launch | layout, screenshots, full web platform |
| `puppeteer` | local Chrome/Edge | puppeteer-core | launch | projects already on Puppeteer |

Every engine is exposed through the same `PandaPage` API, so specs do not change
when you switch. `page.raw` gives you the native driver page when you need
engine-specific behaviour.

## Quick Start

```bash
# 1. Install
pnpm install && pnpm build

# 2. Check what works on this machine
wiraxplore doctor

# 3. Scaffold into your app
cd /path/to/your-app
wiraxplore init

# 4. Run
wiraxplore test                        # engine from wiraxplore.config.yaml
wiraxplore test --engine playwright     # or force one
wiraxplore test --engine puppeteer --headed --slow-mo 300   # watch it run
```

`--headed` opens a real browser window and `--slow-mo` adds a delay between
actions, so a login/input flow is visible end to end. Only the `playwright` and
`puppeteer` engines have a UI — Lightpanda renders nothing.

A ready-made single-file demo lives in `examples/webapp/index.html`, with its spec
in `tests/e2e/demo-app.spec.ts`:

```bash
wiraxplore test --filter demo-app --engine puppeteer --headed --slow-mo 300
```

Keep the CDP server running in the background with pm2:

```bash
wiraxplore pm2 start    # writes ecosystem.config.cjs, starts, then `pm2 save`
wiraxplore pm2 status
wiraxplore pm2 stop
```

Because `pm2 save` runs automatically, `pm2 resurrect` restores the server after a
reboot.

## Test your app

Point the config at your running app and write a spec:

```yaml
# wiraxplore.config.yaml
name: my-app
baseUrl: http://localhost:3000
browser:
  engine: lightpanda
  driver: playwright
```

```ts
// tests/e2e/home.spec.ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'wiraxplore';

test('home greets the user', async () => {
  const cfg = loadConfig();
  await withPage(cfg, async (page) => {
    await page.goto(cfg.baseUrl!);
    await page.waitFor('#greet');
    await page.fill('#name', 'Panda');
    await page.click('#greet');
    expect(await page.text('#out')).toBe('Hello, Panda');
  });
});
```

`wiraxplore test` starts Lightpanda itself when the engine is `lightpanda` and
stops it when the run ends. Start your own dev server yourself — WiraXplore does
not boot your app.

## Agent Integration

### MCP (Command Code, OpenCode, anything MCP)

```bash
wiraxplore mcp   # stdio MCP server
```

Tools: `panda_status`, `panda_serve_start`, `panda_serve_stop`, `panda_navigate`,
`panda_extract`, `panda_click`, `panda_fill`, `panda_eval`, `panda_wait`,
`panda_screenshot`, `panda_close`.

### Command Code

```bash
cmd mcp add wiraxplore -- npx -y wiraxplore mcp
cp skills/wiraxplore/SKILL.md ~/.commandcode/skills/wiraxplore/SKILL.md
```

### OpenCode

```bash
wiraxplore plugin:opencode
```

Installs the plugin into `~/.config/opencode/plugins/wiraxplore`, the skill into
`~/.config/opencode/skills/wiraxplore`, and registers both the plugin and the MCP
server in `opencode.json(c)` — using whichever key shape the installed OpenCode
version expects (`plugin` + flat `mcp` for 1.x, `plugins` + `mcp.servers` for 2.x).
Verify with `opencode mcp list`.

## Documentation

Start with [docs/DOCS.md](docs/DOCS.md) to see which document answers what.
The main usage reference is [docs/USAGE.md](docs/USAGE.md).

| Doc | EN | ID |
| --- | --- | --- |
| Doc index | [docs/DOCS.md](docs/DOCS.md) | — |
| How it works + headless/headful | [docs/TESTING.md](docs/TESTING.md) | — |
| Usage | [docs/USAGE.md](docs/USAGE.md) | [docs/README.id.md](docs/README.id.md) |
| Requirements | [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | — |
| Flutter | [docs/FLUTTER.md](docs/FLUTTER.md) | — |

## Requirements

- Node.js ≥ 20
- **lightpanda engine**: Lightpanda binary on Linux/macOS; WSL2 or Docker on Windows
- **playwright / puppeteer engines**: a local Chrome or Edge install
- Your app reachable at `baseUrl`, specs in `tests/e2e`

Lightpanda has no native Windows binary. WiraXplore detects it inside WSL and
talks to it over the forwarded `127.0.0.1:9222`. On Windows without WSL, use the
`playwright` or `puppeteer` engine instead.

## Project Status

- ✅ Lightpanda / Playwright / Puppeteer engines behind one page API
- ✅ Playwright and Puppeteer can both drive Lightpanda over CDP
- ✅ MCP server + OpenCode plugin + Command Code skill
- 🚧 Flutter driver bridge

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built on top of <a href="https://github.com/lightpanda-io/browser">Lightpanda</a>.
</p>
