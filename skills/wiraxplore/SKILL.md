---
name: wiraxplore
description: Test this app's UI with WiraXplore browser E2E (Lightpanda, Playwright, or Puppeteer). Use when asked to test a web page, verify a user flow, write or debug an E2E spec, check why a page renders differently, or take a screenshot of a running app.
---

# WiraXplore — Agent Playbook

Panduan lengkap memakai WiraXplore untuk menguji app di project ini.
Dokumen ini ditulis untuk **AI agent** (Command Code, OpenCode, Claude, Cursor, dll)
dan untuk manusia yang mengawasi agent tersebut.

> Simpan file ini di `.agents/skills/wiraxplore/SKILL.md` pada project Anda.
> Command Code dan OpenCode sama-sama membaca folder `.agents/skills/`.
> Alternatif cepat: jalankan `wiraxplore agent:init --agents-md`.

---

## 1. Apa itu WiraXplore

WiraXplore adalah harness E2E yang menjalankan **satu** suite spec terhadap tiga
engine browser. Kode test tidak berubah saat Anda berganti engine.

```
App Anda (dev server)  ──HTTP──▶  browser  ──CDP──▶  WiraXplore  ──▶  vitest
```

Tiga hal yang perlu dipahami:

1. **App Anda black box.** WiraXplore tidak meng-import kode app, tidak butuh
   SDK, tidak butuh registrasi route/flow. Syaratnya cuma satu: app bisa diakses
   lewat URL (`baseUrl`).
2. **"Flow" = file spec.** Semua skenario ada di `tests/e2e/*.spec.ts` dan
   ditemukan oleh vitest lewat konvensi nama file. Tidak ada discovery otomatis
   dari router atau sitemap.
3. **WiraXplore tidak menyalakan app Anda.** Jalankan dev server sendiri
   (`pnpm dev`, `npm start`, `flutter run -d chrome`, dst). WiraXplore hanya
   mengurus browser.

---

## 2. Engine

| engine | browser | driver | kapan dipakai |
| --- | --- | --- | --- |
| `lightpanda` | Lightpanda (Zig, headless) | `playwright` atau `puppeteer` via CDP | cepat & hemat memori; cocok untuk iterasi dan CI |
| `playwright` | Chrome/Edge lokal | `playwright-core` | layout, screenshot, canvas, WebGL, semua API modern |
| `puppeteer` | Chrome/Edge lokal | `puppeteer-core` | project yang sudah memakai Puppeteer |

Aturan penting:

- Lightpanda **tidak merender grafik**. WebGL, `<canvas>`, dan screenshot-diff
  tidak bisa diandalkan. Assertion berbasis DOM tetap akurat.
- Kalau spec lulus di Lightpanda tapi tampilan terlihat salah, ulangi dengan
  `--engine playwright` sebelum menyimpulkan apa pun.
- Engine `playwright`/`puppeteer` meluncurkan Chrome sendiri; tidak butuh server
  CDP dan tidak butuh binary Lightpanda.

Matriks kombinasi yang valid:

```
lightpanda + playwright   ✅ (default, via CDP)
lightpanda + puppeteer    ✅ (via CDP)
playwright + playwright   ✅ (launch Chrome)
puppeteer  + puppeteer    ✅ (launch Chrome)
playwright + puppeteer    ❌ ditolak
puppeteer  + playwright   ❌ ditolak
```

---

## 3. Instalasi (sekali per project)

Belum ada di npm. Pilih salah satu:

```bash
# A. dari repo lokal (paling umum saat ini)
pnpm add -D file:../wiraxplore vitest
# atau: npm i -D ../wiraxplore

# B. setelah dipublikasikan
pnpm add -D wiraxplore vitest
```

Siapkan project:

```bash
wiraxplore init                     # config + demo spec + skill agent
wiraxplore agent:init --agents-md   # kalau project sudah punya config
wiraxplore doctor                   # cek engine & browser
```

`init` membuat:

```
wiraxplore.config.yaml
tests/e2e/demo.spec.ts
examples/webapp/index.html
.agents/skills/wiraxplore/SKILL.md
```

Tanpa npm sama sekali pun bisa, selama paket tersedia di filesystem:

```bash
node ../wiraxplore/bin/wiraxplore.js doctor
```

---

## 4. Konfigurasi

`wiraxplore.config.yaml` di root project:

```yaml
name: my-app
baseUrl: http://localhost:3000

browser:
  engine: lightpanda     # lightpanda | playwright | puppeteer
  driver: playwright     # playwright | puppeteer
  mode: cdp              # cdp | bidi | mcp
  host: 127.0.0.1
  port: 9222             # port CDP Lightpanda
  debugPort: 9333        # dipakai saat Chrome diluncurkan sendiri
  channel: chrome        # chrome | msedge (opsional)
  # executablePath: ""   # binary browser eksplisit
  headless: true
  obeyRobots: false

tests:
  dir: tests/e2e
  pattern: "**/*.spec.ts"
  timeoutMs: 30000
  # args: ["--reporter=verbose"]
```

