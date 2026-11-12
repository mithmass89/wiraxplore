# Cara Kerja Aplikasi & Cara Testing (Headless / Headful)

Satu file acuan untuk project ini: **apa yang harus dilakukan** saat menguji UI.
Bisa dibaca manusia maupun AI agent. Simpan di root project atau di
`.agents/skills/wiraxplore/TESTING.md`.

---

## 1. Cara kerja aplikasinya

```
┌──────────────┐   HTTP    ┌──────────────┐   CDP    ┌────────────┐   ┌────────┐
│  App Anda    │ ◄───────► │   Browser    │ ◄──────► │ WiraXplore │──►│ vitest │
│ (dev server) │           │ (engine)     │          │  (harness) │   │ (spec) │
└──────────────┘           └──────────────┘          └────────────┘   └────────┘
```

Empat hal yang perlu dipahami:

1. **App Anda adalah black box.** WiraXplore tidak meng-import kode app, tidak
   butuh SDK, tidak butuh registrasi route. Syaratnya cuma: app bisa diakses
   lewat URL.
2. **"Flow" = file spec.** Semua skenario ada di `tests/e2e/*.spec.ts` dan
   ditemukan vitest lewat konvensi nama file. Tidak ada auto-discovery.
3. **WiraXplore tidak menyalakan app Anda.** Jalankan dev server sendiri
   (`pnpm dev`, `npm start`, `flutter run -d chrome`, dst).
4. **Browser dijalankan WiraXplore.** Inilah yang bisa **terlihat** atau
   **tidak terlihat** — itu inti headless vs headful.

---

## 2. Headless vs Headful (headed)

| | Headless | Headful (`--headed`) |
| --- | --- | --- |
| Jendela browser | tidak ada | **muncul di layar** |
| Kecepatan | cepat | lebih lambat (apalagi `--slow-mo`) |
| Cocok untuk | CI, regresi cepat, server | debugging, demo, "kok UI-nya begini?" |
| Engine yang bisa | lightpanda, playwright, puppeteer | **playwright, puppeteer** |
| Lightpanda | ya | **tidak bisa** — tidak punya UI sama sekali |

### Perintah

```bash
# HEADLESS (default)
wiraxplore test

# HEADFUL — jendela Chrome terbuka, test berjalan di depan mata
wiraxplore test --headed

# HEADFUL + diperlambat supaya alur login/isi form terlihat
wiraxplore test --headed --slow-mo 400

# HEADFUL dengan engine tertentu
wiraxplore test --engine puppeteer --headed --slow-mo 300
wiraxplore test --engine playwright --headed
```

`--headed` **otomatis berpindah engine** kalau config masih memakai
`lightpanda`:

```
! lightpanda has no window — --headed switched to the "playwright" engine (local Chrome/Edge)
→ running vitest [playwright via playwright, headed slowMo=250ms] in tests/e2e
```

### Kenapa tadi browser tidak terbuka?

Empat penyebab yang paling sering:

1. **Engine masih `lightpanda`.** Lightpanda tidak punya jendela sama sekali.
   Jalankan `--headed` (otomatis pindah) atau `--engine playwright`.
2. **`--headed` tidak diteruskan ke spec.** Kalau Anda menjalankan
   `pnpm exec vitest` langsung, set environment-nya:
   `WIRAXPLORE_HEADED=1 pnpm exec vitest run tests/e2e`.
3. **Spec tidak memakai opsi headed.** Spec harus meneruskan
   `{ engine, headed }` ke `withPage`, atau mengandalkan env:
   ```ts
   const ENGINE = process.env.WIRAXPLORE_ENGINE ?? 'playwright';
   const HEADED = process.env.WIRAXPLORE_HEADED === '1';
   await withPage(cfg, async (page) => { ... }, { engine: ENGINE, headed: HEADED });
   ```
4. **Chrome tidak ketemu.** `wiraxplore doctor` akan bilang. Set
   `browser.channel: chrome` / `msedge` atau `browser.executablePath`.

Cek cepat:

