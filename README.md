# Webnix

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-0f172a?style=for-the-badge" alt="version" />
  <img src="https://img.shields.io/badge/license-MIT-16a34a?style=for-the-badge" alt="license" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="node" />
  <img src="https://img.shields.io/badge/browser-Lightpanda-ff6b35?style=for-the-badge" alt="lightpanda" />
  <img src="https://img.shields.io/badge/tests-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="vitest" />
</p>

<p align="center">
  <strong>Webnix</strong> is a fast, elegant end-to-end testing harness built on top of
  <a href="https://github.com/lightpanda-io/browser">Lightpanda</a> — the headless browser engineered for AI and automation.
  <br />
  Test web apps today. Flutter tomorrow. Drive everything from your coding agent.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#agent-integration">Agent Integration</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

---

## Why Webnix?

Modern web apps are dynamic, JavaScript-driven, and increasingly tested by AI agents. Chrome is too heavy for that world. Lightpanda is 16× lighter and 9× faster — but it needs a developer-friendly layer around it: lifecycle management, a test runner, an agent bridge, and clear documentation.

**Webnix is that layer.** One CLI. One config. Works for humans and coding agents alike.

## Features

- **Lightpanda lifecycle** — detect the binary, start/stop the CDP server, check status, with WSL & Docker awareness on Windows.
- **Playwright adapter** — write tests with the Playwright API, run against Lightpanda over CDP.
- **MCP server** — expose browser actions to OpenCode, Command Code, and any MCP-capable agent.
- **OpenCode plugin** — register tools and MCP in one command.
- **E2E runner** — auto-start the browser, run Vitest specs, tear down.
- **Flutter-ready** — config, docs, and roadmap for Flutter Web & native mobile.
- **Bilingual docs** — English and Indonesian.

## Quick Start

```bash
# 1. Install
git clone https://github.com/<you>/webnix.git
cd webnix
pnpm install && pnpm build

# 2. Check your environment
webnix doctor

# 3. Scaffold into your project
cd /path/to/your-app
webnix init

# 4. Run
webnix serve          # start Lightpanda on :9222
webnix test           # run E2E specs
webnix stop
```

## Example Test

```ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'webnix';

test('home greets the user', async () => {
  const cfg = loadConfig(process.cwd());
  await withPage(cfg, async (page) => {
    await page.setContent(`<button id="greet">Hi</button><p id="out"></p>`);
    await page.click('#greet');
    const out = await page.locator('#out').textContent();
    expect(out).toBe('Hello, Panda');
  });
});
```

## Architecture

```
┌────────────┐      CDP / Bidi      ┌────────────────┐
│  Your App  │ ◄──────────────────► │   Lightpanda   │
└─────┬──────┘                      └────────┬───────┘
      │                                      │
      │ Playwright API                       │ MCP (stdio)
      ▼                                      ▼
┌────────────┐                      ┌────────────────┐
│  Webnix    │ ◄──────────────────► │ Coding Agents  │
│  CLI / SDK │                      │ OpenCode, CC   │
└────────────┘                      └────────────────┘
```

## Agent Integration

### OpenCode
```bash
webnix plugin:opencode
# add the printed MCP snippet to ~/.config/opencode/opencode.jsonc
```

### Command Code / any MCP agent
```bash
webnix mcp   # stdio MCP server
```

MCP tools: `panda_status`, `panda_serve_start`, `panda_serve_stop`, `panda_navigate`, `panda_extract`, `panda_click`, `panda_fill`, `panda_eval`.

## Documentation

| Doc | EN | ID |
| --- | --- | --- |
| Usage | [docs/USAGE.md](docs/USAGE.md) | [docs/README.id.md](docs/README.id.md) |
| Requirements | [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | — |
| Flutter | [docs/FLUTTER.md](docs/FLUTTER.md) | — |

## Requirements

**Web apps**
- Node.js ≥ 20, pnpm/npm
- Lightpanda binary (Linux/macOS) or WSL2/Docker on Windows
- A reachable app (`baseUrl`) and tests in `tests/e2e`

**Flutter**
- Flutter Web: `flutter build web --web-renderer html`, serve `build/web`
- Native mobile: Flutter driver / `integration_test` (Lightpanda doesn't run on mobile)

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Project Status

- ✅ Web E2E on Lightpanda
- ✅ MCP + OpenCode plugin
- 🚧 Flutter driver bridge
- 🚧 Unified reporting (web + mobile)

## Roadmap

1. `webnix flutter:drive` — native mobile runner bridge.
2. Visual regression snapshots.
3. GitHub Action for CI.
4. Plugin for VS Code.

## Contributing

PRs welcome. Please run `pnpm build && pnpm test` before submitting.

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built with care on top of <a href="https://github.com/lightpanda-io/browser">Lightpanda</a>.
  <br />
  <sub>Webnix — test the web, beautifully.</sub>
</p>
