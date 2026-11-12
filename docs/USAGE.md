# Usage Guide / Panduan Penggunaan

> Dokumen ini adalah **acuan utama** pemakaian. Peta dokumen lain ada di
> [DOCS.md](DOCS.md).

WiraXplore menjalankan satu suite E2E di atas tiga engine: **Lightpanda**,
**Playwright**, dan **Puppeteer**. Dokumen ini menjelaskan cara memasang,
memilih engine, dan menguji app Anda.

## 1. Install / Instalasi

Butuh Node.js ≥ 20.

```bash
pnpm install
pnpm build
node bin/wiraxplore.js doctor
```

## 2. Cek environment

```bash
wiraxplore doctor
wiraxplore doctor --json
```

Yang dilaporkan:

- platform dan versi Node
- engine aktif (`lightpanda` | `playwright` | `puppeteer`)
- binary Lightpanda (termasuk deteksi lewat WSL di Windows)
- Chrome/Edge lokal untuk engine `playwright`/`puppeteer`
- apakah CDP server menjawab di `/json/version`

## 3. Inisialisasi project

Jalankan di root project app Anda:

```bash
wiraxplore init
```

Menghasilkan `wiraxplore.config.yaml`, `examples/webapp/index.html`, dan
`tests/e2e/demo.spec.ts`.

## 4. Memilih engine

Di `wiraxplore.config.yaml`:

```yaml
browser:
  engine: lightpanda   # lightpanda | playwright | puppeteer
  driver: playwright   # playwright | puppeteer
  host: 127.0.0.1
  port: 9222           # port CDP Lightpanda
  # channel: chrome    # atau msedge (engine playwright/puppeteer)
  # executablePath: "" # binary browser eksplisit
```

| engine | browser | driver | kapan dipakai |
| --- | --- | --- | --- |
| `lightpanda` | Lightpanda | playwright / puppeteer via CDP | cepat, hemat memori, CI |
| `playwright` | Chrome/Edge lokal | playwright-core | layout, screenshot, web platform penuh |
| `puppeteer` | Chrome/Edge lokal | puppeteer-core | project yang sudah pakai Puppeteer |

Tanpa mengubah config:

```bash
wiraxplore test --engine lightpanda
wiraxplore test --engine playwright
wiraxplore test --engine puppeteer
wiraxplore test --engine lightpanda --driver puppeteer
```

Override lewat environment: `WIRAXPLORE_ENGINE`, `WIRAXPLORE_DRIVER`,
`WIRAXPLORE_CDP_URL`, `WIRAXPLORE_BASE_URL`. Ini yang dipakai `wiraxplore test`
saat meneruskan pilihan engine ke spec.

## 5. Lifecycle Lightpanda

```bash
wiraxplore serve                    # CDP di 127.0.0.1:9222
wiraxplore serve --protocol bidi    # WebDriver Bidi
wiraxplore status
wiraxplore stop
```

`wiraxplore test` menyalakan server otomatis **hanya** untuk engine
`lightpanda`, lalu mematikannya setelah selesai. Engine `playwright`/`puppeteer`
meluncurkan Chrome sendiri.

Kalau server tidak mau naik, lihat `.wiraxplore.log`.

## 6. Menulis spec

```ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'wiraxplore';

test('home loads', async () => {
  const cfg = loadConfig();
  await withPage(cfg, async (page) => {
    await page.goto(cfg.baseUrl!);
    await page.waitFor('#title');
    expect(await page.title()).toMatch(/My App/);
  });
});
```

API `PandaPage`:

| method | keterangan |
| --- | --- |
| `goto(url, opts?)` | buka URL |
| `setContent(html)` | isi halaman dengan HTML |
| `click(selector)` | klik elemen |
| `fill(selector, value)` | isi input |
| `text(selector)` | teks elemen |
| `html(selector?)` | innerHTML elemen atau seluruh halaman |
| `eval(fnOrExpr, arg?)` | jalankan JS |
| `waitFor(selector, opts?)` | tunggu selector |
| `title()` / `url()` | judul dan URL |
| `screenshot(opts?)` | PNG (buffer atau file) |
| `close()` | tutup halaman |
| `raw` | page native driver (playwright/puppeteer) |

Untuk override engine di satu test:

```ts
await withPage(cfg, async (page) => { /* ... */ }, { engine: 'playwright' });
```

## 7. Menjalankan test