```bash
wiraxplore doctor          # engine, binary, browser lokal
wiraxplore test --headed   # harus membuka jendela Chrome
```

---

## 3. Setup project (sekali)

```bash
# A. paket belum ada di npm — instal dari folder repo
pnpm add -D file:../wiraxplore vitest

# B. setelah dipublikasikan
pnpm add -D wiraxplore vitest
```

```bash
wiraxplore init     # config + demo spec + skill agent
wiraxplore doctor   # cek kesiapan
```

Struktur yang dihasilkan:

```
wiraxplore.config.yaml
tests/e2e/demo.spec.ts
examples/webapp/index.html
.agents/skills/wiraxplore/SKILL.md
```

---

## 4. Konfigurasi

`wiraxplore.config.yaml`:

```yaml
name: my-app
baseUrl: http://localhost:3000

browser:
  engine: playwright     # lightpanda | playwright | puppeteer
  driver: playwright     # playwright | puppeteer
  headless: true         # false = jendela terbuka
  viewport:              # dipakai SEMUA engine; mencegah lolos di satu engine saja
    width: 1280
    height: 720
  slowMo: 0              # ms antar aksi, untuk menonton alur
  # debugPort: 9333      # opt-in, hanya untuk attach ke Chrome yang diluncurkan
  channel: chrome        # chrome | msedge (opsional)
  # executablePath: ""   # binary browser eksplisit
  host: 127.0.0.1
  port: 9222             # port CDP Lightpanda

tests:
  dir: tests/e2e
  timeoutMs: 30000       # benar-benar diteruskan ke vitest --testTimeout
```

Override tanpa mengubah file:

```bash
wiraxplore test --engine playwright --headed --slow-mo 300
```

Variabel environment:

| variabel | efek |
| --- | --- |
| `WIRAXPLORE_ENGINE` | `lightpanda` / `playwright` / `puppeteer` |
| `WIRAXPLORE_DRIVER` | `playwright` / `puppeteer` |
| `WIRAXPLORE_HEADED` | `1` = jendela terbuka |
| `WIRAXPLORE_SLOWMO` | ms antar aksi |
| `WIRAXPLORE_BASE_URL` | override `baseUrl` |
| `WIRAXPLORE_CDP_URL` | alamat CDP Lightpanda |

---

## 5. Contoh lengkap: login → input data

Demo satu file ada di `examples/webapp/index.html` (login `admin@demo.test` /
`panda123`, lalu form data dengan tabel). Spec-nya
`tests/e2e/demo-app.spec.ts`.

Pola spec-nya:

```ts
import { test, expect } from 'vitest';
import { withPage, loadConfig } from 'wiraxplore';

const ENGINE = process.env.WIRAXPLORE_ENGINE ?? 'playwright';
const HEADED = process.env.WIRAXPLORE_HEADED === '1';

test('login lalu simpan data', async () => {
  const cfg = loadConfig();
  await withPage(cfg, async (page) => {
    await page.goto(cfg.baseUrl!);

    // login
    await page.fill('[data-testid=login-email]', 'admin@demo.test');
    await page.fill('[data-testid=login-password]', 'panda123');
    await page.click('[data-testid=login-submit]');
    await page.waitFor('[data-testid=data-form]');

    // input data
    await page.fill('[data-testid=data-name]', 'Budi Santoso');
    await page.fill('[data-testid=data-city]', 'Jakarta');
    await page.click('[data-testid=data-submit]');

    // verifikasi
    expect(await page.text('[data-testid=record-count]')).toBe('1');
    expect(await page.text('[data-testid=record-name]')).toBe('Budi Santoso');
  }, { engine: ENGINE, headed: HEADED });
}, 60000);
```

Jalankan:

```bash
# headless, cepat
wiraxplore test --filter demo-app

# headful, terlihat
wiraxplore test --filter demo-app --headed --slow-mo 300
```

Catatan penting: **gunakan HTTP, bukan `setContent`**, kalau app memakai
`localStorage`/cookie. `setContent` berjalan di origin `about:blank` sehingga
`localStorage` diblokir dan data tidak tersimpan antar aksi. Spec demo
menjalankan server HTTP kecil sendiri untuk alasan ini.

