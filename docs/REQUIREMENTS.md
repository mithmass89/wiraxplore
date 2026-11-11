# Requirements / Persyaratan

## For web app projects / Untuk project web app

### System / Sistem
- Node.js >= 20
- pnpm or npm
- Git
- Lightpanda binary OR Docker (for Windows)

### Lightpanda install
Linux/macOS:
```bash
brew install lightpanda-io/browser/lightpanda
# or
curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux
chmod a+x lightpanda && sudo mv lightpanda /usr/local/bin/
```
Windows: use WSL2 or Docker (`docker run -d -p 127.0.0.1:9222:9222 lightpanda/browser:latest`).

### Project setup / Setup project
1. Web app must be runnable and reachable (dev server or built).
2. Set `baseUrl` in `WiraXplore.config.yaml`.
3. Tests in `tests/e2e` using Playwright API.
4. Avoid heavy graphical features not supported by Lightpanda (WebGL, etc.) — see Lightpanda status.

### Supported by Lightpanda
- HTML/CSS, JS (V8), Fetch/XHR, DOM, cookies, click, forms, CDP, WebDriver Bidi.
- Not: full rendering, WebGL, some advanced APIs. Check WPT status.

## For Flutter projects / Untuk project Flutter

### Web (Flutter Web)
- Build with `flutter build web`.
- Serve build output (e.g. `python -m http.server` in `build/web`).
- Point `baseUrl` to served URL.
- Tests use same Playwright flow against Flutter Web DOM (selectors by `key`/`semantics`).

### Native mobile (Android/iOS)
- Lightpanda does NOT run on mobile. Use Flutter driver / integration_test.
- `WiraXplore` Flutter mode is a placeholder; run `flutter drive` separately.
- Config: `flutter.enabled`, `flutter.deviceId`, `flutter.driverPort`.

### Recommended test strategy
- Web: WiraXplore via this harness.
- Mobile: Flutter integration_test + `flutter test integration_test`.
- Shared: keep page objects/selectors in a common package.

## Agent integration requirements / Persyaratan integrasi agent
- OpenCode: plugin installed in `~/.config/opencode/plugins/WiraXplore`; MCP entry in `opencode.jsonc`.
- Command Code / others: MCP server `WiraXplore mcp` (stdio).
- Agent must have shell access to run `WiraXplore` commands (optional).
