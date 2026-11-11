# Usage Guide / Panduan Penggunaan

## 1. Install / Instalasi

Requirements: Node.js >= 20, pnpm (or npm). Lightpanda binary (see Requirements).

```bash
git clone <this-repo>
cd WiraXplore
pnpm install
pnpm build
```

## 2. Check environment / Cek environment

```bash
WiraXplore doctor
```

On Windows, Lightpanda has no native binary — use WSL2 or Docker. The doctor command reports availability.

## 3. Initialize project / Inisialisasi project

Run inside your web app / Flutter project root:

```bash
WiraXplore init
```

Creates `WiraXplore.config.yaml`, `examples/webapp`, `tests/e2e/demo.spec.ts`.

## 4. Configure / Konfigurasi

Edit `WiraXplore.config.yaml`:

```yaml
name: my-app
baseUrl: http://localhost:3000
browser:
  mode: cdp
  host: 127.0.0.1
  port: 9222
tests:
  dir: tests/e2e
  pattern: "**/*.spec.ts"
  timeoutMs: 30000
```

## 5. Start Lightpanda / Jalankan Lightpanda

```bash
WiraXplore serve            # CDP on 9222
WiraXplore serve --protocol bidi   # WebDriver Bidi
WiraXplore status
WiraXplore stop
```

## 6. Write tests / Tulis test

Use Playwright API connected to Lightpanda:

```ts
import { test, expect } from 'vitest';
import { withPage } from './src/adapters/playwright'; // adjust path
import { loadConfig } from './src/config';

test('home loads', async () => {
  const cfg = loadConfig(process.cwd());
  await withPage(cfg, async (page) => {
    await page.goto(cfg.baseUrl!);
    await expect(page).toHaveTitle(/My App/);
  });
});
```

## 7. Run tests / Jalankan test

```bash
WiraXplore test
```

Auto-starts server if not running, runs Vitest in `tests/e2e`, stops server after.

## 8. Coding agents / Agent coding

### OpenCode

```bash
WiraXplore plugin:opencode
# then add MCP entry to ~/.config/opencode/opencode.jsonc (printed by command)
opencode mcp add   # or edit config manually
```

MCP config snippet:
```json
{
  "mcp": {
    "servers": {
      "WiraXplore": {
        "type": "local",
        "command": ["WiraXplore", "mcp"]
      }
    }
  }
}
```

### Command Code / other MCP agents

```bash
WiraXplore mcp   # stdio MCP server
```

Point agent MCP config to `WiraXplore mcp`.

## 9. MCP tools / Tools MCP

- `panda_status` — binary + server status.
- `panda_serve_start` / `panda_serve_stop`
- `panda_navigate` — `{ url, waitUntil? }`
- `panda_extract` — `{ selector? }`
- `panda_click` — `{ selector }`
- `panda_fill` — `{ selector, value }`
- `panda_eval` — `{ expression }`

## 10. Flutter (preview)

See `docs/FLUTTER.md`. Web tests can target Flutter Web builds; native mobile uses Flutter driver (separate).

## Troubleshooting

- Binary not found: run `WiraXplore doctor`, follow install hint.
- Connection refused on 9222: ensure `WiraXplore serve` running.
- Windows: use WSL2/Docker; native binary unavailable.