---

## 6. API `PandaPage`

Kontraknya **sama di semua engine**, dan itu diuji: `tests/e2e/parity.spec.ts`
(wait states, fill/type/press, waitForFunction, screenshot elemen) dan
`tests/e2e/viewport.spec.ts` (breakpoint layout). Kalau ada yang berbeda, build
gagal — bukan Anda yang menemukannya nanti.

| method | keterangan |
| --- | --- |
| `goto(url, opts?)` | buka URL; `waitUntil`: `load`/`domcontentloaded`/`networkidle0`/`networkidle2` |
| `setContent(html)` | isi HTML mentah (tanpa server; tanpa localStorage) |
| `click(selector)` | klik elemen |
| `fill(selector, value, opts?)` | set value langsung + dispatch input/change (tanpa key event) |
| `type(selector, text, opts?)` | ketikan nyata (keydown/keypress), untuk mask & handler |
| `press(key)` | tekan satu tombol: `Enter`, `Tab`, `Escape` |
| `value(selector)` | nilai `input`/`textarea` |
| `text(selector)` | `textContent` elemen |
| `html(selector?)` | `innerHTML` elemen atau seluruh dokumen |
| `eval(fnOrExpr, arg?)` | jalankan JS, hasil dikembalikan |
| `waitFor(selector, opts?)` | tunggu selector; keempat state identik di semua engine |
| `waitForFunction(fn, arg?, opts?)` | tunggu kondisi non-selector (pengganti polling manual) |
| `setViewport({width,height})` | ubah ukuran viewport saat test berjalan |
| `title()` / `url()` | judul dan URL |
| `screenshot(opts?)` | PNG halaman, atau satu elemen bila `selector` diisi |
| `close()` | tutup halaman |
| `raw` | page native Playwright/Puppeteer |

Semua async kecuali `url()`.

---

## 7. Lifecycle server

```bash
wiraxplore serve                 # CDP di 127.0.0.1:9222
wiraxplore serve --host 0.0.0.0 --port 9223
wiraxplore status
wiraxplore stop
```

`wiraxplore test` menyalakan Lightpanda otomatis **hanya** untuk engine
`lightpanda`, lalu mematikannya setelah run. Engine `playwright`/`puppeteer`
meluncurkan Chrome sendiri.

### pm2 (server tetap hidup)

```bash
wiraxplore pm2 start     # tulis ecosystem.config.cjs + pm2 start + pm2 save
wiraxplore pm2 status
wiraxplore pm2 save
wiraxplore pm2 stop
```

`pm2 save` sudah otomatis, jadi `pm2 resurrect` memulihkan server setelah reboot.

---

## 8. MCP (drive browser dari agent)

```bash
wiraxplore mcp    # stdio MCP server
```

| tool | parameter | fungsi |
| --- | --- | --- |
| `panda_status` | — | engine, binary, probe CDP |
| `panda_serve_start` / `panda_serve_stop` | `protocol?` | lifecycle server |
| `panda_navigate` | `url`, `waitUntil?`, `engine?`, `includeText?` | buka URL |
| `panda_extract` | `selector?`, `format?` | baca teks/HTML |
| `panda_click` / `panda_fill` | `selector`, `value?` | interaksi |
| `panda_type` / `panda_press` | `selector`, `text` / `key` | ketikan nyata & tombol |
| `panda_wait_for_function` | `expression` | tunggu kondisi non-selector |
| `panda_viewport` | `width`, `height` | ubah viewport |
| `panda_eval` | `expression` | jalankan JS |
| `panda_wait` | `selector`, `state?`, `timeoutMs?` | tunggu selector |
| `panda_screenshot` | `fullPage?` | kirim PNG |
| `panda_close` | — | tutup sesi |

Alur eksplorasi tanpa spec:

```
panda_navigate { url: "http://localhost:3000" }
panda_extract  { selector: "nav", format: "html" }
panda_click    { selector: "[data-testid=login-submit]" }
panda_screenshot { fullPage: true }
```

