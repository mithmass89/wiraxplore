# Requirements / Persyaratan

## System / Sistem

- Node.js ≥ 20, pnpm atau npm
- Git

Engine yang dipakai menentukan kebutuhan tambahan:

| engine | butuh |
| --- | --- |
| `lightpanda` | binary Lightpanda (Linux/macOS) atau WSL2/Docker di Windows |
| `playwright` | Chrome atau Edge lokal; tanpa perlu `playwright install` |
| `puppeteer` | Chrome atau Edge lokal |

Chrome/Edge dideteksi otomatis di lokasi standar (Windows, macOS, Linux). Bila
tidak terdeteksi, set `browser.channel: chrome|msedge` atau
`browser.executablePath` di `wiraxplore.config.yaml`.

## Lightpanda install

Linux/macOS:

```bash
brew install lightpanda-io/browser/lightpanda
# atau
curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux
chmod +x ./lightpanda && sudo mv ./lightpanda /usr/local/bin/
```

Windows: tidak ada binary native. Pakai WSL2:

```bash
wsl --install
# di dalam WSL:
curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux
chmod +x ./lightpanda && mkdir -p ~/.local/bin && mv ./lightpanda ~/.local/bin/
```

Atau Docker:

```bash
docker run -d -p 127.0.0.1:9222:9222 lightpanda/browser:latest
```

Cek dengan `wiraxplore doctor`. Bila Lightpanda tidak tersedia, gunakan engine
`playwright` atau `puppeteer`.

## Project setup

1. App harus bisa dijalankan dan dijangkau (dev server atau hasil build).
2. Set `baseUrl` di `wiraxplore.config.yaml`.
3. Spec ada di `tests/e2e` memakai API `PandaPage`.
4. Untuk engine `lightpanda`, hindari fitur grafis (WebGL, canvas pixel,
   screenshot-diff) karena tidak ada rendering grafis.

## Yang didukung Lightpanda

- HTML/CSS, JavaScript (V8), Fetch/XHR, DOM, cookies, click, form
- CDP dan WebDriver Bidi
- Tidak: rendering grafis penuh, WebGL, sebagian API modern

Untuk perilaku visual, jalankan spec yang sama dengan `--engine playwright`.

## Flutter

### Web (Flutter Web)

- `flutter build web --web-renderer html`
- Serve `build/web` (mis. `python -m http.server` di folder itu)
- Arahkan `baseUrl` ke URL tersebut
- Pilih selector berdasarkan `key`/semantics; jalankan dengan engine `playwright`
  karena Flutter Web butuh rendering nyata

### Mobile native (Android/iOS)

- Lightpanda tidak berjalan di mobile
- Pakai `flutter drive` / `integration_test` terpisah
- Config `flutter.enabled`, `flutter.deviceId`, `flutter.driverPort` masih placeholder

## Integrasi agent

- **Command Code**: `cmd mcp add wiraxplore -- wiraxplore mcp`, skill di
  `~/.commandcode/skills/wiraxplore/SKILL.md`
- **OpenCode**: `wiraxplore plugin:opencode` (plugin + skill + entri MCP)
- Agent lain: jalankan `wiraxplore mcp` sebagai MCP stdio server
