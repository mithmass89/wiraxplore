# WiraXplore (Bahasa Indonesia)

Harness E2E yang menjalankan satu suite test di atas tiga engine browser:
[Lightpanda](https://github.com/lightpanda-io/browser), **Playwright**, dan
**Puppeteer**. Cepat di Lightpanda, akurat di Chrome asli, dan bisa dikendalikan
dari coding agent (Command Code, OpenCode) lewat MCP.

## Fitur

- **Tiga engine, satu API** — spec tidak berubah saat berganti engine.
- **Lifecycle Lightpanda** — deteksi binary (termasuk via WSL di Windows),
  start/stop server CDP, cek status lewat probe `/json/version`.
- **Playwright & Puppeteer** — mengemudikan Chrome/Edge lokal, atau mengemudikan
  Lightpanda lewat CDP.
- **Server MCP** — `panda_*` tools untuk coding agent.
- **Plugin OpenCode + skill Command Code**.
- **Runner E2E** — `wiraxplore test` menyalakan Lightpanda, menjalankan Vitest,
  lalu mematikannya.

## Mulai cepat

```bash
pnpm install && pnpm build
node bin/wiraxplore.js doctor

cd /path/to/your-app
wiraxplore init
wiraxplore test                       # engine dari config
wiraxplore test --engine playwright    # paksa Chrome asli
```

## Cara menguji app Anda

1. Nyalakan app Anda (mis. `pnpm dev`) di `http://localhost:3000`.
2. Set `baseUrl` di `wiraxplore.config.yaml`.
3. Tulis spec di `tests/e2e/*.spec.ts`:

```ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'wiraxplore';

test('greet', async () => {
  const cfg = loadConfig();
  await withPage(cfg, async (page) => {
    await page.goto(cfg.baseUrl!);
    await page.fill('#name', 'Panda');
    await page.click('#greet');
    expect(await page.text('#out')).toBe('Hello, Panda');
  });
});
```

4. `wiraxplore test --engine lightpanda` untuk iterasi cepat.
5. `wiraxplore test --engine playwright` sebelum merge.

## Memilih engine

| engine | browser | driver | kapan |
| --- | --- | --- | --- |
| `lightpanda` | Lightpanda | playwright / puppeteer | cepat, CI, hemat memori |
| `playwright` | Chrome/Edge lokal | playwright-core | layout, screenshot |
| `puppeteer` | Chrome/Edge lokal | puppeteer-core | project berbasis Puppeteer |

## Integrasi agent

```bash
# Command Code
cmd mcp add wiraxplore -- wiraxplore mcp

# OpenCode
wiraxplore plugin:opencode

# MCP manual
wiraxplore mcp
```

## Dokumentasi

- [Peta dokumentasi](DOCS.md) — mulai dari sini
- [Cara pakai](USAGE.md) — acuan utama
- [Requirement](REQUIREMENTS.md)
- [Panduan Flutter](FLUTTER.md)