Setelah alur jelas, ubah langkah itu menjadi spec agar bisa diulang tanpa LLM.

---

## 9. Troubleshooting

| gejala | penyebab / solusi |
| --- | --- |
| **Tidak ada jendela browser** | engine `lightpanda` (tidak punya UI) → pakai `--headed` atau `--engine playwright`; atau `WIRAXPLORE_HEADED` belum di-set saat memanggil vitest langsung |
| `no CDP endpoint at http://127.0.0.1:9222` | `wiraxplore serve`, atau pakai engine `playwright` |
| `browser channel "chrome" not found` | set `browser.executablePath` |
| Data hilang antar aksi | memakai `setContent` (origin `about:blank`); pakai `goto` ke HTTP |
| Test lulus di Lightpanda, gagal di Chrome | perilaku browser; ikuti hasil Chrome |
| Halaman kosong di Lightpanda | canvas/WebGL tidak dirender; pakai `--engine playwright` |
| `Cannot find module 'wiraxplore'` | paket belum terpasang (lihat bagian 3) |
| `dist/ is missing` | jalankan `npm run build` di repo WiraXplore |

---

## 10. Aturan untuk agent

- Jangan mengklaim UI benar hanya dari hasil Lightpanda — jalankan `--headed`
  atau `--engine playwright` untuk urusan visual.
- Jangan menyalakan `wiraxplore serve` tanpa mematikannya (`wiraxplore stop`).
- Jangan menambah dependency ke app hanya untuk testing.
- Setiap spec harus bisa jalan sendiri (tidak bergantung urutan file).
- Jangan mengubah kode produksi demi meluluskan test tanpa izin.
- Prefer `data-testid` daripada selector berbasis teks atau struktur DOM.

---

## 11. Script demo manual (untuk rekaman video)

Dua script menjalankan demo dengan **jendela browser sungguhan**:

```bat
scripts\test-entry.bat            # login -> input data
scripts\test-booking.bat          # booking hotel (mock)

scripts\test-booking.bat --auto --slow 800
```

| perintah | arti |
| --- | --- |
| tanpa argumen | browser terbuka, Anda klik manual (sambil merekam) |
| `--auto` | alur dijalankan otomatis, cocok untuk rekaman tanpa tangan |
| `--slow 800` | jeda antar aksi 800 ms |
| `--exit` | tutup browser setelah alur selesai (smoke test) |
| `--engine playwright` | pakai Playwright, bukan Puppeteer |

Padanan lintas platform (tanpa `.bat`):

```bash
node demo/run.mjs entry
node demo/run.mjs booking --auto --slow 800
node demo/run.mjs booking --auto --exit --slow 200   # cek cepat
```

Yang dilakukan script: membuat HTTP server lokal untuk file demo, membuka Chrome
dengan `headless: false`, lalu (kalau `--auto`) memainkan alur dan membiarkan
jendela terbuka sampai Anda menekan Ctrl+C.

**File demo ini sengaja tidak masuk git** (didaftarkan di `.git/info/exclude`):
`demo/`, `scripts/test-entry.bat`, `scripts/test-booking.bat`,
`tests/e2e/booking.spec.ts`.

Alur booking yang dimainkan:

1. Pilih kamar (Standard / Deluxe / Ocean Suite).
2. Isi data pemesan (nama, email, telepon).
3. Atur check-in / check-out → total dihitung dari harga kamar × malam.
4. Pesan → muncul kode booking `NB-XXXXXX` dan ringkasan.
5. Booking tersimpan di tabel dan `localStorage`.

Semua data mock — tidak ada pembayaran atau backend.

---

## 12. Checklist cepat

```bash
# 1. app jalan?
curl -s http://localhost:3000 > /dev/null && echo "app up"

# 2. browser siap?
wiraxplore doctor

# 3. coba headless
wiraxplore test --filter demo-app

# 4. coba headful (harus ada jendela)
wiraxplore test --filter demo-app --headed --slow-mo 300
```