Nama file yang dikenali (yang pertama ditemukan menang):
`wiraxplore.config.yaml`, `.yml`, `.json`, `.wiraxplore.json`, lalu varian lama
berhuruf besar (`WiraXplore.config.*`).

Override tanpa mengubah config:

```bash
wiraxplore test --engine playwright
wiraxplore test --engine puppeteer --filter login
```

Variabel environment:

| variabel | efek |
| --- | --- |
| `WIRAXPLORE_ENGINE` | engine (`lightpanda`/`playwright`/`puppeteer`) |
| `WIRAXPLORE_DRIVER` | driver (`playwright`/`puppeteer`) |
| `WIRAXPLORE_CDP_URL` | alamat CDP, mis. `http://127.0.0.1:9222` |
| `WIRAXPLORE_BASE_URL` | override `baseUrl` |
| `LIGHTPANDA_BIN` | path binary Lightpanda (boleh `wsl:/path/...`) |

---

## 5. Menulis spec

Semua spec memakai Vitest + API `PandaPage`.

```ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'wiraxplore';

test('login berhasil', async () => {
  const cfg = loadConfig();
  await withPage(cfg, async (page) => {
    await page.goto(`${cfg.baseUrl}/login`);
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'secret');
    await page.click('button[type=submit]');
    await page.waitFor('[data-testid=dashboard]');
    expect(await page.text('[data-testid=greeting]')).toContain('Halo');
  });
});
```

Override engine hanya untuk satu test:

```ts
await withPage(cfg, async (page) => { /* ... */ }, { engine: 'playwright' });
```

### Ringkasan API `PandaPage`

| method | keterangan |
| --- | --- |
| `goto(url, opts?)` | buka URL; `opts.waitUntil`: `load`/`domcontentloaded`/`networkidle0`/`networkidle2` |
| `setContent(html)` | isi halaman dengan HTML mentah (tanpa server) |
| `click(selector)` | klik elemen |
| `fill(selector, value, opts?)` | set value langsung + dispatch input/change (tanpa key event) |
| `type(selector, text, opts?)` | ketikan nyata (keydown/keypress), untuk mask & handler |
| `press(key)` | tekan satu tombol: `Enter`, `Tab`, `Escape` |
| `value(selector)` | nilai `input`/`textarea` |
| `text(selector)` | `textContent` elemen |
| `html(selector?)` | `innerHTML` elemen, atau seluruh dokumen bila tanpa selector |
| `eval(fnOrExpr, arg?)` | jalankan JS di halaman, hasil dikembalikan |
| `waitFor(selector, opts?)` | tunggu selector; keempat state identik di semua engine |
| `waitForFunction(fn, arg?, opts?)` | tunggu kondisi non-selector (pengganti polling manual) |
| `setViewport({width,height})` | ubah ukuran viewport saat test berjalan |
| `title()` / `url()` | judul dan URL aktif |
| `screenshot(opts?)` | PNG halaman, atau satu elemen bila `selector` diisi |
| `close()` | tutup halaman |
| `raw` | objek page asli Playwright/Puppeteer untuk kebutuhan khusus |

Semua method mengembalikan `Promise` kecuali `url()`.

---

## 6. Menjalankan test

```bash
wiraxplore test                       # engine dari config
wiraxplore test --filter login        # hanya file yang cocok
wiraxplore test --engine playwright    # engine lain
wiraxplore test --no-serve             # jangan auto-start CDP
wiraxplore test --ui                   # vitest watch
```

`wiraxplore test` menyalakan Lightpanda otomatis **hanya** untuk engine
`lightpanda`, lalu mematikannya setelah run selesai — termasuk saat test gagal.

Langsung lewat vitest:

```bash
pnpm exec vitest run tests/e2e
WIRAXPLORE_ENGINE=playwright pnpm exec vitest run tests/e2e
```

---

## 7. Lifecycle Lightpanda

```bash
wiraxplore serve                   # CDP di 127.0.0.1:9222
wiraxplore serve --host 0.0.0.0 --port 9223
wiraxplore serve --protocol bidi   # WebDriver Bidi
wiraxplore status                  # probe /json/version
wiraxplore stop
```

Log server ada di `.wiraxplore.log`; PID di `.wiraxplore.pid`. Keduanya
sebaiknya masuk `.gitignore`.

Di Windows tidak ada binary Lightpanda native. WiraXplore mendeteksinya di WSL
(`wsl:/home/<user>/.local/bin/lightpanda`) dan bicara lewat `127.0.0.1:9222`.
Kalau WSL tidak tersedia, pakai engine `playwright` atau `puppeteer`.

### pm2 (server permanen)

```bash
wiraxplore pm2 init     # tulis ecosystem.config.cjs
wiraxplore pm2 start    # pm2 start + pm2 save
wiraxplore pm2 status   # pm2 describe wiraxplore-lightpanda
wiraxplore pm2 save     # setelah perubahan
wiraxplore pm2 stop     # pm2 delete + save
```

`pm2 start` sudah menjalankan `pm2 save`, jadi proses kembali setelah
`pm2 resurrect`. Ecosystem memakai entrypoint JS (`node .../bin/wiraxplore.js serve`).