```bash
wiraxplore test                       # engine dari config
wiraxplore test --filter home         # hanya file yang cocok
wiraxplore test --engine playwright    # engine lain
wiraxplore test --no-serve             # jangan auto-start CDP
wiraxplore test --ui                   # vitest watch
```

Atau langsung lewat vitest:

```bash
pnpm vitest run tests/e2e
WIRAXPLORE_ENGINE=playwright pnpm vitest run tests/e2e
```

## 8. Integrasi coding agent

### Command Code

```bash
cmd mcp add wiraxplore -- npx -y wiraxplore mcp
# skill
mkdir -p ~/.commandcode/skills/wiraxplore
cp skills/wiraxplore/SKILL.md ~/.commandcode/skills/wiraxplore/SKILL.md
```

### OpenCode

```bash
wiraxplore plugin:opencode
```

Memasang plugin ke `~/.config/opencode/plugins/wiraxplore`, skill ke
`~/.config/opencode/skills/wiraxplore`, lalu mendaftarkan plugin dan MCP server
di `opencode.json(c)`. Restart OpenCode setelahnya.

Perbedaan versi yang ditangani otomatis:

| | OpenCode 1.x | OpenCode 2.x |
| --- | --- | --- |
| key config | `"plugin": []` | `"plugins": []` |
| MCP | `"mcp": { "nama": {...} }` | `"mcp": { "servers": { "nama": {...} } }` |
| entrypoint plugin | export `./server` | export `./v2` (`Plugin.define`) |

Cek dengan `opencode mcp list` — entri `wiraxplore` harus `✓ connected`.

### MCP server manual

```bash
wiraxplore mcp   # stdio
```

Config Command Code (`.mcp.json` / `~/.commandcode/mcp.json`):

```json
{
  "mcpServers": {
    "wiraxplore": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "wiraxplore", "mcp"]
    }
  }
}
```

Config OpenCode 2.x (`opencode.json`):

```json
{
  "mcp": {
    "servers": {
      "wiraxplore": {
        "type": "local",
        "command": ["npx", "-y", "wiraxplore", "mcp"]
      }
    }
  }
}
```

OpenCode 1.x memakai `"mcp": { "wiraxplore": { ... } }` tanpa `servers`.

## 9. Tools MCP

| tool | fungsi |
| --- | --- |
| `panda_status` | platform, engine, binary, probe CDP |
| `panda_serve_start` / `panda_serve_stop` | lifecycle Lightpanda |
| `panda_navigate` | buka URL → title, URL, teks; terima `engine` |
| `panda_extract` | teks atau HTML, bisa dibatasi selector |
| `panda_click` / `panda_fill` | interaksi |
| `panda_eval` | jalankan JS di halaman |
| `panda_wait` | tunggu selector |
| `panda_screenshot` | PNG halaman |
| `panda_close` | tutup sesi browser bersama |

Sesi dipakai bersama antar tool. Mengirim `engine` pada `panda_navigate` akan
mengganti engine untuk sesi berikutnya.

## 10. Alur menguji app (rekomendasi)

1. Nyalakan dev server app Anda (`pnpm dev`) dan pastikan `baseUrl` benar.
2. `wiraxplore doctor` — pastikan engine siap.
3. `wiraxplore init` bila belum ada config/spec.
4. Tulis spec pada `tests/e2e/*.spec.ts` memakai API `PandaPage`.
5. `wiraxplore test --engine lightpanda` untuk iterasi cepat.
6. `wiraxplore test --engine playwright` sebelum merge/rilis.
7. `wiraxplore stop` bila Anda menyalakan server sendiri.

## Troubleshooting

| Gejala | Penyebab / solusi |
| --- | --- |
| `browser.engine unknown` | nilai `engine` salah; pakai `lightpanda`, `playwright`, atau `puppeteer` |
| CDP tidak menjawab | `wiraxplore serve`, cek `.wiraxplore.log` |
| Lightpanda tidak ditemukan (Windows) | install di WSL2 atau pakai engine `playwright`/`puppeteer` |
| Chrome tidak ditemukan | set `browser.channel: chrome`/`msedge` atau `browser.executablePath` |
| Test lulus di Lightpanda tapi gagal di Chrome | perilaku spesifik browser; jalankan `--engine playwright` |
| Halaman kosong di Lightpanda | API belum didukung (WebGL, canvas); pakai engine `playwright` |

## 11. Flutter (preview)

Lihat `docs/FLUTTER.md`. Flutter Web bisa diuji seperti web biasa; mobile native
memakai `flutter drive` terpisah karena Lightpanda tidak berjalan di mobile.
