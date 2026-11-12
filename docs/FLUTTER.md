# Flutter Guide / Panduan Flutter

## Current status

Lightpanda is a headless browser for web. Flutter native apps are not browsers, so
they need Flutter's own tooling.

- **Flutter Web**: supported, but use `browser.engine: playwright`. Flutter renders to
  canvas, which Lightpanda does not rasterize; selector-based tests fail there.
- **Native mobile**: use `flutter drive` / `integration_test`. WiraXplore provides
  config + docs only; it does not drive devices.

## Flutter Web workflow

1. Build with the HTML renderer so the DOM is inspectable:
   ```bash
   flutter build web --web-renderer html
   ```
2. Serve the build output:
   ```bash
   cd build/web && python -m http.server 8080
   ```
3. Point the config at it:
   ```yaml
   baseUrl: http://localhost:8080

   browser:
     engine: playwright    # required: Flutter draws to canvas
     driver: playwright
   ```
4. Prefer semantics/`key` selectors. Canvas-only widgets are only reachable
   through semantics labeling.
5. Run: `wiraxplore test --engine playwright`

## Native mobile workflow

```bash
# Android emulator
flutter emulators --launch Pixel_7
flutter drive --target=test_driver/app.dart -d emulator-5554
```

WiraXplore config:
```yaml
flutter:
  enabled: true
  deviceId: emulator-5554
  driverPort: 4444
```

These values are placeholders today; run `flutter drive` yourself.

## Shared test layer

Keep selectors/page objects in `packages/testkit` so web (Playwright) and mobile
(Flutter driver) reuse them.

## Roadmap

- Flutter driver bridge in the CLI (`wiraxplore flutter:drive`).
- Unified report merging web + mobile results.