### Mode ber-UI (headed)

Hanya engine `playwright`/`puppeteer`. Lightpanda tidak punya UI, jadi
`--headed` diabaikan (dengan peringatan).

```bash
wiraxplore test --engine puppeteer --headed
wiraxplore test --engine playwright --headed --slow-mo 400
```

Config: `browser.headless: false` dan `browser.slowMo: 250`.
Env: `WIRAXPLORE_HEADED=1`, `WIRAXPLORE_SLOWMO=400`.

Jangan memakai `--headed` di CI; tidak ada display dan test akan gagal.

---

## 8. MCP tools (drive browser dari agent)

Jalankan `wiraxplore mcp` sebagai MCP server stdio, atau daftarkan sekali:

```bash
cmd mcp add wiraxplore -- wiraxplore mcp    # Command Code
```

| tool | parameter | fungsi |
| --- | --- | --- |
| `panda_status` | — | platform, engine aktif, binary, probe CDP |
| `panda_serve_start` | `protocol?` | nyalakan server CDP |
| `panda_serve_stop` | — | matikan server CDP |
| `panda_navigate` | `url`, `waitUntil?`, `engine?`, `includeText?` | buka URL, balikan title/URL/teks |
| `panda_extract` | `selector?`, `format?` (`text`/`html`) | baca isi halaman |
| `panda_click` | `selector` | klik elemen |
| `panda_fill` | `selector`, `value` | isi input |
| `panda_eval` | `expression` | jalankan JS di halaman |
| `panda_wait` | `selector`, `state?`, `timeoutMs?` | tunggu selector |
| `panda_screenshot` | `fullPage?` | kirim PNG halaman |
| `panda_close` | — | tutup sesi browser |

Sesi dipakai bersama antar tool. Mengirim `engine` pada `panda_navigate` akan
mengganti engine untuk panggilan berikutnya.

**Alur eksplorasi tanpa spec** (berguna saat agent belum tahu UI-nya):

```
panda_navigate  { url: "http://localhost:3000" }
panda_extract   { selector: "nav a", format: "html" }
panda_click     { selector: "a[href='/settings']" }
panda_screenshot{ fullPage: true }
```

Setelah alurnya jelas, ubah langkah-langkah itu menjadi spec agar bisa
dijalankan ulang tanpa LLM.

---

## 9. Alur kerja yang direkomendasikan

1. Pastikan app jalan dan `baseUrl` benar.
2. `wiraxplore doctor` — engine siap?
3. Tulis satu spec untuk alur paling penting dulu.
4. `wiraxplore test --engine lightpanda` untuk iterasi cepat.
5. `wiraxplore test --engine playwright` sebelum merge/rilis.
6. Commit `tests/e2e`, `wiraxplore.config.yaml`, dan `.agents/`.

---

## 10. Troubleshooting

| gejala | penyebab / solusi |
| --- | --- |
| `unknown browser.engine "x"` | nilai engine salah; pakai `lightpanda`, `playwright`, atau `puppeteer` |
| `no CDP endpoint at http://127.0.0.1:9222` | jalankan `wiraxplore serve`, atau pakai engine `playwright` |
| CDP tidak menjawab setelah `serve` | lihat `.wiraxplore.log`; cek port 9222 dipakai proses lain |
| `lightpanda not found` (Windows) | install di WSL2, atau ganti engine ke `playwright`/`puppeteer` |
| `browser channel "chrome" not found` | set `browser.executablePath` ke binary Chrome/Edge |
| test lulus di Lightpanda, gagal di Chrome | perilaku spesifik browser; ikuti hasil Chrome |
| halaman kosong di Lightpanda | API belum didukung (canvas/WebGL); pakai `--engine playwright` |
| `Cannot find module 'wiraxplore'` | paket belum terpasang; lihat bagian 3 |
| `dist/ is missing` saat menjalankan bin | jalankan `npm run build` di repo WiraXplore |

---

## 11. Batasan yang harus dipatuhi agent

- Jangan mengklaim UI "benar" hanya dari hasil Lightpanda.
- Jangan menjalankan `wiraxplore serve` tanpa mematikannya kembali
  (`wiraxplore stop`), kecuali sengaja dibiarkan untuk sesi berikutnya.
- Jangan menambah dependency ke app hanya untuk keperluan test.
- Jangan menulis spec yang bergantung pada urutan eksekusi file lain; setiap
  spec harus bisa jalan sendiri.
- App tetap milik manusia: jangan mengubah kode produksi demi meluluskan test
  tanpa izin eksplisit.

---

## 12. Referensi

| dokumen | isi |
| --- | --- |
| `docs/USAGE.md` (di repo WiraXplore) | acuan pemakaian lengkap untuk manusia |
| `docs/DOCS.md` | peta seluruh dokumentasi |
| `docs/REQUIREMENTS.md` | prasyarat per engine & platform |
| `docs/FLUTTER.md` | kasus Flutter Web dan mobile |
| `plugins/opencode/README.md` | integrasi OpenCode (V1 vs V2) |
| `plugins/commandcode/README.md` | integrasi Command Code |
